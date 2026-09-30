from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app.api.workspace as workspace_module
from app.database.database import SessionLocal
from app.main import app
from app.models.agent_run import AgentRun
from app.services.agent_run_service import fail_orphaned_runs


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}@example.com"


@pytest.fixture()
def student(client: Any) -> dict[str, Any]:
    email = _unique_email("ws")
    register = client.post(
        "/students/register",
        json={
            "name": "Workspace Student",
            "email": email,
            "password": "secret123",
            "department": "CS",
            "semester": 5,
        },
    )
    assert register.status_code == 200, register.text
    login = client.post(
        "/students/login",
        json={"email": email, "password": "secret123"},
    )
    assert login.status_code == 200, login.text
    return {
        "id": register.json()["id"],
        "token": login.json()["token"],
    }


@pytest.fixture()
def project(client: Any, student: dict[str, Any]) -> dict[str, Any]:
    response = client.post(
        "/projects/",
        json={
            "student_id": student["id"],
            "title": "AI Workspace Project",
            "idea": "A study planner that recommends a weekly schedule from user goals.",
        },
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _headers(student: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {student['token']}"}


def test_conversation_crud(client: Any, student: dict[str, Any], project: dict[str, Any]):
    project_id = project["id"]

    create = client.post(
        f"/projects/{project_id}/conversations",
        headers=_headers(student),
        json={"agent_type": "architect", "title": "Architecture questions"},
    )
    assert create.status_code == 200, create.text
    conversation_id = create.json()["id"]

    listing = client.get(
        f"/projects/{project_id}/conversations",
        headers=_headers(student),
    )
    assert listing.status_code == 200, listing.text
    assert any(c["id"] == conversation_id for c in listing.json())

    rename = client.patch(
        f"/conversations/{conversation_id}",
        headers=_headers(student),
        json={"title": "Renamed discussion"},
    )
    assert rename.status_code == 200, rename.text
    assert rename.json()["title"] == "Renamed discussion"

    deleted = client.delete(
        f"/conversations/{conversation_id}",
        headers=_headers(student),
    )
    assert deleted.status_code == 204, deleted.text

    after = client.get(
        f"/projects/{project_id}/conversations",
        headers=_headers(student),
    )
    assert all(c["id"] != conversation_id for c in after.json())


def test_conversation_messages_send_and_list(client: Any, student: dict[str, Any], project: dict[str, Any], monkeypatch: pytest.MonkeyPatch):
    calls: dict[str, Any] = {}

    def fake_chat(**kwargs: Any):
        calls["agent_type"] = kwargs.get("agent_type")
        return "Assistant reply here."

    monkeypatch.setattr(workspace_module, "generate_chat_response", fake_chat)

    create = client.post(
        f"/projects/{project['id']}/conversations",
        headers=_headers(student),
        json={"agent_type": "scope", "title": "Scope chat"},
    )
    conversation_id = create.json()["id"]

    sent = client.post(
        f"/conversations/{conversation_id}/messages",
        headers=_headers(student),
        json={"message": "What should be out of scope?"},
    )
    assert sent.status_code == 200, sent.text
    assert sent.json()["role"] == "assistant"
    assert sent.json()["message"] == "Assistant reply here."
    assert calls.get("agent_type") == "scope"

    messages = client.get(
        f"/conversations/{conversation_id}/messages",
        headers=_headers(student),
    )
    assert messages.status_code == 200, messages.text
    roles = [m["role"] for m in messages.json()]
    assert roles == ["user", "assistant"]


def test_analysis_background_run_with_metrics(client: Any, student: dict[str, Any], project: dict[str, Any], monkeypatch: pytest.MonkeyPatch):
    def fake_analyze(prompt: str, student_id: int | None = None):
        return {
            "report": "FULL MARKDOWN REPORT",
            "token_usage": {"total_tokens": 321, "prompt_tokens": 200, "completion_tokens": 121},
            "cost": 0.01234,
        }

    monkeypatch.setattr(workspace_module, "analyze_project", fake_analyze)

    started = client.post(
        f"/projects/{project['id']}/analysis",
        headers=_headers(student),
    )
    assert started.status_code == 202, started.text
    run = started.json()
    assert run["status"] == "queued"

    runs = client.get(
        f"/projects/{project['id']}/agent-runs",
        headers=_headers(student),
    )
    assert runs.status_code == 200, runs.text
    result = runs.json()[0]
    assert result["status"] == "completed"
    assert result["output"] == "FULL MARKDOWN REPORT"
    assert '"total_tokens"' in result["token_usage"]
    assert result["cost"] == 0.01234
    assert result["duration_ms"] is not None


def test_retry_creates_new_version(client: Any, student: dict[str, Any], project: dict[str, Any], monkeypatch: pytest.MonkeyPatch):
    def fake_analyze(prompt: str, student_id: int | None = None):
        return {"report": "REPORT", "token_usage": None, "cost": None}

    monkeypatch.setattr(workspace_module, "analyze_project", fake_analyze)

    first = client.post(
        f"/projects/{project['id']}/analysis",
        headers=_headers(student),
    ).json()
    second = client.post(
        f"/projects/{project['id']}/analysis",
        headers=_headers(student),
    ).json()

    assert first["version"] == 1
    assert second["version"] == 2
    assert second["id"] != first["id"]

    runs = client.get(
        f"/projects/{project['id']}/agent-runs",
        headers=_headers(student),
    ).json()
    by_version = {r["version"]: r for r in runs}
    assert by_version[1]["is_active"] == 0
    assert by_version[2]["is_active"] == 1


def test_orphaned_runs_are_failed_on_recovery(client: Any, student: dict[str, Any], project: dict[str, Any]):
    db = SessionLocal()
    orphan = AgentRun(
        student_id=student["id"],
        project_id=project["id"],
        agent_type="complete_analysis",
        status="running",
    )
    db.add(orphan)
    db.commit()
    orphan_id = orphan.id
    db.close()

    db = SessionLocal()
    count = fail_orphaned_runs(db)
    db.close()

    assert count >= 1
    db = SessionLocal()
    reloaded: Any = db.query(AgentRun).filter(AgentRun.id == orphan_id).first()
    db.close()
    assert reloaded.status == "failed"
    assert "restarted" in (reloaded.error_message or "")


def test_failed_analysis_marks_run_failed_and_preserves_ai_report(client: Any, student: dict[str, Any], project: dict[str, Any], monkeypatch: pytest.MonkeyPatch):
    def _exploding_analyze(prompt: str):
        raise RuntimeError("internal engine exception with a long secret stacktrace")

    monkeypatch.setattr(workspace_module, "analyze_project", _exploding_analyze)

    started = client.post(
        f"/projects/{project['id']}/analysis",
        headers=_headers(student),
    )
    assert started.status_code == 202, started.text

    runs = client.get(
        f"/projects/{project['id']}/agent-runs",
        headers=_headers(student),
    )
    assert runs.status_code == 200, runs.text
    failed = runs.json()[0]
    assert failed["status"] == "failed"
    assert failed["output"] is None
    assert "secret stacktrace" not in (failed["error_message"] or "")

    # The project never had a successful blueprint, so it stays empty.
    details = client.get(
        f"/projects/{project['id']}?student_id={student['id']}",
        headers=_headers(student),
    )
    assert details.json()["ai_report"] is None


def test_failed_analysis_does_not_erase_previous_blueprint(client: Any, student: dict[str, Any], project: dict[str, Any], monkeypatch: pytest.MonkeyPatch):
    from app.models.project import Project

    db = SessionLocal()
    try:
        proj: Any = db.query(Project).filter(Project.id == project["id"]).first()
        proj.ai_report = "PREVIOUS REPORT"
        db.commit()
    finally:
        db.close()

    def _exploding_analyze(prompt: str):
        raise RuntimeError("boom")

    monkeypatch.setattr(workspace_module, "analyze_project", _exploding_analyze)

    client.post(f"/projects/{project['id']}/analysis", headers=_headers(student))

    details = client.get(
        f"/projects/{project['id']}?student_id={student['id']}",
        headers=_headers(student),
    )
    assert details.json()["ai_report"] == "PREVIOUS REPORT"


def test_conversation_message_rolls_back_when_chat_fails(client: Any, student: dict[str, Any], project: dict[str, Any], monkeypatch: pytest.MonkeyPatch):
    def _exploding_chat(**kwargs: Any):
        raise RuntimeError("chat provider unreachable")

    monkeypatch.setattr(workspace_module, "generate_chat_response", _exploding_chat)

    create = client.post(
        f"/projects/{project['id']}/conversations",
        headers=_headers(student),
        json={"agent_type": "planning", "title": "Plan chat"},
    )
    assert create.status_code == 200, create.text
    conversation_id = create.json()["id"]

    sent = client.post(
        f"/conversations/{conversation_id}/messages",
        headers=_headers(student),
        json={"message": "What is step one?"},
    )
    assert sent.status_code == 503, sent.text

    messages = client.get(
        f"/conversations/{conversation_id}/messages",
        headers=_headers(student),
    )
    assert messages.json() == []


def test_planning_agent_type_is_supported(client: Any, student: dict[str, Any], project: dict[str, Any]):
    create = client.post(
        f"/projects/{project['id']}/conversations",
        headers=_headers(student),
        json={"agent_type": "planning", "title": "Execution plan"},
    )
    assert create.status_code == 200, create.text


def test_workspace_is_scoped_to_owner(client: Any, student: dict[str, Any], project: dict[str, Any]):
    other = {
        student["id"]: _unique_email("other"),
    }
    register_other = client.post(
        "/students/register",
        json={
            "name": "Other",
            "email": other[student["id"]],
            "password": "secret123",
            "department": "CS",
            "semester": 5,
        },
    )
    other_login = client.post(
        "/students/login",
        json={"email": other[student["id"]], "password": "secret123"},
    )
    other_token = other_login.json()["token"]
    assert register_other.status_code == 200

    forbidden = client.post(
        f"/projects/{project['id']}/conversations",
        headers={"Authorization": f"Bearer {other_token}"},
        json={"agent_type": "mentor", "title": "Intruder"},
    )
    assert forbidden.status_code == 403, forbidden.text
