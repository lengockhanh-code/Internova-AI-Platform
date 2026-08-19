"use client";

import { lecturerFetch as fetch } from "@/lib/lecturerAuth";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Pencil,
  RefreshCw,
  School,
  Star,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import LecturerShell from "@/components/lecturer/LecturerShell";
import styles from "./page.module.css";


// =============================================================================
// API
// =============================================================================

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


// =============================================================================
// TYPES
// =============================================================================

type InternshipStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED";


type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "LATE"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED";


type ReportSubmissionStatus =
  | "UPCOMING"
  | "NOT_SUBMITTED"
  | "ON_TIME"
  | "LATE";


interface LatestRequiredReport {
  scheduleId: number;

  reportId:
    | number
    | null;

  weekNumber: number;

  title:
    | string
    | null;

  dueAt: string;

  submittedAt:
    | string
    | null;

  submissionStatus:
    ReportSubmissionStatus;

  reviewStatus:
    | ReportStatus
    | null;

  lecturerScore:
    | number
    | null;
}


interface Student {
  studentId: number;
  internshipId: number;

  studentName: string;

  studentCode:
    | string
    | null;

  // Thông tin học tập
  className:
    | string
    | null;

  major:
    | string
    | null;

  companyName:
    | string
    | null;

  positionTitle:
    | string
    | null;

  progressPercentage: number;

  reportProgressPercentage: number;

  reportsSubmitted: number;

  reportsRequiredToDate: number;

  averageScore: number;

  warningCount: number;

  status: InternshipStatus;

  latestRequiredReport:
    | LatestRequiredReport
    | null;
}


interface DashboardResponse {
  students?: Array<
    Partial<Student>
  >;
}


// =============================================================================
// HELPERS
// =============================================================================

function safeText(
  value:
    | string
    | null
    | undefined,
  fallback = "Chưa cập nhật",
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return fallback;
  }

  return value.trim();
}


function safeNumber(
  value:
    | number
    | null
    | undefined,
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : 0;
}


function normalizeStudent(
  raw: Partial<Student>,
): Student {
  return {
    studentId:
      typeof raw.studentId === "number"
        ? raw.studentId
        : 0,

    internshipId:
      typeof raw.internshipId === "number"
        ? raw.internshipId
        : 0,

    studentName:
      safeText(
        raw.studentName,
        "Chưa cập nhật",
      ),

    studentCode:
      typeof raw.studentCode === "string"
        ? raw.studentCode
        : null,

    className:
      typeof raw.className === "string"
        ? raw.className
        : null,

    major:
      typeof raw.major === "string"
        ? raw.major
        : null,

    companyName:
      typeof raw.companyName === "string"
        ? raw.companyName
        : null,

    positionTitle:
      typeof raw.positionTitle === "string"
        ? raw.positionTitle
        : null,

    progressPercentage:
      safeNumber(
        raw.progressPercentage,
      ),

    reportProgressPercentage:
      safeNumber(
        raw.reportProgressPercentage,
      ),

    reportsSubmitted:
      safeNumber(
        raw.reportsSubmitted,
      ),

    reportsRequiredToDate:
      safeNumber(
        raw.reportsRequiredToDate,
      ),

    averageScore:
      safeNumber(
        raw.averageScore,
      ),

    warningCount:
      safeNumber(
        raw.warningCount,
      ),

    status:
      raw.status === "NOT_STARTED" ||
      raw.status === "IN_PROGRESS" ||
      raw.status === "PAUSED" ||
      raw.status === "COMPLETED"
        ? raw.status
        : "NOT_STARTED",

    latestRequiredReport:
      raw.latestRequiredReport ??
      null,
  };
}


function getInitials(
  name: string,
): string {
  const normalized =
    name.trim();

  if (!normalized) {
    return "SV";
  }

  return normalized
    .split(/\s+/)
    .slice(-2)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase(),
    )
    .join("");
}


function formatDate(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(date);
}


function statusLabel(
  status: InternshipStatus,
): string {
  switch (status) {
    case "IN_PROGRESS":
      return "Đang thực tập";

    case "COMPLETED":
      return "Hoàn thành";

    case "PAUSED":
      return "Tạm dừng";

    default:
      return "Chưa bắt đầu";
  }
}


function reportLabel(
  status:
    | ReportSubmissionStatus
    | undefined,
): string {
  switch (status) {
    case "ON_TIME":
      return "Đã nộp đúng hạn";

    case "LATE":
      return "Nộp muộn";

    case "NOT_SUBMITTED":
      return "Chưa nộp";

    case "UPCOMING":
      return "Chưa tới hạn";

    default:
      return "Chưa có lịch báo cáo";
  }
}


// =============================================================================
// PAGE
// =============================================================================

