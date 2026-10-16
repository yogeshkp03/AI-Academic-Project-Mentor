from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.database import Base, SessionLocal, engine
from app.main import app
from app.models.project_checkin import ProjectCheckIn
from app.models.project_milestone import ProjectMilestone


def setup_function() -> None:
    Base.metadata.create_all(bind=engine)


def _create_student_and_project(client: TestClient) -> tuple[dict[str, Any], dict[str, Any]]:
    suffix = uuid4().hex[:10]
    email = f"proposal-{suffix}@example.com"
    registration = client.post(
        "/students/register",
        json={
            "name": "Proposal Student",
            "email": email,
            "password": "student-password",
            "department": "Computer Science",
            "semester": 5,
        },
    )
    assert registration.status_code == 200, registration.text
    login = client.post(
        "/students/login",
        json={"email": email, "password": "student-password"},
    )
    assert login.status_code == 200, login.text
    student = {"id": registration.json()["id"], "token": login.json()["token"]}
    project_response = client.post(
        "/projects/",
        headers={"Authorization": f"Bearer {student['token']}"},
        json={
            "student_id": student["id"],
            "title": "Study Planner",
            "idea": "Build a project planner to help students manage course work.",
        },
    )
    assert project_response.status_code == 200, project_response.text
    return student, project_response.json()


def _add_checkin_and_milestones(
    student: dict[str, Any],
    project: dict[str, Any],
) -> tuple[int, list[int]]:
    db: Session = SessionLocal()
    try:
        check_in = ProjectCheckIn(
            student_id=student["id"],
            project_id=project["id"],
            completed_work="Finished the project requirements.",
            in_progress="Building the first prototype.",
            blockers="Need to clarify an external API contract.",
            next_week_goal="Complete one end-to-end workflow.",
            confidence=3,
            mentor_feedback="Validate the API contract before adding features.",
        )
        db.add(check_in)
        db.flush()
        completed = ProjectMilestone(
            project_id=project["id"],
            position=1,
            title="Define project scope",
            description="Agree on the initial project requirements.",
            completed=True,
        )
        incomplete = ProjectMilestone(
            project_id=project["id"],
            position=2,
            title="Build prototype",
            description="Implement and test an early working prototype.",
            completed=False,
        )
        db.add_all((completed, incomplete))
        db.commit()
        return check_in.id, [completed.id, incomplete.id]
    finally:
        db.close()


def _proposal_payload() -> dict[str, Any]:
    return {
        "rationale": (
            "Resolve the API uncertainty before expanding the prototype, then "
            "validate the core workflow against student needs."
        ),
        "milestones": [
            {
                "title": "Confirm external API contract",
                "description": "Document authentication, data fields, and failure behavior.",
            },
            {
                "title": "Test the core workflow",
                "description": "Run a small end-to-end test with representative student tasks.",
            },
        ],
    }


def test_approved_proposal_preserves_completed_milestones_and_replaces_remaining(
    monkeypatch: Any,
):
    from app.api import project_plan_proposals

    monkeypatch.setattr(
        project_plan_proposals,
        "propose_plan_adjustment",
        lambda _context, _student_id: _proposal_payload(),
    )
    client = TestClient(app)
    student, project = _create_student_and_project(client)
    check_in_id, milestone_ids = _add_checkin_and_milestones(student, project)
    headers = {"Authorization": f"Bearer {student['token']}"}

    created = client.post(
        f"/projects/{project['id']}/check-ins/{check_in_id}/plan-proposals",
        headers=headers,
    )
    assert created.status_code == 201, created.text
    proposal = created.json()
    assert proposal["status"] == "pending"
    assert len(proposal["milestones"]) == 2
    another = client.post(
        f"/projects/{project['id']}/check-ins/{check_in_id}/plan-proposals",
        headers=headers,
    )
    assert another.status_code == 201, another.text

    approved = client.patch(
        f"/projects/{project['id']}/plan-proposals/{proposal['id']}",
        headers=headers,
        json={"decision": "approve"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    proposals = client.get(f"/projects/{project['id']}/plan-proposals", headers=headers)
    assert proposals.status_code == 200
    assert {item["status"] for item in proposals.json()} == {"approved", "stale"}

    milestones = client.get(f"/projects/{project['id']}/milestones", headers=headers)
    assert milestones.status_code == 200
    saved = milestones.json()
    assert saved[0]["id"] == milestone_ids[0]
    assert saved[0]["completed"] is True
    assert [item["title"] for item in saved[1:]] == [
        "Confirm external API contract",
        "Test the core workflow",
    ]
    assert all(not item["completed"] for item in saved[1:])

    repeated_decision = client.patch(
        f"/projects/{project['id']}/plan-proposals/{proposal['id']}",
        headers=headers,
        json={"decision": "approve"},
    )
    assert repeated_decision.status_code == 409


def test_stale_proposal_cannot_overwrite_changed_milestones(monkeypatch: Any):
    from app.api import project_plan_proposals

    monkeypatch.setattr(
        project_plan_proposals,
        "propose_plan_adjustment",
        lambda _context, _student_id: _proposal_payload(),
    )
    client = TestClient(app)
    student, project = _create_student_and_project(client)
    check_in_id, milestone_ids = _add_checkin_and_milestones(student, project)
    headers = {"Authorization": f"Bearer {student['token']}"}
    created = client.post(
        f"/projects/{project['id']}/check-ins/{check_in_id}/plan-proposals",
        headers=headers,
    )
    assert created.status_code == 201, created.text
    proposal_id = created.json()["id"]

    db: Session = SessionLocal()
    try:
        milestone = db.get(ProjectMilestone, milestone_ids[1])
        assert milestone is not None
        milestone.completed = True
        db.commit()
    finally:
        db.close()

    stale = client.patch(
        f"/projects/{project['id']}/plan-proposals/{proposal_id}",
        headers=headers,
        json={"decision": "approve"},
    )
    assert stale.status_code == 409
    listed = client.get(f"/projects/{project['id']}/plan-proposals", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["status"] == "stale"

    milestones = client.get(f"/projects/{project['id']}/milestones", headers=headers)
    assert [item["id"] for item in milestones.json()] == milestone_ids


def test_proposal_rejection_leaves_saved_plan_unchanged(monkeypatch: Any):
    from app.api import project_plan_proposals

    monkeypatch.setattr(
        project_plan_proposals,
        "propose_plan_adjustment",
        lambda _context, _student_id: _proposal_payload(),
    )
    client = TestClient(app)
    student, project = _create_student_and_project(client)
    check_in_id, milestone_ids = _add_checkin_and_milestones(student, project)
    headers = {"Authorization": f"Bearer {student['token']}"}
    created = client.post(
        f"/projects/{project['id']}/check-ins/{check_in_id}/plan-proposals",
        headers=headers,
    )
    assert created.status_code == 201, created.text

    rejected = client.patch(
        f"/projects/{project['id']}/plan-proposals/{created.json()['id']}",
        headers=headers,
        json={"decision": "reject"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    milestones = client.get(
        f"/projects/{project['id']}/milestones",
        headers=headers,
    )
    assert [item["id"] for item in milestones.json()] == milestone_ids
