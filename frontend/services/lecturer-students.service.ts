import { query } from "@/lib/db";

import type {
  InternshipStatus,
  LecturerStudentsResponse,
  ReportStatus,
  ReportSubmissionStatus,
  StudentDetailResponse,
  WarningSeverity,
} from "@/types/lecturer-students";

export class LecturerNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy tài khoản giảng viên.");
    this.name = "LecturerNotFoundError";
  }
}

export class StudentNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy sinh viên thuộc quyền hướng dẫn của giảng viên.");
    this.name = "StudentNotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface StudentFilters {
  search?: string;
  status?: string;
  companyId?: string;
  reportStatus?: string;
  hasWarning?: boolean;
  page: number;
  limit: number;
}

interface LecturerRow {
  id: string;
  full_name: string;
  academic_title: string | null;
}

interface SummaryRow {
  total_students: number;
  in_progress: number;
  not_started: number;
  paused: number;
  completed: number;
  need_attention: number;
}

interface CompanyRow {
  id: string;
  name: string;
}

interface StudentRow {
  student_id: string;
  internship_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  student_code: string;
  class_name: string | null;
  major: string | null;
  company_id: string;
  company_name: string;
  position_title: string;

  progress_percentage: number;

  report_progress_percentage: number;
  reports_submitted: number;
  reports_required_to_date: number;

  average_score: number;
  warning_count: number;
  internship_status: InternshipStatus;

  latest_report_id: string | null;
  latest_report_week_number: number | null;
  latest_report_status: ReportStatus | null;
  latest_report_submitted_at: Date | string | null;
  latest_report_due_at: Date | string | null;

  latest_schedule_id: string | null;
  latest_required_report_id: string | null;
  latest_required_week_number: number | null;
  latest_required_due_at: Date | string | null;
  latest_required_submitted_at: Date | string | null;
  latest_submission_status: ReportSubmissionStatus | null;
  latest_review_status: ReportStatus | null;
  latest_required_lecturer_score: number | null;

  total_count: number;
}

interface DetailRow {
  student_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  student_code: string;
  faculty: string | null;
  major: string | null;
  class_name: string | null;
  academic_year: string | null;
  gpa: number | null;

  internship_id: string;
  company_name: string;
  company_address: string | null;
  company_website: string | null;
  mentor_name: string | null;
  mentor_position: string | null;
  position_title: string;
  start_date: Date | string;
  end_date: Date | string;
  progress_percentage: number;
  internship_status: InternshipStatus;
  work_mode: string | null;
  lecturer_note: string | null;
  ai_fit_score: number | null;
  ai_fit_summary: string | null;
}

interface EvaluationRow {
  attitude_score: number | null;
  professional_knowledge_score: number | null;
  working_skill_score: number | null;
  report_score: number | null;
  presentation_score: number | null;
  total_score: number | null;
  overall_comment: string | null;
  status: string;
}

interface ReportProgressRow {
  required_to_date: number;
  submitted_to_date: number;
  percentage: number;
}

interface ScheduledReportRow {
  schedule_id: string;
  report_id: string | null;
  week_number: number;
  title: string;
  due_at: Date | string;
  submitted_at: Date | string | null;
  submission_status: ReportSubmissionStatus;
  review_status: ReportStatus | null;
  days_late: number;
  lecturer_score: number | null;
  lecturer_comment: string | null;
  ai_completeness_score: number | null;
  ai_relevance_score: number | null;
  ai_plagiarism_risk: string | null;
  work_completed: string | null;
  knowledge_learned: string | null;
  difficulties: string | null;
  next_week_plan: string | null;
}

interface WarningRow {
  id: string;
  warning_type: string;
  severity: WarningSeverity;
  title: string;
  description: string;
  detected_by: string;
  status: string;
  created_at: Date | string;
}

interface NoteRow {
  id: string;
  content: string;
  is_private: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const INTERNSHIP_STATUSES = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
]);

