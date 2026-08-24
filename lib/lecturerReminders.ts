export type ReminderMessageType = "MESSAGE" | "REMINDER" | "WARNING";
export type AlertSeverity = "INFO" | "WARNING" | "ERROR";

export interface ReminderSummary {
  totalStudents: number;
  needsAttention: number;
  sentMessages: number;
  unreadByStudents: number;
}

export interface ReminderStudent {
  studentId: number;
  internshipId: number;
  studentName: string;
  studentCode: string;
  className: string;
  major: string;
  avatarUrl: string | null;
  companyName: string;
  positionTitle: string;
  internshipStatus: string;
  progressPercentage: number;
  overdueReportCount: number;
  lateReportCount: number;
  pendingReviewCount: number;
  progressBehind: boolean;
  warningCount: number;
  messageCount: number;
  unreadMessageCount: number;
  latestMessage: string | null;
  latestMessageType: ReminderMessageType | null;
  latestMessageAt: string | null;
}

export interface StudentAlert {
  key: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  relatedId: number | null;
  occurredAt: string | null;
}

export interface ReminderMessage {
  id: number;
  messageType: ReminderMessageType;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface LecturerRemindersResponse {
  summary: ReminderSummary;
  students: ReminderStudent[];
}

export interface ReminderConversation {
  student: ReminderStudent;
  alerts: StudentAlert[];
  messages: ReminderMessage[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function apiError(response: Response): Promise<Error> {
  const body = await response.text();
  if (!body) return new Error(`Backend trả về lỗi ${response.status}.`);
  try {
    const parsed = JSON.parse(body) as { detail?: string };
    return new Error(parsed.detail || body);
  } catch {
    return new Error(body);
  }
}

export async function fetchLecturerReminders(): Promise<LecturerRemindersResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lecturers/reminders`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as LecturerRemindersResponse;
}

export async function fetchReminderConversation(studentId: number): Promise<ReminderConversation> {
  const response = await fetch(`${API_BASE_URL}/api/v1/lecturers/reminders/${studentId}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await apiError(response);
  return (await response.json()) as ReminderConversation;
}

export async function sendReminderMessage(
  studentId: number,
  messageType: ReminderMessageType,
  content: string,
): Promise<ReminderMessage> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/reminders/${studentId}/messages`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ messageType, content }),
    },
  );
  if (!response.ok) throw await apiError(response);
  const result = (await response.json()) as { message: ReminderMessage };
  return result.message;
}
import { lecturerFetch as fetch } from "./lecturerAuth";
