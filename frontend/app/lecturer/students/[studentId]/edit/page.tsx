"use client";

import { lecturerFetch as fetch } from "@/lib/lecturerAuth";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Save,
  UserRound,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";

import styles from "./page.module.css";


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
    /\/$/,
    "",
  ) ||
  process.env.NEXT_PUBLIC_API_URL?.replace(
    /\/$/,
    "",
  ) ||
  "http://localhost:8000";


type InternshipStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED";


interface SemesterOption {
  id: number;

  name: string;

  academicYear:
    | string
    | null;

  semesterCode:
    | string
    | null;
}


interface CompanyOption {
  id: number;

  name: string;

  industry:
    | string
    | null;
}


interface EditStudentResponse {
  student: {
    studentId: number;

    studentName: string;

    studentCode:
      | string
      | null;

    className:
      | string
      | null;

    major:
      | string
      | null;
  };

  internship: {
    internshipId: number;

    semesterId:
      | number
      | null;

    companyId:
      | number
      | null;

    positionTitle: string;

    startDate:
      | string
      | null;

    endDate:
      | string
      | null;

    status: InternshipStatus;
  };

  semesters:
    SemesterOption[];

  companies:
    CompanyOption[];
}


interface UpdateStudentPayload {
  className:
    | string
    | null;

  semesterId: number;

  companyId:
    | number
    | null;

  positionTitle: string;

  startDate:
    | string
    | null;

  endDate:
    | string
    | null;

  status:
    InternshipStatus;
}


function safeErrorMessage(
  body: string,
  status: number,
): string {
  if (!body.trim()) {
    return `Backend trả về lỗi ${status}.`;
  }

  try {
    const parsed =
      JSON.parse(body) as {
        detail?: string;
      };

    if (
      typeof parsed.detail ===
        "string" &&
      parsed.detail.trim()
    ) {
      return parsed.detail;
    }
  } catch {
    //
  }

  return body;
}


