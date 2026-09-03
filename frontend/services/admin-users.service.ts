const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type AdminUserRole = "STUDENT" | "LECTURER" | "ADMIN";
export type AdminUserAuthProvider = "LOCAL" | "GOOGLE";

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: AdminUserRole;
  isActive: boolean;
  authProvider: AdminUserAuthProvider;
  accountStatus: "REGISTERED" | "PENDING";
  identityCode: string | null;
  faculty: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminUsersResponse {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentUserId: number;
  summary: {
    total: number;
    active: number;
    inactive: number;
    students: number;
    lecturers: number;
    admins: number;
    pending: number;
  };
}

export interface AdminUserPayload {
  fullName: string;
  email: string;
  phone: string | null;
  role: AdminUserRole;
  isActive: boolean;
  identityCode: string | null;
  faculty: string | null;
}

export interface AdminUserCreatePayload extends AdminUserPayload {
  password: string;
}

export class AdminUsersApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminUsersApiError";
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
        message = body.detail.map(item => item.msg).filter(Boolean).join(" ") || message;
      }
    } catch {}
    throw new AdminUsersApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export const adminUsersApi = {
  list: (params: {
    search?: string;
    role?: string;
    status?: string;
    authProvider?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.role) query.set("role", params.role);
    if (params.status) query.set("status", params.status);
    if (params.authProvider) query.set("auth_provider", params.authProvider);
    query.set("page", String(params.page ?? 1));
    query.set("page_size", String(params.pageSize ?? 12));
    return request<AdminUsersResponse>(`/api/v1/admin/system/users?${query.toString()}`);
  },

  create: (payload: AdminUserCreatePayload) =>
    request<{ user: AdminUser; message: string }>(
      "/api/v1/admin/system/users",
      { method: "POST", body: JSON.stringify(payload) },
    ),

  update: (userId: number, payload: AdminUserPayload) =>
    request<{ user: AdminUser; message: string }>(
      `/api/v1/admin/system/users/${userId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ),

  setStatus: (userId: number, isActive: boolean) =>
    request<{ user: AdminUser; message: string }>(
      `/api/v1/admin/system/users/${userId}/status`,
      { method: "PATCH", body: JSON.stringify({ isActive }) },
    ),
};
