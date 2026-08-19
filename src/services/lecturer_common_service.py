from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


# =============================================================================
# HELPERS
# =============================================================================

def to_iso(
    value: datetime | date | str | None,
) -> str | None:
    """
    Chuyển datetime/date sang ISO string để trả về API.

    Pydantic có thể tự serialize datetime, nhưng helper này giúp service
    luôn trả dữ liệu nhất quán kể cả khi SQLAlchemy trả string.
    """

    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return str(value)


def _to_int(value: Any) -> int:
    return int(value or 0)


def _to_float(value: Any) -> float:
    return float(value or 0)


def _normalize_lecturer_id(
    lecturer_id: int | str | None,
) -> int | None:
    """
    Schema hiện tại dùng BIGSERIAL/BIGINT.

    Cho phép service nhận:
        12
        "12"
        None

    Khi chưa có authentication, lecturer_id=None.
    """

    if lecturer_id is None:
        return None

    if isinstance(lecturer_id, int):
        return lecturer_id

    value = str(lecturer_id).strip()

    if not value:
        return None

    if not value.isdigit():
        raise ValueError(
            "lecturer_id phải là BIGINT/int theo schema PostgreSQL hiện tại."
        )

    return int(value)



def _get_lecturer(
    db: Session,
    lecturer_id: int | str | None = None,
):
    """
    Tìm giảng viên hiện tại.

    Hiện tại:
        - nếu route chưa có authentication:
          lecturer_id=None -> lấy lecturer active đầu tiên.

    Sau này:
        - route lấy current_user.id từ token/session;
        - truyền current_user.id vào lecturer_id.

    Không hardcode ID.
    """

    normalized_id = _normalize_lecturer_id(
        lecturer_id
    )

    if normalized_id is not None:
        return db.execute(
            text(
                """
                SELECT
                    u.id,
                    u.full_name,
                    u.avatar_url,

                    lp.academic_title,
                    lp.lecturer_code,
                    lp.faculty,
                    lp.specialization

                FROM public.users AS u

                LEFT JOIN public.lecturer_profiles AS lp
                    ON lp.lecturer_id = u.id

                WHERE u.id = :lecturer_id
                  AND u.role = 'LECTURER'
                  AND u.is_active = TRUE

                LIMIT 1
                """
            ),
            {
                "lecturer_id": normalized_id,
            },
        ).mappings().first()

    return db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                u.avatar_url,

                lp.academic_title,
                lp.lecturer_code,
                lp.faculty,
                lp.specialization

            FROM public.users AS u

            LEFT JOIN public.lecturer_profiles AS lp
                ON lp.lecturer_id = u.id

            WHERE u.role = 'LECTURER'
              AND u.is_active = TRUE

            ORDER BY
                u.created_at ASC,
                u.id ASC

            LIMIT 1
            """
        )
    ).mappings().first()


# =============================================================================
# DASHBOARD SERVICE
# =============================================================================


