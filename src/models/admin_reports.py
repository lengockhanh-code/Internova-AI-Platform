from __future__ import annotations

from pydantic import BaseModel, Field

from src.models.lecturer_reports import (
    LecturerReportComment,
    LecturerReportItem,
    LecturerReportPeriodOption,
    LecturerReportSummary,
)

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815


class AdminReportLecturer(BaseModel):
    id: int
    fullName: str
    lecturerCode: str = ""
    faculty: str = ""


class AdminReportSummary(LecturerReportSummary):
    students: int = 0
    revisionRequired: int = 0
    averageScore: float | None = None


class AdminReportItem(LecturerReportItem):
    assignedLecturer: AdminReportLecturer | None = None


class AdminReportsResponse(BaseModel):
    summary: AdminReportSummary = Field(default_factory=AdminReportSummary)
    periods: list[LecturerReportPeriodOption] = Field(default_factory=list)
    lecturers: list[AdminReportLecturer] = Field(default_factory=list)
    reports: list[AdminReportItem] = Field(default_factory=list)


class AdminReportDetailResponse(BaseModel):
    report: AdminReportItem
    comments: list[LecturerReportComment] = Field(default_factory=list)
