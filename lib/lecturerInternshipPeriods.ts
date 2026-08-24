export type PeriodStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export interface InternshipPeriod {
  id: number;
  name: string;
  semesterCode: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  totalStudents: number;
  requiredReports: number;
  progressPercentage: number;
  needAttention: number;
  description: string | null;
}

interface InternshipPeriodsResponse {
  periods?: Array<Partial<InternshipPeriod>>;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizePeriod(raw: Partial<InternshipPeriod>): InternshipPeriod {
  const status: PeriodStatus =
    raw.status === "ACTIVE" || raw.status === "COMPLETED"
      ? raw.status
      : "UPCOMING";

  return {
    id: asNumber(raw.id),
    name: String(raw.name ?? "Dot thuc tap"),
    semesterCode: String(raw.semesterCode ?? ""),
    academicYear: String(raw.academicYear ?? ""),
    startDate: String(raw.startDate ?? ""),
    endDate: String(raw.endDate ?? ""),
    status,
    totalStudents: asNumber(raw.totalStudents),
    requiredReports: asNumber(raw.requiredReports),
    progressPercentage: asNumber(raw.progressPercentage),
    needAttention: asNumber(raw.needAttention),
    description:
      typeof raw.description === "string" ? raw.description : null,
  };
}

async function readError(response: Response): Promise<string> {
  const body = await response.text();

  if (!body) {
    return `Backend tra ve loi ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(body) as { detail?: string };
    return parsed.detail || body;
  } catch {
    return body;
  }
}

export async function fetchInternshipPeriods(): Promise<InternshipPeriod[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/internship-periods`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const result = (await response.json()) as InternshipPeriodsResponse;
  return Array.isArray(result.periods)
    ? result.periods.map(normalizePeriod).filter((period) => period.id > 0)
    : [];
}

export async function fetchInternshipPeriod(
  periodId: number,
): Promise<InternshipPeriod> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/internship-periods/${periodId}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return normalizePeriod(
    (await response.json()) as Partial<InternshipPeriod>,
  );
}

export interface UpdateInternshipPeriodPayload {
  name: string;
  semesterCode: string;
  academicYear: string;
  startDate: string;
  endDate: string;
}

export async function updateInternshipPeriod(
  periodId: number,
  payload: UpdateInternshipPeriodPayload,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/internship-periods/${periodId}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function createInternshipPeriod(
  payload: UpdateInternshipPeriodPayload,
): Promise<number> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/lecturers/internship-periods`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const result = (await response.json()) as { id?: number };
  const periodId = asNumber(result.id);

  if (periodId <= 0) {
    throw new Error("Backend khong tra ve ma dot thuc tap vua tao.");
  }

  return periodId;
}
import { lecturerFetch as fetch } from "./lecturerAuth";
