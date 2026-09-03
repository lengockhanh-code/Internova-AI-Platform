from __future__ import annotations

import math
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.security.auth import hash_password


class AdminLecturerNotFoundError(ValueError):
    pass


class AdminLecturerConflictError(ValueError):
    pass


_LECTURER_SELECT = """
    SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.gender,
        u.avatar_url,
        u.is_active,
        u.auth_provider,
        u.password_hash,
        u.google_sub,
        u.created_at,
        u.updated_at,
        lp.lecturer_code,
        lp.academic_title,
        lp.faculty,
        lp.specialization,
        (
            SELECT COUNT(DISTINCT internships.student_id)
            FROM public.internships
            WHERE internships.lecturer_id = u.id
              AND internships.status <> 'CANCELLED'
        ) AS assigned_students,
        (
            SELECT COUNT(*)
            FROM public.internships
            WHERE internships.lecturer_id = u.id
              AND internships.status IN ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED')
        ) AS active_internships,
        (
            SELECT COUNT(*)
            FROM public.internships
            WHERE internships.lecturer_id = u.id
              AND internships.status = 'COMPLETED'
        ) AS completed_internships,
        (
            SELECT COUNT(*)
            FROM public.internship_applications
            WHERE internship_applications.assigned_lecturer_id = u.id
              AND internship_applications.status IN ('SUBMITTED', 'UNDER_REVIEW')
        ) AS pending_reviews,
        (
            SELECT MAX(internships.updated_at)
            FROM public.internships
            WHERE internships.lecturer_id = u.id
        ) AS last_assignment_at
    FROM public.users AS u
    LEFT JOIN public.lecturer_profiles AS lp ON lp.lecturer_id = u.id
"""


def _workload(assigned_students: int, active_internships: int) -> str:
    if assigned_students == 0 and active_internships == 0:
        return "AVAILABLE"
    if assigned_students >= 12 or active_internships >= 8:
        return "HIGH"
    return "ASSIGNED"


def _lecturer_item(row: Any) -> dict[str, Any]:
    value = dict(row)
    assigned_students = int(value.get("assigned_students") or 0)
    active_internships = int(value.get("active_internships") or 0)
    return {
        "id": int(value["id"]),
        "fullName": value.get("full_name") or "Giảng viên",
        "email": str(value.get("email") or ""),
        "phone": value.get("phone"),
        "gender": value.get("gender"),
        "avatarUrl": value.get("avatar_url"),
        "lecturerCode": value.get("lecturer_code") or f"GV-{value['id']}",
        "academicTitle": value.get("academic_title"),
        "faculty": value.get("faculty"),
        "specialization": value.get("specialization"),
        "isActive": bool(value.get("is_active")),
        "authProvider": str(value.get("auth_provider") or "LOCAL").upper(),
        "accountStatus": (
            "REGISTERED" if value.get("password_hash") or value.get("google_sub") else "PENDING"
        ),
        "assignedStudents": assigned_students,
        "activeInternships": active_internships,
        "completedInternships": int(value.get("completed_internships") or 0),
        "pendingReviews": int(value.get("pending_reviews") or 0),
        "workload": _workload(assigned_students, active_internships),
        "lastAssignmentAt": value.get("last_assignment_at"),
        "createdAt": value.get("created_at"),
        "updatedAt": value.get("updated_at"),
    }


