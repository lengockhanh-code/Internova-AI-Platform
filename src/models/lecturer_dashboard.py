from __future__ import annotations

from datetime import datetime

from pydantic import Field

from src.models.lecturer_common import (
    InternshipStatus,
    LecturerBaseModel,
    ReportStatus,
    ReportSubmissionStatus,
    ReportType,
)


class LecturerInfo(LecturerBaseModel):
    """
    Thông tin cơ bản của giảng viên.

    Nguồn dữ liệu:
        public.users
        public.lecturer_profiles
    """

    id: int | None = None

    fullName: str = "Giảng viên"

    avatarUrl: str | None = None

    academicTitle: str | None = None

    lecturerCode: str | None = None

    faculty: str | None = None

    specialization: str | None = None


# =============================================================================
# DASHBOARD STATISTICS
# =============================================================================

class LecturerStats(LecturerBaseModel):
    """
    Các card thống kê tổng quan trên dashboard giáo viên.
    """

    # Tổng số internship thuộc giảng viên.
    totalStudents: int = 0

    # Hồ sơ đăng ký được phân cho giảng viên và đang chờ xử lý.
    pendingApplications: int = 0

    # Báo cáo đã nộp nhưng chưa hoàn tất quá trình review.
    pendingReports: int = 0

    # Notification chưa đọc có severity WARNING / ERROR.
    openWarnings: int = 0

    # Điểm trung bình quy đổi về thang 10.
    averageScore: float = 0.0

    # -------------------------------------------------------------------------
    # Thống kê tiến độ nộp báo cáo
    # -------------------------------------------------------------------------

    # Tổng số báo cáo phải nộp tính đến thời điểm hiện tại.
    reportsDueToDate: int = 0

    # Đã nộp trước hoặc đúng deadline.
    onTimeReports: int = 0

    # Đã nộp nhưng sau deadline.
    lateReports: int = 0

    # Deadline đã qua nhưng chưa có submitted_at.
    notSubmittedReports: int = 0


# =============================================================================
# INTERNSHIP PROGRESS
# =============================================================================

class InternshipProgress(LecturerBaseModel):
    """
    Tổng hợp trạng thái internship của sinh viên
    thuộc giảng viên hiện tại.
    """

    total: int = 0

    notStarted: int = 0

    inProgress: int = 0

    paused: int = 0

    completed: int = 0


# =============================================================================
# REPORT PROGRESS SUMMARY
# =============================================================================

class ReportProgressSummary(LecturerBaseModel):
    """
    Tổng hợp tiến độ báo cáo của toàn bộ sinh viên
    thuộc giảng viên hiện tại.

    weekly_report_schedules của schema mới được xác định theo semester_id.
    """

    requiredToDate: int = 0

    submittedToDate: int = 0

    onTime: int = 0

    late: int = 0

    notSubmitted: int = 0

    upcoming: int = 0


# =============================================================================
# DASHBOARD ANALYTICS
# =============================================================================

class ScoreDistributionItem(LecturerBaseModel):
    label: str
    count: int = 0
    percentage: float = 0.0


class AtRiskStudent(LecturerBaseModel):
    studentId: int
    internshipId: int
    studentName: str
    studentCode: str | None = None
    progressPercentage: float = 0.0
    reportProgressPercentage: float = 0.0
    averageScore: float = 0.0
    warningCount: int = 0
    riskLevel: str = "MEDIUM"


class LecturerAnalytics(LecturerBaseModel):
    completionRate: float = 0.0
    averageInternshipProgress: float = 0.0
    reportSubmissionRate: float = 0.0
    onTimeRate: float = 0.0
    studentsAtRisk: int = 0
    studentsWithScores: int = 0
    scoreDistribution: list[ScoreDistributionItem] = Field(default_factory=list)
    riskStudents: list[AtRiskStudent] = Field(default_factory=list)


# =============================================================================
# LATEST REPORT
# =============================================================================

class LatestReport(LecturerBaseModel):
    """
    Một báo cáo thực tế đã tồn tại trong public.weekly_reports.

    Dùng cho khu vực "Báo cáo mới nhất" trên dashboard.
    """

    id: int

    studentId: int | None = None

    internshipId: int | None = None

    studentName: str

    studentCode: str | None = None

    avatarUrl: str | None = None

    # Chỉ WEEKLY bắt buộc có week_number.
    weekNumber: int | None = None

    reportType: ReportType = "WEEKLY"

    # Trạng thái workflow của weekly_reports.status.
    status: ReportStatus

    # Trạng thái nộp do service tự tính từ due_at/submitted_at.
    submissionStatus: ReportSubmissionStatus | None = None

    submittedAt: datetime | None = None

    dueAt: datetime | None = None

    lecturerScore: float | None = None

    lecturerFeedback: str | None = None


# =============================================================================
# LATEST REQUIRED REPORT
# =============================================================================

class LatestRequiredReport(LecturerBaseModel):
    """
    Kỳ báo cáo gần nhất theo public.weekly_report_schedules.

    Với schema mới:
        internships.semester_id
            -> weekly_report_schedules.semester_id
            -> weekly_reports.schedule_id

    Đối tượng này vẫn tồn tại ngay cả khi sinh viên chưa tạo report.
    """

    scheduleId: int

    # NULL nếu chưa có report thực tế.
    reportId: int | None = None

    weekNumber: int

    title: str | None = None

    dueAt: datetime

    submittedAt: datetime | None = None

    submissionStatus: ReportSubmissionStatus

    reviewStatus: ReportStatus | None = None

    lecturerScore: float | None = None


# =============================================================================
# STUDENT ON LECTURER DASHBOARD
# =============================================================================

class LecturerStudent(LecturerBaseModel):
    studentId: int
    internshipId: int

    studentName: str
    studentCode: str | None = None

    className: str | None = None
    major: str | None = None

    avatarUrl: str | None = None

    companyName: str | None = None
    positionTitle: str | None = None

    progressPercentage: float = 0.0

    reportProgressPercentage: float = 0.0
    reportsSubmitted: int = 0
    reportsRequiredToDate: int = 0

    averageScore: float = 0.0
    warningCount: int = 0

    status: InternshipStatus

    latestRequiredReport: LatestRequiredReport | None = None


# =============================================================================
# UPCOMING DEADLINE
# =============================================================================

class UpcomingDeadline(LecturerBaseModel):
    """
    Deadline sắp tới hiển thị trong lịch dashboard.

    Nguồn:
        public.deadlines
    """

    id: int

    title: str

    description: str | None = None

    deadlineType: str

    dueAt: datetime


# =============================================================================
# DASHBOARD RESPONSE
# =============================================================================

class LecturerDashboardResponse(LecturerBaseModel):
    """
    Response contract cho:

        GET /api/v1/lecturers/dashboard

    Luồng:
        lecturer_service.py
            -> lecturer_routes.py
            -> LecturerDashboardResponse
            -> frontend/app/lecturer/dashboard/page.tsx
    """

    lecturer: LecturerInfo

    stats: LecturerStats = Field(
        default_factory=LecturerStats,
    )

    progress: InternshipProgress = Field(
        default_factory=InternshipProgress,
    )

    reportProgress: ReportProgressSummary = Field(
        default_factory=ReportProgressSummary,
    )

    analytics: LecturerAnalytics = Field(
        default_factory=LecturerAnalytics,
    )

    latestReports: list[LatestReport] = Field(
        default_factory=list,
    )

    students: list[LecturerStudent] = Field(
        default_factory=list,
    )

    upcomingDeadlines: list[UpcomingDeadline] = Field(
        default_factory=list,
    )
