"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  Star,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import LecturerLanguageSwitcher from "@/components/lecturer/LecturerLanguageSwitcher";
import { API_BASE_URL, lecturerFetch } from "@/lib/lecturerAuth";
import {
  fetchLecturerUnreadCount,
  subscribeLecturerUnreadCount,
} from "@/lib/lecturerNotifications";
import {
  type CSSProperties,
  type ComponentType,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  InternshipStatus,
  LecturerDashboardData,
  ReportStatus,
} from "@/types/lecturer-dashboard";

import styles from "../../dashboard/page.module.css";

interface NavItem {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  active?: boolean;
  expandable?: boolean;
}

const managementItems: NavItem[] = [
  { label: "Sinh viên của tôi", icon: UsersRound },
  { label: "Đợt thực tập", icon: CalendarDays },
  { label: "Hồ sơ đăng ký", icon: ClipboardCheck },
  { label: "Nhật ký & Báo cáo", icon: FileText, expandable: true },
  { label: "Đánh giá", icon: Star, expandable: true },
  { label: "Nhắc nhở & Cảnh báo", icon: Bell },
];

const aiItems: NavItem[] = [
  { label: "Trợ lý AI", icon: Bot },
  { label: "Phân tích AI", icon: BarChart3 },
];

const reportItems: NavItem[] = [
  { label: "Thống kê", icon: BarChart3 },
  { label: "Báo cáo", icon: FileCheck2 },
];

const reportStatusLabel: Record<ReportStatus, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  LATE: "Nộp muộn",
  UNDER_REVIEW: "Chờ chấm",
  REVISION_REQUIRED: "Cần sửa",
  APPROVED: "Đã chấm",
};

const internshipStatusLabel: Record<InternshipStatus, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực tập",
  PAUSED: "Tạm dừng",
  COMPLETED: "Hoàn thành",
};

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

