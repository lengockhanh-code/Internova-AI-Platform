"""Backward-compatible exports for lecturer API models.

New code should import models from the domain-specific lecturer modules.
"""

from src.models.lecturer_common import (
    InternshipStatus,
    LecturerBaseModel,
    NotificationSeverity,
    ReportStatus,
    ReportSubmissionStatus,
    ReportType,
)
from src.models.lecturer_dashboard import (
    InternshipProgress,
    LatestReport,
    LatestRequiredReport,
    LecturerDashboardResponse,
    LecturerInfo,
    LecturerStats,
    LecturerStudent,
    ReportProgressSummary,
    UpcomingDeadline,
)
from src.models.lecturer_internship_periods import (
    CreateLecturerInternshipPeriodRequest,
    CreateLecturerInternshipPeriodResponse,
    InternshipPeriodStatus,
    LecturerInternshipPeriod,
    LecturerInternshipPeriodSummary,
    LecturerInternshipPeriodsResponse,
    UpdateLecturerInternshipPeriodRequest,
    UpdateLecturerInternshipPeriodResponse,
)
from src.models.lecturer_student_management import (
    AddLecturerStudentRequest,
    AddLecturerStudentResponse,
    EditLecturerInternshipInfo,
    EditLecturerStudentInfo,
    EditLecturerStudentResponse,
    LecturerCompanyOption,
    LecturerSemesterOption,
    LecturerStudentFormOptionsResponse,
    LecturerStudentOption,
    UpdateLecturerStudentRequest,
    UpdateLecturerStudentResponse,
)

__all__ = [
    "InternshipStatus",
    "LecturerBaseModel",
    "NotificationSeverity",
    "ReportStatus",
    "ReportSubmissionStatus",
    "ReportType",
    "InternshipProgress",
    "LatestReport",
    "LatestRequiredReport",
    "LecturerDashboardResponse",
    "LecturerInfo",
    "LecturerStats",
    "LecturerStudent",
    "ReportProgressSummary",
    "UpcomingDeadline",
    "CreateLecturerInternshipPeriodRequest",
    "CreateLecturerInternshipPeriodResponse",
    "InternshipPeriodStatus",
    "LecturerInternshipPeriod",
    "LecturerInternshipPeriodSummary",
    "LecturerInternshipPeriodsResponse",
    "UpdateLecturerInternshipPeriodRequest",
    "UpdateLecturerInternshipPeriodResponse",
    "AddLecturerStudentRequest",
    "AddLecturerStudentResponse",
    "EditLecturerInternshipInfo",
    "EditLecturerStudentInfo",
    "EditLecturerStudentResponse",
    "LecturerCompanyOption",
    "LecturerSemesterOption",
    "LecturerStudentFormOptionsResponse",
    "LecturerStudentOption",
    "UpdateLecturerStudentRequest",
    "UpdateLecturerStudentResponse",
]
