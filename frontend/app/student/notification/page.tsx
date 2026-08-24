"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Info,
  Loader2,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";
import { useSettings } from "@/context/settings-provider";
import {
  fetchStudentNotifications,
  markAllStudentNotificationsRead,
  publishStudentUnreadCount,
  setStudentNotificationRead,
  subscribeStudentNotificationEvents,
  type StudentNotificationConnectionStatus,
  type StudentNotificationsResponse,
  type StudentNotification,
} from "@/lib/studentNotifications";
import styles from "./page.module.css";

type Tab = "notifications" | "calendar";

function formatDateTime(value: string, locale: "vi" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "en" ? "Not updated" : "Chưa cập nhật";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonth(date: Date, locale: "vi" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function isLecturerMessage(item: StudentNotification): boolean {
  return item.relatedType === "LECTURER_STUDENT_MESSAGE" || item.type.startsWith("LECTURER_");
}

function NotificationIcon({ item }: { item: StudentNotification }) {
  if (item.severity === "ERROR") return <CircleAlert size={20} />;
  if (item.severity === "WARNING") return <AlertTriangle size={20} />;
  if (isLecturerMessage(item)) return <MessageSquareText size={20} />;
  return <Info size={20} />;
}

export default function StudentNotificationsPage() {
  const { locale } = useSettings();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("notifications");
  const [month, setMonth] = useState(() => new Date());
  const [data, setData] = useState<StudentNotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [realtimeStatus, setRealtimeStatus] =
    useState<StudentNotificationConnectionStatus>("connecting");

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const result = await fetchStudentNotifications(month.getFullYear(), month.getMonth() + 1);
      setData(result);
      publishStudentUnreadCount(result.unreadCount);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "AUTH_REQUIRED") {
        router.replace("/auth/login");
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Không thể tải thông báo.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [month, router]);

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(() => subscribeStudentNotificationEvents(
    () => {
      void loadData(false);
    },
    setRealtimeStatus,
  ), [loadData]);

  const lecturerMessages = useMemo(
    () => data?.notifications.filter(isLecturerMessage).length ?? 0,
    [data],
  );

  async function toggleRead(item: StudentNotification) {
    setUpdating(true);
    setError("");
    try {
      await setStudentNotificationRead(item.id, !item.read);
      await loadData(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật thông báo.");
    } finally {
      setUpdating(false);
    }
  }

  async function markAllRead() {
    setUpdating(true);
    setError("");
    try {
      await markAllStudentNotificationsRead();
      await loadData(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật thông báo.");
    } finally {
      setUpdating(false);
    }
  }

  function moveMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return <div className={styles.layout}>
    <Sidebar />
    <div className={styles.main}>
      <Header />
      <main className={styles.page}>
        <header className={styles.pageHeader}><div><p className={styles.eyebrow}>TRUNG TÂM CẬP NHẬT</p><h1>Lịch & Thông báo</h1><p>Theo dõi lời nhắc từ giảng viên, phản hồi và các mốc quan trọng trong kỳ thực tập.</p></div><div className={styles.headerActions}><span className={`${styles.realtimeStatus} ${styles[`realtime${realtimeStatus}`]}`}><i />{realtimeStatus === "connected" ? "Cập nhật trực tiếp" : realtimeStatus === "connecting" ? "Đang kết nối" : "Đang kết nối lại"}</span><button className={styles.refreshButton} disabled={loading} onClick={() => void loadData()} type="button">{loading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />}Làm mới</button></div></header>

        <section className={styles.summaryGrid}>
          <div><Bell size={20} /><span>Chưa đọc<strong>{data?.unreadCount ?? 0}</strong></span></div>
          <div><MessageSquareText size={20} /><span>Từ giảng viên<strong>{lecturerMessages}</strong></span></div>
          <div><CalendarDays size={20} /><span>Sự kiện tháng này<strong>{data?.events.length ?? 0}</strong></span></div>
        </section>

        <nav className={styles.tabs}><button className={tab === "notifications" ? styles.activeTab : ""} onClick={() => setTab("notifications")} type="button"><Bell size={17} />Thông báo</button><button className={tab === "calendar" ? styles.activeTab : ""} onClick={() => setTab("calendar")} type="button"><CalendarDays size={17} />Lịch & Deadline</button></nav>

        {loading && <section className={styles.statePanel}><Loader2 className={styles.spin} size={29} /><p>Đang tải thông báo...</p></section>}
        {!loading && error && <div className={styles.inlineError}><AlertCircle size={17} />{error}</div>}

        {!loading && data && tab === "notifications" && <section className={styles.notificationPanel}>
          <header><div><h2>Thông báo của bạn</h2><p>Tin mới nhất được lưu trực tiếp từ hệ thống.</p></div><button disabled={updating || data.unreadCount === 0} onClick={() => void markAllRead()} type="button"><CheckCheck size={16} />Đánh dấu đã đọc</button></header>
          <div className={styles.notificationList}>
            {data.notifications.map((item) => <button className={`${styles.notificationItem} ${!item.read ? styles.unread : ""} ${isLecturerMessage(item) ? styles.lecturerMessage : ""} ${styles[`severity${item.severity}`]}`} disabled={updating} key={item.id} onClick={() => void toggleRead(item)} type="button">
              <span className={styles.notificationIcon}><NotificationIcon item={item} /></span>
              <span className={styles.notificationContent}><span className={styles.titleRow}><strong>{item.title}</strong>{!item.read && <i />}</span><p>{item.message}</p><small><Clock3 size={13} />{formatDateTime(item.createdAt, locale)}{isLecturerMessage(item) && " · Giảng viên phụ trách"}</small></span>
              <span className={styles.readState}>{item.read ? "Đã đọc" : "Tin mới"}</span>
            </button>)}
            {data.notifications.length === 0 && <div className={styles.emptyState}><Bell size={31} /><h3>Chưa có thông báo</h3><p>Các lời nhắc và cập nhật mới sẽ xuất hiện tại đây.</p></div>}
          </div>
        </section>}

        {!loading && data && tab === "calendar" && <section className={styles.calendarPanel}>
          <header><button aria-label="Tháng trước" onClick={() => moveMonth(-1)} type="button"><ChevronLeft size={18} /></button><h2>{formatMonth(month, locale)}</h2><button aria-label="Tháng sau" onClick={() => moveMonth(1)} type="button"><ChevronRight size={18} /></button></header>
          <div className={styles.eventList}>{data.events.map((event) => <article key={`${event.source}-${event.id}`}><span className={styles.eventDate}><strong>{new Date(event.startTime).getDate()}</strong><small>{new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { month: "short" }).format(new Date(event.startTime))}</small></span><div><h3>{event.title}</h3><p>{event.description || event.eventType || "Sự kiện thực tập"}</p><small><Clock3 size={13} />{formatDateTime(event.startTime, locale)}</small></div></article>)}{data.events.length === 0 && <div className={styles.emptyState}><CalendarDays size={31} /><h3>Không có sự kiện trong tháng</h3><p>Chuyển tháng để xem các deadline và lịch thực tập khác.</p></div>}</div>
        </section>}
      </main>
    </div>
  </div>;
}
