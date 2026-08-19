from __future__ import annotations

from datetime import (
    date,
    datetime,
)

from sqlalchemy import text
from sqlalchemy.orm import Session


DOCUMENT_CONFIG = {
    "CV": "CV cá nhân",

    "APPLICATION":
        "Đơn đăng ký thực tập",

    "CONFIRMATION":
        "Giấy xác nhận thực tập",

    "INTERNSHIP_PLAN":
        "Kế hoạch thực tập",
}


def to_iso(
    value:
        date |
        datetime |
        str |
        None,
) -> str | None:
    if value is None:
        return None

    if isinstance(
        value,
        (date, datetime),
    ):
        return value.isoformat()

    return str(value)


# ============================================================
# CURRENT INTERNSHIP
# ============================================================

def get_student_internship(
    db: Session,
    student_id: int,
):
    return db.execute(
        text(
            """
            SELECT
                i.id,
                i.status,
                i.position_title,
                i.start_date,
                i.end_date,

                c.name
                    AS company_name,

                c.address
                    AS company_address,

                cm.full_name
                    AS mentor_name,

                cm.position
                    AS mentor_position,

                cm.email
                    AS mentor_email,

                cm.phone
                    AS mentor_phone

            FROM internships AS i

            LEFT JOIN companies AS c
                ON c.id = i.company_id

            LEFT JOIN company_mentors AS cm
                ON cm.id =
                    i.company_mentor_id

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


# ============================================================
# GET PROFILE
# ============================================================

def get_internship_profile(
    db: Session,
    student_id: int,
) -> dict:

    student = db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                u.avatar_url,
                sp.student_code

            FROM users AS u

            LEFT JOIN student_profiles AS sp
                ON sp.student_id = u.id

            WHERE u.id = :student_id
              AND u.role = 'STUDENT'
              AND u.is_active = TRUE

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().first()


    if student is None:
        raise ValueError(
            "Không tìm thấy sinh viên."
        )


    internship = (
        get_student_internship(
            db=db,
            student_id=student_id,
        )
    )


    internship_data = None
    mentor_data = None


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

            "location":
                internship[
                    "company_address"
                ],
        }


        if internship["mentor_name"]:
            mentor_data = {
                "fullName":
                    internship[
                        "mentor_name"
                    ],

                "position":
                    internship[
                        "mentor_position"
                    ],

                "email":
                    str(
                        internship[
                            "mentor_email"
                        ]
                    )
                    if internship[
                        "mentor_email"
                    ]
                    else None,

                "phone":
                    internship[
                        "mentor_phone"
                    ],
            }


    # ========================================================
    # DOCUMENTS
    # ========================================================

    document_rows = []


    if internship:

        document_rows = db.execute(
            text(
                """
                SELECT
                    id,
                    document_type,
                    title,
                    original_file_name,
                    mime_type,
                    file_size,
                    status,
                    uploaded_at

                FROM internship_documents

                WHERE internship_id =
                    :internship_id

                  AND student_id =
                    :student_id
                """
            ),
            {
                "internship_id":
                    internship["id"],

                "student_id":
                    student_id,
            },
        ).mappings().all()


    document_map = {
        row["document_type"]:
            row

        for row in document_rows
    }


    documents = []


    for (
        document_type,
        title,
    ) in DOCUMENT_CONFIG.items():

        row = document_map.get(
            document_type
        )


        if row:

            if (
                row["status"]
                == "APPROVED"
            ):
                status_text = (
                    "Đã duyệt"
                )

            elif (
                row["status"]
                == "UNDER_REVIEW"
            ):
                status_text = (
                    "Đang chờ duyệt"
                )

            elif (
                row["status"]
                == "REJECTED"
            ):
                status_text = (
                    "Bị từ chối"
                )

            else:
                status_text = (
                    "Đã tải lên"
                )


            documents.append(
                {
                    "id":
                        row["id"],

                    "key":
                        document_type,

                    "title":
                        title,

                    "status":
                        status_text,

                    "completed":
                        row["status"]
                        in (
                            "UPLOADED",
                            "UNDER_REVIEW",
                            "APPROVED",
                        ),

                    "uploaded":
                        True,

                    "originalFileName":
                        row[
                            "original_file_name"
                        ],

                    "fileSize":
                        int(
                            row[
                                "file_size"
                            ]
                        ),

                    "mimeType":
                        row[
                            "mime_type"
                        ],

                    "uploadedAt":
                        to_iso(
                            row[
                                "uploaded_at"
                            ]
                        ),
                }
            )

        else:

            documents.append(
                {
                    "id":
                        None,

                    "key":
                        document_type,

                    "title":
                        title,

                    "status":
                        "Chưa tải lên",

                    "completed":
                        False,

                    "uploaded":
                        False,

                    "originalFileName":
                        None,

                    "fileSize":
                        None,

                    "mimeType":
                        None,

                    "uploadedAt":
                        None,
                }
            )


    completed_documents = sum(
        1
        for document
        in documents
        if document["completed"]
    )


    total_documents = len(
        documents
    )


    completion_percentage = (
        round(
            completed_documents
            / total_documents
            * 100
        )
        if total_documents
        else 0
    )


    return {
        "student": {
            "id":
                student["id"],

            "fullName":
                student["full_name"],

            "studentCode":
                student[
                    "student_code"
                ],

            "email":
                str(
                    student["email"]
                ),

            "phone":
                student["phone"],

            "address":
                None,

            "avatarUrl":
                student[
                    "avatar_url"
                ],
        },

        "internship":
            internship_data,

        "mentor":
            mentor_data,

        "documents":
            documents,

        "completionPercentage":
            completion_percentage,

        "missingDocuments":
            total_documents
            - completed_documents,
    }


# ============================================================
# SAVE DOCUMENT
# ============================================================

def save_internship_document(
    db: Session,

    student_id: int,

    document_type: str,

    original_file_name: str,

    mime_type: str,

    file_data: bytes,
):

    if (
        document_type
        not in DOCUMENT_CONFIG
    ):
        raise ValueError(
            "Loại tài liệu không hợp lệ."
        )


    internship = (
        get_student_internship(
            db=db,
            student_id=student_id,
        )
    )


    if internship is None:
        raise ValueError(
            "Sinh viên chưa có kỳ thực tập."
        )


    title = DOCUMENT_CONFIG[
        document_type
    ]


    row = db.execute(
        text(
            """
            INSERT INTO internship_documents
            (
                internship_id,
                student_id,
                document_type,
                title,
                original_file_name,
                mime_type,
                file_size,
                file_data,
                status
            )

            VALUES
            (
                :internship_id,
                :student_id,
                :document_type,
                :title,
                :original_file_name,
                :mime_type,
                :file_size,
                :file_data,
                'UPLOADED'
            )

            ON CONFLICT
            (
                internship_id,
                document_type
            )

            DO UPDATE SET

                original_file_name =
                    EXCLUDED.original_file_name,

                mime_type =
                    EXCLUDED.mime_type,

                file_size =
                    EXCLUDED.file_size,

                file_data =
                    EXCLUDED.file_data,

                status =
                    'UPLOADED',

                updated_at =
                    NOW(),

                uploaded_at =
                    NOW()

            RETURNING
                id,
                document_type,
                original_file_name,
                mime_type,
                file_size,
                status,
                uploaded_at
            """
        ),
        {
            "internship_id":
                internship["id"],

            "student_id":
                student_id,

            "document_type":
                document_type,

            "title":
                title,

            "original_file_name":
                original_file_name,

            "mime_type":
                mime_type,

            "file_size":
                len(
                    file_data
                ),

            "file_data":
                file_data,
        },
    ).mappings().first()


    db.commit()


    return dict(row)


# ============================================================
# GET DOCUMENT FILE
# ============================================================

def get_document_file(
    db: Session,

    student_id: int,

    document_id: int,
):

    return db.execute(
        text(
            """
            SELECT
                d.id,
                d.original_file_name,
                d.mime_type,
                d.file_size,
                d.file_data

            FROM internship_documents
                AS d

            INNER JOIN internships AS i
                ON i.id =
                    d.internship_id

            WHERE d.id =
                :document_id

              AND d.student_id =
                :student_id

              AND i.student_id =
                :student_id

            LIMIT 1
            """
        ),
        {
            "document_id":
                document_id,

            "student_id":
                student_id,
        },
    ).mappings().first()


# ============================================================
# DELETE DOCUMENT
# ============================================================

def delete_document(
    db: Session,

    student_id: int,

    document_id: int,
) -> bool:

    row = db.execute(
        text(
            """
            DELETE FROM internship_documents

            WHERE id =
                :document_id

              AND student_id =
                :student_id

            RETURNING id
            """
        ),
        {
            "document_id":
                document_id,

            "student_id":
                student_id,
        },
    ).first()


    if row is None:
        return False


    db.commit()

    return True