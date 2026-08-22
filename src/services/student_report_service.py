from __future__ import annotations

from datetime import (
    datetime,
    time,
    timedelta,
)

from sqlalchemy import text
from sqlalchemy.orm import Session


# ============================================================
# CURRENT INTERNSHIP
# ============================================================

def get_current_internship(
    db: Session,
    student_id: int,
):

    return db.execute(
        text(
            """
            SELECT
                i.id,
                i.semester_id,
                i.start_date,
                i.end_date,
                i.status

            FROM internships AS i

            WHERE i.student_id = :student_id
              AND i.status <> 'CANCELLED'

            ORDER BY

                CASE i.status

                    WHEN 'IN_PROGRESS'
                        THEN 1

                    WHEN 'NOT_STARTED'
                        THEN 2

                    WHEN 'PAUSED'
                        THEN 3

                    WHEN 'COMPLETED'
                        THEN 4

                    ELSE 5

                END,

                i.id DESC

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().first()


def sync_report_progress(
    db: Session,
    internship_id: int,
) -> float:
    row = db.execute(
        text(
            """
            WITH report_stats AS (
                SELECT
                    COUNT(*)::FLOAT AS total,
                    COUNT(*) FILTER (
                        WHERE status IN (
                            'SUBMITTED',
                            'LATE',
                            'UNDER_REVIEW',
                            'REVISION_REQUIRED',
                            'APPROVED'
                        )
                    )::FLOAT AS submitted
                FROM weekly_reports
                WHERE internship_id = :internship_id
            )
            UPDATE internships
            SET
                progress_percentage = CASE
                    WHEN report_stats.total > 0
                        THEN ROUND((report_stats.submitted / report_stats.total * 100)::NUMERIC, 1)
                    ELSE 0
                END,
                updated_at = NOW()
            FROM report_stats
            WHERE internships.id = :internship_id
            RETURNING internships.progress_percentage
            """
        ),
        {
            "internship_id":
                internship_id,
        },
    ).scalar_one_or_none()

    return float(row or 0)


# ============================================================
# RESOLVE REPORT DEADLINE
# ============================================================

def resolve_report_deadline(
    db: Session,

    internship,

    report_type: str,

    week_number:
        int | None,
):

    # ========================================================
    # WEEKLY
    #
    # Nếu kỳ học có cấu hình weekly_report_schedules
    # thì sử dụng deadline đó.
    # ========================================================

    if (
        report_type == "WEEKLY"
        and week_number is not None
        and internship[
            "semester_id"
        ] is not None
    ):

        schedule = db.execute(
            text(
                """
                SELECT
                    id,
                    due_at

                FROM weekly_report_schedules

                WHERE semester_id =
                    :semester_id

                  AND week_number =
                    :week_number

                LIMIT 1
                """
            ),
            {
                "semester_id":
                    internship[
                        "semester_id"
                    ],

                "week_number":
                    week_number,
            },
        ).mappings().first()


        if schedule:

            return (
                schedule["id"],
                schedule["due_at"],
            )


    # ========================================================
    # MIDTERM
    #
    # Không tự đặt deadline tuần 4 hoặc 5.
    # Lấy deadline nếu hệ thống/admin đã cấu hình.
    # ========================================================

    if (
        report_type ==
        "MIDTERM"
    ):

        deadline = db.execute(
            text(
                """
                SELECT
                    due_at

                FROM deadlines

                WHERE is_active = TRUE

                  AND (
                        semester_id IS NULL
                        OR semester_id =
                            :semester_id
                  )

                  AND (
                        target_role IS NULL
                        OR target_role IN (
                            'STUDENT',
                            'ALL'
                        )
                  )

                  AND UPPER(
                        deadline_type
                  ) IN (
                        'MIDTERM',
                        'MIDTERM_REPORT',
                        'MIDTERM_CHECKPOINT'
                  )

                ORDER BY due_at ASC

                LIMIT 1
                """
            ),
            {
                "semester_id":
                    internship[
                        "semester_id"
                    ],
            },
        ).mappings().first()


        return (
            None,

            (
                deadline[
                    "due_at"
                ]
                if deadline
                else None
            ),
        )


    # ========================================================
    # FINAL
    #
    # Closure: mặc định 14 ngày sau end_date.
    # ========================================================

    if (
        report_type ==
        "FINAL"
        and internship[
            "end_date"
        ]
    ):

        end_date = (
            internship[
                "end_date"
            ]
        )


        due_at = (
            datetime.combine(
                end_date,
                time.min,
            )
            +
            timedelta(
                days=14
            )
        )


        return (
            None,
            due_at,
        )


    # ========================================================
    # REFLECTION
    #
    # Chỉ lấy deadline nếu hệ thống đã cấu hình.
    # ========================================================

    if (
        report_type ==
        "REFLECTION"
    ):

        deadline = db.execute(
            text(
                """
                SELECT
                    due_at

                FROM deadlines

                WHERE is_active = TRUE

                  AND (
                        semester_id IS NULL
                        OR semester_id =
                            :semester_id
                  )

                  AND (
                        target_role IS NULL
                        OR target_role IN (
                            'STUDENT',
                            'ALL'
                        )
                  )

                  AND UPPER(
                        deadline_type
                  ) IN (
                        'REFLECTION',
                        'STUDENT_REFLECTION'
                  )

                ORDER BY due_at ASC

                LIMIT 1
                """
            ),
            {
                "semester_id":
                    internship[
                        "semester_id"
                    ],
            },
        ).mappings().first()


        return (
            None,

            (
                deadline[
                    "due_at"
                ]
                if deadline
                else None
            ),
        )


    return (
        None,
        None,
    )


# ============================================================
# GET REPORT LIST
# ============================================================

def get_reports(
    db: Session,
    student_id: int,
):

    internship = (
        get_current_internship(
            db,
            student_id,
        )
    )


    # ========================================================
    # NO INTERNSHIP
    # ========================================================

    if not internship:

        return {
            "has_internship":
                False,

            "reports":
                [],

            "statistics": {
                "total":
                    0,

                "submitted":
                    0,

                "under_review":
                    0,

                "approved":
                    0,

                "progress":
                    0,
            },

            "next_deadline":
                None,
        }


    # ========================================================
    # REPORTS
    # ========================================================

    rows = db.execute(
        text(
            """
            SELECT
                wr.id,
                wr.schedule_id,

                wr.report_type,
                wr.week_number,

                wr.title,
                wr.content,

                wr.status,

                wr.file_name,
                wr.file_size,
                wr.mime_type,

                wr.completion_letter_name,
                wr.completion_letter_size,

                wr.due_at,

                wr.submitted_at,
                wr.reviewed_at,

                wr.lecturer_feedback,
                wr.lecturer_score,

                wr.created_at,
                wr.updated_at

            FROM weekly_reports AS wr

            WHERE wr.internship_id =
                :internship_id

            ORDER BY

                COALESCE(
                    wr.due_at,
                    wr.created_at
                ) DESC
            """
        ),
        {
            "internship_id":
                internship["id"],
        },
    ).mappings().all()


    reports: list[dict] = []


    for row in rows:

        reports.append(
            {
                "id":
                    row["id"],

                "report_type":
                    row[
                        "report_type"
                    ],

                "week_number":
                    row[
                        "week_number"
                    ],

                "title":
                    (
                        row["title"]
                        or
                        "Báo cáo thực tập"
                    ),

                "content":
                    row[
                        "content"
                    ],

                "status":
                    row[
                        "status"
                    ],

                "file_name":
                    row[
                        "file_name"
                    ],

                "file_size":
                    row[
                        "file_size"
                    ],

                "mime_type":
                    row[
                        "mime_type"
                    ],

                "completion_letter_name":
                    row[
                        "completion_letter_name"
                    ],

                "completion_letter_size":
                    row[
                        "completion_letter_size"
                    ],

                "due_at":
                    (
                        row[
                            "due_at"
                        ].isoformat()

                        if row[
                            "due_at"
                        ]

                        else None
                    ),

                "submitted_at":
                    (
                        row[
                            "submitted_at"
                        ].isoformat()

                        if row[
                            "submitted_at"
                        ]

                        else None
                    ),

                "reviewed_at":
                    (
                        row[
                            "reviewed_at"
                        ].isoformat()

                        if row[
                            "reviewed_at"
                        ]

                        else None
                    ),

                "lecturer_feedback":
                    row[
                        "lecturer_feedback"
                    ],

                "lecturer_score":
                    (
                        float(
                            row[
                                "lecturer_score"
                            ]
                        )

                        if row[
                            "lecturer_score"
                        ]
                        is not None

                        else None
                    ),
            }
        )


    # ========================================================
    # STATISTICS
    # ========================================================

    total = len(
        rows
    )


    submitted_statuses = {
        "SUBMITTED",
        "LATE",
        "UNDER_REVIEW",
        "REVISION_REQUIRED",
        "APPROVED",
    }


    submitted = sum(
        1

        for row
        in rows

        if row[
            "status"
        ]
        in submitted_statuses
    )


    under_review = sum(
        1

        for row
        in rows

        if row[
            "status"
        ]
        in {
            "SUBMITTED",
            "LATE",
            "UNDER_REVIEW",
        }
    )


    approved = sum(
        1

        for row
        in rows

        if row[
            "status"
        ]
        == "APPROVED"
    )


    progress = (
        round(
            submitted
            /
            total
            *
            100
        )

        if total > 0

        else 0
    )


    # ========================================================
    # NEXT DEADLINE
    # ========================================================

    next_deadline = db.execute(
        text(
            """
            SELECT
                id,
                title,
                report_type,
                week_number,
                due_at,
                CASE
                    WHEN due_at <= NOW() THEN 'OVERDUE'
                    WHEN due_at <= NOW() + INTERVAL '1 day' THEN 'DUE_NOW'
                    ELSE 'UPCOMING'
                END AS deadline_status

            FROM weekly_reports

            WHERE internship_id =
                :internship_id

              AND due_at IS NOT NULL

              AND status IN (
                    'DRAFT',
                    'REVISION_REQUIRED'
              )

            ORDER BY
                CASE
                    WHEN due_at <= NOW() THEN 0
                    ELSE 1
                END,
                due_at ASC

            LIMIT 1
            """
        ),
        {
            "internship_id":
                internship[
                    "id"
                ],
        },
    ).mappings().first()


    return {
        "has_internship":
            True,

        "reports":
            reports,

        "statistics": {
            "total":
                total,

            "submitted":
                submitted,

            "under_review":
                under_review,

            "approved":
                approved,

            "progress":
                progress,
        },

        "next_deadline":
            (
                {
                    "report_id":
                        next_deadline[
                            "id"
                        ],

                    "title":
                        next_deadline[
                            "title"
                        ],

                    "report_type":
                        next_deadline[
                            "report_type"
                        ],

                    "week_number":
                        next_deadline[
                            "week_number"
                        ],

                    "due_at":
                        next_deadline[
                            "due_at"
                        ].isoformat(),

                    "deadline_status":
                        next_deadline[
                            "deadline_status"
                        ],
                }

                if next_deadline

                else None
            ),
    }


# ============================================================
# CREATE REPORT
# ============================================================

def create_report(
    db: Session,
    student_id: int,
    payload,
):

    internship = (
        get_current_internship(
            db,
            student_id,
        )
    )


    if not internship:

        raise ValueError(
            "Bạn chưa có kỳ thực tập."
        )


    # --------------------------------------------------------
    # WEEKLY phải có week number.
    # --------------------------------------------------------

    if (
        payload.report_type
        == "WEEKLY"

        and
        payload.week_number
        is None
    ):

        raise ValueError(
            "Báo cáo tuần cần số tuần."
        )


    # --------------------------------------------------------
    # Loại khác không có week number.
    # --------------------------------------------------------

    if (
        payload.report_type
        != "WEEKLY"

        and
        payload.week_number
        is not None
    ):

        raise ValueError(
            "Chỉ báo cáo tuần mới có số tuần."
        )


    schedule_id, due_at = (
        resolve_report_deadline(
            db=db,

            internship=
                internship,

            report_type=
                payload.report_type,

            week_number=
                payload.week_number,
        )
    )


    try:

        report_id = db.execute(
            text(
                """
                INSERT INTO weekly_reports
                (
                    internship_id,

                    schedule_id,

                    week_number,

                    report_type,

                    title,

                    content,

                    due_at,

                    status
                )

                VALUES
                (
                    :internship_id,

                    :schedule_id,

                    :week_number,

                    :report_type,

                    :title,

                    :content,

                    :due_at,

                    'DRAFT'
                )

                RETURNING id
                """
            ),
            {
                "internship_id":
                    internship[
                        "id"
                    ],

                "schedule_id":
                    schedule_id,

                "week_number":
                    payload.week_number,

                "report_type":
                    payload.report_type,

                "title":
                    payload.title,

                "content":
                    payload.content,

                "due_at":
                    due_at,
            },
        ).scalar_one()


        sync_report_progress(
            db,
            internship[
                "id"
            ],
        )


        db.commit()


        return report_id


    except Exception:

        db.rollback()

        raise


# ============================================================
# UPDATE REPORT
# ============================================================

def update_report(
    db: Session,

    student_id: int,

    report_id: int,

    title: str,

    content:
        str | None,
):

    result = db.execute(
        text(
            """
            UPDATE weekly_reports AS wr

            SET
                title =
                    :title,

                content =
                    :content,

                updated_at =
                    NOW()

            FROM internships AS i

            WHERE wr.id =
                :report_id

              AND wr.internship_id =
                i.id

              AND i.student_id =
                :student_id

              AND wr.status IN (
                    'DRAFT',
                    'REVISION_REQUIRED'
              )

            RETURNING i.id AS internship_id
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,

            "title":
                title,

            "content":
                content,
        },
    ).first()


    if not result:

        return False


    db.commit()


    return True


