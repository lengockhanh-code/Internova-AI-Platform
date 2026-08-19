export interface StudentNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  relatedType: string | null;
  relatedId: number | null;
  read: boolean;
  createdAt: string;
}

export interface StudentCalendarEvent {
  id: number;
  source: string;
  title: string;
  description: string | null;
  eventType: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  editable: boolean;
}

export interface StudentNotificationsResponse {
  unreadCount: number;
  notifications: StudentNotification[];
  events: StudentCalendarEvent[];
}

export type StudentNotificationConnectionStatus =
  | "connecting"
  | "connected"
  | "offline";

export interface StudentNotificationRealtimeEvent {
  type: "notification.created";
  notificationId: number;
  messageId: number;
  messageType: "MESSAGE" | "REMINDER" | "WARNING";
  createdAt: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("internova_access_token");
}

const unreadCountEvent = "internova:notification-count";
let notificationSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let currentConnectionStatus: StudentNotificationConnectionStatus = "offline";
const realtimeListeners = new Set<
  (event: StudentNotificationRealtimeEvent) => void
>();
const statusListeners = new Set<
  (status: StudentNotificationConnectionStatus) => void
>();

function websocketUrl(): string {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/api/v1/student/notifications/ws`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function publishStatus(status: StudentNotificationConnectionStatus): void {
  currentConnectionStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

function scheduleReconnect(): void {
  if (reconnectTimer || realtimeListeners.size === 0) return;
  const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
  reconnectAttempt = Math.min(reconnectAttempt + 1, 5);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectNotificationSocket();
  }, delay);
}

function connectNotificationSocket(): void {
  if (typeof window === "undefined" || realtimeListeners.size === 0) return;
  if (
    notificationSocket?.readyState === WebSocket.OPEN
    || notificationSocket?.readyState === WebSocket.CONNECTING
  ) return;

  const accessToken = token();
  if (!accessToken) {
    publishStatus("offline");
    return;
  }

  publishStatus("connecting");
  const socket = new WebSocket(websocketUrl());
  notificationSocket = socket;

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "authenticate", token: accessToken }));
  });

  socket.addEventListener("message", (message) => {
    try {
      const event = JSON.parse(String(message.data)) as {
        type?: string;
        notificationId?: number;
        messageId?: number;
        messageType?: "MESSAGE" | "REMINDER" | "WARNING";
        createdAt?: string;
      };

      if (event.type === "connection.ready") {
        reconnectAttempt = 0;
        publishStatus("connected");
        return;
      }

      if (
        event.type === "notification.created"
        && typeof event.notificationId === "number"
      ) {
        realtimeListeners.forEach((listener) => listener(
          event as StudentNotificationRealtimeEvent,
        ));
      }
    } catch {
      // Ignore malformed messages and keep the connection alive.
    }
  });

  socket.addEventListener("close", (event) => {
    if (notificationSocket === socket) notificationSocket = null;
    publishStatus("offline");
    if (event.code !== 1008) scheduleReconnect();
  });

  socket.addEventListener("error", () => socket.close());
}

export function subscribeStudentNotificationEvents(
  listener: (event: StudentNotificationRealtimeEvent) => void,
  onStatus?: (status: StudentNotificationConnectionStatus) => void,
): () => void {
  realtimeListeners.add(listener);
  if (onStatus) {
    statusListeners.add(onStatus);
    onStatus(currentConnectionStatus);
  }
  connectNotificationSocket();

  return () => {
    realtimeListeners.delete(listener);
    if (onStatus) statusListeners.delete(onStatus);

    if (realtimeListeners.size === 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      notificationSocket?.close(1000, "No active subscribers.");
      notificationSocket = null;
    }
  };
}

export function publishStudentUnreadCount(unreadCount: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(unreadCountEvent, {
    detail: Math.max(0, unreadCount),
  }));
}

export function subscribeStudentUnreadCount(
  listener: (unreadCount: number) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleCount = (event: Event) => {
    const count = (event as CustomEvent<number>).detail;
    if (Number.isFinite(count)) listener(Math.max(0, count));
  };
  window.addEventListener(unreadCountEvent, handleCount);
  return () => window.removeEventListener(unreadCountEvent, handleCount);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = token();
  if (!accessToken) throw new Error("AUTH_REQUIRED");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("AUTH_REQUIRED");
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      throw new Error(parsed.detail || body);
    } catch (error) {
      if (error instanceof Error && error.message !== body) throw error;
      throw new Error(body || `Backend trả về lỗi ${response.status}.`);
    }
  }
  return response;
}

export async function fetchStudentNotifications(year: number, month: number): Promise<StudentNotificationsResponse> {
  const response = await request(`/api/v1/student/notifications-calendar?year=${year}&month=${month}`);
  return (await response.json()) as StudentNotificationsResponse;
}

export async function fetchStudentUnreadCount(): Promise<number> {
  const response = await request("/api/v1/student/notifications-calendar/unread-count");
  const result = (await response.json()) as { unreadCount?: number };
  return Number(result.unreadCount) || 0;
}

export async function setStudentNotificationRead(notificationId: number, isRead: boolean): Promise<void> {
  await request(`/api/v1/student/notifications-calendar/notifications/${notificationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isRead }),
  });
}

export async function markAllStudentNotificationsRead(): Promise<void> {
  await request("/api/v1/student/notifications-calendar/notifications/read-all", { method: "POST" });
}
