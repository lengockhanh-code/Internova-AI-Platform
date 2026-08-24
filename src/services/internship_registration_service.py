from sqlalchemy import text
from sqlalchemy.orm import Session


DOCUMENT_TITLES = {
    "CV": "CV cá nhân",
    "OFFER_LETTER": "Offer Letter / Giấy xác nhận",
    "JOB_DESCRIPTION": "Job Description",
    "OTHER": "Tài liệu khác",
}


def get_student(
    db: Session,
    student_id: int,
):
    return db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,

                sp.student_code,
                sp.faculty,
                sp.major,
                sp.cohort

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
            "student_id": student_id
        },
    ).mappings().first()


def get_active_semester(
    db: Session,
):
    return db.execute(
        text(
            """
            SELECT id

            FROM semesters

            WHERE is_active = TRUE

            ORDER BY start_date DESC NULLS LAST

            LIMIT 1
            """
        )
    ).mappings().first()


def get_current_application(
    db: Session,
    student_id: int,
):
    return db.execute(
        text(
            """
            SELECT
                ia.id,
                ia.status,
                ia.credits,
                ia.position_title,
                ia.description,
                ia.work_mode,
                ia.expected_start_date,
                ia.expected_end_date,
                ia.submitted_at,
                ia.assigned_lecturer_id,

                u.full_name AS student_name,

                c.name AS company_name,
                c.industry,
                c.address AS company_address,
                c.website AS company_website,

                cm.full_name AS mentor_name,
                cm.position AS mentor_position,
                cm.email AS mentor_email,
                cm.phone AS mentor_phone

            FROM internship_applications AS ia

            INNER JOIN users AS u
                ON u.id = ia.student_id

            LEFT JOIN companies AS c
                ON c.id = ia.company_id

            LEFT JOIN company_mentors AS cm
                ON cm.id = ia.company_mentor_id

            WHERE ia.student_id = :student_id

              AND ia.status IN (
                  'DRAFT',
                  'SUBMITTED',
                  'UNDER_REVIEW',
                  'APPROVED',
                  'REJECTED'
              )

            ORDER BY ia.created_at DESC

            LIMIT 1
            """
        ),
        {
            "student_id": student_id
        },
    ).mappings().first()


def get_documents(
    db: Session,
    application_id: int,
    student_id: int,
):
    return db.execute(
        text(
            """
            SELECT
                id,
                document_type,
                title,
                original_file_name,
                file_size,
                mime_type

            FROM application_documents

            WHERE application_id = :application_id
              AND student_id = :student_id

            ORDER BY created_at
            """
        ),
        {
            "application_id":
                application_id,

            "student_id":
                student_id,
        },
    ).mappings().all()


def serialize_registration(
    db: Session,
    student_id: int,
):
    student = get_student(
        db,
        student_id,
    )

    if student is None:
        raise ValueError(
            "Không tìm thấy sinh viên."
        )

    application = get_current_application(
        db,
        student_id,
    )

    result = {
        "application": None,

        "student": {
            "id":
                student["id"],

            "fullName":
                student["full_name"],

            "studentCode":
                student["student_code"],

            "email":
                str(student["email"]),

            "phone":
                student["phone"],

            "faculty":
                student["faculty"],

            "major":
                student["major"],

            "cohort":
                student["cohort"],
        },

        "documents": [],
    }

    if application is None:
        return result

    documents = get_documents(
        db,
        application["id"],
        student_id,
    )

    result["application"] = {
        "id":
            application["id"],

        "status":
            application["status"],

        "credits":
            application["credits"],

        "companyName":
            application["company_name"],

        "industry":
            application["industry"],

        "companyAddress":
            application["company_address"],

        "companyWebsite":
            application["company_website"],

        "internshipPosition":
            application["position_title"],

        "jobDescription":
            application["description"],

        "workMode":
            application["work_mode"],

        "startDate":
            (
                application[
                    "expected_start_date"
                ].isoformat()
                if application[
                    "expected_start_date"
                ]
                else None
            ),

        "endDate":
            (
                application[
                    "expected_end_date"
                ].isoformat()
                if application[
                    "expected_end_date"
                ]
                else None
            ),

        "mentorName":
            application["mentor_name"],

        "mentorPosition":
            application[
                "mentor_position"
            ],

        "mentorEmail":
            (
                str(
                    application[
                        "mentor_email"
                    ]
                )
                if application[
                    "mentor_email"
                ]
                else None
            ),

        "mentorPhone":
            application["mentor_phone"],

        "submittedAt":
            (
                application[
                    "submitted_at"
                ].isoformat()
                if application[
                    "submitted_at"
                ]
                else None
            ),
    }

    result["documents"] = [
        {
            "id": row["id"],

            "documentType":
                row["document_type"],

            "title":
                row["title"],

            "originalFileName":
                row[
                    "original_file_name"
                ],

            "fileSize":
                int(row["file_size"]),

            "mimeType":
                row["mime_type"],
        }
        for row in documents
    ]

    return result


