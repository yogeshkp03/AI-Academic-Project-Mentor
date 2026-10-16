import logging
import os
import time
from typing import Any, cast

import requests

AGENTS_BASE_URL = os.getenv(
    "AGENTS_BASE_URL",
    "http://127.0.0.1:8001",
).rstrip("/")
AGENTS_ANALYZE_URL = f"{AGENTS_BASE_URL}/api/analyze"
AGENTS_CHAT_URL = f"{AGENTS_BASE_URL}/api/chat"
AGENTS_RISK_ASSESS_URL = f"{AGENTS_BASE_URL}/api/risks/assess"
AGENTS_PLAN_ADJUST_URL = f"{AGENTS_BASE_URL}/api/plans/adjust"
# When set, forwarded to the agents service as X-Agents-Token. That service
# enforces it as AGENTS_API_TOKEN when configured.
AI_SERVICE_API_KEY = os.getenv("AI_SERVICE_API_KEY")

# Analysis runs in a Celery worker and may take up to the agents service's
# whole-crew deadline. Keep the connect timeout short and the read timeout
# longer than that deadline so a worker receives the service's final response.
AGENTS_CONNECT_TIMEOUT = float(os.getenv("AGENTS_CONNECT_TIMEOUT", "5"))
AGENTS_READ_TIMEOUT = float(os.getenv("AGENTS_READ_TIMEOUT", "3630"))
AGENTS_CHAT_READ_TIMEOUT = float(os.getenv("AGENTS_CHAT_READ_TIMEOUT", "300"))
AGENTS_MAX_ATTEMPTS = int(os.getenv("AGENTS_MAX_ATTEMPTS", "2"))

# Mirrors the agents service's chat_history cap. History is trimmed to fit
# before sending, so a long conversation degrades instead of being rejected.
MAX_CHAT_HISTORY_CHARS = 20000

logger = logging.getLogger(__name__)


def _auth_headers(student_id: int | None = None) -> dict[str, str]:
    """Headers for the agents service.

    X-Student-Id lets the agents service scope rate limits and cached reports to
    one student. Without it the agents service sees a single peer (this backend)
    and can only apply one platform-wide limit.
    """
    if not AI_SERVICE_API_KEY:
        raise RuntimeError("AI_SERVICE_API_KEY must be configured for agents service calls.")
    headers: dict[str, str] = {"X-Agents-Token": AI_SERVICE_API_KEY}
    if student_id is not None:
        headers["X-Student-Id"] = str(student_id)
    return headers


def _post_json(
    url: str,
    payload: dict[str, Any],
    student_id: int | None = None,
    *,
    max_attempts: int | None = None,
    extra_headers: dict[str, str] | None = None,
    read_timeout: float | None = None,
) -> dict[str, Any]:
    """POST to the agents service, retrying once on transient failures.

    Retries cover connection resets and 5xx only. A 4xx means the request itself
    is wrong and repeating it just burns the same failure twice.
    """
    attempts = AGENTS_MAX_ATTEMPTS if max_attempts is None else max_attempts
    headers = _auth_headers(student_id)
    headers.update(extra_headers or {})
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=(
                    AGENTS_CONNECT_TIMEOUT,
                    read_timeout if read_timeout is not None else AGENTS_READ_TIMEOUT,
                ),
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError("Agents service returned a non-object body.")
            return cast(dict[str, Any], data)
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as error:
            last_error = error
            logger.warning(
                "Agents request to %s failed (attempt %d/%d): %s",
                url,
                attempt,
                attempts,
                error,
            )
        except requests.exceptions.HTTPError as error:
            status_code = error.response.status_code if error.response is not None else 0
            if status_code < 500:
                raise
            last_error = error
            logger.warning(
                "Agents service returned %d (attempt %d/%d)",
                status_code,
                attempt,
                attempts,
            )
        except ValueError as error:
            last_error = error
            logger.warning("Agents service sent an unreadable body: %s", error)

        if attempt < attempts:
            time.sleep(1.0)

    raise RuntimeError(
        "The analysis service is unavailable right now. Please try again later."
    ) from last_error


def _trim_chat_history(history: str, limit: int = MAX_CHAT_HISTORY_CHARS) -> str:
    """Keep the tail of the history so the prompt stays within the cap.

    Trimming from the front drops the oldest turns, which is the right end to
    lose: recent context matters more than the opening of a long chat, and an
    over-long history is rejected outright rather than truncated server-side.
    """
    text = (history or "").strip()
    if len(text) <= limit:
        return text
    return text[-limit:]


