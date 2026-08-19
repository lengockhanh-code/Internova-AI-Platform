from __future__ import annotations

from typing import Literal

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
)


Gender = Literal[
    "MALE",
    "FEMALE",
    "OTHER",
]


LoginRole = Literal[
    "STUDENT",
    "LECTURER",
    "ADMIN",
]


# ============================================================
# REGISTER
# Chỉ dành cho STUDENT
# ============================================================

class RegisterRequest(BaseModel):
    firstName: str = Field(
        min_length=1,
        max_length=100,
    )

    lastName: str = Field(
        min_length=1,
        max_length=100,
    )

    studentCode: str = Field(
        min_length=2,
        max_length=50,
    )

    gender: Gender | None = None

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )


# ============================================================
# LOGIN
# Sinh viên hoặc giảng viên
# ============================================================

class LoginRequest(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128,
    )

    role: LoginRole


# ============================================================
# RESPONSE
# ============================================================

class AuthUserResponse(BaseModel):
    id: int

    email: str

    fullName: str

    role: str

    avatarUrl: str | None = None


class AuthResponse(BaseModel):
    accessToken: str

    tokenType: str = "bearer"

    user: AuthUserResponse