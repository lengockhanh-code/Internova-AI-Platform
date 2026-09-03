from __future__ import annotations

import math
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.security.auth import hash_password


class AdminUserNotFoundError(ValueError):
    pass


class AdminUserConflictError(ValueError):
    pass


class AdminUserProtectedError(ValueError):
    pass


def _user_item(row: Any) -> dict[str, Any]:
    value = dict(row)
    role = str(value.get("role") or "STUDENT").upper()
    if role == "STUDENT":
        identity_code = value.get("student_code")
        faculty = value.get("student_faculty")
    elif role == "LECTURER":
        identity_code = value.get("lecturer_code")
        faculty = value.get("lecturer_faculty")
    else:
        identity_code = None
        faculty = None

    registered = bool(value.get("password_hash") or value.get("google_sub"))
    return {
        "id": int(value["id"]),
        "fullName": value.get("full_name") or "Người dùng",
        "email": str(value.get("email") or ""),
        "phone": value.get("phone"),
        "avatarUrl": value.get("avatar_url"),
        "role": role,
        "isActive": bool(value.get("is_active")),
        "authProvider": str(value.get("auth_provider") or "LOCAL").upper(),
        "accountStatus": "REGISTERED" if registered else "PENDING",
        "identityCode": identity_code,
        "faculty": faculty,
        "createdAt": value.get("created_at"),
        "updatedAt": value.get("updated_at"),
    }


_USER_SELECT = """
    SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.avatar_url,
        u.role,
        u.is_active,
        u.auth_provider,
        u.password_hash,
        u.google_sub,
        u.created_at,
        u.updated_at,
        sp.student_code,
        sp.faculty AS student_faculty,
        lp.lecturer_code,
        lp.faculty AS lecturer_faculty
    FROM public.users AS u
    LEFT JOIN public.student_profiles AS sp ON sp.student_id = u.id
    LEFT JOIN public.lecturer_profiles AS lp ON lp.lecturer_id = u.id
"""


def _get_user_row(db: Session, user_id: int) -> Any:
    row = db.execute(
        text(f"{_USER_SELECT} WHERE u.id = :user_id LIMIT 1"),
        {"user_id": user_id},
    ).mappings().first()
    if row is None:
        raise AdminUserNotFoundError("Không tìm thấy tài khoản người dùng.")
    return row


