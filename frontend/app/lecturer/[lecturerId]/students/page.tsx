"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MessageSquareText,
  NotebookPen,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  InternshipStatus,
  LecturerStudentsResponse,
  ReportStatus,
  ReportSubmissionStatus,
  StudentDetailResponse,
  StudentListItem,
  WarningSeverity,
} from "@/types/lecturer-students";

import styles from "./page.module.css";

type DetailTab = "overview" | "reports" | "warnings" | "notes";

interface ErrorPayload {
  message?: string;
}

const internshipStatusLabels: Record<InternshipStatus, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực tập",
  PAUSED: "Tạm dừng",
  COMPLETED: "Hoàn thành",
};

const reportStatusLabels: Record<ReportStatus, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  LATE: "Nộp muộn",
  UNDER_REVIEW: "Chờ chấm",
  REVISION_REQUIRED: "Cần sửa",
  APPROVED: "Đã chấm",
};

const submissionStatusLabels: Record<ReportSubmissionStatus, string> = {
  UPCOMING: "Sắp đến hạn",
  NOT_SUBMITTED: "Chưa nộp",
  ON_TIME: "Nộp đúng hạn",
  LATE: "Nộp muộn",
};

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `API trả về ${response.status} thay vì JSON: ${text.slice(0, 100)}`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorPayload =
      typeof payload === "object" && payload !== null
        ? (payload as ErrorPayload)
        : null;

    throw new Error(
      errorPayload?.message
        ? errorPayload.message
        : "Yêu cầu không thành công.",
    );
  }

  return payload as T;
}

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: InternshipStatus): string {
  switch (status) {
    case "IN_PROGRESS":
      return styles.badgeSuccess;
    case "COMPLETED":
      return styles.badgeInfo;
    case "PAUSED":
      return styles.badgeWarning;
    default:
      return styles.badgeMuted;
  }
}

function reportClass(status: ReportStatus): string {
  switch (status) {
    case "APPROVED":
      return styles.badgeSuccess;
    case "UNDER_REVIEW":
      return styles.badgePending;
    case "LATE":
      return styles.badgeDanger;
    case "REVISION_REQUIRED":
      return styles.badgeWarning;
    case "SUBMITTED":
      return styles.badgeInfo;
    default:
      return styles.badgeMuted;
  }
}

function submissionClass(status: ReportSubmissionStatus): string {
  switch (status) {
    case "ON_TIME":
      return styles.badgeSuccess;
    case "LATE":
    case "NOT_SUBMITTED":
      return styles.badgeDanger;
    case "UPCOMING":
      return styles.badgeInfo;
  }
}

function warningClass(severity: WarningSeverity): string {
  switch (severity) {
    case "CRITICAL":
    case "HIGH":
      return styles.warningHigh;
    case "MEDIUM":
      return styles.warningMedium;
    default:
      return styles.warningLow;
  }
}

function progressClass(progress: number): string {
  if (progress <= 25) return styles.progressLow;
  if (progress <= 50) return styles.progressMedium;
  if (progress <= 75) return styles.progressGood;
  return styles.progressExcellent;
}

