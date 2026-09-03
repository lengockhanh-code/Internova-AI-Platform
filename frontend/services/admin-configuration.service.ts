const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type ConfigurationServiceState =
  | "ONLINE"
  | "OFFLINE"
  | "DISABLED"
  | "CONFIGURED"
  | "NOT_CONFIGURED";

export interface AdminConfigurationValues {
  appName: string;
  logLevel: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  sessionTimeoutMinutes: number;
  copilotTimezone: string;
  notificationWorkerEnabled: boolean;
  notificationPollSeconds: number;
  smartDeadlineDaysBefore: number;
  chatRateLimitEnabled: boolean;
  chatRateLimitPerMinute: number;
  llmGuardrailEnabled: boolean;
  dynamicConversationEnabled: boolean;
  llmRoutingEnabled: boolean;
  generalSupportEnabled: boolean;
  chatModel: string;
  embeddingModel: string;
  rerankModel: string;
  llmTemperature: number;
  resultCacheTtlSeconds: number;
  routeCacheTtlSeconds: number;
  retrievalCacheTtlSeconds: number;
  redisEnabled: boolean;
}

export interface AdminConfigurationResponse {
  values: AdminConfigurationValues;
  services: {
    database: ConfigurationServiceState;
    redis: ConfigurationServiceState;
    openai: ConfigurationServiceState;
    googleAuth: ConfigurationServiceState;
    vectorStore: ConfigurationServiceState;
  };
  meta: {
    environment: string;
    source: string;
    updatedAt: string | null;
    restartRequired: boolean;
    sensitiveValuesProtected: boolean;
  };
  message: string | null;
  changedKeys: string[];
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("internova_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1/admin/system/configuration`, {
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
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const adminConfigurationApi = {
  get: () => request<AdminConfigurationResponse>(),
  update: (values: AdminConfigurationValues) =>
    request<AdminConfigurationResponse>({ method: "PUT", body: JSON.stringify(values) }),
};
