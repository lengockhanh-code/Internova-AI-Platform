const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type AdminLecturerGender = "MALE" | "FEMALE" | "OTHER";
export type AdminLecturerWorkload = "AVAILABLE" | "ASSIGNED" | "HIGH";

export interface AdminLecturer {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  gender: AdminLecturerGender | null;
  avatarUrl: string | null;
  lecturerCode: string;
  academicTitle: string | null;
  faculty: string | null;
  specialization: string | null;
  isActive: boolean;
  authProvider: "LOCAL" | "GOOGLE";
  accountStatus: "REGISTERED" | "PENDING";
  assignedStudents: number;
  activeInternships: number;
  completedInternships: number;
  pendingReviews: number;
  workload: AdminLecturerWorkload;
  lastAssignmentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminLecturersResponse {
  items: AdminLecturer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    total: number;
    active: number;
    inactive: number;
    assignedStudents: number;
    pendingReviews: number;
    available: number;
    assigned: number;
    highWorkload: number;
    averageLoad: number;
  };
  filters: {
    faculties: string[];
    academicTitles: string[];
  };
}

export interface AdminLecturerPayload {
  fullName: string;
  email: string;
  phone: string | null;
  gender: AdminLecturerGender | null;
  lecturerCode: string;
  academicTitle: string | null;
  faculty: string | null;
  specialization: string | null;
}

export interface AdminLecturerCreatePayload extends AdminLecturerPayload {
  password: string;
  isActive: boolean;
}

export interface AdminLecturerUpdatePayload extends AdminLecturerPayload {
  isActive: boolean;
  newPassword: string | null;
}

export class AdminLecturersApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminLecturersApiError";
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
      const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) {
        message = body.detail.map((item) => item.msg).filter(Boolean).join(" ") || message;
      }
    } catch {}
    throw new AdminLecturersApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export const adminLecturersApi = {
  list: (params: {
    search?: string;
    status?: string;
    faculty?: string;
    academicTitle?: string;
    workload?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.status) query.set("status", params.status);
    if (params.faculty) query.set("faculty", params.faculty);
    if (params.academicTitle) query.set("academic_title", params.academicTitle);
    if (params.workload) query.set("workload", params.workload);
    query.set("page", String(params.page ?? 1));
    query.set("page_size", String(params.pageSize ?? 12));
    return request<AdminLecturersResponse>(`/api/v1/admin/lecturers?${query.toString()}`);
  },

  create: (payload: AdminLecturerCreatePayload) =>
    request<{ lecturer: AdminLecturer; message: string }>("/api/v1/admin/lecturers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (lecturerId: number, payload: AdminLecturerUpdatePayload) =>
    request<{ lecturer: AdminLecturer; message: string }>(
      `/api/v1/admin/lecturers/${lecturerId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  setStatus: (lecturerId: number, isActive: boolean) =>
    request<{ lecturer: AdminLecturer; message: string }>(
      `/api/v1/admin/lecturers/${lecturerId}/status`,
      { method: "PATCH", body: JSON.stringify({ isActive }) },
    ),

  deactivate: (lecturerId: number) =>
    request<{ lecturer: AdminLecturer; message: string }>(
      `/api/v1/admin/lecturers/${lecturerId}`,
      { method: "DELETE" },
    ),
};
