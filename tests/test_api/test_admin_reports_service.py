from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from src.api.admin_reports_routes import require_admin
from src.services import admin_reports_service as service
from src.services.lecturer_report_service import get_admin_reports


class FakeResult:
    def __init__(self, *, rows: list[Any] | None = None, first: Any = None) -> None:
        self._rows = rows or []
        self._first = first

    def mappings(self) -> FakeResult:
        return self

    def all(self) -> list[Any]:
        return self._rows

    def first(self) -> Any:
        return self._first


class RecordingSession:
    def __init__(self, results: list[FakeResult]) -> None:
        self.results = list(results)
        self.statements: list[str] = []
        self.parameters: list[dict[str, Any]] = []

    def execute(self, statement: Any, parameters: dict[str, Any] | None = None) -> FakeResult:
        self.statements.append(str(statement))
        self.parameters.append(parameters or {})
        return self.results.pop(0)


def test_admin_guard_rejects_non_admin_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 2, "role": "STUDENT"})

    assert exc_info.value.status_code == 403


def test_admin_report_query_has_no_lecturer_ownership_filter() -> None:
    db = RecordingSession([FakeResult(rows=[]), FakeResult(rows=[])])

    result = get_admin_reports(db)  # type: ignore[arg-type]

    assert result["reports"] == []
    assert db.parameters == [{"lecturer_id": None}, {"lecturer_id": None}]
    assert all(":lecturer_id IS NULL" in statement for statement in db.statements)


def test_list_admin_reports_adds_lecturer_and_aggregate_metrics(monkeypatch) -> None:
    report = {
        "reportId": 11,
        "internshipId": 5,
        "studentId": 8,
        "workflowStatus": "REVISION_REQUIRED",
        "lecturerScore": 8.5,
    }
    monkeypatch.setattr(
        service,
        "get_admin_reports",
        lambda db: {
            "summary": {
                "total": 1,
                "submitted": 1,
                "onTime": 1,
                "late": 0,
                "overdue": 0,
                "pendingReview": 0,
                "approved": 0,
            },
            "periods": [],
            "reports": [report],
        },
    )
    assignment = {
        "internship_id": 5,
        "lecturer_id": 3,
        "lecturer_name": "TS. Nguyen Minh Anh",
        "lecturer_code": "GV003",
        "lecturer_faculty": "CECS",
    }
    db = RecordingSession([FakeResult(rows=[assignment])])

    result = service.list_admin_reports(db)  # type: ignore[arg-type]

    assert result["summary"]["students"] == 1
    assert result["summary"]["revisionRequired"] == 1
    assert result["summary"]["averageScore"] == 8.5
    assert result["reports"][0]["assignedLecturer"]["id"] == 3


def test_admin_report_file_query_is_read_only() -> None:
    row = {
        "file_data": b"report",
        "file_name": "week-1.pdf",
        "mime_type": "application/pdf",
        "file_size": 6,
    }
    db = RecordingSession([FakeResult(first=row)])

    result = service.get_admin_report_file(db, 11)  # type: ignore[arg-type]

    assert result == row
    assert db.parameters[0] == {"report_id": 11}
    assert "SELECT file_data" in db.statements[0]
