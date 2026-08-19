export type TimeRange = "1h" | "24h" | "7d" | "30d";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

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
    try {
      const body = await response.json();
      message = body?.detail ?? message;
    } catch {}
    throw new Error(message);
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