export default function LecturerStudentDetailPage() {
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
    student,
    setStudent,
  ] = useState<Student | null>(
    null,
  );


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  // ===========================================================================
  // LOAD DATA
  // ===========================================================================

  async function loadStudent(): Promise<void> {
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
          "Mã sinh viên trên đường dẫn không hợp lệ.",
        );
      }


      const response =
        await fetch(
          `${API_BASE_URL}/api/v1/lecturers/dashboard`,
          {
            method: "GET",

            cache:
              "no-store",

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
          body
            ? `Backend ${response.status}: ${body}`
            : `Backend trả về lỗi ${response.status}.`,
        );
      }


      let result:
        DashboardResponse;

      try {
        result =
          JSON.parse(
            body,
          ) as DashboardResponse;
      } catch {
        throw new Error(
          "Backend không trả về JSON hợp lệ.",
        );
      }


      const rawStudents =
        Array.isArray(
          result.students,
        )
          ? result.students
          : [];


      const selectedRaw =
        rawStudents.find(
          (item) =>
            item.studentId ===
            studentId,
        ) ?? null;


      if (!selectedRaw) {
        throw new Error(
          "Không tìm thấy sinh viên thuộc quyền hướng dẫn của giảng viên.",
        );
      }


      setStudent(
        normalizeStudent(
          selectedRaw,
        ),
      );
    } catch (loadError) {
      setStudent(null);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải thông tin sinh viên.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    // Reload when the dynamic student route changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);


  // ===========================================================================
  // DERIVED DATA
  // ===========================================================================

  const report =
    student?.latestRequiredReport ??
    null;


  const internshipProgress =
    useMemo(
      () =>
        Math.min(
          100,
          Math.max(
            0,
            student?.progressPercentage ??
              0,
          ),
        ),
      [student],
    );


  const reportProgress =
    useMemo(
      () =>
        Math.min(
          100,
          Math.max(
            0,
            student?.reportProgressPercentage ??
              0,
          ),
        ),
      [student],
    );


  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <LecturerShell
      title="Chi tiết sinh viên"
    >
      <main
        className={styles.page}
      >
        {/* =====================================================
            TOP ACTIONS
        ===================================================== */}

        <div
          className={
            styles.topActions
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

            Quay lại danh sách
          </button>


          {/* Chỉ hiện nút Sửa khi đã tải được sinh viên */}
          {!loading &&
            !error &&
            student && (
              <button
                className={
                  styles.editButton
                }
                onClick={() =>
                  router.push(
                    `/lecturer/students/${student.studentId}/edit`,
                  )
                }
                type="button"
              >
                <Pencil
                  size={16}
                />

                Sửa thông tin
              </button>
            )}
        </div>


        {/* =====================================================
            LOADING
        ===================================================== */}

        {loading ? (
          <div
            className={
              styles.stateBox
            }
          >
            <RefreshCw
              className={
                styles.spin
              }
              size={30}
            />

            <p>
              Đang tải thông tin
              sinh viên...
            </p>
          </div>
        ) : error || !student ? (
          /* ===================================================
             ERROR
          =================================================== */

          <div
            className={
              styles.stateBox
            }
          >
            <AlertTriangle
              size={34}
            />

            <h2>
              Không thể hiển thị
              sinh viên
            </h2>

            <p>
              {error ||
                "Không tìm thấy dữ liệu."}
            </p>

            <button
              onClick={() =>
                void loadStudent()
              }
              type="button"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {/* =================================================
                PROFILE HEADER
            ================================================= */}

            <section
              className={
                styles.profileHeader
              }
            >
              <div
                className={
                  styles.profileIdentity
                }
              >
                <div
                  className={
                    styles.avatar
                  }
                >
                  {getInitials(
                    student.studentName,
                  )}
                </div>


                <div>
                  <div
                    className={
                      styles.nameRow
                    }
                  >
                    <h1>
                      {
                        student.studentName
                      }
                    </h1>

                    <span
                      className={
                        styles.statusBadge
                      }
                    >
                      {statusLabel(
                        student.status,
                      )}
                    </span>
                  </div>


                  {/* ===========================================
                      MÃ SV · LỚP · NGÀNH
                  =========================================== */}

                  <p>
                    {safeText(
                      student.studentCode,
                      "Chưa có mã SV",
                    )}

                    {" · "}

                    {safeText(
                      student.className,
                      "Chưa có lớp",
                    )}

                    {" · "}

                    {safeText(
                      student.major,
                      "Chưa cập nhật ngành",
                    )}
                  </p>


                  <div
                    className={
                      styles.companyLine
                    }
                  >
                    <Building2
                      size={15}
                    />

                    <span>
                      {safeText(
                        student.companyName,
                      )}
                    </span>

                    <span>
                      •
                    </span>

                    <span>
                      {safeText(
                        student.positionTitle,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>


            {/* =================================================
                METRICS
            ================================================= */}

            <section
              className={
                styles.metricGrid
              }
            >
              <article
                className={
                  styles.metricCard
                }
              >
                <div
                  className={
                    styles.metricIcon
                  }
                >
                  <GraduationCap
                    size={21}
                  />
                </div>

                <div>
                  <span>
                    Tiến độ thực tập
                  </span>

                  <strong>
                    {internshipProgress.toFixed(
                      0,
                    )}
                    %
                  </strong>
                </div>
              </article>


              <article
                className={
                  styles.metricCard
                }
              >
                <div
                  className={
                    styles.metricIcon
                  }
                >
                  <FileText
                    size={21}
                  />
                </div>

                <div>
                  <span>
                    Tiến độ báo cáo
                  </span>

                  <strong>
                    {reportProgress.toFixed(
                      0,
                    )}
                    %
                  </strong>

                  <small>
                    {
                      student.reportsSubmitted
                    }
                    /
                    {
                      student.reportsRequiredToDate
                    }{" "}
                    báo cáo
                  </small>
                </div>
              </article>


              <article
                className={
                  styles.metricCard
                }
              >
                <div
                  className={
                    styles.metricIcon
                  }
                >
                  <Star
                    size={21}
                  />
                </div>

                <div>
                  <span>
                    Điểm trung bình
                  </span>

                  <strong>
                    {student.averageScore >
                    0
                      ? student.averageScore.toFixed(
                          1,
                        )
                      : "—"}
                  </strong>
                </div>
              </article>


              <article
                className={
                  styles.metricCard
                }
              >
                <div
                  className={
                    styles.metricIcon
                  }
                >
                  <AlertTriangle
                    size={21}
                  />
                </div>

                <div>
                  <span>
                    Cảnh báo
                  </span>

                  <strong>
                    {
                      student.warningCount
                    }
                  </strong>
                </div>
              </article>
            </section>


            {/* =================================================
                DETAIL GRID
            ================================================= */}

            <section
              className={
                styles.detailGrid
              }
            >
              {/* ===============================================
                  THÔNG TIN HỌC TẬP
              =============================================== */}

              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <p>
                      SINH VIÊN
                    </p>

                    <h2>
                      Thông tin học tập
                    </h2>
                  </div>

                  <School
                    size={22}
                  />
                </div>


                <div
                  className={
                    styles.infoList
                  }
                >
                  <div>
                    <span>
                      Mã sinh viên
                    </span>

                    <strong>
                      {safeText(
                        student.studentCode,
                        "—",
                      )}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Lớp
                    </span>

                    <strong>
                      {safeText(
                        student.className,
                        "—",
                      )}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Ngành
                    </span>

                    <strong>
                      {safeText(
                        student.major,
                        "—",
                      )}
                    </strong>
                  </div>
                </div>
              </article>


              {/* ===============================================
                  THÔNG TIN THỰC TẬP
              =============================================== */}

              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <p>
                      THỰC TẬP
                    </p>

                    <h2>
                      Thông tin thực tập
                    </h2>
                  </div>

                  <GraduationCap
                    size={22}
                  />
                </div>


                <div
                  className={
                    styles.infoList
                  }
                >
                  <div>
                    <span>
                      Doanh nghiệp
                    </span>

                    <strong>
                      {safeText(
                        student.companyName,
                      )}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Vị trí
                    </span>

                    <strong>
                      {safeText(
                        student.positionTitle,
                      )}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Trạng thái
                    </span>

                    <strong>
                      {statusLabel(
                        student.status,
                      )}
                    </strong>
                  </div>
                </div>


                <div
                  className={
                    styles.progressBlock
                  }
                >
                  <div
                    className={
                      styles.progressHeader
                    }
                  >
                    <span>
                      Tiến độ hiện tại
                    </span>

                    <strong>
                      {internshipProgress.toFixed(
                        0,
                      )}
                      %
                    </strong>
                  </div>


                  <div
                    className={
                      styles.progressTrack
                    }
                  >
                    <span
                      style={{
                        width:
                          `${internshipProgress}%`,
                      }}
                    />
                  </div>
                </div>
              </article>


              {/* ===============================================
                  KỲ BÁO CÁO GẦN NHẤT
              =============================================== */}

              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <p>
                      BÁO CÁO
                    </p>

                    <h2>
                      Kỳ báo cáo gần nhất
                    </h2>
                  </div>

                  <FileText
                    size={22}
                  />
                </div>


                {report ? (
                  <div
                    className={
                      styles.reportDetail
                    }
                  >
                    <div
                      className={
                        styles.reportTitleRow
                      }
                    >
                      <div>
                        <strong>
                          {report.title ||
                            `Báo cáo tuần ${report.weekNumber}`}
                        </strong>

                        <span>
                          Tuần{" "}
                          {
                            report.weekNumber
                          }
                        </span>
                      </div>


                      <span
                        className={
                          styles.reportStatus
                        }
                      >
                        {reportLabel(
                          report.submissionStatus,
                        )}
                      </span>
                    </div>


                    <div
                      className={
                        styles.reportInfoGrid
                      }
                    >
                      <div>
                        <Clock3
                          size={16}
                        />

                        <span>
                          Hạn nộp
                        </span>

                        <strong>
                          {formatDate(
                            report.dueAt,
                          )}
                        </strong>
                      </div>


                      <div>
                        <CheckCircle2
                          size={16}
                        />

                        <span>
                          Ngày nộp
                        </span>

                        <strong>
                          {report.submittedAt
                            ? formatDate(
                                report.submittedAt,
                              )
                            : "Chưa nộp"}
                        </strong>
                      </div>


                      <div>
                        <Star
                          size={16}
                        />

                        <span>
                          Điểm
                        </span>

                        <strong>
                          {report.lecturerScore !==
                          null
                            ? report.lecturerScore.toFixed(
                                1,
                              )
                            : "Chưa chấm"}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      styles.emptyPanel
                    }
                  >
                    Chưa có kỳ báo cáo nào.
                  </div>
                )}
              </article>


              {/* ===============================================
                  TIẾN ĐỘ BÁO CÁO
              =============================================== */}

              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <p>
                      THEO DÕI
                    </p>

                    <h2>
                      Tiến độ báo cáo
                    </h2>
                  </div>

                  <CalendarDays
                    size={22}
                  />
                </div>


                <div
                  className={
                    styles.progressOverview
                  }
                >
                  <div
                    className={
                      styles.bigProgressNumber
                    }
                  >
                    {reportProgress.toFixed(
                      0,
                    )}
                    %
                  </div>


                  <p>
                    Đã hoàn thành{" "}

                    <strong>
                      {
                        student.reportsSubmitted
                      }
                    </strong>{" "}

                    trên{" "}

                    <strong>
                      {
                        student.reportsRequiredToDate
                      }
                    </strong>{" "}

                    báo cáo phải nộp
                    tính đến hiện tại.
                  </p>


                  <div
                    className={
                      styles.progressTrack
                    }
                  >
                    <span
                      style={{
                        width:
                          `${reportProgress}%`,
                      }}
                    />
                  </div>
                </div>
              </article>


              {/* ===============================================
                  TÌNH TRẠNG CẦN CHÚ Ý
              =============================================== */}

              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <p>
                      ĐÁNH GIÁ
                    </p>

                    <h2>
                      Tình trạng cần chú ý
                    </h2>
                  </div>

                  <AlertTriangle
                    size={22}
                  />
                </div>


                <div
                  className={
                    styles.attentionBox
                  }
                >
                  {student.warningCount >
                  0 ? (
                    <>
                      <strong>
                        {
                          student.warningCount
                        }{" "}
                        mục cần chú ý
                      </strong>

                      <p>
                        Hệ thống đang ghi
                        nhận báo cáo quá
                        hạn, báo cáo nộp
                        muộn hoặc cảnh báo
                        liên quan đến sinh
                        viên này.
                      </p>
                    </>
                  ) : (
                    <>
                      <strong>
                        Không có cảnh báo
                      </strong>

                      <p>
                        Sinh viên hiện
                        không có mục cần
                        chú ý.
                      </p>
                    </>
                  )}
                </div>
              </article>


              {/* ===============================================
                  TÓM TẮT HỌC TẬP / THỰC TẬP
              =============================================== */}

              <article
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <div>
                    <p>
                      TỔNG QUAN
                    </p>

                    <h2>
                      Hồ sơ sinh viên
                    </h2>
                  </div>

                  <BookOpen
                    size={22}
                  />
                </div>


                <div
                  className={
                    styles.infoList
                  }
                >
                  <div>
                    <span>
                      Sinh viên
                    </span>

                    <strong>
                      {
                        student.studentName
                      }
                    </strong>
                  </div>


                  <div>
                    <span>
                      Lớp / Ngành
                    </span>

                    <strong>
                      {safeText(
                        student.className,
                        "—",
                      )}
                      {" / "}
                      {safeText(
                        student.major,
                        "—",
                      )}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Doanh nghiệp
                    </span>

                    <strong>
                      {safeText(
                        student.companyName,
                        "—",
                      )}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Điểm TB
                    </span>

                    <strong>
                      {student.averageScore >
                      0
                        ? student.averageScore.toFixed(
                            1,
                          )
                        : "—"}
                    </strong>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </LecturerShell>
  );
}
