import {
  getLecturerStudentDetail,
  LecturerNotFoundError,
  StudentNotFoundError,
} from "@/services/lecturer-students.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{
    lecturerId: string;
    studentId: string;
  }>;
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { lecturerId, studentId } = await context.params;

  if (
    !UUID_PATTERN.test(lecturerId) ||
    !UUID_PATTERN.test(studentId)
  ) {
    return Response.json(
      { message: "lecturerId hoặc studentId không đúng UUID." },
      { status: 400 },
    );
  }

  try {
    const result = await getLecturerStudentDetail(
      lecturerId,
      studentId,
    );

    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (
      error instanceof LecturerNotFoundError ||
      error instanceof StudentNotFoundError
    ) {
      return Response.json(
        { message: error.message },
        { status: 404 },
      );
    }

    console.error("GET lecturer student detail error:", error);

    return Response.json(
      {
        message:
          "Không thể tải hồ sơ sinh viên từ PostgreSQL.",
      },
      { status: 500 },
    );
  }
}
