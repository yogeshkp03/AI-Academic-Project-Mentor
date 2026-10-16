import subprocess
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect as sqlalchemy_inspect, text
from sqlalchemy.orm import configure_mappers

import app.database.database as database_module
import app.api.workspace as workspace_module
import app.tasks as task_module
from app.database.database import SessionLocal
from app.database.database import utcnow
from app.main import app
from app.models.agent_run import ANALYSIS_STEP_KEYS, AgentRun, AgentRunStep
from app.models.chat import ChatMessage
from app.models.conversation import Conversation
from app.models.project import Project
from app.models.project_checkin import ProjectCheckIn
from app.models.project_milestone import ProjectMilestone
from app.models.project_plan_proposal import ProjectPlanProposal
from app.services.agent_run_service import create_agent_run, fail_orphaned_runs


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}@example.com"


def test_project_milestone_relationship_configures_for_worker_imports():
    configure_mappers()


def test_celery_task_import_registers_project_relationship_models():
    backend_dir = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import app.tasks; "
            "from sqlalchemy.orm import configure_mappers; "
            "configure_mappers()",
        ],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_delete_project_removes_all_owned_project_data(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
):
    db = SessionLocal()
    try:
        run = create_agent_run(
            db,
            student_id=student["id"],
            project_id=project["id"],
            agent_type="complete_analysis",
            input_context=project["idea"],
        )
        run.status = "completed"
        run.output = "Full report"
        conversation = Conversation(
            student_id=student["id"],
            project_id=project["id"],
            agent_type="mentor",
            title="Mentor discussion",
        )
        db.add(conversation)
        db.flush()
        db.add(
            ChatMessage(
                student_id=student["id"],
                project_id=project["id"],
                conversation_id=conversation.id,
                role="user",
                message="How should I begin?",
            )
        )
        db.add(
            ProjectMilestone(
                project_id=project["id"],
                position=1,
                title="Create a prototype",
                description="Build a first working version.",
            )
        )
        check_in = ProjectCheckIn(
            student_id=student["id"],
            project_id=project["id"],
            completed_work="Finished the requirements.",
            in_progress="Building the first prototype.",
            blockers="",
            next_week_goal="Complete the prototype.",
            confidence=4,
            mentor_feedback="Keep the scope focused.",
        )
        db.add(check_in)
        db.flush()
        db.add(
            ProjectPlanProposal(
                student_id=student["id"],
                project_id=project["id"],
                check_in_id=check_in.id,
                rationale="The revised milestone is focused and actionable.",
                current_milestones_json="[]",
                proposed_milestones_json="[]",
                baseline_fingerprint="test-fingerprint",
            )
        )
        run_id = run.id
        conversation_id = conversation.id
        db.commit()
    finally:
        db.close()

    deleted = client.delete(
        f"/projects/{project['id']}",
        headers=_headers(student),
    )
    assert deleted.status_code == 204, deleted.text

    listing = client.get("/projects/", headers=_headers(student))
    assert listing.status_code == 200
    assert all(item["id"] != project["id"] for item in listing.json())
    db = SessionLocal()
    try:
        assert db.query(AgentRun).filter(AgentRun.id == run_id).count() == 0
        assert db.query(AgentRunStep).filter(AgentRunStep.agent_run_id == run_id).count() == 0
        assert db.query(Conversation).filter(Conversation.id == conversation_id).count() == 0
        assert db.query(ChatMessage).filter(ChatMessage.project_id == project["id"]).count() == 0
        assert db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project["id"]).count() == 0
        assert db.query(ProjectCheckIn).filter(ProjectCheckIn.project_id == project["id"]).count() == 0
        assert db.query(ProjectPlanProposal).filter(ProjectPlanProposal.project_id == project["id"]).count() == 0
    finally:
        db.close()


def test_delete_project_rejects_active_analysis(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
):
    db = SessionLocal()
    try:
        create_agent_run(
            db,
            student_id=student["id"],
            project_id=project["id"],
            agent_type="complete_analysis",
            input_context=project["idea"],
        )
    finally:
        db.close()

    response = client.delete(
        f"/projects/{project['id']}",
        headers=_headers(student),
    )
    assert response.status_code == 409
    assert "analysis in progress" in response.json()["detail"]

    still_exists = client.get(
        f"/projects/{project['id']}",
        headers=_headers(student),
        params={"student_id": student["id"]},
    )
    assert still_exists.status_code == 200


