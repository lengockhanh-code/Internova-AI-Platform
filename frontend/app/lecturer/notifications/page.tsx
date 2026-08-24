"use client";

import {
  BellRing,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Info,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import { useSettings } from "@/context/settings-provider";
import {
  deleteLecturerNotification,
  deleteReadLecturerNotifications,
  fetchLecturerNotifications,
  markAllLecturerNotificationsRead,
  publishLecturerUnreadCount,
  setLecturerNotificationRead,
  type LecturerNotification,
  type LecturerNotificationSeverity,
  type LecturerNotificationsResponse,
  type LecturerNotificationStatus,
} from "@/lib/lecturerNotifications";

import styles from "./page.module.css";

const PAGE_SIZE = 12;

type Locale = "vi" | "en";

const typeLabels: Record<Locale, Record<string, string>> = {
  vi: {
    REPORT: "Báo cáo",
    REPORT_SUBMITTED: "Báo cáo mới",
    REPORT_REVIEW: "Phản hồi báo cáo",
    REPORT_WARNING: "Cảnh báo báo cáo",
    WEEKLY_REPORT: "Báo cáo tuần",
    APPLICATION: "Hồ sơ đăng ký",
    APPLICATION_SUBMITTED: "Hồ sơ mới",
    APPLICATION_REVIEW: "Kết quả hồ sơ",
    EVALUATION: "Đánh giá",
    DEADLINE: "Hạn nộp",
    REMINDER: "Nhắc nhở",
    SYSTEM: "Hệ thống",
  },
  en: {
    REPORT: "Report",
    REPORT_SUBMITTED: "New report",
    REPORT_REVIEW: "Report feedback",
    REPORT_WARNING: "Report warning",
    WEEKLY_REPORT: "Weekly report",
    APPLICATION: "Application",
    APPLICATION_SUBMITTED: "New application",
    APPLICATION_REVIEW: "Application result",
    EVALUATION: "Evaluation",
    DEADLINE: "Deadline",
    REMINDER: "Reminder",
    SYSTEM: "System",
  },
};

function formatType(value: string, locale: Locale): string {
  return typeLabels[locale][value]
    || value.replaceAll("_", " ").toLocaleLowerCase(locale === "en" ? "en-US" : "vi-VN");
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "en" ? "Unknown time" : "Không rõ thời gian";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeTime(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "en" ? "Unknown time" : "Không rõ thời gian";
  }
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "vi", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return formatter.format(days, "day");
  return formatDateTime(value, locale);
}

function relatedHref(item: LecturerNotification): string | null {
  const related = (item.relatedType || item.type).toUpperCase();
  if (related.includes("REPORT")) return "/lecturer/reports";
  if (related.includes("APPLICATION") || related.includes("INTERNSHIP_REGISTRATION")) {
    return "/lecturer/applications";
  }
  if (related.includes("EVALUATION")) return "/lecturer/evaluations";
  if (related.includes("REMINDER") || related.includes("MESSAGE")) {
    return "/lecturer/reminders";
  }
  if (related.includes("STUDENT")) return "/lecturer/students";
  return null;
}

function SeverityIcon({ severity }: { severity: LecturerNotificationSeverity }) {
  if (severity === "ERROR") return <CircleAlert size={20} />;
  if (severity === "WARNING") return <TriangleAlert size={20} />;
  if (severity === "SUCCESS") return <CircleCheckBig size={20} />;
  return <Info size={20} />;
}

export default function LecturerNotificationsPage() {
  const router = useRouter();
  const { locale } = useSettings();
  const [data, setData] = useState<LecturerNotificationsResponse | null>(null);
  const [status, setStatus] = useState<LecturerNotificationStatus>("ALL");
  const [severity, setSeverity] = useState<
    LecturerNotificationSeverity | "ALL" | "ATTENTION"
  >("ALL");
  const [type, setType] = useState("ALL");
  const [period, setPeriod] = useState<"ALL" | "TODAY">("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadNotifications = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await fetchLecturerNotifications({
        status,
        severity,
        type,
        search: debouncedSearch,
        period,
        page,
        pageSize: PAGE_SIZE,
      });
      setData(result);
      if (result.pagination.page !== page) setPage(result.pagination.page);
      publishLecturerUnreadCount(result.summary.unread);
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : "Không thể tải danh sách thông báo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, page, period, severity, status, type]);

  useEffect(() => {
    // Đồng bộ dữ liệu API khi bộ lọc hoặc trang hiện tại thay đổi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, [loadNotifications]);

  const hasFilters = status !== "ALL"
    || severity !== "ALL"
    || type !== "ALL"
    || period !== "ALL"
    || debouncedSearch.trim().length > 0;

  const resultText = useMemo(() => {
    const total = data?.pagination.totalItems ?? 0;
    return `${total} thông báo${hasFilters ? " phù hợp" : ""}`;
  }, [data?.pagination.totalItems, hasFilters]);

  async function runAction(key: string, action: () => Promise<void>) {
    setPendingAction(key);
    setActionError("");
    try {
      await action();
      await loadNotifications(true);
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error
        ? actionFailure.message
        : "Không thể thực hiện thao tác.");
    } finally {
      setPendingAction(null);
    }
  }

  function resetFilters() {
    setStatus("ALL");
    setSeverity("ALL");
    setType("ALL");
    setPeriod("ALL");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  function openRelated(item: LecturerNotification) {
    const href = relatedHref(item);
    if (!href) return;
    if (!item.read) {
      void runAction(`read-${item.id}`, async () => {
        await setLecturerNotificationRead(item.id, true);
        router.push(href);
      });
      return;
    }
    router.push(href);
  }

  const summary = data?.summary;
  const pagination = data?.pagination;

  return (
    <LecturerShell title="Thông báo">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>TRUNG TÂM THÔNG BÁO</p>
            <h1>Thông báo của giảng viên</h1>
            <p>Theo dõi báo cáo, hồ sơ, đánh giá và các cập nhật cần xử lý.</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.secondaryButton}
              disabled={refreshing}
              onClick={() => void loadNotifications(true)}
              type="button"
            >
              {refreshing ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />}
              Làm mới
            </button>
            <button
              className={styles.primaryButton}
              disabled={!summary?.unread || pendingAction !== null}
              onClick={() => void runAction("read-all", markAllLecturerNotificationsRead)}
              type="button"
            >
              {pendingAction === "read-all" ? <Loader2 className={styles.spin} size={17} /> : <CheckCheck size={17} />}
              Đánh dấu tất cả đã đọc
            </button>
          </div>
        </header>

        <section aria-label="Tổng quan thông báo" className={styles.summaryGrid}>
          <button className={!hasFilters ? styles.summaryActive : ""} onClick={resetFilters} type="button">
            <span className={styles.summaryIcon}><Inbox size={21} /></span>
            <span><small>Tổng thông báo</small><strong>{summary?.total ?? 0}</strong></span>
          </button>
          <button className={status === "UNREAD" ? styles.summaryActive : ""} onClick={() => { setStatus("UNREAD"); setSeverity("ALL"); setPeriod("ALL"); setPage(1); }} type="button">
            <span className={`${styles.summaryIcon} ${styles.blueIcon}`}><BellRing size={21} /></span>
            <span><small>Chưa đọc</small><strong>{summary?.unread ?? 0}</strong></span>
          </button>
          <button className={severity === "ATTENTION" ? styles.summaryActive : ""} onClick={() => { setStatus("ALL"); setSeverity("ATTENTION"); setPeriod("ALL"); setPage(1); }} type="button">
            <span className={`${styles.summaryIcon} ${styles.orangeIcon}`}><TriangleAlert size={21} /></span>
            <span><small>Cảnh báo</small><strong>{summary?.warnings ?? 0}</strong></span>
          </button>
          <button className={period === "TODAY" ? styles.summaryActive : ""} onClick={() => { setStatus("ALL"); setSeverity("ALL"); setPeriod("TODAY"); setPage(1); }} type="button">
            <span className={`${styles.summaryIcon} ${styles.greenIcon}`}><Clock3 size={21} /></span>
            <span><small>Trong hôm nay</small><strong>{summary?.today ?? 0}</strong></span>
          </button>
        </section>

        <section className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input
              aria-label="Tìm kiếm thông báo"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tiêu đề hoặc nội dung..."
              value={search}
            />
          </div>
          <label className={styles.selectBox}>
            <Filter size={16} />
            <span>Trạng thái</span>
            <select aria-label="Lọc theo trạng thái" onChange={(event) => { setStatus(event.target.value as LecturerNotificationStatus); setPage(1); }} value={status}>
              <option value="ALL">Tất cả</option>
              <option value="UNREAD">Chưa đọc</option>
              <option value="READ">Đã đọc</option>
            </select>
          </label>
          <label className={styles.selectBox}>
            <span>Mức độ</span>
            <select aria-label="Lọc theo mức độ" onChange={(event) => { setSeverity(event.target.value as LecturerNotificationSeverity | "ALL" | "ATTENTION"); setPage(1); }} value={severity}>
              <option value="ALL">Tất cả</option>
              <option value="ATTENTION">Cần chú ý</option>
              <option value="INFO">Thông tin</option>
              <option value="SUCCESS">Thành công</option>
              <option value="WARNING">Cảnh báo</option>
              <option value="ERROR">Khẩn cấp</option>
            </select>
          </label>
          <label className={styles.selectBox}>
            <span>Chủ đề</span>
            <select aria-label="Lọc theo chủ đề" onChange={(event) => { setType(event.target.value); setPage(1); }} value={type}>
              <option value="ALL">Tất cả</option>
              {(data?.availableTypes ?? []).map((itemType) => (
                <option key={itemType} value={itemType}>{formatType(itemType, locale)}</option>
              ))}
            </select>
          </label>
        </section>

        {actionError && <div className={styles.actionError}><CircleAlert size={17} /><span>{actionError}</span><button aria-label="Đóng lỗi" onClick={() => setActionError("")} type="button">×</button></div>}

        <section className={styles.notificationPanel}>
          <header className={styles.panelHeader}>
            <div><h2>Hộp thông báo</h2><p>{resultText}</p></div>
            <button
              className={styles.clearButton}
              disabled={!summary?.read || pendingAction !== null}
              onClick={() => {
                if (window.confirm("Xóa tất cả thông báo đã đọc? Thao tác này không thể hoàn tác.")) {
                  void runAction("delete-read", deleteReadLecturerNotifications);
                }
              }}
              type="button"
            ><Trash2 size={15} />Dọn thông báo đã đọc</button>
          </header>

          {loading && (
            <div className={styles.statePanel}><Loader2 className={styles.spin} size={30} /><p>Đang tải thông báo...</p></div>
          )}
          {!loading && error && (
            <div className={`${styles.statePanel} ${styles.errorState}`}>
              <CircleAlert size={32} /><h2>Không thể tải thông báo</h2><p>{error}</p>
              <button onClick={() => void loadNotifications()} type="button">Thử lại</button>
            </div>
          )}
          {!loading && !error && data?.notifications.length === 0 && (
            <div className={styles.statePanel}>
              <span className={styles.emptyIcon}><Inbox size={34} /></span>
              <h2>{hasFilters ? "Không có kết quả phù hợp" : "Hộp thông báo đang trống"}</h2>
              <p>{hasFilters ? "Hãy thay đổi từ khóa hoặc bộ lọc để xem thêm thông báo." : "Thông báo mới về sinh viên và công việc phụ trách sẽ xuất hiện tại đây."}</p>
              {hasFilters && <button onClick={resetFilters} type="button">Xóa bộ lọc</button>}
            </div>
          )}

          {!loading && !error && data && data.notifications.length > 0 && (
            <div className={styles.notificationList}>
              {data.notifications.map((item) => {
                const href = relatedHref(item);
                const actionKey = `${item.read ? "unread" : "read"}-${item.id}`;
                return (
                  <article className={`${styles.notificationItem} ${!item.read ? styles.unreadItem : ""}`} key={item.id}>
                    <span className={`${styles.severityIcon} ${styles[`severity${item.severity}`]}`}><SeverityIcon severity={item.severity} /></span>
                    <div className={styles.notificationBody}>
                      <div className={styles.itemHeading}>
                        <div className={styles.titleLine}>
                          {!item.read && <span aria-label="Chưa đọc" className={styles.unreadDot} />}
                          <h3>{item.title}</h3>
                        </div>
                        <time dateTime={item.createdAt} title={formatDateTime(item.createdAt, locale)}>{formatRelativeTime(item.createdAt, locale)}</time>
                      </div>
                      <p className={styles.message}>{item.message}</p>
                      <div className={styles.itemFooter}>
                        <span className={styles.typeBadge}>{formatType(item.type, locale)}</span>
                        {href && <button className={styles.relatedButton} onClick={() => openRelated(item)} type="button">Xem chi tiết<ExternalLink size={13} /></button>}
                      </div>
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        aria-label={item.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                        disabled={pendingAction !== null}
                        onClick={() => void runAction(actionKey, () => setLecturerNotificationRead(item.id, !item.read))}
                        title={item.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                        type="button"
                      >
                        {pendingAction === actionKey ? <Loader2 className={styles.spin} size={16} /> : item.read ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        aria-label="Xóa thông báo"
                        className={styles.deleteButton}
                        disabled={pendingAction !== null}
                        onClick={() => {
                          if (window.confirm("Bạn có chắc muốn xóa thông báo này?")) {
                            void runAction(`delete-${item.id}`, () => deleteLecturerNotification(item.id));
                          }
                        }}
                        title="Xóa thông báo"
                        type="button"
                      >
                        {pendingAction === `delete-${item.id}` ? <Loader2 className={styles.spin} size={16} /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && !error && pagination && pagination.totalPages > 1 && (
            <footer className={styles.pagination}>
              <p>Trang <strong>{pagination.page}</strong> / {pagination.totalPages}</p>
              <div>
                <button aria-label="Trang trước" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><ChevronLeft size={17} />Trước</button>
                <button aria-label="Trang sau" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Sau<ChevronRight size={17} /></button>
              </div>
            </footer>
          )}
        </section>
      </main>
    </LecturerShell>
  );
}
