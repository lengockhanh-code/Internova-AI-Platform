from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_lecturers import (
    AdminLecturerActionResponse,
    AdminLecturerCreateRequest,
    AdminLecturerResponse,
    AdminLecturersResponse,
    AdminLecturerStatusRequest,
    AdminLecturerUpdateRequest,
)
from src.security.auth import get_current_user
from src.services.admin_lecturers_service import (
    AdminLecturerConflictError,
    AdminLecturerNotFoundError,
    create_admin_lecturer,
    deactivate_admin_lecturer,
    list_admin_lecturers,
    set_admin_lecturer_status,
    update_admin_lecturer,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/lecturers",
    tags=["Admin Lecturers"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AdminLecturersResponse)
def list_lecturers(
    search: str | None = Query(default=None, max_length=150),
    status_filter: Literal["ACTIVE", "INACTIVE"] | None = Query(
        default=None,
        alias="status",
    ),
    faculty: str | None = Query(default=None, max_length=150),
    academic_title: str | None = Query(default=None, max_length=100),
    workload: Literal["AVAILABLE", "ASSIGNED", "HIGH"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
) -> AdminLecturersResponse:
    return AdminLecturersResponse(
        **list_admin_lecturers(
            db,
            search=search,
            status=status_filter,
            faculty=faculty,
            academic_title=academic_title,
            workload=workload,
            page=page,
            page_size=page_size,
        )
    )


@router.post("", response_model=AdminLecturerResponse, status_code=status.HTTP_201_CREATED)
def create_lecturer(
    payload: AdminLecturerCreateRequest,
    db: Session = Depends(get_db),
) -> AdminLecturerResponse:
    try:
        return AdminLecturerResponse(
            lecturer=create_admin_lecturer(db, payload.model_dump()),
            message="Đã thêm giảng viên thành công.",
        )
    except AdminLecturerConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/{lecturer_id}", response_model=AdminLecturerResponse)
def update_lecturer(
    lecturer_id: int,
    payload: AdminLecturerUpdateRequest,
    db: Session = Depends(get_db),
) -> AdminLecturerResponse:
    try:
        return AdminLecturerResponse(
            lecturer=update_admin_lecturer(db, lecturer_id, payload.model_dump()),
            message="Đã cập nhật thông tin giảng viên.",
        )
    except AdminLecturerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AdminLecturerConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/{lecturer_id}/status", response_model=AdminLecturerActionResponse)
def update_lecturer_status(
    lecturer_id: int,
    payload: AdminLecturerStatusRequest,
    db: Session = Depends(get_db),
) -> AdminLecturerActionResponse:
    try:
        return AdminLecturerActionResponse(
            lecturer=set_admin_lecturer_status(
                db,
                lecturer_id,
                is_active=payload.isActive,
            ),
            message=(
                "Đã kích hoạt lại tài khoản giảng viên."
                if payload.isActive
                else "Đã vô hiệu hóa tài khoản giảng viên."
            ),
        )
    except AdminLecturerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{lecturer_id}", response_model=AdminLecturerActionResponse)
def delete_lecturer(
    lecturer_id: int,
    db: Session = Depends(get_db),
) -> AdminLecturerActionResponse:
    try:
        return AdminLecturerActionResponse(
            lecturer=deactivate_admin_lecturer(db, lecturer_id),
            message="Đã vô hiệu hóa giảng viên và giữ nguyên dữ liệu liên quan.",
        )
    except AdminLecturerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
