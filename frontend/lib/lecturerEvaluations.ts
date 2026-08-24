export type EvaluationType = "MIDTERM" | "FINAL";
export type EvaluationStatus = "DRAFT" | "SUBMITTED" | "CONFIRMED";
export type EvaluationDisplayStatus = "NOT_STARTED" | EvaluationStatus;

export interface EvaluationSummary {
  total: number;
  notStarted: number;
  draft: number;
  submitted: number;
  confirmed: number;
  averageScore: number | null;
}

export interface EvaluationPeriod {
  id: number;
  name: string;
  semesterCode: string;
  academicYear: string;
}

export interface LecturerEvaluationItem {
  internshipId: number;
  evaluationId: number | null;
  evaluationType: EvaluationType;
  status: EvaluationDisplayStatus;
  totalScore: number | null;
  submittedAt: string | null;
  updatedAt: string | null;
  studentId: number;
  studentName: string;
  studentCode: string;
  className: string;
  major: string;
  email: string;
  phone: string | null;
  periodId: number | null;
  periodName: string;
  semesterCode: string;
  academicYear: string;
  companyName: string;
  mentorName: string;
  positionTitle: string;
  startDate: string | null;
  endDate: string | null;
  internshipStatus: string;
  progressPercentage: number;
  completedHours: number;
  requiredHours: number | null;
  reportTotal: number;
  reportSubmitted: number;
  reportApproved: number;
  reportLate: number;
  reportOverdue: number;
  reportAverageScore: number | null;
}

export interface EvaluationRecord {
  id: number;
  evaluatorType: string;
  evaluatorName: string | null;
  evaluationType: string;
  totalScore: number | null;
  feedback: string | null;
  strengths: string | null;
  improvements: string | null;
  status: string;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface EvaluationReportEvidence {
  id: number;
  reportType: string;
  weekNumber: number | null;
  title: string;
  status: string;
  dueAt: string | null;
  submittedAt: string | null;
  isLate: boolean;
  isOverdue: boolean;
  lecturerScore: number | null;
  lecturerFeedback: string | null;
}

export interface LecturerEvaluationsResponse {
  summary: EvaluationSummary;
  periods: EvaluationPeriod[];
  evaluations: LecturerEvaluationItem[];
}

export interface LecturerEvaluationDetail {
  evaluation: LecturerEvaluationItem;
  currentEvaluation: EvaluationRecord | null;
  relatedEvaluations: EvaluationRecord[];
  reports: EvaluationReportEvidence[];
  readinessIssues: string[];
}

export interface EvaluationPayload {
  status: EvaluationStatus;
  totalScore: number | null;
  feedback: string;
  strengths: string;
  improvements: string;
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

export async function fetchLecturerEvaluations(): Promise<LecturerEvaluationsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lecturers/evaluations`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as LecturerEvaluationsResponse;
}

export async function fetchLecturerEvaluationDetail(
  internshipId: number,
  evaluationType: EvaluationType,
): Promise<LecturerEvaluationDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/evaluations/${internshipId}/${evaluationType}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as LecturerEvaluationDetail;
}

export async function saveLecturerEvaluation(
  internshipId: number,
  evaluationType: EvaluationType,
  payload: EvaluationPayload,
): Promise<{ message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/evaluations/${internshipId}/${evaluationType}`,
    {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as { message: string };
}
import { lecturerFetch as fetch } from "./lecturerAuth";
