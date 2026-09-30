import hashlib
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app.api.student as student_module
from app.database.database import SessionLocal
from app.main import app
from app.models.student import Student


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}@example.com"


def _register(client: Any, email: str, password: str = "secret123") -> Any:
    return client.post(
        "/students/register",
        json={
            "name": "Security Student",
            "email": email,
            "password": password,
            "department": "CS",
            "semester": 5,
        },
    )


def _insert_legacy_student(email: str, password: str = "secret123"):
    legacy_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), b"ai-project-mentor", 100000
    ).hex()
    db = SessionLocal()
    try:
        student = Student(
            name="Legacy User",
            email=email,
            password_hash=legacy_digest,
            department="CS",
            semester=5,
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        return student.id
    finally:
        db.close()


def test_legacy_password_is_rehashed_on_next_login():
    client: Any = TestClient(app)
    email = _unique_email("legacy")
    _insert_legacy_student(email)

    login = client.post("/students/login", json={"email": email, "password": "secret123"})
    assert login.status_code == 200, login.text

    db = SessionLocal()
    try:
        row: Any = db.query(Student).filter(Student.email == email).first()
        assert row.password_hash.startswith("pbkdf2_sha256$")
        assert len(row.password_hash.split("$")) == 3
    finally:
        db.close()

    again = client.post("/students/login", json={"email": email, "password": "secret123"})
    assert again.status_code == 200, again.text


def test_stale_token_is_rejected_after_re_login():
    client: Any = TestClient(app)
    email = _unique_email("stale")
    _register(client, email)
    first_login = client.post("/students/login", json={"email": email, "password": "secret123"})
    second_login = client.post("/students/login", json={"email": email, "password": "secret123"})
    token1 = first_login.json()["token"]
    token2 = second_login.json()["token"]
    assert token1 != token2

    stale = client.get("/students/me", headers={"Authorization": f"Bearer {token1}"})
    current = client.get("/students/me", headers={"Authorization": f"Bearer {token2}"})
    assert stale.status_code == 401, stale.text
    assert current.status_code == 200, current.text


def test_logout_invalidates_token():
    client: Any = TestClient(app)
    email = _unique_email("logout")
    _register(client, email)
    login = client.post("/students/login", json={"email": email, "password": "secret123"})
    token = login.json()["token"]

    logged_out = client.post("/students/logout", headers={"Authorization": f"Bearer {token}"})
    assert logged_out.status_code == 200, logged_out.text

    me = client.get("/students/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 401, me.text


def test_empty_password_hash_fails_verification_instead_of_raising():
    """The schema migration backfills '' into password_hash.

    Unpacking that value used to raise ValueError out of the login route, which
    surfaced as a 500 and locked every migrated account out permanently.
    """
    assert student_module.verify_password("secret123", "") is False
    assert student_module.verify_password("secret123", "pbkdf2_sha256$") is False
    assert student_module.verify_password("secret123", "pbkdf2_sha256$only-two") is False
    # A non-hex salt must not raise either.
    assert student_module.verify_password("secret123", "pbkdf2_sha256$zzzz$abcd") is False


def test_login_for_migrated_account_returns_401_not_500():
    email = _unique_email("migrated")
    db = SessionLocal()
    try:
        db.add(
            Student(
                name="Migrated User",
                email=email,
                password_hash="",  # exactly what upgrade_existing_schema writes
                department="CS",
                semester=5,
            )
        )
        db.commit()
    finally:
        db.close()

    client: Any = TestClient(app)
    resp = client.post("/students/login", json={"email": email, "password": "secret123"})
    assert resp.status_code == 401, resp.text


def test_unknown_email_still_answers_in_constant_time_shape(monkeypatch: pytest.MonkeyPatch):
    """An unknown email must cost the same password work as a known one.

    Returning before verify_password made the response time alone a list of
    registered addresses, regardless of the generic error message.
    """
    calls: list[str] = []
    real_verify = student_module.verify_password

    def _counting_verify(password: str, stored: str) -> bool:
        calls.append(stored)
        return real_verify(password, stored)

    monkeypatch.setattr(student_module, "verify_password", _counting_verify)
    client: Any = TestClient(app)

    client.post(
        "/students/login",
        json={"email": _unique_email("nobody"), "password": "secret123"},
    )
    assert len(calls) == 1, "unknown email skipped the hashing work"

    email = _unique_email("known")
    _register(client, email)
    calls.clear()
    client.post("/students/login", json={"email": email, "password": "secret123"})
    assert len(calls) == 1


def test_session_token_is_stored_as_a_digest_not_the_token():
    client: Any = TestClient(app)
    email = _unique_email("digest")
    _register(client, email)
    login = client.post("/students/login", json={"email": email, "password": "secret123"})
    token = login.json()["token"]

    db = SessionLocal()
    try:
        stored: Any = (
            db.query(Student).filter(Student.email == email).first().auth_token  # pyright: ignore[reportOptionalMemberAccess]
        )
    finally:
        db.close()

    assert stored != token, "the raw bearer token must never be persisted"
    assert stored == student_module.hash_token(token)
    # A database leak must not yield a usable credential.
    assert client.get(
        "/students/me", headers={"Authorization": f"Bearer {stored}"}
    ).status_code == 401


def test_duplicate_registration_is_a_400_not_a_500():
    client: Any = TestClient(app)
    email = _unique_email("dupe")
    assert _register(client, email).status_code == 200
    second = _register(client, email)
    assert second.status_code == 400, second.text
