"use client";

import { lecturerFetch as fetch } from "@/lib/lecturerAuth";

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Save,
  School,
  UserRound,
} from "lucide-react";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import styles from "./page.module.css";


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";


type InternshipStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED";


interface StudentOption {
  id: number;
  fullName: string;
  studentCode: string;
  className: string | null;
  major: string | null;
}


interface SemesterOption {
  id: number;
  name: string;
  academicYear: string | null;
  semesterCode: string | null;
}


interface CompanyOption {
  id: number;
  name: string;
  industry: string | null;
}


interface FormOptionsResponse {
  students: StudentOption[];
  semesters: SemesterOption[];
  companies: CompanyOption[];
}


interface AddStudentPayload {
  studentId: number;
  semesterId: number;
  companyId: number | null;
  positionTitle: string;
  startDate: string | null;
  endDate: string | null;
  status: InternshipStatus;
}


interface AddStudentResponse {
  internshipId: number;
  studentId: number;
  message: string;
}


function safeErrorMessage(body: string, status: number): string {
  if (!body.trim()) {
    return `Backend trả về lỗi ${status}.`;
  }

  try {
    const parsed = JSON.parse(body) as {
      detail?: string;
    };

    if (
      typeof parsed.detail === "string" &&
      parsed.detail.trim()
    ) {
      return parsed.detail;
    }
  } catch {
    // Body không phải JSON -> trả nguyên body.
  }

  return body;
}


