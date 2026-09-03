import type {
  EvaluationDisplayStatus,
  EvaluationPeriod,
  EvaluationRecord,
  EvaluationReportEvidence,
  EvaluationType,
  LecturerEvaluationItem,
} from "@/lib/lecturerEvaluations";

export type {
  EvaluationDisplayStatus,
  EvaluationType,
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export interface AdminEvaluationLecturer {
  id: number;
  fullName: string;
  lecturerCode: string;
  faculty: string;
}

export interface AdminEvaluationItem extends LecturerEvaluationItem {
  assignedLecturer: AdminEvaluationLecturer | null;
}

export interface AdminEvaluationSummary {
  total: number;
  notStarted: number;
  draft: number;
  submitted: number;
  confirmed: number;
  averageScore: number | null;
  students: number;
  lecturers: number;
  midterm: number;
  final: number;
  needsAttention: number;
  completionRate: number;
}

export interface AdminEvaluationsResponse {
  summary: AdminEvaluationSummary;
  periods: EvaluationPeriod[];
  lecturers: AdminEvaluationLecturer[];
  evaluations: AdminEvaluationItem[];
}

export interface AdminEvaluationDetail {
  evaluation: AdminEvaluationItem;
  currentEvaluation: EvaluationRecord | null;
  relatedEvaluations: EvaluationRecord[];
  reports: EvaluationReportEvidence[];
  readinessIssues: string[];
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

export const adminEvaluationsApi = {
  list: () => request<AdminEvaluationsResponse>("/api/v1/admin/evaluations"),
  detail: (internshipId: number, evaluationType: EvaluationType) =>
    request<AdminEvaluationDetail>(
      `/api/v1/admin/evaluations/${internshipId}/${evaluationType}`,
    ),
};
