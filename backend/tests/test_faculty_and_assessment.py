from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from app.database.database import Base, SessionLocal, engine
from app.main import app
from app.models.faculty import Faculty
from app.services.skill_assessment import (
    QUESTION_BANK,
    SKILL_ALIASES,
    select_assessment_questions,
)

# Private by convention, but the alias table is the regression surface for the
# substring matcher: "java" is a prefix of "javascript" and "go" sits inside
# "mongodb", so a substring lookup only breaks once those skills are added.
# Pinning the resolved keys makes that failure deterministic instead of
# probabilistic.
from app.services.skill_assessment import _QUESTION_SKILL_BY_ALIAS


def setup_function() -> None:
    Base.metadata.create_all(bind=engine)


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_faculty_approval_review_and_student_feedback_flow():
    client: Any = TestClient(app)
    suffix = uuid4().hex[:10]
    faculty_email = f"faculty-{suffix}@example.com"
    student_email = f"student-{suffix}@example.com"

    registration = client.post(
        "/faculty/register",
        json={
            "name": "Faculty Reviewer",
            "email": faculty_email,
            "department": "Computer Science",
            "password": "faculty-password-long",
        },
    )
    assert registration.status_code == 201, registration.text
    assert registration.json()["is_approved"] is False
    assert "password_hash" not in registration.json()

    pending_login = client.post(
        "/faculty/login",
        json={"email": faculty_email, "password": "faculty-password-long"},
    )
    assert pending_login.status_code == 403

    db = SessionLocal()
    try:
        faculty = db.query(Faculty).filter(Faculty.email == faculty_email).one()
        faculty.is_approved = True
        faculty.is_mentor_available = True
        db.commit()
    finally:
        db.close()

    faculty_login = client.post(
        "/faculty/login",
        json={"email": faculty_email, "password": "faculty-password-long"},
    )
    assert faculty_login.status_code == 200, faculty_login.text
    faculty_token = faculty_login.json()["token"]

    other_faculty_email = f"other-faculty-{suffix}@example.com"
    other_faculty_registration = client.post(
        "/faculty/register",
        json={
            "name": "Other Faculty",
            "email": other_faculty_email,
            "department": "Computer Science",
            "password": "faculty-password-long",
        },
    )
    assert other_faculty_registration.status_code == 201
    db = SessionLocal()
    try:
        other_faculty = (
            db.query(Faculty)
            .filter(Faculty.email == other_faculty_email)
            .one()
        )
        other_faculty.is_approved = True
        db.commit()
    finally:
        db.close()
    other_faculty_login = client.post(
        "/faculty/login",
        json={"email": other_faculty_email, "password": "faculty-password-long"},
    )
    assert other_faculty_login.status_code == 200, other_faculty_login.text
    other_faculty_token = other_faculty_login.json()["token"]

    student_register = client.post(
        "/students/register",
        json={
            "name": "Student Reviewer",
            "email": student_email,
            "password": "student-password",
            "department": "Computer Science",
            "semester": 5,
        },
    )
    assert student_register.status_code == 200, student_register.text
    student_id = student_register.json()["id"]
    student_login = client.post(
        "/students/login",
        json={"email": student_email, "password": "student-password"},
    )
    assert student_login.status_code == 200, student_login.text
    student_token = student_login.json()["token"]
    assert client.get(
        "/faculty/projects",
        headers=_headers(faculty_token),
    ).json() == []

    project_response = client.post(
        "/projects/",
        headers=_headers(student_token),
        json={
            "student_id": student_id,
            "title": "Study Planner",
            "idea": "An academic planner that helps students organize their workload.",
        },
    )
    assert project_response.status_code == 200, project_response.text
    project_id = project_response.json()["id"]

    request = client.post(
        "/mentorship/student-appeals",
        headers=_headers(student_token),
        json={
            "faculty_id": faculty_login.json()["faculty"]["id"],
            "course_area": "Software Engineering",
            "project_idea": "An academic planner that helps students organize their workload.",
            "message": "I would like feedback on project scope and milestones.",
            "share_profile": True,
        },
    )
    assert request.status_code == 201, request.text
    evaluation_before_acceptance = client.put(
        f"/faculty/projects/{project_id}/evaluation",
        headers=_headers(faculty_token),
        json={"score": 88, "feedback": "Good scope; add a clear test plan."},
    )
    assert evaluation_before_acceptance.status_code == 404

    accepted = client.put(
        f"/mentorship/faculty-appeals/{request.json()['id']}/decision",
        headers=_headers(faculty_token),
        json={"decision": "accept"},
    )
    assert accepted.status_code == 200, accepted.text

    student_cannot_use_faculty_api = client.get(
        "/faculty/projects",
        headers=_headers(student_token),
    )
    assert student_cannot_use_faculty_api.status_code == 401
    faculty_cannot_use_student_api = client.get(
        "/students/me",
        headers=_headers(faculty_token),
    )
    assert faculty_cannot_use_student_api.status_code == 401

    projects = client.get("/faculty/projects", headers=_headers(faculty_token))
    assert projects.status_code == 200, projects.text
    assert projects.json()[0]["student_email"] == student_email

    other_faculty_projects = client.get(
        "/faculty/projects",
        headers=_headers(other_faculty_token),
    )
    assert other_faculty_projects.status_code == 200
    assert other_faculty_projects.json() == []
    other_faculty_evaluation = client.put(
        f"/faculty/projects/{project_id}/evaluation",
        headers=_headers(other_faculty_token),
        json={"score": 70, "feedback": "This should not be allowed."},
    )
    assert other_faculty_evaluation.status_code == 404

    evaluation = client.put(
        f"/faculty/projects/{project_id}/evaluation",
        headers=_headers(faculty_token),
        json={"score": 88, "feedback": "Good scope; add a clear test plan."},
    )
    assert evaluation.status_code == 200, evaluation.text
    assert evaluation.json()["faculty_evaluation"]["score"] == 88

    student_projects = client.get(
        f"/projects/student/{student_id}",
        headers=_headers(student_token),
    )
    assert student_projects.status_code == 200, student_projects.text
    assert student_projects.json()[0]["faculty_evaluation"]["feedback"] == (
        "Good scope; add a clear test plan."
    )