# ============================================================
# DELETE REPORT
# ============================================================

def delete_report(
    db: Session,

    student_id: int,

    report_id: int,
):

    result = db.execute(
        text(
            """
            DELETE FROM weekly_reports AS wr

            USING internships AS i

            WHERE wr.id =
                :report_id

              AND wr.internship_id =
                i.id

              AND i.student_id =
                :student_id

              AND wr.status =
                'DRAFT'

            RETURNING i.id AS internship_id
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,
        },
    ).first()


    if not result:

        return False


    sync_report_progress(
        db,
        int(result[0]),
    )


    db.commit()


    return True


# ============================================================
# REPORT FILE
# ============================================================

def save_report_file(
    db: Session,

    student_id: int,

    report_id: int,

    filename: str,

    mime_type: str,

    file_data: bytes,
):

    result = db.execute(
        text(
            """
            UPDATE weekly_reports AS wr

            SET
                file_data =
                    :file_data,

                file_name =
                    :file_name,

                mime_type =
                    :mime_type,

                file_size =
                    :file_size,

                updated_at =
                    NOW()

            FROM internships AS i

            WHERE wr.id =
                :report_id

              AND wr.internship_id =
                i.id

              AND i.student_id =
                :student_id

              AND wr.status IN (
                    'DRAFT',
                    'REVISION_REQUIRED'
              )

            RETURNING wr.id
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,

            "file_data":
                file_data,

            "file_name":
                filename,

            "mime_type":
                mime_type,

            "file_size":
                len(
                    file_data
                ),
        },
    ).first()


    if not result:

        return False


    db.commit()


    return True


