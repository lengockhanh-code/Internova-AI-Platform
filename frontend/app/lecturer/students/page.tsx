"use client";

import { lecturerFetch as fetch } from "@/lib/lecturerAuth";

import {
  AlertTriangle,
  Building2,
  ChevronRight,
  GraduationCap,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import styles from "./page.module.css";


// =============================================================================
// API
// =============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";


// =============================================================================
// TYPES
// =============================================================================

type InternshipStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED";


type ReportSubmissionStatus =
  | "UPCOMING"
  | "NOT_SUBMITTED"
  | "ON_TIME"
  | "LATE";


interface LatestRequiredReport {
  scheduleId: number;
  reportId: number | null;

  weekNumber: number;
  title: string | null;

  dueAt: string;
  submittedAt: string | null;

  submissionStatus: ReportSubmissionStatus;

  lecturerScore: number | null;
}


interface Student {
  internshipId: number;
  studentId: number;

  studentName: string;
  studentCode: string | null;

  // Thông tin học tập
  className: string | null;
  major: string | null;

  companyName: string | null;
  positionTitle: string | null;

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
  students?: Array<Partial<Student>>;
}


// =============================================================================
// HELPERS
// =============================================================================

function safeString(
  value: string | null | undefined,
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
  value: number | null | undefined,
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
    internshipId:
      typeof raw.internshipId === "number"
        ? raw.internshipId
        : 0,

    studentId:
      typeof raw.studentId === "number"
        ? raw.studentId
        : 0,

    studentName:
      safeString(
        raw.studentName,
        "Chưa cập nhật",
      ),

    studentCode:
      typeof raw.studentCode === "string"
        ? raw.studentCode
        : null,

    // QUAN TRỌNG:
    // Trước đây file của bạn có interface className
    // nhưng normalizeStudent() chưa lấy field này.
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
      raw.latestRequiredReport ?? null,
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


function internshipStatusLabel(
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


function reportSubmissionLabel(
  status:
    | ReportSubmissionStatus
    | undefined,
): string {
  switch (status) {
    case "ON_TIME":
      return "Đã nộp";

    case "LATE":
      return "Nộp muộn";

    case "NOT_SUBMITTED":
      return "Chưa nộp";

    case "UPCOMING":
      return "Chưa tới hạn";

    default:
      return "Chưa có";
  }
}


function statusClass(
  status: InternshipStatus,
): string {
  switch (status) {
    case "IN_PROGRESS":
      return styles.statusInProgress;

    case "COMPLETED":
      return styles.statusCompleted;

    case "PAUSED":
      return styles.statusPaused;

    default:
      return styles.statusNotStarted;
  }
}


function reportClass(
  status:
    | ReportSubmissionStatus
    | undefined,
): string {
  switch (status) {
    case "ON_TIME":
      return styles.reportOnTime;

    case "LATE":
      return styles.reportLate;

    case "NOT_SUBMITTED":
      return styles.reportMissing;

    default:
      return styles.reportUpcoming;
  }
}


function progressClass(
  value: number,
): string {
  if (value >= 100) {
    return styles.progressCompleted;
  }

  if (value >= 50) {
    return styles.progressGood;
  }

  if (value >= 25) {
    return styles.progressWarning;
  }

  return styles.progressDanger;
}


// =============================================================================
// PAGE
// =============================================================================

export default function LecturerStudentsPage() {
  const router =
    useRouter();

  const [
    students,
    setStudents,
  ] = useState<Student[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState<
    "ALL" | InternshipStatus
  >("ALL");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("q");
    if (!query) return;

    const timeout = window.setTimeout(() => setSearch(query), 0);
    return () => window.clearTimeout(timeout);
  }, []);


  // ===========================================================================
  // LOAD STUDENTS
  // ===========================================================================

  async function loadStudents(): Promise<void> {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          `${API_BASE_URL}/api/v1/lecturers/dashboard`,
          {
            method: "GET",
            cache: "no-store",

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

      setStudents(
        rawStudents.map(
          normalizeStudent,
        ),
      );
    } catch (loadError) {
      setStudents([]);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách sinh viên.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    // Initial API synchronization for this client page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudents();
  }, []);


  // ===========================================================================
  // FILTER
  // ===========================================================================

  const filteredStudents =
    useMemo(
      () => {
        const keyword =
          search
            .trim()
            .toLowerCase();

        return students.filter(
          (student) => {
            const matchesKeyword =
              !keyword ||

              student.studentName
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              safeString(
                student.studentCode,
                "",
              )
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              safeString(
                student.className,
                "",
              )
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              safeString(
                student.major,
                "",
              )
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              safeString(
                student.companyName,
                "",
              )
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              safeString(
                student.positionTitle,
                "",
              )
                .toLowerCase()
                .includes(
                  keyword,
                );

            const matchesStatus =
              status === "ALL" ||
              student.status ===
                status;

            return (
              matchesKeyword &&
              matchesStatus
            );
          },
        );
      },
      [
        search,
        status,
        students,
      ],
    );


  // ===========================================================================
  // SUMMARY
  // ===========================================================================

  const inProgress =
    students.filter(
      (student) =>
        student.status ===
        "IN_PROGRESS",
    ).length;


  const completed =
    students.filter(
      (student) =>
        student.status ===
        "COMPLETED",
    ).length;


  const needAttention =
    students.filter(
      (student) =>
        student.warningCount >
        0,
    ).length;


  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <LecturerShell
      title="Sinh viên của tôi"
    >
      <main
        className={styles.page}
      >
        {/* =====================================================
            HEADER
        ===================================================== */}

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
              Sinh viên của tôi
            </h1>

            <p>
              Theo dõi tiến độ thực tập,
              tình trạng báo cáo, điểm số
              và cảnh báo của từng sinh
              viên.
            </p>
          </div>

          <div
            className={
              styles.headerActions
            }
          >
            <button
              className={
                styles.addButton
              }
              onClick={() =>
                router.push(
                  "/lecturer/students/add",
                )
              }
              type="button"
            >
              <UserPlus
                size={17}
              />

              Thêm sinh viên
            </button>

            <button
              className={
                styles.refreshButton
              }
              onClick={() =>
                void loadStudents()
              }
              type="button"
            >
              <RefreshCw
                size={17}
              />

              Làm mới
            </button>
          </div>
        </section>


        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        <section
          className={
            styles.summaryGrid
          }
        >
          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.summaryIcon
              }
            >
              <Users
                size={21}
              />
            </div>

            <div>
              <span>
                Tổng sinh viên
              </span>

              <strong>
                {students.length}
              </strong>
            </div>
          </article>


          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.summaryIcon
              }
            >
              <GraduationCap
                size={21}
              />
            </div>

            <div>
              <span>
                Đang thực tập
              </span>

              <strong>
                {inProgress}
              </strong>
            </div>
          </article>


          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.summaryIcon
              }
            >
              <GraduationCap
                size={21}
              />
            </div>

            <div>
              <span>
                Đã hoàn thành
              </span>

              <strong>
                {completed}
              </strong>
            </div>
          </article>


          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.summaryIcon
              }
            >
              <AlertTriangle
                size={21}
              />
            </div>

            <div>
              <span>
                Cần chú ý
              </span>

              <strong>
                {needAttention}
              </strong>
            </div>
          </article>
        </section>


        {/* =====================================================
            STUDENT LIST
        ===================================================== */}

        <section
          className={
            styles.contentCard
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div>
              <h2>
                Danh sách sinh viên
              </h2>

              <p>
                {
                  filteredStudents.length
                }{" "}
                sinh viên
              </p>
            </div>
          </div>


          {/* ===================================================
              TOOLBAR
          =================================================== */}

          <div
            className={
              styles.toolbar
            }
          >
            <div
              className={
                styles.searchBox
              }
            >
              <Search
                size={18}
              />

              <input
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Tìm theo tên, mã SV, lớp, ngành, doanh nghiệp hoặc vị trí..."
                value={search}
              />
            </div>

            <select
              className={
                styles.statusSelect
              }
              onChange={(
                event,
              ) =>
                setStatus(
                  event.target
                    .value as
                    | "ALL"
                    | InternshipStatus,
                )
              }
              value={status}
            >
              <option value="ALL">
                Tất cả trạng thái
              </option>

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
          </div>


          {/* ===================================================
              LOADING / ERROR / TABLE
          =================================================== */}

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
                size={28}
              />

              <p>
                Đang tải danh sách
                sinh viên...
              </p>
            </div>
          ) : error ? (
            <div
              className={
                styles.stateBox
              }
            >
              <AlertTriangle
                size={30}
              />

              <h3>
                Không thể tải dữ liệu
              </h3>

              <p>
                {error}
              </p>

              <button
                onClick={() =>
                  void loadStudents()
                }
                type="button"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div
                className={
                  styles.tableWrapper
                }
              >
                <table
                  className={
                    styles.table
                  }
                >
                  <thead>
                    <tr>
                      <th>
                        Sinh viên
                      </th>

                      <th>
                        Mã SV
                      </th>

                      <th>
                        Lớp / Ngành
                      </th>

                      <th>
                        Doanh nghiệp
                      </th>

                      <th>
                        Tiến độ
                      </th>

                      <th>
                        Báo cáo gần nhất
                      </th>

                      <th>
                        Điểm TB
                      </th>

                      <th>
                        Cảnh báo
                      </th>

                      <th>
                        Trạng thái
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStudents.map(
                      (
                        student,
                      ) => {
                        const progress =
                          Math.min(
                            100,
                            Math.max(
                              0,
                              safeNumber(
                                student.progressPercentage,
                              ),
                            ),
                          );

                        const latest =
                          student.latestRequiredReport;

                        return (
                          <tr
                            key={
                              student.internshipId
                            }
                            onClick={() =>
                              router.push(
                                `/lecturer/students/${student.studentId}`,
                              )
                            }
                          >
                            {/* ===============================
                                STUDENT
                            =============================== */}

                            <td>
                              <div
                                className={
                                  styles.studentCell
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
                                  <strong>
                                    {
                                      student.studentName
                                    }
                                  </strong>

                                  <span>
                                    {safeString(
                                      student.positionTitle,
                                      "Chưa cập nhật vị trí",
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>


                            {/* ===============================
                                STUDENT CODE
                            =============================== */}

                            <td>
                              <strong
                                className={
                                  styles.studentCode
                                }
                              >
                                {safeString(
                                  student.studentCode,
                                  "—",
                                )}
                              </strong>
                            </td>


                            {/* ===============================
                                CLASS / MAJOR
                            =============================== */}

                            <td>
                              <div
                                className={
                                  styles.majorCell
                                }
                              >
                                <strong>
                                  {safeString(
                                    student.className,
                                    "Chưa có lớp",
                                  )}
                                </strong>

                                <span>
                                  {safeString(
                                    student.major,
                                    "Chưa cập nhật ngành",
                                  )}
                                </span>
                              </div>
                            </td>


                            {/* ===============================
                                COMPANY
                            =============================== */}

                            <td>
                              <div
                                className={
                                  styles.companyCell
                                }
                              >
                                <Building2
                                  size={16}
                                />

                                <div>
                                  <strong>
                                    {safeString(
                                      student.companyName,
                                    )}
                                  </strong>

                                  <span>
                                    {safeString(
                                      student.positionTitle,
                                      "Chưa cập nhật vị trí",
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>


                            {/* ===============================
                                INTERNSHIP PROGRESS
                            =============================== */}

                            <td>
                              <div
                                className={
                                  styles.progressCell
                                }
                              >
                                <strong>
                                  {progress.toFixed(
                                    0,
                                  )}
                                  %
                                </strong>

                                <div
                                  className={
                                    styles.progressTrack
                                  }
                                >
                                  <span
                                    className={
                                      progressClass(
                                        progress,
                                      )
                                    }
                                    style={{
                                      width:
                                        `${progress}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>


                            {/* ===============================
                                LATEST REPORT
                            =============================== */}

                            <td>
                              {latest ? (
                                <div
                                  className={
                                    styles.reportCell
                                  }
                                >
                                  <strong>
                                    Tuần{" "}
                                    {
                                      latest.weekNumber
                                    }
                                  </strong>

                                  <span
                                    className={`${styles.reportBadge} ${reportClass(
                                      latest.submissionStatus,
                                    )}`}
                                  >
                                    {reportSubmissionLabel(
                                      latest.submissionStatus,
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className={
                                    styles.mutedText
                                  }
                                >
                                  Chưa có
                                </span>
                              )}
                            </td>


                            {/* ===============================
                                SCORE
                            =============================== */}

                            <td>
                              <strong
                                className={
                                  styles.score
                                }
                              >
                                {student.averageScore >
                                0
                                  ? `${student.averageScore.toFixed(1)}/10`
                                  : "—"}
                              </strong>
                            </td>


                            {/* ===============================
                                WARNINGS
                            =============================== */}

                            <td>
                              <span
                                className={`${styles.warningBadge} ${
                                  student.warningCount >
                                  0
                                    ? styles.warningBadgeActive
                                    : ""
                                }`}
                              >
                                {
                                  student.warningCount
                                }
                              </span>
                            </td>


                            {/* ===============================
                                STATUS
                            =============================== */}

                            <td>
                              <span
                                className={`${styles.statusBadge} ${statusClass(
                                  student.status,
                                )}`}
                              >
                                {internshipStatusLabel(
                                  student.status,
                                )}
                              </span>
                            </td>


                            {/* ===============================
                                DETAIL BUTTON
                            =============================== */}

                            <td>
                              <button
                                aria-label={`Xem chi tiết ${student.studentName}`}
                                className={
                                  styles.detailButton
                                }
                                onClick={(
                                  event,
                                ) => {
                                  event.stopPropagation();

                                  router.push(
                                    `/lecturer/students/${student.studentId}`,
                                  );
                                }}
                                type="button"
                              >
                                <ChevronRight
                                  size={18}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>


              {/* =================================================
                  EMPTY STATE
              ================================================= */}

              {filteredStudents.length ===
                0 && (
                <div
                  className={
                    styles.stateBox
                  }
                >
                  <Users
                    size={32}
                  />

                  <h3>
                    Không tìm thấy sinh
                    viên
                  </h3>

                  <p>
                    Thử thay đổi từ khóa
                    hoặc bộ lọc trạng
                    thái.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </LecturerShell>
  );
}
