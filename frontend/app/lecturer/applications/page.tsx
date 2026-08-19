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
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import { openAuthenticatedFile } from "@/lib/lecturerAuth";
import {
  applicationDocumentUrl,
  fetchLecturerApplicationDetail,
  fetchLecturerApplications,
  reviewLecturerApplication,
  type ApplicationDetail,
  type ApplicationListItem,
  type ApplicationStatus,
  type LecturerApplicationsResponse,
} from "@/lib/lecturerApplications";
import styles from "./page.module.css";

type Decision = "APPROVED" | "REJECTED";

function statusLabel(status: ApplicationStatus): string {
  const labels: Record<ApplicationStatus, string> = {
    SUBMITTED: "Mới gửi",
    UNDER_REVIEW: "Đang xem xét",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
  };
  return labels[status];
}

function workModeLabel(value: string | null): string {
  if (value === "ONSITE") return "Tại doanh nghiệp";
  if (value === "REMOTE") return "Từ xa";
  if (value === "HYBRID") return "Kết hợp";
  return "Chưa cập nhật";
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN").format(date);
}

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function documentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CV: "CV cá nhân",
    OFFER_LETTER: "Thư tiếp nhận",
    JOB_DESCRIPTION: "Mô tả công việc",
    OTHER: "Tài liệu khác",
  };
  return labels[type] || type;
}

