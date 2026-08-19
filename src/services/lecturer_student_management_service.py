from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.services.lecturer_common_service import (
    _get_lecturer,
    _normalize_lecturer_id,
    _to_float,
    _to_int,
    to_iso,
)


def get_lecturer_student_form_options(
    db: Session,
    lecturer_id: int | str | None = None,
) -> dict:
    lecturer = _get_lecturer(
        db=db,
        lecturer_id=lecturer_id,
    )

    if lecturer is None:
        raise ValueError(
            "Không tìm thấy giảng viên đang hoạt động."
        )

    current_lecturer_id = int(
        lecturer["id"]
    )

    student_rows = db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                sp.student_code,
                sp.class_name,
                sp.major

            FROM public.users AS u

            INNER JOIN public.student_profiles AS sp
                ON sp.student_id = u.id

            WHERE u.role = 'STUDENT'
              AND u.is_active = TRUE

              -- Không hiện sinh viên đã thuộc danh sách hiện tại
              -- của chính giảng viên.
              AND NOT EXISTS (
                  SELECT 1

                  FROM public.internships AS i

                  WHERE i.student_id = u.id
                    AND i.lecturer_id = :lecturer_id
                    AND i.status <> 'CANCELLED'
              )

            ORDER BY
                u.full_name,
                sp.student_code
            """
        ),
        {
            "lecturer_id":
                current_lecturer_id,
        },
    ).mappings().all()


    semester_rows = db.execute(
        text(
            """
            SELECT
                s.id,
                s.name,
                s.academic_year,
                s.semester_code

            FROM public.semesters AS s

            WHERE s.is_active = TRUE

            ORDER BY
                s.start_date DESC NULLS LAST,
                s.id DESC
            """
        )
    ).mappings().all()


    company_rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.name,
                c.industry

            FROM public.companies AS c

            WHERE c.is_active = TRUE

            ORDER BY c.name
            """
        )
    ).mappings().all()


    return {
        "students": [
            {
                "id":
                    int(row["id"]),

                "fullName":
                    row["full_name"],

                "studentCode":
                    row["student_code"],

                "className":
                    row["class_name"],

                "major":
                    row["major"],
            }
            for row in student_rows
        ],

        "semesters": [
            {
                "id":
                    int(row["id"]),

                "name":
                    row["name"],

                "academicYear":
                    row["academic_year"],

                "semesterCode":
                    row["semester_code"],
            }
            for row in semester_rows
        ],

        "companies": [
            {
                "id":
                    int(row["id"]),

                "name":
                    row["name"],

                "industry":
                    row["industry"],
            }
            for row in company_rows
        ],
    }


