from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from src.api.admin_lecturers_routes import require_admin
from src.middleware.admin_audit import describe_admin_action
from src.models.admin_lecturers import AdminLecturerCreateRequest
from src.services import admin_lecturers_service as service

LECTURER_ROW = {
    "id": 7,
    "full_name": "Nguyen Minh Anh",
    "email": "lecturer@vinuni.edu.vn",
    "phone": "0901000001",
    "gender": None,
    "avatar_url": None,
    "is_active": True,
    "auth_provider": "LOCAL",
    "password_hash": "hashed-password",
    "google_sub": None,
    "created_at": None,
    "updated_at": None,
    "lecturer_code": "GV001",
    "academic_title": "Tiến sĩ",
    "faculty": "College of Engineering and Computer Science",
    "specialization": "Artificial Intelligence",
    "assigned_students": 3,
    "active_internships": 2,
    "completed_internships": 1,
    "pending_reviews": 1,
    "last_assignment_at": None,
}


class FakeResult:
    def __init__(
        self,
        *,
        first: Any = None,
        rows: list[Any] | None = None,
        scalar: Any = None,
    ) -> None:
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


def test_lecturer_model_normalizes_code() -> None:
    payload = AdminLecturerCreateRequest(
        fullName="Nguyen Minh Anh",
        email="lecturer@vinuni.edu.vn",
        lecturerCode=" gv001 ",
        password="temporary123",
    )
    assert payload.lecturerCode == "GV001"


def test_admin_guard_rejects_non_admin() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 2, "role": "LECTURER"})
    assert exc_info.value.status_code == 403


def test_lecturer_writes_are_classified_for_audit_log() -> None:
    created = describe_admin_action("POST", "/api/v1/admin/lecturers")
    deactivated = describe_admin_action("DELETE", "/api/v1/admin/lecturers/7")

    assert created is not None and created.action == "LECTURER_CREATED"
    assert deactivated is not None and deactivated.action == "LECTURER_DEACTIVATED"
    assert deactivated.resource_id == "7"


def test_create_lecturer_hashes_password_and_creates_profile(monkeypatch) -> None:
    db = RecordingSession(
        [
            FakeResult(first=None),
            FakeResult(first=None),
            FakeResult(first={"id": 7}),
            FakeResult(),
            FakeResult(first=LECTURER_ROW),
        ]
    )
    monkeypatch.setattr(service, "hash_password", lambda value: f"hashed:{value}")

    lecturer = service.create_admin_lecturer(
        db,  # type: ignore[arg-type]
        {
            "fullName": "Nguyen Minh Anh",
            "email": "lecturer@vinuni.edu.vn",
            "phone": None,
            "gender": None,
            "lecturerCode": "gv001",
            "academicTitle": "Tiến sĩ",
            "faculty": "CECS",
            "specialization": "Artificial Intelligence",
            "password": "temporary123",
            "isActive": True,
        },
    )

    assert lecturer["lecturerCode"] == "GV001"
    assert lecturer["assignedStudents"] == 3
    assert db.commits == 1
    assert any("INSERT INTO public.users" in statement for statement in db.statements)
    assert any("INSERT INTO public.lecturer_profiles" in statement for statement in db.statements)
    user_insert = next(
        params
        for statement, params in zip(db.statements, db.parameters, strict=True)
        if "INSERT INTO public.users" in statement
    )
    assert user_insert["password_hash"] == "hashed:temporary123"
    assert "password" not in user_insert


def test_deactivate_lecturer_only_changes_account_status() -> None:
    inactive_row = {**LECTURER_ROW, "is_active": False}
    db = RecordingSession(
        [
            FakeResult(first=LECTURER_ROW),
            FakeResult(),
            FakeResult(first=inactive_row),
        ]
    )

    lecturer = service.deactivate_admin_lecturer(
        db,  # type: ignore[arg-type]
        lecturer_id=7,
    )

    assert lecturer["isActive"] is False
    assert db.commits == 1
    assert any("UPDATE public.users" in statement for statement in db.statements)
    assert not any("DELETE FROM" in statement for statement in db.statements)
