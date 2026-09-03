from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_users import (
    AdminUserCreateRequest,
    AdminUserResponse,
    AdminUsersResponse,
    AdminUserStatusRequest,
    AdminUserUpdateRequest,
)
from src.security.auth import get_current_user
from src.services.admin_users_service import (
    AdminUserConflictError,
    AdminUserNotFoundError,
    AdminUserProtectedError,
    create_admin_user,
    list_admin_users,
    set_admin_user_status,
    update_admin_user,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/system/users",
    tags=["Admin Users"],
)


@router.get("", response_model=AdminUsersResponse)
def list_users(
    search: str | None = Query(default=None, max_length=150),
    role: Literal["STUDENT", "LECTURER", "ADMIN"] | None = Query(default=None),
    status_filter: Literal["ACTIVE", "INACTIVE"] | None = Query(default=None, alias="status"),
    auth_provider: Literal["LOCAL", "GOOGLE"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUsersResponse:
    return AdminUsersResponse(
        **list_admin_users(
            db,
            current_user_id=int(current_user["id"]),
            search=search,
            role=role,
            status=status_filter,
            auth_provider=auth_provider,
            page=page,
            page_size=page_size,
        )
    )


@router.post("", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreateRequest,
    _current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    try:
        return AdminUserResponse(
            user=create_admin_user(db, payload.model_dump()),
            message="Đã tạo tài khoản thành công.",
        )
    except AdminUserConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    try:
        return AdminUserResponse(
            user=update_admin_user(
                db,
                user_id=user_id,
                actor_id=int(current_user["id"]),
                payload=payload.model_dump(),
            ),
            message="Đã cập nhật tài khoản và vai trò.",
        )
    except AdminUserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AdminUserConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AdminUserProtectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{user_id}/status", response_model=AdminUserResponse)
def update_user_status(
    user_id: int,
    payload: AdminUserStatusRequest,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    try:
        user = set_admin_user_status(
            db,
            user_id=user_id,
            actor_id=int(current_user["id"]),
            is_active=payload.isActive,
        )
        return AdminUserResponse(
            user=user,
            message=(
                "Đã kích hoạt lại tài khoản."
                if payload.isActive
                else "Đã vô hiệu hóa tài khoản."
            ),
        )
    except AdminUserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AdminUserProtectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
