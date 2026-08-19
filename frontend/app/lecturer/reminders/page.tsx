"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCheck,
  CircleAlert,
  Clock3,
  FileWarning,
  Filter,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import {
  fetchLecturerReminders,
  fetchReminderConversation,
  sendReminderMessage,
  type LecturerRemindersResponse,
  type ReminderConversation,
  type ReminderMessageType,
  type ReminderStudent,
} from "@/lib/lecturerReminders";
import styles from "./page.module.css";

type AttentionFilter = "ALL" | "NEEDS_ATTENTION" | "MESSAGED" | "UNREAD";

function formatDateTime(value: string | null): string {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function messageTypeLabel(type: ReminderMessageType): string {
  return { MESSAGE: "Tin nhắn", REMINDER: "Nhắc nhở", WARNING: "Cảnh báo" }[type];
}

function quickMessage(student: ReminderStudent, type: ReminderMessageType): string {
  if (type === "WARNING") {
    if (student.overdueReportCount > 0) return `Em đang có ${student.overdueReportCount} báo cáo quá hạn chưa nộp. Em cần kiểm tra và hoàn thành sớm, sau đó phản hồi lại cho thầy/cô.`;
    return "Tiến độ thực tập của em đang cần được chú ý. Em hãy rà soát công việc và chủ động phản hồi kế hoạch khắc phục cho thầy/cô.";
  }
  if (type === "REMINDER") return "Em vui lòng kiểm tra tiến độ thực tập và các báo cáo cần hoàn thành. Nếu có khó khăn, hãy chủ động phản hồi để thầy/cô hỗ trợ.";
  return "Chào em, thầy/cô muốn trao đổi thêm về tình hình thực tập hiện tại của em.";
}

export default function LecturerRemindersPage() {
  const [data, setData] = useState<LecturerRemindersResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<ReminderConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [sendError, setSendError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AttentionFilter>("ALL");
  const [messageType, setMessageType] = useState<ReminderMessageType>("REMINDER");
  const [message, setMessage] = useState("");
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const openConversation = useCallback(async (student: ReminderStudent) => {
    setSelectedId(student.studentId);
    setLoadingConversation(true);
    setConversationError("");
    setSendError("");
    try {
      const result = await fetchReminderConversation(student.studentId);
      setConversation(result);
      setMessage(quickMessage(result.student, "REMINDER"));
      setMessageType("REMINDER");
    } catch (loadError) {
      setConversation(null);
      setConversationError(loadError instanceof Error ? loadError.message : "Không thể tải cuộc trao đổi.");
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchLecturerReminders();
      setData(result);
      const first = result.students[0] ?? null;
      if (first) await openConversation(first);
      else {
        setSelectedId(null);
        setConversation(null);
      }
    } catch (loadError) {
      setData(null);
      setConversation(null);
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu nhắc nhở.");
    } finally {
      setLoading(false);
    }
  }, [openConversation]);

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [conversation?.messages.length]);

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.students ?? []).filter((student) => {
      const haystack = [student.studentName, student.studentCode, student.className, student.major, student.companyName, student.positionTitle].join(" ").toLocaleLowerCase("vi");
      const matchesFilter = filter === "ALL"
        || (filter === "NEEDS_ATTENTION" && student.warningCount > 0)
        || (filter === "MESSAGED" && student.messageCount > 0)
        || (filter === "UNREAD" && student.unreadMessageCount > 0);
      return (!keyword || haystack.includes(keyword)) && matchesFilter;
    });
  }, [data, filter, search]);

  function chooseType(type: ReminderMessageType) {
    setMessageType(type);
    if (conversation && !message.trim()) setMessage(quickMessage(conversation.student, type));
  }

  async function handleSend() {
    if (!conversation || !message.trim()) {
      setSendError("Vui lòng nhập nội dung cần gửi cho sinh viên.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const sent = await sendReminderMessage(conversation.student.studentId, messageType, message.trim());
      setConversation((current) => current ? { ...current, messages: [...current.messages, sent] } : current);
      setMessage("");
      const refreshed = await fetchLecturerReminders();
      setData(refreshed);
    } catch (sendFailure) {
      setSendError(sendFailure instanceof Error ? sendFailure.message : "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  }

  const summary = data?.summary;

  return <LecturerShell title="Nhắc nhở & Cảnh báo">
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>THEO DÕI SINH VIÊN</p><h1>Nhắc nhở & Cảnh báo</h1><p>Phát hiện vấn đề và gửi lời nhắc trực tiếp đến từng sinh viên.</p></div>
        <button className={styles.refreshButton} disabled={loading} onClick={() => void loadPage()} type="button">{loading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />}Làm mới</button>
      </header>

      <section className={styles.summaryGrid}>
        <button onClick={() => setFilter("ALL")} type="button"><UsersRound size={20} /><span>Sinh viên phụ trách<strong>{summary?.totalStudents ?? 0}</strong></span></button>
        <button onClick={() => setFilter("NEEDS_ATTENTION")} type="button"><ShieldAlert size={20} /><span>Cần chú ý<strong>{summary?.needsAttention ?? 0}</strong></span></button>
        <button onClick={() => setFilter("MESSAGED")} type="button"><MessageSquareText size={20} /><span>Tin đã gửi<strong>{summary?.sentMessages ?? 0}</strong></span></button>
        <button onClick={() => setFilter("UNREAD")} type="button"><Bell size={20} /><span>Sinh viên chưa đọc<strong>{summary?.unreadByStudents ?? 0}</strong></span></button>
      </section>

      <section className={styles.filterBand}>
        <div className={styles.searchBox}><Search size={17} /><input aria-label="Tìm sinh viên" placeholder="Tên, mã sinh viên, doanh nghiệp, vị trí..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label><Filter size={15} /><select aria-label="Lọc sinh viên" value={filter} onChange={(event) => setFilter(event.target.value as AttentionFilter)}><option value="ALL">Tất cả sinh viên</option><option value="NEEDS_ATTENTION">Đang cần chú ý</option><option value="MESSAGED">Đã gửi tin</option><option value="UNREAD">Sinh viên chưa đọc</option></select></label>
      </section>

      {loading && <section className={styles.statePanel}><Loader2 className={styles.spin} size={30} /><p>Đang tải dữ liệu cảnh báo...</p></section>}
      {!loading && error && <section className={`${styles.statePanel} ${styles.errorState}`}><AlertCircle size={32} /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={() => void loadPage()} type="button">Thử lại</button></section>}

      {!loading && !error && <div className={styles.workspace}>
        <section className={styles.studentPanel}>
          <header><div><h2>Danh sách sinh viên</h2><p>{filteredStudents.length} sinh viên phù hợp</p></div></header>
          <div className={styles.studentList}>
            {filteredStudents.map((student) => <button className={`${styles.studentRow} ${selectedId === student.studentId ? styles.studentRowActive : ""}`} key={student.studentId} onClick={() => void openConversation(student)} type="button">
              <div className={styles.rowTop}><span className={styles.avatar}>{student.studentName.trim().charAt(0).toUpperCase()}</span><span className={styles.studentName}><strong>{student.studentName}</strong><small>{student.studentCode} · {student.className}</small></span>{student.warningCount > 0 && <span className={styles.warningBadge}>{student.warningCount}</span>}</div>
              <p>{student.positionTitle} · {student.companyName}</p>
              <div className={styles.progressTrack}><span style={{ width: `${Math.min(100, student.progressPercentage)}%` }} /></div>
              <div className={styles.rowMeta}><span>Tiến độ {student.progressPercentage.toFixed(0)}%</span>{student.latestMessage ? <span><Clock3 size={12} />{formatDateTime(student.latestMessageAt)}</span> : <span>Chưa gửi tin</span>}</div>
              {student.latestMessage && <div className={styles.latestMessage}>{student.latestMessage}</div>}
            </button>)}
            {filteredStudents.length === 0 && <div className={styles.emptyList}><UsersRound size={28} /><p>Không có sinh viên phù hợp bộ lọc.</p></div>}
          </div>
        </section>

        <section className={styles.conversationPanel}>
          {loadingConversation && <div className={styles.detailLoading}><Loader2 className={styles.spin} size={22} />Đang tải cuộc trao đổi...</div>}
          {conversationError && <div className={styles.inlineError}><AlertCircle size={17} />{conversationError}</div>}
          {!conversation && !loadingConversation && <div className={styles.emptyConversation}><MessageSquareText size={35} /><p>Chọn sinh viên để xem cảnh báo và gửi lời nhắc.</p></div>}

          {conversation && <>
            <header className={styles.conversationHeader}><div className={styles.headerIdentity}><span className={styles.largeAvatar}>{conversation.student.studentName.trim().charAt(0).toUpperCase()}</span><div><h2>{conversation.student.studentName}</h2><p>{conversation.student.studentCode} · {conversation.student.major || "Chưa cập nhật ngành"}</p></div></div><div className={styles.headerStats}><span>Tiến độ<strong>{conversation.student.progressPercentage.toFixed(0)}%</strong></span><span>Cảnh báo<strong>{conversation.student.warningCount}</strong></span></div></header>

            <section className={styles.alertSection}>
              <div className={styles.sectionHeading}><AlertTriangle size={18} /><div><h3>Cảnh báo hệ thống</h3><p>Tổng hợp tự động từ tiến độ và hạn báo cáo</p></div></div>
              <div className={styles.alertList}>{conversation.alerts.map((alert) => <article className={styles[`alert${alert.severity}`]} key={alert.key}>{alert.severity === "ERROR" ? <CircleAlert size={18} /> : <FileWarning size={18} />}<span><strong>{alert.title}</strong><p>{alert.description}</p>{alert.occurredAt && <small>{formatDateTime(alert.occurredAt)}</small>}</span></article>)}{conversation.alerts.length === 0 && <div className={styles.noAlerts}><CheckCheck size={18} />Chưa phát hiện nội dung bất thường.</div>}</div>
            </section>

            <section className={styles.chatSection}>
              <div className={styles.sectionHeading}><MessageSquareText size={18} /><div><h3>Lịch sử nhắc nhở</h3><p>Tin gửi tới hộp thông báo của sinh viên</p></div></div>
              <div className={styles.messageList} ref={messageListRef}>
                {conversation.messages.length === 0 && <div className={styles.noMessages}><MessageSquareText size={27} /><p>Chưa có tin nhắn nào được gửi cho sinh viên này.</p></div>}
                {conversation.messages.map((item) => <article className={`${styles.messageBubble} ${styles[`message${item.messageType}`]}`} key={item.id}><div><span>{messageTypeLabel(item.messageType)}</span><small>{formatDateTime(item.createdAt)}</small></div><p>{item.content}</p><footer>{item.isRead ? <><CheckCheck size={13} />Đã đọc {formatDateTime(item.readAt)}</> : <><Clock3 size={13} />Đã gửi, chưa đọc</>}</footer></article>)}
              </div>

              <div className={styles.composer}>
                <div className={styles.typeControl}><button className={messageType === "MESSAGE" ? styles.typeActive : ""} onClick={() => chooseType("MESSAGE")} type="button"><MessageSquareText size={15} />Tin nhắn</button><button className={messageType === "REMINDER" ? styles.typeActive : ""} onClick={() => chooseType("REMINDER")} type="button"><Bell size={15} />Nhắc nhở</button><button className={messageType === "WARNING" ? styles.warningActive : ""} onClick={() => chooseType("WARNING")} type="button"><AlertTriangle size={15} />Cảnh báo</button></div>
                <textarea aria-label="Nội dung nhắc nhở" maxLength={5000} placeholder="Nhập nội dung gửi trực tiếp đến sinh viên..." rows={4} value={message} onChange={(event) => setMessage(event.target.value)} />
                <div className={styles.composerFooter}><span>{message.length}/5000 ký tự</span><button disabled={sending || !message.trim()} onClick={() => void handleSend()} type="button">{sending ? <Loader2 className={styles.spin} size={16} /> : <Send size={16} />}Gửi đến {conversation.student.studentName}</button></div>
                {sendError && <p className={styles.sendError}>{sendError}</p>}
              </div>
            </section>
          </>}
        </section>
      </div>}
    </main>
  </LecturerShell>;
}
