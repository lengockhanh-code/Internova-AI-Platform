from __future__ import annotations

from datetime import date

from pydantic import Field

from src.models.lecturer_common import InternshipStatus, LecturerBaseModel


class LecturerStudentOption(LecturerBaseModel):
    id: int
    fullName: str
    studentCode: str
    className: str | None = None
    major: str | None = None


class LecturerSemesterOption(LecturerBaseModel):
    id: int
    name: str
    academicYear: str | None = None
    semesterCode: str | None = None


class LecturerCompanyOption(LecturerBaseModel):
    id: int
    name: str
    industry: str | None = None


class LecturerStudentFormOptionsResponse(LecturerBaseModel):
    students: list[LecturerStudentOption] = Field(
        default_factory=list,
    )

    semesters: list[LecturerSemesterOption] = Field(
        default_factory=list,
    )

    companies: list[LecturerCompanyOption] = Field(
        default_factory=list,
    )


class AddLecturerStudentRequest(LecturerBaseModel):
    studentId: int
    semesterId: int

    companyId: int | None = None

    positionTitle: str = Field(
        min_length=1,
        max_length=200,
    )

    startDate: date | None = None
    endDate: date | None = None

    status: InternshipStatus = "NOT_STARTED"


class AddLecturerStudentResponse(LecturerBaseModel):
    internshipId: int
    studentId: int
    message: str

class EditLecturerStudentInfo(
    LecturerBaseModel
):
    studentId: int
    studentName: str

    studentCode: str | None = None
    className: str | None = None
    major: str | None = None


class EditLecturerInternshipInfo(
    LecturerBaseModel
):
    internshipId: int

    semesterId: int | None = None
    companyId: int | None = None

    positionTitle: str

    startDate: date | None = None
    endDate: date | None = None

    status: InternshipStatus


class EditLecturerStudentResponse(
    LecturerBaseModel
):
    student: EditLecturerStudentInfo

    internship: EditLecturerInternshipInfo

    semesters: list[
        LecturerSemesterOption
    ] = Field(
        default_factory=list,
    )

    companies: list[
        LecturerCompanyOption
    ] = Field(
        default_factory=list,
    )


class UpdateLecturerStudentRequest(
    LecturerBaseModel
):
    semesterId: int

    companyId: int | None = None

    positionTitle: str = Field(
        min_length=1,
        max_length=200,
    )

    startDate: date | None = None
    endDate: date | None = None

    status: InternshipStatus


class UpdateLecturerStudentResponse(
    LecturerBaseModel
):
    internshipId: int
    studentId: int

    message: str

