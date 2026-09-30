import argparse
import hashlib
import logging
import os
import secrets
import time
from threading import Event, Lock, RLock, Semaphore, Thread
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from crewai import Crew, Process
from dotenv import load_dotenv

from core.agents import (
    AGENT_MODEL_DEFAULTS,
    GEMINI_MODEL,
    GROQ_MODEL,
    agent_model,
    available_llms,
    create_analysis_agents,
    plan_models,
    quota_exhausted,
    validate_llm_keys,
)
from core.registry import get_agent_spec
from core.tasks import create_analysis_tasks
from core.chatbot import (
    generate_chatbot_reply_with_fallback,
    generate_specialist_reply_with_fallback,
    start_chatbot,
)

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("agents.api")

app = FastAPI(title="Project Feasibility AI API", version="1.0")

# Authentication asked by the backend. When AGENTS_API_TOKEN is set every
# /api/* request must send it in the X-Agents-Token header. Optional so the
# service keeps working locally without a token until the backend enables it.
AGENTS_API_TOKEN = os.getenv("AGENTS_API_TOKEN")

# Proxies whose X-Forwarded-For header may be trusted for client identification.
# Empty by default: the raw socket peer is used instead, so a client cannot
# spoof its address to get a fresh rate-limit bucket.
TRUSTED_PROXIES = frozenset(
    proxy.strip() for proxy in os.getenv("TRUSTED_PROXIES", "").split(",") if proxy.strip()
)

# Result caching so identical project ideas are not re-billed to the LLMs.
CACHE_TTL = int(os.getenv("ANALYSIS_CACHE_TTL", "3600"))
CACHE_MAX_ENTRIES = int(os.getenv("ANALYSIS_CACHE_MAX_ENTRIES", "500"))

# How many crew runs may be in flight at once, and how long a request that
# duplicates an already-running analysis waits for it before giving up and
# running its own. Without these a handful of concurrent analyses pins every
# thread in the server's worker pool for the minutes a crew run takes.
MAX_CONCURRENT_ANALYSES = int(os.getenv("MAX_CONCURRENT_ANALYSES", "4"))
# Kept below ANALYSIS_DEADLINE_SECONDS so a duplicate stops waiting for a run
# that is about to be abandoned, instead of blocking longer than the original
# request did.
ANALYSIS_WAIT_SECONDS = float(os.getenv("ANALYSIS_WAIT_SECONDS", "480"))

# Reentrant so a caller that already holds the lock can still drive the cache
# helpers below without deadlocking.
_cache_lock = RLock()
_analyze_slots = Semaphore(max(1, MAX_CONCURRENT_ANALYSES))


class _AnalysisCache:
    """Bounded, self-expiring store for analysis reports.

    Reports are expensive to regenerate but must not accumulate without limit,
    so entries expire and the store is capped oldest-first. Entries are scoped
    to the owning student so one student's analysis_id can never be used to
    read another student's report.
    """

    def __init__(self, ttl: float, max_entries: int):
        self._ttl = ttl
        self._max_entries = max(1, max_entries)
        self._items: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}
        self._reports: dict[tuple[str, str], tuple[float, str]] = {}

    def get(self, owner: str, key: str) -> dict[str, Any] | None:
        now = time.monotonic()
        with _cache_lock:
            entry = self._items.get((owner, key))
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= now:
                self._drop_locked((owner, key))
                return None
            return dict(value)

    def get_report(self, owner: str, analysis_id: str) -> str:
        now = time.monotonic()
        with _cache_lock:
            entry = self._reports.get((owner, analysis_id))
            if entry is None:
                return ""
            expires_at, report = entry
            if expires_at <= now:
                self._reports.pop((owner, analysis_id), None)
                return ""
            return report

    def put(self, owner: str, key: str, value: dict[str, Any]) -> None:
        expires_at = time.monotonic() + self._ttl
        stored = dict(value)
        with _cache_lock:
            self._drop_locked((owner, key))
            self._items[(owner, key)] = (expires_at, stored)
            self._reports[(owner, stored.get("analysis_id") or "")] = (
                expires_at,
                stored.get("report", ""),
            )
            # Sweep against the current time, not this entry's expiry, or the
            # entry that was just inserted is the first one dropped.
            self._evict_locked(time.monotonic())

    def clear(self) -> None:
        with _cache_lock:
            self._items.clear()
            self._reports.clear()

    def _drop_locked(self, slot: tuple[str, str]) -> None:
        entry = self._items.pop(slot, None)
        if entry is not None:
            self._reports.pop((slot[0], entry[1].get("analysis_id") or ""), None)

    def _evict_locked(self, now: float) -> None:
        for slot in [s for s, (exp, _) in self._items.items() if exp <= now]:
            self._drop_locked(slot)
        while len(self._items) > self._max_entries:
            self._drop_locked(next(iter(self._items)))
        # Drop report entries with no surviving item. Reports are keyed by
        # analysis_id and items by cache key, so this rebuild is what keeps the
        # two maps from drifting apart.
        live_ids = {
            (owner, value.get("analysis_id") or "")
            for (owner, _), (_, value) in self._items.items()
        }
        for slot in [s for s in self._reports if s not in live_ids]:
            self._reports.pop(slot, None)

    def __len__(self) -> int:
        with _cache_lock:
            self._evict_locked(time.monotonic())
            return len(self._items)


