from __future__ import annotations

from datetime import (
    date,
    datetime,
)

from sqlalchemy import text
from sqlalchemy.orm import Session


CATEGORY_CONFIG = {
    "PROFILE": {
        "title": "Chuẩn bị hồ sơ",
        "subtitle":
            "Hoàn thiện các tài liệu cần thiết trước khi thực tập",
    },

    "WEEKLY": {
        "title": "Công việc trong tuần",
        "subtitle":
            "Theo dõi tiến độ và các đầu việc đang thực hiện",
    },

    "FINAL": {
        "title": "Hoàn tất kỳ thực tập",
        "subtitle":
            "Các đầu việc cần hoàn thành trước khi kết thúc kỳ",
    },
}


def to_iso(
    value:
        datetime |
        date |
        str |
        None,
) -> str | None:

    if value is None:
        return None

    if isinstance(
        value,
        (datetime, date),
    ):
        return value.isoformat()

    return str(value)


# ============================================================
# GET CURRENT STUDENT INTERNSHIP
# ============================================================

def get_student_internship_id(
    db: Session,
    student_id: int,
) -> int | None:

    row = db.execute(
        text(
            """
            SELECT id

            FROM internships

            WHERE student_id = :student_id

              AND status <> 'CANCELLED'

            ORDER BY
                CASE status

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

                id DESC

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().first()


    return (
        row["id"]
        if row
        else None
    )


# ============================================================
# GET CHECKLIST
# ============================================================

def get_checklist(
    db: Session,
    student_id: int,
):

    internship_id = (
        get_student_internship_id(
            db=db,
            student_id=student_id,
        )
    )


    if internship_id is None:
        return {
            "stats": {
                "total": 0,
                "completed": 0,
                "inProgress": 0,
                "pending": 0,
                "progressPercentage": 0,
            },

            "groups": [],

            "nearestDeadline":
                None,
        }


    rows = db.execute(
        text(
            """
            SELECT
                id,
                title,
                description,
                category,
                status,
                priority,
                due_at,
                completed_at

            FROM checklist_items

            WHERE internship_id =
                :internship_id

            ORDER BY

                CASE category
                    WHEN 'PROFILE'
                        THEN 1

                    WHEN 'WEEKLY'
                        THEN 2

                    WHEN 'FINAL'
                        THEN 3

                    ELSE 4
                END,

                due_at ASC NULLS LAST,

                id ASC
            """
        ),
        {
            "internship_id":
                internship_id,
        },
    ).mappings().all()


    total = len(rows)


    completed = sum(
        1
        for row in rows
        if row["status"]
        == "COMPLETED"
    )


    in_progress = sum(
        1
        for row in rows
        if row["status"]
        == "IN_PROGRESS"
    )


    pending = sum(
        1
        for row in rows
        if row["status"]
        == "PENDING"
    )


    progress_percentage = (
        round(
            completed
            / total
            * 100
        )
        if total
        else 0
    )


    groups = []


    for (
        category,
        config,
    ) in CATEGORY_CONFIG.items():

        category_rows = [
            row
            for row in rows
            if row["category"]
            == category
        ]


        if not category_rows:
            continue


        category_completed = sum(
            1
            for row
            in category_rows

            if row["status"]
            == "COMPLETED"
        )


        category_progress = round(
            category_completed
            / len(category_rows)
            * 100
        )


        groups.append(
            {
                "id":
                    category.lower(),

                "title":
                    config["title"],

                "subtitle":
                    config["subtitle"],

                "progress":
                    category_progress,

                "tasks": [
                    {
                        "id":
                            row["id"],

                        "title":
                            row["title"],

                        "description":
                            row["description"],

                        "category":
                            row["category"],

                        "status":
                            row["status"],

                        "priority":
                            row["priority"],

                        "dueAt":
                            to_iso(
                                row["due_at"]
                            ),

                        "completedAt":
                            to_iso(
                                row[
                                    "completed_at"
                                ]
                            ),
                    }

                    for row
                    in category_rows
                ],
            }
        )


    nearest = db.execute(
        text(
            """
            SELECT
                id,
                title,
                due_at

            FROM checklist_items

            WHERE internship_id =
                :internship_id

              AND status <>
                'COMPLETED'

              AND due_at IS NOT NULL

              AND due_at >= NOW()

            ORDER BY due_at ASC

            LIMIT 1
            """
        ),
        {
            "internship_id":
                internship_id,
        },
    ).mappings().first()


    nearest_deadline = None


    if nearest:
        nearest_deadline = {
            "id":
                nearest["id"],

            "title":
                nearest["title"],

            "dueAt":
                to_iso(
                    nearest["due_at"]
                ),
        }


    return {
        "stats": {
            "total":
                total,

            "completed":
                completed,

            "inProgress":
                in_progress,

            "pending":
                pending,

            "progressPercentage":
                progress_percentage,
        },

        "groups":
            groups,

        "nearestDeadline":
            nearest_deadline,
    }


# ============================================================
# CREATE
# ============================================================

def create_checklist_item(
    db: Session,
    student_id: int,
    title: str,
    description: str | None,
    category: str,
    priority: str,
    due_at: datetime | None,
):

    internship_id = (
        get_student_internship_id(
            db,
            student_id,
        )
    )


    if internship_id is None:
        return None


    row = db.execute(
        text(
            """
            INSERT INTO checklist_items
            (
                internship_id,
                title,
                description,
                category,
                status,
                priority,
                due_at
            )

            VALUES
            (
                :internship_id,
                :title,
                :description,
                :category,
                'PENDING',
                :priority,
                :due_at
            )

            RETURNING id
            """
        ),
        {
            "internship_id":
                internship_id,

            "title":
                title,

            "description":
                description,

            "category":
                category,

            "priority":
                priority,

            "due_at":
                due_at,
        },
    ).mappings().first()


    db.commit()

    return row


# ============================================================
# UPDATE STATUS
# ============================================================

def update_checklist_status(
    db: Session,
    student_id: int,
    item_id: int,
    status: str,
):

    internship_id = (
        get_student_internship_id(
            db,
            student_id,
        )
    )


    if internship_id is None:
        return None


    row = db.execute(
        text(
            """
            UPDATE checklist_items

            SET
                status = :status,

                completed_at =
                    CASE
                        WHEN :status =
                            'COMPLETED'

                        THEN NOW()

                        ELSE NULL
                    END,

                updated_at = NOW()

            WHERE id = :item_id

              AND internship_id =
                :internship_id

            RETURNING id
            """
        ),
        {
            "item_id":
                item_id,

            "internship_id":
                internship_id,

            "status":
                status,
        },
    ).mappings().first()


    if row is None:
        return None


    db.commit()

    return row


# ============================================================
# DELETE
# ============================================================

def delete_checklist_item(
    db: Session,
    student_id: int,
    item_id: int,
):

    internship_id = (
        get_student_internship_id(
            db,
            student_id,
        )
    )


    if internship_id is None:
        return False


    row = db.execute(
        text(
            """
            DELETE FROM checklist_items

            WHERE id = :item_id

              AND internship_id =
                :internship_id

            RETURNING id
            """
        ),
        {
            "item_id":
                item_id,

            "internship_id":
                internship_id,
        },
    ).first()


    if row is None:
        return False


    db.commit()

    return True