"use client";

import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adminInternshipsApi,
  openAdminDocument,
  type ApplicationDetail,
  type ApplicationListItem,
  type ApplicationStatus,
  type ApplicationsResponse,
} from "@/services/admin-internships.service";

import styles from "./page.module.css";

type StatusFilter = "ALL" | "UNASSIGNED" | ApplicationStatus;
type Decision = "APPROVED" | "REJECTED";

const statusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: "Mới gửi",
  UNDER_REVIEW: "Đang xem xét",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

function dateTime(value: string | null): string {
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

function dateOnly(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Chưa cập nhật"
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

function workMode(value: string | null): string {
  if (value === "ONSITE") return "Tại doanh nghiệp";
  if (value === "REMOTE") return "Từ xa";
  if (value === "HYBRID") return "Kết hợp";
  return "Chưa cập nhật";
}

function fileSize(value: number): string {
  return value < 1024 * 1024
    ? `${(value / 1024).toFixed(1)} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function documentLabel(value: string): string {
  return ({
    CV: "CV cá nhân",
    OFFER_LETTER: "Thư tiếp nhận",
    JOB_DESCRIPTION: "Mô tả công việc",
    OTHER: "Tài liệu khác",
  } as Record<string, string>)[value] || value;
}

export default function AdminInternshipsPage() {
  const [data, setData] = useState<ApplicationsResponse | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [periodId, setPeriodId] = useState("ALL");
  const [lecturerId, setLecturerId] = useState("ALL");
  const [assignmentId, setAssignmentId] = useState("");
  const [decision, setDecision] = useState<Decision>("APPROVED");
  const [comment, setComment] = useState("");

  const openDetail = useCallback(async (applicationId: number) => {
    setSelectedId(applicationId);
    setLoadingDetail(true);
    setActionMessage("");
    try {
      const application = await adminInternshipsApi.detail(applicationId);
      setDetail(application);
      setAssignmentId(application.assignedLecturer?.id.toString() ?? "");
      setComment(application.lecturerComment ?? "");
      setDecision(application.status === "REJECTED" ? "REJECTED" : "APPROVED");
    } catch (loadError) {
      setDetail(null);
      setActionMessage(loadError instanceof Error ? loadError.message : "Không thể tải chi tiết hồ sơ.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadData = useCallback(async (keepSelection = false) => {
    setLoading(!keepSelection);
    setError("");
    try {
      const result = await adminInternshipsApi.list();
      setData(result);
      const nextId = keepSelection && selectedId
        ? selectedId
        : result.applications[0]?.applicationId ?? null;
      if (nextId) await openDetail(nextId);
      else {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải hồ sơ đăng ký.");
    } finally {
      setLoading(false);
    }
  }, [openDetail, selectedId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeout);
    // Initial synchronization should not restart when a row is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.applications ?? []).filter((item) => {
      const haystack = [
        item.studentName,
        item.studentCode,
        item.companyName,
        item.internshipPosition,
        item.major,
        item.className,
        item.assignedLecturer?.fullName ?? "",
      ].join(" ").toLocaleLowerCase("vi");
      const statusMatch = status === "ALL"
        || (status === "UNASSIGNED" ? !item.assignedLecturer : item.status === status);
      return (!keyword || haystack.includes(keyword))
        && statusMatch
        && (periodId === "ALL" || item.periodId === Number(periodId))
        && (lecturerId === "ALL" || item.assignedLecturer?.id === Number(lecturerId));
    });
  }, [data, lecturerId, periodId, search, status]);

  async function refreshCurrent(message: string) {
    await loadData(true);
    setActionMessage(message);
  }

  async function saveAssignment() {
    if (!detail || !assignmentId) {
      setActionMessage("Vui lòng chọn giảng viên phụ trách.");
      return;
    }
    setSaving(true);
    setActionMessage("");
    try {
      await adminInternshipsApi.assign(detail.applicationId, Number(assignmentId));
      await refreshCurrent("Đã phân công giảng viên phụ trách hồ sơ.");
    } catch (saveError) {
      setActionMessage(saveError instanceof Error ? saveError.message : "Không thể phân công giảng viên.");
    } finally {
      setSaving(false);
    }
  }

  async function markUnderReview() {
    if (!detail) return;
    setSaving(true);
    setActionMessage("");
    try {
      await adminInternshipsApi.review(detail.applicationId, "UNDER_REVIEW", comment);
      await refreshCurrent("Đã chuyển hồ sơ sang trạng thái đang xem xét.");
    } catch (saveError) {
      setActionMessage(saveError instanceof Error ? saveError.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  async function submitDecision() {
    if (!detail) return;
    if (!detail.assignedLecturer) {
      setActionMessage("Cần phân công giảng viên trước khi xét duyệt.");
      return;
    }
    if (decision === "REJECTED" && !comment.trim()) {
      setActionMessage("Vui lòng nhập lý do từ chối để sinh viên có thể điều chỉnh.");
      return;
    }
    const confirmed = window.confirm(
      decision === "APPROVED"
        ? "Duyệt hồ sơ và tạo kỳ thực tập cho sinh viên?"
        : "Từ chối hồ sơ và gửi lý do cho sinh viên?",
    );
    if (!confirmed) return;

    setSaving(true);
    setActionMessage("");
    try {
      await adminInternshipsApi.review(detail.applicationId, decision, comment);
      await refreshCurrent(
        decision === "APPROVED"
          ? "Đã duyệt hồ sơ và tạo kỳ thực tập."
          : "Đã từ chối hồ sơ và gửi thông báo cho sinh viên.",
      );
    } catch (saveError) {
      setActionMessage(saveError instanceof Error ? saveError.message : "Không thể lưu kết quả xét duyệt.");
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(documentId: number, download: boolean) {
    if (!detail) return;
    try {
      await openAdminDocument(detail.applicationId, documentId, download);
    } catch (openError) {
      setActionMessage(openError instanceof Error ? openError.message : "Không thể mở tài liệu.");
    }
  }

  const summary = data?.summary;
  const canReview = detail?.status === "SUBMITTED" || detail?.status === "UNDER_REVIEW";

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><ClipboardCheck size={15} /> QUẢN LÝ THỰC TẬP</span>
          <h1>Đăng ký thực tập</h1>
          <p>Theo dõi, phân công giảng viên và xét duyệt hồ sơ đăng ký của sinh viên.</p>
        </div>
        <button className={styles.refreshButton} disabled={loading} onClick={() => void loadData(true)} type="button">
          {loading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />} Làm mới
        </button>
      </header>

      <section className={styles.summaryGrid}>
        <button className={status === "ALL" ? styles.summaryActive : ""} onClick={() => setStatus("ALL")} type="button"><ClipboardCheck /><span>Tổng hồ sơ<strong>{summary?.total ?? 0}</strong></span></button>
        <button className={status === "SUBMITTED" ? styles.summaryActive : ""} onClick={() => setStatus("SUBMITTED")} type="button"><Clock3 /><span>Chờ tiếp nhận<strong>{summary?.submitted ?? 0}</strong></span></button>
        <button className={status === "UNDER_REVIEW" ? styles.summaryActive : ""} onClick={() => setStatus("UNDER_REVIEW")} type="button"><Eye /><span>Đang xem xét<strong>{summary?.underReview ?? 0}</strong></span></button>
        <button className={status === "APPROVED" ? styles.summaryActive : ""} onClick={() => setStatus("APPROVED")} type="button"><CheckCircle2 /><span>Đã duyệt<strong>{summary?.approved ?? 0}</strong></span></button>
        <button className={status === "UNASSIGNED" ? styles.summaryActive : ""} onClick={() => setStatus("UNASSIGNED")} type="button"><UserRoundX /><span>Chưa phân công<strong>{summary?.unassigned ?? 0}</strong></span></button>
      </section>

      <section className={styles.filters}>
        <label className={styles.searchBox}><Search size={17} /><input aria-label="Tìm hồ sơ" placeholder="Tên, mã sinh viên, doanh nghiệp, vị trí..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><Filter size={15} /><select aria-label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="ALL">Tất cả trạng thái</option><option value="SUBMITTED">Mới gửi</option><option value="UNDER_REVIEW">Đang xem xét</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="UNASSIGNED">Chưa phân công</option></select></label>
        <label><select aria-label="Đợt thực tập" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="ALL">Tất cả đợt</option>{data?.periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.semesterCode}</option>)}</select></label>
        <label><select aria-label="Giảng viên" value={lecturerId} onChange={(event) => setLecturerId(event.target.value)}><option value="ALL">Tất cả giảng viên</option>{data?.lecturers.map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.fullName}</option>)}</select></label>
      </section>

      {loading && <section className={styles.state}><Loader2 className={styles.spin} /><p>Đang tải hồ sơ đăng ký...</p></section>}
      {!loading && error && <section className={`${styles.state} ${styles.error}`}><AlertCircle /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={() => void loadData()} type="button">Thử lại</button></section>}

      {!loading && !error && (
        <div className={styles.workspace}>
          <section className={styles.listPanel}>
            <header><div><h2>Danh sách hồ sơ</h2><p>{filtered.length} hồ sơ phù hợp</p></div></header>
            <div className={styles.applicationList}>
              {filtered.map((item: ApplicationListItem) => (
                <button className={`${styles.applicationRow} ${selectedId === item.applicationId ? styles.rowActive : ""}`} key={item.applicationId} onClick={() => void openDetail(item.applicationId)} type="button">
                  <div className={styles.rowHead}><span className={styles.avatar}>{item.studentName.trim().charAt(0).toUpperCase()}</span><span className={styles.student}><strong>{item.studentName}</strong><small>{item.studentCode} · {item.className || "Chưa có lớp"}</small></span><span className={`${styles.statusBadge} ${styles[`status${item.status}`]}`}>{statusLabels[item.status]}</span></div>
                  <h3>{item.internshipPosition || "Chưa cập nhật vị trí"}</h3>
                  <p>{item.companyName || "Chưa cập nhật doanh nghiệp"}</p>
                  <div className={styles.assignment}><UserRound size={13} />{item.assignedLecturer?.fullName || "Chưa phân công giảng viên"}</div>
                  <div className={styles.rowMeta}><span><CalendarDays size={13} />{dateTime(item.submittedAt)}</span><span><FileText size={13} />{item.documentCount}</span></div>
                </button>
              ))}
              {!filtered.length && <div className={styles.empty}><ClipboardCheck /><p>Không có hồ sơ phù hợp bộ lọc.</p></div>}
            </div>
          </section>

          <section className={styles.detailPanel}>
            {loadingDetail && <div className={styles.detailLoading}><Loader2 className={styles.spin} size={20} /> Đang tải chi tiết...</div>}
            {!detail && !loadingDetail && <div className={styles.empty}><ClipboardCheck /><p>Chọn một hồ sơ để xem chi tiết.</p></div>}
            {detail && (
              <>
                <header className={styles.detailHeader}><div><p>HỒ SƠ #{detail.applicationId}</p><h2>{detail.student.fullName}</h2><span>Gửi lúc {dateTime(detail.submittedAt)}</span></div><span className={`${styles.statusBadge} ${styles[`status${detail.status}`]}`}>{statusLabels[detail.status]}</span></header>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><UserRoundCheck /><div><h3>Phân công xử lý</h3><p>Giảng viên chịu trách nhiệm kiểm tra và hướng dẫn sinh viên</p></div></div>
                  <div className={styles.assignmentControl}><select aria-label="Chọn giảng viên phụ trách" disabled={!canReview || saving} value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">Chọn giảng viên phụ trách</option>{data?.lecturers.map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.fullName}{lecturer.lecturerCode ? ` · ${lecturer.lecturerCode}` : ""}</option>)}</select><button disabled={!canReview || !assignmentId || saving || assignmentId === detail.assignedLecturer?.id.toString()} onClick={() => void saveAssignment()} type="button">Lưu phân công</button></div>
                  {detail.assignedLecturer && <p className={styles.assignmentNote}><ShieldCheck size={15} /> {detail.assignedLecturer.fullName} · {detail.assignedLecturer.faculty || "Chưa cập nhật khoa"}</p>}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><GraduationCap /><div><h3>Thông tin sinh viên</h3><p>Hồ sơ học tập và thông tin liên hệ</p></div></div>
                  <div className={styles.infoGrid}><div><span>Họ và tên</span><strong>{detail.student.fullName}</strong></div><div><span>Mã sinh viên</span><strong>{detail.student.studentCode || "Chưa cập nhật"}</strong></div><div><span>Lớp / Khóa</span><strong>{detail.student.className || "Chưa cập nhật"}</strong></div><div><span>Ngành</span><strong>{detail.student.major || "Chưa cập nhật"}</strong></div><div><span>Khoa</span><strong>{detail.student.faculty || "Chưa cập nhật"}</strong></div><div><span>Email</span><strong>{detail.student.email}</strong></div></div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><Building2 /><div><h3>Doanh nghiệp và mentor</h3><p>Đơn vị tiếp nhận thực tập</p></div></div>
                  <div className={styles.company}><div><strong>{detail.company.name || "Chưa cập nhật doanh nghiệp"}</strong><span>{detail.company.industry || "Chưa cập nhật lĩnh vực"}</span></div>{detail.company.website && <a href={detail.company.website} rel="noreferrer" target="_blank">Mở website</a>}</div>
                  <div className={styles.contacts}><span><MapPin />{detail.company.address || "Chưa cập nhật địa chỉ"}</span><span><UserRound />{detail.mentor.fullName || "Chưa cập nhật mentor"}</span><span><Mail />{detail.mentor.email || "Chưa cập nhật email"}</span><span><Phone />{detail.mentor.phone || "Chưa cập nhật điện thoại"}</span></div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><BriefcaseBusiness /><div><h3>Nội dung đăng ký</h3><p>Vị trí, thời gian và mô tả công việc</p></div></div>
                  <div className={styles.infoGrid}><div><span>Vị trí thực tập</span><strong>{detail.internshipPosition || "Chưa cập nhật"}</strong></div><div><span>Hình thức</span><strong>{workMode(detail.workMode)}</strong></div><div><span>Số tín chỉ</span><strong>{detail.credits ?? "Chưa cập nhật"}</strong></div><div><span>Đợt thực tập</span><strong>{detail.period?.name || "Chưa cập nhật"}</strong></div><div><span>Bắt đầu</span><strong>{dateOnly(detail.startDate)}</strong></div><div><span>Kết thúc</span><strong>{dateOnly(detail.endDate)}</strong></div></div>
                  <div className={styles.description}><span>Mô tả công việc</span><p>{detail.description?.trim() || "Sinh viên chưa cung cấp mô tả công việc."}</p></div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}><FileText /><div><h3>Tài liệu hồ sơ</h3><p>{detail.documents.length} tài liệu đính kèm</p></div></div>
                  <div className={styles.documents}>{detail.documents.map((document) => <article key={document.id}><FileText /><span><strong>{documentLabel(document.documentType)}</strong><small>{document.originalFileName} · {fileSize(document.fileSize)}</small></span><button aria-label="Xem tài liệu" onClick={() => void openDocument(document.id, false)} type="button"><Eye /></button><button aria-label="Tải tài liệu" onClick={() => void openDocument(document.id, true)} type="button"><Download /></button></article>)}{!detail.documents.length && <p className={styles.noDocument}><AlertCircle size={17} /> Sinh viên chưa tải tài liệu lên.</p>}</div>
                </section>

                {canReview ? <section className={styles.reviewSection}>
                  <div className={styles.sectionTitle}><ClipboardCheck /><div><h3>Xét duyệt hồ sơ</h3><p>Kết quả và nhận xét sẽ được gửi cho sinh viên</p></div></div>
                  {detail.status === "SUBMITTED" && <button className={styles.reviewingButton} disabled={saving || !detail.assignedLecturer} onClick={() => void markUnderReview()} type="button"><Eye size={16} /> Bắt đầu xem xét</button>}
                  <div className={styles.decisionTabs}><button className={decision === "APPROVED" ? styles.approveActive : ""} onClick={() => setDecision("APPROVED")} type="button"><CheckCircle2 /> Phê duyệt</button><button className={decision === "REJECTED" ? styles.rejectActive : ""} onClick={() => setDecision("REJECTED")} type="button"><XCircle /> Từ chối</button></div>
                  <label className={styles.comment}><span>{decision === "REJECTED" ? "Lý do từ chối *" : "Nhận xét cho sinh viên"}</span><textarea maxLength={5000} placeholder={decision === "REJECTED" ? "Nêu rõ nội dung sinh viên cần bổ sung hoặc điều chỉnh..." : "Ghi chú xét duyệt (không bắt buộc)..."} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
                  <button className={decision === "APPROVED" ? styles.approveButton : styles.rejectButton} disabled={saving || !detail.assignedLecturer} onClick={() => void submitDecision()} type="button">{saving && <Loader2 className={styles.spin} />} {decision === "APPROVED" ? "Duyệt và tạo kỳ thực tập" : "Xác nhận từ chối"}</button>
                  {!detail.assignedLecturer && <p className={styles.warning}><AlertCircle size={15} /> Hãy phân công giảng viên trước khi xét duyệt.</p>}
                </section> : <section className={styles.result}><CheckCircle2 /><div><h3>Kết quả đã được ghi nhận</h3><p>{detail.lecturerComment || "Không có nhận xét bổ sung."}</p>{detail.internshipId && <strong>Mã kỳ thực tập: #{detail.internshipId}</strong>}</div></section>}
                {actionMessage && <p className={styles.actionMessage}>{actionMessage}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
