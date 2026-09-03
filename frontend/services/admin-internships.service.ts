const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type ApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface LecturerOption {
  id: number;
  fullName: string;
  lecturerCode: string;
  faculty: string;
}

export interface PeriodOption {
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
  companyName: string;
  internshipPosition: string;
  workMode: string | null;
  status: ApplicationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  documentCount: number;
  internshipId: number | null;
  assignedLecturer: LecturerOption | null;
}

export interface ApplicationsResponse {
  summary: {
    total: number;
    submitted: number;
    underReview: number;
    approved: number;
    rejected: number;
    unassigned: number;
  };
  periods: PeriodOption[];
  lecturers: LecturerOption[];
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
  period: PeriodOption | null;
  assignedLecturer: LecturerOption | null;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as T;
}

export const adminInternshipsApi = {
  list: () => request<ApplicationsResponse>("/api/v1/admin/internships"),

  detail: async (applicationId: number) => {
    const response = await request<{ application: ApplicationDetail }>(
      `/api/v1/admin/internships/${applicationId}`,
    );
    return response.application;
  },

  assign: (applicationId: number, lecturerId: number) =>
    request<{ message: string }>(
      `/api/v1/admin/internships/${applicationId}/assignment`,
      {
        method: "PUT",
        body: JSON.stringify({ lecturerId }),
      },
    ),

  review: (
    applicationId: number,
    status: "UNDER_REVIEW" | "APPROVED" | "REJECTED",
    comment: string,
  ) => request<{ internshipId: number | null; message: string }>(
    `/api/v1/admin/internships/${applicationId}/review`,
    {
      method: "PUT",
      body: JSON.stringify({ status, comment: comment.trim() || null }),
    },
  ),

  documentUrl: (applicationId: number, documentId: number, download = false) =>
    `${API_BASE_URL}/api/v1/admin/internships/${applicationId}/documents/${documentId}/file${download ? "?download=true" : ""}`,
};

export async function openAdminDocument(
  applicationId: number,
  documentId: number,
  download = false,
): Promise<void> {
  const response = await fetch(
    adminInternshipsApi.documentUrl(applicationId, documentId, download),
    { headers: { ...authHeaders() } },
  );
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