def _get_lecturer_row(db: Session, lecturer_id: int, *, lock: bool = False) -> Any:
    suffix = " FOR UPDATE OF u" if lock else ""
    row = db.execute(
        text(
            f"""
            {_LECTURER_SELECT}
            WHERE u.id = :lecturer_id AND u.role = 'LECTURER'
            LIMIT 1{suffix}
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().first()
    if row is None:
        raise AdminLecturerNotFoundError("Không tìm thấy tài khoản giảng viên.")
    return row


def _conditions(
    *,
    search: str | None,
    status: str | None,
    faculty: str | None,
    academic_title: str | None,
    workload: str | None,
) -> tuple[list[str], dict[str, Any]]:
    conditions = ["u.role = 'LECTURER'"]
    params: dict[str, Any] = {}
    if search and search.strip():
        conditions.append(
            """(
                u.full_name ILIKE :search
                OR u.email::text ILIKE :search
                OR COALESCE(u.phone, '') ILIKE :search
                OR COALESCE(lp.lecturer_code, '') ILIKE :search
                OR COALESCE(lp.faculty, '') ILIKE :search
                OR COALESCE(lp.academic_title, '') ILIKE :search
                OR COALESCE(lp.specialization, '') ILIKE :search
            )"""
        )
        params["search"] = f"%{search.strip()}%"
    if status == "ACTIVE":
        conditions.append("u.is_active = TRUE")
    elif status == "INACTIVE":
        conditions.append("u.is_active = FALSE")
    if faculty:
        conditions.append("lp.faculty = :faculty")
        params["faculty"] = faculty
    if academic_title:
        conditions.append("lp.academic_title = :academic_title")
        params["academic_title"] = academic_title
    active_count = """(
        SELECT COUNT(*) FROM public.internships AS load_internships
        WHERE load_internships.lecturer_id = u.id
          AND load_internships.status IN ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED')
    )"""
    assigned_count = """(
        SELECT COUNT(DISTINCT load_internships.student_id)
        FROM public.internships AS load_internships
        WHERE load_internships.lecturer_id = u.id
          AND load_internships.status <> 'CANCELLED'
    )"""
    if workload == "AVAILABLE":
        conditions.extend([f"{active_count} = 0", f"{assigned_count} = 0"])
    elif workload == "HIGH":
        conditions.append(f"({active_count} >= 8 OR {assigned_count} >= 12)")
    elif workload == "ASSIGNED":
        conditions.append(f"({active_count} > 0 OR {assigned_count} > 0)")
        conditions.append(f"{active_count} < 8 AND {assigned_count} < 12")
    return conditions, params


def list_admin_lecturers(
    db: Session,
    *,
    search: str | None,
    status: str | None,
    faculty: str | None,
    academic_title: str | None,
    workload: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    conditions, params = _conditions(
        search=search,
        status=status,
        faculty=faculty,
        academic_title=academic_title,
        workload=workload,
    )
    where_sql = " AND ".join(conditions)
    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*)
                FROM public.users AS u
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
            {_LECTURER_SELECT}
            WHERE {where_sql}
            ORDER BY u.is_active DESC, pending_reviews DESC, u.full_name, u.id
            LIMIT :limit OFFSET :offset
            """
        ),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).mappings().all()
    summary_row = db.execute(
        text(
            """
            WITH lecturer_load AS (
                SELECT
                    u.id,
                    u.is_active,
                    (
                        SELECT COUNT(DISTINCT internships.student_id)
                        FROM public.internships
                        WHERE internships.lecturer_id = u.id
                          AND internships.status <> 'CANCELLED'
                    ) AS assigned_students,
                    (
                        SELECT COUNT(*)
                        FROM public.internships
                        WHERE internships.lecturer_id = u.id
                          AND internships.status IN ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED')
                    ) AS active_internships,
                    (
                        SELECT COUNT(*)
                        FROM public.internship_applications
                        WHERE internship_applications.assigned_lecturer_id = u.id
                          AND internship_applications.status IN ('SUBMITTED', 'UNDER_REVIEW')
                    ) AS pending_reviews
                FROM public.users AS u
                WHERE u.role = 'LECTURER'
            )
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_active) AS active,
                COUNT(*) FILTER (WHERE NOT is_active) AS inactive,
                COALESCE(SUM(assigned_students), 0) AS assigned_students,
                COALESCE(SUM(pending_reviews), 0) AS pending_reviews,
                COUNT(*) FILTER (
                    WHERE is_active
                      AND assigned_students = 0
                      AND active_internships = 0
                ) AS available,
                COUNT(*) FILTER (
                    WHERE is_active
                      AND (assigned_students > 0 OR active_internships > 0)
                      AND assigned_students < 12
                      AND active_internships < 8
                ) AS assigned,
                COUNT(*) FILTER (
                    WHERE is_active
                      AND (assigned_students >= 12 OR active_internships >= 8)
                ) AS high_workload,
                COALESCE(
                    ROUND(AVG(assigned_students) FILTER (WHERE is_active), 1),
                    0
                ) AS average_load
            FROM lecturer_load
            """
        )
    ).mappings().first()
    summary_value = dict(summary_row or {})
    filter_rows = db.execute(
        text(
            """
            SELECT
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT lp.faculty ORDER BY lp.faculty), NULL) AS faculties,
                ARRAY_REMOVE(
                    ARRAY_AGG(DISTINCT lp.academic_title ORDER BY lp.academic_title),
                    NULL
                ) AS academic_titles
            FROM public.users AS u
            JOIN public.lecturer_profiles AS lp ON lp.lecturer_id = u.id
            WHERE u.role = 'LECTURER'
            """
        )
    ).mappings().first()
    filter_value = dict(filter_rows or {})
    return {
        "items": [_lecturer_item(row) for row in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, math.ceil(total / page_size)),
        "summary": {
            "total": int(summary_value.get("total") or 0),
            "active": int(summary_value.get("active") or 0),
            "inactive": int(summary_value.get("inactive") or 0),
            "assignedStudents": int(summary_value.get("assigned_students") or 0),
            "pendingReviews": int(summary_value.get("pending_reviews") or 0),
            "available": int(summary_value.get("available") or 0),
            "assigned": int(summary_value.get("assigned") or 0),
            "highWorkload": int(summary_value.get("high_workload") or 0),
            "averageLoad": float(summary_value.get("average_load") or 0),
        },
        "filters": {
            "faculties": list(filter_value.get("faculties") or []),
            "academicTitles": list(filter_value.get("academic_titles") or []),
        },
    }


