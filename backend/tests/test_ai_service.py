"""Guards on the boundary between the backend and the agents service.

A malformed or null response from the agents service must never be able to
erase a stored blueprint, crash a chat send, or produce a history payload the
agents service will reject outright.
"""

import json
from typing import Any
from uuid import uuid4

import pytest
import requests
from fastapi.testclient import TestClient

import app.api.workspace as workspace_module
from app.database.database import SessionLocal
from app.main import app
from app.models.project import Project
from app.services import ai_service


def _response(payload: Any, status_code: int = 200) -> requests.Response:
    response = requests.Response()
    response.status_code = status_code
    response._content = (  # pyright: ignore[reportPrivateUsage]
        payload if isinstance(payload, bytes) else json.dumps(payload).encode()
    )
    response.headers["Content-Type"] = "application/json"
    return response


def test_chat_history_is_trimmed_to_the_agents_cap():
    history = "\n".join(f"user: message number {index} with some padding" for index in range(2000))
    trimmed = ai_service._trim_chat_history(history)  # pyright: ignore[reportPrivateUsage]
    assert len(trimmed) <= ai_service.MAX_CHAT_HISTORY_CHARS

    short = "user: hello\nassistant: hi there"
    assert ai_service._trim_chat_history(short) == short  # pyright: ignore[reportPrivateUsage]
    assert ai_service._trim_chat_history("") == ""  # pyright: ignore[reportPrivateUsage]


def test_null_report_does_not_erase_a_stored_blueprint(monkeypatch: pytest.MonkeyPatch):
    """A present-but-null report used to pass through dict.get's default.

    dict.get only substitutes when the key is absent, so the blueprint was set
    to None and silently destroyed.
    """
    for payload in ({"report": None}, {"report": ""}, {"report": "   "}, {}):
        monkeypatch.setattr(
            ai_service.requests, "post", lambda *a, **k: _response(payload)  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
        )
        result: dict[str, Any] = ai_service.analyze_project("A project idea worth analysing")
        assert isinstance(result["report"], str)
        assert result["report"].strip(), f"empty report leaked from {payload!r}"


def test_null_answer_becomes_a_string_not_a_not_null_violation(monkeypatch: pytest.MonkeyPatch):
    for payload in ({"answer": None}, {"answer": 123}, {}):
        monkeypatch.setattr(
            ai_service.requests, "post", lambda *a, **k: _response(payload)  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
        )
        answer = ai_service.generate_chat_response(
            project_idea="idea",
            project_title="title",
            chat_history="",
            user_question="How do I start?",
        )
        assert isinstance(answer, str)
        assert answer.strip()


def test_agents_service_gets_a_bounded_connect_timeout(monkeypatch: pytest.MonkeyPatch):
    """A scalar timeout capped connect at the full read budget.

    These endpoints are synchronous and run in a fixed thread pool, so a dead
    connection could hold a worker for the entire read budget.
    """
    seen: dict[str, Any] = {}

    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        seen["timeout"] = timeout
        return _response({"report": "ok", "answer": "ok"})

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    ai_service.analyze_project("A project idea worth analysing")

    connect, read = seen["timeout"]
    assert connect == ai_service.AGENTS_CONNECT_TIMEOUT
    assert connect < read


def test_student_id_is_forwarded_so_agents_can_scope_limits(monkeypatch: pytest.MonkeyPatch):
    seen: dict[str, Any] = {}

    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        seen["headers"] = headers
        return _response({"report": "ok"})

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    ai_service.analyze_project("A project idea worth analysing", student_id=42)
    assert seen["headers"].get("X-Student-Id") == "42"


def test_analysis_sends_run_identity_without_replaying_http_request(
    monkeypatch: pytest.MonkeyPatch,
):
    seen: dict[str, Any] = {}

    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        seen.update(json=json, headers=headers)
        return _response({"report": "ok"})

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    ai_service.analyze_project(
        "A project idea worth analysing",
        student_id=42,
        run_id=77,
        attempt_id="attempt-identifier-123456",
    )
    assert seen["json"]["run_id"] == 77
    assert seen["json"]["attempt_id"] == "attempt-identifier-123456"
    assert seen["headers"]["X-Analysis-Run-Id"] == "77"
    assert seen["headers"]["X-Agents-Token"] == "test-agents-service-token"


def test_analysis_and_chat_send_student_skill_context(monkeypatch: pytest.MonkeyPatch):
    seen: list[dict[str, Any]] = []

    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        seen.append(json)
        return _response({"report": "ok", "answer": "ok", "milestones": []})

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    ai_service.analyze_project(
        "A project idea worth analysing",
        student_context="- Python (Intermediate)",
    )
    ai_service.generate_chat_response(
        project_idea="idea",
        project_title="title",
        chat_history="",
        user_question="How do I start?",
        student_context="- Python (Intermediate)",
    )

    assert seen[0]["student_context"] == "- Python (Intermediate)"
    assert seen[1]["student_context"] == "- Python (Intermediate)"


