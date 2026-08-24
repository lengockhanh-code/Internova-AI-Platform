import { API_BASE_URL, lecturerFetch } from "@/lib/lecturerAuth";

export type LecturerNotificationSeverity =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR";
export type LecturerNotificationStatus = "ALL" | "UNREAD" | "READ";

export interface LecturerNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  severity: LecturerNotificationSeverity;
  relatedType: string | null;
  relatedId: number | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface LecturerNotificationsResponse {
  summary: {
    total: number;
    unread: number;
    read: number;
    warnings: number;
    today: number;
  };
  notifications: LecturerNotification[];
  availableTypes: string[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface LecturerNotificationFilters {
  status: LecturerNotificationStatus;
  severity: LecturerNotificationSeverity | "ALL" | "ATTENTION";
  type: string;
  search: string;
  period: "ALL" | "TODAY";
  page: number;
  pageSize?: number;
}

const countEvent = "internova:lecturer-notification-count";

async function notificationRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await lecturerFetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      throw new Error(parsed.detail || `Backend trả về lỗi ${response.status}.`);
    } catch (error) {
      if (error instanceof Error && error.message !== body) throw error;
      throw new Error(body || `Backend trả về lỗi ${response.status}.`);
    }
  }
  return response;
}

export function publishLecturerUnreadCount(unreadCount: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(countEvent, {
    detail: Math.max(0, unreadCount),
  }));
}

export function subscribeLecturerUnreadCount(
  listener: (unreadCount: number) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleCount = (event: Event) => {
    const count = (event as CustomEvent<number>).detail;
    if (Number.isFinite(count)) listener(Math.max(0, count));
  };
  window.addEventListener(countEvent, handleCount);
  return () => window.removeEventListener(countEvent, handleCount);
}

export async function fetchLecturerUnreadCount(): Promise<number> {
  const response = await notificationRequest(
    "/api/v1/lecturers/notifications/unread-count",
  );
  const result = (await response.json()) as { unreadCount?: number };
  return Number(result.unreadCount) || 0;
}

export async function fetchLecturerNotifications(
  filters: LecturerNotificationFilters,
): Promise<LecturerNotificationsResponse> {
  const params = new URLSearchParams({
    status: filters.status,
    severity: filters.severity,
    type: filters.type || "ALL",
    period: filters.period,
    page: String(filters.page),
    pageSize: String(filters.pageSize ?? 12),
  });
  if (filters.search.trim()) params.set("search", filters.search.trim());

  const response = await notificationRequest(
    `/api/v1/lecturers/notifications?${params.toString()}`,
  );
  return (await response.json()) as LecturerNotificationsResponse;
}

export async function setLecturerNotificationRead(
  notificationId: number,
  isRead: boolean,
): Promise<void> {
  await notificationRequest(`/api/v1/lecturers/notifications/${notificationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isRead }),
  });
}

export async function markAllLecturerNotificationsRead(): Promise<void> {
  await notificationRequest("/api/v1/lecturers/notifications/read-all", {
    method: "POST",
  });
}

export async function deleteLecturerNotification(
  notificationId: number,
): Promise<void> {
  await notificationRequest(`/api/v1/lecturers/notifications/${notificationId}`, {
    method: "DELETE",
  });
}

export async function deleteReadLecturerNotifications(): Promise<void> {
  await notificationRequest("/api/v1/lecturers/notifications/read", {
    method: "DELETE",
  });
}
