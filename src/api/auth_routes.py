from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
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
    StudentCodeAlreadyExistsError,
    register_user,
    login_user,
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

            first_name=
                payload.firstName,

            last_name=
                payload.lastName,

            student_code=
                payload.studentCode,

            gender=
                payload.gender,

            email=
                str(payload.email),

            password=
                payload.password,
        )


    except EmailAlreadyExistsError as exc:

        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )


    except StudentCodeAlreadyExistsError as exc:

        raise HTTPException(
            status_code=409,
            detail=str(exc),
        )


    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )



# ============================================================
# LOGIN
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

            email=str(
                payload.email
            ),

            password=payload.password,

            role=payload.role,
        )


    except InvalidCredentialsError as exc:

        raise HTTPException(
            status_code=401,
            detail=str(exc),
        )
# ============================================================
# GET CURRENT USER
# ============================================================

@router.get("/me")
def get_me(
    current_user = Depends(get_current_user),
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