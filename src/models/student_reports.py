from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ============================================================
# REPORT TYPES
# ============================================================

ReportType = Literal[
    "WEEKLY",
    "MIDTERM",
    "FINAL",
    "REFLECTION",
]


# ============================================================
# CREATE REPORT
# ============================================================

class ReportCreateRequest(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    report_type: ReportType

    week_number: int | None = Field(
        default=None,
        ge=1,
    )

    content: str | None = Field(
        default=None,
        max_length=50000,
    )


# ============================================================
# UPDATE REPORT
# ============================================================

class ReportUpdateRequest(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    content: str | None = Field(
        default=None,
        max_length=50000,
    )


# ============================================================
# AI REVIEW RESPONSE
#
# Đây chỉ là schema JSON trả về frontend.
# KHÔNG phải database model.
# ============================================================

class AiReportReviewResponse(BaseModel):
    completeness_score: float = Field(
        ge=0,
        le=100,
    )

    summary: str

    strengths: list[str] = Field(
        default_factory=list,
    )

    issues: list[str] = Field(
        default_factory=list,
    )

    suggestions: list[str] = Field(
        default_factory=list,
    )