from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.security.auth import (
    hash_password,
    verify_password,
)


# ============================================================
# GET STUDENT SETTINGS
# ============================================================

def get_student_settings(
    db: Session,
    student_id: int,
):

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

                sp.student_code,
                sp.faculty,
                sp.major,
                sp.cohort

            FROM users AS u

            LEFT JOIN student_profiles AS sp
                ON sp.student_id = u.id

            WHERE u.id = :student_id
              AND u.role = 'STUDENT'
              AND u.is_active = TRUE

            LIMIT 1
            """
        ),
        {
            "student_id": student_id,
        },
    ).mappings().first()


    if user is None:
        raise ValueError(
            "Không tìm thấy sinh viên."
        )


    preferences = db.execute(
        text(
            """
            SELECT
                report_deadline,
                lecturer_feedback,
                internship_status,
                email_notifications

            FROM notification_preferences

            WHERE user_id = :user_id

            LIMIT 1
            """
        ),
        {
            "user_id": student_id,
        },
    ).mappings().first()


    if preferences is None:
        preferences = {
            "report_deadline": True,
            "lecturer_feedback": True,
            "internship_status": True,
            "email_notifications": False,
        }


    return {

        "profile": {

            "id":
                user["id"],

            "fullName":
                user["full_name"],

            "studentCode":
                user["student_code"],

            "email":
                str(user["email"]),

            "phone":
                user["phone"],

            "faculty":
                user["faculty"],

            "major":
                user["major"],

            "cohort":
                user["cohort"],

            "hasAvatar":
                user["avatar_data"]
                is not None,
        },


        "account": {

            "email":
                str(user["email"]),


            "emailVerified":
                True,


            "canChangePassword":
                user["password_hash"]
                is not None,
        },


        "notifications": {

            "reportDeadline":
                preferences[
                    "report_deadline"
                ],


            "lecturerFeedback":
                preferences[
                    "lecturer_feedback"
                ],


            "internshipStatus":
                preferences[
                    "internship_status"
                ],


            "emailNotifications":
                preferences[
                    "email_notifications"
                ],
        },
    }



# ============================================================
# UPDATE PROFILE
# ============================================================

def update_student_profile(
    db: Session,
    student_id: int,
    full_name: str,
    phone: str | None,
    faculty: str | None,
    major: str | None,
    cohort: str | None,
):

    db.execute(
        text(
            """
            UPDATE users

            SET
                full_name = :full_name,
                phone = :phone,
                updated_at = NOW()

            WHERE id = :student_id
              AND role = 'STUDENT'
            """
        ),
        {
            "student_id":
                student_id,

            "full_name":
                full_name,

            "phone":
                phone,
        },
    )


    db.execute(
        text(
            """
            INSERT INTO student_profiles
            (
                student_id,
                faculty,
                major,
                cohort
            )

            VALUES
            (
                :student_id,
                :faculty,
                :major,
                :cohort
            )

            ON CONFLICT(student_id)

            DO UPDATE SET

                faculty =
                    EXCLUDED.faculty,

                major =
                    EXCLUDED.major,

                cohort =
                    EXCLUDED.cohort,

                updated_at =
                    NOW()
            """
        ),
        {
            "student_id":
                student_id,

            "faculty":
                faculty,

            "major":
                major,

            "cohort":
                cohort,
        },
    )


    db.commit()



# ============================================================
# AVATAR
# ============================================================

def save_avatar(
    db: Session,
    student_id: int,
    filename: str,
    mime_type: str,
    file_data: bytes,
):

    result = db.execute(
        text(
            """
            UPDATE users

            SET
                avatar_data = :avatar_data,

                avatar_mime_type = :mime_type,

                avatar_file_name = :filename,

                updated_at = NOW()

            WHERE id = :student_id

              AND role = 'STUDENT'

            RETURNING id
            """
        ),
        {
            "student_id":
                student_id,

            "avatar_data":
                file_data,

            "mime_type":
                mime_type,

            "filename":
                filename,
        },
    ).first()


    if result is None:
        raise ValueError(
            "Không tìm thấy sinh viên."
        )


    db.commit()



def get_avatar(
    db: Session,
    student_id: int,
):

    return db.execute(
        text(
            """
            SELECT
                avatar_data,
                avatar_mime_type,
                avatar_file_name

            FROM users

            WHERE id = :student_id

              AND role = 'STUDENT'

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().first()



def delete_avatar(
    db: Session,
    student_id: int,
):

    db.execute(
        text(
            """
            UPDATE users

            SET
                avatar_data = NULL,

                avatar_mime_type = NULL,

                avatar_file_name = NULL,

                updated_at = NOW()

            WHERE id = :student_id

              AND role = 'STUDENT'
            """
        ),
        {
            "student_id":
                student_id,
        },
    )


    db.commit()



# ============================================================
# PASSWORD
# ============================================================

def change_password(
    db: Session,
    student_id: int,
    current_password: str,
    new_password: str,
):

    user = db.execute(
        text(
            """
            SELECT
                password_hash

            FROM users

            WHERE id = :student_id

              AND role = 'STUDENT'

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().first()



    if user is None:
        raise ValueError(
            "Không tìm thấy tài khoản."
        )



    password_hash = user[
        "password_hash"
    ]



    if not password_hash:
        raise ValueError(
            "Tài khoản chưa có mật khẩu."
        )



    if not verify_password(
        current_password,
        password_hash,
    ):
        raise ValueError(
            "Mật khẩu hiện tại không chính xác."
        )



    if verify_password(
        new_password,
        password_hash,
    ):
        raise ValueError(
            "Mật khẩu mới phải khác mật khẩu hiện tại."
        )



    new_hash = hash_password(
        new_password
    )



    db.execute(
        text(
            """
            UPDATE users

            SET
                password_hash = :password_hash,

                updated_at = NOW()

            WHERE id = :student_id
            """
        ),
        {
            "student_id":
                student_id,

            "password_hash":
                new_hash,
        },
    )


    db.commit()



# ============================================================
# NOTIFICATIONS
# ============================================================

def update_notification_preferences(
    db: Session,
    student_id: int,
    report_deadline: bool,
    lecturer_feedback: bool,
    internship_status: bool,
    email_notifications: bool,
):

    db.execute(
        text(
            """
            INSERT INTO notification_preferences
            (
                user_id,
                report_deadline,
                lecturer_feedback,
                internship_status,
                email_notifications
            )

            VALUES
            (
                :user_id,
                :report_deadline,
                :lecturer_feedback,
                :internship_status,
                :email_notifications
            )

            ON CONFLICT(user_id)

            DO UPDATE SET

                report_deadline =
                    EXCLUDED.report_deadline,

                lecturer_feedback =
                    EXCLUDED.lecturer_feedback,

                internship_status =
                    EXCLUDED.internship_status,

                email_notifications =
                    EXCLUDED.email_notifications,

                updated_at =
                    NOW()
            """
        ),
        {
            "user_id":
                student_id,

            "report_deadline":
                report_deadline,

            "lecturer_feedback":
                lecturer_feedback,

            "internship_status":
                internship_status,

            "email_notifications":
                email_notifications,
        },
    )


    db.commit()