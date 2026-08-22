from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.security.auth import (
    create_access_token,
    hash_password,
    verify_password,
)

# ============================================================
# EXCEPTIONS
# ============================================================


class EmailAlreadyExistsError(Exception):
    pass


class StudentCodeAlreadyExistsError(Exception):
    pass


class StudentCodeNotFoundError(Exception):
    pass


class InvalidVinuniEmailError(Exception):
    pass

class InvalidCredentialsError(Exception):
    pass
# ============================================================
# HELPERS
# ============================================================


VINUNI_EMAIL_DOMAIN = "vinuni.edu.vn"


def normalize_vinuni_email(email: str) -> str:
    normalized_email = email.strip().lower()

    local_part, separator, domain = normalized_email.rpartition("@")

    if (
        separator != "@"
        or not local_part
        or domain != VINUNI_EMAIL_DOMAIN
    ):
        raise InvalidVinuniEmailError(
            "Email phải có định dạng ten_tai_khoan@vinuni.edu.vn."
        )

    return normalized_email

# ============================================================
# RESPONSE BUILDER
# ============================================================


def build_auth_response(user) -> dict:
    token = create_access_token(
        user_id=user["id"],
        role=user["role"],
    )

    return {
        "accessToken": token,
        "tokenType": "bearer",
        "user": {
            "id": user["id"],
            "email": str(user["email"]),
            "fullName": user["full_name"],
            "role": user["role"],
            "avatarUrl": user["avatar_url"],
        },
    }


# ============================================================
# REGISTER STUDENT
#
# IMPORTANT:
# - Student data already exists before registration.
# - student_profiles.student_id already points to users.id.
# - password_hash IS NULL => student has NOT activated an account.
# - password_hash IS NOT NULL => account has already been activated.
# - Registration DOES NOT INSERT a new users/student_profiles row.
# ============================================================


def register_user(
    db: Session,
    first_name: str,
    last_name: str,
    student_code: str,
    gender: str | None,
    email: str,
    password: str,
):
    normalized_email = normalize_vinuni_email(
        email
    )

    normalized_student_code = (
        student_code
        .strip()
        .upper()
    )

    try:
        # --------------------------------------------------------
        # 1. Find the student that was pre-inserted by the school.
        #
        # FOR UPDATE locks this student's users row during signup,
        # preventing two registration requests from activating the
        # same student at the same time.
        # --------------------------------------------------------

        student = db.execute(
            text(
                """
                SELECT
                    u.id,
                    u.email,
                    u.full_name,
                    u.avatar_url,
                    u.role,
                    u.password_hash,
                    u.is_active,
                    sp.student_code
                FROM student_profiles AS sp
                JOIN users AS u
                    ON u.id = sp.student_id
                WHERE UPPER(sp.student_code) = :student_code
                  AND u.role = 'STUDENT'
                LIMIT 1
                FOR UPDATE OF u
                """
            ),
            {
                "student_code":
                    normalized_student_code,
            },
        ).mappings().first()

        # Student code is not part of the preloaded school data.
        if student is None:
            raise StudentCodeNotFoundError(
                "Mã số sinh viên không tồn tại trong hệ thống."
            )

        # The student's account has already been activated.
        if student["password_hash"]:
            raise StudentCodeAlreadyExistsError(
                "Sinh viên này đã có tài khoản."
            )

        if not student["is_active"]:
            raise InvalidCredentialsError(
                "Tài khoản sinh viên đang bị khóa."
            )

        # --------------------------------------------------------
        # 2. The requested VinUni email must not belong to another
        # account.
        #
        # Exclude this student's own preloaded users.id because the
        # seed data may already contain the same email.
        # --------------------------------------------------------

        email_owner = db.execute(
            text(
                """
                SELECT id
                FROM users
                WHERE email = :email
                  AND id <> :student_id
                LIMIT 1
                """
            ),
            {
                "email":
                    normalized_email,

                "student_id":
                    student["id"],
            },
        ).first()

        if email_owner:
            raise EmailAlreadyExistsError(
                "Email này đã được sử dụng bởi tài khoản khác."
            )

        # --------------------------------------------------------
        # 3. Activate the EXISTING user.
        #
        # No INSERT is performed.
        # full_name is intentionally kept from the preloaded school
        # data instead of trusting a public registration form.
        # --------------------------------------------------------

        password_hash = hash_password(
            password
        )

        user = db.execute(
            text(
                """
                UPDATE users
                SET
                    email = :email,
                    password_hash = :password_hash,
                    gender = :gender,
                    updated_at = NOW()
                WHERE id = :student_id
                  AND password_hash IS NULL
                RETURNING
                    id,
                    email,
                    full_name,
                    avatar_url,
                    role
                """
            ),
            {
                "email":
                    normalized_email,

                "password_hash":
                    password_hash,

                "gender":
                    gender,

                "student_id":
                    student["id"],
            },
        ).mappings().first()

        # Defensive check for concurrent activation.
        if user is None:
            raise StudentCodeAlreadyExistsError(
                "Sinh viên này đã có tài khoản."
            )

        db.commit()

        return build_auth_response(
            user
        )

    except Exception:
        db.rollback()
        raise