export default function AddLecturerStudentPage() {
  const router = useRouter();

  const [options, setOptions] =
    useState<FormOptionsResponse>({
      students: [],
      semesters: [],
      companies: [],
    });

  const [loadingOptions, setLoadingOptions] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [studentId, setStudentId] =
    useState("");

  const [semesterId, setSemesterId] =
    useState("");

  const [companyId, setCompanyId] =
    useState("");

  const [positionTitle, setPositionTitle] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [status, setStatus] =
    useState<InternshipStatus>(
      "NOT_STARTED",
    );


  useEffect(() => {
    const controller =
      new AbortController();

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/api/v1/lecturers/students/form-options`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        const body =
          await response.text();

        if (!response.ok) {
          throw new Error(
            safeErrorMessage(
              body,
              response.status,
            ),
          );
        }

        const payload =
          JSON.parse(
            body,
          ) as FormOptionsResponse;

        setOptions({
          students:
            Array.isArray(payload.students)
              ? payload.students
              : [],

          semesters:
            Array.isArray(payload.semesters)
              ? payload.semesters
              : [],

          companies:
            Array.isArray(payload.companies)
              ? payload.companies
              : [],
        });
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải dữ liệu biểu mẫu.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      controller.abort();
    };
  }, []);


  const selectedStudent =
    useMemo(
      () =>
        options.students.find(
          (student) =>
            student.id ===
            Number(studentId),
        ) ?? null,
      [
        options.students,
        studentId,
      ],
    );


  const selectedSemester =
    useMemo(
      () =>
        options.semesters.find(
          (semester) =>
            semester.id ===
            Number(semesterId),
        ) ?? null,
      [
        options.semesters,
        semesterId,
      ],
    );


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const parsedStudentId =
      Number(studentId);

    const parsedSemesterId =
      Number(semesterId);

    const parsedCompanyId =
      companyId
        ? Number(companyId)
        : null;

    if (
      !Number.isInteger(
        parsedStudentId,
      ) ||
      parsedStudentId <= 0
    ) {
      setError(
        "Bạn chưa chọn sinh viên.",
      );

      return;
    }

    if (
      !Number.isInteger(
        parsedSemesterId,
      ) ||
      parsedSemesterId <= 0
    ) {
      setError(
        "Bạn chưa chọn học kỳ.",
      );

      return;
    }

    if (!positionTitle.trim()) {
      setError(
        "Vui lòng nhập vị trí thực tập.",
      );

      return;
    }

    if (
      startDate &&
      endDate &&
      new Date(endDate).getTime() <
        new Date(startDate).getTime()
    ) {
      setError(
        "Ngày kết thúc không được trước ngày bắt đầu.",
      );

      return;
    }

    const payload: AddStudentPayload = {
      studentId:
        parsedStudentId,

      semesterId:
        parsedSemesterId,

      companyId:
        parsedCompanyId,

      positionTitle:
        positionTitle.trim(),

      startDate:
        startDate || null,

      endDate:
        endDate || null,

      status,
    };

    try {
      setSubmitting(true);

      const response =
        await fetch(
          `${API_BASE_URL}/api/v1/lecturers/students`,
          {
            method: "POST",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const body =
        await response.text();

      if (!response.ok) {
        throw new Error(
          safeErrorMessage(
            body,
            response.status,
          ),
        );
      }

      const result =
        JSON.parse(
          body,
        ) as AddStudentResponse;

      setSuccess(
        result.message ||
          "Đã thêm sinh viên vào danh sách của bạn.",
      );

      window.setTimeout(
        () => {
          router.push(
            "/lecturer/students",
          );
        },
        800,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể thêm sinh viên.",
      );
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <LecturerShell
      title="Thêm sinh viên"
    >
      <main
        className={styles.page}
      >
        <button
          className={
            styles.backButton
          }
          onClick={() =>
            router.push(
              "/lecturer/students",
            )
          }
          type="button"
        >
          <ArrowLeft
            size={17}
          />

          Quay lại Sinh viên của tôi
        </button>


        <section
          className={
            styles.pageHeader
          }
        >
          <div>
            <p
              className={
                styles.eyebrow
              }
            >
              QUẢN LÝ THỰC TẬP
            </p>

            <h1>
              Thêm sinh viên
            </h1>

            <p>
              Chọn một sinh viên đã có
              tài khoản trong hệ thống
              và thêm sinh viên đó vào
              danh sách thực tập bạn
              đang hướng dẫn.
            </p>
          </div>
        </section>


        {error && (
          <div
            className={
              styles.errorBox
            }
          >
            <AlertTriangle
              size={18}
            />

            <span>
              {error}
            </span>
          </div>
        )}


        {success && (
          <div
            className={
              styles.successBox
            }
          >
            <CheckCircle2
              size={18}
            />

            <span>
              {success}
            </span>
          </div>
        )}


        {loadingOptions ? (
          <section
            className={
              styles.loadingCard
            }
          >
            <Loader2
              className={
                styles.spin
              }
              size={28}
            />

            <p>
              Đang tải danh sách
              sinh viên, học kỳ và
              doanh nghiệp...
            </p>
          </section>
        ) : (
          <form
            className={
              styles.formCard
            }
            onSubmit={
              handleSubmit
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <div
                className={
                  styles.sectionIcon
                }
              >
                <UserRound
                  size={21}
                />
              </div>

              <div>
                <h2>
                  Thông tin sinh viên
                </h2>

                <p>
                  Chỉ hiển thị sinh viên
                  chưa nằm trong danh
                  sách hướng dẫn hiện
                  tại của bạn.
                </p>
              </div>
            </div>


            <div
              className={
                styles.formGrid
              }
            >
              <label
                className={
                  styles.fieldFull
                }
              >
                <span>
                  Sinh viên
                  <b>*</b>
                </span>

                <select
                  disabled={
                    submitting
                  }
                  onChange={(
                    event,
                  ) =>
                    setStudentId(
                      event.target
                        .value,
                    )
                  }
                  required
                  value={
                    studentId
                  }
                >
                  <option value="">
                    -- Chọn sinh viên --
                  </option>

                  {options.students.map(
                    (
                      student,
                    ) => (
                      <option
                        key={
                          student.id
                        }
                        value={
                          student.id
                        }
                      >
                        {
                          student.studentCode
                        }{" "}
                        -{" "}
                        {
                          student.fullName
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>


              {selectedStudent && (
                <div
                  className={
                    styles.studentPreview
                  }
                >
                  <div
                    className={
                      styles.previewIcon
                    }
                  >
                    <School
                      size={22}
                    />
                  </div>

                  <div>
                    <strong>
                      {
                        selectedStudent.fullName
                      }
                    </strong>

                    <span>
                      {
                        selectedStudent.studentCode
                      }
                    </span>
                  </div>

                  <div
                    className={
                      styles.previewMeta
                    }
                  >
                    <span>
                      Lớp
                    </span>

                    <strong>
                      {selectedStudent.className ||
                        "Chưa cập nhật"}
                    </strong>
                  </div>

                  <div
                    className={
                      styles.previewMeta
                    }
                  >
                    <span>
                      Ngành
                    </span>

                    <strong>
                      {selectedStudent.major ||
                        "Chưa cập nhật"}
                    </strong>
                  </div>
                </div>
              )}
            </div>


            <div
              className={
                styles.divider
              }
            />


            <div
              className={
                styles.sectionHeader
              }
            >
              <div
                className={
                  styles.sectionIcon
                }
              >
                <GraduationCap
                  size={21}
                />
              </div>

              <div>
                <h2>
                  Thông tin thực tập
                </h2>

                <p>
                  Thông tin này sẽ tạo
                  bản ghi trong bảng
                  internships và liên kết
                  sinh viên với giảng viên.
                </p>
              </div>
            </div>


            <div
              className={
                styles.formGrid
              }
            >
              <label>
                <span>
                  Học kỳ
                  <b>*</b>
                </span>

                <div
                  className={
                    styles.inputWithIcon
                  }
                >
                  <CalendarDays
                    size={17}
                  />

                  <select
                    disabled={
                      submitting
                    }
                    onChange={(
                      event,
                    ) =>
                      setSemesterId(
                        event.target
                          .value,
                      )
                    }
                    required
                    value={
                      semesterId
                    }
                  >
                    <option value="">
                      -- Chọn học kỳ --
                    </option>

                    {options.semesters.map(
                      (
                        semester,
                      ) => (
                        <option
                          key={
                            semester.id
                          }
                          value={
                            semester.id
                          }
                        >
                          {
                            semester.name
                          }
                          {semester.academicYear
                            ? ` - ${semester.academicYear}`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </label>


              <label>
                <span>
                  Doanh nghiệp
                </span>

                <div
                  className={
                    styles.inputWithIcon
                  }
                >
                  <Building2
                    size={17}
                  />

                  <select
                    disabled={
                      submitting
                    }
                    onChange={(
                      event,
                    ) =>
                      setCompanyId(
                        event.target
                          .value,
                      )
                    }
                    value={
                      companyId
                    }
                  >
                    <option value="">
                      -- Chưa chọn doanh nghiệp --
                    </option>

                    {options.companies.map(
                      (
                        company,
                      ) => (
                        <option
                          key={
                            company.id
                          }
                          value={
                            company.id
                          }
                        >
                          {
                            company.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </label>


              <label
                className={
                  styles.fieldFull
                }
              >
                <span>
                  Vị trí thực tập
                  <b>*</b>
                </span>

                <input
                  disabled={
                    submitting
                  }
                  maxLength={
                    200
                  }
                  onChange={(
                    event,
                  ) =>
                    setPositionTitle(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ví dụ: Backend Intern"
                  required
                  type="text"
                  value={
                    positionTitle
                  }
                />
              </label>


              <label>
                <span>
                  Ngày bắt đầu
                </span>

                <input
                  disabled={
                    submitting
                  }
                  onChange={(
                    event,
                  ) =>
                    setStartDate(
                      event.target
                        .value,
                    )
                  }
                  type="date"
                  value={
                    startDate
                  }
                />
              </label>


              <label>
                <span>
                  Ngày kết thúc
                </span>

                <input
                  disabled={
                    submitting
                  }
                  min={
                    startDate ||
                    undefined
                  }
                  onChange={(
                    event,
                  ) =>
                    setEndDate(
                      event.target
                        .value,
                    )
                  }
                  type="date"
                  value={
                    endDate
                  }
                />
              </label>


              <label
                className={
                  styles.fieldFull
                }
              >
                <span>
                  Trạng thái ban đầu
                </span>

                <select
                  disabled={
                    submitting
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatus(
                      event.target
                        .value as InternshipStatus,
                    )
                  }
                  value={
                    status
                  }
                >
                  <option value="NOT_STARTED">
                    Chưa bắt đầu
                  </option>

                  <option value="IN_PROGRESS">
                    Đang thực tập
                  </option>

                  <option value="PAUSED">
                    Tạm dừng
                  </option>

                  <option value="COMPLETED">
                    Hoàn thành
                  </option>
                </select>
              </label>
            </div>


            {selectedSemester && (
              <div
                className={
                  styles.helperBox
                }
              >
                <CalendarDays
                  size={17}
                />

                <span>
                  Đang thêm sinh viên
                  vào{" "}
                  <strong>
                    {
                      selectedSemester.name
                    }
                  </strong>
                  {selectedSemester.academicYear
                    ? ` (${selectedSemester.academicYear})`
                    : ""}
                  .
                </span>
              </div>
            )}


            <div
              className={
                styles.formActions
              }
            >
              <button
                className={
                  styles.cancelButton
                }
                disabled={
                  submitting
                }
                onClick={() =>
                  router.push(
                    "/lecturer/students",
                  )
                }
                type="button"
              >
                <ArrowLeft
                  size={17}
                />

                Quay lại
              </button>


              <button
                className={
                  styles.submitButton
                }
                disabled={
                  submitting ||
                  loadingOptions
                }
                type="submit"
              >
                {submitting ? (
                  <Loader2
                    className={
                      styles.spin
                    }
                    size={17}
                  />
                ) : (
                  <Save
                    size={17}
                  />
                )}

                {submitting
                  ? "Đang thêm..."
                  : "Thêm sinh viên"}
              </button>
            </div>
          </form>
        )}
      </main>
    </LecturerShell>
  );
}
