from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}@example.com"


def test_register_login_and_me(client: Any):
    email = _unique_email("auth")
    register = client.post(
        "/students/register",
        json={
            "name": "Tester",
            "email": email,
            "password": "secret123",
            "department": "ECE",
            "semester": 6,
        },
    )
    assert register.status_code == 200, register.text
    assert register.json()["id"] > 0

    login = client.post(
        "/students/login",
        json={"email": email, "password": "secret123"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["token"]

    me = client.get("/students/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    assert me.json()["email"] == email


def test_duplicate_email_is_rejected(client: Any):
    email = _unique_email("dup")
    body = {
        "name": "Dup",
        "email": email,
        "password": "secret123",
        "department": "CS",
        "semester": 5,
    }
    first = client.post("/students/register", json=body)
    second = client.post("/students/register", json=body)
    assert first.status_code == 200, first.text
    assert second.status_code == 400, second.text


def test_wrong_password_is_rejected(client: Any):
    email = _unique_email("badpw")
    client.post(
        "/students/register",
        json={
            "name": "Bad",
            "email": email,
            "password": "secret123",
            "department": "CS",
            "semester": 5,
        },
    )
    login = client.post(
        "/students/login",
        json={"email": email, "password": "wrong-password"},
    )
    assert login.status_code == 401, login.text


def test_me_requires_token(client: Any):
    response = client.get("/students/me")
    assert response.status_code == 401, response.text


def test_invalid_token_is_rejected(client: Any):
    response = client.get(
        "/students/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401, response.text


def test_profile_can_be_updated(client: Any):
    email = _unique_email("patch")
    register = client.post(
        "/students/register",
        json={
            "name": "Old Name",
            "email": email,
            "password": "secret123",
            "department": "CS",
            "semester": 5,
        },
    )
    student_id = register.json()["id"]
    login = client.post(
        "/students/login",
        json={"email": email, "password": "secret123"},
    )
    token = login.json()["token"]

    updated = client.patch(
        "/students/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "New Name", "department": "IT", "semester": 6},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "New Name"
    assert updated.json()["department"] == "IT"
    assert updated.json()["semester"] == 6
    assert updated.json()["id"] == student_id


def test_profile_skills_are_persisted_and_validated(client: Any):
    email = _unique_email("skills")
    client.post(
        "/students/register",
        json={
            "name": "Skill Tester",
            "email": email,
            "password": "secret123",
            "department": "CS",
            "semester": 5,
        },
    )
    login = client.post(
        "/students/login",
        json={"email": email, "password": "secret123"},
    )
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    skills = [
        {"name": "Python", "level": "Intermediate"},
        {"name": "React", "level": "Beginner"},
    ]

    updated = client.patch("/students/me", headers=headers, json={"skills": skills})
    assert updated.status_code == 200, updated.text
    assert updated.json()["skills"] == skills

    reloaded = client.get("/students/me", headers=headers)
    assert reloaded.status_code == 200
    assert reloaded.json()["skills"] == skills

    duplicate = client.patch(
        "/students/me",
        headers=headers,
        json={"skills": [{"name": "Python", "level": "Beginner"}, {"name": "python", "level": "Advanced"}]},
    )
    assert duplicate.status_code == 422
