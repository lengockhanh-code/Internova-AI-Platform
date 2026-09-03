from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import HTTPException

from src.api.admin_audit_logs_routes import require_admin
from src.middleware.admin_audit import describe_admin_action
from src.services import admin_audit_logs_service as service


class FakeResult:
    def __init__(self, *, first: Any = None, rows: list[Any] | None = None, scalar: Any = None) -> None:
        self._first = first
        self._rows = rows or []
        self._scalar = scalar

    def mappings(self) -> FakeResult:
        return self

    def first(self) -> Any:
        return self._first

    def all(self) -> list[Any]:
        return self._rows

    def scalar(self) -> Any:
        return self._scalar


class RecordingSession:
    def __init__(self, results: list[FakeResult]) -> None:
        self.results = list(results)
        self.statements: list[str] = []
        self.parameters: list[dict[str, Any]] = []

    def execute(self, statement: Any, parameters: dict[str, Any] | None = None) -> FakeResult:
        self.statements.append(str(statement))
        self.parameters.append(parameters or {})
        return self.results.pop(0)


def test_admin_guard_rejects_non_admin() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 2, "role": "LECTURER"})
    assert exc_info.value.status_code == 403


def test_middleware_classifies_sensitive_admin_changes() -> None:
    user_action = describe_admin_action("PATCH", "/api/v1/admin/system/users/42/status")
    delete_action = describe_admin_action("DELETE", "/api/v1/admin/knowledge/documents/9")
    assert user_action is not None
    assert user_action.action == "USER_STATUS_CHANGED"
    assert user_action.resource_id == "42"
    assert user_action.severity == "HIGH"
    assert delete_action is not None
    assert delete_action.action == "DOCUMENT_DELETED"
    assert delete_action.severity == "HIGH"
    assert describe_admin_action("GET", "/api/v1/admin/system/users") is None


def test_csv_cells_cannot_execute_spreadsheet_formulas() -> None:
    assert service._csv_safe("=HYPERLINK('https://example.com')").startswith("'")
    assert service._csv_safe("Internova Admin") == "Internova Admin"


def test_list_audit_logs_maps_summary_and_metadata() -> None:
    now = datetime.now(UTC)
    row = {
        "id": 1,
        "event_id": "3f706f6f-a2f1-4be3-8fb4-b97906fd4a4e",
        "request_id": "request-1",
        "actor_id": 6,
        "actor_name": "Internova Admin",
        "actor_email": "admin@vinuni.edu.vn",
        "actor_role": "ADMIN",
        "action": "USER_UPDATED",
        "category": "ACCOUNT",
        "resource_type": "USER",
        "resource_id": "7",
        "resource_label": "Tài khoản #7",
        "outcome": "SUCCESS",
        "severity": "HIGH",
        "http_method": "PATCH",
        "request_path": "/api/v1/admin/system/users/7",
        "http_status": 200,
        "ip_address": "127.0.0.1",
        "user_agent": "pytest",
        "detail": "Cập nhật tài khoản và vai trò",
        "metadata": {"query": {}},
        "duration_ms": 18,
        "created_at": now,
    }
    db = RecordingSession(
        [
            FakeResult(scalar=1),
            FakeResult(rows=[row]),
            FakeResult(first={"total": 1, "success": 1, "failed": 0, "high_risk": 1, "active_actors": 1}),
            FakeResult(rows=[{"day": now.date(), "success": 1, "failed": 0}]),
            FakeResult(rows=[{"category": "ACCOUNT", "count": 1}]),
            FakeResult(rows=[{"actor_id": 6, "actor_name": "Internova Admin", "actor_email": "admin@vinuni.edu.vn"}]),
        ]
    )
    result = service.list_admin_audit_logs(
        db,  # type: ignore[arg-type]
        search=None,
        category=None,
        outcome=None,
        severity=None,
        actor_id=None,
        time_range="7d",
        page=1,
        page_size=20,
    )
    assert result["items"][0]["eventId"] == row["event_id"]
    assert result["items"][0]["metadata"] == {"query": {}}
    assert result["summary"]["successRate"] == 100
    assert result["categories"][0]["value"] == "ACCOUNT"
