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


def _map_checklist_item(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "category": row["category"],
        "status": row["status"],
        "priority": row["priority"],
        "dueAt": to_iso(row["due_at"]),
        "completedAt": to_iso(row["completed_at"]),
    }


def _build_checklist_group(
    *,
    group_id: int | None,
    client_id: str,
    title: str,
    subtitle: str,
    rows,
):
    completed = sum(
        1
        for row in rows
        if row["status"] == "COMPLETED"
    )
    progress = (
        round(completed / len(rows) * 100)
        if rows
        else 0
    )
    return {
        "id": client_id,
        "groupId": group_id,
        "title": title,
        "subtitle": subtitle,
        "progress": progress,
        "tasks": [
            _map_checklist_item(row)
            for row in rows
        ],
    }


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
                group_id,
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


    group_rows = db.execute(
        text(
            """
            SELECT
                id,
                title,
                category
            FROM checklist_groups
            WHERE internship_id = :internship_id
            ORDER BY
                CASE category
                    WHEN 'PROFILE' THEN 1
                    WHEN 'WEEKLY' THEN 2
                    WHEN 'FINAL' THEN 3
                    ELSE 4
                END,
                due_at ASC NULLS LAST,
                id ASC
            """
        ),
        {
            "internship_id": internship_id,
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

    for group_row in group_rows:
        current_group_rows = [
            row
            for row in rows
            if row["group_id"] == group_row["id"]
        ]
        config = CATEGORY_CONFIG.get(
            group_row["category"],
            {},
        )
        groups.append(
            _build_checklist_group(
                group_id=int(group_row["id"]),
                client_id=f"group-{group_row['id']}",
                title=group_row["title"],
                subtitle=config.get(
                    "subtitle",
                    "Danh sách công việc",
                ),
                rows=current_group_rows,
            )
        )

    for category, config in CATEGORY_CONFIG.items():
        legacy_rows = [
            row
            for row in rows
            if row["group_id"] is None
            and row["category"] == category
        ]
        if legacy_rows:
            groups.append(
                _build_checklist_group(
                    group_id=None,
                    client_id=f"legacy-{category.lower()}",
                    title=config["title"],
                    subtitle=config["subtitle"],
                    rows=legacy_rows,
                )
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

    rows = create_checklist_items(
        db=db,
        student_id=student_id,
        items=[
            {
                "title": title,
                "description": description,
                "category": category,
                "priority": priority,
                "due_at": due_at,
            }
        ],
    )

    return rows[0] if rows else None


def create_checklist_items(
    db: Session,
    student_id: int,
    items: list[dict],
):

    internship_id = (
        get_student_internship_id(
            db,
            student_id,
        )
    )


    if internship_id is None:
        return None

    try:
        created_rows = _insert_checklist_items(
            db=db,
            internship_id=internship_id,
            items=items,
        )
        db.commit()
        return created_rows
    except Exception:
        db.rollback()
        raise


def _insert_checklist_items(
    db: Session,
    internship_id: int,
    items: list[dict],
):
    created_rows = []

    for item in items:
        row = db.execute(
            text(
                """
                INSERT INTO checklist_items
                (
                    internship_id,
                    group_id,
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
                    :group_id,
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
                "internship_id": internship_id,
                "group_id": item.get("group_id"),
                "title": item["title"],
                "description": item.get("description"),
                "category": item["category"],
                "priority": item["priority"],
                "due_at": item.get("due_at"),
            },
        ).mappings().first()

        if row is None:
            raise RuntimeError(
                "Không thể tạo công việc checklist."
            )

        created_rows.append(row)

    return created_rows


def create_checklist_group(
    db: Session,
    student_id: int,
    title: str,
    category: str,
    priority: str,
    due_at: datetime | None,
    task_titles: list[str],
):
    internship_id = get_student_internship_id(
        db,
        student_id,
    )
    if internship_id is None:
        return None

    try:
        group_id = db.execute(
            text(
                """
                INSERT INTO checklist_groups (
                    internship_id,
                    title,
                    category,
                    priority,
                    due_at
                )
                VALUES (
                    :internship_id,
                    :title,
                    :category,
                    :priority,
                    :due_at
                )
                RETURNING id
                """
            ),
            {
                "internship_id": internship_id,
                "title": title,
                "category": category,
                "priority": priority,
                "due_at": due_at,
            },
        ).scalar_one()

        rows = _insert_checklist_items(
            db=db,
            internship_id=internship_id,
            items=[
                {
                    "group_id": group_id,
                    "title": task_title,
                    "description": None,
                    "category": category,
                    "priority": priority,
                    "due_at": due_at,
                }
                for task_title in task_titles
            ],
        )
        db.commit()
        return int(group_id), rows
    except Exception:
        db.rollback()
        raise


def add_checklist_group_tasks(
    db: Session,
    student_id: int,
    group_id: int,
    task_titles: list[str],
):
    internship_id = get_student_internship_id(
        db,
        student_id,
    )
    if internship_id is None:
        return None

    group = db.execute(
        text(
            """
            SELECT category, priority, due_at
            FROM checklist_groups
            WHERE id = :group_id
              AND internship_id = :internship_id
            """
        ),
        {
            "group_id": group_id,
            "internship_id": internship_id,
        },
    ).mappings().first()
    if group is None:
        return None

    try:
        rows = _insert_checklist_items(
            db=db,
            internship_id=internship_id,
            items=[
                {
                    "group_id": group_id,
                    "title": title,
                    "description": None,
                    "category": group["category"],
                    "priority": group["priority"],
                    "due_at": group["due_at"],
                }
                for title in task_titles
            ],
        )
        db.commit()
        return rows
    except Exception:
        db.rollback()
        raise


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


def update_checklist_item(
    db: Session,
    student_id: int,
    item_id: int,
    title: str,
):
    internship_id = get_student_internship_id(
        db,
        student_id,
    )
    if internship_id is None:
        return None

    row = db.execute(
        text(
            """
            UPDATE checklist_items
            SET title = :title,
                updated_at = NOW()
            WHERE id = :item_id
              AND internship_id = :internship_id
            RETURNING id
            """
        ),
        {
            "title": title,
            "item_id": item_id,
            "internship_id": internship_id,
        },
    ).mappings().first()
    if row is None:
        return None

    db.commit()
    return row


def update_checklist_group(
    db: Session,
    student_id: int,
    group_id: int,
    title: str,
):
    internship_id = get_student_internship_id(
        db,
        student_id,
    )
    if internship_id is None:
        return None

    row = db.execute(
        text(
            """
            UPDATE checklist_groups
            SET title = :title,
                updated_at = NOW()
            WHERE id = :group_id
              AND internship_id = :internship_id
            RETURNING id
            """
        ),
        {
            "title": title,
            "group_id": group_id,
            "internship_id": internship_id,
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


def delete_checklist_group(
    db: Session,
    student_id: int,
    group_id: int,
):
    internship_id = get_student_internship_id(
        db,
        student_id,
    )
    if internship_id is None:
        return False

    row = db.execute(
        text(
            """
            DELETE FROM checklist_groups
            WHERE id = :group_id
              AND internship_id = :internship_id
            RETURNING id
            """
        ),
        {
            "group_id": group_id,
            "internship_id": internship_id,
        },
    ).first()
    if row is None:
        return False

    db.commit()
    return True