def get_or_create_company(
    db: Session,
    payload: dict,
):
    company = db.execute(
        text(
            """
            SELECT id

            FROM companies

            WHERE LOWER(name)
                = LOWER(:name)

            LIMIT 1
            """
        ),
        {
            "name":
                payload["companyName"]
        },
    ).mappings().first()

    if company:
        company_id = company["id"]

        db.execute(
            text(
                """
                UPDATE companies

                SET
                    industry = :industry,
                    address = :address,
                    website = :website,
                    updated_at = NOW()

                WHERE id = :id
                """
            ),
            {
                "id":
                    company_id,

                "industry":
                    payload.get(
                        "industry"
                    ),

                "address":
                    payload.get(
                        "companyAddress"
                    ),

                "website":
                    payload.get(
                        "companyWebsite"
                    ),
            },
        )

        return company_id

    return db.execute(
        text(
            """
            INSERT INTO companies
            (
                name,
                industry,
                address,
                website
            )

            VALUES
            (
                :name,
                :industry,
                :address,
                :website
            )

            RETURNING id
            """
        ),
        {
            "name":
                payload["companyName"],

            "industry":
                payload.get("industry"),

            "address":
                payload.get(
                    "companyAddress"
                ),

            "website":
                payload.get(
                    "companyWebsite"
                ),
        },
    ).scalar_one()


def get_or_create_mentor(
    db: Session,
    company_id: int,
    payload: dict,
):
    mentor_email = payload.get(
        "mentorEmail"
    )

    mentor = None

    if mentor_email:
        mentor = db.execute(
            text(
                """
                SELECT id

                FROM company_mentors

                WHERE company_id =
                    :company_id

                  AND email =
                    :email

                LIMIT 1
                """
            ),
            {
                "company_id":
                    company_id,

                "email":
                    mentor_email,
            },
        ).mappings().first()

    if mentor:
        mentor_id = mentor["id"]

        db.execute(
            text(
                """
                UPDATE company_mentors

                SET
                    full_name = :name,
                    position = :position,
                    phone = :phone,
                    updated_at = NOW()

                WHERE id = :id
                """
            ),
            {
                "id":
                    mentor_id,

                "name":
                    payload["mentorName"],

                "position":
                    payload.get(
                        "mentorPosition"
                    ),

                "phone":
                    payload.get(
                        "mentorPhone"
                    ),
            },
        )

        return mentor_id

    return db.execute(
        text(
            """
            INSERT INTO company_mentors
            (
                company_id,
                full_name,
                email,
                phone,
                position
            )

            VALUES
            (
                :company_id,
                :name,
                :email,
                :phone,
                :position
            )

            RETURNING id
            """
        ),
        {
            "company_id":
                company_id,

            "name":
                payload["mentorName"],

            "email":
                mentor_email,

            "phone":
                payload.get(
                    "mentorPhone"
                ),

            "position":
                payload.get(
                    "mentorPosition"
                ),
        },
    ).scalar_one()


def save_draft(
    db: Session,
    student_id: int,
    payload: dict,
):
    current = get_current_application(
        db,
        student_id,
    )

    if (
        current
        and current["status"]
        not in (
            "DRAFT",
            "REJECTED",
        )
    ):
        raise ValueError(
            "Hồ sơ đã được gửi và hiện không thể chỉnh sửa."
        )

    semester = get_active_semester(db)

    company_id = get_or_create_company(
        db,
        payload,
    )

    mentor_id = get_or_create_mentor(
        db,
        company_id,
        payload,
    )

    values = {
        "student_id":
            student_id,

        "semester_id":
            semester["id"]
            if semester
            else None,

        "company_id":
            company_id,

        "mentor_id":
            mentor_id,

        "position":
            payload[
                "internshipPosition"
            ],

        "description":
            payload.get(
                "jobDescription"
            ),

        "work_mode":
            payload["workMode"].upper(),

        "credits":
            payload["credits"],

        "start_date":
            payload["startDate"],

        "end_date":
            payload["endDate"],
    }

    if current:
        db.execute(
            text(
                """
                UPDATE internship_applications

                SET
                    semester_id =
                        :semester_id,

                    company_id =
                        :company_id,

                    company_mentor_id =
                        :mentor_id,

                    position_title =
                        :position,

                    description =
                        :description,

                    work_mode =
                        :work_mode,

                    credits =
                        :credits,

                    expected_start_date =
                        :start_date,

                    expected_end_date =
                        :end_date,

                    status =
                        'DRAFT',

                    updated_at =
                        NOW()

                WHERE id =
                    :application_id

                  AND student_id =
                    :student_id
                """
            ),
            {
                **values,

                "application_id":
                    current["id"],
            },
        )

        application_id = current["id"]

    else:
        application_id = db.execute(
            text(
                """
                INSERT INTO internship_applications
                (
                    student_id,
                    semester_id,
                    company_id,
                    company_mentor_id,

                    position_title,
                    description,
                    work_mode,
                    credits,

                    expected_start_date,
                    expected_end_date,

                    status
                )

                VALUES
                (
                    :student_id,
                    :semester_id,
                    :company_id,
                    :mentor_id,

                    :position,
                    :description,
                    :work_mode,
                    :credits,

                    :start_date,
                    :end_date,

                    'DRAFT'
                )

                RETURNING id
                """
            ),
            values,
        ).scalar_one()

    db.commit()

    return application_id


