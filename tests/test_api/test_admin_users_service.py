from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from src.api.admin_users_routes import require_admin
from src.models.admin_users import AdminUserCreateRequest
from src.services import admin_users_service as service

ADMIN_ROW = {
    "id": 6,
    "full_name": "Internova Admin",
    "email": "admin@vinuni.edu.vn",
    "phone": None,
    "avatar_url": None,
    "role": "ADMIN",
    "is_active": True,
    "password_hash": "hashed-password",
    "created_at": None,
    "updated_at": None,
    "student_code": None,
    "student_faculty": None,
    "lecturer_code": None,
    "lecturer_faculty": None,
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


def test_user_model_requires_profile_code_for_student() -> None:
    with pytest.raises(ValueError, match="Mã định danh"):
        AdminUserCreateRequest(
            fullName="Nguyen Van An",
            email="an@vinuni.edu.vn",
            role="STUDENT",
            password="temporary123",
        )


def test_admin_guard_rejects_non_admin_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 2, "role": "LECTURER"})
    assert exc_info.value.status_code == 403


def test_current_admin_cannot_deactivate_own_account() -> None:
    db = RecordingSession([FakeResult(first=ADMIN_ROW)])

    with pytest.raises(service.AdminUserProtectedError, match="chính mình"):
        service.set_admin_user_status(
            db,  # type: ignore[arg-type]
            user_id=6,
            actor_id=6,
            is_active=False,
        )

    assert db.commits == 0
    assert not any("UPDATE public.users" in statement for statement in db.statements)


def test_last_active_admin_cannot_be_deactivated() -> None:
    db = RecordingSession(
        [
            FakeResult(first=ADMIN_ROW),
            FakeResult(rows=[{"id": 6, "is_active": True}]),
        ]
    )

    with pytest.raises(service.AdminUserProtectedError, match="ít nhất một"):
        service.set_admin_user_status(
            db,  # type: ignore[arg-type]
            user_id=6,
            actor_id=99,
            is_active=False,
        )

    assert db.commits == 0


def test_create_admin_hashes_password_without_creating_role_profile(monkeypatch) -> None:
    db = RecordingSession(
        [
            FakeResult(first=None),
            FakeResult(first={"id": 7}),
            FakeResult(first={**ADMIN_ROW, "id": 7, "email": "ops@vinuni.edu.vn"}),
        ]
    )
    monkeypatch.setattr(service, "hash_password", lambda value: f"hashed:{value}")

    user = service.create_admin_user(
        db,  # type: ignore[arg-type]
        {
            "fullName": "Operations Admin",
            "email": "ops@vinuni.edu.vn",
            "phone": None,
            "role": "ADMIN",
            "isActive": True,
            "identityCode": None,
            "faculty": None,
            "password": "temporary123",
        },
    )

    assert user["role"] == "ADMIN"
    assert db.commits == 1
    assert any("INSERT INTO public.users" in statement for statement in db.statements)
    assert not any("INSERT INTO public.student_profiles" in statement for statement in db.statements)
    assert not any("INSERT INTO public.lecturer_profiles" in statement for statement in db.statements)
    assert db.parameters[1]["password_hash"] == "hashed:temporary123"
    assert "password" not in db.parameters[1]
