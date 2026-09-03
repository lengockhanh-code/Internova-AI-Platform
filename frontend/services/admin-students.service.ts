const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type AdminStudentType = "INTERNAL" | "EXTERNAL";
export type AdminStudentGender = "MALE" | "FEMALE" | "OTHER";

export interface AdminStudent {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  gender: AdminStudentGender | null;
  studentCode: string;
  faculty: string | null;
  major: string | null;
  cohort: string | null;
  gpa: number | null;
  studentType: AdminStudentType;
  accountStatus: "REGISTERED" | "PENDING";
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminStudentsResponse {
  items: AdminStudent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    total: number;
    active: number;
    inactive: number;
    external: number;
  };
  filters: {
    faculties: string[];
    cohorts: string[];
  };
}

export interface AdminStudentPayload {
  fullName: string;
  email: string;
  phone: string | null;
  gender: AdminStudentGender | null;
  studentCode: string;
  faculty: string | null;
  major: string | null;
  cohort: string | null;
  gpa: number | null;
  studentType: AdminStudentType;
}

export interface AdminStudentCreatePayload extends AdminStudentPayload {
  password: string;
}

export interface AdminStudentUpdatePayload extends AdminStudentPayload {
  isActive: boolean;
  newPassword: string | null;
}

export class AdminStudentsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminStudentsApiError";
    this.status = status;
  }
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("internova_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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

  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") message = body.detail;
    } catch {}
    throw new AdminStudentsApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export const adminStudentsApi = {
  list: (params: {
    search?: string;
    status?: string;
    studentType?: string;
    faculty?: string;
    cohort?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.status) query.set("status", params.status);
    if (params.studentType) query.set("student_type", params.studentType);
    if (params.faculty) query.set("faculty", params.faculty);
    if (params.cohort) query.set("cohort", params.cohort);
    query.set("page", String(params.page ?? 1));
    query.set("page_size", String(params.pageSize ?? 10));
    return request<AdminStudentsResponse>(
      `/api/v1/admin/students?${query.toString()}`,
    );
  },

  create: (payload: AdminStudentCreatePayload) =>
    request<{ student: AdminStudent; message: string }>(
      "/api/v1/admin/students",
      { method: "POST", body: JSON.stringify(payload) },
    ),

  update: (studentId: number, payload: AdminStudentUpdatePayload) =>
    request<{ student: AdminStudent; message: string }>(
      `/api/v1/admin/students/${studentId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  deactivate: (studentId: number) =>
    request<{ studentId: number; message: string }>(
      `/api/v1/admin/students/${studentId}`,
      { method: "DELETE" },
    ),
};
