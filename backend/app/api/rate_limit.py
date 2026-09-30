import os
import time
from threading import Lock
from typing import Any

from fastapi import HTTPException, Request, status

# Proxies whose X-Forwarded-For header may be trusted. The header is set by
# whoever sends the request, so trusting it unconditionally lets any client
# present a fresh address per request and get an unlimited rate-limit budget.
TRUSTED_PROXIES = frozenset(
    proxy.strip() for proxy in os.getenv("TRUSTED_PROXIES", "").split(",") if proxy.strip()
)

# Upper bound on tracked keys so a client rotating identifiers cannot grow the
# dict without limit.
MAX_TRACKED_KEYS = int(os.getenv("RATE_LIMIT_MAX_KEYS", "10000"))


class InMemoryRateLimiter:
    def __init__(self, max_requests: int = 10, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            timestamps = [
                timestamp
                for timestamp in self._hits.get(key, [])
                if now - timestamp < self.window_seconds
            ]
            if len(timestamps) >= self.max_requests:
                retry_after = int(self.window_seconds - (now - timestamps[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            if not timestamps:
                # Drop the stale entry first, which also moves the key to the end
                # of the insertion order so eviction discards the least recently
                # active key first.
                self._hits.pop(key, None)
            timestamps.append(now)
            self._hits[key] = timestamps
            while len(self._hits) > MAX_TRACKED_KEYS:
                self._hits.pop(next(iter(self._hits)), None)


auth_rate_limiter = InMemoryRateLimiter(max_requests=10, window_seconds=60)
workspace_limiter = InMemoryRateLimiter(max_requests=120, window_seconds=60)


def client_host(request: Request) -> str:
    """Socket peer, honouring X-Forwarded-For only from a configured proxy."""
    peer = request.client.host if request.client else "unknown"
    if peer in TRUSTED_PROXIES:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return peer


def client_key(request: Request) -> str:
    """Rate-limit key for an unauthenticated route such as login.

    Authenticated routes should key on the student's own id instead, so one
    student cannot exhaust another student's budget.
    """
    return client_host(request)


def student_key(request: Request, student_id: int) -> str:
    """Rate-limit key for an authenticated route.

    Keyed on the authenticated id rather than the peer address: every student
    behind one campus NAT or dev proxy would otherwise share a single bucket,
    and a student switching networks would get a fresh budget each time.
    """
    scope: Any = getattr(request, "scope", None) or {}
    route = scope.get("route")
    path = getattr(route, "path", None) or "unknown"
    return f"student:{student_id}:{path}"