def test_transient_server_error_is_retried_then_succeeds(monkeypatch: pytest.MonkeyPatch):
    attempts: list[int] = []
    bodies = [503, 200]

    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        status_code = bodies[len(attempts)]
        attempts.append(status_code)
        return _response({"answer": "RECOVERED"}, status_code=status_code)

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    monkeypatch.setattr(ai_service.time, "sleep", lambda seconds: None)  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]

    result = ai_service.generate_chat_response(
        project_idea="idea",
        project_title="title",
        chat_history="",
        user_question="How do I start?",
    )
    assert result == "RECOVERED"
    assert attempts == [503, 200]


def test_analysis_request_does_not_retry_after_server_error(
    monkeypatch: pytest.MonkeyPatch,
):
    attempts: list[int] = []

    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        attempts.append(1)
        return _response({"detail": "analysis outcome unknown"}, status_code=503)

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    with pytest.raises(RuntimeError, match="unavailable"):
        ai_service.analyze_project("A project idea worth analysing", run_id=77)
    assert len(attempts) == 1


def test_client_errors_are_not_retried(monkeypatch: pytest.MonkeyPatch):
    attempts: list[int] = []

    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        attempts.append(1)
        return _response({"detail": "nope"}, status_code=422)

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    monkeypatch.setattr(ai_service.time, "sleep", lambda seconds: None)  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]

    try:
        ai_service.analyze_project("A project idea worth analysing")
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected a RuntimeError")
    assert len(attempts) == 1, "a 4xx must not be retried"


def test_persistent_failure_raises_runtime_error(monkeypatch: pytest.MonkeyPatch):
    def _capture(url: str, json: Any = None, headers: Any = None, timeout: Any = None) -> requests.Response:
        return _response({"detail": "down"}, status_code=503)

    monkeypatch.setattr(ai_service.requests, "post", _capture)
    monkeypatch.setattr(ai_service.time, "sleep", lambda seconds: None)  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]

    try:
        ai_service.analyze_project("A project idea worth analysing")
    except RuntimeError as error:
        assert "unavailable" in str(error).lower()
    else:
        raise AssertionError("expected a RuntimeError")


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _authed_client() -> tuple[Any, str, str]:
    client: Any = TestClient(app)
    email = f"aisvc-{uuid4().hex[:10]}@example.com"
    client.post(
        "/students/register",
        json={
            "name": "AI Service Student",
            "email": email,
            "password": "secret123",
            "department": "CS",
            "semester": 5,
        },
    )
    token = client.post(
        "/students/login", json={"email": email, "password": "secret123"}
    ).json()["token"]
    return client, token, email


def test_run_status_and_blueprint_are_written_together(monkeypatch: pytest.MonkeyPatch):
    """A crash between the two writes left a completed run with a stale report."""
    client, token, email = _authed_client()  # pyright: ignore[reportUnusedVariable]
    student_id = client.get(
        "/students/me", headers={"Authorization": f"Bearer {token}"}
    ).json()["id"]

    project = client.post(
        "/projects/",
        json={
            "student_id": student_id,
            "title": "Atomicity Project",
            "idea": "Build a tracker that keeps related records consistent.",
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    monkeypatch.setattr(
        workspace_module,
        "analyze_project",
        lambda prompt, student_id=None, **kwargs: {  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
            "report": "THE REPORT",
            "token_usage": {"total_tokens": 7},
            "cost": 0.5,
        },
    )
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post(
        f"/projects/{project['id']}/analysis", headers=headers
    ).status_code == 202

    runs = client.get(f"/projects/{project['id']}/agent-runs", headers=headers).json()
    assert runs[0]["status"] == "completed"
    assert runs[0]["output"] == "THE REPORT"

    db = SessionLocal()
    try:
        stored: Any = db.query(Project).filter(Project.id == project["id"]).first()
        assert stored.ai_report == "THE REPORT"
    finally:
        db.close()


def test_unserialisable_token_usage_does_not_fail_a_successful_run(monkeypatch: pytest.MonkeyPatch):
    """json.dumps raising used to be swallowed as an analysis failure."""
    client, token, _ = _authed_client()
    student_id = client.get(
        "/students/me", headers={"Authorization": f"Bearer {token}"}
    ).json()["id"]

    project = client.post(
        "/projects/",
        json={
            "student_id": student_id,
            "title": "Metrics Project",
            "idea": "Build a tracker that records unusual usage metrics.",
        },
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    monkeypatch.setattr(
        workspace_module,
        "analyze_project",
        lambda prompt, student_id=None, **kwargs: {  # pyright: ignore[reportUnknownLambdaType, reportUnknownArgumentType]
            "report": "STILL A GOOD REPORT",
            "token_usage": object(),  # not JSON serialisable
            "cost": 0.0,
        },
    )
    headers = {"Authorization": f"Bearer {token}"}
    client.post(f"/projects/{project['id']}/analysis", headers=headers)

    runs = client.get(f"/projects/{project['id']}/agent-runs", headers=headers).json()
    assert runs[0]["status"] == "completed", "a metrics shape must not fail the run"
    assert runs[0]["output"] == "STILL A GOOD REPORT"
    assert runs[0]["token_usage"] is None
