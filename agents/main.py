import argparse
import hashlib
from html import escape
import json
import logging
import os
import re
import secrets
import time
from threading import Event, Lock, RLock, Semaphore, Thread
from typing import Any, Callable

import requests
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
    create_resource_agent,
    plan_models,
    quota_exhausted,
    validate_llm_keys,
)
from core.registry import AGENT_REGISTRY, get_agent_spec
from core.risk_assessment import RiskAssessment, generate_project_risks_with_fallback
from core.plan_adjustment import (
    PlanAdjustment,
    generate_plan_adjustment_with_fallback,
)
from core.tasks import TASK_KEYS, create_analysis_tasks, create_resource_task
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

# The backend must authenticate every /api/* request with this token.
AGENTS_API_TOKEN = os.getenv("AGENTS_API_TOKEN")
BACKEND_PROGRESS_URL = os.getenv("BACKEND_PROGRESS_URL", "").rstrip("/")
BACKEND_PROGRESS_TOKEN = os.getenv("BACKEND_PROGRESS_TOKEN")
if os.getenv("APP_ENV", "").lower() == "production" and not AGENTS_API_TOKEN:
    raise RuntimeError("AGENTS_API_TOKEN must be set when APP_ENV=production.")
if (
    os.getenv("APP_ENV", "").lower() == "production"
    and AGENTS_API_TOKEN is not None
    and len(AGENTS_API_TOKEN) < 32
):
    raise RuntimeError("AGENTS_API_TOKEN must be at least 32 characters in production.")
if os.getenv("APP_ENV", "").lower() == "production":
    if not BACKEND_PROGRESS_URL or not BACKEND_PROGRESS_TOKEN:
        raise RuntimeError(
            "BACKEND_PROGRESS_URL and BACKEND_PROGRESS_TOKEN must be configured in production."
        )
    if len(BACKEND_PROGRESS_TOKEN) < 32:
        raise RuntimeError(
            "BACKEND_PROGRESS_TOKEN must be at least 32 characters in production."
        )

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
# returning a retryable response. Without these a handful of concurrent
# analyses can pin every server worker for the duration of a crew run.
MAX_CONCURRENT_ANALYSES = int(os.getenv("MAX_CONCURRENT_ANALYSES", "4"))
# Duplicate requests do not start another crew after this wait expires.
ANALYSIS_WAIT_SECONDS = float(os.getenv("ANALYSIS_WAIT_SECONDS", "480"))

# Reentrant so a caller that already holds the lock can still drive the cache
# helpers below without deadlocking.
_cache_lock = RLock()
_analyze_slots = Semaphore(max(1, MAX_CONCURRENT_ANALYSES))
TASK_LABELS = {
    "feasibility": "Feasibility",
    "architect": "Architecture",
    "scope": "MVP scope",
    "timeline": "Timeline",
    "resource": "Learning resources",
    "ui_ux": "UI/UX",
    "planning": "Execution plan",
    "professor": "QA review",
}
CORE_TASK_KEYS = tuple(key for key in TASK_KEYS if key != "resource")
RESOURCE_LLM_TIMEOUT_SECONDS = max(
    1, int(os.getenv("RESOURCE_LLM_TIMEOUT_SECONDS", "30"))
)
RESOURCE_FALLBACK_OUTPUT = (
    "Live learning-resource verification was unavailable during this analysis. "
    "The rest of the project analysis completed successfully. Use the official "
    "documentation sites for the technologies in the Architecture section, or "
    "request resource recommendations from the AI Mentor."
)
MAX_SAVED_STEP_OUTPUT_CHARS = 50000
OUTPUT_TRUNCATION_MARKER = "\n\n[Report excerpt truncated to fit the saved-output limit.]"


def _bounded_step_output(output: str) -> str:
    if len(output) <= MAX_SAVED_STEP_OUTPUT_CHARS:
        return output
    excerpt_length = MAX_SAVED_STEP_OUTPUT_CHARS - len(OUTPUT_TRUNCATION_MARKER)
    return output[:excerpt_length].rstrip() + OUTPUT_TRUNCATION_MARKER


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