def submit_application(
    db: Session,
    student_id: int,
):
    application = get_current_application(
        db,
        student_id,
    )

    if application is None:
        raise ValueError(
            "Bạn chưa có bản nháp đăng ký."
        )

    if application["status"] != "DRAFT":
        raise ValueError(
            "Hồ sơ không còn ở trạng thái bản nháp."
        )

    db.execute(
        text(
            """
            UPDATE internship_applications

            SET
                status = 'SUBMITTED',
                submitted_at = NOW(),
                updated_at = NOW()

            WHERE id = :application_id
              AND student_id = :student_id
            """
        ),
        {
            "application_id":
                application["id"],

            "student_id":
                student_id,
        },
    )

    if application["assigned_lecturer_id"] is not None:
        db.execute(
            text(
                """
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    notification_type,
                    severity,
                    related_type,
                    related_id
                ) VALUES (
                    :lecturer_id,
                    'Hồ sơ thực tập mới',
                    :message,
                    'APPLICATION_SUBMITTED',
                    'INFO',
                    'INTERNSHIP_APPLICATION',
                    :application_id
                )
                """
            ),
            {
                "lecturer_id": application["assigned_lecturer_id"],
                "message": (
                    f"{application['student_name']} đã nộp hồ sơ đăng ký "
                    "thực tập và đang chờ xét duyệt."
                ),
                "application_id": application["id"],
            },
        )

    db.commit()


def save_application_document(
    db: Session,
    student_id: int,
    document_type: str,
    filename: str,
    mime_type: str,
    file_data: bytes,
):
    application = get_current_application(
        db,
        student_id,
    )

    if application is None:
        raise ValueError(
            "Hãy lưu bản nháp trước khi tải tài liệu."
        )

    if application["status"] != "DRAFT":
        raise ValueError(
            "Không thể thay đổi tài liệu sau khi đã gửi hồ sơ."
        )

    if document_type not in DOCUMENT_TITLES:
        raise ValueError(
            "Loại tài liệu không hợp lệ."
        )

    row = db.execute(
        text(
            """
            INSERT INTO application_documents
            (
                application_id,
                student_id,
                document_type,
                title,

                original_file_name,
                mime_type,
                file_size,
                file_data
            )

            VALUES
            (
                :application_id,
                :student_id,
                :document_type,
                :title,

                :filename,
                :mime_type,
                :file_size,
                :file_data
            )

            ON CONFLICT
            (
                application_id,
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

                updated_at =
                    NOW()

            RETURNING id
            """
        ),
        {
            "application_id":
                application["id"],

            "student_id":
                student_id,

            "document_type":
                document_type,

            "title":
                DOCUMENT_TITLES[
                    document_type
                ],

            "filename":
                filename,

            "mime_type":
                mime_type,

            "file_size":
                len(file_data),

            "file_data":
                file_data,
        },
    ).scalar_one()

    db.commit()

    return row


def get_application_document(
    db: Session,
    student_id: int,
    document_id: int,
):
    return db.execute(
        text(
            """
            SELECT
                id,
                original_file_name,
                mime_type,
                file_data

            FROM application_documents

            WHERE id = :document_id
              AND student_id = :student_id

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


def delete_application_document(
    db: Session,
    student_id: int,
    document_id: int,
):
    application = get_current_application(
        db,
        student_id,
    )

    if (
        application is None
        or application["status"]
        != "DRAFT"
    ):
        raise ValueError(
            "Không thể thay đổi tài liệu của hồ sơ này."
        )

    result = db.execute(
        text(
            """
            DELETE FROM application_documents

            WHERE id = :document_id
              AND student_id = :student_id

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

    db.commit()

    return result is not None


def delete_draft(
    db: Session,
    student_id: int,
):
    application = get_current_application(
        db,
        student_id,
    )

    if application is None:
        return False

    if application["status"] != "DRAFT":
        raise ValueError(
            "Chỉ có thể xóa hồ sơ bản nháp."
        )

    db.execute(
        text(
            """
            DELETE FROM internship_applications

            WHERE id = :application_id
              AND student_id = :student_id
            """
        ),
        {
            "application_id":
                application["id"],

            "student_id":
                student_id,
        },
    )

    db.commit()

    return True
