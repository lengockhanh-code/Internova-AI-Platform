from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.services.lecturer_common_service import (
    _get_lecturer,
    _to_float,
    _to_int,
    to_iso,
)


def _empty_dashboard() -> dict:
    """
    Response mặc định nếu database chưa có lecturer active.
    Phải khớp LecturerDashboardResponse trong src/models/lecturer.py.
    """

    return {
        "lecturer": {
            "id": None,
            "fullName": "Giảng viên",
            "avatarUrl": None,
            "academicTitle": None,
            "lecturerCode": None,
            "faculty": None,
            "specialization": None,
        },

        "stats": {
            "totalStudents": 0,
            "pendingApplications": 0,
            "pendingReports": 0,
            "openWarnings": 0,
            "averageScore": 0.0,
            "reportsDueToDate": 0,
            "onTimeReports": 0,
            "lateReports": 0,
            "notSubmittedReports": 0,
        },

        "progress": {
            "total": 0,
            "notStarted": 0,
            "inProgress": 0,
            "paused": 0,
            "completed": 0,
        },

        "reportProgress": {
            "requiredToDate": 0,
            "submittedToDate": 0,
            "onTime": 0,
            "late": 0,
            "notSubmitted": 0,
            "upcoming": 0,
        },

        "analytics": {
            "completionRate": 0.0,
            "averageInternshipProgress": 0.0,
            "reportSubmissionRate": 0.0,
            "onTimeRate": 0.0,
            "studentsAtRisk": 0,
            "studentsWithScores": 0,
            "scoreDistribution": [
                {"label": "Dưới 5", "count": 0, "percentage": 0.0},
                {"label": "5 - 6.4", "count": 0, "percentage": 0.0},
                {"label": "6.5 - 7.9", "count": 0, "percentage": 0.0},
                {"label": "8 - 8.9", "count": 0, "percentage": 0.0},
                {"label": "9 - 10", "count": 0, "percentage": 0.0},
            ],
            "riskStudents": [],
        },

        "latestReports": [],
        "students": [],
        "upcomingDeadlines": [],
    }


# =============================================================================
# LECTURER LOOKUP
# =============================================================================


