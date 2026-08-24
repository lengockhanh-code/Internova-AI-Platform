// ============================================================
// Trạng thái quá trình thực tập
// ============================================================

export type InternshipStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED";


// ============================================================
// Trạng thái xử lý / chấm báo cáo
//
// LƯU Ý:
// Đây KHÔNG phải trạng thái dùng để xác định sinh viên
// nộp đúng hạn hay nộp muộn.
//
// Đúng hạn / muộn / chưa nộp sẽ dùng
// ReportSubmissionStatus ở phía dưới.
// ============================================================

export type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "LATE"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED";


// ============================================================
// Trạng thái NỘP báo cáo
//
// Backend sẽ tự tính bằng:
//
// weekly_report_schedules.due_at
//                  VS
// weekly_reports.submitted_at
//
// UPCOMING
// = chưa tới deadline và chưa nộp
//
// NOT_SUBMITTED
// = đã quá deadline nhưng chưa nộp
//
// ON_TIME
// = submitted_at <= due_at
//
// LATE
// = submitted_at > due_at
// ============================================================

export type ReportSubmissionStatus =
  | "UPCOMING"
  | "NOT_SUBMITTED"
  | "ON_TIME"
  | "LATE";


// ============================================================
// Mức độ cảnh báo
// ============================================================

export type WarningSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";


// ============================================================
// Báo cáo thực tế gần nhất đã tồn tại trong weekly_reports
//
// Giữ lại để tương thích với code / giao diện hiện tại.
// Sau này giao diện mới nên ưu tiên latestRequiredReport.
// ============================================================

export interface LatestReport {
  id: string;

  weekNumber: number;

  status: ReportStatus;

  submittedAt: string | null;

  dueAt: string | null;
}


// ============================================================
// Kỳ báo cáo gần nhất theo lịch bắt buộc
//
// Đây là object quan trọng với logic nghiệp vụ mới.
//
// Khác với LatestReport:
// - LatestReport chỉ tồn tại nếu sinh viên đã tạo báo cáo.
// - LatestRequiredReport tồn tại theo schedule,
//   kể cả sinh viên chưa nộp.
//
// Vì vậy mới xác định được NOT_SUBMITTED.
// ============================================================

export interface LatestRequiredReport {
  scheduleId: string;

  // NULL nếu sinh viên chưa nộp báo cáo tuần đó.
  reportId: string | null;

  weekNumber: number;

  // Deadline bắt buộc lấy từ weekly_report_schedules.
  dueAt: string;

  // NULL nếu chưa nộp.
  submittedAt: string | null;

  // Backend tự tính từ dueAt + submittedAt.
  submissionStatus: ReportSubmissionStatus;

  // Trạng thái chấm.
  // NULL nếu chưa có report hoặc chưa vào workflow chấm.
  reviewStatus: ReportStatus | null;

  // Điểm giảng viên.
  lecturerScore: number | null;
}


// ============================================================
// Một sinh viên trong màn hình danh sách quản lý sinh viên
// ============================================================

export interface StudentListItem {
  // ----------------------------------------------------------
  // ID
  // ----------------------------------------------------------

  studentId: string;

  internshipId: string;


  // ----------------------------------------------------------
  // Thông tin sinh viên
  // ----------------------------------------------------------

  fullName: string;

  email: string;

  phone: string | null;

  avatarUrl: string | null;

  studentCode: string;

  className: string | null;

  major: string | null;


  // ----------------------------------------------------------
  // Thông tin doanh nghiệp
  // ----------------------------------------------------------

  companyId: string;

  companyName: string;

  positionTitle: string;


  // ----------------------------------------------------------
  // Tiến độ thực tập cũ
  //
  // Đây là i.progress_percentage.
  // Tạm thời vẫn giữ để không phá các chức năng cũ.
  // ----------------------------------------------------------

  progressPercentage: number;