const REPORT_STATUSES = new Set([
  "DRAFT",
  "SUBMITTED",
  "LATE",
  "UNDER_REVIEW",
  "REVISION_REQUIRED",
  "APPROVED",
]);

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

async function getLecturer(lecturerId: string): Promise<LecturerRow> {
  const rows = await query<LecturerRow>(
    `
      SELECT
        u.id,
        u.full_name,
        lp.academic_title
      FROM internship.users AS u
      LEFT JOIN internship.lecturer_profiles AS lp
        ON lp.lecturer_id = u.id
      WHERE u.id = $1
        AND u.role = 'LECTURER'
        AND u.is_active = TRUE
      LIMIT 1
    `,
    [lecturerId],
  );

  if (!rows[0]) {
    throw new LecturerNotFoundError();
  }

  return rows[0];
}

function validateFilters(filters: StudentFilters): StudentFilters {
  if (filters.status && !INTERNSHIP_STATUSES.has(filters.status)) {
    throw new ValidationError("Trạng thái thực tập không hợp lệ.");
  }

  if (
    filters.reportStatus &&
    !REPORT_STATUSES.has(filters.reportStatus)
  ) {
    throw new ValidationError("Trạng thái báo cáo không hợp lệ.");
  }

  return {
    ...filters,
    search: filters.search?.trim().slice(0, 120) || undefined,
    page: Math.max(1, filters.page),
    limit: Math.min(50, Math.max(1, filters.limit)),
  };
}

