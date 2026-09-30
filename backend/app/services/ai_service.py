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
# When set, forwarded to the agents service as X-Agents-Token. That service
# enforces it as AGENTS_API_TOKEN when configured.
AI_SERVICE_API_KEY = os.getenv("AI_SERVICE_API_KEY")

# An analysis drives an eight-agent sequential crew, so the read budget is
# generous. The connect budget must stay small: a scalar timeout would hold a
# worker thread for the full read budget on a dead connection, and these
# endpoints are synchronous, running in a fixed-size thread pool.
AGENTS_CONNECT_TIMEOUT = float(os.getenv("AGENTS_CONNECT_TIMEOUT", "5"))
AGENTS_READ_TIMEOUT = float(os.getenv("AGENTS_READ_TIMEOUT", "600"))
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
    headers: dict[str, str] = {}
    if AI_SERVICE_API_KEY:
        headers["X-Agents-Token"] = AI_SERVICE_API_KEY
    if student_id is not None:
        headers["X-Student-Id"] = str(student_id)
    return headers


def _post_json(
    url: str, payload: dict[str, Any], student_id: int | None = None
) -> dict[str, Any]:
    """POST to the agents service, retrying once on transient failures.

    Retries cover connection resets and 5xx only. A 4xx means the request itself
    is wrong and repeating it just burns the same failure twice.
    """
    last_error: Exception | None = None
    for attempt in range(1, AGENTS_MAX_ATTEMPTS + 1):
        try:
            response = requests.post(
                url,
                json=payload,
                headers=_auth_headers(student_id),
                timeout=(AGENTS_CONNECT_TIMEOUT, AGENTS_READ_TIMEOUT),
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
                AGENTS_MAX_ATTEMPTS,
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
                AGENTS_MAX_ATTEMPTS,
            )
        except ValueError as error:
            last_error = error
            logger.warning("Agents service sent an unreadable body: %s", error)

        if attempt < AGENTS_MAX_ATTEMPTS:
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


def analyze_project(prompt: str, student_id: int | None = None) -> dict[str, Any]:
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
        data = _post_json(AGENTS_ANALYZE_URL, {"idea": prompt}, student_id)
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

    return {
        "report": report,
        "token_usage": data.get("token_usage"),
        "cost": data.get("cost"),
    }


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
                "analysis_id": analysis_id,
            },
            student_id,
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