from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from src.api.admin_internships_routes import require_admin
from src.services.admin_internships_service import (
    AdminInternshipNotFoundError,
    assign_admin_internship,
    list_admin_internships,
)


class FakeResult:
    def __init__(
        self,
        *,
        first: Any = None,
        rows: list[Any] | None = None,
    ) -> None:
        self._first = first
        self._rows = rows or []

    def mappings(self) -> FakeResult:
        return self

    def first(self) -> Any:
        return self._first

    def all(self) -> list[Any]:
        return self._rows


class RecordingSession:
    def __init__(self, results: list[FakeResult]) -> None:
        self.results = list(results)
        self.statements: list[str] = []
        self.parameters: list[dict[str, Any]] = []
        self.commits = 0
        self.rollbacks = 0

    def execute(self, statement: Any, parameters: dict[str, Any] | None = None) -> FakeResult:
        self.statements.append(str(statement))
        self.parameters.append(parameters or {})
        return self.results.pop(0)

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


def test_admin_guard_rejects_non_admin_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 7, "role": "LECTURER"})

    assert exc_info.value.status_code == 403


def test_list_internships_includes_assignment_and_summary() -> None:
    application = {
        "application_id": 19,
        "student_id": 8,
        "student_name": "Nguyen Minh An",
        "student_code": "S0008",
        "class_name": "K20",
        "major": "Computer Science",
        "period_id": 3,
        "period_name": "Spring 2026",
        "company_name": "Internova",
        "internship_position": "AI Engineer Intern",
        "work_mode": "HYBRID",
        "status": "SUBMITTED",
        "submitted_at": None,
        "reviewed_at": None,
        "document_count": 2,
        "internship_id": None,
        "lecturer_id": None,
        "lecturer_name": None,
        "lecturer_code": None,
        "lecturer_faculty": None,
    }
    period = {
        "id": 3,
        "name": "Spring 2026",
        "semester_code": "SP26",
        "academic_year": "2025-2026",
    }
    lecturer = {
        "lecturer_id": 4,
        "lecturer_name": "TS. Nguyen Minh Anh",
        "lecturer_code": "GV004",
        "lecturer_faculty": "CECS",
    }
    db = RecordingSession(
        [
            FakeResult(rows=[application]),
            FakeResult(rows=[period]),
            FakeResult(rows=[lecturer]),
        ]
    )

    result = list_admin_internships(db)  # type: ignore[arg-type]

    assert result["summary"]["total"] == 1
    assert result["summary"]["submitted"] == 1
    assert result["summary"]["unassigned"] == 1
    assert result["applications"][0]["documentCount"] == 2
    assert result["lecturers"][0]["fullName"] == "TS. Nguyen Minh Anh"


def test_assignment_only_updates_reviewable_application() -> None:
    db = RecordingSession(
        [FakeResult(first={"id": 4}), FakeResult(first={"id": 19})]
    )

    result = assign_admin_internship(db, application_id=19, lecturer_id=4)  # type: ignore[arg-type]

    assert result["applicationId"] == 19
    assert db.commits == 1
    assert "status IN ('SUBMITTED', 'UNDER_REVIEW')" in db.statements[1]


def test_assignment_rejects_finalized_application() -> None:
    db = RecordingSession([FakeResult(first={"id": 4}), FakeResult(first=None)])

    with pytest.raises(AdminInternshipNotFoundError):
        assign_admin_internship(db, application_id=19, lecturer_id=4)  # type: ignore[arg-type]

    assert db.commits == 0
    assert db.rollbacks == 1
