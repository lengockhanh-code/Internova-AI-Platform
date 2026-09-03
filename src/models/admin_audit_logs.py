from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815

AuditOutcome = Literal["SUCCESS", "FAILED"]
AuditSeverity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class AdminAuditActor(BaseModel):
    id: int | None = None
    name: str
    email: str | None = None
    role: str | None = None


class AdminAuditLogItem(BaseModel):
    id: int
    eventId: str
    requestId: str
    actor: AdminAuditActor
    action: str
    category: str
    resourceType: str | None = None
    resourceId: str | None = None
    resourceLabel: str | None = None
    outcome: AuditOutcome
    severity: AuditSeverity
    httpMethod: str
    requestPath: str
    httpStatus: int
    ipAddress: str | None = None
    userAgent: str | None = None
    detail: str
    metadata: dict[str, Any]
    durationMs: int
    createdAt: datetime


class AdminAuditSummary(BaseModel):
    total: int = 0
    success: int = 0
    failed: int = 0
    highRisk: int = 0
    activeActors: int = 0
    successRate: float = 0


class AdminAuditTrendPoint(BaseModel):
    date: str
    success: int = 0
    failed: int = 0


class AdminAuditFilterOption(BaseModel):
    value: str
    label: str
    count: int = 0


class AdminAuditActorOption(BaseModel):
    id: int
    name: str
    email: str | None = None


class AdminAuditLogsResponse(BaseModel):
    items: list[AdminAuditLogItem]
    total: int
    page: int
    pageSize: int
    totalPages: int
    summary: AdminAuditSummary
    trend: list[AdminAuditTrendPoint]
    categories: list[AdminAuditFilterOption]
    actors: list[AdminAuditActorOption]


class AdminAuditLogResponse(BaseModel):
    item: AdminAuditLogItem
