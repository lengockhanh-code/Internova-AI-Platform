from __future__ import annotations

import math
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.security.auth import hash_password


class AdminStudentNotFoundError(ValueError):
    pass


class AdminStudentConflictError(ValueError):
    pass


def _student_item(row: Any) -> dict[str, Any]:
    value = dict(row)
    email = str(value.get("email") or "")
    return {
        "id": int(value["id"]),
        "fullName": value.get("full_name") or "Sinh viên",
        "email": email,
        "phone": value.get("phone"),
        "gender": value.get("gender"),
        "studentCode": value.get("student_code") or "",
        "faculty": value.get("faculty"),
        "major": value.get("major"),
        "cohort": value.get("cohort"),
        "gpa": float(value["gpa"]) if value.get("gpa") is not None else None,
        "studentType": (
            "INTERNAL" if email.lower().endswith("@vinuni.edu.vn") else "EXTERNAL"
        ),
        "accountStatus": (
            "REGISTERED" if value.get("password_hash") else "PENDING"
        ),
        "isActive": bool(value.get("is_active")),
        "createdAt": value.get("created_at"),
        "updatedAt": value.get("updated_at"),
    }


def _get_student_row(db: Session, student_id: int) -> Any:
    row = db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                u.gender,
                u.password_hash,
                u.is_active,
                u.created_at,
                u.updated_at,
                sp.student_code,
                sp.faculty,
                sp.major,
                sp.cohort,
                sp.gpa
            FROM users AS u
            INNER JOIN student_profiles AS sp ON sp.student_id = u.id
            WHERE u.id = :student_id
              AND u.role = 'STUDENT'
            LIMIT 1
            """
        ),
        {"student_id": student_id},
    ).mappings().first()

    if row is None:
        raise AdminStudentNotFoundError("Không tìm thấy sinh viên.")
    return row


def list_admin_students(
    db: Session,
    *,
    search: str | None,
    status: str | None,
    student_type: str | None,
    faculty: str | None,
    cohort: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    conditions = ["u.role = 'STUDENT'"]
    params: dict[str, Any] = {}

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        conditions.append(
            """(
                u.full_name ILIKE :search
                OR u.email::text ILIKE :search
                OR sp.student_code ILIKE :search
                OR COALESCE(sp.faculty, '') ILIKE :search
                OR COALESCE(sp.major, '') ILIKE :search
                OR COALESCE(sp.cohort, '') ILIKE :search
            )"""
        )

    if status == "ACTIVE":
        conditions.append("u.is_active = TRUE")
    elif status == "INACTIVE":
        conditions.append("u.is_active = FALSE")

    if student_type == "INTERNAL":
        conditions.append("u.email::text ILIKE '%@vinuni.edu.vn'")
    elif student_type == "EXTERNAL":
        conditions.append("u.email::text NOT ILIKE '%@vinuni.edu.vn'")

    if faculty:
        conditions.append("sp.faculty = :faculty")
        params["faculty"] = faculty
    if cohort:
        conditions.append("sp.cohort = :cohort")
        params["cohort"] = cohort

    where_sql = " AND ".join(conditions)
    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*)
                FROM users AS u
                INNER JOIN student_profiles AS sp ON sp.student_id = u.id
                WHERE {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    offset = (page - 1) * page_size
    rows = db.execute(
        text(
            f"""
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                u.gender,
                u.password_hash,
                u.is_active,
                u.created_at,
                u.updated_at,
                sp.student_code,
                sp.faculty,
                sp.major,
                sp.cohort,
                sp.gpa
            FROM users AS u
            INNER JOIN student_profiles AS sp ON sp.student_id = u.id
            WHERE {where_sql}
            ORDER BY u.created_at DESC, u.id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {**params, "limit": page_size, "offset": offset},
    ).mappings().all()

    summary_row = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE u.is_active = TRUE) AS active,
                COUNT(*) FILTER (WHERE u.is_active = FALSE) AS inactive,
                COUNT(*) FILTER (
                    WHERE u.email::text NOT ILIKE '%@vinuni.edu.vn'
                ) AS external
            FROM users AS u
            WHERE u.role = 'STUDENT'
            """
        )
    ).mappings().first()

    filter_rows = db.execute(
        text(
            """
            SELECT DISTINCT faculty, cohort
            FROM student_profiles
            ORDER BY faculty NULLS LAST, cohort NULLS LAST
            """
        )
    ).mappings().all()

    faculties = sorted({str(row["faculty"]) for row in filter_rows if row["faculty"]})
    cohorts = sorted({str(row["cohort"]) for row in filter_rows if row["cohort"]})
    summary = dict(summary_row or {})

    return {
        "items": [_student_item(row) for row in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, math.ceil(total / page_size)),
        "summary": {
            "total": int(summary.get("total") or 0),
            "active": int(summary.get("active") or 0),
            "inactive": int(summary.get("inactive") or 0),
            "external": int(summary.get("external") or 0),
        },
        "filters": {"faculties": faculties, "cohorts": cohorts},
    }


def _ensure_unique_student(
    db: Session,
    *,
    email: str,
    student_code: str,
    excluded_id: int | None = None,
) -> None:
    excluded_condition = "" if excluded_id is None else "AND u.id <> :excluded_id"
    params: dict[str, Any] = {
        "email": email,
        "student_code": student_code,
    }
    if excluded_id is not None:
        params["excluded_id"] = excluded_id

    row = db.execute(
        text(
            f"""
            SELECT u.id, u.email, sp.student_code
            FROM users AS u
            LEFT JOIN student_profiles AS sp ON sp.student_id = u.id
            WHERE (
                u.email = :email
                OR sp.student_code = :student_code
            )
              {excluded_condition}
            LIMIT 1
            """
        ),
        params,
    ).mappings().first()

    if row is None:
        return
    if str(row.get("email") or "").lower() == email.lower():
        raise AdminStudentConflictError("Email đã được sử dụng.")
    raise AdminStudentConflictError("Mã sinh viên đã tồn tại.")


def create_admin_student(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    email = str(payload["email"]).strip().lower()
    student_code = str(payload["studentCode"]).strip().upper()
    _ensure_unique_student(db, email=email, student_code=student_code)

    try:
        user = db.execute(
            text(
                """
                INSERT INTO users (
                    email,
                    password_hash,
                    full_name,
                    phone,
                    gender,
                    role,
                    is_active
                )
                VALUES (
                    :email,
                    :password_hash,
                    :full_name,
                    :phone,
                    :gender,
                    'STUDENT',
                    TRUE
                )
                RETURNING id
                """
            ),
            {
                "email": email,
                "password_hash": hash_password(payload["password"]),
                "full_name": payload["fullName"].strip(),
                "phone": payload.get("phone"),
                "gender": payload.get("gender"),
            },
        ).mappings().first()
        if user is None:
            raise RuntimeError("Không thể tạo tài khoản sinh viên.")

        student_id = int(user["id"])
        db.execute(
            text(
                """
                INSERT INTO student_profiles (
                    student_id,
                    student_code,
                    faculty,
                    major,
                    cohort,
                    gpa
                )
                VALUES (
                    :student_id,
                    :student_code,
                    :faculty,
                    :major,
                    :cohort,
                    :gpa
                )
                """
            ),
            {
                "student_id": student_id,
                "student_code": student_code,
                "faculty": payload.get("faculty"),
                "major": payload.get("major"),
                "cohort": payload.get("cohort"),
                "gpa": payload.get("gpa"),
            },
        )
        db.commit()
        return _student_item(_get_student_row(db, student_id))
    except IntegrityError as exc:
        db.rollback()
        raise AdminStudentConflictError(
            "Email hoặc mã sinh viên đã tồn tại."
        ) from exc
    except Exception:
        db.rollback()
        raise


def update_admin_student(
    db: Session,
    student_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    _get_student_row(db, student_id)
    email = str(payload["email"]).strip().lower()
    student_code = str(payload["studentCode"]).strip().upper()
    _ensure_unique_student(
        db,
        email=email,
        student_code=student_code,
        excluded_id=student_id,
    )

    new_password = payload.get("newPassword")
    try:
        db.execute(
            text(
                """
                UPDATE users
                SET
                    email = :email,
                    full_name = :full_name,
                    phone = :phone,
                    gender = :gender,
                    is_active = :is_active,
                    password_hash = COALESCE(:password_hash, password_hash),
                    updated_at = NOW()
                WHERE id = :student_id
                  AND role = 'STUDENT'
                """
            ),
            {
                "student_id": student_id,
                "email": email,
                "full_name": payload["fullName"].strip(),
                "phone": payload.get("phone"),
                "gender": payload.get("gender"),
                "is_active": bool(payload["isActive"]),
                "password_hash": hash_password(new_password) if new_password else None,
            },
        )
        db.execute(
            text(
                """
                UPDATE student_profiles
                SET
                    student_code = :student_code,
                    faculty = :faculty,
                    major = :major,
                    cohort = :cohort,
                    gpa = :gpa,
                    updated_at = NOW()
                WHERE student_id = :student_id
                """
            ),
            {
                "student_id": student_id,
                "student_code": student_code,
                "faculty": payload.get("faculty"),
                "major": payload.get("major"),
                "cohort": payload.get("cohort"),
                "gpa": payload.get("gpa"),
            },
        )
        db.commit()
        return _student_item(_get_student_row(db, student_id))
    except IntegrityError as exc:
        db.rollback()
        raise AdminStudentConflictError(
            "Email hoặc mã sinh viên đã tồn tại."
        ) from exc
    except Exception:
        db.rollback()
        raise


def deactivate_admin_student(db: Session, student_id: int) -> None:
    _get_student_row(db, student_id)
    try:
        db.execute(
            text(
                """
                UPDATE users
                SET is_active = FALSE, updated_at = NOW()
                WHERE id = :student_id
                  AND role = 'STUDENT'
                """
            ),
            {"student_id": student_id},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
