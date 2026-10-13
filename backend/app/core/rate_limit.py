"""Small in-memory sliding-window rate limiter.

Fine for a single process. With several workers/instances, swap the store for Redis
(documented in README). Keyed by client IP + bucket name.
"""
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import TooManyRequests

_hits: dict[str, deque] = defaultdict(deque)


def reset_rate_limits() -> None:
    _hits.clear()


def rate_limit(bucket: str, limit: int, window_seconds: int):
    def dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        ip = request.client.host if request.client else "unknown"
        key = f"{bucket}:{ip}"
        now = time.monotonic()
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            raise TooManyRequests("Too many attempts. Please try again later.")
        q.append(now)

    return dependency
