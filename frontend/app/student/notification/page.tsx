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

type CalendarDay = {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
};

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

function formatCalendarKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);

  // JS: CN = 0. Chuyển thành T2 = 0 ... CN = 6.
  const mondayIndex = (firstDay.getDay() + 6) % 7;

  const gridStart = new Date(year, monthIndex, 1 - mondayIndex);
  const today = new Date();
  const todayKey = formatCalendarKey(today);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );

    return {
      date,
      key: formatCalendarKey(date),
      inCurrentMonth: date.getMonth() === monthIndex,
      isToday: formatCalendarKey(date) === todayKey,
    };
  });
}

function isLecturerMessage(item: StudentNotification): boolean {
  return (
    item.relatedType === "LECTURER_STUDENT_MESSAGE" ||
    item.type.startsWith("LECTURER_")
  );
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

  const loadData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      try {
        const result = await fetchStudentNotifications(
          month.getFullYear(),
          month.getMonth() + 1,
        );

        setData(result);
        publishStudentUnreadCount(result.unreadCount);
      } catch (loadError) {
        if (
          loadError instanceof Error &&
          loadError.message === "AUTH_REQUIRED"
        ) {
          router.replace("/auth/login");
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải thông báo.",
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [month, router],
  );

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(
    () =>
      subscribeStudentNotificationEvents(
        () => {
          void loadData(false);
        },
        setRealtimeStatus,
      ),
    [loadData],
  );

  const lecturerMessages = useMemo(
    () => data?.notifications.filter(isLecturerMessage).length ?? 0,
    [data],
  );

  const calendarDays = useMemo(() => buildMonthGrid(month), [month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, StudentNotificationsResponse["events"]>();

    for (const event of data?.events ?? []) {
      const date = new Date(event.startTime);

      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const key = formatCalendarKey(date);
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    }

    for (const [, events] of map) {
      events.sort(
        (a, b) =>
          new Date(a.startTime).getTime() -
          new Date(b.startTime).getTime(),
      );
    }

    return map;
  }, [data]);

  async function toggleRead(item: StudentNotification) {
    setUpdating(true);
    setError("");

    try {
      await setStudentNotificationRead(item.id, !item.read);
      await loadData(false);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Không thể cập nhật thông báo.",
      );
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
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Không thể cập nhật thông báo.",
      );
    } finally {
      setUpdating(false);
    }
  }

  function moveMonth(offset: number) {
    setMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + offset,
          1,
        ),
    );
  }

  function goToCurrentMonth() {
    setMonth(new Date());
  }

  const dayNames =
    locale === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div className={styles.layout}>
      <Sidebar />

      <div className={styles.main}>
        <Header />

        <main className={styles.page}>
          <header className={styles.pageHeader}>
            <div>
              <p className={styles.eyebrow}>
                {locale === "en"
                  ? "STUDENT UPDATES"
                  : "THÔNG TIN THỰC TẬP"}
              </p>

              <h1>
                {locale === "en"
                  ? "Calendar & Notifications"
                  : "Lịch & Thông báo"}
              </h1>

              <p>
                {locale === "en"
                  ? "Track lecturer reminders, feedback and important internship milestones."
                  : "Theo dõi lời nhắc từ giảng viên, phản hồi và các mốc quan trọng trong kỳ thực tập."}
              </p>
            </div>

            <div className={styles.headerActions}>
              <span
                className={`${styles.realtimeStatus} ${
                  styles[`realtime${realtimeStatus}`]
                }`}
              >
                <i />

                {realtimeStatus === "connected"
                  ? locale === "en"
                    ? "Live updates"
                    : "Cập nhật trực tiếp"
                  : realtimeStatus === "connecting"
                    ? locale === "en"
                      ? "Connecting"
                      : "Đang kết nối"
                    : locale === "en"
                      ? "Reconnecting"
                      : "Đang kết nối lại"}
              </span>

              <button
                className={styles.refreshButton}
                disabled={loading}
                onClick={() => void loadData()}
                type="button"
              >
                {loading ? (
                  <Loader2
                    className={styles.spin}
                    size={17}
                  />
                ) : (
                  <RefreshCw size={17} />
                )}

                {locale === "en" ? "Refresh" : "Làm mới"}
              </button>
            </div>
          </header>

          <section className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryIcon}>
                <Bell size={20} />
              </span>

              <span>
                {locale === "en" ? "Unread" : "Chưa đọc"}
                <strong>{data?.unreadCount ?? 0}</strong>
              </span>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.summaryIcon}>
                <MessageSquareText size={20} />
              </span>

              <span>
                {locale === "en" ? "From lecturers" : "Từ giảng viên"}
                <strong>{lecturerMessages}</strong>
              </span>
            </div>

            <div className={styles.summaryCard}>
              <span className={styles.summaryIcon}>
                <CalendarDays size={20} />
              </span>

              <span>
                {locale === "en"
                  ? "Events this month"
                  : "Sự kiện tháng này"}
                <strong>{data?.events.length ?? 0}</strong>
              </span>
            </div>
          </section>

          <nav className={styles.tabs}>
            <button
              className={
                tab === "notifications"
                  ? styles.activeTab
                  : ""
              }
              onClick={() =>
                setTab("notifications")
              }
              type="button"
            >
              <Bell size={17} />
              {locale === "en" ? "Notifications" : "Thông báo"}
            </button>

            <button
              className={
                tab === "calendar"
                  ? styles.activeTab
                  : ""
              }
              onClick={() => setTab("calendar")}
              type="button"
            >
              <CalendarDays size={17} />
              {locale === "en" ? "Calendar" : "Lịch tháng"}
            </button>
          </nav>

          {loading && (
            <section className={styles.statePanel}>
              <Loader2
                className={styles.spin}
                size={29}
              />
              <p>
                {locale === "en"
                  ? "Loading updates..."
                  : "Đang tải thông báo..."}
              </p>
            </section>
          )}

          {!loading && error && (
            <div className={styles.inlineError}>
              <AlertCircle size={17} />
              {error}
            </div>
          )}

          {!loading &&
            data &&
            tab === "notifications" && (
              <section
                className={
                  styles.notificationPanel
                }
              >
                <header>
                  <div>
                    <h2>
                      {locale === "en"
                        ? "Your notifications"
                        : "Thông báo của bạn"}
                    </h2>

                    <p>
                      {locale === "en"
                        ? "Latest updates saved directly from the system."
                        : "Tin mới nhất được lưu trực tiếp từ hệ thống."}
                    </p>
                  </div>

                  <button
                    disabled={
                      updating ||
                      data.unreadCount === 0
                    }
                    onClick={() =>
                      void markAllRead()
                    }
                    type="button"
                  >
                    <CheckCheck size={16} />
                    {locale === "en"
                      ? "Mark all read"
                      : "Đánh dấu đã đọc"}
                  </button>
                </header>

                <div
                  className={
                    styles.notificationList
                  }
                >
                  {data.notifications.map(
                    (item) => (
                      <button
                        className={`${styles.notificationItem} ${
                          !item.read
                            ? styles.unread
                            : ""
                        } ${
                          isLecturerMessage(item)
                            ? styles.lecturerMessage
                            : ""
                        } ${
                          styles[
                            `severity${item.severity}`
                          ]
                        }`}
                        disabled={updating}
                        key={item.id}
                        onClick={() =>
                          void toggleRead(item)
                        }
                        type="button"
                      >
                        <span
                          className={
                            styles.notificationIcon
                          }
                        >
                          <NotificationIcon
                            item={item}
                          />
                        </span>

                        <span
                          className={
                            styles.notificationContent
                          }
                        >
                          <span
                            className={
                              styles.titleRow
                            }
                          >
                            <strong>
                              {item.title}
                            </strong>

                            {!item.read && <i />}
                          </span>

                          <p>{item.message}</p>

                          <small>
                            <Clock3 size={13} />
                            {formatDateTime(
                              item.createdAt,
                              locale,
                            )}
                            {isLecturerMessage(
                              item,
                            ) &&
                              (locale === "en"
                                ? " · Assigned lecturer"
                                : " · Giảng viên phụ trách")}
                          </small>
                        </span>

                        <span
                          className={
                            styles.readState
                          }
                        >
                          {item.read
                            ? locale === "en"
                              ? "Read"
                              : "Đã đọc"
                            : locale === "en"
                              ? "New"
                              : "Tin mới"}
                        </span>
                      </button>
                    ),
                  )}

                  {data.notifications.length ===
                    0 && (
                    <div
                      className={
                        styles.emptyState
                      }
                    >
                      <Bell size={31} />
                      <h3>
                        {locale === "en"
                          ? "No notifications"
                          : "Chưa có thông báo"}
                      </h3>

                      <p>
                        {locale === "en"
                          ? "New reminders and updates will appear here."
                          : "Các lời nhắc và cập nhật mới sẽ xuất hiện tại đây."}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

          {!loading &&
            data &&
            tab === "calendar" && (
              <section
                className={styles.calendarPanel}
              >
                <header
                  className={
                    styles.calendarToolbar
                  }
                >
                  <div
                    className={
                      styles.calendarTitle
                    }
                  >
                    <CalendarDays size={19} />

                    <div>
                      <h2>
                        {formatMonth(
                          month,
                          locale,
                        )}
                      </h2>

                      <p>
                        {locale === "en"
                          ? `${data.events.length} events in this month`
                          : `${data.events.length} sự kiện trong tháng`}
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      styles.calendarControls
                    }
                  >
                    <button
                      className={
                        styles.todayButton
                      }
                      onClick={
                        goToCurrentMonth
                      }
                      type="button"
                    >
                      {locale === "en"
                        ? "Today"
                        : "Hôm nay"}
                    </button>

                    <button
                      aria-label={
                        locale === "en"
                          ? "Previous month"
                          : "Tháng trước"
                      }
                      onClick={() =>
                        moveMonth(-1)
                      }
                      type="button"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <button
                      aria-label={
                        locale === "en"
                          ? "Next month"
                          : "Tháng sau"
                      }
                      onClick={() =>
                        moveMonth(1)
                      }
                      type="button"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </header>

                <div
                  className={
                    styles.calendarWeekdays
                  }
                >
                  {dayNames.map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                <div
                  className={
                    styles.calendarGrid
                  }
                >
                  {calendarDays.map(
                    (calendarDay) => {
                      const events =
                        eventsByDate.get(
                          calendarDay.key,
                        ) ?? [];

                      return (
                        <div
                          key={
                            calendarDay.key
                          }
                          className={`${styles.calendarCell} ${
                            !calendarDay.inCurrentMonth
                              ? styles.outsideMonth
                              : ""
                          } ${
                            calendarDay.isToday
                              ? styles.todayCell
                              : ""
                          }`}
                        >
                          <div
                            className={
                              styles.calendarDateRow
                            }
                          >
                            <span
                              className={
                                styles.calendarDate
                              }
                            >
                              {calendarDay.date.getDate()}
                            </span>

                            {events.length > 0 && (
                              <span
                                className={
                                  styles.eventCount
                                }
                              >
                                {events.length}
                              </span>
                            )}
                          </div>

                          <div
                            className={
                              styles.calendarEvents
                            }
                          >
                            {events
                              .slice(0, 2)
                              .map((event) => (
                                <div
                                  className={
                                    styles.calendarEvent
                                  }
                                  key={`${event.source}-${event.id}`}
                                  title={
                                    event.description ||
                                    event.title
                                  }
                                >
                                  <span />

                                  <div>
                                    <strong>
                                      {event.title}
                                    </strong>

                                    <small>
                                      {new Intl.DateTimeFormat(
                                        locale === "en"
                                          ? "en-US"
                                          : "vi-VN",
                                        {
                                          hour: "2-digit",
                                          minute:
                                            "2-digit",
                                        },
                                      ).format(
                                        new Date(
                                          event.startTime,
                                        ),
                                      )}
                                    </small>
                                  </div>
                                </div>
                              ))}

                            {events.length > 2 && (
                              <span
                                className={
                                  styles.moreEvents
                                }
                              >
                                +{events.length - 2}{" "}
                                {locale === "en"
                                  ? "more"
                                  : "sự kiện"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>

                {data.events.length === 0 && (
                  <div
                    className={
                      styles.calendarEmptyNote
                    }
                  >
                    <Info size={16} />
                    <span>
                      {locale === "en"
                        ? "No internship events or deadlines in this month."
                        : "Tháng này chưa có lịch, deadline hoặc sự kiện thực tập."}
                    </span>
                  </div>
                )}
              </section>
            )}
        </main>
      </div>
    </div>
  );
}
