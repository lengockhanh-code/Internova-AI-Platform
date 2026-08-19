from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


def to_iso(
    value: datetime | date | str | None,
):
    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return str(value)


def get_lecturer_students(
    db: Session,
    lecturer_id: int,
):

    rows = db.execute(
        text(
            """
            SELECT
                u.id AS student_id,

                i.id AS internship_id,

                u.full_name,

                sp.student_code,

                u.avatar_url,

                c.name AS company_name,

                i.position_title,

                i.progress_percentage,

                i.status

            FROM internships AS i

            INNER JOIN users AS u
                ON u.id = i.student_id

            LEFT JOIN student_profiles AS sp
                ON sp.student_id = u.id

            LEFT JOIN companies AS c
                ON c.id = i.company_id

            WHERE i.lecturer_id = :lecturer_id
              AND i.status <> 'CANCELLED'

            ORDER BY u.full_name
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().all()


    return [
        {
            "studentId":
                row["student_id"],

            "internshipId":
                row["internship_id"],

            "fullName":
                row["full_name"],

            "studentCode":
                row["student_code"],

            "avatarUrl":
                row["avatar_url"],

            "companyName":
                row["company_name"],

            "positionTitle":
                row["position_title"],

            "progressPercentage":
                float(
                    row["progress_percentage"]
                    or 0
                ),

            "status":
                row["status"],
        }

        for row in rows
    ]


def get_student_detail(
    db: Session,
    student_id: int,
    lecturer_id: int,
):

    student = db.execute(
        text(
            """
            SELECT
                u.id AS student_id,

                i.id AS internship_id,

                u.full_name,

                u.email,

                u.avatar_url,

                sp.student_code,

                sp.faculty,

                sp.major,

                c.name AS company_name,

                i.position_title,

                i.progress_percentage,

                i.start_date,

                i.end_date,

                i.status

            FROM internships AS i

            INNER JOIN users AS u
                ON u.id = i.student_id

            LEFT JOIN student_profiles AS sp
                ON sp.student_id = u.id

            LEFT JOIN companies AS c
                ON c.id = i.company_id

            WHERE i.student_id = :student_id

              AND i.lecturer_id = :lecturer_id

              AND i.status <> 'CANCELLED'

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,

            "lecturer_id":
                lecturer_id,
        },
    ).mappings().first()


    if student is None:
        return None


    notes = db.execute(
        text(
            """
            SELECT
                id,
                note,
                created_at

            FROM lecturer_student_notes

            WHERE student_id = :student_id

              AND lecturer_id = :lecturer_id

            ORDER BY created_at DESC
            """
        ),
        {
            "student_id":
                student_id,

            "lecturer_id":
                lecturer_id,
        },
    ).mappings().all()


    reminders = db.execute(
        text(
            """
            SELECT
                id,
                title,
                description,
                start_time

            FROM calendar_events

            WHERE description LIKE
                :student_marker

              AND user_id = :lecturer_id

            ORDER BY start_time ASC
            """
        ),
        {
            "student_marker":
                f"%[student_id:{student_id}]%",

            "lecturer_id":
                lecturer_id,
        },
    ).mappings().all()


    return {
        "studentId":
            student["student_id"],

        "internshipId":
            student["internship_id"],

        "fullName":
            student["full_name"],

        "email":
            str(student["email"])
            if student["email"]
            else None,

        "studentCode":
            student["student_code"],

        "avatarUrl":
            student["avatar_url"],

        "faculty":
            student["faculty"],

        "major":
            student["major"],

        "companyName":
            student["company_name"],

        "positionTitle":
            student["position_title"],

        "progressPercentage":
            float(
                student[
                    "progress_percentage"
                ]
                or 0
            ),

        "startDate":
            to_iso(
                student["start_date"]
            ),

        "endDate":
            to_iso(
                student["end_date"]
            ),

        "status":
            student["status"],

        "notes": [
            {
                "id":
                    row["id"],

                "content":
                    row["note"],

                "createdAt":
                    to_iso(
                        row["created_at"]
                    ),
            }

            for row in notes
        ],

        "reminders": [
            {
                "id":
                    row["id"],

                "title":
                    row["title"],

                "description":
                    row["description"],

                "remindAt":
                    to_iso(
                        row["start_time"]
                    ),
            }

            for row in reminders
        ],
    }


def create_student_note(
    db: Session,
    student_id: int,
    content: str,
    lecturer_id: int,
):

    row = db.execute(
        text(
            """
            INSERT INTO lecturer_student_notes
            (
                lecturer_id,
                student_id,
                internship_id,
                note
            )

            SELECT
                :lecturer_id,
                :student_id,
                i.id,
                :content

            FROM internships AS i

            WHERE i.student_id = :student_id
              AND i.lecturer_id = :lecturer_id
              AND i.status <> 'CANCELLED'

            LIMIT 1

            RETURNING
                id,
                student_id,
                note,
                created_at
            """
        ),
        {
            "student_id":
                student_id,

            "content":
                content,

            "lecturer_id":
                lecturer_id,
        },
    ).mappings().first()


    if row is None:
        db.rollback()
        return None

    db.commit()


    return {
        "id":
            row["id"],

        "studentId":
            row["student_id"],

        "content":
            row["note"],

        "createdAt":
            to_iso(
                row["created_at"]
            ),
    }


def create_student_reminder(
    db: Session,
    student_id: int,
    title: str,
    description: str | None,
    remind_at: datetime,
    lecturer_id: int,
):

    internship = db.execute(
        text(
            """
            SELECT id

            FROM internships

            WHERE student_id = :student_id

              AND lecturer_id = :lecturer_id

              AND status <> 'CANCELLED'

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,

            "lecturer_id":
                lecturer_id,
        },
    ).mappings().first()


    if internship is None:
        return None


    marker = (
        f"[student_id:{student_id}]"
    )


    description_value = (
        f"{marker} {description}"
        if description
        else marker
    )


    row = db.execute(
        text(
            """
            INSERT INTO calendar_events
            (
                user_id,
                internship_id,
                title,
                description,
                event_type,
                start_time,
                is_all_day
            )

            VALUES
            (
                :lecturer_id,
                :internship_id,
                :title,
                :description,
                'STUDENT_REMINDER',
                :remind_at,
                FALSE
            )

            RETURNING
                id,
                title,
                description,
                start_time
            """
        ),
        {
            "internship_id":
                internship["id"],

            "lecturer_id":
                lecturer_id,

            "title":
                title,

            "description":
                description_value,

            "remind_at":
                remind_at,
        },
    ).mappings().first()


    db.commit()


    return {
        "id":
            row["id"],

        "title":
            row["title"],

        "description":
            row["description"],

        "remindAt":
            to_iso(
                row["start_time"]
            ),
    }