_analysis_cache = _AnalysisCache(CACHE_TTL, CACHE_MAX_ENTRIES)


class _Flight:
    """Single-flight record so duplicate analyses share one crew run."""

    def __init__(self):
        self.done = Event()
        self.result: dict[str, Any] | None = None


_inflight: dict[tuple[str, str], _Flight] = {}
_inflight_guard = Lock()


def _acquire_flight(slot: tuple[str, str]) -> tuple[_Flight, bool]:
    with _inflight_guard:
        flight = _inflight.get(slot)
        if flight is not None:
            return flight, False
        flight = _Flight()
        _inflight[slot] = flight
        return flight, True


def _release_flight(slot: tuple[str, str], flight: _Flight, result: dict[str, Any] | None) -> None:
    with _inflight_guard:
        if _inflight.get(slot) is flight:
            _inflight.pop(slot, None)
    flight.result = result
    flight.done.set()


class _InMemoryRateLimiter:
    def __init__(self, max_requests: int, window_seconds: float, max_keys: int = 10_000):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, list[float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            timestamps = [
                ts for ts in self._hits.get(key, [])
                if now - ts < self.window_seconds
            ]
            if len(timestamps) >= self.max_requests:
                retry_after = int(self.window_seconds - (now - timestamps[0])) + 1
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            if not timestamps:
                # Drop the stale entry before recording the new hit, which also
                # moves the key to the end of the insertion order so eviction
                # discards the least recently active key first.
                self._hits.pop(key, None)
            timestamps.append(now)
            self._hits[key] = timestamps
            while len(self._hits) > self.max_keys:
                self._hits.pop(next(iter(self._hits)), None)


analyze_limiter = _InMemoryRateLimiter(max_requests=10, window_seconds=60.0)
chat_limiter = _InMemoryRateLimiter(max_requests=60, window_seconds=60.0)

# Hard ceiling on one analysis request. A wedged provider must not hold a
# request open indefinitely, and the backend's AGENTS_READ_TIMEOUT has to stay
# above this value so the backend sees a clean 503 rather than a read timeout.
ANALYSIS_DEADLINE_SECONDS = float(os.getenv("ANALYSIS_DEADLINE_SECONDS", "540"))


def _client_host(request: Request) -> str:
    """Socket peer, honouring X-Forwarded-For only from a configured proxy."""
    peer = request.client.host if request.client else "unknown"
    if peer in TRUSTED_PROXIES:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return peer


def _caller_key(request: Request) -> str:
    """Identity used for rate limiting and for scoping cached reports.

    The backend proxies every call, so the socket peer is the backend itself for
    every student. Prefer the forwarded student id so limits are per student
    rather than one shared platform-wide budget.
    """
    student_id = (request.headers.get("X-Student-Id") or "").strip()
    if student_id:
        return f"student:{student_id}"
    return f"ip:{_client_host(request)}"


async def require_api_token(request: Request) -> str:
    if AGENTS_API_TOKEN:
        header = request.headers.get("X-Agents-Token")
        if not header or not secrets.compare_digest(header, AGENTS_API_TOKEN):
            raise HTTPException(status_code=401, detail="Unauthorized.")
    return _caller_key(request)


class ProjectRequest(BaseModel):
    idea: str = Field(..., min_length=10, max_length=4000)


class ChatRequest(BaseModel):
    project_title: str = Field("", max_length=200)
    project_idea: str = Field("", max_length=4000)
    project_blueprint: str = Field("", max_length=100000)
    analysis_id: str = Field("", max_length=64)
    chat_history: str = Field("", max_length=20000)
    question: str = Field(..., min_length=1, max_length=2000)
    agent_type: str = Field("mentor", max_length=50)


def _cache_key(idea: str) -> str:
    """Stable key for an idea, bound to the models that produced it.

    Every agent's model is part of the key, so changing a tier assignment or a
    MODEL_* override stops reports generated by the previous configuration
    from being served.
    """
    normalized = " ".join(idea.strip().lower().split())
    tiers = "|".join(
        f"{key}={agent_model(key)}" for key in sorted(AGENT_MODEL_DEFAULTS)
    )
    seed = f"{GEMINI_MODEL}|{GROQ_MODEL}|{tiers}|{normalized}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def _new_analysis_id() -> str:
    """Opaque, unguessable id.

    Deriving this from the idea made it identical for every student who
    submitted the same idea, which let one student's id retrieve another
    student's report.
    """
    return secrets.token_urlsafe(12)


def create_project_crew(provider: str | None = None) -> Crew:
    """Create the complete sequential crew used by the API and CLI.

    Always builds fresh agents and tasks so concurrent runs never share crew
    state. The default runs each agent on its configured tier model (see
    ``AGENT_MODEL_DEFAULTS``); a provider name forces every agent onto that
    provider for a retry.
    """
    agents = create_analysis_agents(provider=provider)
    tasks = create_analysis_tasks(agents)

    return Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=Process.sequential,
        verbose=os.getenv("CREW_VERBOSE", "0") == "1",
        max_rpm=int(os.getenv("CREW_MAX_RPM", "10")),
    )


