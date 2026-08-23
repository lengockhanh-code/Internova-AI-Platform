import { type NextRequest } from "next/server";

import {
  getLecturerStudents,
  LecturerNotFoundError,
  ValidationError,
} from "@/services/lecturer-students.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ lecturerId: string }>;
}

function parsePositiveInt(
  value: string | null,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { lecturerId } = await context.params;

  if (!UUID_PATTERN.test(lecturerId)) {
    return Response.json(
      { message: "lecturerId không đúng định dạng UUID." },
      { status: 400 },
    );
  }

  const params = request.nextUrl.searchParams;
  const warningParam = params.get("hasWarning");

  const hasWarning =
    warningParam === "true"
      ? true
      : warningParam === "false"
        ? false
        : undefined;

  try {
    const result = await getLecturerStudents(lecturerId, {
      search: params.get("search") ?? undefined,
      status: params.get("status") ?? undefined,
      companyId: params.get("companyId") ?? undefined,
      reportStatus: params.get("reportStatus") ?? undefined,
      hasWarning,
      page: parsePositiveInt(params.get("page"), 1),
      limit: parsePositiveInt(params.get("limit"), 10),
    });

    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof LecturerNotFoundError) {
      return Response.json(
        { message: error.message },
        { status: 404 },
      );
    }

    if (error instanceof ValidationError) {
      return Response.json(
        { message: error.message },
        { status: 400 },
      );
    }

    console.error("GET lecturer students error:", error);

    return Response.json(
      {
        message:
          "Không thể tải danh sách sinh viên từ PostgreSQL.",
      },
      { status: 500 },
    );
  }
}