def add_lecturer_student(
    db: Session,
    payload,
    lecturer_id: int | str | None = None,
) -> dict:
    lecturer = _get_lecturer(
        db=db,
        lecturer_id=lecturer_id,
    )

    if lecturer is None:
        raise ValueError(
            "Không tìm thấy giảng viên đang hoạt động."
        )

    current_lecturer_id = int(
        lecturer["id"]
    )


    if (
        payload.startDate is not None
        and payload.endDate is not None
        and payload.endDate < payload.startDate
    ):
        raise ValueError(
            "Ngày kết thúc không được trước ngày bắt đầu."
        )


    student = db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                sp.student_code

            FROM public.users AS u

            INNER JOIN public.student_profiles AS sp
                ON sp.student_id = u.id

            WHERE u.id = :student_id
              AND u.role = 'STUDENT'
              AND u.is_active = TRUE

            LIMIT 1
            """
        ),
        {
            "student_id":
                payload.studentId,
        },
    ).mappings().first()


    if student is None:
        raise ValueError(
            "Sinh viên không tồn tại hoặc tài khoản đã bị khóa."
        )


    semester = db.execute(
        text(
            """
            SELECT id

            FROM public.semesters

            WHERE id = :semester_id
              AND is_active = TRUE

            LIMIT 1
            """
        ),
        {
            "semester_id":
                payload.semesterId,
        },
    ).mappings().first()


    if semester is None:
        raise ValueError(
            "Học kỳ không tồn tại hoặc không còn hoạt động."
        )


    if payload.companyId is not None:
        company = db.execute(
            text(
                """
                SELECT id

                FROM public.companies

                WHERE id = :company_id
                  AND is_active = TRUE

                LIMIT 1
                """
            ),
            {
                "company_id":
                    payload.companyId,
            },
        ).mappings().first()

        if company is None:
            raise ValueError(
                "Doanh nghiệp không tồn tại hoặc không còn hoạt động."
            )


    # Không cho một sinh viên có 2 internship không-CANCELLED
    # trong cùng một học kỳ.
    existing = db.execute(
        text(
            """
            SELECT
                i.id,
                i.lecturer_id

            FROM public.internships AS i

            WHERE i.student_id = :student_id
              AND i.semester_id = :semester_id
              AND i.status <> 'CANCELLED'

            LIMIT 1
            """
        ),
        {
            "student_id":
                payload.studentId,

            "semester_id":
                payload.semesterId,
        },
    ).mappings().first()


    if existing is not None:
        if int(existing["lecturer_id"] or 0) == current_lecturer_id:
            raise ValueError(
                "Sinh viên này đã có trong danh sách của bạn ở học kỳ đã chọn."
            )

        raise ValueError(
            "Sinh viên này đã được phân cho giảng viên khác trong học kỳ đã chọn."
        )


    try:
        row = db.execute(
            text(
                """
                INSERT INTO public.internships (
                    student_id,
                    lecturer_id,
                    semester_id,
                    company_id,

                    position_title,

                    start_date,
                    end_date,

                    completed_hours,
                    progress_percentage,

                    status,

                    created_at,
                    updated_at
                )
                VALUES (
                    :student_id,
                    :lecturer_id,
                    :semester_id,
                    :company_id,

                    :position_title,

                    :start_date,
                    :end_date,

                    0,
                    0,

                    :status,

                    NOW(),
                    NOW()
                )

                RETURNING id
                """
            ),
            {
                "student_id":
                    payload.studentId,

                "lecturer_id":
                    current_lecturer_id,

                "semester_id":
                    payload.semesterId,

                "company_id":
                    payload.companyId,

                "position_title":
                    payload.positionTitle.strip(),

                "start_date":
                    payload.startDate,

                "end_date":
                    payload.endDate,

                "status":
                    payload.status,
            },
        ).mappings().first()


        if row is None:
            raise ValueError(
                "Không thể tạo bản ghi thực tập."
            )


        db.commit()


    except Exception:
        db.rollback()
        raise


    return {
        "internshipId":
            int(row["id"]),

        "studentId":
            int(payload.studentId),

        "message":
            f"Đã thêm {student['full_name']} vào danh sách sinh viên của bạn.",
    }
def get_lecturer_student_edit_data(
    db: Session,
    student_id: int,
    lecturer_id: int | str | None = None,
) -> dict:
    """
    Lấy dữ liệu hiện tại của một sinh viên
    để hiển thị lên form sửa.

    Chỉ cho phép lấy sinh viên thuộc quyền
    hướng dẫn của lecturer hiện tại.
    """

    # =========================================================
    # 1. XÁC ĐỊNH GIẢNG VIÊN
    # =========================================================

    lecturer = _get_lecturer(
        db=db,
        lecturer_id=lecturer_id,
    )

    if lecturer is None:
        raise ValueError(
            "Không tìm thấy giảng viên đang hoạt động."
        )

    current_lecturer_id = int(
        lecturer["id"]
    )


    # =========================================================
    # 2. LẤY SINH VIÊN + INTERNSHIP
    #
    # QUAN TRỌNG:
    # lecturer_id được kiểm tra ngay trong WHERE.
    #
    # Giáo viên A không thể xem/sửa internship
    # của sinh viên thuộc giáo viên B.
    # =========================================================

    row = db.execute(
        text(
            """
            SELECT
                u.id AS student_id,
                u.full_name AS student_name,

                sp.student_code,
                sp.class_name,
                sp.major,

                i.id AS internship_id,
                i.semester_id,
                i.company_id,

                i.position_title,

                i.start_date,
                i.end_date,

                i.status

            FROM public.internships AS i

            INNER JOIN public.users AS u
                ON u.id = i.student_id

            LEFT JOIN public.student_profiles AS sp
                ON sp.student_id = u.id

            WHERE i.student_id = :student_id
              AND i.lecturer_id = :lecturer_id
              AND i.status <> 'CANCELLED'

            ORDER BY
                i.updated_at DESC,
                i.id DESC

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,

            "lecturer_id":
                current_lecturer_id,
        },
    ).mappings().first()


    if row is None:
        raise ValueError(
            "Không tìm thấy sinh viên thuộc quyền hướng dẫn của bạn."
        )


    # =========================================================
    # 3. LẤY DANH SÁCH HỌC KỲ
    #
    # Để frontend tạo dropdown:
    #
    # Học kỳ:
    # [ Fall 2026             v ]
    # =========================================================

    semester_rows = db.execute(
        text(
            """
            SELECT
                s.id,
                s.name,
                s.academic_year,
                s.semester_code

            FROM public.semesters AS s

            WHERE s.is_active = TRUE

            ORDER BY
                s.start_date DESC NULLS LAST,
                s.id DESC
            """
        )
    ).mappings().all()


    # =========================================================
    # 4. LẤY DANH SÁCH DOANH NGHIỆP
    #
    # Để frontend tạo dropdown:
    #
    # Doanh nghiệp:
    # [ FPT Software          v ]
    # =========================================================

    company_rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.name,
                c.industry

            FROM public.companies AS c

            WHERE c.is_active = TRUE

            ORDER BY c.name
            """
        )
    ).mappings().all()


    # =========================================================
    # 5. TRẢ RESPONSE CHO FRONTEND
    # =========================================================

    return {
        "student": {
            "studentId":
                int(
                    row["student_id"]
                ),

            "studentName":
                row["student_name"],

            "studentCode":
                row["student_code"],

            "className":
                row["class_name"],

            "major":
                row["major"],
        },

        "internship": {
            "internshipId":
                int(
                    row["internship_id"]
                ),

            "semesterId":
                (
                    int(
                        row["semester_id"]
                    )
                    if row["semester_id"]
                    is not None
                    else None
                ),

            "companyId":
                (
                    int(
                        row["company_id"]
                    )
                    if row["company_id"]
                    is not None
                    else None
                ),

            "positionTitle":
                row["position_title"]
                or "",

            "startDate":
                to_iso(
                    row["start_date"]
                ),

            "endDate":
                to_iso(
                    row["end_date"]
                ),

            "status":
                row["status"],
        },

        "semesters": [
            {
                "id":
                    int(
                        semester["id"]
                    ),

                "name":
                    semester["name"],

                "academicYear":
                    semester[
                        "academic_year"
                    ],

                "semesterCode":
                    semester[
                        "semester_code"
                    ],
            }

            for semester
            in semester_rows
        ],

        "companies": [
            {
                "id":
                    int(
                        company["id"]
                    ),

                "name":
                    company["name"],

                "industry":
                    company["industry"],
            }

            for company
            in company_rows
        ],
    }
def update_lecturer_student(
    db: Session,
    student_id: int,
    payload,
    lecturer_id: int | str | None = None,
) -> dict:
    """
    Cập nhật thông tin internship của sinh viên.

    Không sửa:
        - họ tên
        - mã sinh viên
        - lớp
        - ngành

    Chỉ sửa:
        - semester
        - company
        - position
        - start/end date
        - status
    """

    # =========================================================
    # 1. XÁC ĐỊNH GIẢNG VIÊN HIỆN TẠI
    # =========================================================

    lecturer = _get_lecturer(
        db=db,
        lecturer_id=lecturer_id,
    )

    if lecturer is None:
        raise ValueError(
            "Không tìm thấy giảng viên đang hoạt động."
        )

    current_lecturer_id = int(
        lecturer["id"]
    )


    # =========================================================
    # 2. KIỂM TRA NGÀY
    # =========================================================

    if (
        payload.startDate is not None
        and payload.endDate is not None
        and payload.endDate
        < payload.startDate
    ):
        raise ValueError(
            "Ngày kết thúc không được trước ngày bắt đầu."
        )


    # =========================================================
    # 3. KIỂM TRA SINH VIÊN CÓ THUỘC GIẢNG VIÊN KHÔNG
    #
    # Đây là lớp bảo vệ quan trọng.
    # =========================================================

    internship = db.execute(
        text(
            """
            SELECT
                i.id,
                i.student_id,
                i.lecturer_id,
                i.semester_id

            FROM public.internships AS i

            WHERE i.student_id = :student_id
              AND i.lecturer_id = :lecturer_id
              AND i.status <> 'CANCELLED'

            ORDER BY
                i.updated_at DESC,
                i.id DESC

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,

            "lecturer_id":
                current_lecturer_id,
        },
    ).mappings().first()


    if internship is None:
        raise ValueError(
            "Không tìm thấy sinh viên thuộc quyền hướng dẫn của bạn."
        )


    current_internship_id = int(
        internship["id"]
    )


    # =========================================================
    # 4. KIỂM TRA SEMESTER
    # =========================================================

    semester = db.execute(
        text(
            """
            SELECT
                s.id

            FROM public.semesters AS s

            WHERE s.id = :semester_id
              AND s.is_active = TRUE

            LIMIT 1
            """
        ),
        {
            "semester_id":
                payload.semesterId,
        },
    ).mappings().first()


    if semester is None:
        raise ValueError(
            "Học kỳ không tồn tại hoặc không còn hoạt động."
        )


    # =========================================================
    # 5. KIỂM TRA COMPANY
    #
    # companyId được phép NULL.
    # =========================================================

    if payload.companyId is not None:

        company = db.execute(
            text(
                """
                SELECT
                    c.id

                FROM public.companies AS c

                WHERE c.id = :company_id
                  AND c.is_active = TRUE

                LIMIT 1
                """
            ),
            {
                "company_id":
                    payload.companyId,
            },
        ).mappings().first()


        if company is None:
            raise ValueError(
                "Doanh nghiệp không tồn tại hoặc không còn hoạt động."
            )


    # =========================================================
    # 6. KIỂM TRA TRÙNG HỌC KỲ
    #
    # Ví dụ:
    #
    # Sinh viên An đã có internship:
    #
    # internshipId = 1
    # semester = Fall 2026
    #
    # Nếu đang sửa chính internship 1:
    #      → cho phép.
    #
    # Nếu tồn tại internship KHÁC:
    #      internshipId = 9
    #      semester = Fall 2026
    #
    #      → không cho lưu.
    #
    # Do đó phải có:
    #
    # id <> :current_internship_id
    # =========================================================

    duplicate = db.execute(
        text(
            """
            SELECT
                i.id,
                i.lecturer_id

            FROM public.internships AS i

            WHERE i.student_id = :student_id
              AND i.semester_id = :semester_id
              AND i.status <> 'CANCELLED'

              AND i.id <> :current_internship_id

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,

            "semester_id":
                payload.semesterId,

            "current_internship_id":
                current_internship_id,
        },
    ).mappings().first()


    if duplicate is not None:

        duplicate_lecturer_id = (
            int(
                duplicate[
                    "lecturer_id"
                ]
            )
            if duplicate[
                "lecturer_id"
            ] is not None
            else None
        )


        if (
            duplicate_lecturer_id
            == current_lecturer_id
        ):
            raise ValueError(
                "Sinh viên đã có một kỳ thực tập khác trong học kỳ này."
            )


        raise ValueError(
            "Sinh viên đã được phân cho giảng viên khác trong học kỳ này."
        )


    # =========================================================
    # 7. VALIDATE POSITION TITLE
    # =========================================================

    position_title = (
        payload.positionTitle
        or ""
    ).strip()


    if not position_title:
        raise ValueError(
            "Vị trí thực tập không được để trống."
        )


    # =========================================================
    # 8. UPDATE INTERNSHIP
    #
    # QUAN TRỌNG:
    #
    # UPDATE theo internship_id
    # + lecturer_id
    #
    # để tránh update nhầm.
    # =========================================================

    try:

        updated = db.execute(
            text(
                """
                UPDATE public.internships

                SET
                    semester_id =
                        :semester_id,

                    company_id =
                        :company_id,

                    position_title =
                        :position_title,

                    start_date =
                        :start_date,

                    end_date =
                        :end_date,

                    status =
                        :status,

                    updated_at =
                        NOW()

                WHERE id =
                    :internship_id

                  AND student_id =
                    :student_id

                  AND lecturer_id =
                    :lecturer_id

                  AND status <>
                    'CANCELLED'

                RETURNING
                    id,
                    student_id
                """
            ),
            {
                "semester_id":
                    payload.semesterId,

                "company_id":
                    payload.companyId,

                "position_title":
                    position_title,

                "start_date":
                    payload.startDate,

                "end_date":
                    payload.endDate,

                "status":
                    payload.status,

                "internship_id":
                    current_internship_id,

                "student_id":
                    student_id,

                "lecturer_id":
                    current_lecturer_id,
            },
        ).mappings().first()


        if updated is None:
            raise ValueError(
                "Không thể cập nhật thông tin thực tập."
            )


        db.commit()


    except Exception:
        db.rollback()

        raise


    # =========================================================
    # 9. RESPONSE
    # =========================================================

    return {
        "internshipId":
            int(
                updated["id"]
            ),

        "studentId":
            int(
                updated[
                    "student_id"
                ]
            ),

        "message":
            "Đã cập nhật thông tin sinh viên thành công.",
    }