  // ----------------------------------------------------------
  // Tiến độ BÁO CÁO mới
  //
  // Ví dụ:
  //
  // Đến hiện tại phải nộp: 5
  // Đã nộp:              4
  //
  // reportProgressPercentage = 4 / 5 * 100 = 80
  // ----------------------------------------------------------

  reportProgressPercentage: number;

  reportsSubmitted: number;

  reportsRequiredToDate: number;


  // ----------------------------------------------------------
  // Điểm
  // ----------------------------------------------------------

  averageScore: number;


  // ----------------------------------------------------------
  // Cảnh báo
  // ----------------------------------------------------------

  warningCount: number;


  // ----------------------------------------------------------
  // Trạng thái thực tập
  // ----------------------------------------------------------

  status: InternshipStatus;


  // ----------------------------------------------------------
  // Báo cáo thực tế gần nhất
  //
  // Giữ lại để tương thích với frontend hiện tại.
  // ----------------------------------------------------------

  latestReport: LatestReport | null;


  // ----------------------------------------------------------
  // Kỳ báo cáo gần nhất theo lịch bắt buộc
  //
  // Frontend mới sẽ dùng field này để hiển thị:
  //
  // Tuần 5
  // Chưa nộp
  //
  // hoặc:
  //
  // Tuần 5
  // Nộp muộn
  //
  // ngay cả khi weekly_reports không có bản ghi.
  // ----------------------------------------------------------

  latestRequiredReport: LatestRequiredReport | null;
}


// ============================================================
// Response API:
//
// GET /api/lecturers/:lecturerId/students
// ============================================================

export interface LecturerStudentsResponse {
  lecturer: {
    id: string;

    fullName: string;

    academicTitle: string | null;
  };


  // ----------------------------------------------------------
  // Thống kê tổng quan
  // ----------------------------------------------------------

  summary: {
    totalStudents: number;

    inProgress: number;

    notStarted: number;

    paused: number;

    completed: number;

    // Bao gồm sinh viên:
    // - có warning
    // - chưa nộp báo cáo quá hạn
    // - hoặc có vấn đề cần giảng viên kiểm tra
    needAttention: number;
  };


  // ----------------------------------------------------------
  // Danh sách doanh nghiệp để frontend filter
  // ----------------------------------------------------------

  companies: Array<{
    id: string;

    name: string;
  }>;


  // ----------------------------------------------------------
  // Danh sách sinh viên
  // ----------------------------------------------------------

  students: StudentListItem[];


  // ----------------------------------------------------------
  // Phân trang
  // ----------------------------------------------------------

  pagination: {
    page: number;

    limit: number;

    total: number;

    totalPages: number;
  };
}


// ============================================================
// Tiến độ báo cáo của một sinh viên
//
// Dùng trong màn hình chi tiết sinh viên.
// ============================================================

export interface StudentReportProgress {
  // Tổng báo cáo phải nộp tính tới thời điểm hiện tại.
  requiredToDate: number;

  // Tổng báo cáo sinh viên đã nộp trong số trên.
  submittedToDate: number;

  // submittedToDate / requiredToDate * 100
  percentage: number;
}


// ============================================================
// Chi tiết một báo cáo theo lịch
//
// Đây là cấu trúc mới.
//
// Quan trọng:
// Report có thể chưa tồn tại.
//
// Vì thế:
// reportId = null
//
// vẫn là một dòng hợp lệ vì schedule yêu cầu sinh viên phải nộp.
// ============================================================

export interface StudentScheduledReport {
  // ID của lịch phải nộp.
  scheduleId: string;

  // ID báo cáo thực tế.
  // NULL = sinh viên chưa nộp.
  reportId: string | null;

  weekNumber: number;

  title: string;

  // Deadline bắt buộc.
  dueAt: string;

  // Thời điểm sinh viên thực sự nộp.
  submittedAt: string | null;


  // ----------------------------------------------------------
  // Trạng thái NỘP
  //
  // Backend tự tính.
  // ----------------------------------------------------------