def test_delete_project_requires_owner(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
):
    email = _unique_email("non-owner")
    registered = client.post(
        "/students/register",
        json={
            "name": "Other Student",
            "email": email,
            "password": "secret123",
            "department": "CS",
            "semester": 5,
        },
    )
    assert registered.status_code == 200, registered.text
    login = client.post(
        "/students/login",
        json={"email": email, "password": "secret123"},
    )
    assert login.status_code == 200, login.text

    response = client.delete(
        f"/projects/{project['id']}",
        headers={"Authorization": "Bearer " + login.json()["token"]},
    )
    assert response.status_code == 403

    still_exists = client.get(
        f"/projects/{project['id']}",
        headers=_headers(student),
        params={"student_id": student["id"]},
    )
    assert still_exists.status_code == 200


def test_existing_agent_run_steps_table_gets_output_column(
    tmp_path: Any,
    monkeypatch: pytest.MonkeyPatch,
):
    legacy_engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    try:
        with legacy_engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE agent_run_steps ("
                    "id INTEGER PRIMARY KEY, agent_run_id INTEGER NOT NULL, "
                    "step_key VARCHAR(50) NOT NULL, position INTEGER NOT NULL, "
                    "status VARCHAR(20) NOT NULL, started_at DATETIME, "
                    "completed_at DATETIME)"
                )
            )
        monkeypatch.setattr(database_module, "engine", legacy_engine)
        database_module.upgrade_existing_schema()
        columns = {
            column["name"]
            for column in sqlalchemy_inspect(legacy_engine).get_columns("agent_run_steps")
        }
        assert "output" in columns
    finally:
        legacy_engine.dispose()


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
            "technology_stack": "React, FastAPI, PostgreSQL",
            "duration": "3 Months",
        },
        headers=_headers(student),
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
    prompts: list[str] = []

    def fake_analyze(prompt: str, student_id: int | None = None, **kwargs: Any):
        prompts.append(prompt)
        return {
            "report": "FULL MARKDOWN REPORT",
            "token_usage": {"total_tokens": 321, "prompt_tokens": 200, "completion_tokens": 121},
            "cost": 0.01234,
            "milestones": [
                {"title": "Build the MVP", "description": "Implement and test the agreed core features."}
            ],
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
    assert prompts == [
        "Project title: AI Workspace Project\n\n"
        "Project idea: A study planner that recommends a weekly schedule from user goals.\n\n"
        "Available technologies: React, FastAPI, PostgreSQL\n\n"
        "Target duration: 3 Months"
    ]
    milestones = client.get(
        f"/projects/{project['id']}/milestones",
        headers=_headers(student),
    )
    assert milestones.status_code == 200, milestones.text
    assert milestones.json()[0]["title"] == "Build the MVP"
    assert [step["step_key"] for step in result["steps"]] == [
        "feasibility",
        "architect",
        "scope",
        "timeline",
        "ui_ux",
        "planning",
        "professor",
        "resource",
    ]


def test_analysis_task_is_idempotent_after_completion(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[int] = []

    def fake_analyze(prompt: str, student_id: int | None = None, **kwargs: Any):
        calls.append(kwargs["run_id"])
        return {"report": "REPORT", "token_usage": None, "cost": None}

    monkeypatch.setattr(workspace_module, "analyze_project", fake_analyze)
    response = client.post(
        f"/projects/{project['id']}/analysis",
        headers=_headers(student),
    )
    assert response.status_code == 202
    workspace_module.run_complete_analysis(response.json()["id"])
    assert calls == [response.json()["id"]]


def test_agent_progress_callback_is_authenticated_and_persists_output(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
):
    db = SessionLocal()
    try:
        run = create_agent_run(
            db,
            student_id=student["id"],
            project_id=project["id"],
            agent_type="complete_analysis",
            input_context=project["idea"],
        )
        run.status = "running"
        run.attempt_id = "a" * 32
        db.commit()
        run_id = run.id
    finally:
        db.close()

    payload = {
        "step_key": "feasibility",
        "attempt_id": "a" * 32,
        "status": "running",
    }
    assert client.post(
        f"/internal/agent-runs/{run_id}/steps",
        json=payload,
        headers={"X-Agents-Progress-Token": "wrong"},
    ).status_code == 401
    started = client.post(
        f"/internal/agent-runs/{run_id}/steps",
        json=payload,
        headers={"X-Agents-Progress-Token": "test-progress-callback-token"},
    )
    assert started.status_code == 200, started.text
    updated = client.post(
        f"/internal/agent-runs/{run_id}/steps",
        json={**payload, "status": "completed", "output": "Feasibility analysis output"},
        headers={"X-Agents-Progress-Token": "test-progress-callback-token"},
    )
    assert updated.status_code == 200, updated.text
    run_response = client.get(
        f"/projects/{project['id']}/agent-runs",
        headers=_headers(student),
    )
    steps = run_response.json()[0]["steps"]
    assert steps[0]["step_key"] == "feasibility"
    assert steps[0]["status"] == "completed"
    assert steps[0]["output"] == "Feasibility analysis output"


def test_completed_progress_requires_agent_output(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
):
    db = SessionLocal()
    try:
        run = create_agent_run(
            db,
            student_id=student["id"],
            project_id=project["id"],
            agent_type="complete_analysis",
            input_context=project["idea"],
        )
        run.status = "running"
        run.attempt_id = "b" * 32
        db.commit()
        run_id = run.id
    finally:
        db.close()

    response = client.post(
        f"/internal/agent-runs/{run_id}/steps",
        json={
            "step_key": "feasibility",
            "attempt_id": "b" * 32,
            "status": "completed",
        },
        headers={"X-Agents-Progress-Token": "test-progress-callback-token"},
    )
    assert response.status_code == 422


def test_all_completed_steps_remain_failed_when_report_finalization_fails(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
):
    def fail_after_agent_work(*args: Any, **kwargs: Any):
        db = SessionLocal()
        try:
            steps = (
                db.query(AgentRunStep)
                .join(AgentRun)
                .filter(AgentRun.project_id == project["id"])
                .all()
            )
            for step in steps:
                step.status = "completed"
                step.output = f"{step.step_key} report"
            db.commit()
        finally:
            db.close()
        raise ValueError("Combined report validation failed.")

    monkeypatch.setattr(workspace_module, "analyze_project", fail_after_agent_work)
    started = client.post(
        f"/projects/{project['id']}/analysis",
        headers=_headers(student),
    )
    assert started.status_code == 202, started.text

    workspace_module.run_complete_analysis(started.json()["id"])

    response = client.get(
        f"/projects/{project['id']}/agent-runs",
        headers=_headers(student),
    )
    assert response.status_code == 200, response.text
    failed_run = response.json()[0]
    assert failed_run["status"] == "failed"
    assert "All agent steps completed" in failed_run["error_message"]
    assert [step["status"] for step in failed_run["steps"]] == [
        "completed" for _ in ANALYSIS_STEP_KEYS
    ]
    assert [step["output"] for step in failed_run["steps"]] == [
        f"{step_key} report" for step_key in ANALYSIS_STEP_KEYS
    ]


def test_ai_mentor_chat_uses_latest_saved_agent_outputs(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
):
    calls: dict[str, Any] = {}

    def fake_chat(**kwargs: Any):
        calls.update(kwargs)
        return "Mentor advice."

    monkeypatch.setattr(workspace_module, "generate_chat_response", fake_chat)
    db = SessionLocal()
    try:
        run = create_agent_run(
            db,
            student_id=student["id"],
            project_id=project["id"],
            agent_type="complete_analysis",
            input_context=project["idea"],
        )
        run.status = "failed"
        db.query(Project).filter(Project.id == project["id"]).update(
            {"ai_report": "Earlier finalized project report."}
        )
        timeline_step = next(
            step for step in run.steps if step.step_key == "timeline"
        )
        timeline_step.output = "Reserve two weeks for exam preparation."
        db.commit()
    finally:
        db.close()

    conversation = client.post(
        f"/projects/{project['id']}/conversations",
        headers=_headers(student),
        json={"agent_type": "mentor", "title": "AI Mentor discussion"},
    )
    assert conversation.status_code == 200, conversation.text
    sent = client.post(
        f"/conversations/{conversation.json()['id']}/messages",
        headers=_headers(student),
        json={"message": "How should I plan around exams?"},
    )
    assert sent.status_code == 200, sent.text
    assert calls["agent_type"] == "mentor"
    assert "## Timeline" in calls["project_blueprint"]
    assert "Reserve two weeks for exam preparation." in calls["project_blueprint"]
    assert "Earlier finalized project report." in calls["project_blueprint"]


def test_plan_update_from_mentor_chat_queues_a_new_version(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
):
    queued: list[int] = []
    calls: dict[str, Any] = {}
    monkeypatch.setattr(workspace_module, "enqueue_analysis", queued.append)

    db = SessionLocal()
    try:
        previous = create_agent_run(
            db,
            student_id=student["id"],
            project_id=project["id"],
            agent_type="complete_analysis",
            input_context=project["idea"],
        )
        previous.status = "completed"
        previous.output = "Previous complete plan."
        previous_run_id = previous.id
        conversation = Conversation(
            student_id=student["id"],
            project_id=project["id"],
            agent_type="mentor",
            title="Plan update discussion",
        )
        db.add(conversation)
        db.flush()
        db.add_all(
            [
                ChatMessage(
                    student_id=student["id"],
                    project_id=project["id"],
                    conversation_id=conversation.id,
                    role="user",
                    message="Switch the backend to Django and keep the MVP smaller.",
                ),
                ChatMessage(
                    student_id=student["id"],
                    project_id=project["id"],
                    conversation_id=conversation.id,
                    role="assistant",
                    message="I will revise the architecture and scope to reflect that.",
                ),
            ]
        )
        conversation_id = conversation.id
        db.commit()
    finally:
        db.close()

    response = client.post(
        f"/conversations/{conversation_id}/analysis",
        headers=_headers(student),
    )
    assert response.status_code == 202, response.text
    run = response.json()
    assert run["version"] == 2
    assert run["status"] == "queued"
    assert queued == [run["id"]]

    db = SessionLocal()
    try:
        saved_run = db.query(AgentRun).filter(AgentRun.id == run["id"]).one()
        assert saved_run.input_context.startswith(workspace_module.MENTOR_PLAN_UPDATE_PREFIX)
        assert "Django" in saved_run.input_context
        assert "AI Mentor: I will revise the architecture" in saved_run.input_context
        assert "Previous complete plan." in saved_run.input_context
        saved_previous = db.query(AgentRun).filter(AgentRun.id == previous_run_id).one()
        assert saved_previous.output == "Previous complete plan."
    finally:
        db.close()

    def fake_analyze(_prompt: str, **kwargs: Any):
        calls.update(kwargs)
        return {
            "report": "Revised complete plan.",
            "token_usage": None,
            "cost": None,
            "milestones": [
                {"title": "Build the Django MVP", "description": "Implement the core workflow."}
            ],
        }

    monkeypatch.setattr(workspace_module, "analyze_project", fake_analyze)
    workspace_module.run_complete_analysis(run["id"])
    assert "Previous complete plan." in calls["revision_context"]
    assert "Django" in calls["revision_context"]

    db = SessionLocal()
    try:
        completed = db.query(AgentRun).filter(AgentRun.id == run["id"]).one()
        preserved = db.query(AgentRun).filter(AgentRun.id == previous_run_id).one()
        refreshed_project = db.query(Project).filter(Project.id == project["id"]).one()
        assert completed.status == "completed"
        assert "Revised complete plan." in completed.output
        assert "## Project milestones" in completed.output
        assert "Build the Django MVP" in completed.output
        assert preserved.output == "Previous complete plan."
        assert refreshed_project.ai_report == completed.output
    finally:
        db.close()


def test_project_milestones_are_owned_and_checkable(
    client: Any,
    student: dict[str, Any],
    project: dict[str, Any],
):
    db = SessionLocal()
    try:
        milestone = ProjectMilestone(
            project_id=project["id"],
            position=1,
            title="Create the schema",
            description="Define the database tables and validate their relations.",
        )
        db.add(milestone)
        db.commit()
        db.refresh(milestone)
        milestone_id = milestone.id
    finally:
        db.close()

    response = client.patch(
        f"/projects/{project['id']}/milestones/{milestone_id}",
        headers=_headers(student),
        json={"completed": True},
    )
    assert response.status_code == 200, response.text
    assert response.json()["completed"] is True


def test_worker_and_beat_recover_stale_analysis_runs(
    student: dict[str, Any],
    project: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
):
    from datetime import timedelta
    from app.celery_app import celery_app

    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.task_reject_on_worker_lost is True
    assert celery_app.conf.task_time_limit < celery_app.conf.broker_transport_options[
        "visibility_timeout"
    ]

    db = SessionLocal()
    try:
        run = AgentRun(
            student_id=student["id"],
            project_id=project["id"],
            agent_type="complete_analysis",
            status="running",
            started_at=utcnow() - timedelta(seconds=task_module.STALE_RUN_SECONDS + 1),
        )
        db.add(run)
        db.commit()
        run_id = run.id
    finally:
        db.close()

    requeued: list[int] = []
    monkeypatch.setattr(task_module, "enqueue_analysis", requeued.append)
    assert task_module.recover_analysis_runs.run() == 1
    assert requeued == [run_id]

    db = SessionLocal()
    try:
        recovered = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        assert recovered.status == "queued"
        assert recovered.attempt_id is None
    finally:
        db.close()


def test_retry_creates_new_version(client: Any, student: dict[str, Any], project: dict[str, Any], monkeypatch: pytest.MonkeyPatch):
    def fake_analyze(prompt: str, student_id: int | None = None, **kwargs: Any):
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
    def _exploding_analyze(prompt: str, **kwargs: Any):
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

    def _exploding_analyze(prompt: str, **kwargs: Any):
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
        headers={"Authorization": "Bearer " + other_token},
        json={"agent_type": "mentor", "title": "Intruder"},
    )
    assert forbidden.status_code == 403, forbidden.text
