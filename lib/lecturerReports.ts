export type ReportType = "WEEKLY" | "MIDTERM" | "FINAL" | "REFLECTION";
export type ReportWorkflowStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "LATE"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED";
export type ReportSubmissionStatus =
  | "UPCOMING"
  | "NOT_SUBMITTED"
  | "DRAFT"
  | "ON_TIME"
  | "LATE";

export interface LecturerReportSummary {
  total: number;
  submitted: number;
  onTime: number;
  late: number;
  overdue: number;
  pendingReview: number;
  approved: number;
}

export interface LecturerReportPeriod {
  id: number;
  name: string;
  semesterCode: string;
  academicYear: string;
}

export interface LecturerReport {
  reportId: number | null;
  scheduleId: number | null;
  internshipId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  className: string;
  major: string;
  periodId: number | null;
  periodName: string;
  semesterCode: string;
  academicYear: string;
  companyName: string;
  positionTitle: string;
  reportType: ReportType;
  weekNumber: number | null;
  title: string;
  scheduleDescription: string | null;
  content: string | null;
  workflowStatus: ReportWorkflowStatus | null;
  submissionStatus: ReportSubmissionStatus;
  dueAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  lateByMinutes: number;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  completionLetterName: string | null;
  completionLetterSize: number | null;
  lecturerFeedback: string | null;
  lecturerScore: number | null;
  commentCount: number;
}

export interface LecturerReportComment {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  comment: string;
  parentCommentId: number | null;
  createdAt: string;
}

export interface LecturerReportsResponse {
  summary: LecturerReportSummary;
  periods: LecturerReportPeriod[];
  reports: LecturerReport[];
}

export interface LecturerReportDetailResponse {
  report: LecturerReport;
  comments: LecturerReportComment[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function apiError(response: Response): Promise<Error> {
  const body = await response.text();
  if (!body) return new Error(`Backend trả về lỗi ${response.status}.`);

  try {
    const parsed = JSON.parse(body) as { detail?: string };
    return new Error(parsed.detail || body);
  } catch {
    return new Error(body);
  }
}

export async function fetchLecturerReports(): Promise<LecturerReportsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lecturers/reports`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as LecturerReportsResponse;
}

export async function fetchLecturerReportDetail(
  reportId: number,
): Promise<LecturerReportDetailResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/reports/${reportId}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as LecturerReportDetailResponse;
}

export async function reviewLecturerReport(
  reportId: number,
  payload: {
    status: "APPROVED" | "REVISION_REQUIRED";
    score: number | null;
    feedback: string;
  },
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/reports/${reportId}/review`,
    {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw await apiError(response);
}

export async function addLecturerReportComment(
  reportId: number,
  comment: string,
): Promise<LecturerReportComment> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/reports/${reportId}/comments`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    },
  );
  if (!response.ok) throw await apiError(response);
  const result = (await response.json()) as { comment: LecturerReportComment };
  return result.comment;
}

export function lecturerReportFileUrl(
  reportId: number,
  kind: "report" | "completion-letter",
  download = false,
): string {
  const suffix = kind === "report" ? "file" : "completion-letter";
  return `${API_BASE_URL}/api/v1/lecturers/reports/${reportId}/${suffix}${
    download ? "?download=true" : ""
  }`;
}
import { lecturerFetch as fetch } from "./lecturerAuth";