# This is a whole-crew deadline, not a per-agent timeout. The backend's
# AGENTS_READ_TIMEOUT must leave room for this response to reach its worker.
ANALYSIS_DEADLINE_SECONDS = float(os.getenv("ANALYSIS_DEADLINE_SECONDS", "3600"))


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
    if not AGENTS_API_TOKEN:
        if os.getenv("APP_ENV", "").lower() == "production":
            logger.critical("AGENTS_API_TOKEN is not configured in production")
            raise HTTPException(
                status_code=503,
                detail="Agents service authentication is not configured.",
            )
        return _caller_key(request)
    header = request.headers.get("X-Agents-Token")
    if not header or not secrets.compare_digest(header, AGENTS_API_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized.")
    return _caller_key(request)


class ProjectRequest(BaseModel):
    idea: str = Field(..., min_length=10, max_length=4000)
    student_context: str = Field("", max_length=3000)
    revision_context: str = Field("", max_length=20000)
    run_id: int | None = Field(None, gt=0)
    attempt_id: str = Field("", max_length=64)


class RiskAssessmentRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    idea: str = Field(..., min_length=10, max_length=4000)
    technology_stack: str = Field("", max_length=500)
    duration: str = Field("", max_length=50)
    project_report: str = Field("", max_length=30000)


class PlanCheckInRequest(BaseModel):
    completed_work: str = Field(..., min_length=3, max_length=3000)
    in_progress: str = Field(..., min_length=3, max_length=3000)
    blockers: str = Field("", max_length=3000)
    next_week_goal: str = Field(..., min_length=3, max_length=2000)
    confidence: int = Field(..., ge=1, le=5)
    mentor_feedback: str = Field("", max_length=10000)


class CurrentMilestoneRequest(BaseModel):
    id: int = Field(..., gt=0)
    position: int = Field(..., gt=0)
    title: str = Field(..., min_length=1, max_length=160)
    description: str = Field(..., min_length=1, max_length=10000)
    completed: bool


class PlanAdjustmentRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    idea: str = Field(..., min_length=10, max_length=4000)
    technology_stack: str = Field("", max_length=500)
    duration: str = Field("", max_length=50)
    project_report: str = Field("", max_length=30000)
    check_in: PlanCheckInRequest
    current_milestones: list[CurrentMilestoneRequest] = Field(..., max_length=50)


class ChatRequest(BaseModel):
    project_title: str = Field("", max_length=200)
    project_idea: str = Field("", max_length=4000)
    project_blueprint: str = Field("", max_length=100000)
    student_context: str = Field("", max_length=3000)
    analysis_id: str = Field("", max_length=64)
    chat_history: str = Field("", max_length=20000)
    question: str = Field(..., min_length=1, max_length=2000)
    agent_type: str = Field("mentor", max_length=50)


def _cache_key(
    idea: str,
    student_context: str = "",
    revision_context: str = "",
) -> str:
    """Stable key for an idea, bound to the models that produced it.

    Every agent's model is part of the key, so changing a tier assignment or a
    MODEL_* override stops reports generated by the previous configuration
    from being served.
    """
    normalized = " ".join(idea.strip().lower().split())
    tiers = "|".join(
        f"{key}={agent_model(key)}" for key in sorted(AGENT_MODEL_DEFAULTS)
    )
    normalized_context = " ".join(student_context.strip().lower().split())
    normalized_revision = " ".join(revision_context.strip().lower().split())
    seed = (
        f"{GEMINI_MODEL}|{GROQ_MODEL}|{tiers}|{normalized}|{normalized_context}"
        f"|{normalized_revision}"
    )
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def _new_analysis_id() -> str:
    """Opaque, unguessable id.

    Deriving this from the idea made it identical for every student who
    submitted the same idea, which let one student's id retrieve another
    student's report.
    """
    return secrets.token_urlsafe(12)


def create_project_crew(
    provider: str | None = None,
    task_callback: Callable[[Any], None] | None = None,
    task_keys: tuple[str, ...] | None = None,
    revision_context: str = "",
) -> Crew:
    """Create a sequential crew for the requested analysis tasks.

    Always builds fresh agents and tasks so concurrent runs never share crew
    state. The default runs each agent on its configured tier model (see
    ``AGENT_MODEL_DEFAULTS``); a provider name forces every agent onto that
    provider for a retry.
    """
    agents = create_analysis_agents(provider=provider)
    tasks = create_analysis_tasks(agents, task_keys, revision_context)

    return Crew(
        agents=list(agents.values()),
        tasks=tasks,
        task_callback=task_callback,
        process=Process.sequential,
        verbose=os.getenv("CREW_VERBOSE", "0") == "1",
        max_rpm=int(os.getenv("CREW_MAX_RPM", "10")),
    )


def create_resource_crew(
    architecture_output: str,
    provider: str | None = None,
    task_callback: Callable[[Any], None] | None = None,
) -> Crew:
    """Build the isolated, bounded Resource Agent stage that runs last."""
    agent = create_resource_agent(
        provider=provider,
        timeout=RESOURCE_LLM_TIMEOUT_SECONDS,
    )
    task = create_resource_task(agent, architecture_output)
    return Crew(
        agents=[agent],
        tasks=[task],
        task_callback=task_callback,
        process=Process.sequential,
        verbose=os.getenv("CREW_VERBOSE", "0") == "1",
        max_rpm=int(os.getenv("CREW_MAX_RPM", "10")),
    )


def _retry_providers() -> tuple[str, ...]:
    """Single-provider retry levels, Groq first, skipping unkeyed providers."""
    return tuple(p for p in ("groq", "gemini") if p in available_llms())


def _resource_stage_providers(requested: str | None) -> tuple[str | None, ...]:
    """Providers for the Resource Agent, the requested one first.

    The seven core agents get this ladder from the retry loop in _run_analysis.
    The Resource Agent runs in its own single-agent crew afterwards and used to
    try exactly one provider, so a single empty reply - which Gemini serves as a
    content-free 200 rather than an exception - cost every report its Learning
    resources section while the rest of the analysis came back healthy.
    """
    return (requested, *(p for p in _retry_providers() if p != requested))


class _ProgressReportingError(RuntimeError):
    pass


def _notify_backend_progress(
    run_id: int,
    attempt_id: str,
    step_key: str,
    step_status: str,
    output: str | None = None,
) -> None:
    if not BACKEND_PROGRESS_URL or not BACKEND_PROGRESS_TOKEN:
        raise _ProgressReportingError(
            "Backend progress callback URL or token is not configured."
        )
    try:
        payload = {
            "step_key": step_key,
            "attempt_id": attempt_id,
            "status": step_status,
        }
        if output is not None:
            payload["output"] = output
        response = requests.post(
            f"{BACKEND_PROGRESS_URL}/{run_id}/steps",
            json=payload,
            headers={"X-Agents-Progress-Token": BACKEND_PROGRESS_TOKEN},
            timeout=(5, 10),
        )
        response.raise_for_status()
    except requests.RequestException as error:
        logger.exception("Could not report progress for analysis run %d", run_id)
        raise _ProgressReportingError(
            f"Could not report progress for analysis run {run_id}."
        ) from error


def _report_cached_progress(run_id: int, attempt_id: str, report_text: str) -> None:
    report_sections: dict[str, str] = {}
    for step_key, label in TASK_LABELS.items():
        match = re.search(
            rf"(?ms)^## {re.escape(label)}\s*\n(.*?)(?=^## |\Z)",
            report_text,
        )
        if match:
            report_sections[step_key] = match.group(1).strip()
    for step_key in TASK_KEYS:
        _notify_backend_progress(run_id, attempt_id, step_key, "running")
        output = report_sections.get(step_key)
        if not output:
            raise _ProgressReportingError(
                f"Cached analysis is missing the {step_key} report section."
            )
        _notify_backend_progress(
            run_id,
            attempt_id,
            step_key,
            "completed",
            output=_bounded_step_output(output),
        )


def _run_resource_stage(
    architecture_output: str,
    idea: str,
    student_context: str,
    requested_provider: str | None,
    task_callback: Callable[[Any], None] | None,
) -> str:
    """Return verified learning resources, falling back across providers.

    Raises only once every provider has been tried, so the caller can still
    substitute the placeholder resources and keep the rest of the report.
    """
    candidates = _resource_stage_providers(requested_provider)
    failures: list[str] = []
    for index, candidate in enumerate(candidates):
        label = candidate or "tiered"
        try:
            resource_crew = create_resource_crew(
                architecture_output,
                candidate,
                task_callback=task_callback,
            )
            resource_result = resource_crew.kickoff(
                inputs={"student_idea": idea, "student_context": student_context}
            )
            resource_outputs = getattr(resource_result, "tasks_output", None)
            if (
                not isinstance(resource_outputs, list)
                or len(resource_outputs) != 1
            ):
                raise ValueError("The Resource Agent returned an incomplete report.")
            resource_output = getattr(resource_outputs[0], "raw", None)
            if not isinstance(resource_output, str) or not resource_output.strip():
                raise ValueError("The Resource Agent returned an empty report.")
            return resource_output.strip()
        except _ProgressReportingError:
            raise
        except Exception as error:
            failures.append(f"{label}: {error}")
            logger.warning(
                "The Resource Agent failed on the %s plan (%d of %d providers tried).",
                label,
                index + 1,
                len(candidates),
                exc_info=True,
            )
    raise RuntimeError(
        "The Resource Agent failed on every provider: " + "; ".join(failures)
    )


def _run_analysis(
    idea: str,
    owner: str,
    student_context: str = "",
    run_id: int | None = None,
    attempt_id: str = "",
    revision_context: str = "",
) -> dict[str, Any]:
    """Run the tiered crew, then retry on each configured provider in turn."""
    errors: list[str] = []
    for provider in (None, *_retry_providers()):
        label = provider or "tiered"
        current_step: list[str | None] = [None]

        def report(
            step_key: str, step_status: str, output: str | None = None
        ) -> None:
            if run_id is not None:
                if output is None:
                    _notify_backend_progress(
                        run_id, attempt_id, step_key, step_status
                    )
                else:
                    _notify_backend_progress(
                        run_id, attempt_id, step_key, step_status, output=output
                    )

        def task_completed(output: Any) -> None:
            agent_role = getattr(output, "agent", "")
            step_key = next(
                (
                    spec.key
                    for spec in AGENT_REGISTRY.values()
                    if spec.agent is not None and spec.agent.role == agent_role
                ),
                None,
            )
            if step_key is None:
                raise RuntimeError("CrewAI returned progress for an unknown agent.")
            step_output = getattr(output, "raw", None)
            if step_key == "planning" and isinstance(step_output, str):
                try:
                    plan_data = json.loads(step_output)
                    step_output = (
                        plan_data.get("execution_plan")
                        if isinstance(plan_data, dict)
                        else None
                    )
                except (json.JSONDecodeError, AttributeError):
                    step_output = None
            if not isinstance(step_output, str) or not step_output.strip():
                raise ValueError(f"The {step_key} agent returned an empty report.")
            report(step_key, "completed", output=_bounded_step_output(step_output.strip()))
            current_step[0] = None
            if step_key == "resource":
                return
            index = CORE_TASK_KEYS.index(step_key) + 1
            if index < len(CORE_TASK_KEYS):
                current_step[0] = CORE_TASK_KEYS[index]
                report(current_step[0], "running")
            else:
                current_step[0] = "resource"
                report("resource", "running")

        try:
            for step_key in TASK_KEYS:
                report(step_key, "pending")
            current_step[0] = CORE_TASK_KEYS[0]
            report(CORE_TASK_KEYS[0], "running")
            if run_id is None:
                revision_kwargs = (
                    {"revision_context": revision_context} if revision_context else {}
                )
                project_crew = create_project_crew(
                    provider,
                    task_keys=CORE_TASK_KEYS,
                    **revision_kwargs,
                )
            else:
                revision_kwargs = (
                    {"revision_context": revision_context} if revision_context else {}
                )
                project_crew = create_project_crew(
                    provider,
                    task_callback=task_completed,
                    task_keys=CORE_TASK_KEYS,
                    **revision_kwargs,
                )
            result = project_crew.kickoff(
                inputs={
                    "student_idea": idea,
                    "student_context": student_context,
                    "revision_context": escape(revision_context, quote=False),
                }
            )
            tasks_output = getattr(result, "tasks_output", None)
            if (
                not isinstance(tasks_output, list)
                or len(tasks_output) != len(CORE_TASK_KEYS)
            ):
                raise ValueError("The core analysis crew returned an incomplete report.")
            planning_raw = getattr(
                tasks_output[CORE_TASK_KEYS.index("planning")], "raw", None
            )
            if not isinstance(planning_raw, str):
                raise ValueError("The planning agent returned an invalid output.")
            try:
                planning_data = json.loads(planning_raw)
            except json.JSONDecodeError as error:
                raise ValueError("The planning agent output was not valid JSON.") from error
            milestones = (
                planning_data.get("milestones")
                if isinstance(planning_data, dict)
                else None
            )
            execution_plan = (
                planning_data.get("execution_plan")
                if isinstance(planning_data, dict)
                else None
            )
            if (
                not isinstance(milestones, list)
                or not milestones
                or len(milestones) > 20
            ):
                raise ValueError("The planning agent did not return valid milestones.")
            if not isinstance(execution_plan, str) or not execution_plan.strip():
                raise ValueError("The planning agent did not return an execution plan.")
            validated_milestones: list[dict[str, str]] = []
            for milestone in milestones:
                if not isinstance(milestone, dict):
                    raise ValueError("A planning milestone was not an object.")
                title = milestone.get("title")
                description = milestone.get("description")
                if (
                    not isinstance(title, str)
                    or not title.strip()
                    or not isinstance(description, str)
                    or not description.strip()
                ):
                    raise ValueError("A planning milestone is missing its title or description.")
                validated_milestones.append(
                    {"title": title.strip()[:160], "description": description.strip()}
                )
            task_outputs: dict[str, Any] = dict(zip(CORE_TASK_KEYS, tasks_output, strict=True))
            architecture_output = getattr(task_outputs["architect"], "raw", None)
            if not isinstance(architecture_output, str) or not architecture_output.strip():
                raise ValueError("The architecture agent returned an empty report.")
            try:
                resource_output = _run_resource_stage(
                    architecture_output,
                    idea,
                    student_context,
                    provider,
                    task_completed if run_id is not None else None,
                )
            except _ProgressReportingError:
                raise
            except Exception:
                logger.warning(
                    "The Resource Agent failed after core analysis; returning the complete report with fallback resources.",
                    exc_info=True,
                )
                resource_output = RESOURCE_FALLBACK_OUTPUT
                if run_id is not None:
                    report(
                        "resource",
                        "completed",
                        output=_bounded_step_output(resource_output),
                    )
                    current_step[0] = None

            sections: list[str] = []
            for step_key in TASK_KEYS:
                output_text = (
                    execution_plan
                    if step_key == "planning"
                    else resource_output
                    if step_key == "resource"
                    else getattr(task_outputs[step_key], "raw", None)
                )
                if not isinstance(output_text, str) or not output_text.strip():
                    raise ValueError(f"The {step_key} agent returned an empty report.")
                sections.append(f"## {TASK_LABELS[step_key]}\n\n{output_text.strip()}")
            combined_report = "\n\n".join(sections)
            response: dict[str, Any] = {
                "status": "success",
                "report": combined_report,
                "milestones": validated_milestones,
                "token_usage": getattr(result, "token_usage", None),
                "cost": getattr(result, "cost", None),
                "from_cache": False,
                "analysis_id": _new_analysis_id(),
            }
            _analysis_cache.put(
                owner,
                _cache_key(idea, student_context, revision_context),
                response,
            )
            return response
        except _ProgressReportingError:
            raise
        except Exception as error:
            if current_step[0] is not None:
                try:
                    report(current_step[0], "failed")
                except _ProgressReportingError:
                    raise
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


@app.post("/api/risks/assess", response_model=RiskAssessment)
def assess_project_risks(
    payload: RiskAssessmentRequest,
    caller: str = Depends(require_api_token),
) -> dict[str, Any]:
    chat_limiter.check(caller)
    try:
        return generate_project_risks_with_fallback(payload.model_dump())
    except RuntimeError as error:
        logger.exception("Risk assessment failed for caller %s", caller)
        raise HTTPException(
            status_code=503,
            detail="Risk assessment failed on all configured AI providers.",
        ) from error


@app.post("/api/plans/adjust", response_model=PlanAdjustment)
def adjust_project_plan(
    payload: PlanAdjustmentRequest,
    caller: str = Depends(require_api_token),
) -> dict[str, Any]:
    chat_limiter.check(caller)
    try:
        return generate_plan_adjustment_with_fallback(payload.model_dump())
    except RuntimeError as error:
        logger.exception("Plan adjustment failed for caller %s", caller)
        raise HTTPException(
            status_code=503,
            detail="Plan adjustment failed on all configured AI providers.",
        ) from error


@app.post("/api/analyze")
def analyze_project_idea(
    payload: ProjectRequest, caller: str = Depends(require_api_token)
) -> dict[str, Any]:
    analyze_limiter.check(caller)

    if not payload.idea.strip():
        raise HTTPException(status_code=400, detail="Project idea is required.")

    key = _cache_key(
        payload.idea,
        payload.student_context,
        payload.revision_context,
    )
    cached = _analysis_cache.get(caller, key)
    if cached is not None:
        if payload.run_id is not None:
            try:
                _report_cached_progress(
                    payload.run_id, payload.attempt_id, cached["report"]
                )
            except _ProgressReportingError:
                raise HTTPException(
                    status_code=503,
                    detail="Analysis progress could not be saved. Please retry.",
                )
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
        # paying for a second crew run. A timeout is returned explicitly rather
        # than starting duplicate work while the original may still be running.
        if not flight.done.wait(ANALYSIS_WAIT_SECONDS):
            raise HTTPException(
                status_code=503,
                detail="An identical analysis is still running. Please retry shortly.",
                headers={"Retry-After": "60"},
            )
        if flight.result is None:
            raise HTTPException(
                status_code=503,
                detail="The matching analysis did not complete. Please retry.",
            )
        served = dict(flight.result)
        if payload.run_id is not None:
            try:
                _report_cached_progress(
                    payload.run_id, payload.attempt_id, flight.result["report"]
                )
            except _ProgressReportingError:
                raise HTTPException(
                    status_code=503,
                    detail="Analysis progress could not be saved. Please retry.",
                )
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
            outcome["response"] = _run_analysis(
                payload.idea,
                caller,
                student_context=payload.student_context,
                revision_context=payload.revision_context,
                run_id=payload.run_id,
                attempt_id=payload.attempt_id,
            )
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
    project_idea = payload.project_idea
    if payload.student_context.strip():
        project_idea = (
            f"{project_idea}\n\nStudent skill profile:\n{payload.student_context.strip()}"
        )

    try:
        if payload.agent_type == "mentor":
            answer = generate_chatbot_reply_with_fallback(
                project_idea=project_idea,
                project_title=payload.project_title,
                chat_history=payload.chat_history,
                user_question=payload.question,
                project_blueprint=blueprint,
            )
        else:
            answer = generate_specialist_reply_with_fallback(
                agent_type=payload.agent_type,
                project_idea=project_idea,
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
            inputs={"student_idea": args.idea, "student_context": ""}
        )
    except KeyboardInterrupt:
        print("\nInterrupted. Exiting.")
        raise SystemExit(130)

    print("\n=== YOUR PROJECT BLUEPRINT IS READY ===")
    print(final_blueprint)
    start_chatbot(str(final_blueprint))
