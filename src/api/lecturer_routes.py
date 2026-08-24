from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.lecturer_dashboard import LecturerDashboardResponse
from src.models.lecturer_internship_periods import (
    CreateLecturerInternshipPeriodRequest,
    CreateLecturerInternshipPeriodResponse,
    LecturerInternshipPeriod,
    LecturerInternshipPeriodsResponse,
    UpdateLecturerInternshipPeriodRequest,
    UpdateLecturerInternshipPeriodResponse,
)
from src.models.lecturer_student_management import (
    AddLecturerStudentRequest,
    AddLecturerStudentResponse,
    EditLecturerStudentResponse,
    LecturerStudentFormOptionsResponse,
    UpdateLecturerStudentRequest,
    UpdateLecturerStudentResponse,
)
from src.security.auth import require_lecturer
from src.services.lecturer_dashboard_service import (
    get_lecturer_dashboard_data,
)
from src.services.lecturer_internship_period_service import (
    create_lecturer_internship_period,
    get_lecturer_internship_period,
    get_lecturer_internship_periods,
    update_lecturer_internship_period,
)
from src.services.lecturer_student_management_service import (
    add_lecturer_student,
    get_lecturer_student_edit_data,
    get_lecturer_student_form_options,
    update_lecturer_student,
)

# =============================================================================
# ROUTER
# =============================================================================

router = APIRouter(
    prefix="/lecturers",
    tags=["Lecturers"],
    dependencies=[Depends(require_lecturer)],
)


# =============================================================================
# GET LECTURER DASHBOARD
#
# GET /api/v1/lecturers/dashboard
# =============================================================================

