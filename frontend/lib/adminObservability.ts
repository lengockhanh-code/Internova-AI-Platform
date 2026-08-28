export type TimeRange = "1h" | "24h" | "yesterday" | "2d" | "3d" | "7d" | "14d" | "30d";

export type ScoreSummary = Record<string, { avg: number | null; count: number }>;

export interface OverviewResponse {
  requests: { total: number; error_rate_pct: number; active_users: number; active_sessions: number };
  latency: { p50_ms: number; p95_ms: number; p99_ms: number; avg_ms: number };
  traffic: { points: Array<{ time: string; value: number }>; peak: number; bucket_minutes: number };
  quality: ScoreSummary;
  llm: { calls: number; total_cost_usd: number; total_tokens: number; avg_cost_per_request_usd: number };
  pipeline: Array<{ name: string; count: number; avg_ms: number; p95_ms: number; errors: number }>;
  service_health: Array<{ name: string; status: string; p95_ms: number; error_rate_pct: number }>;
  data_truncated: boolean;
}

export interface RagAnalyticsResponse {
  queries: number;
  no_answer_rate_pct: number;
  retrieval_calls: number;
  rerank_calls: number;
  retrieval: { avg_vector_hits: number; avg_bm25_hits: number; avg_fused_hits: number; zero_result_rate_pct: number };
  quality: ScoreSummary;
  pipeline: OverviewResponse["pipeline"];
  rerank: {
    used_reranker_calls: number;
    fallback_calls: number;
    fallback_rate_pct: number;
    fallback_reasons: Array<{ reason: string; count: number }>;
  };
  intents: Array<{ name: string; count: number }>;
  scopes: Array<{ name: string; count: number }>;
  data_truncated: boolean;
}

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
  const token = window.localStorage.getItem("internova_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let redirectingToAdminLogin = false;

function handleAdminAuthFailure(status: number): void {
  if (
    typeof window === "undefined" ||
    (status !== 401 && status !== 403) ||
    redirectingToAdminLogin
  ) {
    return;
  }

  redirectingToAdminLogin = true;
  window.localStorage.removeItem("internova_access_token");
  window.localStorage.removeItem("internova_user");

  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(
    `/admin/login?next=${encodeURIComponent(next)}`,
  );
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
    handleAdminAuthFailure(response.status);

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
  overview: (range: TimeRange) => request<OverviewResponse>(`/api/v1/admin/observability/overview?range=${range}`),
  rag: (range: TimeRange) => request<RagAnalyticsResponse>(`/api/v1/admin/observability/rag?range=${range}`),
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

export function scorePercent(summary: ScoreSummary | null | undefined, name: string): number | null {
  const avg = summary?.[name]?.avg;
  return typeof avg === "number" ? avg * 100 : null;
}
