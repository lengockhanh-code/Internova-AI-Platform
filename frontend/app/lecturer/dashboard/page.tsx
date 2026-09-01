"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LoaderCircle,
  Star,
  UsersRound,
} from "lucide-react";

import { useRouter } from "next/navigation";

import LecturerShell from "@/components/lecturer/LecturerShell";
import { lecturerFetch as fetch } from "@/lib/lecturerAuth";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./page.module.css";


// =============================================================================
// Types khớp với backend mới:
// src/models/lecturer.py
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

type ReportType =
  | "WEEKLY"
  | "MIDTERM"
  | "FINAL"
  | "REFLECTION";

interface LecturerInfo {
  id: number | null;
  fullName: string;
  avatarUrl: string | null;
  academicTitle: string | null;
  lecturerCode: string | null;
  faculty: string | null;
  specialization: string | null;
}

interface LecturerStats {
  totalStudents: number;
  pendingApplications: number;
  pendingReports: number;
  openWarnings: number;
  averageScore: number;

  reportsDueToDate: number;
  onTimeReports: number;
  lateReports: number;
  notSubmittedReports: number;
}

interface InternshipProgress {
  total: number;
  notStarted: number;
  inProgress: number;
  paused: number;
  completed: number;
}

interface ReportProgressSummary {
  requiredToDate: number;
  submittedToDate: number;
  onTime: number;
  late: number;
  notSubmitted: number;
  upcoming: number;
}

interface ScoreDistributionItem {
  label: string;
  count: number;
  percentage: number;
}

interface AtRiskStudent {
  studentId: number;
  internshipId: number;
  studentName: string;
  studentCode: string | null;
  progressPercentage: number;
  reportProgressPercentage: number;
  averageScore: number;
  warningCount: number;
  riskLevel: "HIGH" | "MEDIUM";
}

interface LecturerAnalytics {
  completionRate: number;
  averageInternshipProgress: number;
  reportSubmissionRate: number;
  onTimeRate: number;
  studentsAtRisk: number;
  studentsWithScores: number;
  scoreDistribution: ScoreDistributionItem[];
  riskStudents: AtRiskStudent[];
}

interface LatestReport {
  id: number;
  studentId: number | null;
  internshipId: number | null;

  studentName: string;
  studentCode: string | null;
  avatarUrl: string | null;

  weekNumber: number | null;
  reportType: ReportType;

  status: ReportStatus;
  submissionStatus: ReportSubmissionStatus | null;

  submittedAt: string | null;
  dueAt: string | null;

  lecturerScore: number | null;
  lecturerFeedback: string | null;
}

interface LatestRequiredReport {
  scheduleId: number;
  reportId: number | null;

  weekNumber: number;
  title: string | null;

  dueAt: string;
  submittedAt: string | null;

  submissionStatus: ReportSubmissionStatus;
  reviewStatus: ReportStatus | null;
  lecturerScore: number | null;
}

interface LecturerStudent {
  studentId: number;
  internshipId: number;

  studentName: string;
  studentCode: string | null;
  avatarUrl: string | null;

  companyName: string | null;
  positionTitle: string | null;

  progressPercentage: number;

  reportProgressPercentage: number;
  reportsSubmitted: number;
  reportsRequiredToDate: number;

  averageScore: number;
  warningCount: number;

  status: InternshipStatus;

  latestRequiredReport: LatestRequiredReport | null;
}

interface UpcomingDeadline {
  id: number;
  title: string;
  description: string | null;
  deadlineType: string;
  dueAt: string;
}

interface LecturerDashboardData {
  lecturer: LecturerInfo;
  stats: LecturerStats;
  progress: InternshipProgress;
  reportProgress: ReportProgressSummary;
  analytics: LecturerAnalytics;
  latestReports: LatestReport[];
  students: LecturerStudent[];
  upcomingDeadlines: UpcomingDeadline[];
}


// =============================================================================
// Labels
// =============================================================================

const reportStatusLabel: Record<ReportStatus, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  LATE: "Nộp muộn",
  UNDER_REVIEW: "Chờ chấm",
  REVISION_REQUIRED: "Cần sửa",
  APPROVED: "Đã chấm",
};

