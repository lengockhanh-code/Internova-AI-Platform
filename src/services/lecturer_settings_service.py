from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.security.auth import hash_password, verify_password


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def get_lecturer_settings(db: Session, lecturer_id: int) -> dict:
    user = db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                u.password_hash,
                
                u.avatar_data,
                lp.lecturer_code,
                lp.academic_title,
                lp.faculty,
                lp.specialization
            FROM public.users AS u
            LEFT JOIN public.lecturer_profiles AS lp
                ON lp.lecturer_id = u.id
            WHERE u.id = :lecturer_id
              AND u.role = 'LECTURER'
              AND u.is_active = TRUE
            LIMIT 1
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().first()

    if user is None:
        raise ValueError("Không tìm thấy tài khoản giảng viên.")

    preferences = db.execute(
        text(
            """
            SELECT
                report_deadline,
                lecturer_feedback,
                internship_status,
                email_notifications
            FROM public.notification_preferences
            WHERE user_id = :lecturer_id
            LIMIT 1
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().first()

    return {
        "profile": {
            "id": int(user["id"]),
            "fullName": user["full_name"],
            "lecturerCode": user["lecturer_code"],
            "email": str(user["email"]),
            "phone": user["phone"],
            "academicTitle": user["academic_title"],
            "faculty": user["faculty"],
            "specialization": user["specialization"],
            "hasAvatar": user["avatar_data"] is not None,
        },
        "account": {
            "email": str(user["email"]),
            
            "canChangePassword": user["password_hash"] is not None,
        },
        "notifications": {
            "reportDeadline": preferences["report_deadline"] if preferences else True,
            "studentMessages": preferences["lecturer_feedback"] if preferences else True,
            "internshipStatus": preferences["internship_status"] if preferences else True,
            "emailNotifications": preferences["email_notifications"] if preferences else False,
        },
    }


def update_lecturer_profile(
    db: Session,
    lecturer_id: int,
    *,
    full_name: str,
    phone: str | None,
    lecturer_code: str | None,
    academic_title: str | None,
    faculty: str | None,
    specialization: str | None,
) -> None:
    normalized_code = _clean(lecturer_code)
    if normalized_code:
        duplicate = db.execute(
            text(
                """
                SELECT 1
                FROM public.lecturer_profiles
                WHERE lecturer_code = :lecturer_code
                  AND lecturer_id <> :lecturer_id
                LIMIT 1
                """
            ),
            {"lecturer_code": normalized_code, "lecturer_id": lecturer_id},
        ).first()
        if duplicate:
            raise ValueError("Mã giảng viên đã được sử dụng.")

    updated = db.execute(
        text(
            """
            UPDATE public.users
            SET full_name = :full_name,
                phone = :phone,
                updated_at = NOW()
            WHERE id = :lecturer_id
              AND role = 'LECTURER'
              AND is_active = TRUE
            RETURNING id
            """
        ),
        {
            "lecturer_id": lecturer_id,
            "full_name": full_name.strip(),
            "phone": _clean(phone),
        },
    ).first()
    if updated is None:
        db.rollback()
        raise ValueError("Không tìm thấy tài khoản giảng viên.")

    db.execute(
        text(
            """
            INSERT INTO public.lecturer_profiles (
                lecturer_id,
                lecturer_code,
                academic_title,
                faculty,
                specialization
            ) VALUES (
                :lecturer_id,
                :lecturer_code,
                :academic_title,
                :faculty,
                :specialization
            )
            ON CONFLICT (lecturer_id) DO UPDATE SET
                lecturer_code = EXCLUDED.lecturer_code,
                academic_title = EXCLUDED.academic_title,
                faculty = EXCLUDED.faculty,
                specialization = EXCLUDED.specialization,
                updated_at = NOW()
            """
        ),
        {
            "lecturer_id": lecturer_id,
            "lecturer_code": normalized_code,
            "academic_title": _clean(academic_title),
            "faculty": _clean(faculty),
            "specialization": _clean(specialization),
        },
    )
    db.commit()


def save_lecturer_avatar(
    db: Session,
    lecturer_id: int,
    *,
    filename: str,
    mime_type: str,
    file_data: bytes,
) -> None:
    result = db.execute(
        text(
            """
            UPDATE public.users
            SET avatar_data = :file_data,
                avatar_mime_type = :mime_type,
                avatar_file_name = :filename,
                updated_at = NOW()
            WHERE id = :lecturer_id
              AND role = 'LECTURER'
            RETURNING id
            """
        ),
        {
            "lecturer_id": lecturer_id,
            "file_data": file_data,
            "mime_type": mime_type,
            "filename": filename,
        },
    ).first()
    if result is None:
        db.rollback()
        raise ValueError("Không tìm thấy tài khoản giảng viên.")
    db.commit()


def get_lecturer_avatar(db: Session, lecturer_id: int):
    return db.execute(
        text(
            """
            SELECT avatar_data, avatar_mime_type, avatar_file_name
            FROM public.users
            WHERE id = :lecturer_id
              AND role = 'LECTURER'
            LIMIT 1
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().first()


def delete_lecturer_avatar(db: Session, lecturer_id: int) -> None:
    db.execute(
        text(
            """
            UPDATE public.users
            SET avatar_data = NULL,
                avatar_mime_type = NULL,
                avatar_file_name = NULL,
                updated_at = NOW()
            WHERE id = :lecturer_id
              AND role = 'LECTURER'
            """
        ),
        {"lecturer_id": lecturer_id},
    )
    db.commit()


def change_lecturer_password(
    db: Session,
    lecturer_id: int,
    *,
    current_password: str,
    new_password: str,
) -> None:
    user = db.execute(
        text(
            """
            SELECT password_hash
            FROM public.users
            WHERE id = :lecturer_id
              AND role = 'LECTURER'
              AND is_active = TRUE
            LIMIT 1
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().first()

    if user is None or user["password_hash"] is None:
        raise ValueError("Tài khoản này không hỗ trợ đổi mật khẩu trực tiếp.")
    if not verify_password(current_password, user["password_hash"]):
        raise ValueError("Mật khẩu hiện tại không đúng.")
    if current_password == new_password:
        raise ValueError("Mật khẩu mới phải khác mật khẩu hiện tại.")

    db.execute(
        text(
            """
            UPDATE public.users
            SET password_hash = :password_hash,
                updated_at = NOW()
            WHERE id = :lecturer_id
            """
        ),
        {"lecturer_id": lecturer_id, "password_hash": hash_password(new_password)},
    )
    db.commit()


def update_lecturer_notifications(
    db: Session,
    lecturer_id: int,
    *,
    report_deadline: bool,
    student_messages: bool,
    internship_status: bool,
    email_notifications: bool,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO public.notification_preferences (
                user_id,
                report_deadline,
                lecturer_feedback,
                internship_status,
                email_notifications
            ) VALUES (
                :lecturer_id,
                :report_deadline,
                :student_messages,
                :internship_status,
                :email_notifications
            )
            ON CONFLICT (user_id) DO UPDATE SET
                report_deadline = EXCLUDED.report_deadline,
                lecturer_feedback = EXCLUDED.lecturer_feedback,
                internship_status = EXCLUDED.internship_status,
                email_notifications = EXCLUDED.email_notifications,
                updated_at = NOW()
            """
        ),
        {
            "lecturer_id": lecturer_id,
            "report_deadline": report_deadline,
            "student_messages": student_messages,
            "internship_status": internship_status,
            "email_notifications": email_notifications,
        },
    )
    db.commit()
