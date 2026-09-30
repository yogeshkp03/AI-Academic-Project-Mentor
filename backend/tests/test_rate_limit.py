"""Rate limiting must key on something a client cannot rotate at will."""

import types
from typing import Any

import pytest
from fastapi import HTTPException

import app.api.rate_limit as rate_limit_module
from app.api.rate_limit import InMemoryRateLimiter


def _request(host: str, xff: str | None = None) -> Any:
    headers: dict[str, str] = {"X-Forwarded-For": xff} if xff else {}
    return types.SimpleNamespace(client=types.SimpleNamespace(host=host), headers=headers)


def test_forwarded_for_is_ignored_unless_the_proxy_is_trusted(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(rate_limit_module, "TRUSTED_PROXIES", frozenset())  # pyright: ignore[reportUnknownArgumentType]
    assert rate_limit_module.client_host(_request("10.0.0.5", xff="1.2.3.4")) == "10.0.0.5"

    monkeypatch.setattr(rate_limit_module, "TRUSTED_PROXIES", frozenset({"10.0.0.5"}))
    assert rate_limit_module.client_host(_request("10.0.0.5", xff="1.2.3.4")) == "1.2.3.4"
    # A spoofed header from an untrusted peer must not be believed.
    assert rate_limit_module.client_host(_request("10.0.0.9", xff="1.2.3.4")) == "10.0.0.9"


def test_spoofed_forwarded_for_cannot_reset_a_rate_limit(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(rate_limit_module, "TRUSTED_PROXIES", frozenset())  # pyright: ignore[reportUnknownArgumentType]
    limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60)

    for index in range(3):
        limiter.check(rate_limit_module.client_key(_request("10.0.0.5", xff=f"9.9.9.{index}")))

    with pytest.raises(HTTPException) as caught:
        limiter.check(rate_limit_module.client_key(_request("10.0.0.5", xff="8.8.8.8")))
    assert caught.value.status_code == 429
    assert "Retry-After" in caught.value.headers  # pyright: ignore[reportOperatorIssue]


def test_authenticated_routes_are_keyed_by_student_not_by_ip(monkeypatch: pytest.MonkeyPatch):
    """Keying by peer address would make everyone behind one NAT share a budget."""
    monkeypatch.setattr(rate_limit_module, "TRUSTED_PROXIES", frozenset())  # pyright: ignore[reportUnknownArgumentType]
    first = _request("10.0.0.5")
    second = _request("10.0.0.5")  # same NAT as the first

    assert rate_limit_module.student_key(first, 1) == rate_limit_module.student_key(second, 1)
    assert rate_limit_module.student_key(first, 1) != rate_limit_module.student_key(second, 2)

    limiter = InMemoryRateLimiter(max_requests=2, window_seconds=60)
    limiter.check(rate_limit_module.student_key(first, 1))
    limiter.check(rate_limit_module.student_key(first, 1))

    with pytest.raises(HTTPException):
        limiter.check(rate_limit_module.student_key(first, 1))
    # A different student behind the same address is unaffected.
    limiter.check(rate_limit_module.student_key(second, 2))


def test_stale_bucket_is_replaced_not_appended_to(monkeypatch: pytest.MonkeyPatch):
    """An expired window must not accumulate timestamps for a returning key."""
    clock = [1000.0]
    monkeypatch.setattr(rate_limit_module.time, "monotonic", lambda: clock[0])
    limiter = InMemoryRateLimiter(max_requests=5, window_seconds=10)

    for _ in range(5):
        limiter.check("key-0")
    with pytest.raises(HTTPException):
        limiter.check("key-0")

    clock[0] = 1100.0  # window has passed
    for _ in range(5):
        limiter.check("key-0")
    assert limiter._hits["key-0"] == [1100.0] * 5, "old timestamps survived the window"  # pyright: ignore[reportPrivateUsage]
    with pytest.raises(HTTPException):
        limiter.check("key-0")


def test_total_tracked_keys_stay_bounded(monkeypatch: pytest.MonkeyPatch):
    """A client rotating identifiers must not grow the dict without bound.

    Stale buckets are only cleaned when their own key is seen again, so the
    tracked-key cap is what actually bounds memory here.
    """
    monkeypatch.setattr(rate_limit_module, "MAX_TRACKED_KEYS", 10)
    limiter = InMemoryRateLimiter(max_requests=5, window_seconds=600)

    for index in range(500):
        limiter.check(f"key-{index}")
    assert len(limiter._hits) <= 10  # pyright: ignore[reportPrivateUsage]
