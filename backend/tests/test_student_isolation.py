from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from app.database.database import Base, engine
from app.main import app


def setup_function() -> None:
    Base.metadata.create_all(bind=engine)


def test_project_owner_access_is_forbidden_for_other_students():
    client: Any = TestClient(app)
    test_id = uuid4().hex
    owner_email = f"alice-{test_id}@example.com"
    other_email = f"bob-{test_id}@example.com"

    first = client.post(
        "/students/register",
        json={
            "name": "Alice",
            "email": owner_email,
            "password": "secret123",
            "department": "Computer Science",
            "semester": 5,
        },
    )
    second = client.post(
        "/students/register",
        json={
            "name": "Bob",
            "email": other_email,
            "password": "secret123",
            "department": "Computer Science",
            "semester": 5,
        },
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text

    owner_id = first.json()["id"]
    owner_login = client.post(
        "/students/login",
        json={"email": owner_email, "password": "secret123"},
    )
    other_login = client.post(
        "/students/login",
        json={"email": other_email, "password": "secret123"},
    )
    assert owner_login.status_code == 200, owner_login.text
    assert other_login.status_code == 200, other_login.text

    project = client.post(
        "/projects/",
        json={
            "student_id": owner_id,
            "title": "AI Study Planner",
            "idea": "Build an academic study planner using AI recommendations.",
        },
        headers={"Authorization": f"Bearer {owner_login.json()['token']}"},
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["id"]

    response = client.get(
        f"/projects/{project_id}?student_id={second.json()['id']}",
        headers={"Authorization": f"Bearer {other_login.json()['token']}"},
    )

    assert response.status_code == 403, response.text
