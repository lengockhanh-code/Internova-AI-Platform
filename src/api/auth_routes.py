from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from src.database.connection import get_db

from src.security.auth import (
    get_current_user,
)

from src.models.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
)

from src.services.auth_service import (
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    InvalidVinuniEmailError,
    StudentCodeAlreadyExistsError,
    StudentCodeNotFoundError,
    login_user,
    register_user,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ============================================================
# REGISTER
# ============================================================


@router.post(
    "/register",
    response_model=AuthResponse,
)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    try:
        return register_user(
            db=db,
            first_name=payload.firstName,
            last_name=payload.lastName,
            student_code=payload.studentCode,
            gender=payload.gender,
            email=str(payload.email),
            password=payload.password,
        )

    except EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    except StudentCodeAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    except StudentCodeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except InvalidVinuniEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc


# ============================================================
# LOGIN
# STUDENT + LECTURER
# Backend tự xác định role.
# ============================================================


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    try:
        return login_user(
            db=db,
            email=str(payload.email),
            password=payload.password,
        )

    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


# ============================================================
# GET CURRENT USER
# ============================================================


@router.get("/me")
def get_me(
    current_user=Depends(
        get_current_user
    ),
):
    return {
        "id":
            current_user["id"],

        "email":
            current_user["email"],

        "fullName":
            current_user["full_name"],

        "role":
            current_user["role"],

        "avatarUrl":
            current_user["avatar_url"],
    }