export async function getLecturerStudents(
  lecturerId: string,
  rawFilters: StudentFilters,
): Promise<LecturerStudentsResponse> {
  const lecturer = await getLecturer(lecturerId);
  const filters = validateFilters(rawFilters);

  const conditions = [
    "i.lecturer_id = $1",
    "i.status <> 'CANCELLED'",
  ];
  const values: unknown[] = [lecturerId];

  const addParam = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.search) {
    const p = addParam(`%${filters.search}%`);
    conditions.push(`
      (
        u.full_name ILIKE ${p}
        OR u.email ILIKE ${p}
        OR sp.student_code ILIKE ${p}
        OR c.name ILIKE ${p}
        OR i.position_title ILIKE ${p}
      )
    `);
  }

  if (filters.status) {
    conditions.push(`i.status = ${addParam(filters.status)}`);
  }

  if (filters.companyId) {
    conditions.push(`i.company_id = ${addParam(filters.companyId)}`);
  }

  if (filters.reportStatus) {
    conditions.push(
      `lrr.review_status = ${addParam(filters.reportStatus)}`,
    );
  }

  if (filters.hasWarning === true) {
    conditions.push(`
      (
        COALESCE(wc.warning_count, 0) > 0
        OR COALESCE(rs.missing_count, 0) > 0
        OR COALESCE(rs.late_count, 0) > 0
      )
    `);
  }

  if (filters.hasWarning === false) {
    conditions.push(`
      COALESCE(wc.warning_count, 0) = 0
      AND COALESCE(rs.missing_count, 0) = 0
      AND COALESCE(rs.late_count, 0) = 0
    `);
  }

  const limitParam = addParam(filters.limit);
  const offsetParam = addParam((filters.page - 1) * filters.limit);
  const whereSql = conditions.join("\nAND ");

  const [summaryRows, companies, students] = await Promise.all([
    query<SummaryRow>(
      `
        SELECT
          COUNT(*)::INTEGER AS total_students,

          COUNT(*) FILTER (
            WHERE i.status = 'IN_PROGRESS'
          )::INTEGER AS in_progress,

          COUNT(*) FILTER (
            WHERE i.status = 'NOT_STARTED'
          )::INTEGER AS not_started,

          COUNT(*) FILTER (
            WHERE i.status = 'PAUSED'
          )::INTEGER AS paused,

          COUNT(*) FILTER (
            WHERE i.status = 'COMPLETED'
          )::INTEGER AS completed,

          COUNT(*) FILTER (
            WHERE
              EXISTS (
                SELECT 1
                FROM internship.internship_warnings AS iw
                WHERE iw.internship_id = i.id
                  AND iw.status IN ('OPEN', 'IN_PROGRESS')
              )
              OR
              EXISTS (
                SELECT 1
                FROM internship.weekly_report_schedules AS s
                LEFT JOIN internship.weekly_reports AS wr
                  ON wr.internship_id = s.internship_id
                 AND wr.week_number = s.week_number
                WHERE s.internship_id = i.id
                  AND s.is_required = TRUE
                  AND s.due_at < NOW()
                  AND wr.submitted_at IS NULL
              )
              OR
              EXISTS (
                SELECT 1
                FROM internship.weekly_report_schedules AS s
                INNER JOIN internship.weekly_reports AS wr
                  ON wr.internship_id = s.internship_id
                 AND wr.week_number = s.week_number
                WHERE s.internship_id = i.id
                  AND s.is_required = TRUE
                  AND wr.submitted_at > s.due_at
              )
          )::INTEGER AS need_attention

        FROM internship.internships AS i
        WHERE i.lecturer_id = $1
          AND i.status <> 'CANCELLED'
      `,
      [lecturerId],
    ),

    query<CompanyRow>(
      `
        SELECT DISTINCT
          c.id,
          c.name
        FROM internship.internships AS i
        INNER JOIN internship.companies AS c
          ON c.id = i.company_id
        WHERE i.lecturer_id = $1
          AND i.status <> 'CANCELLED'
        ORDER BY c.name
      `,
      [lecturerId],
    ),

    query<StudentRow>(
      `
        WITH latest_report AS (
          SELECT DISTINCT ON (wr.internship_id)
            wr.internship_id,
            wr.id,
            wr.week_number,
            wr.status,
            wr.submitted_at,
            wr.due_at
          FROM internship.weekly_reports AS wr
          ORDER BY
            wr.internship_id,
            COALESCE(wr.submitted_at, wr.created_at) DESC,
            wr.week_number DESC
        ),

        report_stats AS (
          SELECT
            s.internship_id,

            COUNT(*) FILTER (
              WHERE s.is_required = TRUE
                AND s.due_at <= NOW()
            )::INTEGER AS required_to_date,

            COUNT(*) FILTER (
              WHERE s.is_required = TRUE
                AND s.due_at <= NOW()
                AND wr.submitted_at IS NOT NULL
            )::INTEGER AS submitted_to_date,

            COUNT(*) FILTER (
              WHERE s.is_required = TRUE
                AND s.due_at < NOW()
                AND wr.submitted_at IS NULL
            )::INTEGER AS missing_count,

            COUNT(*) FILTER (
              WHERE s.is_required = TRUE
                AND wr.submitted_at IS NOT NULL
                AND wr.submitted_at > s.due_at
            )::INTEGER AS late_count

          FROM internship.weekly_report_schedules AS s
          LEFT JOIN internship.weekly_reports AS wr
            ON wr.internship_id = s.internship_id
           AND wr.week_number = s.week_number
          GROUP BY s.internship_id
        ),

        latest_required_report AS (
          SELECT DISTINCT ON (s.internship_id)
            s.internship_id,
            s.id AS schedule_id,
            s.week_number,
            s.due_at,
            wr.id AS report_id,
            wr.submitted_at,
            wr.status AS review_status,
            wr.lecturer_score,

            CASE
              WHEN wr.submitted_at IS NULL
                   AND s.due_at < NOW()
                THEN 'NOT_SUBMITTED'
              WHEN wr.submitted_at IS NULL
                THEN 'UPCOMING'
              WHEN wr.submitted_at > s.due_at
                THEN 'LATE'
              ELSE 'ON_TIME'
            END AS submission_status

          FROM internship.weekly_report_schedules AS s
          LEFT JOIN internship.weekly_reports AS wr
            ON wr.internship_id = s.internship_id
           AND wr.week_number = s.week_number
          WHERE s.is_required = TRUE
          ORDER BY
            s.internship_id,
            CASE
              WHEN s.due_at <= NOW() THEN 0
              ELSE 1
            END,
            CASE
              WHEN s.due_at <= NOW() THEN s.due_at
            END DESC,
            CASE
              WHEN s.due_at > NOW() THEN s.due_at
            END ASC
        ),

        warning_counts AS (
          SELECT
            iw.internship_id,
            COUNT(*)::INTEGER AS warning_count
          FROM internship.internship_warnings AS iw
          WHERE iw.status IN ('OPEN', 'IN_PROGRESS')
          GROUP BY iw.internship_id
        ),

        score_sources AS (
          SELECT
            e.internship_id,
            e.total_score
          FROM internship.evaluations AS e
          WHERE e.total_score IS NOT NULL
            AND e.status IN ('SUBMITTED', 'CONFIRMED')

          UNION ALL

          SELECT
            wr.internship_id,
            wr.lecturer_score AS total_score
          FROM internship.weekly_reports AS wr
          WHERE wr.lecturer_score IS NOT NULL
        ),

        average_scores AS (
          SELECT
            internship_id,
            ROUND(AVG(total_score) / 10.0, 1)::DOUBLE PRECISION
              AS average_score
          FROM score_sources
          GROUP BY internship_id
        )

        SELECT
          u.id AS student_id,
          i.id AS internship_id,
          u.full_name,
          u.email,
          u.phone,
          u.avatar_url,
          sp.student_code,
          sp.class_name,
          sp.major,
          c.id AS company_id,
          c.name AS company_name,
          i.position_title,

          i.progress_percentage,

          CASE
            WHEN COALESCE(rs.required_to_date, 0) = 0
              THEN 0
            ELSE ROUND(
              (
                COALESCE(rs.submitted_to_date, 0)::NUMERIC
                / rs.required_to_date
              ) * 100
            )::INTEGER
          END AS report_progress_percentage,

          COALESCE(rs.submitted_to_date, 0)::INTEGER
            AS reports_submitted,

          COALESCE(rs.required_to_date, 0)::INTEGER
            AS reports_required_to_date,

          COALESCE(sc.average_score, 0)::DOUBLE PRECISION
            AS average_score,

          (
            COALESCE(wc.warning_count, 0)
            + COALESCE(rs.missing_count, 0)
            + COALESCE(rs.late_count, 0)
          )::INTEGER AS warning_count,

          i.status AS internship_status,

          lr.id AS latest_report_id,
          lr.week_number AS latest_report_week_number,
          lr.status AS latest_report_status,
          lr.submitted_at AS latest_report_submitted_at,
          lr.due_at AS latest_report_due_at,

          lrr.schedule_id AS latest_schedule_id,
          lrr.report_id AS latest_required_report_id,
          lrr.week_number AS latest_required_week_number,
          lrr.due_at AS latest_required_due_at,
          lrr.submitted_at AS latest_required_submitted_at,
          lrr.submission_status AS latest_submission_status,
          lrr.review_status AS latest_review_status,
          lrr.lecturer_score AS latest_required_lecturer_score,

          COUNT(*) OVER()::INTEGER AS total_count

        FROM internship.internships AS i
        INNER JOIN internship.users AS u
          ON u.id = i.student_id
        INNER JOIN internship.student_profiles AS sp
          ON sp.student_id = u.id
        INNER JOIN internship.companies AS c
          ON c.id = i.company_id
        LEFT JOIN latest_report AS lr
          ON lr.internship_id = i.id
        LEFT JOIN report_stats AS rs
          ON rs.internship_id = i.id
        LEFT JOIN latest_required_report AS lrr
          ON lrr.internship_id = i.id
        LEFT JOIN warning_counts AS wc
          ON wc.internship_id = i.id
        LEFT JOIN average_scores AS sc
          ON sc.internship_id = i.id

        WHERE ${whereSql}

        ORDER BY
          CASE
            WHEN COALESCE(rs.missing_count, 0) > 0 THEN 0
            WHEN COALESCE(wc.warning_count, 0) > 0 THEN 1
            WHEN COALESCE(rs.late_count, 0) > 0 THEN 2
            ELSE 3
          END,
          u.full_name

        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      values,
    ),
  ]);

  const summary = summaryRows[0] ?? {
    total_students: 0,
    in_progress: 0,
    not_started: 0,
    paused: 0,
    completed: 0,
    need_attention: 0,
  };

  const total = Number(students[0]?.total_count ?? 0);

  return {
    lecturer: {
      id: lecturer.id,
      fullName: lecturer.full_name,
      academicTitle: lecturer.academic_title,
    },

    summary: {
      totalStudents: Number(summary.total_students),
      inProgress: Number(summary.in_progress),
      notStarted: Number(summary.not_started),
      paused: Number(summary.paused),
      completed: Number(summary.completed),
      needAttention: Number(summary.need_attention),
    },

    companies: companies.map((company) => ({
      id: company.id,
      name: company.name,
    })),

    students: students.map((row) => ({
      studentId: row.student_id,
      internshipId: row.internship_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      studentCode: row.student_code,
      className: row.class_name,
      major: row.major,
      companyId: row.company_id,
      companyName: row.company_name,
      positionTitle: row.position_title,

      progressPercentage: Number(row.progress_percentage),

      reportProgressPercentage: Number(
        row.report_progress_percentage,
      ),
      reportsSubmitted: Number(row.reports_submitted),
      reportsRequiredToDate: Number(
        row.reports_required_to_date,
      ),

      averageScore: Number(row.average_score),
      warningCount: Number(row.warning_count),
      status: row.internship_status,

      latestReport:
        row.latest_report_id &&
        row.latest_report_week_number &&
        row.latest_report_status
          ? {
              id: row.latest_report_id,
              weekNumber: Number(row.latest_report_week_number),
              status: row.latest_report_status,
              submittedAt: toIso(row.latest_report_submitted_at),
              dueAt: toIso(row.latest_report_due_at),
            }
          : null,

      latestRequiredReport:
        row.latest_schedule_id &&
        row.latest_required_week_number &&
        row.latest_required_due_at &&
        row.latest_submission_status
          ? {
              scheduleId: row.latest_schedule_id,
              reportId: row.latest_required_report_id,
              weekNumber: Number(row.latest_required_week_number),
              dueAt: new Date(
                row.latest_required_due_at,
              ).toISOString(),
              submittedAt: toIso(
                row.latest_required_submitted_at,
              ),
              submissionStatus: row.latest_submission_status,
              reviewStatus: row.latest_review_status,
              lecturerScore:
                row.latest_required_lecturer_score === null
                  ? null
                  : Number(row.latest_required_lecturer_score),
            }
          : null,
    })),

    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(
        1,
        Math.ceil(total / filters.limit),
      ),
    },
  };
}


export async function getLecturerStudentDetail(
  lecturerId: string,
  studentId: string,
): Promise<StudentDetailResponse> {
  await getLecturer(lecturerId);

  const rows = await query<DetailRow>(
    `
      SELECT
        u.id AS student_id,
        u.full_name,
        u.email,
        u.phone,
        u.avatar_url,
        sp.student_code,
        sp.faculty,
        sp.major,
        sp.class_name,
        sp.academic_year,
        sp.gpa,

        i.id AS internship_id,
        c.name AS company_name,
        c.address AS company_address,
        c.website AS company_website,
        cm.full_name AS mentor_name,
        cm.position AS mentor_position,
        i.position_title,
        i.start_date,
        i.end_date,
        i.progress_percentage,
        i.status AS internship_status,
        ia.work_mode,
        i.lecturer_note,
        ia.ai_fit_score,
        ia.ai_fit_summary

      FROM internship.internships AS i
      INNER JOIN internship.users AS u
        ON u.id = i.student_id
      INNER JOIN internship.student_profiles AS sp
        ON sp.student_id = u.id
      INNER JOIN internship.companies AS c
        ON c.id = i.company_id
      INNER JOIN internship.internship_applications AS ia
        ON ia.id = i.application_id
      LEFT JOIN internship.company_mentors AS cm
        ON cm.id = i.company_mentor_id

      WHERE i.lecturer_id = $1
        AND i.student_id = $2
        AND i.status <> 'CANCELLED'

      LIMIT 1
    `,
    [lecturerId, studentId],
  );

  const detail = rows[0];

  if (!detail) {
    throw new StudentNotFoundError();
  }

  const [
    evaluations,
    reportProgressRows,
    reports,
    warnings,
    notes,
  ] = await Promise.all([
    query<EvaluationRow>(
      `
        SELECT
          attitude_score,
          professional_knowledge_score,
          working_skill_score,
          report_score,
          presentation_score,
          total_score,
          overall_comment,
          status
        FROM internship.evaluations
        WHERE internship_id = $1
          AND evaluator_type = 'LECTURER'
        ORDER BY COALESCE(
          submitted_at,
          updated_at,
          created_at
        ) DESC
        LIMIT 1
      `,
      [detail.internship_id],
    ),

    query<ReportProgressRow>(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE s.is_required = TRUE
              AND s.due_at <= NOW()
          )::INTEGER AS required_to_date,

          COUNT(*) FILTER (
            WHERE s.is_required = TRUE
              AND s.due_at <= NOW()
              AND wr.submitted_at IS NOT NULL
          )::INTEGER AS submitted_to_date,

          CASE
            WHEN COUNT(*) FILTER (
              WHERE s.is_required = TRUE
                AND s.due_at <= NOW()
            ) = 0
              THEN 0
            ELSE ROUND(
              (
                COUNT(*) FILTER (
                  WHERE s.is_required = TRUE
                    AND s.due_at <= NOW()
                    AND wr.submitted_at IS NOT NULL
                )::NUMERIC
                /
                COUNT(*) FILTER (
                  WHERE s.is_required = TRUE
                    AND s.due_at <= NOW()
                )
              ) * 100
            )::INTEGER
          END AS percentage

        FROM internship.weekly_report_schedules AS s
        LEFT JOIN internship.weekly_reports AS wr
          ON wr.internship_id = s.internship_id
         AND wr.week_number = s.week_number

        WHERE s.internship_id = $1
      `,
      [detail.internship_id],
    ),

    query<ScheduledReportRow>(
      `
        SELECT
          s.id AS schedule_id,
          wr.id AS report_id,
          s.week_number,

          COALESCE(
            wr.title,
            s.title,
            'Báo cáo tuần ' || s.week_number
          ) AS title,

          s.due_at,
          wr.submitted_at,

          CASE
            WHEN wr.submitted_at IS NULL
                 AND s.due_at < NOW()
              THEN 'NOT_SUBMITTED'
            WHEN wr.submitted_at IS NULL
              THEN 'UPCOMING'
            WHEN wr.submitted_at > s.due_at
              THEN 'LATE'
            ELSE 'ON_TIME'
          END AS submission_status,

          wr.status AS review_status,

          CASE
            WHEN wr.submitted_at IS NOT NULL
                 AND wr.submitted_at > s.due_at
              THEN CEIL(
                EXTRACT(
                  EPOCH FROM (
                    wr.submitted_at - s.due_at
                  )
                ) / 86400.0
              )::INTEGER
            ELSE 0
          END AS days_late,

          wr.lecturer_score,
          wr.lecturer_comment,
          wr.ai_completeness_score,
          wr.ai_relevance_score,
          wr.ai_plagiarism_risk,
          wr.work_completed,
          wr.knowledge_learned,
          wr.difficulties,
          wr.next_week_plan

        FROM internship.weekly_report_schedules AS s
        LEFT JOIN internship.weekly_reports AS wr
          ON wr.internship_id = s.internship_id
         AND wr.week_number = s.week_number

        WHERE s.internship_id = $1
          AND s.is_required = TRUE

        ORDER BY s.week_number DESC
      `,
      [detail.internship_id],
    ),

    query<WarningRow>(
      `
        SELECT
          id,
          warning_type,
          severity,
          title,
          description,
          detected_by,
          status,
          created_at
        FROM internship.internship_warnings
        WHERE internship_id = $1
        ORDER BY
          CASE severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            ELSE 4
          END,
          created_at DESC
      `,
      [detail.internship_id],
    ),

    query<NoteRow>(
      `
        SELECT
          id,
          content,
          is_private,
          created_at,
          updated_at
        FROM internship.lecturer_student_notes
        WHERE lecturer_id = $1
          AND student_id = $2
          AND internship_id = $3
        ORDER BY created_at DESC
      `,
      [
        lecturerId,
        studentId,
        detail.internship_id,
      ],
    ),
  ]);

  const evaluation = evaluations[0] ?? null;

  const reportProgress =
    reportProgressRows[0] ?? {
      required_to_date: 0,
      submitted_to_date: 0,
      percentage: 0,
    };

  return {
    student: {
      id: detail.student_id,
      fullName: detail.full_name,
      email: detail.email,
      phone: detail.phone,
      avatarUrl: detail.avatar_url,
      studentCode: detail.student_code,
      faculty: detail.faculty,
      major: detail.major,
      className: detail.class_name,
      academicYear: detail.academic_year,
      gpa:
        detail.gpa === null ||
        detail.gpa === undefined
          ? null
          : Number(detail.gpa),
    },

    internship: {
      id: detail.internship_id,
      companyName: detail.company_name,
      companyAddress: detail.company_address,
      companyWebsite: detail.company_website,
      mentorName: detail.mentor_name,
      mentorPosition: detail.mentor_position,
      positionTitle: detail.position_title,
      startDate: new Date(
        detail.start_date,
      ).toISOString(),
      endDate: new Date(
        detail.end_date,
      ).toISOString(),
      progressPercentage: Number(
        detail.progress_percentage,
      ),
      status: detail.internship_status,
      workMode: detail.work_mode,
      lecturerNote: detail.lecturer_note,
      aiFitScore:
        detail.ai_fit_score === null
          ? null
          : Number(detail.ai_fit_score),
      aiFitSummary: detail.ai_fit_summary,
    },

    evaluation: evaluation
      ? {
          attitudeScore:
            evaluation.attitude_score === null
              ? null
              : Number(evaluation.attitude_score),

          professionalKnowledgeScore:
            evaluation.professional_knowledge_score === null
              ? null
              : Number(
                  evaluation.professional_knowledge_score,
                ),

          workingSkillScore:
            evaluation.working_skill_score === null
              ? null
              : Number(evaluation.working_skill_score),

          reportScore:
            evaluation.report_score === null
              ? null
              : Number(evaluation.report_score),

          presentationScore:
            evaluation.presentation_score === null
              ? null
              : Number(evaluation.presentation_score),

          totalScore:
            evaluation.total_score === null
              ? null
              : Number(evaluation.total_score),

          overallComment: evaluation.overall_comment,
          status: evaluation.status,
        }
      : null,

    reportProgress: {
      requiredToDate: Number(
        reportProgress.required_to_date,
      ),
      submittedToDate: Number(
        reportProgress.submitted_to_date,
      ),
      percentage: Number(
        reportProgress.percentage,
      ),
    },

    reports: reports.map((row) => ({
      scheduleId: row.schedule_id,
      reportId: row.report_id,
      weekNumber: Number(row.week_number),
      title: row.title,
      dueAt: new Date(row.due_at).toISOString(),
      submittedAt: toIso(row.submitted_at),
      submissionStatus: row.submission_status,
      reviewStatus: row.review_status,
      daysLate: Number(row.days_late),

      lecturerScore:
        row.lecturer_score === null
          ? null
          : Number(row.lecturer_score),

      lecturerComment:
        row.lecturer_comment,

      aiCompletenessScore:
        row.ai_completeness_score === null
          ? null
          : Number(
              row.ai_completeness_score,
            ),

      aiRelevanceScore:
        row.ai_relevance_score === null
          ? null
          : Number(
              row.ai_relevance_score,
            ),

      aiPlagiarismRisk:
        row.ai_plagiarism_risk,

      workCompleted:
        row.work_completed,

      knowledgeLearned:
        row.knowledge_learned,

      difficulties:
        row.difficulties,

      nextWeekPlan:
        row.next_week_plan,
    })),

    warnings: warnings.map((row) => ({
      id: row.id,
      warningType: row.warning_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      detectedBy: row.detected_by,
      status: row.status,
      createdAt: new Date(
        row.created_at,
      ).toISOString(),
    })),

    notes: notes.map((row) => ({
      id: row.id,
      content: row.content,
      isPrivate: row.is_private,
      createdAt: new Date(
        row.created_at,
      ).toISOString(),
      updatedAt: new Date(
        row.updated_at,
      ).toISOString(),
    })),
  };
}


