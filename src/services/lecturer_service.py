"""Backward-compatible exports for lecturer services.

New code should import from the domain-specific lecturer service modules.
"""

from src.services.lecturer_common_service import (
    _get_lecturer,
    _normalize_lecturer_id,
    _to_float,
    _to_int,
    to_iso,
)
from src.services.lecturer_dashboard_service import (
    get_lecturer_dashboard_data,
)
from src.services.lecturer_internship_period_service import (
    create_lecturer_internship_period,
    get_lecturer_internship_periods,
    update_lecturer_internship_period,
)
from src.services.lecturer_student_management_service import (
    add_lecturer_student,
    get_lecturer_student_edit_data,
    get_lecturer_student_form_options,
    update_lecturer_student,
)

__all__ = [
    "_get_lecturer",
    "_normalize_lecturer_id",
    "_to_float",
    "_to_int",
    "to_iso",
    "get_lecturer_dashboard_data",
    "create_lecturer_internship_period",
    "get_lecturer_internship_periods",
    "update_lecturer_internship_period",
    "add_lecturer_student",
    "get_lecturer_student_edit_data",
    "get_lecturer_student_form_options",
    "update_lecturer_student",
]
