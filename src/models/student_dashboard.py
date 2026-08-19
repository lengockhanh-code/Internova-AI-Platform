from __future__ import annotations

from pydantic import BaseModel, Field


class StudentDashboardUser(BaseModel):
    id: int
    fullName: str
    firstName: str
    avatarUrl: str | None = None


class InternshipSummary(BaseModel):
    id: int
    status: str

    companyName: str | None = None
    positionTitle: str | None = None

    startDate: str | None = None
    endDate: str | None = None

    progressPercentage: float = 0.0


class DashboardDeadline(BaseModel):
    id: int

    title: str
    subtitle: str | None = None

    dueAt: str
    countdownDays: int


class DashboardChecklistItem(BaseModel):
    id: int
    label: str
    done: bool


class WeeklyProgress(BaseModel):
    weekNumber: int | None = None

    startDate: str | None = None
    endDate: str | None = None

    progressPercentage: int = 0

    tasks: list[DashboardChecklistItem] = Field(
        default_factory=list
    )


class StudentDashboardResponse(BaseModel):
    user: StudentDashboardUser

    internship: InternshipSummary | None = None

    deadlines: list[DashboardDeadline] = Field(
        default_factory=list
    )

    weeklyProgress: WeeklyProgress