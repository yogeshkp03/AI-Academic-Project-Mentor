from datetime import timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

import app.api.faculty as faculty_api
from app.database.database import Base, SessionLocal, engine, utcnow
from app.main import app
from app.models.faculty import Faculty
from app.models.mentor_appeal import MentorAppeal
from app.models.skill_assessment import SkillAssessmentAttempt
from app.models.student import Student
from app.models.student_skill import StudentSkill
from app.api.rate_limit import InMemoryRateLimiter


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_student(client: TestClient) -> tuple[str, str]:
    email = f"student-{uuid4().hex[:10]}@example.com"
    registered = client.post(
        "/students/register",
        json={
            "name": "Mentorship Student",
            "email": email,
            "password": "student-password",
            "department": "Computer Science",
            "semester": 5,
        },
    )
    assert registered.status_code == 200, registered.text
    login = client.post(
        "/students/login",
        json={"email": email, "password": "student-password"},
    )
    assert login.status_code == 200, login.text
    return email, login.json()["token"]


def _create_faculty(client: TestClient, *, available: bool = True) -> tuple[int, str]:
    suffix = uuid4().hex[:10]
    email = f"faculty-{suffix}@example.com"
    registered = client.post(
        "/faculty/register",
        json={
            "name": f"Mentor {suffix}",
            "email": email,
            "department": "Computer Science",
            "password": "faculty-password-long",
        },
    )
    assert registered.status_code == 201, registered.text
    db = SessionLocal()
    try:
        faculty = db.query(Faculty).filter(Faculty.email == email).one()
        faculty.is_approved = True
        faculty.is_mentor_available = available
        faculty.mentor_expertise = "Cybersecurity, AI"
        db.commit()
        faculty_id = faculty.id
    finally:
        db.close()
    login = client.post(
        "/faculty/login",
        json={"email": email, "password": "faculty-password-long"},
    )
    assert login.status_code == 200, login.text
    return faculty_id, login.json()["token"]


def setup_function() -> None:
    Base.metadata.create_all(bind=engine)
    faculty_api.auth_rate_limiter = InMemoryRateLimiter(
        max_requests=100000,
        window_seconds=3600,
    )


