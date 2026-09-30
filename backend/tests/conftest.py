import os
import tempfile
from typing import Any

TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "academic_mentor_test.db")
if os.path.exists(TEST_DB_PATH):
    os.remove(TEST_DB_PATH)

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-pytest-only-0123456789"
os.environ["AGENTS_BASE_URL"] = "http://agents.test:8001"

import app.api.student as student_module
from app.api.rate_limit import InMemoryRateLimiter

student_module.auth_rate_limiter = InMemoryRateLimiter(
    max_requests=100000,
    window_seconds=3600,
)


def _register(client: Any, name: str, email: str, password: str = "secret123") -> Any:  # pyright: ignore[reportUnusedFunction]
    return client.post(
        "/students/register",
        json={
            "name": name,
            "email": email,
            "password": password,
            "department": "Computer Science",
            "semester": 5,
        },
    )


def _create_project(client: Any, token: str, student_id: int, title: str = "My Project", idea: str = "Build an academic project tracker with AI recommendations.") -> Any:  # pyright: ignore[reportUnusedFunction]
    return client.post(
        "/projects/",
        json={
            "student_id": student_id,
            "title": title,
            "idea": idea,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
