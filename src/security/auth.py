from __future__ import annotations

from datetime import (
    UTC,
    datetime,
    timedelta,
)

import jwt
from fastapi import (
    Depends,
    HTTPException,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from pwdlib import PasswordHash
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings
from src.database.connection import get_db

settings = get_settings()

password_hash = (
    PasswordHash.recommended()
)

bearer_scheme = HTTPBearer()


# ============================================================
# PASSWORD
# ============================================================

def hash_password(
    password: str,
) -> str:

    return password_hash.hash(
        password
    )


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:

    return password_hash.verify(
        plain_password,
        hashed_password,
    )


# ============================================================
# JWT
# ============================================================

def create_access_token(
    user_id: int,
    role: str,
) -> str:

    now = datetime.now(
        UTC
    )


    expire = now + timedelta(
        minutes=
            settings
            .access_token_expire_minutes
    )


    payload = {
        "sub":
            str(
                user_id
            ),

        "role":
            role,

        "iat":
            now,

        "exp":
            expire,
    }


    return jwt.encode(
        payload,

        settings.jwt_secret_key,

        algorithm=
            settings.jwt_algorithm,
    )


def decode_access_token(
    token: str,
) -> dict:

    try:

        return jwt.decode(
            token,

            settings.jwt_secret_key,

            algorithms=[
                settings.jwt_algorithm
            ],
        )


    except jwt.ExpiredSignatureError as exc:

        raise HTTPException(
            status_code=401,

            detail=(
                "Phiên đăng nhập đã hết hạn."
            ),
        ) from exc


    except jwt.InvalidTokenError as exc:

        raise HTTPException(
            status_code=401,

            detail=(
                "Token không hợp lệ."
            ),
        ) from exc


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user(
    credentials:
        HTTPAuthorizationCredentials =
        Depends(
            bearer_scheme
        ),

    db: Session =
        Depends(
            get_db
        ),
):

    payload = (
        decode_access_token(
            credentials.credentials
        )
    )


    user_id = (
        payload.get(
            "sub"
        )
    )


    if not user_id:

        raise HTTPException(
            status_code=401,

            detail=(
                "Token không có user_id."
            ),
        )


    try:

        parsed_user_id = (
            int(
                user_id
            )
        )

    except (
        TypeError,
        ValueError,
    ) as exc:

        raise HTTPException(
            status_code=401,

            detail=(
                "user_id trong token "
                "không hợp lệ."
            ),
        ) from exc


    user = db.execute(
        text(
            """
            SELECT
                id,
                email,
                full_name,
                avatar_url,
                role,
                is_active


            FROM users

            WHERE id = :user_id

            LIMIT 1
            """
        ),
        {
            "user_id":
                parsed_user_id,
        },
    ).mappings().first()


    if (
        user is None
        or not user[
            "is_active"
        ]
    ):

        raise HTTPException(
            status_code=401,

            detail=(
                "Tài khoản không tồn tại "
                "hoặc đã bị vô hiệu hóa."
            ),
        )


    return dict(
        user
    )


def require_lecturer(
    current_user=Depends(get_current_user),
):
    """Require an active lecturer account for lecturer-only APIs."""

    if current_user["role"] != "LECTURER":
        raise HTTPException(
            status_code=403,
            detail="Chức năng này chỉ dành cho giảng viên.",
        )

    return current_user
