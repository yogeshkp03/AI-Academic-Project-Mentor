from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from app.database.database import Base, engine
from app.main import app


def setup_function() -> None:
    Base.metadata.create_all(bind=engine)


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_risk_assessment_saves_updates_and_scopes_risks(monkeypatch: Any):
    from app.api import project_risks

    assessed_risks = [
        {
            "title": "External API instability",
            "description": "The project depends on an external API that may be unavailable.",
            "likelihood": "medium",
            "impact": "high",
            "mitigation": "Add timeouts, retries, and a local fallback for development.",
        },
        {
            "title": "Unbounded project scope",
            "description": "Optional features may exceed the available semester schedule.",
            "likelihood": "high",
            "impact": "medium",
            "mitigation": "Agree on an MVP and defer optional features until core testing passes.",
        },
        {
            "title": "Insufficient test coverage",
            "description": "Late testing could reveal defects after the delivery buffer is gone.",
            "likelihood": "low",
            "impact": "medium",
            "mitigation": "Add a small test for each feature while it is being implemented.",
        },
    ]
    monkeypatch.setattr(
        project_risks,
        "assess_project_risks",
        lambda _project, _student_id: {"risks": assessed_risks},
    )

    client: Any = TestClient(app)
    suffix = uuid4().hex[:10]
    registration = client.post(
        "/students/register",
        json={
            "name": "Risk Student",
            "email": f"risk-{suffix}@example.com",
            "password": "student-password",
            "department": "Computer Science",
            "semester": 5,
        },
    )
    assert registration.status_code == 200, registration.text
    student_id = registration.json()["id"]
    login = client.post(
        "/students/login",
        json={
            "email": f"risk-{suffix}@example.com",
            "password": "student-password",
        },
    )
    token = login.json()["token"]

    project_response = client.post(
        "/projects/",
        headers=_headers(token),
        json={
            "student_id": student_id,
            "title": "Research Planner",
            "idea": "Build a planner that helps students organize research tasks.",
        },
    )
    assert project_response.status_code == 200, project_response.text
    project_id = project_response.json()["id"]

    assessed = client.post(
        f"/projects/{project_id}/risks/assess",
        headers=_headers(token),
    )
    assert assessed.status_code == 200, assessed.text
    assert len(assessed.json()) == 3
    assert assessed.json()[0]["status"] == "open"

    risk_id = assessed.json()[0]["id"]
    updated = client.patch(
        f"/projects/{project_id}/risks/{risk_id}",
        headers=_headers(token),
        json={"status": "mitigated"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "mitigated"

    listed = client.get(
        f"/projects/{project_id}/risks",
        headers=_headers(token),
    )
    assert listed.status_code == 200
    assert next(item for item in listed.json() if item["id"] == risk_id)["status"] == "mitigated"

    refreshed = client.post(
        f"/projects/{project_id}/risks/assess",
        headers=_headers(token),
    )
    assert refreshed.status_code == 200, refreshed.text
    assert len(refreshed.json()) == 3
    assert next(item for item in refreshed.json() if item["id"] == risk_id)["status"] == "open"

    invalid_status = client.patch(
        f"/projects/{project_id}/risks/{risk_id}",
        headers=_headers(token),
        json={"status": "deleted"},
    )
    assert invalid_status.status_code == 422


def test_risk_routes_enforce_student_project_ownership():
    client: Any = TestClient(app)
    student_tokens = []
    project_ids = []
    for name in ("First Risk Student", "Second Risk Student"):
        email = f"{uuid4().hex}@example.com"
        registered = client.post(
            "/students/register",
            json={
                "name": name,
                "email": email,
                "password": "student-password",
                "department": "Computer Science",
                "semester": 5,
            },
        )
        assert registered.status_code == 200, registered.text
        logged_in = client.post(
            "/students/login",
            json={"email": email, "password": "student-password"},
        )
        token = logged_in.json()["token"]
        student_tokens.append(token)
        project = client.post(
            "/projects/",
            headers=_headers(token),
            json={
                "student_id": registered.json()["id"],
                "title": "Research Planner",
                "idea": "Build a planner that helps students organize research tasks.",
            },
        )
        assert project.status_code == 200, project.text
        project_ids.append(project.json()["id"])

    forbidden = client.get(
        f"/projects/{project_ids[0]}/risks",
        headers=_headers(student_tokens[1]),
    )
    assert forbidden.status_code == 403