function internshipStatusClass(status: InternshipStatus): string {
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

function SidebarGroup({
  title,
  items,
  onItemClick,
}: {
  title: string;
  items: NavItem[];
  onItemClick?: (item: NavItem) => void;
}) {
  return (
    <section className={styles.sidebarGroup}>
      <p className={styles.sidebarLabel}>{title}</p>

      <div className={styles.sidebarList}>
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <button
              className={styles.sidebarItem}
              key={item.label}
              onClick={() => onItemClick?.(item)}
              type="button"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{item.label}</span>

              {item.expandable ? (
                <ChevronDown className={styles.itemChevron} size={16} />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={styles.emptyState}>
      <FileText size={28} strokeWidth={1.5} />
      <p>{text}</p>
    </div>
  );
}

export default function LecturerDashboardPage() {
  const params = useParams<{ lecturerId: string }>();
  const lecturerId = params.lecturerId;
  const router = useRouter();

  const [data, setData] = useState<LecturerDashboardData | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const response = await lecturerFetch(
          `${API_BASE_URL}/api/v1/lecturers/dashboard`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        const rawBody = await response.text();

        if (!response.ok) {
          throw new Error(
            rawBody
              ? `Backend ${response.status}: ${rawBody}`
              : `Backend trả về lỗi ${response.status}.`,
          );
        }

        let payload: LecturerDashboardData;

        try {
          payload = JSON.parse(rawBody) as LecturerDashboardData;
        } catch {
          throw new Error("Backend không trả về JSON hợp lệ.");
        }

        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Đã xảy ra lỗi không xác định.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [lecturerId]);

  useEffect(() => {
    let active = true;
    void fetchLecturerUnreadCount()
      .then((count) => {
        if (active) setUnreadNotificationCount(count);
      })
      .catch(() => undefined);
    const unsubscribe = subscribeLecturerUnreadCount(
      setUnreadNotificationCount,
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const calendarCells = useMemo<Array<number | null>>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const mondayBasedOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<number | null> = [
      ...Array.from({ length: mondayBasedOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, []);

  const progressPercentages = useMemo(() => {
    const total = data?.progress.total ?? 0;

    if (total === 0) {
      return {
        notStarted: 0,
        inProgress: 0,
        paused: 0,
        completed: 0,
      };
    }

    return {
      notStarted: ((data?.progress.notStarted ?? 0) / total) * 100,
      inProgress: ((data?.progress.inProgress ?? 0) / total) * 100,
      paused: ((data?.progress.paused ?? 0) / total) * 100,
      completed: ((data?.progress.completed ?? 0) / total) * 100,
    };
  }, [data]);

  const donutStyle = useMemo<CSSProperties>(() => {
    const p1 = progressPercentages.notStarted;
    const p2 = p1 + progressPercentages.inProgress;
    const p3 = p2 + progressPercentages.paused;

    if (!data?.progress.total) {
      return {
        background: "conic-gradient(#e5e9f2 0deg 360deg)",
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
  }, [data, progressPercentages]);

  if (isLoading) {
    return (
      <main className={styles.centerState}>
        <LoaderCircle className={styles.spinner} size={38} />
        <p>Đang tải dữ liệu thật từ PostgreSQL...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={styles.centerState}>
        <AlertTriangle size={42} />
        <h1>Không thể hiển thị dashboard</h1>
        <p>{error || "Không nhận được dữ liệu."}</p>
        <p className={styles.errorHint}>
          Kiểm tra DATABASE_URL và UUID giảng viên trên đường dẫn.
        </p>
      </main>
    );
  }

  function goToStudents(): void {
    setSidebarOpen(false);
    router.push(`/lecturer/${lecturerId}/students`);
  }

  function handleSidebarItemClick(item: NavItem): void {
    switch (item.label) {
      case "Sinh viên của tôi":
        goToStudents();
        break;

      default:
        break;
    }
  }

  const statCards = [
    {
      label: "Sinh viên đang hướng dẫn",
      value: data.stats.totalStudents,
      icon: UsersRound,
      tone: styles.blueTone,
      linkText: "Xem danh sách",
      onClick: goToStudents,
    },
    {
      label: "Hồ sơ chờ duyệt",
      value: data.stats.pendingApplications,
      icon: ClipboardCheck,
      tone: styles.greenTone,
      linkText: "Xem và xử lý",
      onClick: undefined,
    },
    {
      label: "Báo cáo chờ chấm",
      value: data.stats.pendingReports,
      icon: FileText,
      tone: styles.purpleTone,
      linkText: "Xem chi tiết",
      onClick: undefined,
    },
    {
      label: "Cảnh báo",
      value: data.stats.openWarnings,
      icon: AlertTriangle,
      tone: styles.orangeTone,
      linkText: "Xem cảnh báo",
      onClick: undefined,
    },
    {
      label: "Điểm TB sinh viên",
      value: data.stats.averageScore.toFixed(2),
      icon: Star,
      tone: styles.cyanTone,
      linkText: "Thang điểm 10",
      onClick: undefined,
    },
  ];

  return (
    <div className={styles.dashboardShell}>
      <aside
        className={`${styles.sidebar} ${
          sidebarOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Image
              alt="AI Internova logo"
              height={44}
              priority
              src="/intern.png"
              width={44}
            />
          </div>
          <div className="notranslate" translate="no">
            <strong>AI Internova</strong>
            <span>Hỗ trợ thực tập sinh viên</span>
          </div>
        </div>

        <button
          className={styles.activeNavItem}
          onClick={() => {
            setSidebarOpen(false);
            router.push(`/lecturer/${lecturerId}/dashboard`);
          }}
          type="button"
        >
          <LayoutDashboard size={20} />
          <span>Tổng quan</span>
        </button>

        <SidebarGroup
          title="QUẢN LÝ"
          items={managementItems}
          onItemClick={handleSidebarItemClick}
        />
        <SidebarGroup title="AI HỖ TRỢ" items={aiItems} />
        <SidebarGroup title="THỐNG KÊ & BÁO CÁO" items={reportItems} />

        <section className={styles.sidebarGroup}>
          <p className={styles.sidebarLabel}>CÀI ĐẶT</p>
          <div className={styles.sidebarList}>
            <button
              className={styles.sidebarItem}
              onClick={() => router.push("/lecturer/notifications")}
              type="button"
            >
              <Bell size={19} />
              <span>Thông báo</span>
            </button>
            <button className={styles.sidebarItem} type="button">
              <Settings size={19} />
              <span>Cài đặt cá nhân</span>
            </button>
          </div>
        </section>

        <button className={styles.collapseButton} type="button">
          <PanelLeftClose size={18} />
          <span>Thu gọn</span>
        </button>
      </aside>

      {sidebarOpen ? (
        <button
          aria-label="Đóng menu"
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <button
              aria-label="Mở menu"
              className={styles.mobileMenuButton}
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Menu size={22} />
            </button>
            <Menu className={styles.desktopMenuIcon} size={22} />
            <strong>Tổng quan</strong>
          </div>

          <div className={styles.topbarActions}>
            <LecturerLanguageSwitcher />

            <button aria-label="Tìm kiếm" className={styles.iconButton} type="button">
              <Search size={20} />
            </button>
            <button
              aria-label="Thông báo"
              className={styles.notificationButton}
              onClick={() => router.push("/lecturer/notifications")}
              type="button"
            >
              <Bell size={20} />
              {unreadNotificationCount > 0 ? (
                <span>{Math.min(unreadNotificationCount, 99)}</span>
              ) : null}
            </button>

            <div className={styles.account}>
              <div className={styles.avatar}>
                {getInitials(data.lecturer.fullName)}
              </div>
              <div className={styles.accountText}>
                <strong>
                  {data.lecturer.academicTitle
                    ? `${data.lecturer.academicTitle}. `
                    : ""}
                  {data.lecturer.fullName}
                </strong>
                <span>Giảng viên</span>
              </div>
              <ChevronDown size={17} />
            </div>
          </div>
        </header>

        <main className={styles.content}>
          <section className={styles.welcomeSection}>
            <h1>Xin chào, {data.lecturer.fullName} 👋</h1>
            <p>Đây là tổng quan hoạt động hướng dẫn thực tập của bạn.</p>
          </section>

          <section className={styles.statsGrid}>
            {statCards.map((card) => {
              const Icon = card.icon;

              return (
                <article className={styles.statCard} key={card.label}>
                  <div className={`${styles.statIcon} ${card.tone}`}>
                    <Icon size={24} strokeWidth={1.9} />
                  </div>
                  <div className={styles.statContent}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <button
                      onClick={card.onClick}
                      type="button"
                    >
                      {card.linkText}
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          <section className={styles.dashboardGrid}>
            <article className={`${styles.panel} ${styles.progressPanel}`}>
              <div className={styles.panelHeader}>
                <h2>Tiến độ thực tập của sinh viên</h2>
                <button className={styles.selectButton} type="button">
                  Kỳ thực tập hiện tại
                  <ChevronDown size={15} />
                </button>
              </div>

              <div className={styles.progressContent}>
                <div className={styles.donutWrapper}>
                  <div className={styles.donut} style={donutStyle}>
                    <div className={styles.donutCenter}>
                      <strong>{data.progress.total}</strong>
                      <span>Tổng số</span>
                    </div>
                  </div>
                </div>

                <div className={styles.legend}>
                  <div>
                    <span className={`${styles.legendDot} ${styles.grayDot}`} />
                    <p>Chưa bắt đầu</p>
                    <strong>
                      {data.progress.notStarted} (
                      {progressPercentages.notStarted.toFixed(1)}%)
                    </strong>
                  </div>
                  <div>
                    <span className={`${styles.legendDot} ${styles.blueDot}`} />
                    <p>Đang thực tập</p>
                    <strong>
                      {data.progress.inProgress} (
                      {progressPercentages.inProgress.toFixed(1)}%)
                    </strong>
                  </div>
                  <div>
                    <span className={`${styles.legendDot} ${styles.yellowDot}`} />
                    <p>Tạm dừng</p>
                    <strong>
                      {data.progress.paused} (
                      {progressPercentages.paused.toFixed(1)}%)
                    </strong>
                  </div>
                  <div>
                    <span className={`${styles.legendDot} ${styles.greenDot}`} />
                    <p>Hoàn thành</p>
                    <strong>
                      {data.progress.completed} (
                      {progressPercentages.completed.toFixed(1)}%)
                    </strong>
                  </div>
                </div>
              </div>
            </article>

            <article className={`${styles.panel} ${styles.reportPanel}`}>
              <div className={styles.panelHeader}>
                <h2>Báo cáo mới nhất</h2>
                <button className={styles.textButton} type="button">
                  Xem tất cả
                </button>
              </div>

              {data.latestReports.length === 0 ? (
                <EmptyState text="Chưa có báo cáo nào trong cơ sở dữ liệu." />
              ) : (
                <div className={styles.reportList}>
                  {data.latestReports.map((report) => (
                    <div className={styles.reportRow} key={report.id}>
                      <div className={styles.studentAvatar}>
                        {getInitials(report.studentName)}
                      </div>
                      <div className={styles.reportStudent}>
                        <strong>{report.studentName}</strong>
                        <span>Báo cáo tuần {report.weekNumber}</span>
                      </div>
                      <div className={styles.reportMeta}>
                        <span
                          className={`${styles.statusBadge} ${reportStatusClass(
                            report.status,
                          )}`}
                        >
                          {reportStatusLabel[report.status]}
                        </span>
                        <small>
                          {report.submittedAt
                            ? formatDate(report.submittedAt)
                            : `Hạn: ${formatDate(report.dueAt)}`}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <aside className={`${styles.panel} ${styles.schedulePanel}`}>
              <div className={styles.panelHeader}>
                <h2>Lịch nhắc nhở</h2>
              </div>

              <div className={styles.calendarHeader}>
                <button aria-label="Tháng trước" type="button">
                  <ChevronLeft size={17} />
                </button>
                <strong>
                  {new Intl.DateTimeFormat("vi-VN", {
                    month: "long",
                    year: "numeric",
                  }).format(new Date())}
                </strong>
                <button aria-label="Tháng sau" type="button">
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className={styles.miniCalendar}>
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                  <strong key={day}>{day}</strong>
                ))}
                {calendarCells.map((day, index) => {
                  const isToday = day === new Date().getDate();

                  return (
                    <span
                      className={day !== null && isToday ? styles.today : ""}
                      key={`${day ?? "empty"}-${index}`}
                    >
                      {day ?? ""}
                    </span>
                  );
                })}
              </div>

              <div className={styles.eventHeader}>
                <h3>Sự kiện sắp tới</h3>
                <button className={styles.textButton} type="button">
                  Xem tất cả
                </button>
              </div>

              {data.upcomingDeadlines.length === 0 ? (
                <p className={styles.noEvents}>
                  Chưa có thời hạn sắp tới trong cơ sở dữ liệu.
                </p>
              ) : (
                <div className={styles.eventList}>
                  {data.upcomingDeadlines.map((deadline, index) => (
                    <div className={styles.eventItem} key={deadline.id}>
                      <span
                        className={`${styles.eventDot} ${
                          styles[`eventColor${(index % 4) + 1}`]
                        }`}
                      />
                      <div>
                        <strong>{deadline.title}</strong>
                        <span>{formatDateTime(deadline.dueAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>

            <article className={`${styles.panel} ${styles.studentPanel}`}>
              <div className={styles.panelHeader}>
                <h2>Danh sách sinh viên đang hướng dẫn</h2>
                <button
                  className={styles.textButton}
                  onClick={goToStudents}
                  type="button"
                >
                  Xem tất cả
                </button>
              </div>

              {data.students.length === 0 ? (
                <EmptyState text="Giảng viên chưa được phân công sinh viên." />
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.studentTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Sinh viên</th>
                        <th>Mã SV</th>
                        <th>Doanh nghiệp</th>
                        <th>Vị trí</th>
                        <th>Tiến độ</th>
                        <th>Điểm TB</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.students.map((student, index) => (
                        <tr
                          key={student.internshipId}
                          onClick={goToStudents}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{index + 1}</td>
                          <td>
                            <div className={styles.studentCell}>
                              <div className={styles.smallAvatar}>
                                {getInitials(student.studentName)}
                              </div>
                              <strong>{student.studentName}</strong>
                            </div>
                          </td>
                          <td>{student.studentCode}</td>
                          <td>{student.companyName ?? "Chưa cập nhật"}</td>
                          <td>{student.positionTitle}</td>
                          <td>
                            <div className={styles.progressCell}>
                              <span>{student.progressPercentage}%</span>
                              <div className={styles.progressTrack}>
                                <div
                                  className={styles.progressValue}
                                  style={{
                                    width: `${student.progressPercentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>
                            {student.averageScore > 0
                              ? student.averageScore.toFixed(1)
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${internshipStatusClass(
                                student.status,
                              )}`}
                            >
                              {internshipStatusLabel[student.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