export default function LecturerApplicationsPage() {
  const [data, setData] = useState<LecturerApplicationsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ApplicationStatus>("ALL");
  const [periodId, setPeriodId] = useState("ALL");
  const [workMode, setWorkMode] = useState("ALL");
  const [decision, setDecision] = useState<Decision>("APPROVED");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const openApplication = useCallback(async (applicationId: number) => {
    try {
      setSelectedId(applicationId);
      setLoadingDetail(true);
      setDetailError("");
      setActionMessage("");
      const application = await fetchLecturerApplicationDetail(applicationId);
      setDetail(application);
      setComment(application.lecturerComment ?? "");
      setDecision(application.status === "REJECTED" ? "REJECTED" : "APPROVED");
    } catch (loadError) {
      setDetail(null);
      setDetailError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải chi tiết hồ sơ.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await fetchLecturerApplications();
      setData(result);
      const firstId = result.applications[0]?.applicationId ?? null;
      setSelectedId(firstId);
      if (firstId) await openApplication(firstId);
      else setDetail(null);
    } catch (loadError) {
      setData(null);
      setDetail(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách hồ sơ.",
      );
    } finally {
      setLoading(false);
    }
  }, [openApplication]);

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadApplications();
  }, [loadApplications]);

  const filteredApplications = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.applications ?? []).filter((application) => {
      const haystack = [
        application.studentName,
        application.studentCode,
        application.companyName,
        application.internshipPosition,
        application.major,
        application.className,
      ].join(" ").toLocaleLowerCase("vi");

      return (!keyword || haystack.includes(keyword))
        && (status === "ALL" || application.status === status)
        && (periodId === "ALL" || application.periodId === Number(periodId))
        && (workMode === "ALL" || application.workMode === workMode);
    });
  }, [data, periodId, search, status, workMode]);

  async function refreshAfterAction(applicationId: number) {
    const [result, application] = await Promise.all([
      fetchLecturerApplications(),
      fetchLecturerApplicationDetail(applicationId),
    ]);
    setData(result);
    setDetail(application);
    setComment(application.lecturerComment ?? "");
  }

  async function markUnderReview() {
    if (!detail) return;
    try {
      setSaving(true);
      setActionMessage("");
      await reviewLecturerApplication(detail.applicationId, "UNDER_REVIEW", comment);
      await refreshAfterAction(detail.applicationId);
      setActionMessage("Đã chuyển hồ sơ sang trạng thái đang xem xét.");
    } catch (saveError) {
      setActionMessage(saveError instanceof Error ? saveError.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  async function submitDecision() {
    if (!detail) return;
    if (decision === "REJECTED" && !comment.trim()) {
      setActionMessage("Vui lòng nhập lý do từ chối hồ sơ.");
      return;
    }

    const message = decision === "APPROVED"
      ? "Duyệt hồ sơ này và tạo kỳ thực tập cho sinh viên?"
      : "Xác nhận từ chối hồ sơ và gửi lý do cho sinh viên?";
    if (!window.confirm(message)) return;

    try {
      setSaving(true);
      setActionMessage("");
      await reviewLecturerApplication(detail.applicationId, decision, comment);
      await refreshAfterAction(detail.applicationId);
      setActionMessage(
        decision === "APPROVED"
          ? "Đã duyệt hồ sơ và tạo kỳ thực tập cho sinh viên."
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
      await openAuthenticatedFile(
        applicationDocumentUrl(detail.applicationId, documentId, download),
        download,
      );
    } catch (openError) {
      setActionMessage(openError instanceof Error ? openError.message : "Không thể mở tài liệu.");
    }
  }

  const canReview = detail?.status === "SUBMITTED" || detail?.status === "UNDER_REVIEW";
  const summary = data?.summary;

  return (
    <LecturerShell title="Hồ sơ đăng ký">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>XÉT DUYỆT THỰC TẬP</p>
            <h1>Hồ sơ đăng ký</h1>
            <p>Kiểm tra thông tin, tài liệu và quyết định tiếp nhận hồ sơ.</p>
          </div>
          <button className={styles.refreshButton} disabled={loading} onClick={loadApplications} type="button">
            {loading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />}
            Làm mới
          </button>
        </header>

        <section className={styles.summaryGrid}>
          <button onClick={() => setStatus("ALL")} type="button"><ClipboardCheck size={20} /><span>Tổng hồ sơ<strong>{summary?.total ?? 0}</strong></span></button>
          <button onClick={() => setStatus("SUBMITTED")} type="button"><Clock3 size={20} /><span>Mới gửi<strong>{summary?.submitted ?? 0}</strong></span></button>
          <button onClick={() => setStatus("UNDER_REVIEW")} type="button"><Eye size={20} /><span>Đang xem xét<strong>{summary?.underReview ?? 0}</strong></span></button>
          <button onClick={() => setStatus("APPROVED")} type="button"><CheckCircle2 size={20} /><span>Đã duyệt<strong>{summary?.approved ?? 0}</strong></span></button>
          <button onClick={() => setStatus("REJECTED")} type="button"><XCircle size={20} /><span>Từ chối<strong>{summary?.rejected ?? 0}</strong></span></button>
        </section>

        <section className={styles.filterBand}>
          <div className={styles.searchBox}><Search size={17} /><input aria-label="Tìm hồ sơ" placeholder="Tên, mã sinh viên, doanh nghiệp, vị trí..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <label><Filter size={15} /><select aria-label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as "ALL" | ApplicationStatus)}><option value="ALL">Tất cả trạng thái</option><option value="SUBMITTED">Mới gửi</option><option value="UNDER_REVIEW">Đang xem xét</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option></select></label>
          <label><select aria-label="Đợt thực tập" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="ALL">Tất cả đợt</option>{data?.periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.semesterCode}</option>)}</select></label>
          <label><select aria-label="Hình thức làm việc" value={workMode} onChange={(event) => setWorkMode(event.target.value)}><option value="ALL">Tất cả hình thức</option><option value="ONSITE">Tại doanh nghiệp</option><option value="REMOTE">Từ xa</option><option value="HYBRID">Kết hợp</option></select></label>
        </section>

        {loading && <section className={styles.statePanel}><Loader2 className={styles.spin} size={30} /><p>Đang tải hồ sơ đăng ký...</p></section>}
        {!loading && error && <section className={`${styles.statePanel} ${styles.errorState}`}><AlertCircle size={32} /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={loadApplications} type="button">Thử lại</button></section>}

        {!loading && !error && (
          <div className={styles.workspace}>
            <section className={styles.listPanel}>
              <header><div><h2>Danh sách hồ sơ</h2><p>{filteredApplications.length} hồ sơ phù hợp</p></div></header>
              <div className={styles.applicationList}>
                {filteredApplications.map((application: ApplicationListItem) => (
                  <button className={`${styles.applicationRow} ${selectedId === application.applicationId ? styles.applicationRowActive : ""}`} key={application.applicationId} onClick={() => void openApplication(application.applicationId)} type="button">
                    <div className={styles.rowTop}><span className={styles.avatar}>{application.studentName.trim().charAt(0).toUpperCase()}</span><span className={styles.studentName}><strong>{application.studentName}</strong><small>{application.studentCode} · {application.className || "Chưa có lớp/khóa"}</small></span><span className={`${styles.statusBadge} ${styles[`status${application.status}`]}`}>{statusLabel(application.status)}</span></div>
                    <h3>{application.internshipPosition || "Chưa cập nhật vị trí"}</h3>
                    <p>{application.companyName || "Chưa cập nhật doanh nghiệp"}</p>
                    <div className={styles.rowMeta}><span><CalendarDays size={13} />{formatDateTime(application.submittedAt)}</span><span><FileText size={13} />{application.documentCount} tài liệu</span></div>
                  </button>
                ))}
                {filteredApplications.length === 0 && <div className={styles.emptyList}><ClipboardCheck size={29} /><p>Không có hồ sơ phù hợp bộ lọc.</p></div>}
              </div>
            </section>

            <section className={styles.detailPanel}>
              {loadingDetail && <div className={styles.detailLoading}><Loader2 className={styles.spin} size={24} />Đang tải chi tiết hồ sơ...</div>}
              {detailError && <div className={styles.inlineError}><AlertCircle size={17} />{detailError}</div>}
              {!detail && !loadingDetail && <div className={styles.emptyDetail}><ClipboardCheck size={34} /><p>Chưa có hồ sơ để hiển thị.</p></div>}

              {detail && (
                <>
                  <header className={styles.detailHeader}>
                    <div><p>HỒ SƠ #{detail.applicationId}</p><h2>{detail.student.fullName}</h2><span>Gửi lúc {formatDateTime(detail.submittedAt)}</span></div>
                    <span className={`${styles.statusBadge} ${styles[`status${detail.status}`]}`}>{statusLabel(detail.status)}</span>
                  </header>

                  <section className={styles.infoSection}>
                    <div className={styles.sectionHeading}><GraduationCap size={19} /><div><h3>Thông tin sinh viên</h3><p>Thông tin học tập và liên hệ</p></div></div>
                    <div className={styles.infoGrid}>
                      <div><span>Họ và tên</span><strong>{detail.student.fullName}</strong></div>
                      <div><span>Mã sinh viên</span><strong>{detail.student.studentCode || "Chưa cập nhật"}</strong></div>
                      <div><span>Lớp / Khóa</span><strong>{detail.student.className || "Chưa cập nhật"}</strong></div>
                      <div><span>Ngành</span><strong>{detail.student.major || "Chưa cập nhật"}</strong></div>
                      <div><span>Khoa</span><strong>{detail.student.faculty || "Chưa cập nhật"}</strong></div>
                      <div><span>Email</span><strong>{detail.student.email}</strong></div>
                      <div><span>Điện thoại</span><strong>{detail.student.phone || "Chưa cập nhật"}</strong></div>
                    </div>
                  </section>

                  <section className={styles.infoSection}>
                    <div className={styles.sectionHeading}><Building2 size={19} /><div><h3>Doanh nghiệp và mentor</h3><p>Đơn vị tiếp nhận sinh viên</p></div></div>
                    <div className={styles.companyHeader}><div><strong>{detail.company.name || "Chưa cập nhật doanh nghiệp"}</strong><span>{detail.company.industry || "Chưa cập nhật lĩnh vực"}</span></div>{detail.company.website && <a href={detail.company.website} rel="noreferrer" target="_blank">Website</a>}</div>
                    <div className={styles.contactGrid}>
                      <div><MapPin size={15} /><span>{detail.company.address || "Chưa cập nhật địa chỉ"}</span></div>
                      <div><UserRound size={15} /><span><strong>{detail.mentor.fullName || "Chưa cập nhật mentor"}</strong>{detail.mentor.position ? ` · ${detail.mentor.position}` : ""}</span></div>
                      <div><Mail size={15} /><span>{detail.mentor.email || "Chưa cập nhật email mentor"}</span></div>
                      <div><Phone size={15} /><span>{detail.mentor.phone || "Chưa cập nhật điện thoại mentor"}</span></div>
                    </div>
                  </section>

                  <section className={styles.infoSection}>
                    <div className={styles.sectionHeading}><BriefcaseBusiness size={19} /><div><h3>Nội dung đăng ký thực tập</h3><p>Vị trí, thời gian và mô tả công việc</p></div></div>
                    <div className={styles.registrationGrid}>
                      <div><span>Vị trí thực tập</span><strong>{detail.internshipPosition || "Chưa cập nhật"}</strong></div>
                      <div><span>Hình thức</span><strong>{workModeLabel(detail.workMode)}</strong></div>
                      <div><span>Số tín chỉ</span><strong>{detail.credits ?? "Chưa cập nhật"}</strong></div>
                      <div><span>Đợt thực tập</span><strong>{detail.period?.name || "Chưa cập nhật"}</strong></div>
                      <div><span>Bắt đầu</span><strong>{formatDate(detail.startDate)}</strong></div>
                      <div><span>Kết thúc</span><strong>{formatDate(detail.endDate)}</strong></div>
                    </div>
                    <div className={styles.description}><span>Mô tả công việc</span><p>{detail.description?.trim() || "Sinh viên chưa cung cấp mô tả công việc."}</p></div>
                  </section>

                  <section className={styles.infoSection}>
                    <div className={styles.sectionHeading}><FileText size={19} /><div><h3>Tài liệu hồ sơ</h3><p>{detail.documents.length} tài liệu đính kèm</p></div></div>
                    <div className={styles.documents}>
                      {detail.documents.map((document) => <article key={document.id}><FileText size={18} /><span><strong>{documentTypeLabel(document.documentType)}</strong><small>{document.originalFileName} · {formatFileSize(document.fileSize)}</small></span><button title="Xem tài liệu" onClick={() => openDocument(document.id, false)} type="button"><Eye size={16} /></button><button title="Tải tài liệu" onClick={() => openDocument(document.id, true)} type="button"><Download size={16} /></button></article>)}
                      {detail.documents.length === 0 && <div className={styles.noDocuments}><AlertCircle size={18} /><span>Sinh viên chưa tải tài liệu lên cho hồ sơ này.</span></div>}
                    </div>
                  </section>

                  {canReview ? <section className={styles.reviewSection}>
                    <div className={styles.sectionHeading}><ClipboardCheck size={19} /><div><h3>Xét duyệt hồ sơ</h3><p>Kết quả sẽ được gửi thông báo cho sinh viên</p></div></div>
                    {detail.status === "SUBMITTED" && <button className={styles.reviewingButton} disabled={saving} onClick={() => void markUnderReview()} type="button"><Eye size={16} />Bắt đầu xem xét</button>}
                    <div className={styles.decisionControl}><button className={decision === "APPROVED" ? styles.approveActive : ""} onClick={() => setDecision("APPROVED")} type="button"><CheckCircle2 size={16} />Phê duyệt</button><button className={decision === "REJECTED" ? styles.rejectActive : ""} onClick={() => setDecision("REJECTED")} type="button"><XCircle size={16} />Từ chối</button></div>
                    <label className={styles.commentField}><span>{decision === "REJECTED" ? "Lý do từ chối (bắt buộc)" : "Nhận xét của giảng viên"}</span><textarea maxLength={5000} placeholder={decision === "REJECTED" ? "Nêu rõ nội dung sinh viên cần điều chỉnh..." : "Nhập nhận xét nếu cần..."} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
                    {actionMessage && <p className={actionMessage.startsWith("Đã") ? styles.successMessage : styles.formError}>{actionMessage}</p>}
                    <button className={decision === "APPROVED" ? styles.submitApprove : styles.submitReject} disabled={saving} onClick={() => void submitDecision()} type="button">{saving ? <Loader2 className={styles.spin} size={17} /> : decision === "APPROVED" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}{decision === "APPROVED" ? "Duyệt hồ sơ" : "Xác nhận từ chối"}</button>
                  </section> : <section className={styles.resultSection}><div className={styles.sectionHeading}>{detail.status === "APPROVED" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}<div><h3>{detail.status === "APPROVED" ? "Hồ sơ đã được phê duyệt" : "Hồ sơ đã bị từ chối"}</h3><p>Xử lý lúc {formatDateTime(detail.reviewedAt)}</p></div></div>{detail.lecturerComment && <div className={styles.savedComment}><span>Nhận xét của giảng viên</span><p>{detail.lecturerComment}</p></div>}{detail.internshipId && <p className={styles.internshipCreated}>Đã tạo kỳ thực tập #{detail.internshipId} cho sinh viên.</p>}</section>}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </LecturerShell>
  );
}