export default function EditLecturerStudentPage() {
  const router =
    useRouter();

  const params =
    useParams<{
      studentId: string;
    }>();

  const studentId =
    Number(
      params.studentId,
    );


  const [
    data,
    setData,
  ] =
    useState<
      EditStudentResponse | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    success,
    setSuccess,
  ] =
    useState("");


  const [
    className,
    setClassName,
  ] = useState("");


  const [
    semesterId,
    setSemesterId,
  ] =
    useState("");


  const [
    companyId,
    setCompanyId,
  ] =
    useState("");


  const [
    positionTitle,
    setPositionTitle,
  ] =
    useState("");


  const [
    startDate,
    setStartDate,
  ] =
    useState("");


  const [
    endDate,
    setEndDate,
  ] =
    useState("");


  const [
    internshipStatus,
    setInternshipStatus,
  ] =
    useState<InternshipStatus>(
      "NOT_STARTED",
    );


  // ===========================================================
  // LOAD STUDENT
  // ===========================================================

  useEffect(() => {
    const controller =
      new AbortController();


    async function loadStudent() {
      try {
        setLoading(true);

        setError("");


        if (
          !Number.isInteger(
            studentId,
          ) ||
          studentId <= 0
        ) {
          throw new Error(
            "Mã sinh viên không hợp lệ.",
          );
        }


        const response =
          await fetch(
            `${API_BASE_URL}/api/v1/lecturers/students/${studentId}/edit`,
            {
              method:
                "GET",

              cache:
                "no-store",

              signal:
                controller.signal,

              headers: {
                Accept:
                  "application/json",
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
          ) as EditStudentResponse;


        setData(
          payload,
        );


        setClassName(
          payload.student
            .className ||
            "",
        );


        setSemesterId(
          payload.internship
            .semesterId
            ? String(
                payload
                  .internship
                  .semesterId,
              )
            : "",
        );


        setCompanyId(
          payload.internship
            .companyId
            ? String(
                payload
                  .internship
                  .companyId,
              )
            : "",
        );


        setPositionTitle(
          payload.internship
            .positionTitle ||
            "",
        );


        setStartDate(
          payload.internship
            .startDate ||
            "",
        );


        setEndDate(
          payload.internship
            .endDate ||
            "",
        );


        setInternshipStatus(
          payload.internship
            .status,
        );
      } catch (
        loadError
      ) {
        if (
          loadError instanceof
            DOMException &&
          loadError.name ===
            "AbortError"
        ) {
          return;
        }


        setError(
          loadError instanceof
            Error
            ? loadError.message
            : "Không thể tải thông tin sinh viên.",
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(
            false,
          );
        }
      }
    }


    void loadStudent();


    return () => {
      controller.abort();
    };
  }, [
    studentId,
  ]);


  // ===========================================================
  // UPDATE
  // ===========================================================

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();


    setError("");

    setSuccess("");


    const parsedSemesterId =
      Number(
        semesterId,
      );


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


    if (
      !positionTitle.trim()
    ) {
      setError(
        "Vui lòng nhập vị trí thực tập.",
      );

      return;
    }


    if (
      startDate &&
      endDate &&
      new Date(
        endDate,
      ).getTime() <
        new Date(
          startDate,
        ).getTime()
    ) {
      setError(
        "Ngày kết thúc không được trước ngày bắt đầu.",
      );

      return;
    }


    const payload:
      UpdateStudentPayload =
      {
        className:
          className.trim() ||
          null,

        semesterId:
          parsedSemesterId,

        companyId:
          companyId
            ? Number(
                companyId,
              )
            : null,

        positionTitle:
          positionTitle.trim(),

        startDate:
          startDate ||
          null,

        endDate:
          endDate ||
          null,

        status:
          internshipStatus,
      };


    try {
      setSubmitting(
        true,
      );


      const response =
        await fetch(
          `${API_BASE_URL}/api/v1/lecturers/students/${studentId}`,
          {
            method:
              "PUT",

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


      setSuccess(
        "Đã cập nhật thông tin sinh viên.",
      );


      window.setTimeout(
        () => {
          router.push(
            "/lecturer/students",
          );
        },
        700,
      );
    } catch (
      submitError
    ) {
      setError(
        submitError instanceof
          Error
          ? submitError.message
          : "Không thể cập nhật sinh viên.",
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  return (
    <LecturerShell
      title="Sửa sinh viên"
    >
      <main
        className={
          styles.page
        }
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
          <p
            className={
              styles.eyebrow
            }
          >
            QUẢN LÝ THỰC TẬP
          </p>

          <h1>
            Sửa thông tin sinh viên
          </h1>

          <p>
            Cập nhật thông tin thực
            tập của sinh viên đang
            thuộc quyền hướng dẫn
            của bạn.
          </p>
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

            {error}
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

            {success}
          </div>
        )}


        {loading ? (
          <div
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

            Đang tải thông tin...
          </div>
        ) : data ? (
          <form
            className={
              styles.formCard
            }
            onSubmit={
              handleSubmit
            }
          >
            {/* STUDENT */}

            <div
              className={
                styles.sectionHeader
              }
            >
              <UserRound
                size={21}
              />

              <div>
                <h2>
                  Thông tin sinh viên
                </h2>

                <p>
                  Có thể cập nhật lớp;
                  các thông tin học tập
                  còn lại được lấy từ hồ
                  sơ sinh viên.
                </p>
              </div>
            </div>


            <div
              className={
                styles.studentCard
              }
            >
              <div>
                <strong>
                  {
                    data.student
                      .studentName
                  }
                </strong>

                <span>
                  {
                    data.student
                      .studentCode
                  }
                </span>
              </div>


              <div>
                <label
                  className={
                    styles.classField
                  }
                >
                  <span>
                    Lớp
                  </span>

                  <input
                    aria-label="Lớp sinh viên"
                    maxLength={100}
                    onChange={(
                      event,
                    ) =>
                      setClassName(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Ví dụ: CS2026-A"
                    value={
                      className
                    }
                  />
                </label>
              </div>


              <div>
                <span>
                  Ngành
                </span>

                <strong>
                  {data.student
                    .major ||
                    "Chưa cập nhật"}
                </strong>
              </div>
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
              <GraduationCap
                size={21}
              />

              <div>
                <h2>
                  Thông tin thực tập
                </h2>
              </div>
            </div>


            <div
              className={
                styles.formGrid
              }
            >
              <label>
                <span>
                  Học kỳ *
                </span>

                <select
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

                  {data.semesters.map(
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
              </label>


              <label>
                <span>
                  Doanh nghiệp
                </span>

                <select
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
                    -- Chưa chọn --
                  </option>

                  {data.companies.map(
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
              </label>


              <label
                className={
                  styles.fieldFull
                }
              >
                <span>
                  Vị trí thực tập *
                </span>

                <input
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
                  required
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
                  Trạng thái
                </span>

                <select
                  onChange={(
                    event,
                  ) =>
                    setInternshipStatus(
                      event.target
                        .value as InternshipStatus,
                    )
                  }
                  value={
                    internshipStatus
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


            <div
              className={
                styles.formActions
              }
            >
              <button
                className={
                  styles.cancelButton
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
                  submitting
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
                  ? "Đang lưu..."
                  : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </LecturerShell>
  );
}