def list_admin_users(
    db: Session,
    *,
    current_user_id: int,
    search: str | None,
    role: str | None,
    status: str | None,
    auth_provider: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    conditions = ["TRUE"]
    params: dict[str, Any] = {}

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        conditions.append(
            """(
                u.full_name ILIKE :search
                OR u.email::text ILIKE :search
                OR COALESCE(u.phone, '') ILIKE :search
                OR COALESCE(sp.student_code, '') ILIKE :search
                OR COALESCE(lp.lecturer_code, '') ILIKE :search
                OR COALESCE(sp.faculty, '') ILIKE :search
                OR COALESCE(lp.faculty, '') ILIKE :search
            )"""
        )
    if role in {"STUDENT", "LECTURER", "ADMIN"}:
        conditions.append("u.role = :role")
        params["role"] = role
    if status == "ACTIVE":
        conditions.append("u.is_active = TRUE")
    elif status == "INACTIVE":
        conditions.append("u.is_active = FALSE")
    if auth_provider in {"LOCAL", "GOOGLE"}:
        conditions.append("u.auth_provider = :auth_provider")
        params["auth_provider"] = auth_provider

    where_sql = " AND ".join(conditions)
    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*)
                FROM public.users AS u
                LEFT JOIN public.student_profiles AS sp ON sp.student_id = u.id
                LEFT JOIN public.lecturer_profiles AS lp ON lp.lecturer_id = u.id
                WHERE {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    rows = db.execute(
        text(
            f"""
            {_USER_SELECT}
            WHERE {where_sql}
            ORDER BY u.created_at DESC, u.id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            **params,
            "limit": page_size,
            "offset": (page - 1) * page_size,
        },
    ).mappings().all()

    summary_row = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_active = TRUE) AS active,
                COUNT(*) FILTER (WHERE is_active = FALSE) AS inactive,
                COUNT(*) FILTER (WHERE role = 'STUDENT') AS students,
                COUNT(*) FILTER (WHERE role = 'LECTURER') AS lecturers,
                COUNT(*) FILTER (WHERE role = 'ADMIN') AS admins,
                COUNT(*) FILTER (
                    WHERE password_hash IS NULL AND google_sub IS NULL
                ) AS pending
            FROM public.users
            """
        )
    ).mappings().first()
    summary = dict(summary_row or {})

    return {
        "items": [_user_item(row) for row in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, math.ceil(total / page_size)),
        "currentUserId": current_user_id,
        "summary": {
            key: int(summary.get(key) or 0)
            for key in (
                "total",
                "active",
                "inactive",
                "students",
                "lecturers",
                "admins",
                "pending",
            )
        },
    }


def _ensure_unique_identity(
    db: Session,
    *,
    email: str,
    role: str,
    identity_code: str | None,
    excluded_id: int | None = None,
) -> None:
    params: dict[str, Any] = {"email": email}
    excluded = "" if excluded_id is None else "AND id <> :excluded_id"
    if excluded_id is not None:
        params["excluded_id"] = excluded_id

    if db.execute(
        text(f"SELECT id FROM public.users WHERE email = :email {excluded} LIMIT 1"),
        params,
    ).mappings().first() is not None:
        raise AdminUserConflictError("Email đã được sử dụng.")

    if role not in {"STUDENT", "LECTURER"} or not identity_code:
        return

    profile_table = "student_profiles" if role == "STUDENT" else "lecturer_profiles"
    owner_column = "student_id" if role == "STUDENT" else "lecturer_id"
    code_column = "student_code" if role == "STUDENT" else "lecturer_code"
    profile_params: dict[str, Any] = {"identity_code": identity_code}
    profile_excluded = ""
    if excluded_id is not None:
        profile_excluded = f"AND {owner_column} <> :excluded_id"
        profile_params["excluded_id"] = excluded_id

    if db.execute(
        text(
            f"""
            SELECT {owner_column}
            FROM public.{profile_table}
            WHERE {code_column} = :identity_code {profile_excluded}
            LIMIT 1
            """
        ),
        profile_params,
    ).mappings().first() is not None:
        raise AdminUserConflictError("Mã định danh đã được sử dụng.")


def _protect_admin_change(
    db: Session,
    *,
    target_id: int,
    actor_id: int,
    current_role: str,
    next_role: str,
    next_active: bool,
) -> None:
    removes_admin_access = next_role != "ADMIN" or not next_active
    if current_role != "ADMIN" or not removes_admin_access:
        return
    if target_id == actor_id:
        raise AdminUserProtectedError(
            "Bạn không thể tự hạ quyền hoặc vô hiệu hóa tài khoản của chính mình."
        )

    admin_rows = db.execute(
        text(
            """
            SELECT id, is_active
            FROM public.users
            WHERE role = 'ADMIN'
            FOR UPDATE
            """
        )
    ).mappings().all()
    remaining_active = sum(
        1
        for row in admin_rows
        if int(row["id"]) != target_id and bool(row["is_active"])
    )
    if remaining_active == 0:
        raise AdminUserProtectedError(
            "Hệ thống phải luôn còn ít nhất một tài khoản Admin hoạt động."
        )


def _upsert_role_profile(
    db: Session,
    *,
    user_id: int,
    role: str,
    identity_code: str | None,
    faculty: str | None,
) -> None:
    if role == "STUDENT":
        db.execute(
            text(
                """
                INSERT INTO public.student_profiles (student_id, student_code, faculty)
                VALUES (:user_id, :identity_code, :faculty)
                ON CONFLICT (student_id) DO UPDATE SET
                    student_code = EXCLUDED.student_code,
                    faculty = EXCLUDED.faculty,
                    updated_at = NOW()
                """
            ),
            {"user_id": user_id, "identity_code": identity_code, "faculty": faculty},
        )
    elif role == "LECTURER":
        db.execute(
            text(
                """
                INSERT INTO public.lecturer_profiles (lecturer_id, lecturer_code, faculty)
                VALUES (:user_id, :identity_code, :faculty)
                ON CONFLICT (lecturer_id) DO UPDATE SET
                    lecturer_code = EXCLUDED.lecturer_code,
                    faculty = EXCLUDED.faculty,
                    updated_at = NOW()
                """
            ),
            {"user_id": user_id, "identity_code": identity_code, "faculty": faculty},
        )


def create_admin_user(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    email = str(payload["email"]).strip().lower()
    role = str(payload["role"]).upper()
    identity_code = str(payload.get("identityCode") or "").strip().upper() or None
    _ensure_unique_identity(
        db,
        email=email,
        role=role,
        identity_code=identity_code,
    )

    try:
        created = db.execute(
            text(
                """
                INSERT INTO public.users (
                    email, password_hash, full_name, phone, role, is_active, auth_provider
                )
                VALUES (
                    :email, :password_hash, :full_name, :phone, :role, :is_active, 'LOCAL'
                )
                RETURNING id
                """
            ),
            {
                "email": email,
                "password_hash": hash_password(payload["password"]),
                "full_name": str(payload["fullName"]).strip(),
                "phone": payload.get("phone"),
                "role": role,
                "is_active": bool(payload.get("isActive", True)),
            },
        ).mappings().first()
        if created is None:
            raise RuntimeError("Không thể tạo tài khoản.")

        user_id = int(created["id"])
        _upsert_role_profile(
            db,
            user_id=user_id,
            role=role,
            identity_code=identity_code,
            faculty=payload.get("faculty"),
        )
        db.commit()
        return _user_item(_get_user_row(db, user_id))
    except IntegrityError as exc:
        db.rollback()
        raise AdminUserConflictError("Email hoặc mã định danh đã tồn tại.") from exc
    except Exception:
        db.rollback()
        raise


def update_admin_user(
    db: Session,
    user_id: int,
    actor_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    current = _get_user_row(db, user_id)
    role = str(payload["role"]).upper()
    is_active = bool(payload["isActive"])
    identity_code = str(payload.get("identityCode") or "").strip().upper() or None
    email = str(payload["email"]).strip().lower()

    _protect_admin_change(
        db,
        target_id=user_id,
        actor_id=actor_id,
        current_role=str(current["role"]),
        next_role=role,
        next_active=is_active,
    )
    _ensure_unique_identity(
        db,
        email=email,
        role=role,
        identity_code=identity_code,
        excluded_id=user_id,
    )

    try:
        db.execute(
            text(
                """
                UPDATE public.users
                SET
                    email = :email,
                    full_name = :full_name,
                    phone = :phone,
                    role = :role,
                    is_active = :is_active,
                    updated_at = NOW()
                WHERE id = :user_id
                """
            ),
            {
                "user_id": user_id,
                "email": email,
                "full_name": str(payload["fullName"]).strip(),
                "phone": payload.get("phone"),
                "role": role,
                "is_active": is_active,
            },
        )
        _upsert_role_profile(
            db,
            user_id=user_id,
            role=role,
            identity_code=identity_code,
            faculty=payload.get("faculty"),
        )
        db.commit()
        return _user_item(_get_user_row(db, user_id))
    except IntegrityError as exc:
        db.rollback()
        raise AdminUserConflictError("Email hoặc mã định danh đã tồn tại.") from exc
    except Exception:
        db.rollback()
        raise


def set_admin_user_status(
    db: Session,
    user_id: int,
    actor_id: int,
    is_active: bool,
) -> dict[str, Any]:
    current = _get_user_row(db, user_id)
    role = str(current["role"])
    _protect_admin_change(
        db,
        target_id=user_id,
        actor_id=actor_id,
        current_role=role,
        next_role=role,
        next_active=is_active,
    )

    try:
        db.execute(
            text(
                """
                UPDATE public.users
                SET is_active = :is_active, updated_at = NOW()
                WHERE id = :user_id
                """
            ),
            {"user_id": user_id, "is_active": is_active},
        )
        db.commit()
        return _user_item(_get_user_row(db, user_id))
    except Exception:
        db.rollback()
        raise
