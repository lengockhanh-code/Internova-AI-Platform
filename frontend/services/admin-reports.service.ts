import type {
  LecturerReport,
  LecturerReportComment,
  LecturerReportPeriod,
  LecturerReportSummary,
  ReportSubmissionStatus,
  ReportType,
  ReportWorkflowStatus,
} from "@/lib/lecturerReports";

export type {
  LecturerReportComment as AdminReportComment,
  ReportSubmissionStatus,
  ReportType,
  ReportWorkflowStatus,
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export interface AdminReportLecturer {
  id: number;
  fullName: string;
  lecturerCode: string;
  faculty: string;
}

export interface AdminReport extends LecturerReport {
  assignedLecturer: AdminReportLecturer | null;
}

export interface AdminReportSummary extends LecturerReportSummary {
  students: number;
  revisionRequired: number;
  averageScore: number | null;
}

export interface AdminReportsResponse {
  summary: AdminReportSummary;
  periods: LecturerReportPeriod[];
  lecturers: AdminReportLecturer[];
  reports: AdminReport[];
}

export interface AdminReportDetailResponse {
  report: AdminReport;
  comments: LecturerReportComment[];
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("internova_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: string };
    return new Error(body.detail || `Yêu cầu thất bại (${response.status}).`);
  } catch {
    return new Error(`Yêu cầu thất bại (${response.status}).`);
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", ...authHeaders() },
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as T;
}

export const adminReportsApi = {
  list: () => request<AdminReportsResponse>("/api/v1/admin/reports"),
  detail: (reportId: number) =>
    request<AdminReportDetailResponse>(`/api/v1/admin/reports/${reportId}`),
  fileUrl: (
    reportId: number,
    kind: "report" | "completion-letter",
    download = false,
  ) => {
    const suffix = kind === "report" ? "file" : "completion-letter";
    return `${API_BASE_URL}/api/v1/admin/reports/${reportId}/${suffix}${download ? "?download=true" : ""}`;
  },
};

export async function openAdminReportFile(
  reportId: number,
  kind: "report" | "completion-letter",
  download = false,
): Promise<void> {
  const response = await fetch(adminReportsApi.fileUrl(reportId, kind, download), {
    headers: { ...authHeaders() },
  });
  if (!response.ok) throw await apiError(response);
  const blobUrl = URL.createObjectURL(await response.blob());
  if (download) {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "";
    link.click();
  } else {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