def _retry_providers() -> tuple[str, ...]:
    """Single-provider retry levels, Groq first, skipping unkeyed providers."""
    return tuple(p for p in ("groq", "gemini") if p in available_llms())


def _run_analysis(idea: str, owner: str) -> dict[str, Any]:
    """Run the tiered crew, then retry on each configured provider in turn."""
    errors: list[str] = []
    for provider in (None, *_retry_providers()):
        label = provider or "tiered"
        try:
            project_crew = create_project_crew(provider)
            result = project_crew.kickoff(inputs={"student_idea": idea})
            response: dict[str, Any] = {
                "status": "success",
                "report": str(result),
                "token_usage": getattr(result, "token_usage", None),
                "cost": getattr(result, "cost", None),
                "from_cache": False,
                "analysis_id": _new_analysis_id(),
            }
            _analysis_cache.put(owner, _cache_key(idea), response)
            return response
        except Exception as error:
            errors.append(f"{label}: {error}")
            if quota_exhausted(error):
                logger.warning(
                    "Provider %s is out of quota, falling back: %s", label, error
                )
            else:
                logger.error(
                    "Analysis failed on provider %s, falling back: %s",
                    label,
                    error,
                    exc_info=True,
                )

    logger.error("Analysis failed on all providers: %s", "; ".join(errors))
    raise HTTPException(
        status_code=503,
        detail="Analysis failed after exhausting all available AI providers. Please try again in a few minutes.",
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "providers": available_llms(),
        "models": dict(sorted(plan_models().items())),
        "analysis_cache_entries": len(_analysis_cache),
    }