def test_student_can_request_and_faculty_accepts_only_one_mentor():
    client = TestClient(app)
    student_email, student_token = _create_student(client)
    first_faculty_id, first_faculty_token = _create_faculty(client)
    second_faculty_id, second_faculty_token = _create_faculty(client)
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.email == student_email).one()
        db.add(
            StudentSkill(
                student_id=student.id,
                name="Python",
                normalized_name="python",
                level="Intermediate",
            )
        )
        db.add(
            SkillAssessmentAttempt(
                student_id=student.id,
                question_ids_json="[]",
                skills_json='["Python"]',
                answers_json="{}",
                correct_answers=8,
                total_questions=10,
                score=80,
                completed_at=utcnow(),
            )
        )
        db.commit()
    finally:
        db.close()

    visible = client.get(
        "/mentorship/available-faculty",
        headers=_headers(student_token),
    )
    assert visible.status_code == 200
    assert {row["id"] for row in visible.json()} >= {
        first_faculty_id,
        second_faculty_id,
    }

    payload = {
        "course_area": "Cybersecurity",
        "project_idea": "Build an AI assisted security analysis dashboard.",
        "message": "I would like guidance on threat modeling and secure design.",
        "share_profile": True,
    }
    missing_consent = client.post(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
        json={**payload, "faculty_id": first_faculty_id, "share_profile": False},
    )
    assert missing_consent.status_code == 400
    first_request = client.post(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
        json={**payload, "faculty_id": first_faculty_id},
    )
    second_request = client.post(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
        json={**payload, "faculty_id": second_faculty_id},
    )
    assert first_request.status_code == 201, first_request.text
    assert second_request.status_code == 201, second_request.text
    assert first_request.json()["expires_at"] > first_request.json()["submitted_at"]
    first_faculty_requests = client.get(
        "/mentorship/faculty-appeals",
        headers=_headers(first_faculty_token),
    )
    assert {row["id"] for row in first_faculty_requests.json()} == {
        first_request.json()["id"]
    }

    rejection_without_reason = client.put(
        f"/mentorship/faculty-appeals/{first_request.json()['id']}/decision",
        headers=_headers(first_faculty_token),
        json={"decision": "reject"},
    )
    assert rejection_without_reason.status_code == 422

    accepted = client.put(
        f"/mentorship/faculty-appeals/{first_request.json()['id']}/decision",
        headers=_headers(first_faculty_token),
        json={"decision": "accept"},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["student_email"] == student_email
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["student_skills"] == [
        {"name": "Python", "level": "Intermediate"}
    ]
    assert accepted.json()["assessment_score"] == 80

    student_requests = client.get(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
    )
    statuses = {row["id"]: row["status"] for row in student_requests.json()}
    assert statuses[first_request.json()["id"]] == "accepted"
    assert statuses[second_request.json()["id"]] == "closed"
    closed_request_decision = client.put(
        f"/mentorship/faculty-appeals/{second_request.json()['id']}/decision",
        headers=_headers(second_faculty_token),
        json={"decision": "accept"},
    )
    assert closed_request_decision.status_code == 409
    extra_request = client.post(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
        json={**payload, "faculty_id": second_faculty_id},
    )
    assert extra_request.status_code == 409


def test_approved_faculty_appears_only_after_enabling_mentor_availability():
    client = TestClient(app)
    _, student_token = _create_student(client)
    faculty_id, faculty_token = _create_faculty(client, available=False)

    hidden_faculty = client.get(
        "/mentorship/available-faculty",
        headers=_headers(student_token),
    )
    assert hidden_faculty.status_code == 200
    assert faculty_id not in {row["id"] for row in hidden_faculty.json()}

    enabled = client.patch(
        "/faculty/mentor-profile",
        headers=_headers(faculty_token),
        json={
            "is_mentor_available": True,
            "mentor_expertise": "Cybersecurity",
        },
    )
    assert enabled.status_code == 200, enabled.text

    visible_faculty = client.get(
        "/mentorship/available-faculty",
        headers=_headers(student_token),
    )
    assert visible_faculty.status_code == 200
    assert faculty_id in {row["id"] for row in visible_faculty.json()}


def test_rejection_reason_and_deadline_expiry_are_enforced():
    client = TestClient(app)
    _, student_token = _create_student(client)
    faculty_id, faculty_token = _create_faculty(client)
    request = client.post(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
        json={
            "faculty_id": faculty_id,
            "course_area": "Data Science",
            "project_idea": "Create a data science project to forecast energy demand.",
            "message": "Please guide me on selecting appropriate datasets and models.",
            "share_profile": True,
        },
    )
    assert request.status_code == 201, request.text

    db = SessionLocal()
    try:
        appeal = db.query(MentorAppeal).filter(MentorAppeal.id == request.json()["id"]).one()
        appeal.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()

    listed = client.get(
        "/mentorship/faculty-appeals",
        headers=_headers(faculty_token),
    )
    assert listed.status_code == 200
    assert next(row for row in listed.json() if row["id"] == request.json()["id"])["status"] == "expired"

    late_decision = client.put(
        f"/mentorship/faculty-appeals/{request.json()['id']}/decision",
        headers=_headers(faculty_token),
        json={"decision": "accept"},
    )
    assert late_decision.status_code == 410


def test_student_receives_faculty_rejection_reason():
    client = TestClient(app)
    _, student_token = _create_student(client)
    faculty_id, faculty_token = _create_faculty(client)
    request = client.post(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
        json={
            "faculty_id": faculty_id,
            "course_area": "Data Science",
            "project_idea": "Analyze public transit data to improve route planning.",
            "message": "I am looking for guidance on data preparation and model selection.",
            "share_profile": True,
        },
    )
    assert request.status_code == 201, request.text
    reason = "I cannot supervise this topic this semester."
    rejected = client.put(
        f"/mentorship/faculty-appeals/{request.json()['id']}/decision",
        headers=_headers(faculty_token),
        json={"decision": "reject", "rejection_reason": reason},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    student_requests = client.get(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
    )
    assert student_requests.json()[0]["rejection_reason"] == reason


def test_google_forms_webhook_requires_secret_and_is_idempotent(monkeypatch):
    monkeypatch.setenv("GOOGLE_FORMS_WEBHOOK_SECRET", "secret-for-test-only")
    client = TestClient(app)
    student_email, _student_token = _create_student(client)
    faculty_id, _faculty_token = _create_faculty(client)
    payload = {
        "submission_id": f"form-{uuid4().hex}",
        "student_email": student_email,
        "faculty_id": faculty_id,
        "course_area": "Artificial Intelligence",
        "project_idea": "Create a recommendation engine for academic project ideas.",
        "message": "I am seeking help designing and evaluating recommendation quality.",
        "share_profile": True,
    }
    path = "/integrations/google-forms/mentor-appeals"
    unauthorized = client.post(path, json=payload)
    assert unauthorized.status_code == 401

    headers = {"X-Google-Forms-Secret": "secret-for-test-only"}
    first = client.post(path, json=payload, headers=headers)
    repeated = client.post(path, json=payload, headers=headers)
    assert first.status_code == 201, first.text
    assert repeated.status_code == 201, repeated.text
    assert repeated.json()["id"] == first.json()["id"]
