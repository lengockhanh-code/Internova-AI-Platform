from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_students import (
    AdminStudentActionResponse,
    AdminStudentCreateRequest,
    AdminStudentResponse,
    AdminStudentsResponse,
    AdminStudentUpdateRequest,
)
from src.security.auth import get_current_user
from src.services.admin_students_service import (
    AdminStudentConflictError,
    AdminStudentNotFoundError,
    create_admin_student,
    deactivate_admin_student,
    list_admin_students,
    update_admin_student,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/students",
    tags=["Admin Students"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AdminStudentsResponse)
def list_students(
    search: str | None = Query(default=None, max_length=150),
    status_filter: Literal["ACTIVE", "INACTIVE"] | None = Query(
        default=None,
        alias="status",
    ),
    student_type: Literal["INTERNAL", "EXTERNAL"] | None = Query(default=None),
    faculty: str | None = Query(default=None, max_length=150),
    cohort: str | None = Query(default=None, max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> AdminStudentsResponse:
    return AdminStudentsResponse(
        **list_admin_students(
            db,
            search=search,
            status=status_filter,
            student_type=student_type,
            faculty=faculty,
            cohort=cohort,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    response_model=AdminStudentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_student(
    payload: AdminStudentCreateRequest,
    db: Session = Depends(get_db),
) -> AdminStudentResponse:
    try:
        student = create_admin_student(db, payload.model_dump())
        return AdminStudentResponse(
            student=student,
            message="Đã thêm sinh viên thành công.",
        )
    except AdminStudentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/{student_id}", response_model=AdminStudentResponse)
def update_student(
    student_id: int,
    payload: AdminStudentUpdateRequest,
    db: Session = Depends(get_db),
) -> AdminStudentResponse:
    try:
        student = update_admin_student(db, student_id, payload.model_dump())
        return AdminStudentResponse(
            student=student,
            message="Đã cập nhật sinh viên thành công.",
        )
    except AdminStudentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AdminStudentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/{student_id}", response_model=AdminStudentActionResponse)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
) -> AdminStudentActionResponse:
    try:
        deactivate_admin_student(db, student_id)
        return AdminStudentActionResponse(
            studentId=student_id,
            message="Đã vô hiệu hóa tài khoản sinh viên.",
        )
    except AdminStudentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
