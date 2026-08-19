from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# COMMON TYPES
# =============================================================================

InternshipStatus = Literal[
    "NOT_STARTED",
    "IN_PROGRESS",
    "PAUSED",
    "COMPLETED",
]


ReportStatus = Literal[
    "DRAFT",
    "SUBMITTED",
    "LATE",
    "UNDER_REVIEW",
    "REVISION_REQUIRED",
    "APPROVED",
]


ReportSubmissionStatus = Literal[
    "UPCOMING",
    "NOT_SUBMITTED",
    "ON_TIME",
    "LATE",
]


ReportType = Literal[
    "WEEKLY",
    "MIDTERM",
    "FINAL",
    "REFLECTION",
]


NotificationSeverity = Literal[
    "INFO",
    "SUCCESS",
    "WARNING",
    "ERROR",
]


# =============================================================================
# BASE MODEL
# =============================================================================

class LecturerBaseModel(BaseModel):
    """
    Base model dùng chung cho API giáo viên.

    Database hiện tại của project dùng:
        - PostgreSQL database: internship_ai_db
        - schema: public
        - khóa chính: BIGSERIAL / BIGINT

    Vì vậy ID trong model Python được biểu diễn bằng int,
    không dùng UUID.
    """

    model_config = ConfigDict(
        from_attributes=True,
    )


# =============================================================================
# LECTURER INFORMATION
# =============================================================================

