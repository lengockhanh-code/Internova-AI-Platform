const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type AuditOutcome = "SUCCESS" | "FAILED";
export type AuditSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AdminAuditLog {
  id: number;
  eventId: string;
  requestId: string;
  actor: {
    id: number | null;
    name: string;
    email: string | null;
    role: string | null;
  };
  action: string;
  category: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceLabel: string | null;
  outcome: AuditOutcome;
  severity: AuditSeverity;
  httpMethod: string;
  requestPath: string;
  httpStatus: number;
  ipAddress: string | null;
  userAgent: string | null;
  detail: string;
  metadata: Record<string, unknown>;
  durationMs: number;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  items: AdminAuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    total: number;
    success: number;
    failed: number;
    highRisk: number;
    activeActors: number;
    successRate: number;
  };
  trend: Array<{ date: string; success: number; failed: number }>;
  categories: Array<{ value: string; label: string; count: number }>;
  actors: Array<{ id: number; name: string; email: string | null }>;
}

export interface AuditLogFilters {
  search?: string;
  category?: string;
  outcome?: string;
  severity?: string;
  actorId?: number | null;
  timeRange?: "24h" | "7d" | "30d" | "all";
  page?: number;
  pageSize?: number;
}

export class AdminAuditLogsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAuditLogsApiError";
    this.status = status;
  }
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("internova_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function queryString(filters: AuditLogFilters): string {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.category) query.set("category", filters.category);
  if (filters.outcome) query.set("outcome", filters.outcome);
  if (filters.severity) query.set("severity", filters.severity);
  if (filters.actorId) query.set("actor_id", String(filters.actorId));
  query.set("time_range", filters.timeRange ?? "7d");
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("page_size", String(filters.pageSize));
  return query.toString();
}

async function errorMessage(response: Response): Promise<string> {
  let message = `Yêu cầu thất bại (${response.status}).`;
  try {
    const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail)) {
      message = body.detail.map((item) => item.msg).filter(Boolean).join(" ") || message;
    }
  } catch {}
  return message;
}

export const adminAuditLogsApi = {
  async list(filters: AuditLogFilters): Promise<AdminAuditLogsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/admin/system/audit-logs?${queryString(filters)}`,
      { cache: "no-store", headers: { Accept: "application/json", ...authHeaders() } },
    );
    if (!response.ok) throw new AdminAuditLogsApiError(await errorMessage(response), response.status);
    return response.json() as Promise<AdminAuditLogsResponse>;
  },

  async exportCsv(filters: AuditLogFilters): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/admin/system/audit-logs/export?${queryString(filters)}`,
      { cache: "no-store", headers: { Accept: "text/csv", ...authHeaders() } },
    );
    if (!response.ok) throw new AdminAuditLogsApiError(await errorMessage(response), response.status);
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "internova-audit-logs.csv";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