def get_report_file(
    db: Session,

    student_id: int,

    report_id: int,
):

    return db.execute(
        text(
            """
            SELECT
                wr.file_data,
                wr.file_name,
                wr.mime_type,
                wr.file_size

            FROM weekly_reports AS wr

            INNER JOIN internships AS i
                ON i.id =
                    wr.internship_id

            WHERE wr.id =
                :report_id

              AND i.student_id =
                :student_id

            LIMIT 1
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,
        },
    ).mappings().first()


# ============================================================
# COMPLETION LETTER
# ============================================================

def save_completion_letter(
    db: Session,

    student_id: int,

    report_id: int,

    filename: str,

    mime_type: str,

    file_data: bytes,
):

    result = db.execute(
        text(
            """
            UPDATE weekly_reports AS wr

            SET
                completion_letter_data =
                    :file_data,

                completion_letter_name =
                    :file_name,

                completion_letter_mime_type =
                    :mime_type,

                completion_letter_size =
                    :file_size,

                updated_at =
                    NOW()

            FROM internships AS i

            WHERE wr.id =
                :report_id

              AND wr.internship_id =
                i.id

              AND i.student_id =
                :student_id

              AND wr.report_type =
                'FINAL'

              AND wr.status IN (
                    'DRAFT',
                    'REVISION_REQUIRED'
              )

            RETURNING wr.id
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,

            "file_data":
                file_data,

            "file_name":
                filename,

            "mime_type":
                mime_type,

            "file_size":
                len(
                    file_data
                ),
        },
    ).first()


    if not result:

        return False


    db.commit()


    return True