function exportCsv(students: StudentListItem[]): void {
  const rows = [
    [
      "Họ tên",
      "Email",
      "Mã sinh viên",
      "Lớp",
      "Ngành",
      "Doanh nghiệp",
      "Vị trí",
      "Tiến độ",
      "Điểm trung bình",
      "Cảnh báo",
      "Trạng thái",
    ],
    ...students.map((student) => [
      student.fullName,
      student.email,
      student.studentCode,
      student.className ?? "",
      student.major ?? "",
      student.companyName,
      student.positionTitle,
      `${student.progressPercentage}%`,
      student.averageScore
        ? student.averageScore.toFixed(1)
        : "",
      String(student.warningCount),
      internshipStatusLabels[student.status],
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "danh-sach-sinh-vien.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function LecturerStudentsPage() {
  const params = useParams<{ lecturerId: string }>();
  const lecturerId = params.lecturerId;

  const [data, setData] =
    useState<LecturerStudentsResponse | null>(null);
  const [detail, setDetail] =
    useState<StudentDetailResponse | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [hasWarning, setHasWarning] = useState("");
  const [page, setPage] = useState(1);

  const [selectedStudentId, setSelectedStudentId] =
    useState<string | null>(null);
  const [activeTab, setActiveTab] =
    useState<DetailTab>("overview");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [sendingReminder, setSendingReminder] =
    useState(false);

  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [success, setSuccess] = useState("");

  const [noteContent, setNoteContent] = useState("");
  const [reminderContent, setReminderContent] = useState(
    "Em vui lòng kiểm tra và cập nhật tiến độ thực tập, báo cáo còn thiếu trên hệ thống.",
  );

  const loadStudents = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (search) queryParams.set("search", search);
      if (status) queryParams.set("status", status);
      if (companyId) queryParams.set("companyId", companyId);
      if (reportStatus) {
        queryParams.set("reportStatus", reportStatus);
      }
      if (hasWarning) {
        queryParams.set("hasWarning", hasWarning);
      }

      const response = await fetch(
        `/api/lecturers/${encodeURIComponent(
          lecturerId,
        )}/students?${queryParams.toString()}`,
        { cache: "no-store", signal },
      );

      setData(await readJson<LecturerStudentsResponse>(response));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách sinh viên.",
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [
    companyId,
    hasWarning,
    lecturerId,
    page,
    reportStatus,
    search,
    status,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadStudents(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadStudents]);

  const openDetail = useCallback(
    async (studentId: string) => {
      setSelectedStudentId(studentId);
      setDetail(null);
      setDetailError("");
      setSuccess("");
      setActiveTab("overview");
      setDetailLoading(true);

      try {
        const response = await fetch(
          `/api/lecturers/${encodeURIComponent(
            lecturerId,
          )}/students/${encodeURIComponent(studentId)}`,
          { cache: "no-store" },
        );

        setDetail(await readJson<StudentDetailResponse>(response));
      } catch (loadError) {
        setDetailError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải chi tiết sinh viên.",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [lecturerId],
  );

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStudentId || !noteContent.trim()) return;

    setSavingNote(true);
    setDetailError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/lecturers/${lecturerId}/students/${selectedStudentId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: noteContent }),
        },
      );

      await readJson(response);
      setNoteContent("");
      await openDetail(selectedStudentId);
      setActiveTab("notes");
      setSuccess("Đã lưu ghi chú vào PostgreSQL.");
    } catch (saveError) {
      setDetailError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu ghi chú.",
      );
    } finally {
      setSavingNote(false);
    }
  }

  async function sendReminder() {
    if (!selectedStudentId || !reminderContent.trim()) return;

    setSendingReminder(true);
    setDetailError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/lecturers/${lecturerId}/students/${selectedStudentId}/reminders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: reminderContent,
          }),
        },
      );

      await readJson(response);
      setSuccess(
        "Đã lưu thông báo nhắc nhở vào PostgreSQL.",
      );
    } catch (sendError) {
      setDetailError(
        sendError instanceof Error
          ? sendError.message
          : "Không thể gửi nhắc nhở.",
      );
    } finally {
      setSendingReminder(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setCompanyId("");
    setReportStatus("");
    setHasWarning("");
    setPage(1);
  }

  const cards = useMemo(
    () => [
      {
        label: "Tổng sinh viên",
        value: data?.summary.totalStudents ?? 0,
        icon: UsersRound,
        tone: styles.cardBlue,
      },
      {
        label: "Đang thực tập",
        value: data?.summary.inProgress ?? 0,
        icon: BriefcaseBusiness,
        tone: styles.cardGreen,
      },
      {
        label: "Chưa bắt đầu",
        value: data?.summary.notStarted ?? 0,
        icon: Clock3,
        tone: styles.cardGray,
      },
      {
        label: "Hoàn thành",
        value: data?.summary.completed ?? 0,
        icon: CheckCircle2,
        tone: styles.cardPurple,
      },
      {
        label: "Cần chú ý",
        value: data?.summary.needAttention ?? 0,
        icon: AlertTriangle,
        tone: styles.cardOrange,
      },
    ],
    [data],
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <GraduationCap size={28} />
          </div>
          <div>
            <strong>AI Internship</strong>
            <span>Hỗ trợ thực tập sinh viên</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <Link
            className={styles.sidebarLink}
            href={`/lecturer/${lecturerId}/dashboard`}
          >
            <LayoutDashboard size={20} />
            Tổng quan
          </Link>

          <p className={styles.sidebarSection}>QUẢN LÝ</p>

          <Link
            className={`${styles.sidebarLink} ${styles.activeLink}`}
            href={`/lecturer/${lecturerId}/students`}
          >
            <UsersRound size={20} />
            Sinh viên của tôi
          </Link>

          <button className={styles.sidebarButton} type="button">
            <CalendarDays size={20} />
            Đợt thực tập
          </button>
          <button className={styles.sidebarButton} type="button">
            <ClipboardCheck size={20} />
            Hồ sơ đăng ký
          </button>
          <button className={styles.sidebarButton} type="button">
            <FileText size={20} />
            Nhật ký & Báo cáo
          </button>
          <button className={styles.sidebarButton} type="button">
            <Star size={20} />
            Đánh giá
          </button>
          <button className={styles.sidebarButton} type="button">
            <Bell size={20} />
            Nhắc nhở & Cảnh báo
          </button>
          <button className={styles.sidebarButton} type="button">
            <MessageSquareText size={20} />
            Trao đổi & Góp ý
          </button>

          <p className={styles.sidebarSection}>AI HỖ TRỢ</p>

          <button className={styles.sidebarButton} type="button">
            <Bot size={20} />
            Trợ lý AI
          </button>
          <button className={styles.sidebarButton} type="button">
            <BarChart3 size={20} />
            Phân tích AI
          </button>

          <p className={styles.sidebarSection}>CÀI ĐẶT</p>

          <button className={styles.sidebarButton} type="button">
            <Settings size={20} />
            Cài đặt cá nhân
          </button>
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <Menu size={22} />
            <strong>Sinh viên của tôi</strong>
          </div>

          <div className={styles.account}>
            <Search size={19} />
            <Bell size={19} />
            <div className={styles.accountAvatar}>
              {getInitials(data?.lecturer.fullName ?? "GV")}
            </div>
            <div>
              <strong>
                {data?.lecturer.academicTitle
                  ? `${data.lecturer.academicTitle}. `
                  : ""}
                {data?.lecturer.fullName ?? "Giảng viên"}
              </strong>
              <span>Giảng viên</span>
            </div>
            <ChevronDown size={16} />
          </div>
        </header>

        <main className={styles.content}>
          <section className={styles.pageHeading}>
            <div>
              <h1>Quản lý sinh viên</h1>
              <p>
                Theo dõi tiến độ, báo cáo, đánh giá và cảnh báo của
                sinh viên đang được bạn hướng dẫn.
              </p>
            </div>

            <div className={styles.headingActions}>
              <button
                className={styles.secondaryButton}
                disabled={!data?.students.length}
                onClick={() => exportCsv(data?.students ?? [])}
                type="button"
              >
                <Download size={17} />
                Xuất CSV
              </button>
              <button
                className={styles.primaryButton}
                onClick={() => void loadStudents()}
                type="button"
              >
                <RefreshCw size={17} />
                Làm mới
              </button>
            </div>
          </section>

          <section className={styles.summaryGrid}>
            {cards.map((card) => {
              const Icon = card.icon;

              return (
                <article className={styles.summaryCard} key={card.label}>
                  <div className={`${styles.summaryIcon} ${card.tone}`}>
                    <Icon size={23} />
                  </div>
                  <div>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </div>
                </article>
              );
            })}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Danh sách sinh viên</h2>
                <p>Dữ liệu được truy vấn trực tiếp từ PostgreSQL.</p>
              </div>
              <span>{data?.pagination.total ?? 0} sinh viên</span>
            </div>

            <form className={styles.filters} onSubmit={submitSearch}>
              <label className={styles.searchBox}>
                <Search size={17} />
                <input
                  onChange={(event) =>
                    setSearchInput(event.target.value)
                  }
                  placeholder="Tìm tên, mã SV, doanh nghiệp..."
                  value={searchInput}
                />
              </label>

              <select
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                value={status}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="NOT_STARTED">Chưa bắt đầu</option>
                <option value="IN_PROGRESS">Đang thực tập</option>
                <option value="PAUSED">Tạm dừng</option>
                <option value="COMPLETED">Hoàn thành</option>
              </select>

              <select
                onChange={(event) => {
                  setCompanyId(event.target.value);
                  setPage(1);
                }}
                value={companyId}
              >
                <option value="">Tất cả doanh nghiệp</option>
                {data?.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              <select
                onChange={(event) => {
                  setReportStatus(event.target.value);
                  setPage(1);
                }}
                value={reportStatus}
              >
                <option value="">Tất cả báo cáo</option>
                <option value="UNDER_REVIEW">Chờ chấm</option>
                <option value="APPROVED">Đã chấm</option>
                <option value="LATE">Nộp muộn</option>
                <option value="REVISION_REQUIRED">Cần sửa</option>
              </select>

              <select
                onChange={(event) => {
                  setHasWarning(event.target.value);
                  setPage(1);
                }}
                value={hasWarning}
              >
                <option value="">Tất cả cảnh báo</option>
                <option value="true">Có cảnh báo</option>
                <option value="false">Không cảnh báo</option>
              </select>

              <button className={styles.filterButton} type="submit">
                <Filter size={16} />
                Lọc
              </button>

              <button
                className={styles.clearButton}
                onClick={clearFilters}
                type="button"
              >
                Xóa lọc
              </button>
            </form>

            {error ? (
              <div className={styles.errorState}>
                <AlertTriangle size={28} />
                <div>
                  <strong>Không thể tải dữ liệu</strong>
                  <p>{error}</p>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className={styles.loadingState}>
                <LoaderCircle className={styles.spinner} size={32} />
                Đang truy vấn PostgreSQL...
              </div>
            ) : null}

            {!loading && !error && data?.students.length === 0 ? (
              <div className={styles.emptyState}>
                <UsersRound size={38} />
                <h3>Không tìm thấy sinh viên</h3>
                <p>Hãy kiểm tra bộ lọc hoặc dữ liệu trong database.</p>
              </div>
            ) : null}

            {!loading && !error && data?.students.length ? (
              <>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Sinh viên</th>
                        <th>Mã SV</th>
                        <th>Lớp / Ngành</th>
                        <th>Doanh nghiệp</th>
                        <th>Tiến độ</th>
                        <th>Báo cáo gần nhất</th>
                        <th>Điểm TB</th>
                        <th>Cảnh báo</th>
                        <th>Trạng thái</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.students.map((student) => (
                        <tr
                          key={student.studentId}
                          onClick={() =>
                            void openDetail(student.studentId)
                          }
                        >
                          <td>
                            <div className={styles.studentIdentity}>
                              <div className={styles.studentAvatar}>
                                {getInitials(student.fullName)}
                              </div>
                              <div>
                                <strong>{student.fullName}</strong>
                                <span>{student.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>{student.studentCode}</td>
                          <td>
                            <div className={styles.multiline}>
                              <strong>
                                {student.className ?? "Chưa cập nhật"}
                              </strong>
                              <span>
                                {student.major ?? "Chưa cập nhật"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.multiline}>
                              <strong>{student.companyName}</strong>
                              <span>{student.positionTitle}</span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.progressCell}>
                              <strong>
                                {student.progressPercentage}%
                              </strong>
                              <div className={styles.progressTrack}>
                                <span
                                  className={`${styles.progressFill} ${progressClass(
                                    student.progressPercentage,
                                  )}`}
                                  style={{
                                    width: `${student.progressPercentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            {student.latestReport ? (
                              <div className={styles.multiline}>
                                <strong>
                                  Tuần {student.latestReport.weekNumber}
                                </strong>
                                <span
                                  className={`${styles.badge} ${reportClass(
                                    student.latestReport.status,
                                  )}`}
                                >
                                  {
                                    reportStatusLabels[
                                      student.latestReport.status
                                    ]
                                  }
                                </span>
                              </div>
                            ) : (
                              "Chưa có"
                            )}
                          </td>
                          <td>
                            <strong className={styles.score}>
                              {student.averageScore
                                ? student.averageScore.toFixed(1)
                                : "—"}
                            </strong>
                          </td>
                          <td>
                            <span
                              className={`${styles.warningCount} ${
                                student.warningCount
                                  ? styles.hasWarning
                                  : ""
                              }`}
                            >
                              {student.warningCount}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${styles.badge} ${statusClass(
                                student.status,
                              )}`}
                            >
                              {internshipStatusLabels[student.status]}
                            </span>
                          </td>
                          <td>
                            <button
                              className={styles.viewButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                void openDetail(student.studentId);
                              }}
                              type="button"
                            >
                              <Eye size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <span>
                    Trang {data.pagination.page}/
                    {data.pagination.totalPages}
                  </span>

                  <div>
                    <button
                      disabled={page <= 1}
                      onClick={() =>
                        setPage((current) =>
                          Math.max(1, current - 1),
                        )
                      }
                      type="button"
                    >
                      <ArrowLeft size={16} />
                      Trước
                    </button>
                    <button
                      disabled={
                        page >= data.pagination.totalPages
                      }
                      onClick={() =>
                        setPage((current) => current + 1)
                      }
                      type="button"
                    >
                      Sau
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </main>
      </div>

      {selectedStudentId ? (
        <>
          <button
            aria-label="Đóng"
            className={styles.overlay}
            onClick={() => {
              setSelectedStudentId(null);
              setDetail(null);
            }}
            type="button"
          />

          <aside className={styles.drawer}>
            <header className={styles.drawerHeader}>
              <div>
                <span>HỒ SƠ SINH VIÊN</span>
                <h2>
                  {detail?.student.fullName ?? "Đang tải..."}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedStudentId(null);
                  setDetail(null);
                }}
                type="button"
              >
                <X size={20} />
              </button>
            </header>

            {detailLoading ? (
              <div className={styles.drawerState}>
                <LoaderCircle className={styles.spinner} size={32} />
                Đang truy xuất chi tiết từ PostgreSQL...
              </div>
            ) : null}

            {detailError ? (
              <div className={styles.drawerError}>
                <AlertTriangle size={22} />
                {detailError}
              </div>
            ) : null}

            {success ? (
              <div className={styles.successMessage}>
                <CheckCircle2 size={18} />
                {success}
              </div>
            ) : null}

            {detail && !detailLoading ? (
              <>
                <section className={styles.studentHero}>
                  <div className={styles.largeAvatar}>
                    {getInitials(detail.student.fullName)}
                  </div>
                  <div>
                    <h3>{detail.student.fullName}</h3>
                    <p>
                      {detail.student.studentCode} ·{" "}
                      {detail.student.className ?? "Chưa có lớp"}
                    </p>
                    <span
                      className={`${styles.badge} ${statusClass(
                        detail.internship.status,
                      )}`}
                    >
                      {internshipStatusLabels[detail.internship.status]}
                    </span>
                  </div>
                </section>

                <nav className={styles.tabs}>
                  {[
                    ["overview", "Tổng quan"],
                    ["reports", `Báo cáo (${detail.reports.length})`],
                    [
                      "warnings",
                      `Cảnh báo (${detail.warnings.length})`,
                    ],
                    ["notes", `Ghi chú (${detail.notes.length})`],
                  ].map(([tab, label]) => (
                    <button
                      className={
                        activeTab === tab ? styles.activeTab : ""
                      }
                      key={tab}
                      onClick={() =>
                        setActiveTab(tab as DetailTab)
                      }
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                <div className={styles.drawerBody}>
                  {activeTab === "overview" ? (
                    <div className={styles.detailList}>
                      <section className={styles.detailCard}>
                        <h4>
                          <UserRound size={17} />
                          Thông tin sinh viên
                        </h4>
                        <div className={styles.detailGrid}>
                          <div>
                            <span>Email</span>
                            <strong>{detail.student.email}</strong>
                          </div>
                          <div>
                            <span>Điện thoại</span>
                            <strong>
                              {detail.student.phone ??
                                "Chưa cập nhật"}
                            </strong>
                          </div>
                          <div>
                            <span>Ngành</span>
                            <strong>
                              {detail.student.major ??
                                "Chưa cập nhật"}
                            </strong>
                          </div>
                          <div>
                            <span>GPA</span>
                            <strong>
                              {detail.student.gpa?.toFixed(2) ?? "—"}
                            </strong>
                          </div>
                        </div>
                      </section>

                      <section className={styles.detailCard}>
                        <h4>
                          <BriefcaseBusiness size={17} />
                          Thông tin thực tập
                        </h4>
                        <div className={styles.detailGrid}>
                          <div>
                            <span>Doanh nghiệp</span>
                            <strong>
                              {detail.internship.companyName}
                            </strong>
                          </div>
                          <div>
                            <span>Vị trí</span>
                            <strong>
                              {detail.internship.positionTitle}
                            </strong>
                          </div>
                          <div>
                            <span>Mentor</span>
                            <strong>
                              {detail.internship.mentorName ??
                                "Chưa cập nhật"}
                            </strong>
                          </div>
                          <div>
                            <span>Hình thức</span>
                            <strong>
                              {detail.internship.workMode ??
                                "Chưa cập nhật"}
                            </strong>
                          </div>
                          <div>
                            <span>Bắt đầu</span>
                            <strong>
                              {formatDate(
                                detail.internship.startDate,
                              )}
                            </strong>
                          </div>
                          <div>
                            <span>Kết thúc</span>
                            <strong>
                              {formatDate(
                                detail.internship.endDate,
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className={styles.detailProgress}>
                          <strong>
                            Tiến độ:{" "}
                            {detail.internship.progressPercentage}%
                          </strong>
                          <div className={styles.progressTrack}>
                            <span
                              className={`${styles.progressFill} ${progressClass(
                                detail.internship.progressPercentage,
                              )}`}
                              style={{
                                width: `${detail.internship.progressPercentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      </section>

                      <section className={styles.detailCard}>
                        <h4>
                          <Bot size={17} />
                          Phân tích AI
                        </h4>
                        <strong className={styles.aiScore}>
                          {detail.internship.aiFitScore !== null
                            ? `${detail.internship.aiFitScore.toFixed(
                                1,
                              )}%`
                            : "Chưa đánh giá"}
                        </strong>
                        <p className={styles.description}>
                          {detail.internship.aiFitSummary ??
                            "Chưa có nhận xét AI."}
                        </p>
                      </section>

                      <section className={styles.detailCard}>
                        <h4>
                          <Star size={17} />
                          Đánh giá gần nhất
                        </h4>
                        {detail.evaluation ? (
                          <>
                            <div className={styles.scoreGrid}>
                              <div>
                                <span>Thái độ</span>
                                <strong>
                                  {detail.evaluation.attitudeScore ??
                                    "—"}
                                </strong>
                              </div>
                              <div>
                                <span>Chuyên môn</span>
                                <strong>
                                  {detail.evaluation
                                    .professionalKnowledgeScore ??
                                    "—"}
                                </strong>
                              </div>
                              <div>
                                <span>Kỹ năng</span>
                                <strong>
                                  {detail.evaluation
                                    .workingSkillScore ?? "—"}
                                </strong>
                              </div>
                              <div>
                                <span>Tổng</span>
                                <strong>
                                  {detail.evaluation.totalScore !==
                                  null
                                    ? (
                                        detail.evaluation.totalScore /
                                        10
                                      ).toFixed(1)
                                    : "—"}
                                </strong>
                              </div>
                            </div>
                            <p className={styles.description}>
                              {detail.evaluation.overallComment ??
                                "Chưa có nhận xét."}
                            </p>
                          </>
                        ) : (
                          <p>Chưa có đánh giá.</p>
                        )}
                      </section>

                      <section className={styles.detailCard}>
                        <h4>
                          <Send size={17} />
                          Gửi nhắc nhở
                        </h4>
                        <textarea
                          maxLength={2000}
                          onChange={(event) =>
                            setReminderContent(event.target.value)
                          }
                          rows={3}
                          value={reminderContent}
                        />
                        <button
                          className={styles.primaryButton}
                          disabled={
                            sendingReminder ||
                            !reminderContent.trim()
                          }
                          onClick={() => void sendReminder()}
                          type="button"
                        >
                          {sendingReminder ? (
                            <LoaderCircle
                              className={styles.spinner}
                              size={16}
                            />
                          ) : (
                            <Send size={16} />
                          )}
                          Gửi thông báo
                        </button>
                      </section>
                    </div>
                  ) : null}

                  {activeTab === "reports" ? (
                    <div className={styles.detailList}>
                      {detail.reports.length ? (
                        detail.reports.map((report) => (
                          <article
                            className={styles.reportCard}
                            key={report.scheduleId}
                          >
                            <div className={styles.cardHeader}>
                              <div>
                                <strong>
                                  {report.title ??
                                    `Báo cáo tuần ${report.weekNumber}`}
                                </strong>
                                <span>
                                  {report.submittedAt
                                    ? `Nộp: ${formatDate(report.submittedAt)}`
                                    : `Hạn: ${formatDate(report.dueAt)}`}
                                </span>
                              </div>
                              <span
                                className={`${styles.badge} ${
                                  report.reviewStatus
                                    ? reportClass(report.reviewStatus)
                                    : submissionClass(report.submissionStatus)
                                }`}
                              >
                                {report.reviewStatus
                                  ? reportStatusLabels[report.reviewStatus]
                                  : submissionStatusLabels[
                                      report.submissionStatus
                                    ]}
                              </span>
                            </div>
                            <p>{report.workCompleted}</p>
                            <div className={styles.reportMeta}>
                              <span>
                                Điểm:{" "}
                                {report.lecturerScore !== null
                                  ? (
                                      report.lecturerScore / 10
                                    ).toFixed(1)
                                  : "Chưa chấm"}
                              </span>
                              <span>
                                AI đầy đủ:{" "}
                                {report.aiCompletenessScore ?? "—"}%
                              </span>
                            </div>
                            {report.lecturerComment ? (
                              <div className={styles.commentBox}>
                                {report.lecturerComment}
                              </div>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <div className={styles.emptyInline}>
                          Chưa có báo cáo.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {activeTab === "warnings" ? (
                    <div className={styles.detailList}>
                      {detail.warnings.length ? (
                        detail.warnings.map((warning) => (
                          <article
                            className={`${styles.warningCard} ${warningClass(
                              warning.severity,
                            )}`}
                            key={warning.id}
                          >
                            <AlertTriangle size={20} />
                            <div>
                              <div className={styles.cardHeader}>
                                <strong>{warning.title}</strong>
                                <span>{warning.severity}</span>
                              </div>
                              <p>{warning.description}</p>
                              <small>
                                {warning.detectedBy} ·{" "}
                                {formatDateTime(warning.createdAt)}
                              </small>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className={styles.emptyInline}>
                          Không có cảnh báo.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {activeTab === "notes" ? (
                    <>
                      <form
                        className={styles.noteForm}
                        onSubmit={saveNote}
                      >
                        <label>Thêm ghi chú nội bộ</label>
                        <textarea
                          maxLength={4000}
                          onChange={(event) =>
                            setNoteContent(event.target.value)
                          }
                          placeholder="Nhập nội dung cần lưu..."
                          rows={4}
                          value={noteContent}
                        />
                        <button
                          className={styles.primaryButton}
                          disabled={
                            savingNote || !noteContent.trim()
                          }
                          type="submit"
                        >
                          {savingNote ? (
                            <LoaderCircle
                              className={styles.spinner}
                              size={16}
                            />
                          ) : (
                            <NotebookPen size={16} />
                          )}
                          Lưu vào PostgreSQL
                        </button>
                      </form>

                      <div className={styles.detailList}>
                        {detail.notes.length ? (
                          detail.notes.map((note) => (
                            <article
                              className={styles.noteCard}
                              key={note.id}
                            >
                              <p>{note.content}</p>
                              <span>
                                {formatDateTime(note.createdAt)}
                              </span>
                            </article>
                          ))
                        ) : (
                          <div className={styles.emptyInline}>
                            Chưa có ghi chú.
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}
