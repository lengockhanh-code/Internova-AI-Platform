from __future__ import annotations

from datetime import (
    date,
    datetime,
)

from sqlalchemy import text
from sqlalchemy.orm import Session


def to_iso(
    value: date | datetime | str | None,
) -> str | None:
    if value is None:
        return None

    if isinstance(value, (date, datetime)):
        return value.isoformat()

    return str(value)


def calculate_days(
    due_at,
) -> int:
    if due_at is None:
        return 0

    if isinstance(due_at, str):
        due_date = datetime.fromisoformat(
            due_at
        )
    else:
        due_date = due_at

    if isinstance(due_date, datetime):
        due_date = due_date.date()

    return (
        due_date -
        datetime.now().date()
    ).days


def get_first_name(
    full_name: str,
) -> str:
    parts = full_name.strip().split()

    if not parts:
        return full_name

    return parts[-1]


def get_student_dashboard(
    db: Session,
    student_id: int,
) -> dict:

    # ========================================================
    # USER
    # ========================================================

    user = db.execute(
        text(
            """
            SELECT
                id,
                full_name,
                avatar_url

            FROM users

            WHERE id = :student_id
              AND role = 'STUDENT'
              AND is_active = TRUE

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().first()


    if user is None:
        raise ValueError(
            "Không tìm thấy sinh viên."
        )


    # ========================================================
    # CURRENT INTERNSHIP
    # ========================================================

    internship = db.execute(
        text(
            """
            SELECT
                i.id,
                i.status,

                i.position_title,

                i.start_date,
                i.end_date,

                i.progress_percentage,

                c.name AS company_name

            FROM internships AS i

            LEFT JOIN companies AS c
                ON c.id = i.company_id

            WHERE i.student_id =
                :student_id

              AND i.status <>
                'CANCELLED'

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


    internship_data = None


    if internship:
        internship_data = {
            "id":
                internship["id"],

            "status":
                internship["status"],

            "companyName":
                internship[
                    "company_name"
                ],

            "positionTitle":
                internship[
                    "position_title"
                ],

            "startDate":
                to_iso(
                    internship[
                        "start_date"
                    ]
                ),

            "endDate":
                to_iso(
                    internship[
                        "end_date"
                    ]
                ),

            "progressPercentage":
                float(
                    internship[
                        "progress_percentage"
                    ]
                    or 0
                ),
        }


    # ========================================================
    # DEADLINES
    # ========================================================

    deadline_rows = db.execute(
        text(
            """
            SELECT
                d.id,
                d.title,
                d.deadline_type,
                d.due_at

            FROM deadlines AS d

            WHERE d.is_active = TRUE

              AND d.due_at >= NOW()

              AND (
                    d.target_role IS NULL
                    OR d.target_role IN (
                        'STUDENT',
                        'ALL'
                    )
              )

              AND (
                    d.semester_id IS NULL

                    OR EXISTS (
                        SELECT 1

                        FROM internships AS i

                        WHERE i.student_id =
                            :student_id

                          AND i.semester_id =
                            d.semester_id
                    )
              )

            ORDER BY d.due_at ASC

            LIMIT 3
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().all()


    deadlines = [
        {
            "id":
                row["id"],

            "title":
                row["title"],

            "subtitle":
                row[
                    "deadline_type"
                ],

            "dueAt":
                to_iso(
                    row["due_at"]
                ),

            "countdownDays":
                calculate_days(
                    row["due_at"]
                ),
        }

        for row in deadline_rows
    ]


    # ========================================================
    # WEEKLY PROGRESS
    # ========================================================

    weekly_progress = {
        "weekNumber": None,
        "startDate": None,
        "endDate": None,
        "progressPercentage": 0,
        "tasks": [],
    }


    if internship:
        internship_id = (
            internship["id"]
        )


        schedule = db.execute(
            text(
                """
                SELECT
                    id,
                    week_number,
                    start_date,
                    due_at

                FROM weekly_report_schedules

                WHERE semester_id = (
                    SELECT semester_id

                    FROM internships

                    WHERE id =
                        :internship_id
                )

                  AND start_date <=
                    CURRENT_DATE

                  AND due_at >= NOW()

                ORDER BY week_number

                LIMIT 1
                """
            ),
            {
                "internship_id":
                    internship_id,
            },
        ).mappings().first()


        if schedule:
            week_number = (
                schedule[
                    "week_number"
                ]
            )

            task_rows = db.execute(
                text(
                    """
                    SELECT
                        id,
                        title,
                        status

                    FROM checklist_items

                    WHERE internship_id =
                        :internship_id

                      AND category =
                        'WEEKLY'

                    ORDER BY
                        due_at ASC NULLS LAST,
                        id ASC

                    LIMIT 4
                    """
                ),
                {
                    "internship_id":
                        internship_id,
                },
            ).mappings().all()


            total_tasks = len(
                task_rows
            )

            completed_tasks = sum(
                1
                for task
                in task_rows

                if task["status"]
                == "COMPLETED"
            )


            percentage = (
                round(
                    completed_tasks /
                    total_tasks *
                    100
                )
                if total_tasks
                else 0
            )


            weekly_progress = {
                "weekNumber":
                    int(
                        week_number
                    ),

                "startDate":
                    to_iso(
                        schedule[
                            "start_date"
                        ]
                    ),

                "endDate":
                    to_iso(
                        schedule[
                            "due_at"
                        ]
                    ),

                "progressPercentage":
                    percentage,

                "tasks": [
                    {
                        "id":
                            task["id"],

                        "label":
                            task["title"],

                        "done":
                            task[
                                "status"
                            ]
                            == "COMPLETED",
                    }

                    for task
                    in task_rows
                ],
            }


    return {
        "user": {
            "id":
                user["id"],

            "fullName":
                user["full_name"],

            "firstName":
                get_first_name(
                    user[
                        "full_name"
                    ]
                ),

            "avatarUrl":
                user[
                    "avatar_url"
                ],
        },

        "internship":
            internship_data,

        "deadlines":
            deadlines,

        "weeklyProgress":
            weekly_progress,
    }