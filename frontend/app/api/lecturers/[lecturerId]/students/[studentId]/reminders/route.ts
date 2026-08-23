import {
  createStudentReminder,
  StudentNotFoundError,
  ValidationError,
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

export async function POST(
  request: Request,
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
    const body = (await request.json()) as {
      content?: unknown;
    };

    if (typeof body.content !== "string") {
      return Response.json(
        { message: "Trường content là bắt buộc." },
        { status: 400 },
      );
    }

    const reminder = await createStudentReminder(
      lecturerId,
      studentId,
      body.content,
    );

    return Response.json(reminder, { status: 201 });
  } catch (error) {
    if (error instanceof StudentNotFoundError) {
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

    console.error("POST student reminder error:", error);

    return Response.json(
      {
        message:
          "Không thể tạo thông báo nhắc nhở trong PostgreSQL.",
      },
      { status: 500 },
    );
  }
}