  submissionStatus: ReportSubmissionStatus;


  // ----------------------------------------------------------
  // Trạng thái CHẤM
  //
  // Tách riêng hoàn toàn với submissionStatus.
  // ----------------------------------------------------------

  reviewStatus: ReportStatus | null;


  // ----------------------------------------------------------
  // Nếu nộp muộn thì muộn bao nhiêu ngày.
  //
  // ON_TIME / UPCOMING / NOT_SUBMITTED:
  // daysLate = 0
  // ----------------------------------------------------------

  daysLate: number;


  // ----------------------------------------------------------
  // Điểm và nhận xét
  // ----------------------------------------------------------

  lecturerScore: number | null;

  lecturerComment: string | null;


  // ----------------------------------------------------------
  // AI đánh giá báo cáo
  // ----------------------------------------------------------

  aiCompletenessScore: number | null;

  aiRelevanceScore: number | null;

  aiPlagiarismRisk: string | null;


  // ----------------------------------------------------------
  // Nội dung báo cáo sinh viên
  //
  // NULL nếu sinh viên chưa nộp.
  // ----------------------------------------------------------

  workCompleted: string | null;

  knowledgeLearned: string | null;

  difficulties: string | null;

  nextWeekPlan: string | null;
}


// ============================================================
// Response API:
//
// GET
// /api/lecturers/:lecturerId/students/:studentId
// ============================================================

export interface StudentDetailResponse {
  // ----------------------------------------------------------
  // Thông tin sinh viên
  // ----------------------------------------------------------

  student: {
    id: string;

    fullName: string;

    email: string;

    phone: string | null;

    avatarUrl: string | null;

    studentCode: string;

    faculty: string | null;

    major: string | null;

    className: string | null;

    academicYear: string | null;

    gpa: number | null;
  };


  // ----------------------------------------------------------
  // Thông tin thực tập
  // ----------------------------------------------------------

  internship: {
    id: string;

    companyName: string;

    companyAddress: string | null;

    companyWebsite: string | null;

    mentorName: string | null;

    mentorPosition: string | null;

    positionTitle: string;

    startDate: string;

    endDate: string;

    // Tiến độ thực tập tổng thể cũ.
    progressPercentage: number;

    status: InternshipStatus;

    workMode: string | null;

    lecturerNote: string | null;

    aiFitScore: number | null;

    aiFitSummary: string | null;
  };


  // ----------------------------------------------------------
  // Đánh giá thực tập
  // ----------------------------------------------------------

  evaluation: {
    attitudeScore: number | null;

    professionalKnowledgeScore: number | null;

    workingSkillScore: number | null;

    reportScore: number | null;

    presentationScore: number | null;

    totalScore: number | null;

    overallComment: string | null;

    status: string;
  } | null;


  // ----------------------------------------------------------
  // Tiến độ báo cáo
  //
  // Ví dụ:
  // requiredToDate = 5
  // submittedToDate = 4
  // percentage = 80
  // ----------------------------------------------------------

  reportProgress: StudentReportProgress;


  // ----------------------------------------------------------
  // Toàn bộ lịch báo cáo của sinh viên
  //
  // Có cả tuần chưa nộp.
  //
  // Đây là thay đổi quan trọng so với code cũ,
  // vì code cũ chỉ đọc weekly_reports.
  // ----------------------------------------------------------

  reports: StudentScheduledReport[];


  // ----------------------------------------------------------
  // Cảnh báo
  // ----------------------------------------------------------

  warnings: Array<{
    id: string;

    warningType: string;

    severity: WarningSeverity;

    title: string;

    description: string;

    detectedBy: string;

    status: string;

    createdAt: string;
  }>;


  // ----------------------------------------------------------
  // Ghi chú riêng của giảng viên
  // ----------------------------------------------------------

  notes: Array<{
    id: string;

    content: string;

    isPrivate: boolean;

    createdAt: string;

    updatedAt: string;
  }>;
}