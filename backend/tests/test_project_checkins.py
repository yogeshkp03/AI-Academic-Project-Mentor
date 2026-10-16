from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import configure_mappers

from app.database.database import Base, engine
from app.main import app


def setup_function() -> None:
    Base.metadata.create_all(bind=engine)


def _create_student_and_project(client: TestClient) -> tuple[dict[str, Any], dict[str, Any]]:
    suffix = uuid4().hex[:10]
    registration = client.post(
        "/students/register",
        json={
            "name": "Check-in Student",
            "email": f"checkin-{suffix}@example.com",
            "password": "student-password",
            "department": "Computer Science",
            "semester": 5,
        },
    )
    assert registration.status_code == 200, registration.text
    login = client.post(
        "/students/login",
        json={
            "email": f"checkin-{suffix}@example.com",
            "password": "student-password",
        },
    )
    assert login.status_code == 200, login.text
    student = {
        "id": registration.json()["id"],
        "token": login.json()["token"],
    }
    project_response = client.post(
        "/projects/",
        headers={"Authorization": f"Bearer {student['token']}"},
        json={
            "student_id": student["id"],
            "title": "Research Planner",
            "idea": "Build a planner that helps students organize research tasks.",
        },
    )
    assert project_response.status_code == 200, project_response.text
    return student, project_response.json()


def test_check_ins_save_mentor_feedback_and_list_history(monkeypatch: Any):
    from app.api import project_checkins

    configure_mappers()
    monkeypatch.setattr(
        project_checkins,
        "generate_chat_response",
        lambda **_kwargs: "Good progress. Reduce next week's goal if the blocker remains.",
    )
    client = TestClient(app)
    student, project = _create_student_and_project(client)
    headers = {"Authorization": f"Bearer {student['token']}"}
    payload = {
        "completed_work": "Finished the project requirements and database outline.",
        "in_progress": "Building the first task-list prototype.",
        "blockers": "I need to confirm the API authentication approach.",
        "next_week_goal": "Complete one working end-to-end task flow.",
        "confidence": 3,
    }

    created = client.post(
        f"/projects/{project['id']}/check-ins",
        headers=headers,
        json=payload,
    )
    assert created.status_code == 201, created.text
    response = created.json()
    assert response["project_id"] == project["id"]
    assert response["student_id"] == student["id"]
    assert response["completed_work"] == payload["completed_work"]
    assert response["confidence"] == 3
    assert response["mentor_feedback"].startswith("Good progress.")

    history = client.get(
        f"/projects/{project['id']}/check-ins",
        headers=headers,
    )
    assert history.status_code == 200
    assert [item["id"] for item in history.json()] == [response["id"]]

    invalid = client.post(
        f"/projects/{project['id']}/check-ins",
        headers=headers,
        json={**payload, "confidence": 6},
    )
    assert invalid.status_code == 422


def test_check_ins_enforce_project_ownership_and_do_not_save_on_ai_failure(monkeypatch: Any):
    from app.api import project_checkins

    client = TestClient(app)
    student, project = _create_student_and_project(client)
    other_student, _ = _create_student_and_project(client)

    forbidden = client.get(
        f"/projects/{project['id']}/check-ins",
        headers={"Authorization": f"Bearer {other_student['token']}"},
    )
    assert forbidden.status_code == 403

    def fail_feedback(**_kwargs: Any) -> str:
        raise RuntimeError("AI service unavailable")

    monkeypatch.setattr(project_checkins, "generate_chat_response", fail_feedback)
    failed = client.post(
        f"/projects/{project['id']}/check-ins",
        headers={"Authorization": f"Bearer {student['token']}"},
        json={
            "completed_work": "Finished the initial interface wireframes.",
            "in_progress": "Implementing the first prototype.",
            "blockers": "",
            "next_week_goal": "Build and test the first prototype.",
            "confidence": 4,
        },
    )
    assert failed.status_code == 503

    history = client.get(
        f"/projects/{project['id']}/check-ins",
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert history.status_code == 200
    assert history.json() == []