@router.get(
    "/dashboard",
    response_model=LecturerDashboardResponse,
    summary="Lấy dashboard của giảng viên",
    description=(
        "Trả về thông tin giảng viên, thống kê sinh viên, "
        "tiến độ thực tập, tiến độ báo cáo, báo cáo gần nhất "
        "và các deadline sắp tới."
    ),
)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerDashboardResponse:
    """
    Lấy dữ liệu dashboard của giảng viên.

    Hiện tại chưa có authentication nên
    lecturer_service sẽ tạm lấy lecturer active đầu tiên.

    Sau này khi có authentication:

        current_user.id

    sẽ được truyền xuống:

        get_lecturer_dashboard_data(
            db=db,
            lecturer_id=current_user.id,
        )
    """

    try:
        data = get_lecturer_dashboard_data(
            db=db,
            lecturer_id=current_user["id"],
        )

        return LecturerDashboardResponse(
            **data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# =============================================================================
# GET INTERNSHIP PERIODS
#
# GET /api/v1/lecturers/internship-periods
#
# Dùng cho frontend:
#
# /lecturer/internship-periods
#
# Trả về:
# - tổng số đợt
# - đang diễn ra
# - sắp diễn ra
# - đã kết thúc
#
# Mỗi đợt có:
# - tên
# - mã học kỳ
# - năm học
# - ngày bắt đầu
# - ngày kết thúc
# - số sinh viên
# - số lịch báo cáo
# - tiến độ trung bình
# - số sinh viên cần chú ý
# =============================================================================

@router.get(
    "/internship-periods",
    response_model=LecturerInternshipPeriodsResponse,
    summary="Lấy danh sách đợt thực tập",
    description=(
        "Trả về danh sách các đợt thực tập, "
        "số sinh viên, số báo cáo phải nộp, "
        "tiến độ trung bình và số sinh viên cần chú ý."
    ),
)
def get_internship_periods(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerInternshipPeriodsResponse:
    """
    Lấy danh sách đợt thực tập của giảng viên.

    Hiện tại:

        public.semesters

    được dùng như các đợt thực tập.

    Sinh viên trong từng đợt được xác định qua:

        public.internships.semester_id

    và lecturer hiện tại.
    """

    try:
        data = get_lecturer_internship_periods(
            db=db,
            lecturer_id=current_user["id"],
        )

        return LecturerInternshipPeriodsResponse(
            **data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/internship-periods/{period_id}",
    response_model=LecturerInternshipPeriod,
    summary="Lay chi tiet dot thuc tap",
)
def get_internship_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerInternshipPeriod:
    try:
        return LecturerInternshipPeriod(
            **get_lecturer_internship_period(
                db=db,
                period_id=period_id,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


# =============================================================================
# GET OPTIONS FOR ADD-STUDENT FORM
#
# GET /api/v1/lecturers/students/form-options
#
# Dùng cho frontend:
#
# /lecturer/students/add
#
# Trả về:
# - danh sách sinh viên có thể thêm
# - danh sách học kỳ
# - danh sách doanh nghiệp
# =============================================================================

@router.get(
    "/students/form-options",
    response_model=LecturerStudentFormOptionsResponse,
    summary="Lấy dữ liệu cho form thêm sinh viên",
    description=(
        "Trả về danh sách sinh viên có thể thêm, "
        "các học kỳ đang hoạt động và các doanh nghiệp "
        "đang hoạt động để sử dụng trong form thêm sinh viên."
    ),
)
def get_student_form_options(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerStudentFormOptionsResponse:
    """
    Lấy dữ liệu dropdown cho trang:

        /lecturer/students/add

    Bao gồm:

    - students
    - semesters
    - companies
    """

    try:
        data = get_lecturer_student_form_options(
            db=db,
            lecturer_id=current_user["id"],
        )

        return LecturerStudentFormOptionsResponse(
            **data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# =============================================================================
# ADD STUDENT TO LECTURER
#
# POST /api/v1/lecturers/students
#
# Không tạo tài khoản sinh viên mới.
#
# Sinh viên phải tồn tại sẵn trong:
#
# public.users
# public.student_profiles
#
# Backend sẽ tạo bản ghi trong:
#
# public.internships
# =============================================================================

@router.post(
    "/students",
    response_model=AddLecturerStudentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm sinh viên vào danh sách hướng dẫn",
    description=(
        "Gán một sinh viên đã tồn tại trong hệ thống "
        "cho giảng viên hiện tại bằng cách tạo một "
        "bản ghi internship mới."
    ),
)
def create_student_assignment(
    payload: AddLecturerStudentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> AddLecturerStudentResponse:
    """
    Thêm sinh viên vào danh sách hướng dẫn.

    Service kiểm tra:

    1. Lecturer tồn tại.
    2. Student tồn tại và có role STUDENT.
    3. Semester tồn tại.
    4. Company tồn tại nếu có companyId.
    5. Sinh viên chưa có internship trùng học kỳ.
    6. Ngày kết thúc không trước ngày bắt đầu.
    """

    try:
        data = add_lecturer_student(
            db=db,
            payload=payload,
            lecturer_id=current_user["id"],
        )

        return AddLecturerStudentResponse(
            **data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# =============================================================================
# GET STUDENT EDIT DATA
#
# GET /api/v1/lecturers/students/{student_id}/edit
#
# Dùng để pre-fill form sửa sinh viên.
# =============================================================================

@router.get(
    "/students/{student_id}/edit",
    response_model=EditLecturerStudentResponse,
    summary="Lấy dữ liệu sửa sinh viên",
    description=(
        "Trả về thông tin sinh viên, thông tin thực tập hiện tại, "
        "danh sách học kỳ và doanh nghiệp để hiển thị form chỉnh sửa."
    ),
)
def get_student_edit_data(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> EditLecturerStudentResponse:
    """
    Lấy dữ liệu để sửa sinh viên.

    Trả về:

    - student
    - internship
    - semesters
    - companies
    """

    try:
        data = get_lecturer_student_edit_data(
            db=db,
            student_id=student_id,
            lecturer_id=current_user["id"],
        )

        return EditLecturerStudentResponse(
            **data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# =============================================================================
# UPDATE STUDENT INTERNSHIP
#
# PUT /api/v1/lecturers/students/{student_id}
#
# Chỉ cập nhật:
#
# - semester
# - company
# - position
# - start date
# - end date
# - internship status
# - lớp
#
# Không cập nhật:
#
# - họ tên
# - mã sinh viên
# - ngành
# =============================================================================

@router.put(
    "/students/{student_id}",
    response_model=UpdateLecturerStudentResponse,
    summary="Cập nhật lớp và thông tin thực tập sinh viên",
    description=(
        "Cập nhật thông tin lớp và thực tập của sinh viên "
        "thuộc quyền hướng dẫn của giảng viên hiện tại."
    ),
)
def update_student(
    student_id: int,
    payload: UpdateLecturerStudentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> UpdateLecturerStudentResponse:
    """
    Cập nhật lớp và internship của sinh viên.
    """

    try:
        data = update_lecturer_student(
            db=db,
            student_id=student_id,
            payload=payload,
            lecturer_id=current_user["id"],
        )

        return UpdateLecturerStudentResponse(
            **data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/internship-periods",
    response_model=CreateLecturerInternshipPeriodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo đợt thực tập",
)
def create_internship_period(
    payload: CreateLecturerInternshipPeriodRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> CreateLecturerInternshipPeriodResponse:
    try:
        data = create_lecturer_internship_period(
            db=db,
            payload=payload,
            lecturer_id=current_user["id"],
        )
        return CreateLecturerInternshipPeriodResponse(**data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.put(
    "/internship-periods/{period_id}",
    response_model=UpdateLecturerInternshipPeriodResponse,
    summary="Cập nhật đợt thực tập",
)
def update_internship_period(
    period_id: int,
    payload: UpdateLecturerInternshipPeriodRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> UpdateLecturerInternshipPeriodResponse:
    try:
        data = update_lecturer_internship_period(
            db=db,
            period_id=period_id,
            payload=payload,
            lecturer_id=current_user["id"],
        )
        return UpdateLecturerInternshipPeriodResponse(**data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
