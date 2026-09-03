"use client";

import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adminReportsApi,
  openAdminReportFile,
  type AdminReport,
  type AdminReportComment,
  type AdminReportsResponse,
  type ReportSubmissionStatus,
  type ReportType,
  type ReportWorkflowStatus,
} from "@/services/admin-reports.service";

import styles from "./page.module.css";

type SubmissionFilter = "ALL" | ReportSubmissionStatus;
type WorkflowFilter = "ALL" | "PENDING_REVIEW" | ReportWorkflowStatus;

const reportTypeLabels: Record<ReportType, string> = {
  WEEKLY: "Báo cáo tuần",
  MIDTERM: "Báo cáo giữa kỳ",
  FINAL: "Báo cáo cuối kỳ",
  REFLECTION: "Báo cáo tổng kết",
};

const submissionLabels: Record<ReportSubmissionStatus, string> = {
  UPCOMING: "Chưa đến hạn",
  NOT_SUBMITTED: "Quá hạn chưa nộp",
  DRAFT: "Bản nháp",
  ON_TIME: "Nộp đúng hạn",
  LATE: "Nộp muộn",
};

function workflowLabel(status: ReportWorkflowStatus | null): string {
  if (!status) return "Chưa có bản nộp";
  return ({
    DRAFT: "Bản nháp",
    SUBMITTED: "Chờ đánh giá",
    LATE: "Chờ đánh giá",
    UNDER_REVIEW: "Đang đánh giá",
    REVISION_REQUIRED: "Cần chỉnh sửa",
    APPROVED: "Đã duyệt",
  } as Record<ReportWorkflowStatus, string>)[status];
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

function formatLate(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days) return `${days} ngày ${hours} giờ`;
  if (hours) return `${hours} giờ ${rest} phút`;
  return `${rest} phút`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reportKey(report: AdminReport): string {
  return report.reportId
    ? `report-${report.reportId}`
    : `schedule-${report.scheduleId}-${report.internshipId}`;
}

function isPending(status: ReportWorkflowStatus | null): boolean {
  return status === "SUBMITTED" || status === "LATE" || status === "UNDER_REVIEW";
}

export default function AdminReportsPage() {
  const [data, setData] = useState<AdminReportsResponse | null>(null);
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [comments, setComments] = useState<AdminReportComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [periodId, setPeriodId] = useState("ALL");
  const [lecturerId, setLecturerId] = useState("ALL");
  const [submission, setSubmission] = useState<SubmissionFilter>("ALL");
  const [workflow, setWorkflow] = useState<WorkflowFilter>("ALL");
  const [reportType, setReportType] = useState<"ALL" | ReportType>("ALL");

  const openReport = useCallback(async (report: AdminReport) => {
    setSelected(report);
    setComments([]);
    setDetailError("");
    if (!report.reportId) return;
    setLoadingDetail(true);
    try {
      const detail = await adminReportsApi.detail(report.reportId);
      setSelected(detail.report);
      setComments(detail.comments);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "Không thể tải chi tiết báo cáo.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminReportsApi.list();
      setData(result);
      const first = result.reports[0] ?? null;
      if (first) await openReport(first);
      else setSelected(null);
    } catch (loadError) {
      setData(null);
      setSelected(null);
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu báo cáo.");
    } finally {
      setLoading(false);
    }
  }, [openReport]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadReports]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.reports ?? []).filter((report) => {
      const haystack = [
        report.studentName,
        report.studentCode,
        report.title,
        report.companyName,
        report.className,
        report.major,
        report.assignedLecturer?.fullName ?? "",
      ].join(" ").toLocaleLowerCase("vi");
      const workflowMatch = workflow === "ALL"
        || (workflow === "PENDING_REVIEW" ? isPending(report.workflowStatus) : report.workflowStatus === workflow);
      return (!keyword || haystack.includes(keyword))
        && (periodId === "ALL" || report.periodId === Number(periodId))
        && (lecturerId === "ALL" || report.assignedLecturer?.id === Number(lecturerId))
        && (submission === "ALL" || report.submissionStatus === submission)
        && workflowMatch
        && (reportType === "ALL" || report.reportType === reportType);
    });
  }, [data, lecturerId, periodId, reportType, search, submission, workflow]);

  async function openFile(kind: "report" | "completion-letter", download: boolean) {
    if (!selected?.reportId) return;
    try {
      await openAdminReportFile(selected.reportId, kind, download);
    } catch (openError) {
      setDetailError(openError instanceof Error ? openError.message : "Không thể mở tệp báo cáo.");
    }
  }

  const summary = data?.summary;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}><BarChart3 size={15} /> GIÁM SÁT THỰC TẬP</span><h1>Báo cáo thực tập</h1><p>Theo dõi tiến độ nộp, đánh giá và kết quả báo cáo của toàn bộ sinh viên.</p></div>
        <button className={styles.refreshButton} disabled={loading} onClick={() => void loadReports()} type="button">{loading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />} Làm mới</button>
      </header>

      <section className={styles.summaryGrid}>
        <button onClick={() => { setSubmission("ALL"); setWorkflow("ALL"); }} type="button"><FileText /><span>Tổng kỳ báo cáo<strong>{summary?.total ?? 0}</strong></span></button>
        <button onClick={() => setSubmission("ON_TIME")} type="button"><CheckCircle2 /><span>Nộp đúng hạn<strong>{summary?.onTime ?? 0}</strong></span></button>
        <button onClick={() => setSubmission("LATE")} type="button"><Clock3 /><span>Nộp muộn<strong>{summary?.late ?? 0}</strong></span></button>
        <button onClick={() => setSubmission("NOT_SUBMITTED")} type="button"><AlertCircle /><span>Quá hạn chưa nộp<strong>{summary?.overdue ?? 0}</strong></span></button>
        <button onClick={() => setWorkflow("PENDING_REVIEW")} type="button"><Star /><span>Chờ đánh giá<strong>{summary?.pendingReview ?? 0}</strong></span></button>
        <button onClick={() => setWorkflow("APPROVED")} type="button"><FileCheck2 /><span>Điểm trung bình<strong>{summary?.averageScore?.toFixed(2) ?? "—"}</strong></span></button>
      </section>

      <section className={styles.insightBand}>
        <div><UsersRound /><span><strong>{summary?.students ?? 0}</strong> sinh viên đang được theo dõi</span></div>
        <div><FileCheck2 /><span><strong>{summary?.approved ?? 0}</strong> báo cáo đã duyệt</span></div>
        <div><AlertCircle /><span><strong>{summary?.revisionRequired ?? 0}</strong> báo cáo cần chỉnh sửa</span></div>
      </section>

      <section className={styles.filters}>
        <label className={styles.searchBox}><Search size={17} /><input aria-label="Tìm báo cáo" placeholder="Tên, mã sinh viên, báo cáo, doanh nghiệp..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><Filter size={15} /><select aria-label="Đợt thực tập" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="ALL">Tất cả đợt</option>{data?.periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.semesterCode}</option>)}</select></label>
        <label><select aria-label="Giảng viên" value={lecturerId} onChange={(event) => setLecturerId(event.target.value)}><option value="ALL">Tất cả giảng viên</option>{data?.lecturers.map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.fullName}</option>)}</select></label>
        <label><select aria-label="Tình trạng nộp" value={submission} onChange={(event) => setSubmission(event.target.value as SubmissionFilter)}><option value="ALL">Tất cả tình trạng</option><option value="ON_TIME">Nộp đúng hạn</option><option value="LATE">Nộp muộn</option><option value="NOT_SUBMITTED">Quá hạn chưa nộp</option><option value="DRAFT">Bản nháp</option><option value="UPCOMING">Chưa đến hạn</option></select></label>
        <label><select aria-label="Trạng thái đánh giá" value={workflow} onChange={(event) => setWorkflow(event.target.value as WorkflowFilter)}><option value="ALL">Tất cả đánh giá</option><option value="PENDING_REVIEW">Chờ đánh giá</option><option value="REVISION_REQUIRED">Cần chỉnh sửa</option><option value="APPROVED">Đã duyệt</option></select></label>
        <label><select aria-label="Loại báo cáo" value={reportType} onChange={(event) => setReportType(event.target.value as "ALL" | ReportType)}><option value="ALL">Tất cả loại báo cáo</option><option value="WEEKLY">Hàng tuần</option><option value="MIDTERM">Giữa kỳ</option><option value="FINAL">Cuối kỳ</option><option value="REFLECTION">Tổng kết</option></select></label>
      </section>

      {loading && <section className={styles.state}><Loader2 className={styles.spin} /><p>Đang tổng hợp báo cáo toàn hệ thống...</p></section>}
      {!loading && error && <section className={`${styles.state} ${styles.error}`}><AlertCircle /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={() => void loadReports()} type="button">Thử lại</button></section>}

      {!loading && !error && <div className={styles.workspace}>
        <section className={styles.listPanel}>
          <header><div><h2>Danh sách báo cáo</h2><p>{filtered.length} mục phù hợp bộ lọc</p></div></header>
          <div className={styles.reportList}>
            {filtered.map((report) => <button className={`${styles.reportRow} ${selected && reportKey(selected) === reportKey(report) ? styles.rowActive : ""}`} key={reportKey(report)} onClick={() => void openReport(report)} type="button">
              <div className={styles.rowHead}><span className={styles.avatar}>{report.studentName.trim().charAt(0).toUpperCase()}</span><span className={styles.student}><strong>{report.studentName}</strong><small>{report.studentCode} · {report.className || "Chưa có lớp"}</small></span><span className={`${styles.submissionBadge} ${styles[`submission${report.submissionStatus}`]}`}>{submissionLabels[report.submissionStatus]}</span></div>
              <h3>{report.title}</h3><p>{reportTypeLabels[report.reportType]}{report.weekNumber ? ` · Tuần ${report.weekNumber}` : ""}</p>
              <div className={styles.lecturer}><GraduationCap size={13} />{report.assignedLecturer?.fullName || "Chưa phân công giảng viên"}</div>
              <div className={styles.rowMeta}><span><CalendarClock size={13} />{formatDateTime(report.dueAt)}</span><span className={isPending(report.workflowStatus) ? styles.pending : ""}>{workflowLabel(report.workflowStatus)}</span></div>
            </button>)}
            {!filtered.length && <div className={styles.empty}><FileText /><p>Không có báo cáo phù hợp bộ lọc.</p></div>}
          </div>
        </section>

        <section className={styles.detailPanel}>
          {!selected && <div className={styles.empty}><FileText /><p>Chọn một báo cáo để xem chi tiết.</p></div>}
          {selected && <>
            <header className={styles.detailHeader}><div><p>{reportTypeLabels[selected.reportType]}{selected.weekNumber ? ` · Tuần ${selected.weekNumber}` : ""}</p><h2>{selected.title}</h2></div><span className={`${styles.submissionBadge} ${styles[`submission${selected.submissionStatus}`]}`}>{submissionLabels[selected.submissionStatus]}</span></header>
            {loadingDetail && <div className={styles.detailLoading}><Loader2 className={styles.spin} /> Đang tải chi tiết...</div>}
            {detailError && <div className={styles.inlineError}><AlertCircle />{detailError}</div>}

            <section className={styles.studentStrip}><UserRound /><div><span>Sinh viên</span><strong>{selected.studentName}</strong><small>{selected.studentCode} · {selected.className || "Chưa có lớp"} · {selected.major || "Chưa có ngành"}</small></div><div><span>Doanh nghiệp</span><strong>{selected.companyName || "Chưa cập nhật"}</strong><small>{selected.positionTitle || "Chưa cập nhật vị trí"}</small></div><div><span>Đợt thực tập</span><strong>{selected.periodName || "Chưa cập nhật"}</strong><small>{selected.semesterCode} · {selected.academicYear}</small></div></section>

            <section className={styles.supervisor}><GraduationCap /><div><span>Giảng viên phụ trách</span><strong>{selected.assignedLecturer?.fullName || "Chưa phân công"}</strong><small>{selected.assignedLecturer ? `${selected.assignedLecturer.lecturerCode || "Chưa có mã"} · ${selected.assignedLecturer.faculty || "Chưa cập nhật khoa"}` : "Hồ sơ cần được phân công giảng viên"}</small></div></section>

            <section className={styles.timeline}><div><span>Hạn nộp</span><strong>{formatDateTime(selected.dueAt)}</strong></div><div><span>Thời gian nộp</span><strong>{formatDateTime(selected.submittedAt)}</strong></div><div><span>Thời gian đánh giá</span><strong>{formatDateTime(selected.reviewedAt)}</strong></div></section>

            {selected.submissionStatus === "LATE" && <div className={styles.noticeLate}><Clock3 /><div><strong>Nộp muộn {formatLate(selected.lateByMinutes)}</strong><span>Thời gian được tính từ hạn nộp đến thời điểm sinh viên gửi báo cáo.</span></div></div>}
            {selected.submissionStatus === "NOT_SUBMITTED" && <div className={styles.noticeOverdue}><AlertCircle /><div><strong>Đã quá hạn nhưng chưa có bản nộp</strong><span>{selected.scheduleDescription || "Sinh viên chưa tạo hoặc chưa nộp báo cáo cho kỳ này."}</span></div></div>}

            <section className={styles.section}><div className={styles.sectionTitle}><FileText /><div><h3>Nội dung báo cáo</h3><p>Nội dung sinh viên đã khai báo trên hệ thống</p></div></div><div className={styles.content}>{selected.content?.trim() || selected.scheduleDescription || "Chưa có nội dung báo cáo."}</div></section>

            {selected.reportId && (selected.fileName || selected.completionLetterName) && <section className={styles.section}><div className={styles.sectionTitle}><Building2 /><div><h3>Tệp đính kèm</h3><p>Tài liệu báo cáo và xác nhận doanh nghiệp</p></div></div><div className={styles.attachments}>
              {selected.fileName && <article><FileText /><span><strong>{selected.fileName}</strong><small>{formatFileSize(selected.fileSize)} · {selected.mimeType || "Tệp báo cáo"}</small></span><button onClick={() => void openFile("report", false)} type="button"><Eye /> Xem</button><button onClick={() => void openFile("report", true)} type="button"><Download /> Tải</button></article>}
              {selected.completionLetterName && <article><FileCheck2 /><span><strong>{selected.completionLetterName}</strong><small>{formatFileSize(selected.completionLetterSize)} · Giấy xác nhận hoàn thành</small></span><button onClick={() => void openFile("completion-letter", false)} type="button"><Eye /> Xem</button><button onClick={() => void openFile("completion-letter", true)} type="button"><Download /> Tải</button></article>}
            </div></section>}

            <section className={styles.section}><div className={styles.sectionTitle}><Star /><div><h3>Kết quả đánh giá</h3><p>Được ghi nhận bởi giảng viên phụ trách</p></div></div><div className={styles.evaluation}><div><span>Trạng thái</span><strong>{workflowLabel(selected.workflowStatus)}</strong></div><div><span>Điểm số</span><strong className={styles.score}>{selected.lecturerScore === null ? "Chưa chấm" : `${selected.lecturerScore}/10`}</strong></div></div><div className={styles.feedback}><span>Nhận xét của giảng viên</span><p>{selected.lecturerFeedback || "Chưa có nhận xét đánh giá."}</p></div></section>

            <section className={styles.section}><div className={styles.sectionTitle}><MessageSquareText /><div><h3>Lịch sử trao đổi</h3><p>{comments.length} phản hồi trong báo cáo</p></div></div><div className={styles.comments}>{comments.map((comment) => <article key={comment.id}><div><strong>{comment.userName}</strong><span>{comment.userRole} · {formatDateTime(comment.createdAt)}</span></div><p>{comment.comment}</p></article>)}{!comments.length && <p className={styles.noComments}>Chưa có trao đổi cho báo cáo này.</p>}</div></section>
          </>}
        </section>
      </div>}
    </main>
  );
}