def _ensure_unique_lecturer(
    db: Session,
    *,
    email: str,
    lecturer_code: str,
    excluded_id: int | None = None,
) -> None:
    params: dict[str, Any] = {"email": email, "lecturer_code": lecturer_code}
    excluded = "" if excluded_id is None else "AND id <> :excluded_id"
    if excluded_id is not None:
        params["excluded_id"] = excluded_id
    email_owner = db.execute(
        text(f"SELECT id FROM public.users WHERE email = :email {excluded} LIMIT 1"),
        params,
    ).first()
    if email_owner is not None:
        raise AdminLecturerConflictError("Email đã được sử dụng bởi tài khoản khác.")
    profile_excluded = "" if excluded_id is None else "AND lecturer_id <> :excluded_id"
    code_owner = db.execute(
        text(
            f"""
            SELECT lecturer_id
            FROM public.lecturer_profiles
            WHERE lecturer_code = :lecturer_code {profile_excluded}
            LIMIT 1
            """
        ),
        params,
    ).first()
    if code_owner is not None:
        raise AdminLecturerConflictError("Mã giảng viên đã tồn tại.")


def create_admin_lecturer(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    email = str(payload["email"]).strip().lower()
    lecturer_code = str(payload["lecturerCode"]).strip().upper()
    _ensure_unique_lecturer(db, email=email, lecturer_code=lecturer_code)
    try:
        created = db.execute(
            text(
                """
                INSERT INTO public.users (
                    email, password_hash, full_name, phone, gender,
                    role, is_active, auth_provider, created_at, updated_at
                ) VALUES (
                    :email, :password_hash, :full_name, :phone, :gender,
                    'LECTURER', :is_active, 'LOCAL', NOW(), NOW()
                )
                RETURNING id
                """
            ),
            {
                "email": email,
                "password_hash": hash_password(str(payload["password"])),
                "full_name": payload["fullName"],
                "phone": payload.get("phone"),
                "gender": payload.get("gender"),
                "is_active": bool(payload.get("isActive", True)),
            },
        ).mappings().first()
        if created is None:
            raise RuntimeError("Không thể tạo tài khoản giảng viên.")
        lecturer_id = int(created["id"])
        db.execute(
            text(
                """
                INSERT INTO public.lecturer_profiles (
                    lecturer_id, lecturer_code, academic_title,
                    faculty, specialization, created_at, updated_at
                ) VALUES (
                    :lecturer_id, :lecturer_code, :academic_title,
                    :faculty, :specialization, NOW(), NOW()
                )
                """
            ),
            {
                "lecturer_id": lecturer_id,
                "lecturer_code": lecturer_code,
                "academic_title": payload.get("academicTitle"),
                "faculty": payload.get("faculty"),
                "specialization": payload.get("specialization"),
            },
        )
        db.commit()
        return _lecturer_item(_get_lecturer_row(db, lecturer_id))
    except IntegrityError as exc:
        db.rollback()
        raise AdminLecturerConflictError("Email hoặc mã giảng viên đã tồn tại.") from exc
    except Exception:
        db.rollback()
        raise


def update_admin_lecturer(
    db: Session,
    lecturer_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    _get_lecturer_row(db, lecturer_id, lock=True)
    email = str(payload["email"]).strip().lower()
    lecturer_code = str(payload["lecturerCode"]).strip().upper()
    _ensure_unique_lecturer(
        db,
        email=email,
        lecturer_code=lecturer_code,
        excluded_id=lecturer_id,
    )
    password_sql = ""
    params: dict[str, Any] = {
        "lecturer_id": lecturer_id,
        "email": email,
        "full_name": payload["fullName"],
        "phone": payload.get("phone"),
        "gender": payload.get("gender"),
        "is_active": bool(payload["isActive"]),
        "lecturer_code": lecturer_code,
        "academic_title": payload.get("academicTitle"),
        "faculty": payload.get("faculty"),
        "specialization": payload.get("specialization"),
    }
    if payload.get("newPassword"):
        password_sql = ", password_hash = :password_hash, auth_provider = 'LOCAL'"
        params["password_hash"] = hash_password(str(payload["newPassword"]))
    try:
        db.execute(
            text(
                f"""
                UPDATE public.users
                SET email = :email,
                    full_name = :full_name,
                    phone = :phone,
                    gender = :gender,
                    is_active = :is_active,
                    updated_at = NOW()
                    {password_sql}
                WHERE id = :lecturer_id AND role = 'LECTURER'
                """
            ),
            params,
        )
        db.execute(
            text(
                """
                INSERT INTO public.lecturer_profiles (
                    lecturer_id, lecturer_code, academic_title,
                    faculty, specialization, created_at, updated_at
                ) VALUES (
                    :lecturer_id, :lecturer_code, :academic_title,
                    :faculty, :specialization, NOW(), NOW()
                )
                ON CONFLICT (lecturer_id) DO UPDATE SET
                    lecturer_code = EXCLUDED.lecturer_code,
                    academic_title = EXCLUDED.academic_title,
                    faculty = EXCLUDED.faculty,
                    specialization = EXCLUDED.specialization,
                    updated_at = NOW()
                """
            ),
            params,
        )
        db.commit()
        return _lecturer_item(_get_lecturer_row(db, lecturer_id))
    except IntegrityError as exc:
        db.rollback()
        raise AdminLecturerConflictError("Email hoặc mã giảng viên đã tồn tại.") from exc
    except Exception:
        db.rollback()
        raise


def set_admin_lecturer_status(
    db: Session,
    lecturer_id: int,
    *,
    is_active: bool,
) -> dict[str, Any]:
    _get_lecturer_row(db, lecturer_id, lock=True)
    db.execute(
        text(
            """
            UPDATE public.users
            SET is_active = :is_active, updated_at = NOW()
            WHERE id = :lecturer_id AND role = 'LECTURER'
            """
        ),
        {"lecturer_id": lecturer_id, "is_active": is_active},
    )
    db.commit()
    return _lecturer_item(_get_lecturer_row(db, lecturer_id))


def deactivate_admin_lecturer(db: Session, lecturer_id: int) -> dict[str, Any]:
    return set_admin_lecturer_status(db, lecturer_id, is_active=False)
