from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import httpx

from src.observability.config import get_observability_settings


class LangfuseAPIError(RuntimeError):
    pass


class LangfuseRateLimitError(LangfuseAPIError):
    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


def _parse_retry_after(response: httpx.Response, body: str) -> int | None:
    retry_after_header = response.headers.get("retry-after")
    if retry_after_header:
        try:
            return max(1, int(float(retry_after_header)))
        except ValueError:
            pass

    try:
        payload = json.loads(body)
    except ValueError:
        return None

    details = payload.get("details") if isinstance(payload, dict) else None
    retry_after = details.get("retryAfterSeconds") if isinstance(details, dict) else None
    try:
        return max(1, int(float(retry_after)))
    except (TypeError, ValueError):
        return None


class LangfuseAPI:
    """Small read-only client for Langfuse Public API v2/v3.

    We use HTTP directly so the admin dashboard is independent of generated
    SDK response model changes. Credentials never leave the backend.
    """

    def __init__(self) -> None:
        self.settings = get_observability_settings()

    def _check(self) -> None:
        if not self.settings.configured:
            raise LangfuseAPIError(
                "Langfuse is not configured. Set LANGFUSE_PUBLIC_KEY, "
                "LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL."
            )

    def _get(self, path: str, *, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._check()
        try:
            response = httpx.get(
                f"{self.settings.base_url}{path}",
                params=params,
                auth=(self.settings.public_key, self.settings.secret_key),
                timeout=30.0,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else {"data": payload}
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500]
            status_code = exc.response.status_code

            if status_code == 429:
                retry_after = _parse_retry_after(exc.response, body)
                raise LangfuseRateLimitError(
                    "Langfuse rate limit exceeded. Showing cached data if available.",
                    retry_after_seconds=retry_after,
                ) from exc

            raise LangfuseAPIError(
                f"Langfuse API returned HTTP {status_code}: {body}"
            ) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise LangfuseAPIError(f"Langfuse API request failed: {exc}") from exc

    @staticmethod
    def _iso(value: datetime) -> str:
        return value.isoformat().replace("+00:00", "Z")

    def health(self) -> dict[str, Any]:
        payload = self._get("/api/public/projects")
        return {"ok": True, "projects": len(payload.get("data", [])) if isinstance(payload.get("data"), list) else None}

    def observations(
        self,
        *,
        start: datetime,
        end: datetime,
        trace_id: str | None = None,
        max_rows: int | None = None,
    ) -> tuple[list[dict[str, Any]], bool]:
        max_rows = max_rows or self.settings.max_observations
        rows: list[dict[str, Any]] = []
        cursor: str | None = None
        truncated = False

        while len(rows) < max_rows:
            limit = min(1000, max_rows - len(rows))
            params: dict[str, Any] = {
                "fromStartTime": self._iso(start),
                "toStartTime": self._iso(end),
                "fields": "core,basic,time,io,metadata,model,usage,metrics,trace_context",
                "limit": limit,
            }
            if cursor:
                params["cursor"] = cursor
            if trace_id:
                params["traceId"] = trace_id

            payload = self._get("/api/public/v2/observations", params=params)
            batch = payload.get("data", [])
            if isinstance(batch, list):
                rows.extend(item for item in batch if isinstance(item, dict))

            meta = payload.get("meta", {}) if isinstance(payload.get("meta"), dict) else {}
            cursor = meta.get("cursor") or meta.get("nextCursor") or payload.get("nextCursor")
            if not cursor or not batch:
                break

        if cursor and len(rows) >= max_rows:
            truncated = True
        return rows[:max_rows], truncated

    def scores(
        self,
        *,
        start: datetime,
        end: datetime,
        names: list[str] | None = None,
        max_rows: int = 5000,
    ) -> tuple[list[dict[str, Any]], bool]:
        rows: list[dict[str, Any]] = []
        cursor: str | None = None
        truncated = False
        while len(rows) < max_rows:
            params: dict[str, Any] = {
                "fromTimestamp": self._iso(start),
                "toTimestamp": self._iso(end),
                "limit": min(100, max_rows - len(rows)),
                "fields": "subject,details",
            }
            if names:
                params["name"] = ",".join(names)
            if cursor:
                params["cursor"] = cursor

            payload = self._get("/api/public/v3/scores", params=params)
            batch = payload.get("data", [])
            if isinstance(batch, list):
                rows.extend(item for item in batch if isinstance(item, dict))
            meta = payload.get("meta", {}) if isinstance(payload.get("meta"), dict) else {}
            cursor = meta.get("cursor") or meta.get("nextCursor") or payload.get("nextCursor")
            if not cursor or not batch:
                break
        if cursor and len(rows) >= max_rows:
            truncated = True
        return rows[:max_rows], truncated

    def metrics(self, query: dict[str, Any]) -> list[dict[str, Any]]:
        payload = self._get(
            "/api/public/v2/metrics",
            params={"query": json.dumps(query, separators=(",", ":"))},
        )
        data = payload.get("data", [])
        return [row for row in data if isinstance(row, dict)] if isinstance(data, list) else []