def test_skill_assessment_scores_answers_server_side_and_checks_ownership():
    client: Any = TestClient(app)
    suffix = uuid4().hex[:10]
    email = f"assessment-{suffix}@example.com"
    registered = client.post(
        "/students/register",
        json={
            "name": "Assessment Student",
            "email": email,
            "password": "student-password",
            "department": "Computer Science",
            "semester": 4,
        },
    )
    assert registered.status_code == 200, registered.text
    login = client.post(
        "/students/login",
        json={"email": email, "password": "student-password"},
    )
    token = login.json()["token"]
    headers = _headers(token)

    missing_skills = client.post("/skill-assessments/attempts", headers=headers)
    assert missing_skills.status_code == 400

    updated = client.patch(
        "/students/me",
        headers=headers,
        json={"skills": [{"name": "Python", "level": "Intermediate"}]},
    )
    assert updated.status_code == 200, updated.text

    started = client.post("/skill-assessments/attempts", headers=headers)
    assert started.status_code == 200, started.text
    body = started.json()
    first_question = body["questions"][0]
    answer_by_id: dict[str, str] = {
        str(question["id"]): str(question["answer"]) for question in QUESTION_BANK
    }
    saved_draft = client.patch(
        f"/skill-assessments/attempts/{body['attempt_id']}/answers",
        headers=headers,
        json={
            "answers": [
                {
                    "question_id": first_question["id"],
                    "answer": answer_by_id[first_question["id"]],
                }
            ]
        },
    )
    assert saved_draft.status_code == 204, saved_draft.text
    resumed = client.get(
        f"/skill-assessments/attempts/{body['attempt_id']}",
        headers=headers,
    )
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["answers"] == {
        first_question["id"]: answer_by_id[first_question["id"]]
    }
    answers: list[dict[str, str]] = [
        {"question_id": str(question["id"]), "answer": answer_by_id[str(question["id"])]}
        for question in body["questions"]
    ]
    submitted = client.post(
        f"/skill-assessments/attempts/{body['attempt_id']}/submit",
        headers=headers,
        json={"answers": answers},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["score"] == 100
    assert submitted.json()["correct_answers"] == len(answers)

    other_email = f"other-{suffix}@example.com"
    other_register = client.post(
        "/students/register",
        json={
            "name": "Another Student",
            "email": other_email,
            "password": "student-password",
            "department": "Computer Science",
            "semester": 4,
        },
    )
    assert other_register.status_code == 200, other_register.text
    other_login = client.post(
        "/students/login",
        json={"email": other_email, "password": "student-password"},
    )
    other_submit = client.post(
        f"/skill-assessments/attempts/{body['attempt_id']}/submit",
        headers=_headers(other_login.json()["token"]),
        json={"answers": answers},
    )
    assert other_submit.status_code == 404

    repeated_submit = client.post(
        f"/skill-assessments/attempts/{body['attempt_id']}/submit",
        headers=headers,
        json={"answers": answers},
    )
    assert repeated_submit.status_code == 409


def test_question_bank_entries_are_self_consistent():
    ids = [question["id"] for question in QUESTION_BANK]
    assert len(set(ids)) == len(ids), "duplicate question ids"

    for question in QUESTION_BANK:
        assert question["answer"] in question["options"]
        assert len(set(question["options"])) == len(question["options"])
        assert question["answer"].strip()
        assert question["level"] in {"beginner", "intermediate", "advanced"}
        assert len(question["answer"]) <= 500, question["id"]

    # The bank grew from 21 to 54 so the AI/LLM skills students actually list
    # are covered rather than silently topped up with unrelated questions.
    assert len(QUESTION_BANK) >= 50
    covered = {question["skill"].casefold() for question in QUESTION_BANK}
    for skill in ("crewai", "langchain", "llm", "typescript", "docker", "aws"):
        assert skill in covered


def test_skill_aliases_resolve_by_exact_lookup_not_substring():
    # The pairing that a substring matcher gets wrong, and that this repo now
    # contains both sides of.
    assert _QUESTION_SKILL_BY_ALIAS["java"] != _QUESTION_SKILL_BY_ALIAS["javascript"]

    for canonical, aliases in SKILL_ALIASES.items():
        assert _QUESTION_SKILL_BY_ALIAS[canonical.casefold()] == canonical.casefold()
        for alias in aliases:
            assert _QUESTION_SKILL_BY_ALIAS[alias.casefold()] == canonical.casefold()

    # "go" is not an accepted spelling of anything, so it must not resolve to
    # a bucket whose name merely contains it.
    assert _QUESTION_SKILL_BY_ALIAS.get("go") is None


def test_assessment_matches_declared_skills_and_exposes_level():
    client: Any = TestClient(app)
    suffix = uuid4().hex[:10]
    email = f"bank-{suffix}@example.com"
    registered = client.post(
        "/students/register",
        json={
            "name": "Bank Student",
            "email": email,
            "password": "student-password",
            "department": "Computer Science",
            "semester": 4,
        },
    )
    assert registered.status_code == 200, registered.text
    login = client.post(
        "/students/login",
        json={"email": email, "password": "student-password"},
    )
    headers = _headers(login.json()["token"])

    # CrewAI and LangChain previously had no questions at all, so declaring
    # them produced a purely random assessment.
    updated = client.patch(
        "/students/me",
        headers=headers,
        json={
            "skills": [
                {"name": "crewai", "level": "Intermediate"},
                {"name": "langchain", "level": "Beginner"},
                {"name": "Docker", "level": "Advanced"},
            ]
        },
    )
    assert updated.status_code == 200, updated.text

    started = client.post("/skill-assessments/attempts", headers=headers)
    assert started.status_code == 200, started.text
    body = started.json()

    matched = {question["skill"].casefold() for question in body["questions"]}
    for skill in ("crewai", "langchain", "docker"):
        assert skill in matched, sorted(matched)

    for question in body["questions"]:
        assert question["level"] in {"beginner", "intermediate", "advanced"}

    # CrewAI has one question per level. The matched question respects the
    # declared tier, and the top-up then adds the remaining CrewAI questions,
    # so all three levels end up in the draw.
    for level in ("Beginner", "Intermediate", "Advanced"):
        for _ in range(30):
            drawn = select_assessment_questions([("crewai", level)])
            crewai_levels = {q["level"].casefold() for q in drawn if q["skill"] == "CrewAI"}
            assert level.casefold() in crewai_levels, (level, crewai_levels)