def get_completion_letter(
    db: Session,

    student_id: int,

    report_id: int,
):

    return db.execute(
        text(
            """
            SELECT
                wr.completion_letter_data,
                wr.completion_letter_name,
                wr.completion_letter_mime_type,
                wr.completion_letter_size

            FROM weekly_reports AS wr

            INNER JOIN internships AS i
                ON i.id =
                    wr.internship_id

            WHERE wr.id =
                :report_id

              AND i.student_id =
                :student_id

              AND wr.report_type =
                'FINAL'

            LIMIT 1
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,
        },
    ).mappings().first()


# ============================================================
# GET REPORT FOR AI
#
# Chỉ SELECT.
# Không lưu kết quả AI.
# ============================================================

def get_report_for_ai(
    db: Session,

    student_id: int,

    report_id: int,
):

    return db.execute(
        text(
            """
            SELECT
                wr.id,

                wr.report_type,

                wr.content,

                wr.file_data,

                wr.mime_type,

                wr.status,

                i.id AS internship_id

            FROM weekly_reports AS wr

            INNER JOIN internships AS i
                ON i.id =
                    wr.internship_id

            WHERE wr.id =
                :report_id

              AND i.student_id =
                :student_id

            LIMIT 1
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,
        },
    ).mappings().first()


# ============================================================
# SUBMIT REPORT
# ============================================================