const submissionStatusLabel: Record<ReportSubmissionStatus, string> = {
  UPCOMING: "Chưa tới hạn",
  NOT_SUBMITTED: "Chưa nộp",
  ON_TIME: "Đúng hạn",
  LATE: "Nộp muộn",
};

const internshipStatusLabel: Record<InternshipStatus, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực tập",
  PAUSED: "Tạm dừng",
  COMPLETED: "Hoàn thành",
};


// =============================================================================
// Helpers
// =============================================================================

function getInitials(fullName: string): string {
  const normalized = fullName.trim();

  if (!normalized) {
    return "GV";
  }

  return normalized
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Chưa cập nhật";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function reportStatusClass(status: ReportStatus): string {
  switch (status) {
    case "APPROVED":
      return styles.statusSuccess;

    case "SUBMITTED":
      return styles.statusInfo;

    case "LATE":
      return styles.statusDanger;

    case "REVISION_REQUIRED":
      return styles.statusWarning;

    case "UNDER_REVIEW":
      return styles.statusPending;

    default:
      return styles.statusMuted;
  }
}

function internshipStatusClass(
  status: InternshipStatus,
): string {
  switch (status) {
    case "COMPLETED":
      return styles.statusInfo;

    case "IN_PROGRESS":
      return styles.statusSuccess;

    case "PAUSED":
      return styles.statusWarning;

    default:
      return styles.statusMuted;
  }
}

function eventColorClass(index: number): string {
  switch (index % 4) {
    case 0:
      return styles.eventColor1;

    case 1:
      return styles.eventColor2;

    case 2:
      return styles.eventColor3;

    default:
      return styles.eventColor4;
  }
}

function getReportDisplayTitle(
  report: LatestReport,
): string {
  switch (report.reportType) {
    case "MIDTERM":
      return "Báo cáo giữa kỳ";

    case "FINAL":
      return "Báo cáo cuối kỳ";

    case "REFLECTION":
      return "Báo cáo phản ánh";

    default:
      return report.weekNumber
        ? `Báo cáo tuần ${report.weekNumber}`
        : "Báo cáo tuần";
  }
}


function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className={styles.emptyState}>
      <FileText
        size={28}
        strokeWidth={1.5}
      />

      <p>
        {text}
      </p>
    </div>
  );
}


// =============================================================================
// Page
// =============================================================================