# ============================================================
# LOGIN
# Backend reads the REAL role from users.
# Public login defaults to student/lecturer; admin login must request ADMIN.
# ============================================================


def login_user(
    db: Session,
    email: str,
    password: str,
    requested_role: str | None = None,
):
    normalized_email = (
        email.strip().lower()
    )

    user = db.execute(
        text(
            """
            SELECT
                id,
                email,
                full_name,
                avatar_url,
                role,
                password_hash,
                is_active
            FROM users
            WHERE email = :email
            LIMIT 1
            """
        ),
        {
            "email":
                normalized_email,
        },
    ).mappings().first()

    if user is None:
        raise InvalidCredentialsError(
            "Email hoặc mật khẩu không đúng."
        )

    if requested_role == "ADMIN":
        allowed_roles = ("ADMIN",)
        role_error = "Tài khoản này không được phép đăng nhập tại cổng quản trị."
    else:
        allowed_roles = (
            "STUDENT",
            "LECTURER",
        )
        role_error = "Tài khoản này không được phép đăng nhập tại cổng sinh viên/giảng viên."

    if user["role"] not in allowed_roles:
        raise InvalidCredentialsError(
            role_error
        )
    if not user["is_active"]:
        raise InvalidCredentialsError(
            "Tài khoản đã bị khóa."
        )

    if not user["password_hash"]:
        raise InvalidCredentialsError(
            "Tài khoản chưa được đăng ký. Vui lòng đăng ký trước."
        )

    if not verify_password(
        password,
        user["password_hash"],
    ):
        raise InvalidCredentialsError(
            "Email hoặc mật khẩu không đúng."
        )

    return build_auth_response(
        user
    )


# ============================================================
# CHANGE PASSWORD
# ============================================================

def change_user_password(
    db: Session,
    user_id: int,
    current_password: str,
    new_password: str,
    confirm_password: str | None = None,
) -> dict:
    if not current_password or not current_password.strip():
        raise ValueError("Vui lòng nhập mật khẩu hiện tại.")

    if not new_password or not new_password.strip():
        raise ValueError("Vui lòng nhập mật khẩu mới.")

    if confirm_password is not None and confirm_password != new_password:
        raise ValueError("Mật khẩu mới và xác nhận mật khẩu không trùng khớp.")

    if len(new_password) < 8:
        raise ValueError("Mật khẩu mới phải có ít nhất 8 ký tự.")

    if not re.search(r"[a-zA-Z]", new_password):
        raise ValueError("Mật khẩu mới phải chứa ít nhất 1 chữ cái.")

    if not re.search(r"\d", new_password):
        raise ValueError("Mật khẩu mới phải chứa ít nhất 1 chữ số.")

    user = db.execute(
        text(
            """
            SELECT
                id,
                password_hash,
                is_active
            FROM users
            WHERE id = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    if user is None:
        raise ValueError("Không tìm thấy thông tin người dùng.")

    if not user["is_active"]:
        raise ValueError("Tài khoản của bạn đã bị vô hiệu hóa.")

    password_hash = user["password_hash"]
    if not password_hash or not verify_password(current_password, password_hash):
        raise ValueError("Mật khẩu hiện tại không chính xác.")

    if current_password == new_password or verify_password(new_password, password_hash):
        raise ValueError("Mật khẩu mới không được trùng với mật khẩu hiện tại.")

    new_hash = hash_password(new_password)

    db.execute(
        text(
            """
            UPDATE users
            SET password_hash = :password_hash,
                updated_at = NOW()
            WHERE id = :user_id
            """
        ),
        {
            "user_id": user_id,
            "password_hash": new_hash,
        },
    )
    db.commit()

    return {
        "success": True,
        "message": "Đổi mật khẩu thành công.",
    }
