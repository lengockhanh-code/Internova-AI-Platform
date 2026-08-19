export type ApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface ApplicationSummary {
  total: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
}

export interface ApplicationPeriod {
  id: number;
  name: string;
  semesterCode: string;
  academicYear: string;
}

export interface ApplicationListItem {
  applicationId: number;
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
  internshipPosition: string;
  workMode: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  documentCount: number;
  internshipId: number | null;
}

export interface LecturerApplicationsResponse {
  summary: ApplicationSummary;
  periods: ApplicationPeriod[];
  applications: ApplicationListItem[];
}

export interface ApplicationDocument {
  id: number;
  documentType: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface ApplicationDetail {
  applicationId: number;
  status: ApplicationStatus;
  internshipType: string | null;
  description: string | null;
  internshipPosition: string;
  workMode: string | null;
  credits: number | null;
  startDate: string | null;
  endDate: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  lecturerComment: string | null;
  internshipId: number | null;
  period: ApplicationPeriod | null;
  student: {
    id: number;
    fullName: string;
    studentCode: string;
    email: string;
    phone: string | null;
    faculty: string | null;
    major: string | null;
    className: string | null;
  };
  company: {
    id: number | null;
    name: string;
    industry: string | null;
    address: string | null;
    website: string | null;
  };
  mentor: {
    id: number | null;
    fullName: string;
    position: string | null;
    department: string | null;
    email: string | null;
    phone: string | null;
  };
  documents: ApplicationDocument[];
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

export async function fetchLecturerApplications(): Promise<LecturerApplicationsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lecturers/applications`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as LecturerApplicationsResponse;
}

export async function fetchLecturerApplicationDetail(
  applicationId: number,
): Promise<ApplicationDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/applications/${applicationId}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw await apiError(response);
  const result = (await response.json()) as { application: ApplicationDetail };
  return result.application;
}

export async function reviewLecturerApplication(
  applicationId: number,
  status: "UNDER_REVIEW" | "APPROVED" | "REJECTED",
  comment: string,
): Promise<{ internshipId: number | null }> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/applications/${applicationId}/review`,
    {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment: comment.trim() || null }),
    },
  );
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as { internshipId: number | null };
}

export function applicationDocumentUrl(
  applicationId: number,
  documentId: number,
  download = false,
): string {
  return `${API_BASE_URL}/api/v1/lecturers/applications/${applicationId}/documents/${documentId}/file${
    download ? "?download=true" : ""
  }`;
}
import { lecturerFetch as fetch } from "./lecturerAuth";
