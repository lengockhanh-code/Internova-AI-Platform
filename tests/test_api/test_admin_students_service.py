from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from src.api.admin_students_routes import require_admin
from src.models.admin_students import AdminStudentCreateRequest
from src.services import admin_students_service as service

STUDENT_ROW = {
    "id": 9,
    "full_name": "Nguyen Van An",
    "email": "an@external.edu",
    "phone": "0900000000",
    "gender": "MALE",
    "password_hash": "hashed-password",
    "is_active": True,
    "created_at": None,
    "updated_at": None,
    "student_code": "EXT001",
    "faculty": "Engineering",
    "major": "Computer Science",
    "cohort": "2026",
    "gpa": 8.5,
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


def test_external_student_accepts_non_vinuni_email() -> None:
    payload = AdminStudentCreateRequest(
        fullName="Nguyen Van An",
        email="an@external.edu",
        studentCode="ext001",
        studentType="EXTERNAL",
        password="temporary123",
    )

    assert payload.studentCode == "EXT001"
    assert str(payload.email) == "an@external.edu"


def test_internal_student_rejects_external_email() -> None:
    with pytest.raises(ValueError, match="@vinuni.edu.vn"):
        AdminStudentCreateRequest(
            fullName="Nguyen Van An",
            email="an@external.edu",
            studentCode="S001",
            studentType="INTERNAL",
            password="temporary123",
        )


def test_admin_guard_rejects_non_admin_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 2, "role": "STUDENT"})

    assert exc_info.value.status_code == 403


def test_admin_guard_accepts_admin_role() -> None:
    current_user = {"id": 1, "role": "ADMIN"}
    assert require_admin(current_user) == current_user


def test_create_student_hashes_password_and_creates_profile(monkeypatch) -> None:
    db = RecordingSession(
        [
            FakeResult(first=None),
            FakeResult(first={"id": 9}),
            FakeResult(),
            FakeResult(first=STUDENT_ROW),
        ]
    )
    monkeypatch.setattr(service, "hash_password", lambda value: f"hashed:{value}")

    student = service.create_admin_student(
        db,  # type: ignore[arg-type]
        {
            "fullName": "Nguyen Van An",
            "email": "an@external.edu",
            "phone": None,
            "gender": None,
            "studentCode": "EXT001",
            "faculty": "Engineering",
            "major": "Computer Science",
            "cohort": "2026",
            "gpa": 8.5,
            "studentType": "EXTERNAL",
            "password": "temporary123",
        },
    )

    assert student["studentType"] == "EXTERNAL"
    assert db.commits == 1
    assert any("INSERT INTO users" in sql for sql in db.statements)
    assert any("INSERT INTO student_profiles" in sql for sql in db.statements)
    assert db.parameters[1]["password_hash"] == "hashed:temporary123"
    assert "password" not in db.parameters[1]


def test_delete_student_is_non_destructive_deactivation() -> None:
    db = RecordingSession(
        [
            FakeResult(first=STUDENT_ROW),
            FakeResult(),
        ]
    )

    service.deactivate_admin_student(db, 9)  # type: ignore[arg-type]

    assert db.commits == 1
    assert any("SET is_active = FALSE" in sql for sql in db.statements)
    assert not any("DELETE FROM users" in sql for sql in db.statements)
