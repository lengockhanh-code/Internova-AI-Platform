from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import Field

from src.models.lecturer_common import LecturerBaseModel


InternshipPeriodStatus = Literal[
    "UPCOMING",
    "ACTIVE",
    "COMPLETED",
]


class LecturerInternshipPeriod(
    LecturerBaseModel
):
    id: int

    name: str
    semesterCode: str = ""
    academicYear: str = ""

    startDate: str = ""
    endDate: str = ""

    status: InternshipPeriodStatus

    totalStudents: int = 0
    requiredReports: int = 0

    progressPercentage: float = 0.0
    needAttention: int = 0

    description: str | None = None


class LecturerInternshipPeriodSummary(
    LecturerBaseModel
):
    total: int = 0
    active: int = 0
    upcoming: int = 0
    completed: int = 0


class LecturerInternshipPeriodsResponse(
    LecturerBaseModel
):
    summary: LecturerInternshipPeriodSummary = Field(
        default_factory=LecturerInternshipPeriodSummary,
    )

    periods: list[
        LecturerInternshipPeriod
    ] = Field(
        default_factory=list,
    )


class UpdateLecturerInternshipPeriodRequest(
    LecturerBaseModel
):
    name: str = Field(min_length=1, max_length=100)
    semesterCode: str = Field(min_length=1, max_length=50)
    academicYear: str = Field(min_length=1, max_length=20)
    startDate: date
    endDate: date


class UpdateLecturerInternshipPeriodResponse(
    LecturerBaseModel
):
    id: int
    message: str


class CreateLecturerInternshipPeriodRequest(
    UpdateLecturerInternshipPeriodRequest
):
    pass


class CreateLecturerInternshipPeriodResponse(
    UpdateLecturerInternshipPeriodResponse
):
    pass

