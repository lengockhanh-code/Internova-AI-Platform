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


def get_lecturer_internship_periods(
    db: Session,
    lecturer_id: int | str | None = None,
) -> dict:
    """
    Lấy danh sách các đợt thực tập.

    public.semesters
        -> đợt thực tập

    public.internships
        -> sinh viên thuộc đợt

    public.weekly_report_schedules
        -> lịch báo cáo của đợt

    public.weekly_reports
        -> xác định sinh viên cần chú ý
    """

    # =========================================================================
    # 1. XÁC ĐỊNH GIẢNG VIÊN
    # =========================================================================

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


    # =========================================================================
    # 2. QUERY CÁC ĐỢT THỰC TẬP
    # =========================================================================

    rows = db.execute(
        text(
            """
            SELECT
                s.id,
                s.name,
                s.semester_code,
                s.academic_year,

                s.start_date,
                s.end_date,

                s.is_active,

                -- =========================================================
                -- Tổng sinh viên của lecturer trong đợt
                -- =========================================================

                COUNT(
                    DISTINCT i.student_id
                ) FILTER (
                    WHERE i.id IS NOT NULL
                )::INTEGER AS total_students,


                -- =========================================================
                -- Tiến độ trung bình
                -- =========================================================

                COALESCE(
                    ROUND(
                        AVG(
                            i.progress_percentage
                        ) FILTER (
                            WHERE i.id IS NOT NULL
                        )
                    ),
                    0
                )::DOUBLE PRECISION
                    AS progress_percentage,


                -- =========================================================
                -- Số lịch báo cáo của semester
                -- =========================================================

                (
                    SELECT
                        COUNT(*)::INTEGER

                    FROM public.weekly_report_schedules
                        AS wrs

                    WHERE wrs.semester_id = s.id
                ) AS required_reports,


                -- =========================================================
                -- SINH VIÊN CẦN CHÚ Ý
                --
                -- 1. Đã quá hạn nhưng chưa nộp
                -- OR
                -- 2. Đã từng nộp muộn
                -- =========================================================

                COUNT(
                    DISTINCT i.student_id
                ) FILTER (
                    WHERE
                        i.id IS NOT NULL

                        AND (

                            -- =============================================
                            -- Có báo cáo quá hạn chưa nộp
                            -- =============================================

                            EXISTS (
                                SELECT 1

                                FROM public.weekly_report_schedules
                                    AS schedule

                                LEFT JOIN public.weekly_reports
                                    AS report

                                    ON report.internship_id = i.id

                                    AND (
                                        report.schedule_id =
                                            schedule.id

                                        OR (

                                            report.schedule_id
                                                IS NULL

                                            AND report.week_number =
                                                schedule.week_number

                                        )
                                    )

                                WHERE
                                    schedule.semester_id = s.id

                                    AND schedule.due_at < NOW()

                                    AND report.submitted_at IS NULL
                            )


                            OR


                            -- =============================================
                            -- Có báo cáo nộp sau deadline
                            -- =============================================

                            EXISTS (
                                SELECT 1

                                FROM public.weekly_report_schedules
                                    AS schedule

                                INNER JOIN public.weekly_reports
                                    AS report

                                    ON report.internship_id = i.id

                                    AND (
                                        report.schedule_id =
                                            schedule.id

                                        OR (

                                            report.schedule_id
                                                IS NULL

                                            AND report.week_number =
                                                schedule.week_number

                                        )
                                    )

                                WHERE
                                    schedule.semester_id = s.id

                                    AND report.submitted_at
                                        IS NOT NULL

                                    AND report.submitted_at >
                                        schedule.due_at
                            )
                        )
                )::INTEGER AS need_attention


            FROM public.semesters AS s


            LEFT JOIN public.internships AS i

                ON i.semester_id = s.id

                AND i.lecturer_id =
                    :lecturer_id

                AND i.status <> 'CANCELLED'


            GROUP BY
                s.id,
                s.name,
                s.semester_code,
                s.academic_year,
                s.start_date,
                s.end_date,
                s.is_active


            ORDER BY
                s.start_date DESC NULLS LAST,
                s.id DESC
            """
        ),
        {
            "lecturer_id":
                current_lecturer_id,
        },
    ).mappings().all()


    # =========================================================================
    # 3. MAP DATABASE -> API
    # =========================================================================

    periods: list[dict] = []


    for row in rows:

        # =====================================================================
        # STATUS CỦA ĐỢT
        #
        # Chưa tới start_date
        #       -> UPCOMING
        #
        # Đã qua end_date
        #       -> COMPLETED
        #
        # Còn lại
        #       -> ACTIVE
        # =====================================================================

        today = date.today()

        start_date = row[
            "start_date"
        ]

        end_date = row[
            "end_date"
        ]


        if (
            start_date is not None
            and today < start_date
        ):
            period_status = (
                "UPCOMING"
            )

        elif (
            end_date is not None
            and today > end_date
        ):
            period_status = (
                "COMPLETED"
            )

        else:
            period_status = (
                "ACTIVE"
                if row["is_active"]
                else "COMPLETED"
            )


        periods.append(
            {
                "id":
                    int(
                        row["id"]
                    ),

                "name":
                    row["name"],

                "semesterCode":
                    row[
                        "semester_code"
                    ]
                    or "",

                "academicYear":
                    row[
                        "academic_year"
                    ]
                    or "",

                "startDate":
                    to_iso(
                        start_date
                    )
                    or "",

                "endDate":
                    to_iso(
                        end_date
                    )
                    or "",

                "status":
                    period_status,

                "totalStudents":
                    int(
                        row[
                            "total_students"
                        ]
                        or 0
                    ),

                "requiredReports":
                    int(
                        row[
                            "required_reports"
                        ]
                        or 0
                    ),

                "progressPercentage":
                    float(
                        row[
                            "progress_percentage"
                        ]
                        or 0
                    ),

                "needAttention":
                    int(
                        row[
                            "need_attention"
                        ]
                        or 0
                    ),

                # semesters hiện chưa có description
                "description":
                    None,
            }
        )


    # =========================================================================
    # 4. SUMMARY
    # =========================================================================

    active = sum(
        1
        for period in periods
        if period["status"] == "ACTIVE"
    )

    upcoming = sum(
        1
        for period in periods
        if period["status"] == "UPCOMING"
    )

    completed = sum(
        1
        for period in periods
        if period["status"] == "COMPLETED"
    )


    # =========================================================================
    # 5. RESPONSE
    # =========================================================================

    return {
        "summary": {
            "total":
                len(periods),

            "active":
                active,

            "upcoming":
                upcoming,

            "completed":
                completed,
        },

        "periods":
            periods,
    }


