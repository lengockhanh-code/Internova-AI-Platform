from __future__ import annotations

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


class InvalidCredentialsError(Exception):
    pass


# ============================================================
# RESPONSE BUILDER
# ============================================================


def build_auth_response(
    user,
) -> dict:

    token = create_access_token(
        user_id=user["id"],
        role=user["role"],
    )


    return {

        "accessToken":
            token,


        "tokenType":
            "bearer",


        "user": {

            "id":
                user["id"],


            "email":
                str(
                    user["email"]
                ),


            "fullName":
                user["full_name"],


            "role":
                user["role"],


            "avatarUrl":
                user["avatar_url"],
        },
    }



# ============================================================
# REGISTER STUDENT
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

    normalized_email = (
        email.strip().lower()
    )


    # check email

    exists = db.execute(
        text(
            """
            SELECT id

            FROM users

            WHERE email = :email

            LIMIT 1
            """
        ),
        {
            "email":
                normalized_email
        },
    ).first()



    if exists:

        raise EmailAlreadyExistsError(
            "Email đã tồn tại."
        )



    # check student code

    exists_code = db.execute(
        text(
            """
            SELECT student_id

            FROM student_profiles

            WHERE student_code = :student_code

            LIMIT 1
            """
        ),
        {
            "student_code":
                student_code
        },
    ).first()



    if exists_code:

        raise StudentCodeAlreadyExistsError(
            "Mã sinh viên đã tồn tại."
        )



    password_hash = hash_password(
        password
    )


    full_name = (
        f"{first_name.strip()} "
        f"{last_name.strip()}"
    ).strip()



    user = db.execute(
        text(
            """
            INSERT INTO users
            (
                email,
                password_hash,
                full_name,
                role,
                is_active
            )

            VALUES
            (
                :email,
                :password_hash,
                :full_name,
                'STUDENT',
                TRUE
            )

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


            "full_name":
                full_name,
        },
    ).mappings().first()



    db.commit()



    db.execute(
        text(
            """
            INSERT INTO student_profiles
            (
                student_id,
                student_code,
                gender
            )

            VALUES
            (
                :student_id,
                :student_code,
                :gender
            )
            """
        ),
        {
            "student_id":
                user["id"],


            "student_code":
                student_code,


            "gender":
                gender,
        },
    )


    db.commit()



    return build_auth_response(
        user
    )



# ============================================================
# LOGIN
# ============================================================


def login_user(
    db: Session,

    email: str,

    password: str,

    role: str,
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

            AND role = :role


            LIMIT 1
            """
        ),
        {
            "email":
                normalized_email,


            "role":
                role,
        },
    ).mappings().first()



    if user is None:

        raise InvalidCredentialsError(
            "Email hoặc chức vụ không đúng."
        )



    if not user["is_active"]:

        raise InvalidCredentialsError(
            "Tài khoản đã bị khóa."
        )



    if not user["password_hash"]:

        raise InvalidCredentialsError(
            "Tài khoản chưa có mật khẩu."
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