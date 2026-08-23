from __future__ import annotations

from typing import Any


def normalize_grade_score(value: Any) -> float | None:
    """Normalize official grades to the system-wide 10-point scale.

    Legacy rows may still contain values on the former 100-point scale.
    This compatibility layer can be removed after every environment has run
    the score migration.
    """
    if value is None:
        return None

    score = float(value)
    if score > 10:
        score /= 10
    return round(score, 2)