def submit_report(
    db: Session,

    student_id: int,

    report_id: int,
):

    report = db.execute(
        text(
            """
            SELECT
                wr.id,

                wr.report_type,

                wr.content,

                wr.file_data,

                wr.completion_letter_data,

                wr.due_at,

                wr.status,

                i.id AS internship_id

            FROM weekly_reports AS wr

            INNER JOIN internships AS i
                ON i.id =
                    wr.internship_id

            WHERE wr.id =
                :report_id

              AND i.student_id =
                :student_id

            LIMIT 1
            """
        ),
        {
            "report_id":
                report_id,

            "student_id":
                student_id,
        },
    ).mappings().first()


    if not report:

        raise ValueError(
            "Không tìm thấy báo cáo."
        )


    # --------------------------------------------------------
    # Status
    # --------------------------------------------------------

    if (
        report["status"]
        not in {
            "DRAFT",
            "REVISION_REQUIRED",
        }
    ):

        raise ValueError(
            "Báo cáo hiện không thể nộp."
        )


    # --------------------------------------------------------
    # Phải có content hoặc file.
    # --------------------------------------------------------

    has_content = bool(
        (
            report[
                "content"
            ]
            or ""
        ).strip()
    )


    has_file = (
        report[
            "file_data"
        ]
        is not None
    )


    if (
        not has_content
        and not has_file
    ):

        raise ValueError(
            "Báo cáo phải có nội dung hoặc file trước khi nộp."
        )


    # --------------------------------------------------------
    # FINAL phải có Letter of Completion.
    # --------------------------------------------------------

    if (
        report[
            "report_type"
        ]
        == "FINAL"

        and

        report[
            "completion_letter_data"
        ]
        is None
    ):

        raise ValueError(
            "Final Report cần Letter of Completion "
            "từ Host Organization trước khi nộp."
        )


    # --------------------------------------------------------
    # Detect late
    # --------------------------------------------------------

    new_status = (
        "SUBMITTED"
    )


    if (
        report[
            "due_at"
        ]

        and

        datetime.now()
        >
        report[
            "due_at"
        ]
    ):

        new_status = (
            "LATE"
        )


    # --------------------------------------------------------
    # Update
    # --------------------------------------------------------

    db.execute(
        text(
            """
            UPDATE weekly_reports

            SET
                status =
                    :status,

                submitted_at =
                    NOW(),

                updated_at =
                    NOW()

            WHERE id =
                :report_id
            """
        ),
        {
            "report_id":
                report_id,

            "status":
                new_status,
        },
    )


    db.commit()


    return new_status