def get_lecturer_dashboard_data(
    db: Session,
    lecturer_id: int | str | None = None,
) -> dict:
    """
    Trả toàn bộ dữ liệu cho dashboard giáo viên.

    Database hiện tại:
        database: internship_ai_db
        schema: public
        IDs: BIGSERIAL / BIGINT

    Weekly report schedule:
        internships.semester_id
            -> weekly_report_schedules.semester_id

    Weekly report:
        internships.id
            -> weekly_reports.internship_id

        weekly_report_schedules.id
            -> weekly_reports.schedule_id

    Nếu weekly_reports.schedule_id đang NULL (dữ liệu cũ),
    service fallback bằng week_number.
    """

    # =========================================================================
    # 1. CURRENT LECTURER
    # =========================================================================

    lecturer = _get_lecturer(
        db=db,
        lecturer_id=lecturer_id,
    )

    if lecturer is None:
        return _empty_dashboard()

    current_lecturer_id = _to_int(
        lecturer["id"]
    )

    params = {
        "lecturer_id": current_lecturer_id,
    }

    lecturer_data = {
        "id": current_lecturer_id,

        "fullName":
            lecturer["full_name"]
            or "Giảng viên",

        "avatarUrl":
            lecturer["avatar_url"],

        "academicTitle":
            lecturer["academic_title"],

        "lecturerCode":
            lecturer["lecturer_code"],

        "faculty":
            lecturer["faculty"],

        "specialization":
            lecturer["specialization"],
    }


    # =========================================================================
    # 2. DASHBOARD STATS
    #
    # Không dùng internship_warnings vì schema mới không có bảng đó.
    #
    # Cảnh báo trên dashboard:
    #     notifications.user_id = lecturer_id
    #     is_read = FALSE
    #     severity WARNING / ERROR
    #
    # Report schedule:
    #     lịch chung theo semester_id.
    # =========================================================================

    stats_row = db.execute(
        text(
            """
            WITH lecturer_internships AS (
                SELECT
                    i.id,
                    i.student_id,
                    i.semester_id

                FROM public.internships AS i

                WHERE i.lecturer_id = :lecturer_id
                  AND i.status <> 'CANCELLED'
            ),

            schedule_reports AS (
                SELECT
                    li.id AS internship_id,
                    li.student_id,
                    li.semester_id,

                    s.id AS schedule_id,
                    s.week_number,

                    COALESCE(
                        wr.due_at,
                        s.due_at
                    ) AS due_at,

                    wr.id AS report_id,
                    wr.submitted_at

                FROM lecturer_internships AS li

                INNER JOIN public.weekly_report_schedules AS s
                    ON s.semester_id = li.semester_id

                LEFT JOIN public.weekly_reports AS wr
                    ON wr.internship_id = li.id
                   AND wr.report_type = 'WEEKLY'

                   AND (
                        wr.schedule_id = s.id

                        OR

                        (
                            wr.schedule_id IS NULL
                            AND wr.week_number = s.week_number
                        )
                   )
            ),

            evaluation_scores AS (
                SELECT
                    li.id AS internship_id,

                    AVG(
                        e.total_score
                    ) AS score

                FROM lecturer_internships AS li

                LEFT JOIN public.evaluations AS e
                    ON e.internship_id = li.id
                   AND e.total_score IS NOT NULL
                   AND e.status IN (
                       'SUBMITTED',
                       'CONFIRMED'
                   )

                GROUP BY li.id
            ),

            report_scores AS (
                SELECT
                    li.id AS internship_id,

                    AVG(
                        wr.lecturer_score
                    ) AS score

                FROM lecturer_internships AS li

                LEFT JOIN public.weekly_reports AS wr
                    ON wr.internship_id = li.id
                   AND wr.lecturer_score IS NOT NULL

                GROUP BY li.id
            ),

            internship_scores AS (
                SELECT
                    li.id AS internship_id,

                    COALESCE(
                        es.score,
                        rs.score
                    ) AS score

                FROM lecturer_internships AS li

                LEFT JOIN evaluation_scores AS es
                    ON es.internship_id = li.id

                LEFT JOIN report_scores AS rs
                    ON rs.internship_id = li.id
            )

            SELECT

                (
                    SELECT
                        COUNT(
                            DISTINCT student_id
                        )::INTEGER

                    FROM lecturer_internships
                ) AS total_students,


                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM public.internship_applications AS ia

                    WHERE ia.assigned_lecturer_id = :lecturer_id

                      AND ia.status IN (
                          'SUBMITTED',
                          'UNDER_REVIEW'
                      )
                ) AS pending_applications,


                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM public.weekly_reports AS wr

                    INNER JOIN lecturer_internships AS li
                        ON li.id = wr.internship_id

                    WHERE wr.status IN (
                        'SUBMITTED',
                        'LATE',
                        'UNDER_REVIEW',
                        'REVISION_REQUIRED'
                    )
                ) AS pending_reports,


                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM public.notifications AS n

                    WHERE n.user_id = :lecturer_id
                      AND n.is_read = FALSE

                      AND n.severity IN (
                          'WARNING',
                          'ERROR'
                      )
                ) AS open_warnings,


                (
                    SELECT
                        COALESCE(
                            ROUND(
                                AVG(score) / 10.0,
                                2
                            ),
                            0
                        )::DOUBLE PRECISION

                    FROM internship_scores

                    WHERE score IS NOT NULL
                ) AS average_score,


                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM schedule_reports AS sr

                    WHERE sr.due_at <= NOW()
                ) AS reports_due_to_date,


                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM schedule_reports AS sr

                    WHERE sr.due_at <= NOW()

                      AND sr.submitted_at IS NOT NULL

                      AND sr.submitted_at <= sr.due_at
                ) AS on_time_reports,


                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM schedule_reports AS sr

                    WHERE sr.submitted_at IS NOT NULL

                      AND sr.submitted_at > sr.due_at
                ) AS late_reports,


                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM schedule_reports AS sr

                    WHERE sr.due_at < NOW()

                      AND sr.submitted_at IS NULL
                ) AS not_submitted_reports
            """
        ),
        params,
    ).mappings().first() or {}


    # =========================================================================
    # 3. INTERNSHIP PROGRESS
    # =========================================================================

    progress_rows = db.execute(
        text(
            """
            SELECT
                i.status,
                COUNT(*)::INTEGER AS quantity

            FROM public.internships AS i

            WHERE i.lecturer_id = :lecturer_id
              AND i.status <> 'CANCELLED'

            GROUP BY i.status
            """
        ),
        params,
    ).mappings().all()

    progress = {
        "NOT_STARTED": 0,
        "IN_PROGRESS": 0,
        "PAUSED": 0,
        "COMPLETED": 0,
    }

    for row in progress_rows:
        status = row["status"]

        if status in progress:
            progress[status] = _to_int(
                row["quantity"]
            )


    # =========================================================================
    # 4. REPORT PROGRESS - TOÀN BỘ SINH VIÊN
    # =========================================================================

    report_progress_row = db.execute(
        text(
            """
            WITH lecturer_internships AS (
                SELECT
                    i.id,
                    i.semester_id

                FROM public.internships AS i

                WHERE i.lecturer_id = :lecturer_id
                  AND i.status <> 'CANCELLED'
            ),

            schedule_reports AS (
                SELECT
                    li.id AS internship_id,

                    s.id AS schedule_id,
                    s.week_number,

                    COALESCE(
                        wr.due_at,
                        s.due_at
                    ) AS due_at,

                    wr.id AS report_id,
                    wr.submitted_at

                FROM lecturer_internships AS li

                INNER JOIN public.weekly_report_schedules AS s
                    ON s.semester_id = li.semester_id

                LEFT JOIN public.weekly_reports AS wr
                    ON wr.internship_id = li.id
                   AND wr.report_type = 'WEEKLY'

                   AND (
                        wr.schedule_id = s.id

                        OR

                        (
                            wr.schedule_id IS NULL
                            AND wr.week_number = s.week_number
                        )
                   )
            )

            SELECT

                COUNT(*) FILTER (
                    WHERE due_at <= NOW()
                )::INTEGER AS required_to_date,


                COUNT(*) FILTER (
                    WHERE due_at <= NOW()
                      AND submitted_at IS NOT NULL
                )::INTEGER AS submitted_to_date,


                COUNT(*) FILTER (
                    WHERE due_at <= NOW()
                      AND submitted_at IS NOT NULL
                      AND submitted_at <= due_at
                )::INTEGER AS on_time,


                COUNT(*) FILTER (
                    WHERE submitted_at IS NOT NULL
                      AND submitted_at > due_at
                )::INTEGER AS late,


                COUNT(*) FILTER (
                    WHERE due_at < NOW()
                      AND submitted_at IS NULL
                )::INTEGER AS not_submitted,


                COUNT(*) FILTER (
                    WHERE due_at > NOW()
                      AND submitted_at IS NULL
                )::INTEGER AS upcoming

            FROM schedule_reports
            """
        ),
        params,
    ).mappings().first() or {}


    # =========================================================================
    # 5. LATEST REPORTS
    #
    # Chỉ lấy report thực tế đã tồn tại.
    # Bao gồm WEEKLY / MIDTERM / FINAL / REFLECTION.
    # =========================================================================

    report_rows = db.execute(
        text(
            """
            SELECT
                wr.id,

                i.student_id,
                i.id AS internship_id,

                u.full_name AS student_name,
                sp.student_code,
                sp.class_name,
                sp.major,
                u.avatar_url,

                wr.week_number,
                wr.report_type,
                wr.status,

                wr.submitted_at,

                COALESCE(
                    wr.due_at,
                    s.due_at
                ) AS effective_due_at,

                wr.lecturer_score,
                wr.lecturer_feedback,

                CASE

                    WHEN COALESCE(
                        wr.due_at,
                        s.due_at
                    ) IS NULL
                    THEN NULL


                    WHEN wr.submitted_at IS NULL
                         AND COALESCE(
                             wr.due_at,
                             s.due_at
                         ) < NOW()
                    THEN 'NOT_SUBMITTED'


                    WHEN wr.submitted_at IS NULL
                    THEN 'UPCOMING'


                    WHEN wr.submitted_at > COALESCE(
                        wr.due_at,
                        s.due_at
                    )
                    THEN 'LATE'


                    ELSE 'ON_TIME'

                END AS submission_status

            FROM public.weekly_reports AS wr

            INNER JOIN public.internships AS i
                ON i.id = wr.internship_id

            INNER JOIN public.users AS u
                ON u.id = i.student_id

            LEFT JOIN public.student_profiles AS sp
                ON sp.student_id = u.id

            LEFT JOIN public.weekly_report_schedules AS s
                ON s.id = wr.schedule_id

            WHERE i.lecturer_id = :lecturer_id

              AND i.status <> 'CANCELLED'

              AND wr.status <> 'DRAFT'

            ORDER BY
                COALESCE(
                    wr.submitted_at,
                    wr.created_at
                ) DESC

            LIMIT 5
            """
        ),
        params,
    ).mappings().all()


    # =========================================================================
    # 6. STUDENTS
    #
    # report_stats:
    #     tiến độ báo cáo theo semester.
    #
    # latest_required_report:
    #     - nếu đã có deadline tới hạn -> tuần gần nhất tới hạn;
    #     - nếu chưa có deadline tới hạn -> deadline sắp tới gần nhất.
    #
    # warning_count:
    #     notifications WARNING/ERROR chưa đọc liên quan student/internship
    #     + report quá hạn chưa nộp
    #     + report nộp muộn.
    # =========================================================================

    student_rows = db.execute(
        text(
            """
            WITH lecturer_internships AS (
                SELECT
                    i.id,
                    i.student_id,
                    i.semester_id,
                    i.company_id,
                    i.position_title,
                    i.progress_percentage,
                    i.status

                FROM public.internships AS i

                WHERE i.lecturer_id = :lecturer_id
                  AND i.status <> 'CANCELLED'
            ),

            schedule_reports AS (
                SELECT
                    li.id AS internship_id,
                    li.student_id,

                    s.id AS schedule_id,
                    s.week_number,
                    s.title,

                    COALESCE(
                        wr.due_at,
                        s.due_at
                    ) AS due_at,

                    wr.id AS report_id,
                    wr.submitted_at,

                    wr.status AS review_status,
                    wr.lecturer_score

                FROM lecturer_internships AS li

                INNER JOIN public.weekly_report_schedules AS s
                    ON s.semester_id = li.semester_id

                LEFT JOIN public.weekly_reports AS wr
                    ON wr.internship_id = li.id
                   AND wr.report_type = 'WEEKLY'

                   AND (
                        wr.schedule_id = s.id

                        OR

                        (
                            wr.schedule_id IS NULL
                            AND wr.week_number = s.week_number
                        )
                   )
            ),

            report_stats AS (
                SELECT
                    sr.internship_id,

                    COUNT(*) FILTER (
                        WHERE sr.due_at <= NOW()
                    )::INTEGER AS required_to_date,


                    COUNT(*) FILTER (
                        WHERE sr.due_at <= NOW()
                          AND sr.submitted_at IS NOT NULL
                    )::INTEGER AS submitted_to_date,


                    COUNT(*) FILTER (
                        WHERE sr.due_at < NOW()
                          AND sr.submitted_at IS NULL
                    )::INTEGER AS missing_count,


                    COUNT(*) FILTER (
                        WHERE sr.submitted_at IS NOT NULL
                          AND sr.submitted_at > sr.due_at
                    )::INTEGER AS late_count

                FROM schedule_reports AS sr

                GROUP BY sr.internship_id
            ),

            latest_required_report AS (
                SELECT DISTINCT ON (
                    sr.internship_id
                )

                    sr.internship_id,

                    sr.schedule_id,
                    sr.report_id,

                    sr.week_number,
                    sr.title,

                    sr.due_at,
                    sr.submitted_at,

                    sr.review_status,
                    sr.lecturer_score,

                    CASE

                        WHEN sr.submitted_at IS NULL
                             AND sr.due_at < NOW()
                        THEN 'NOT_SUBMITTED'


                        WHEN sr.submitted_at IS NULL
                        THEN 'UPCOMING'


                        WHEN sr.submitted_at > sr.due_at
                        THEN 'LATE'


                        ELSE 'ON_TIME'

                    END AS submission_status

                FROM schedule_reports AS sr

                ORDER BY
                    sr.internship_id,

                    CASE
                        WHEN sr.due_at <= NOW()
                        THEN 0
                        ELSE 1
                    END,

                    CASE
                        WHEN sr.due_at <= NOW()
                        THEN sr.due_at
                    END DESC,

                    CASE
                        WHEN sr.due_at > NOW()
                        THEN sr.due_at
                    END ASC
            ),

            notification_warning_counts AS (
                SELECT
                    li.id AS internship_id,

                    COUNT(n.id)::INTEGER
                        AS notification_warning_count

                FROM lecturer_internships AS li

                LEFT JOIN public.notifications AS n
                    ON n.user_id = :lecturer_id

                   AND n.is_read = FALSE

                   AND n.severity IN (
                       'WARNING',
                       'ERROR'
                   )

                   AND (
                        (
                            UPPER(
                                COALESCE(
                                    n.related_type,
                                    ''
                                )
                            ) IN (
                                'INTERNSHIP',
                                'INTERNSHIPS'
                            )

                            AND n.related_id = li.id
                        )

                        OR

                        (
                            UPPER(
                                COALESCE(
                                    n.related_type,
                                    ''
                                )
                            ) IN (
                                'STUDENT',
                                'STUDENTS'
                            )

                            AND n.related_id = li.student_id
                        )
                   )

                GROUP BY li.id
            ),

            evaluation_scores AS (
                SELECT
                    li.id AS internship_id,

                    AVG(
                        e.total_score
                    ) AS score

                FROM lecturer_internships AS li

                LEFT JOIN public.evaluations AS e
                    ON e.internship_id = li.id

                   AND e.total_score IS NOT NULL

                   AND e.status IN (
                       'SUBMITTED',
                       'CONFIRMED'
                   )

                GROUP BY li.id
            ),

            report_scores AS (
                SELECT
                    li.id AS internship_id,

                    AVG(
                        wr.lecturer_score
                    ) AS score

                FROM lecturer_internships AS li

                LEFT JOIN public.weekly_reports AS wr
                    ON wr.internship_id = li.id

                   AND wr.lecturer_score IS NOT NULL

                GROUP BY li.id
            ),

            average_scores AS (
                SELECT
                    li.id AS internship_id,

                    (
                        COALESCE(
                            es.score,
                            rs.score,
                            0
                        )
                        / 10.0
                    )::DOUBLE PRECISION
                        AS average_score

                FROM lecturer_internships AS li

                LEFT JOIN evaluation_scores AS es
                    ON es.internship_id = li.id

                LEFT JOIN report_scores AS rs
                    ON rs.internship_id = li.id
            )

            SELECT
                u.id AS student_id,

                li.id AS internship_id,

                u.full_name AS student_name,

                sp.student_code,
                sp.class_name,
                sp.major,

                u.avatar_url,

                c.name AS company_name,

                li.position_title,

                li.progress_percentage,


                CASE

                    WHEN COALESCE(
                        rs.required_to_date,
                        0
                    ) = 0
                    THEN 0

                    ELSE ROUND(
                        (
                            COALESCE(
                                rs.submitted_to_date,
                                0
                            )::NUMERIC

                            /

                            rs.required_to_date
                        )
                        * 100
                    )

                END::DOUBLE PRECISION
                    AS report_progress_percentage,


                COALESCE(
                    rs.submitted_to_date,
                    0
                )::INTEGER
                    AS reports_submitted,


                COALESCE(
                    rs.required_to_date,
                    0
                )::INTEGER
                    AS reports_required_to_date,


                COALESCE(
                    sc.average_score,
                    0
                )::DOUBLE PRECISION
                    AS average_score,


                (
                    COALESCE(
                        nwc.notification_warning_count,
                        0
                    )

                    +

                    COALESCE(
                        rs.missing_count,
                        0
                    )

                    +

                    COALESCE(
                        rs.late_count,
                        0
                    )
                )::INTEGER
                    AS warning_count,


                li.status,


                lrr.schedule_id,

                lrr.report_id,

                lrr.week_number
                    AS latest_week_number,

                lrr.title
                    AS latest_title,

                lrr.due_at
                    AS latest_due_at,

                lrr.submitted_at
                    AS latest_submitted_at,

                lrr.submission_status,

                lrr.review_status,

                lrr.lecturer_score
                    AS latest_lecturer_score


            FROM lecturer_internships AS li

            INNER JOIN public.users AS u
                ON u.id = li.student_id

            LEFT JOIN public.student_profiles AS sp
                ON sp.student_id = u.id

            LEFT JOIN public.companies AS c
                ON c.id = li.company_id

            LEFT JOIN report_stats AS rs
                ON rs.internship_id = li.id

            LEFT JOIN latest_required_report AS lrr
                ON lrr.internship_id = li.id

            LEFT JOIN notification_warning_counts AS nwc
                ON nwc.internship_id = li.id

            LEFT JOIN average_scores AS sc
                ON sc.internship_id = li.id


            ORDER BY

                CASE

                    WHEN COALESCE(
                        rs.missing_count,
                        0
                    ) > 0
                    THEN 0


                    WHEN COALESCE(
                        nwc.notification_warning_count,
                        0
                    ) > 0
                    THEN 1


                    WHEN COALESCE(
                        rs.late_count,
                        0
                    ) > 0
                    THEN 2


                    WHEN li.status = 'IN_PROGRESS'
                    THEN 3


                    WHEN li.status = 'NOT_STARTED'
                    THEN 4


                    WHEN li.status = 'PAUSED'
                    THEN 5


                    ELSE 6

                END,

                u.full_name

            """
        ),
        params,
    ).mappings().all()


    # =========================================================================
    # 7. UPCOMING DEADLINES
    #
    # Deadline của:
    #     LECTURER
    #     ALL
    #     target_role NULL
    #
    # Chỉ hiện deadline:
    #     - không gắn semester;
    #     - hoặc thuộc semester mà lecturer đang hướng dẫn.
    # =========================================================================

    deadline_rows = db.execute(
        text(
            """
            SELECT
                d.id,
                d.title,
                d.description,
                d.deadline_type,
                d.due_at

            FROM public.deadlines AS d

            WHERE d.due_at >= NOW()

              AND d.is_active = TRUE

              AND (
                    d.target_role IS NULL

                    OR d.target_role IN (
                        'LECTURER',
                        'ALL'
                    )
              )

              AND (
                    d.semester_id IS NULL

                    OR EXISTS (
                        SELECT 1

                        FROM public.internships AS i

                        WHERE i.lecturer_id = :lecturer_id

                          AND i.semester_id = d.semester_id

                          AND i.status <> 'CANCELLED'
                    )
              )

            ORDER BY
                d.due_at ASC

            LIMIT 5
            """
        ),
        params,
    ).mappings().all()


    # =========================================================================
    # 8. ANALYTICS
    # =========================================================================

    total_internships = sum(progress.values())
    completed_internships = progress["COMPLETED"]
    required_reports = _to_int(report_progress_row.get("required_to_date", 0))
    submitted_reports = _to_int(report_progress_row.get("submitted_to_date", 0))
    on_time_reports = _to_int(report_progress_row.get("on_time", 0))

    average_internship_progress = (
        sum(_to_float(row.get("progress_percentage", 0)) for row in student_rows)
        / len(student_rows)
        if student_rows
        else 0.0
    )

    scored_rows = [
        row
        for row in student_rows
        if _to_float(row.get("average_score", 0)) > 0
    ]

    score_buckets = [
        ("Dưới 5", lambda score: score < 5),
        ("5 - 6.4", lambda score: 5 <= score < 6.5),
        ("6.5 - 7.9", lambda score: 6.5 <= score < 8),
        ("8 - 8.9", lambda score: 8 <= score < 9),
        ("9 - 10", lambda score: score >= 9),
    ]

    score_distribution = []
    for label, matches in score_buckets:
        count = sum(
            1
            for row in scored_rows
            if matches(_to_float(row.get("average_score", 0)))
        )
        score_distribution.append(
            {
                "label": label,
                "count": count,
                "percentage": round(
                    count / len(scored_rows) * 100,
                    1,
                ) if scored_rows else 0.0,
            }
        )

    risk_rows = [
        row
        for row in student_rows
        if (
            _to_int(row.get("warning_count", 0)) > 0
            or row.get("status") == "PAUSED"
            or (
                _to_int(row.get("reports_required_to_date", 0)) > 0
                and _to_float(row.get("report_progress_percentage", 0)) < 70
            )
        )
    ]

    risk_students = []
    for row in risk_rows[:5]:
        warning_count = _to_int(row.get("warning_count", 0))
        report_progress = _to_float(row.get("report_progress_percentage", 0))
        is_high_risk = (
            warning_count >= 2
            or row.get("status") == "PAUSED"
            or (
                _to_int(row.get("reports_required_to_date", 0)) > 0
                and report_progress < 50
            )
        )
        risk_students.append(
            {
                "studentId": _to_int(row.get("student_id")),
                "internshipId": _to_int(row.get("internship_id")),
                "studentName": row.get("student_name") or "Sinh viên",
                "studentCode": row.get("student_code"),
                "progressPercentage": _to_float(row.get("progress_percentage", 0)),
                "reportProgressPercentage": report_progress,
                "averageScore": _to_float(row.get("average_score", 0)),
                "warningCount": warning_count,
                "riskLevel": "HIGH" if is_high_risk else "MEDIUM",
            }
        )

    analytics = {
        "completionRate": round(
            completed_internships / total_internships * 100,
            1,
        ) if total_internships else 0.0,
        "averageInternshipProgress": round(average_internship_progress, 1),
        "reportSubmissionRate": round(
            submitted_reports / required_reports * 100,
            1,
        ) if required_reports else 0.0,
        "onTimeRate": round(
            on_time_reports / submitted_reports * 100,
            1,
        ) if submitted_reports else 0.0,
        "studentsAtRisk": len(risk_rows),
        "studentsWithScores": len(scored_rows),
        "scoreDistribution": score_distribution,
        "riskStudents": risk_students,
    }


    # =========================================================================
    # 9. RESPONSE
    # =========================================================================

    return {
        "lecturer": lecturer_data,

        "stats": {
            "totalStudents":
                _to_int(
                    stats_row.get(
                        "total_students",
                        0,
                    )
                ),

            "pendingApplications":
                _to_int(
                    stats_row.get(
                        "pending_applications",
                        0,
                    )
                ),

            "pendingReports":
                _to_int(
                    stats_row.get(
                        "pending_reports",
                        0,
                    )
                ),

            "openWarnings":
                _to_int(
                    stats_row.get(
                        "open_warnings",
                        0,
                    )
                ),

            "averageScore":
                _to_float(
                    stats_row.get(
                        "average_score",
                        0,
                    )
                ),

            "reportsDueToDate":
                _to_int(
                    stats_row.get(
                        "reports_due_to_date",
                        0,
                    )
                ),

            "onTimeReports":
                _to_int(
                    stats_row.get(
                        "on_time_reports",
                        0,
                    )
                ),

            "lateReports":
                _to_int(
                    stats_row.get(
                        "late_reports",
                        0,
                    )
                ),

            "notSubmittedReports":
                _to_int(
                    stats_row.get(
                        "not_submitted_reports",
                        0,
                    )
                ),
        },


        "progress": {
            "total":
                sum(
                    progress.values()
                ),

            "notStarted":
                progress[
                    "NOT_STARTED"
                ],

            "inProgress":
                progress[
                    "IN_PROGRESS"
                ],

            "paused":
                progress[
                    "PAUSED"
                ],

            "completed":
                progress[
                    "COMPLETED"
                ],
        },


        "reportProgress": {
            "requiredToDate":
                _to_int(
                    report_progress_row.get(
                        "required_to_date",
                        0,
                    )
                ),

            "submittedToDate":
                _to_int(
                    report_progress_row.get(
                        "submitted_to_date",
                        0,
                    )
                ),

            "onTime":
                _to_int(
                    report_progress_row.get(
                        "on_time",
                        0,
                    )
                ),

            "late":
                _to_int(
                    report_progress_row.get(
                        "late",
                        0,
                    )
                ),

            "notSubmitted":
                _to_int(
                    report_progress_row.get(
                        "not_submitted",
                        0,
                    )
                ),

            "upcoming":
                _to_int(
                    report_progress_row.get(
                        "upcoming",
                        0,
                    )
                ),
        },

        "analytics": analytics,


        "latestReports": [
            {
                "id":
                    _to_int(
                        row["id"]
                    ),

                "studentId":
                    (
                        _to_int(
                            row[
                                "student_id"
                            ]
                        )
                        if row[
                            "student_id"
                        ] is not None
                        else None
                    ),

                "internshipId":
                    (
                        _to_int(
                            row[
                                "internship_id"
                            ]
                        )
                        if row[
                            "internship_id"
                        ] is not None
                        else None
                    ),

                "studentName":
                    row[
                        "student_name"
                    ],

                "studentCode":
                    row[
                         "student_code"
                    ],

                "className":
                    row[
                         "class_name"
                    ],

                "major":
                    row[
                         "major"
                    ],

                "avatarUrl":
                    row[
                         "avatar_url"
                    ],

                "weekNumber":
                    (
                        _to_int(
                            row[
                                "week_number"
                            ]
                        )
                        if row[
                            "week_number"
                        ] is not None
                        else None
                    ),

                "reportType":
                    row[
                        "report_type"
                    ],

                "status":
                    row[
                        "status"
                    ],

                "submissionStatus":
                    row[
                        "submission_status"
                    ],

                "submittedAt":
                    to_iso(
                        row[
                            "submitted_at"
                        ]
                    ),

                "dueAt":
                    to_iso(
                        row[
                            "effective_due_at"
                        ]
                    ),

                "lecturerScore":
                    (
                        _to_float(
                            row[
                                "lecturer_score"
                            ]
                        )
                        if row[
                            "lecturer_score"
                        ] is not None
                        else None
                    ),

                "lecturerFeedback":
                    row[
                        "lecturer_feedback"
                    ],
            }

            for row in report_rows
        ],


        "students": [
            {
                "studentId":
                    _to_int(
                        row[
                            "student_id"
                        ]
                    ),

                "internshipId":
                    _to_int(
                        row[
                            "internship_id"
                        ]
                    ),

                "studentName":
                    row[
                        "student_name"
                    ],

                "studentCode":
                    row[
                        "student_code"
                    ],

                "className":
                    row[
                        "class_name"
                    ],

                "major":
                    row[
                        "major"
                    ],

                "avatarUrl":
                    row[
                        "avatar_url"
                    ],

                "companyName":
                    row[
                        "company_name"
                    ],

                "positionTitle":
                    row[
                        "position_title"
                    ],

                "progressPercentage":
                    _to_float(
                        row[
                            "progress_percentage"
                        ]
                    ),

                "reportProgressPercentage":
                    _to_float(
                        row[
                            "report_progress_percentage"
                        ]
                    ),

                "reportsSubmitted":
                    _to_int(
                        row[
                            "reports_submitted"
                        ]
                    ),

                "reportsRequiredToDate":
                    _to_int(
                        row[
                            "reports_required_to_date"
                        ]
                    ),

                "averageScore":
                    _to_float(
                        row[
                            "average_score"
                        ]
                    ),

                "warningCount":
                    _to_int(
                        row[
                            "warning_count"
                        ]
                    ),

                "status":
                    row[
                        "status"
                    ],

                "latestRequiredReport":
                    (
                        {
                            "scheduleId":
                                _to_int(
                                    row[
                                        "schedule_id"
                                    ]
                                ),

                            "reportId":
                                (
                                    _to_int(
                                        row[
                                            "report_id"
                                        ]
                                    )
                                    if row[
                                        "report_id"
                                    ] is not None
                                    else None
                                ),

                            "weekNumber":
                                _to_int(
                                    row[
                                        "latest_week_number"
                                    ]
                                ),

                            "title":
                                row[
                                    "latest_title"
                                ],

                            "dueAt":
                                to_iso(
                                    row[
                                        "latest_due_at"
                                    ]
                                ),

                            "submittedAt":
                                to_iso(
                                    row[
                                        "latest_submitted_at"
                                    ]
                                ),

                            "submissionStatus":
                                row[
                                    "submission_status"
                                ],

                            "reviewStatus":
                                row[
                                    "review_status"
                                ],

                            "lecturerScore":
                                (
                                    _to_float(
                                        row[
                                            "latest_lecturer_score"
                                        ]
                                    )
                                    if row[
                                        "latest_lecturer_score"
                                    ] is not None
                                    else None
                                ),
                        }

                        if row[
                            "schedule_id"
                        ] is not None

                        else None
                    ),
            }

            for row in student_rows[:8]
        ],


        "upcomingDeadlines": [
            {
                "id":
                    _to_int(
                        row[
                            "id"
                        ]
                    ),

                "title":
                    row[
                        "title"
                    ],

                "description":
                    row[
                        "description"
                    ],

                "deadlineType":
                    row[
                        "deadline_type"
                    ],

                "dueAt":
                    to_iso(
                        row[
                            "due_at"
                        ]
                    ),
            }

            for row in deadline_rows
        ],
    }
