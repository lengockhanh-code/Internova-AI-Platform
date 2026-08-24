export type TimeRange = "1h" | "24h" | "yesterday" | "2d" | "3d" | "7d" | "14d" | "30d";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  rateLimited: boolean;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.rateLimited = status === 429;
  }
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token =
    window.localStorage.getItem("internova_access_token") ||
    window.localStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
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
    let message = `HTTP ${response.status}`;
    let retryAfterSeconds: number | null = null;

    try {
      const body = await response.json();
      const detail = body?.detail;

      if (typeof detail === "string") {
        message = detail;
      } else if (detail && typeof detail === "object") {
        message = detail.message ?? message;
        retryAfterSeconds = typeof detail.retryAfterSeconds === "number"
          ? detail.retryAfterSeconds
          : null;
      }
    } catch {}

    const retryAfterHeader = response.headers.get("retry-after");
    if (!retryAfterSeconds && retryAfterHeader) {
      const parsed = Number(retryAfterHeader);
      retryAfterSeconds = Number.isFinite(parsed) ? parsed : null;
    }

    throw new ApiError(message, response.status, retryAfterSeconds);
  }
  return response.json() as Promise<T>;
}

export const observabilityApi = {
  status: () => request<any>("/api/v1/admin/observability/status"),
  overview: (range: TimeRange) => request<any>(`/api/v1/admin/observability/overview?range=${range}`),
  rag: (range: TimeRange) => request<any>(`/api/v1/admin/observability/rag?range=${range}`),
  llm: (range: TimeRange) => request<any>(`/api/v1/admin/observability/llm?range=${range}`),
  logs: (range: TimeRange, limit = 200) => request<any>(`/api/v1/admin/observability/logs?range=${range}&limit=${limit}`),
  errors: (range: TimeRange, limit = 200) => request<any>(`/api/v1/admin/observability/errors?range=${range}&limit=${limit}`),
  traces: (range: TimeRange, limit = 200) => request<any>(`/api/v1/admin/observability/traces?range=${range}&limit=${limit}`),
  trace: (traceId: string, range: TimeRange = "30d") => request<any>(`/api/v1/admin/observability/traces/${encodeURIComponent(traceId)}?range=${range}`),
  alerts: (range: TimeRange) => request<any>(`/api/v1/admin/observability/alerts?range=${range}`),
  acknowledgeAlert: (id: string) => request<any>(`/api/v1/admin/observability/alerts/${encodeURIComponent(id)}/acknowledge`, { method: "POST" }),
  resolveAlert: (id: string) => request<any>(`/api/v1/admin/observability/alerts/${encodeURIComponent(id)}/resolve`, { method: "POST" }),
};

export function formatMs(value: number | null | undefined): string {
  const ms = Number(value ?? 0);
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatNumber(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

export function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(Number(value ?? 0));
}

export function scorePercent(summary: any, name: string): number | null {
  const avg = summary?.[name]?.avg;
  return typeof avg === "number" ? avg * 100 : null;
}