@app.post("/api/analyze")
def analyze_project_idea(
    payload: ProjectRequest, caller: str = Depends(require_api_token)
) -> dict[str, Any]:
    analyze_limiter.check(caller)

    if not payload.idea.strip():
        raise HTTPException(status_code=400, detail="Project idea is required.")

    key = _cache_key(payload.idea)
    cached = _analysis_cache.get(caller, key)
    if cached is not None:
        cached["from_cache"] = True
        return cached

    try:
        validate_llm_keys()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Analysis is unavailable right now. Please try again later.")

    slot = (caller, key)
    flight, is_leader = _acquire_flight(slot)
    if not is_leader:
        # An identical analysis is already running. Wait for it rather than
        # paying for a second crew run.
        if flight.done.wait(ANALYSIS_WAIT_SECONDS) and flight.result is not None:
            served = dict(flight.result)
            served["from_cache"] = True
            return served

    if not _analyze_slots.acquire(blocking=False):
        if is_leader:
            _release_flight(slot, flight, None)
        raise HTTPException(
            status_code=503,
            detail="The analysis service is busy. Please try again in a minute.",
            headers={"Retry-After": "60"},
        )

    # The crew runs on a worker thread so a hung provider cannot keep this
    # request open forever. A thread cannot be cancelled, so the worker owns
    # releasing both the concurrency slot and the single-flight record, and the
    # request simply stops waiting once the deadline passes. Holding the slot
    # until the crew really finishes is what stops one wedged run from turning
    # into a permanent "service is busy" for every later request.
    outcome: dict[str, Any] = {}
    finished = Event()

    def work() -> None:
        try:
            outcome["response"] = _run_analysis(payload.idea, caller)
        except BaseException as error:  # surfaced on the waiting request thread
            outcome["error"] = error
        finally:
            _analyze_slots.release()
            if is_leader:
                _release_flight(slot, flight, outcome.get("response"))
            finished.set()

    Thread(target=work, name="analysis-crew", daemon=True).start()

    if not finished.wait(ANALYSIS_DEADLINE_SECONDS):
        logger.error(
            "Analysis for %s exceeded the %.0fs deadline and is still running",
            caller,
            ANALYSIS_DEADLINE_SECONDS,
        )
        raise HTTPException(
            status_code=503,
            detail="Analysis is taking longer than expected. Please try again in a few minutes.",
            headers={"Retry-After": "60"},
        )

    error = outcome.get("error")
    if error is not None:
        if isinstance(error, HTTPException):
            raise error
        logger.error("Analysis failed unexpectedly: %s", error, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Analysis failed after exhausting all available AI providers. Please try again in a few minutes.",
        )

    return outcome["response"]


@app.post("/api/chat")
def chat_about_project(
    payload: ChatRequest, caller: str = Depends(require_api_token)
) -> dict[str, Any]:
    chat_limiter.check(caller)

    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question is required.")

    # Reject unknown agent types before building a Crew or spending an LLM call.
    try:
        get_agent_spec(payload.agent_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported agent type.")

    try:
        validate_llm_keys()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Chat is unavailable right now. Please try again later.")

    blueprint = payload.project_blueprint
    # If the backend did not send the blueprint but gave us an analysis_id,
    # fall back to the report we produced earlier for this same student.
    if not blueprint.strip() and payload.analysis_id:
        blueprint = _analysis_cache.get_report(caller, payload.analysis_id)

    try:
        if payload.agent_type == "mentor":
            answer = generate_chatbot_reply_with_fallback(
                project_idea=payload.project_idea,
                project_title=payload.project_title,
                chat_history=payload.chat_history,
                user_question=payload.question,
                project_blueprint=blueprint,
            )
        else:
            answer = generate_specialist_reply_with_fallback(
                agent_type=payload.agent_type,
                project_idea=payload.project_idea,
                project_title=payload.project_title,
                chat_history=payload.chat_history,
                user_question=payload.question,
                project_blueprint=blueprint,
            )
        return {"answer": answer}
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported agent type.")
    except RuntimeError as error:
        logger.error("Chat request failed: %s", error)
        raise HTTPException(status_code=503, detail="Chat is unavailable right now. Please try again later.")
    except Exception as error:
        logger.error("Unexpected chat error: %s", error)
        raise HTTPException(status_code=503, detail="Chat is unavailable right now. Please try again later.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a blueprint and chat about it")
    parser.add_argument(
        "idea",
        nargs="?",
        default="A mobile app that helps local volunteers find nearby community projects",
        help="Project idea to analyze",
    )
    args = parser.parse_args()

    try:
        validate_llm_keys()
    except RuntimeError as error:
        print(f"Error: {error}")
        raise SystemExit(1)

    print("Generating Project Blueprint...")
    try:
        final_blueprint = create_project_crew().kickoff(
            inputs={"student_idea": args.idea}
        )
    except KeyboardInterrupt:
        print("\nInterrupted. Exiting.")
        raise SystemExit(130)

    print("\n=== YOUR PROJECT BLUEPRINT IS READY ===")
    print(final_blueprint)
    start_chatbot(str(final_blueprint))