def analyze_project(
    prompt: str,
    student_id: int | None = None,
    run_id: int | None = None,
    attempt_id: str = "",
    student_context: str = "",
    revision_context: str = "",
) -> dict[str, Any]:
    """Send a project idea to the agents service and return report plus metrics.

    Raises RuntimeError when the agents service cannot be reached so callers
    never mistake a connection error string for a real feasibility report.
    """
    if not prompt.strip():
        return {
            "report": "Please provide a project-related question.",
            "token_usage": None,
            "cost": None,
        }

    try:
        data = _post_json(
            AGENTS_ANALYZE_URL,
            {
                "idea": prompt,
                "student_context": student_context,
                "revision_context": revision_context,
                "run_id": run_id,
                "attempt_id": attempt_id,
            },
            student_id,
            # A timeout may happen after the agents service has started a crew.
            # Let the durable Celery task manage retries instead of issuing a
            # second HTTP request that could start duplicate provider work.
            max_attempts=1,
            extra_headers=(
                {"X-Analysis-Run-Id": str(run_id)} if run_id is not None else None
            ),
        )
    except requests.exceptions.RequestException as error:
        logger.exception("Agents analyze request failed")
        raise RuntimeError(
            "The analysis service is unavailable right now. Please try again later."
        ) from error

    # dict.get's default only applies when the key is absent, so a present-but-
    # null report would flow through as None and erase the stored blueprint.
    report = data.get("report")
    if not isinstance(report, str) or not report.strip():
        report = "No report was returned by the Agents service."

    milestones = data.get("milestones", [])
    if not isinstance(milestones, list):
        raise RuntimeError("The agents service returned invalid project milestones.")
    validated_milestones: list[dict[str, str]] = []
    for milestone in milestones:
        if not isinstance(milestone, dict):
            raise RuntimeError("The agents service returned an invalid project milestone.")
        title = milestone.get("title")
        description = milestone.get("description")
        if (
            not isinstance(title, str)
            or not title.strip()
            or not isinstance(description, str)
            or not description.strip()
        ):
            raise RuntimeError("The agents service returned an incomplete project milestone.")
        validated_milestones.append(
            {"title": title.strip()[:160], "description": description.strip()}
        )

    return {
        "report": report,
        "token_usage": data.get("token_usage"),
        "cost": data.get("cost"),
        "milestones": validated_milestones,
    }


def assess_project_risks(
    project: dict[str, str],
    student_id: int,
) -> dict[str, Any]:
    """Request a standalone project-risk review from the Risk Agent."""
    return _post_json(
        AGENTS_RISK_ASSESS_URL,
        project,
        student_id,
        max_attempts=1,
        read_timeout=float(os.getenv("AGENTS_RISK_READ_TIMEOUT", "180")),
    )


def propose_plan_adjustment(context: dict[str, Any], student_id: int) -> dict[str, Any]:
    """Request a structured proposal for the remaining project milestones."""
    try:
        return _post_json(
            AGENTS_PLAN_ADJUST_URL,
            context,
            student_id,
            max_attempts=1,
            read_timeout=float(os.getenv("AGENTS_PLAN_READ_TIMEOUT", "180")),
        )
    except requests.exceptions.RequestException as error:
        logger.exception("Agents plan-adjustment request failed")
        raise RuntimeError(
            "The plan-adjustment service is unavailable right now. Please try again later."
        ) from error


def generate_ai_response(prompt: str) -> str:
    """Legacy wrapper returning only the report text."""
    return analyze_project(prompt)["report"]


def generate_chat_response(
    project_idea: str,
    project_title: str,
    chat_history: str,
    user_question: str,
    agent_type: str = "mentor",
    project_blueprint: str = "",
    analysis_id: str = "",
    student_id: int | None = None,
    student_context: str = "",
) -> str:
    """Send a student question to the agents chatbot and return the assistant answer.

    Raises RuntimeError when the agents service cannot be reached; callers should
    roll back any uncommitted state before surfacing a generic error.
    """
    if not user_question.strip():
        return "Please ask a valid question about your project."

    try:
        data = _post_json(
            AGENTS_CHAT_URL,
            {
                "project_title": project_title,
                "project_idea": project_idea,
                "chat_history": _trim_chat_history(chat_history),
                "question": user_question,
                "agent_type": agent_type,
                "project_blueprint": project_blueprint,
                "student_context": student_context,
                "analysis_id": analysis_id,
            },
            student_id,
            read_timeout=AGENTS_CHAT_READ_TIMEOUT,
        )
    except requests.exceptions.RequestException as error:
        logger.exception("Agents chat request failed")
        raise RuntimeError(
            "The chat service is unavailable right now. Please try again later."
        ) from error

    # A null answer would be written to a NOT NULL column and surface as a 500.
    answer = data.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        return "I could not generate a chatbot answer right now."
    return answer