export default function LecturerDashboardPage() {
  const router = useRouter();

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL?.replace(
      /\/$/,
      "",
    ) || "http://localhost:8000";

  const [data, setData] =
    useState<LecturerDashboardData | null>(
      null,
    );

  const [error, setError] =
    useState<string>("");

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  // ===========================================================================
  // Load dashboard
  // ===========================================================================

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/lecturers/dashboard`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,

            headers: {
              Accept: "application/json",
            },
          },
        );

        const rawBody =
          await response.text();

        if (!response.ok) {
          throw new Error(
            rawBody
              ? `Backend ${response.status}: ${rawBody}`
              : `Backend trả về lỗi ${response.status}.`,
          );
        }

        let payload:
          LecturerDashboardData;

        try {
          payload = JSON.parse(
            rawBody,
          ) as LecturerDashboardData;
        } catch {
          throw new Error(
            "Backend không trả về JSON hợp lệ.",
          );
        }

        setData(payload);
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
            : "Đã xảy ra lỗi không xác định.",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl]);

  // ===========================================================================
  // Calendar
  // ===========================================================================

  const calendarCells =
    useMemo<Array<number | null>>(
      () => {
        const now = new Date();

        const year =
          now.getFullYear();

        const month =
          now.getMonth();

        const firstDayOfMonth =
          new Date(
            year,
            month,
            1,
          );

        const mondayBasedOffset =
          (
            firstDayOfMonth.getDay() +
            6
          ) % 7;

        const daysInMonth =
          new Date(
            year,
            month + 1,
            0,
          ).getDate();

        const cells:
          Array<number | null> = [
            ...Array.from(
              {
                length:
                  mondayBasedOffset,
              },
              () => null,
            ),

            ...Array.from(
              {
                length:
                  daysInMonth,
              },
              (
                _,
                index,
              ) => index + 1,
            ),
          ];

        while (
          cells.length % 7 !== 0
        ) {
          cells.push(null);
        }

        return cells;
      },
      [],
    );


  // ===========================================================================
  // Internship progress chart
  // ===========================================================================

  const progressPercentages =
    useMemo(
      () => {
        const total =
          data?.progress.total ?? 0;

        if (total <= 0) {
          return {
            notStarted: 0,
            inProgress: 0,
            paused: 0,
            completed: 0,
          };
        }

        return {
          notStarted:
            (
              (
                data?.progress
                  .notStarted ?? 0
              ) /
              total
            ) * 100,

          inProgress:
            (
              (
                data?.progress
                  .inProgress ?? 0
              ) /
              total
            ) * 100,

          paused:
            (
              (
                data?.progress
                  .paused ?? 0
              ) /
              total
            ) * 100,

          completed:
            (
              (
                data?.progress
                  .completed ?? 0
              ) /
              total
            ) * 100,
        };
      },
      [data],
    );

  const donutStyle =
    useMemo<CSSProperties>(
      () => {
        const p1 =
          progressPercentages
            .notStarted;

        const p2 =
          p1 +
          progressPercentages
            .inProgress;

        const p3 =
          p2 +
          progressPercentages
            .paused;

        if (
          !data?.progress.total
        ) {
          return {
            background:
              "conic-gradient(#e5e9f2 0deg 360deg)",
          };
        }

        return {
          background: `conic-gradient(
            #aeb8ca 0% ${p1}%,
            #4c96f8 ${p1}% ${p2}%,
            #f2b84b ${p2}% ${p3}%,
            #56bd76 ${p3}% 100%
          )`,
        };
      },
      [
        data,
        progressPercentages,
      ],
    );


  // ===========================================================================
  // Navigation
  // ===========================================================================

  function goToStudents(): void {
    router.push(
      "/lecturer/students",
    );
  }

  function goToReports(): void {
    router.push("/lecturer/reports");
  }

  function goToApplications(): void {
    router.push("/lecturer/applications");
  }

  function goToEvaluations(): void {
    router.push("/lecturer/evaluations");
  }

  function goToReminders(): void {
    router.push("/lecturer/reminders");
  }


  // ===========================================================================
  // Loading / Error
  // ===========================================================================

  if (isLoading) {
    return (
      <LecturerShell title="Tổng quan">
        <main className={styles.centerState}>
          <LoaderCircle className={styles.spinner} size={38} />
          <p>Đang tải dữ liệu từ PostgreSQL...</p>
        </main>
      </LecturerShell>
    );
  }

  if (error || !data) {
    return (
      <LecturerShell title="Tổng quan">
        <main className={styles.centerState}>
          <AlertTriangle size={42} />
          <h1>Không thể hiển thị dashboard</h1>
          <p>{error || "Không nhận được dữ liệu."}</p>
          <p className={styles.errorHint}>
            Kiểm tra FastAPI tại
            {" "}
            http://localhost:8000/api/v1/lecturers/dashboard
            {" "}
            và xem log terminal backend.
          </p>
        </main>
      </LecturerShell>
    );
  }


  // ===========================================================================
  // Cards
  // ===========================================================================

  const statCards: Array<{
    label: string;
    value: string | number;
    icon: typeof UsersRound;
    tone: string;
    linkText: string;
    onClick?: () => void;
  }> = [
    {
      label:
        "Sinh viên đang hướng dẫn",

      value:
        data.stats.totalStudents,

      icon:
        UsersRound,

      tone:
        styles.blueTone,

      linkText:
        "Xem danh sách",

      onClick:
        goToStudents,
    },

    {
      label:
        "Hồ sơ chờ duyệt",

      value:
        data.stats
          .pendingApplications,

      icon:
        ClipboardCheck,

      tone:
        styles.greenTone,

      linkText:
        "Xem và xử lý",

      onClick:
        goToApplications,
    },

    {
      label:
        "Báo cáo chờ chấm",

      value:
        data.stats.pendingReports,

      icon:
        FileText,

      tone:
        styles.purpleTone,

      linkText:
        "Xem chi tiết",

      onClick:
        goToReports,
    },

    {
      label:
        "Cảnh báo",

      value:
        data.stats.openWarnings,

      icon:
        AlertTriangle,

      tone:
        styles.orangeTone,

      linkText:
        "Xem cảnh báo",

      onClick:
        goToReminders,
    },

    {
      label:
        "Điểm TB sinh viên",

      value:
        `${data.stats.averageScore.toFixed(2)}/10`,

      icon:
        Star,

      tone:
        styles.cyanTone,

      linkText:
        "Thang điểm 10",

      onClick:
        goToEvaluations,
    },
  ];


  // ===========================================================================
  // UI
  // ===========================================================================

  return (
    <LecturerShell title="Tổng quan">
      <main className={styles.content}>
          <section
            className={
              styles.welcomeSection
            }
          >
            <h1>
              Xin chào,{" "}
              {
                data.lecturer
                  .fullName
              }{" "}
              👋
            </h1>

            <p>
              Đây là tổng quan hoạt
              động hướng dẫn thực tập
              của bạn.
            </p>
          </section>


          {/* ===================================================
              ANALYTICS
          =================================================== */}

          <section className={styles.analyticsGrid}>
            <article className={`${styles.panel} ${styles.efficiencyPanel}`}>
              <div className={styles.panelHeader}>
                <div className={styles.panelTitleWithIcon}>
                  <ClipboardCheck size={18} />
                  <div>
                    <h2>Hiệu quả hướng dẫn</h2>
                    <p>Các tỷ lệ được tính từ dữ liệu hiện tại</p>
                  </div>
                </div>
              </div>

              <div className={styles.metricList}>
                {[
                  {
                    label: "Hoàn thành thực tập",
                    value: data.analytics.completionRate,
                    detail: `${data.progress.completed}/${data.progress.total} sinh viên`,
                    tone: styles.metricGreen,
                  },
                  {
                    label: "Tiến độ thực tập trung bình",
                    value: data.analytics.averageInternshipProgress,
                    detail: "Theo tiến độ của từng sinh viên",
                    tone: styles.metricBlue,
                  },
                  {
                    label: "Tỷ lệ nộp báo cáo",
                    value: data.analytics.reportSubmissionRate,
                    detail: `${data.reportProgress.submittedToDate}/${data.reportProgress.requiredToDate} báo cáo đến hạn`,
                    tone: styles.metricPurple,
                  },
                  {
                    label: "Nộp báo cáo đúng hạn",
                    value: data.analytics.onTimeRate,
                    detail: `${data.reportProgress.onTime} báo cáo đúng hạn`,
                    tone: styles.metricOrange,
                  },
                ].map((metric) => (
                  <div className={styles.metricItem} key={metric.label}>
                    <div className={styles.metricHeading}>
                      <div>
                        <strong>{metric.label}</strong>
                        <span>{metric.detail}</span>
                      </div>
                      <b>{metric.value.toFixed(1)}%</b>
                    </div>
                    <div className={styles.metricTrack}>
                      <span
                        className={metric.tone}
                        style={{
                          width: `${Math.min(100, Math.max(0, metric.value))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className={`${styles.panel} ${styles.scorePanel}`}>
              <div className={styles.panelHeader}>
                <div className={styles.panelTitleWithIcon}>
                  <Star size={18} />
                  <div>
                    <h2>Phân bố điểm sinh viên</h2>
                    <p>{data.analytics.studentsWithScores} sinh viên đã có điểm</p>
                  </div>
                </div>
              </div>

              <div className={styles.scoreChart}>
                {data.analytics.scoreDistribution.map((bucket) => (
                  <div className={styles.scoreColumn} key={bucket.label}>
                    <div className={styles.scoreBarArea}>
                      <span>{bucket.count}</span>
                      <div
                        className={styles.scoreBar}
                        style={{
                          height: `${Math.max(bucket.percentage, bucket.count > 0 ? 8 : 2)}%`,
                        }}
                      />
                    </div>
                    <strong>{bucket.label}</strong>
                    <small>{bucket.percentage.toFixed(0)}%</small>
                  </div>
                ))}
              </div>
            </article>

            <article className={`${styles.panel} ${styles.riskPanel}`}>
              <div className={styles.panelHeader}>
                <div className={styles.panelTitleWithIcon}>
                  <AlertTriangle size={18} />
                  <div>
                    <h2>Sinh viên cần chú ý</h2>
                    <p>{data.analytics.studentsAtRisk} sinh viên có cảnh báo hoặc chậm tiến độ</p>
                  </div>
                </div>
                <button className={styles.textButton} onClick={goToStudents} type="button">
                  Xem tất cả
                </button>
              </div>

              {data.analytics.riskStudents.length === 0 ? (
                <div className={styles.riskEmpty}>
                  <ClipboardCheck size={26} />
                  <strong>Chưa có sinh viên rủi ro</strong>
                  <span>Tất cả sinh viên đang theo đúng tiến độ.</span>
                </div>
              ) : (
                <div className={styles.riskList}>
                  {data.analytics.riskStudents.map((student) => (
                    <button
                      className={styles.riskStudent}
                      key={student.internshipId}
                      onClick={() => router.push(`/lecturer/students/${student.studentId}`)}
                      type="button"
                    >
                      <div className={styles.smallAvatar}>
                        {getInitials(student.studentName)}
                      </div>
                      <div className={styles.riskStudentInfo}>
                        <strong>{student.studentName}</strong>
                        <span>
                          {student.studentCode || "Chưa có mã SV"} · Tiến độ {student.progressPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <span
                        className={`${styles.riskBadge} ${
                          student.riskLevel === "HIGH"
                            ? styles.riskHigh
                            : styles.riskMedium
                        }`}
                      >
                        {student.riskLevel === "HIGH" ? "Cao" : "Theo dõi"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </article>
          </section>


          {/* ===================================================
              STATS
          =================================================== */}

          <section
            className={
              styles.statsGrid
            }
          >
            {statCards.map(
              (card) => {
                const Icon =
                  card.icon;

                return (
                  <article
                    className={
                      styles.statCard
                    }
                    key={card.label}
                  >
                    <div
                      className={`${styles.statIcon} ${card.tone}`}
                    >
                      <Icon
                        size={24}
                        strokeWidth={
                          1.9
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.statContent
                      }
                    >
                      <span>
                        {card.label}
                      </span>

                      <strong>
                        {card.value}
                      </strong>

                      <button
                        onClick={
                          card.onClick
                        }
                        type="button"
                      >
                        {
                          card.linkText
                        }

                        <ChevronRight
                          size={15}
                        />
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </section>


          {/* ===================================================
              DASHBOARD GRID
          =================================================== */}

          <section
            className={
              styles.dashboardGrid
            }
          >
            {/* ===============================================
                INTERNSHIP PROGRESS
            =============================================== */}

            <article
              className={`${styles.panel} ${styles.progressPanel}`}
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <h2>
                  Tiến độ thực tập của
                  sinh viên
                </h2>

                <button
                  className={
                    styles.selectButton
                  }
                  type="button"
                >
                  Kỳ thực tập hiện tại

                  <ChevronDown
                    size={15}
                  />
                </button>
              </div>

              <div
                className={
                  styles.progressContent
                }
              >
                <div
                  className={
                    styles.donutWrapper
                  }
                >
                  <div
                    className={
                      styles.donut
                    }
                    style={
                      donutStyle
                    }
                  >
                    <div
                      className={
                        styles.donutCenter
                      }
                    >
                      <strong>
                        {
                          data.progress
                            .total
                        }
                      </strong>

                      <span>
                        Tổng số
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={
                    styles.legend
                  }
                >
                  <div>
                    <span
                      className={`${styles.legendDot} ${styles.grayDot}`}
                    />

                    <p>
                      Chưa bắt đầu
                    </p>

                    <strong>
                      {
                        data.progress
                          .notStarted
                      }{" "}
                      (
                      {progressPercentages.notStarted.toFixed(
                        1,
                      )}
                      %)
                    </strong>
                  </div>

                  <div>
                    <span
                      className={`${styles.legendDot} ${styles.blueDot}`}
                    />

                    <p>
                      Đang thực tập
                    </p>

                    <strong>
                      {
                        data.progress
                          .inProgress
                      }{" "}
                      (
                      {progressPercentages.inProgress.toFixed(
                        1,
                      )}
                      %)
                    </strong>
                  </div>

                  <div>
                    <span
                      className={`${styles.legendDot} ${styles.yellowDot}`}
                    />

                    <p>
                      Tạm dừng
                    </p>

                    <strong>
                      {
                        data.progress
                          .paused
                      }{" "}
                      (
                      {progressPercentages.paused.toFixed(
                        1,
                      )}
                      %)
                    </strong>
                  </div>

                  <div>
                    <span
                      className={`${styles.legendDot} ${styles.greenDot}`}
                    />

                    <p>
                      Hoàn thành
                    </p>

                    <strong>
                      {
                        data.progress
                          .completed
                      }{" "}
                      (
                      {progressPercentages.completed.toFixed(
                        1,
                      )}
                      %)
                    </strong>
                  </div>
                </div>
              </div>
            </article>


            {/* ===============================================
                LATEST REPORTS
            =============================================== */}

            <article
              className={`${styles.panel} ${styles.reportPanel}`}
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <h2>
                  Báo cáo mới nhất
                </h2>

                <button
                  className={
                    styles.textButton
                  }
                  type="button"
                >
                  Xem tất cả
                </button>
              </div>

              {data.latestReports
                .length === 0 ? (
                <EmptyState
                  text="Chưa có báo cáo nào trong cơ sở dữ liệu."
                />
              ) : (
                <div
                  className={
                    styles.reportList
                  }
                >
                  {data.latestReports.map(
                    (report) => (
                      <div
                        className={
                          styles.reportRow
                        }
                        key={
                          report.id
                        }
                      >
                        <div
                          className={
                            styles.studentAvatar
                          }
                        >
                          {getInitials(
                            report.studentName,
                          )}
                        </div>

                        <div
                          className={
                            styles.reportStudent
                          }
                        >
                          <strong>
                            {
                              report.studentName
                            }
                          </strong>

                          <span>
                            {getReportDisplayTitle(
                              report,
                            )}
                          </span>
                        </div>

                        <div
                          className={
                            styles.reportMeta
                          }
                        >
                          <span
                            className={`${styles.statusBadge} ${reportStatusClass(
                              report.status,
                            )}`}
                          >
                            {report.submissionStatus
                              ? `${reportStatusLabel[report.status]} · ${
                                  submissionStatusLabel[report.submissionStatus]
                                }`
                              : reportStatusLabel[report.status]}
                          </span>

                          <small>
                            {report.submittedAt
                              ? formatDate(
                                  report.submittedAt,
                                )
                              : `Hạn: ${formatDate(
                                  report.dueAt,
                                )}`}
                          </small>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </article>


            {/* ===============================================
                CALENDAR
            =============================================== */}

            <aside
              className={`${styles.panel} ${styles.schedulePanel}`}
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <h2>
                  Lịch nhắc nhở
                </h2>
              </div>

              <div
                className={
                  styles.calendarHeader
                }
              >
                <button
                  aria-label="Tháng trước"
                  type="button"
                >
                  <ChevronLeft
                    size={17}
                  />
                </button>

                <strong>
                  {new Intl.DateTimeFormat(
                    "vi-VN",
                    {
                      month:
                        "long",
                      year:
                        "numeric",
                    },
                  ).format(
                    new Date(),
                  )}
                </strong>

                <button
                  aria-label="Tháng sau"
                  type="button"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>
              </div>

              <div
                className={
                  styles.miniCalendar
                }
              >
                {[
                  "T2",
                  "T3",
                  "T4",
                  "T5",
                  "T6",
                  "T7",
                  "CN",
                ].map(
                  (day) => (
                    <strong
                      key={day}
                    >
                      {day}
                    </strong>
                  ),
                )}

                {calendarCells.map(
                  (
                    day,
                    index,
                  ) => {
                    const today =
                      new Date();

                    const isToday =
                      day !== null &&
                      day ===
                        today.getDate();

                    return (
                      <span
                        className={
                          isToday
                            ? styles.today
                            : ""
                        }
                        key={`${day ?? "empty"}-${index}`}
                      >
                        {day ?? ""}
                      </span>
                    );
                  },
                )}
              </div>

              <div
                className={
                  styles.eventHeader
                }
              >
                <h3>
                  Sự kiện sắp tới
                </h3>

                <button
                  className={
                    styles.textButton
                  }
                  type="button"
                >
                  Xem tất cả
                </button>
              </div>

              {data
                .upcomingDeadlines
                .length === 0 ? (
                <p
                  className={
                    styles.noEvents
                  }
                >
                  Chưa có thời hạn sắp
                  tới trong cơ sở dữ
                  liệu.
                </p>
              ) : (
                <div
                  className={
                    styles.eventList
                  }
                >
                  {data.upcomingDeadlines.map(
                    (
                      deadline,
                      index,
                    ) => (
                      <div
                        className={
                          styles.eventItem
                        }
                        key={
                          deadline.id
                        }
                      >
                        <span
                          className={`${styles.eventDot} ${eventColorClass(
                            index,
                          )}`}
                        />

                        <div>
                          <strong>
                            {
                              deadline.title
                            }
                          </strong>

                          <span>
                            {formatDateTime(
                              deadline.dueAt,
                            )}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </aside>


            {/* ===============================================
                STUDENTS
            =============================================== */}

            <article
              className={`${styles.panel} ${styles.studentPanel}`}
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <h2>
                  Danh sách sinh viên
                  đang hướng dẫn
                </h2>

                <button
                  className={
                    styles.textButton
                  }
                  onClick={
                    goToStudents
                  }
                  type="button"
                >
                  Xem tất cả
                </button>
              </div>

              {data.students.length ===
              0 ? (
                <EmptyState
                  text="Giảng viên chưa được phân công sinh viên."
                />
              ) : (
                <div
                  className={
                    styles.tableWrapper
                  }
                >
                  <table
                    className={
                      styles.studentTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          #
                        </th>

                        <th>
                          Sinh viên
                        </th>

                        <th>
                          Mã SV
                        </th>

                        <th>
                          Doanh nghiệp
                        </th>

                        <th>
                          Vị trí
                        </th>

                        <th>
                          Tiến độ
                        </th>

                        <th>
                          Điểm TB
                        </th>

                        <th>
                          Trạng thái
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {data.students.map(
                        (
                          student,
                          index,
                        ) => (
                          <tr
                            key={
                              student.internshipId
                            }
                            onClick={
                              goToStudents
                            }
                            style={{
                              cursor:
                                "pointer",
                            }}
                          >
                            <td>
                              {
                                index +
                                1
                              }
                            </td>

                            <td>
                              <div
                                className={
                                  styles.studentCell
                                }
                              >
                                <div
                                  className={
                                    styles.smallAvatar
                                  }
                                >
                                  {getInitials(
                                    student.studentName,
                                  )}
                                </div>

                                <strong>
                                  {
                                    student.studentName
                                  }
                                </strong>
                              </div>
                            </td>

                            <td>
                              {student.studentCode ??
                                "—"}
                            </td>

                            <td>
                              {student.companyName ??
                                "Chưa cập nhật"}
                            </td>

                            <td>
                              {student.positionTitle ??
                                "Chưa cập nhật"}
                            </td>

                            <td>
                              <div
                                className={
                                  styles.progressCell
                                }
                              >
                                <span>
                                  {student.progressPercentage.toFixed(
                                    0,
                                  )}
                                  % thực tập
                                </span>

                                <div
                                  className={
                                    styles.progressTrack
                                  }
                                >
                                  <div
                                    className={
                                      styles.progressValue
                                    }
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          student.progressPercentage,
                                        ),
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <span>
                                  Báo cáo:{" "}
                                  {student.reportProgressPercentage.toFixed(0)}%
                                  {" "}
                                  ({student.reportsSubmitted}/
                                  {student.reportsRequiredToDate})
                                </span>
                              </div>
                            </td>

                            <td>
                              {student.averageScore >
                              0
                                ? `${student.averageScore.toFixed(1)}/10`
                                : "—"}
                            </td>

                            <td>
                              <span
                                className={`${styles.statusBadge} ${internshipStatusClass(
                                  student.status,
                                )}`}
                              >
                                {
                                  internshipStatusLabel[
                                    student
                                      .status
                                  ]
                                }
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
      </main>
    </LecturerShell>
  );
}
