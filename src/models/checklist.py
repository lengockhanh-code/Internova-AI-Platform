from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ChecklistStatus = Literal[
    "PENDING",
    "IN_PROGRESS",
    "COMPLETED",
]


ChecklistPriority = Literal[
    "HIGH",
    "MEDIUM",
    "LOW",
]


ChecklistCategory = Literal[
    "PROFILE",
    "WEEKLY",
    "FINAL",
]


class ChecklistItemResponse(BaseModel):
    id: int

    title: str

    description: str | None = None

    category: ChecklistCategory

    status: ChecklistStatus

    priority: ChecklistPriority

    dueAt: str | None = None

    completedAt: str | None = None


class ChecklistGroupResponse(BaseModel):
    id: str

    groupId: int | None = None

    title: str

    subtitle: str

    progress: int

    tasks: list[
        ChecklistItemResponse
    ] = Field(
        default_factory=list
    )


class ChecklistStatsResponse(BaseModel):
    total: int = 0

    completed: int = 0

    inProgress: int = 0

    pending: int = 0

    progressPercentage: int = 0


class ChecklistDeadlineResponse(BaseModel):
    id: int

    title: str

    dueAt: str


class ChecklistResponse(BaseModel):
    stats: ChecklistStatsResponse

    groups: list[
        ChecklistGroupResponse
    ] = Field(
        default_factory=list
    )

    nearestDeadline:ChecklistDeadlineResponse | None = None


class ChecklistItemCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    category: ChecklistCategory

    priority: ChecklistPriority = "MEDIUM"

    dueAt: datetime | None = None


class ChecklistBatchTaskCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )


class ChecklistBatchCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    tasks: list[ChecklistBatchTaskCreate] = Field(
        min_length=1,
        max_length=50,
    )

    category: ChecklistCategory

    priority: ChecklistPriority = "MEDIUM"

    dueAt: datetime | None = None


class ChecklistBatchCreateResponse(BaseModel):
    status: Literal["ok"] = "ok"

    created: int

    groupId: int

    ids: list[int] = Field(
        default_factory=list,
    )


class ChecklistGroupUpdate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )


class ChecklistGroupTasksCreate(BaseModel):
    tasks: list[ChecklistBatchTaskCreate] = Field(
        min_length=1,
        max_length=50,
    )


class ChecklistItemUpdate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )


class ChecklistStatusUpdate(BaseModel):
    status: ChecklistStatus