export async function createStudentNote(
  lecturerId: string,
  studentId: string,
  content: string,
): Promise<
  StudentDetailResponse["notes"][number]
> {
  const normalized = content.trim();

  if (
    !normalized ||
    normalized.length > 4000
  ) {
    throw new ValidationError(
      "Ghi chú phải có từ 1 đến 4000 ký tự.",
    );
  }

  const internships = await query<{
    internship_id: string;
  }>(
    `
      SELECT
        id AS internship_id
      FROM internship.internships
      WHERE lecturer_id = $1
        AND student_id = $2
        AND status <> 'CANCELLED'
      LIMIT 1
    `,
    [lecturerId, studentId],
  );

  if (!internships[0]) {
    throw new StudentNotFoundError();
  }

  const rows = await query<NoteRow>(
    `
      INSERT INTO internship.lecturer_student_notes (
        lecturer_id,
        student_id,
        internship_id,
        content,
        is_private
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        TRUE
      )
      RETURNING
        id,
        content,
        is_private,
        created_at,
        updated_at
    `,
    [
      lecturerId,
      studentId,
      internships[0].internship_id,
      normalized,
    ],
  );

  const note = rows[0];

  return {
    id: note.id,
    content: note.content,
    isPrivate: note.is_private,
    createdAt: new Date(
      note.created_at,
    ).toISOString(),
    updatedAt: new Date(
      note.updated_at,
    ).toISOString(),
  };
}


