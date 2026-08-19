from __future__ import annotations

from typing import Literal

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
)


Gender = Literal[
    "MALE",
    "FEMALE",
    "OTHER",
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

    @field_validator("email")
    @classmethod
    def validate_vinuni_email(
        cls,
        value: EmailStr,
    ) -> EmailStr:
        domain = (
            str(value)
            .rsplit("@", 1)[-1]
            .lower()
        )

        if domain != "vinuni.edu.vn":
            raise ValueError(
                "Email phải sử dụng tên miền @vinuni.edu.vn."
            )

        return value


# ============================================================
# LOGIN
# Không cho client gửi role.
# ============================================================


class LoginRequest(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128,
    )


# ============================================================
# RESPONSE
# ============================================================


class AuthUserResponse(BaseModel):
    id: int

    email: str

    fullName: str

    role: Literal[
        "STUDENT",
        "LECTURER",
    ]

    avatarUrl: str | None = None


class AuthResponse(BaseModel):
    accessToken: str

    tokenType: str = "bearer"

    user: AuthUserResponse