def get_lecturer_internship_period(
    db: Session,
    period_id: int,
    lecturer_id: int | str | None = None,
) -> dict:
    """Return one internship period using the same metrics as the list view."""

    result = get_lecturer_internship_periods(
        db=db,
        lecturer_id=lecturer_id,
    )

    period = next(
        (
            item
            for item in result["periods"]
            if item["id"] == period_id
        ),
        None,
    )

    if period is None:
        raise ValueError("Khong tim thay dot thuc tap.")

    return period


def update_lecturer_internship_period(
    db: Session,
    period_id: int,
    payload,
    lecturer_id: int | str | None = None,
) -> dict:
    """Update the semester record used as an internship period."""

    if _get_lecturer(db=db, lecturer_id=lecturer_id) is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")

    name = (payload.name or "").strip()
    semester_code = (payload.semesterCode or "").strip()
    academic_year = (payload.academicYear or "").strip()

    if not name or not semester_code or not academic_year:
        raise ValueError("Tên đợt, mã học kỳ và năm học không được để trống.")

    if payload.endDate < payload.startDate:
        raise ValueError("Ngày kết thúc không được trước ngày bắt đầu.")

    duplicate = db.execute(
        text(
            """
            SELECT id
            FROM public.semesters
            WHERE LOWER(semester_code) = LOWER(:semester_code)
              AND id <> :period_id
            LIMIT 1
            """
        ),
        {
            "semester_code": semester_code,
            "period_id": period_id,
        },
    ).mappings().first()

    if duplicate is not None:
        raise ValueError("Mã học kỳ đã được sử dụng cho một đợt khác.")

    try:
        updated = db.execute(
            text(
                """
                UPDATE public.semesters
                SET name = :name,
                    semester_code = :semester_code,
                    academic_year = :academic_year,
                    start_date = :start_date,
                    end_date = :end_date,
                    updated_at = NOW()
                WHERE id = :period_id
                RETURNING id
                """
            ),
            {
                "name": name,
                "semester_code": semester_code,
                "academic_year": academic_year,
                "start_date": payload.startDate,
                "end_date": payload.endDate,
                "period_id": period_id,
            },
        ).mappings().first()

        if updated is None:
            raise ValueError("Không tìm thấy đợt thực tập cần cập nhật.")

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "id": int(updated["id"]),
        "message": "Đã cập nhật đợt thực tập thành công.",
    }


def create_lecturer_internship_period(
    db: Session,
    payload,
    lecturer_id: int | str | None = None,
) -> dict:
    """Create a semester record used as an internship period."""

    if _get_lecturer(db=db, lecturer_id=lecturer_id) is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")

    name = (payload.name or "").strip()
    semester_code = (payload.semesterCode or "").strip()
    academic_year = (payload.academicYear or "").strip()

    if not name or not semester_code or not academic_year:
        raise ValueError("Tên đợt, mã học kỳ và năm học không được để trống.")

    if payload.endDate < payload.startDate:
        raise ValueError("Ngày kết thúc không được trước ngày bắt đầu.")

    duplicate = db.execute(
        text(
            """
            SELECT id
            FROM public.semesters
            WHERE LOWER(semester_code) = LOWER(:semester_code)
            LIMIT 1
            """
        ),
        {"semester_code": semester_code},
    ).mappings().first()

    if duplicate is not None:
        raise ValueError("Mã học kỳ đã được sử dụng cho một đợt khác.")

    try:
        created = db.execute(
            text(
                """
                INSERT INTO public.semesters (
                    name,
                    semester_code,
                    academic_year,
                    start_date,
                    end_date,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    :name,
                    :semester_code,
                    :academic_year,
                    :start_date,
                    :end_date,
                    TRUE,
                    NOW(),
                    NOW()
                )
                RETURNING id
                """
            ),
            {
                "name": name,
                "semester_code": semester_code,
                "academic_year": academic_year,
                "start_date": payload.startDate,
                "end_date": payload.endDate,
            },
        ).mappings().first()
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "id": int(created["id"]),
        "message": "Đã tạo đợt thực tập thành công.",
    }
