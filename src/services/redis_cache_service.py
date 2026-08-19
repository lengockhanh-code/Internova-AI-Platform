from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Iterator

import redis
from redis import Redis
from redis.exceptions import RedisError

from src.config import get_settings


logger = logging.getLogger(__name__)

CACHE_SCHEMA_VERSION = "internova-cache-v1"


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    remaining: int
    retry_after_seconds: int
    current: int
    limit: int
    fail_open: bool = False


class RedisCache:
    """Shared Redis cache/coordination layer.

    Redis is non-critical infrastructure here:
    - cache errors fail open;
    - rate-limit errors fail open;
    - lock errors fall back to normal computation.

    This means a Redis outage should degrade performance, not break the chatbot.
    """

    _RATE_LIMIT_SCRIPT = """
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    local ttl = redis.call('TTL', KEYS[1])
    return {current, ttl}
    """

    _RELEASE_LOCK_SCRIPT = """
    if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
    end
    return 0
    """

    def __init__(self) -> None:
        self._client: Redis | None = None
        self._client_lock = Lock()
        self._unavailable_until = 0.0

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def _get_client(self) -> Redis | None:
        settings = get_settings()

        if not settings.redis_enabled:
            return None

        # Small circuit breaker: when Redis is down, do not pay a socket
        # timeout on every cache layer for every request.
        if time.monotonic() < self._unavailable_until:
            return None

        if self._client is not None:
            return self._client

        with self._client_lock:
            if self._client is not None:
                return self._client

            try:
                self._client = redis.Redis.from_url(
                    settings.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=settings.redis_connect_timeout_seconds,
                    socket_timeout=settings.redis_socket_timeout_seconds,
                    health_check_interval=30,
                )
            except Exception as exc:
                logger.warning(
                    "Redis client initialization failed; cache disabled for now: %s",
                    exc,
                )
                self._client = None

        return self._client

    def _mark_unavailable(self) -> None:
        settings = get_settings()
        self._unavailable_until = (
            time.monotonic()
            + settings.redis_failure_cooldown_seconds
        )

    def ping(self) -> bool:
        client = self._get_client()
        if client is None:
            return False

        try:
            return bool(client.ping())
        except RedisError as exc:
            self._mark_unavailable()
            logger.warning("Redis PING failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Cache keys
    # ------------------------------------------------------------------

    @staticmethod
    def normalize_query(value: str) -> str:
        return " ".join((value or "").casefold().split())

    def make_key(
        self,
        namespace: str,
        payload: dict[str, Any],
    ) -> str:
        settings = get_settings()

        canonical = json.dumps(
            {
                "schema": CACHE_SCHEMA_VERSION,
                **payload,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )

        digest = hashlib.sha256(
            canonical.encode("utf-8")
        ).hexdigest()

        prefix = settings.redis_key_prefix.rstrip(":")

        return f"{prefix}:{namespace}:{digest}"

    # ------------------------------------------------------------------
    # JSON cache
    # ------------------------------------------------------------------

    def get_json_by_key(
        self,
        key: str,
    ) -> dict[str, Any] | None:
        client = self._get_client()
        if client is None:
            return None

        try:
            raw = client.get(key)
            if not raw:
                return None

            value = json.loads(raw)
            if isinstance(value, dict):
                return value

            logger.warning(
                "Redis cache value was not an object: key=%s",
                key,
            )
            return None

        except RedisError as exc:
            self._mark_unavailable()
            logger.warning(
                "Redis cache GET failed; treating as miss: %s",
                exc,
            )
            return None
        except json.JSONDecodeError as exc:
            logger.warning(
                "Redis cache contained invalid JSON; treating as miss: %s",
                exc,
            )
            return None

    def get_json(
        self,
        namespace: str,
        payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        return self.get_json_by_key(
            self.make_key(namespace, payload)
        )

    def set_json_by_key(
        self,
        key: str,
        value: dict[str, Any],
        ttl_seconds: int,
    ) -> bool:
        if ttl_seconds <= 0:
            return False

        client = self._get_client()
        if client is None:
            return False

        try:
            client.set(
                key,
                json.dumps(
                    value,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    default=str,
                ),
                ex=ttl_seconds,
            )
            return True

        except RedisError as exc:
            self._mark_unavailable()
            logger.warning(
                "Redis cache SET failed; continuing without cache: %s",
                exc,
            )
            return False

    def set_json(
        self,
        namespace: str,
        payload: dict[str, Any],
        value: dict[str, Any],
        ttl_seconds: int,
    ) -> bool:
        return self.set_json_by_key(
            self.make_key(namespace, payload),
            value,
            ttl_seconds,
        )

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------

    def check_rate_limit(
        self,
        subject: str,
        limit: int,
        window_seconds: int = 60,
    ) -> RateLimitDecision:
        """Atomic fixed-window rate limiter.

        Fails open when Redis is unavailable so cache infrastructure cannot
        accidentally take the chatbot offline.
        """
        if limit <= 0 or window_seconds <= 0:
            return RateLimitDecision(
                allowed=True,
                remaining=max(0, limit),
                retry_after_seconds=0,
                current=0,
                limit=limit,
            )

        client = self._get_client()
        if client is None:
            return RateLimitDecision(
                allowed=True,
                remaining=limit,
                retry_after_seconds=0,
                current=0,
                limit=limit,
                fail_open=True,
            )

        settings = get_settings()
        prefix = settings.redis_key_prefix.rstrip(":")
        bucket = int(time.time() // window_seconds)
        key = f"{prefix}:rate:chat:{subject}:{bucket}"

        try:
            result = client.eval(
                self._RATE_LIMIT_SCRIPT,
                1,
                key,
                window_seconds,
            )

            current = int(result[0])
            ttl = int(result[1])

            return RateLimitDecision(
                allowed=current <= limit,
                remaining=max(0, limit - current),
                retry_after_seconds=max(1, ttl) if current > limit else 0,
                current=current,
                limit=limit,
            )

        except RedisError as exc:
            self._mark_unavailable()
            logger.warning(
                "Redis rate-limit check failed; failing open: %s",
                exc,
            )
            return RateLimitDecision(
                allowed=True,
                remaining=limit,
                retry_after_seconds=0,
                current=0,
                limit=limit,
                fail_open=True,
            )
        except (TypeError, ValueError) as exc:
            logger.warning(
                "Redis rate-limit response was invalid; failing open: %s",
                exc,
            )
            return RateLimitDecision(
                allowed=True,
                remaining=limit,
                retry_after_seconds=0,
                current=0,
                limit=limit,
                fail_open=True,
            )

    # ------------------------------------------------------------------
    # Distributed single-flight lock
    # ------------------------------------------------------------------

    @contextmanager
    def lock(
        self,
        key: str,
        ttl_seconds: int,
        wait_seconds: float,
        poll_interval_seconds: float = 0.08,
    ) -> Iterator[bool]:
        """Acquire a token-owned Redis lock.

        Yields:
            True  -> lock acquired by this process.
            False -> Redis unavailable or lock could not be acquired in time.

        The release script checks the token before deleting the lock so one
        worker cannot accidentally release another worker's lock.
        """
        client = self._get_client()

        if client is None or ttl_seconds <= 0:
            yield False
            return

        token = uuid.uuid4().hex
        deadline = time.monotonic() + max(0.0, wait_seconds)
        acquired = False

        try:
            while True:
                try:
                    acquired = bool(
                        client.set(
                            key,
                            token,
                            nx=True,
                            px=max(1, int(ttl_seconds * 1000)),
                        )
                    )
                except RedisError as exc:
                    self._mark_unavailable()
                    logger.warning(
                        "Redis lock acquisition failed; continuing without lock: %s",
                        exc,
                    )
                    acquired = False
                    break

                if acquired:
                    break

                if time.monotonic() >= deadline:
                    break

                time.sleep(
                    max(0.02, poll_interval_seconds)
                )

            yield acquired

        finally:
            if acquired:
                try:
                  client.eval(
                     self._RELEASE_LOCK_SCRIPT,
                     1,
                     key,
                     token,
                 )

                except RedisError as exc:
                 self._mark_unavailable()

                 logger.warning(
                     "Redis lock release failed: %s",
                     exc,
                 )

def fingerprint_paths(
    paths: list[Path],
) -> str:
    """Build a stable cache-version fingerprint from index artifacts.

    Result/retrieval caches automatically miss after BM25/index_manifest is
    rebuilt because size/mtime changes.
    """
    parts: list[str] = []

    for raw_path in paths:
        path = Path(raw_path)

        try:
            stat = path.stat()
            parts.append(
                f"{path.name}:{stat.st_size}:{stat.st_mtime_ns}"
            )
        except OSError:
            parts.append(
                f"{path.name}:missing"
            )

    raw = "|".join(parts)
    return hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()[:20]


redis_cache = RedisCache()