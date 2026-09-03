from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_configuration import (
    AdminConfigurationResponse,
    AdminConfigurationUpdateRequest,
)
from src.security.auth import get_current_user
from src.services.admin_configuration_service import (
    get_admin_configuration,
    update_admin_configuration,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/system/configuration",
    tags=["Admin Configuration"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AdminConfigurationResponse)
def read_configuration(db: Session = Depends(get_db)) -> AdminConfigurationResponse:
    return AdminConfigurationResponse(**get_admin_configuration(db))


@router.put("", response_model=AdminConfigurationResponse)
def save_configuration(
    payload: AdminConfigurationUpdateRequest,
    db: Session = Depends(get_db),
) -> AdminConfigurationResponse:
    return AdminConfigurationResponse(
        **update_admin_configuration(db, payload.model_dump())
    )