export async function createStudentReminder(
  lecturerId: string,
  studentId: string,
  content: string,
): Promise<{
  id: string;
  createdAt: string;
}> {
  const normalized = content.trim();

  if (
    !normalized ||
    normalized.length > 2000
  ) {
    throw new ValidationError(
      "Nội dung nhắc nhở phải có từ 1 đến 2000 ký tự.",
    );
  }

  const internships = await query<{
    internship_id: string;
  }>(
    `
      SELECT
        id AS internship_id
      FROM internship.internships
      WHERE lecturer_id = $1
        AND student_id = $2
        AND status <> 'CANCELLED'
      LIMIT 1
    `,
    [lecturerId, studentId],
  );

  if (!internships[0]) {
    throw new StudentNotFoundError();
  }

  const rows = await query<{
    id: string;
    created_at: Date | string;
  }>(
    `
      INSERT INTO internship.notifications (
        recipient_id,
        notification_type,
        title,
        content,
        related_entity_type,
        related_entity_id
      )
      VALUES (
        $1,
        'LECTURER_REMINDER',
        'Nhắc nhở từ giảng viên',
        $2,
        'INTERNSHIP',
        $3
      )
      RETURNING
        id,
        created_at
    `,
    [
      studentId,
      normalized,
      internships[0].internship_id,
    ],
  );

  return {
    id: rows[0].id,
    createdAt: new Date(
      rows[0].created_at,
    ).toISOString(),
  };
}