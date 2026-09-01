"use client";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Star,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import { openAuthenticatedFile } from "@/lib/lecturerAuth";
import {
  addLecturerReportComment,
  fetchLecturerReportDetail,
  fetchLecturerReports,
  lecturerReportFileUrl,
  reviewLecturerReport,
  type LecturerReport,
  type LecturerReportComment,
  type LecturerReportsResponse,
  type ReportSubmissionStatus,
  type ReportType,
  type ReportWorkflowStatus,
} from "@/lib/lecturerReports";
import styles from "./page.module.css";

type SubmissionFilter = "ALL" | ReportSubmissionStatus;
type WorkflowFilter = "ALL" | "PENDING_REVIEW" | ReportWorkflowStatus;
type ReviewDecision = "APPROVED" | "REVISION_REQUIRED";

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

function formatLateDuration(minutes: number): string {
  if (minutes <= 0) return "";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${remainingMinutes} phút`;
  return `${remainingMinutes} phút`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reportTypeLabel(type: ReportType): string {
  const labels: Record<ReportType, string> = {
    WEEKLY: "Báo cáo tuần",
    MIDTERM: "Báo cáo giữa kỳ",
    FINAL: "Báo cáo cuối kỳ",
    REFLECTION: "Báo cáo tổng kết",
  };
  return labels[type];
}

function submissionLabel(status: ReportSubmissionStatus): string {
  const labels: Record<ReportSubmissionStatus, string> = {
    UPCOMING: "Chưa đến hạn",
    NOT_SUBMITTED: "Quá hạn chưa nộp",
    DRAFT: "Bản nháp",
    ON_TIME: "Nộp đúng hạn",
    LATE: "Nộp muộn",
  };
  return labels[status];
}

function workflowLabel(status: ReportWorkflowStatus | null): string {
  if (!status) return "Chưa có bản nộp";
  const labels: Record<ReportWorkflowStatus, string> = {
    DRAFT: "Bản nháp",
    SUBMITTED: "Chờ đánh giá",
    LATE: "Chờ đánh giá",
    UNDER_REVIEW: "Đang đánh giá",
    REVISION_REQUIRED: "Cần chỉnh sửa",
    APPROVED: "Đã duyệt",
  };
  return labels[status];
}

function reportKey(report: LecturerReport): string {
  return report.reportId
    ? `report-${report.reportId}`
    : `schedule-${report.scheduleId}-${report.internshipId}`;
}

function isPendingReview(status: ReportWorkflowStatus | null): boolean {
  return status === "SUBMITTED" || status === "LATE" || status === "UNDER_REVIEW";
}

export default function LecturerReportsPage() {
  const [data, setData] = useState<LecturerReportsResponse | null>(null);
  const [selected, setSelected] = useState<LecturerReport | null>(null);
  const [comments, setComments] = useState<LecturerReportComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("q");
    if (!query) return;

    const timeout = window.setTimeout(() => setSearch(query), 0);
    return () => window.clearTimeout(timeout);
  }, []);
  const [periodId, setPeriodId] = useState("ALL");
  const [submission, setSubmission] = useState<SubmissionFilter>("ALL");
  const [workflow, setWorkflow] = useState<WorkflowFilter>("ALL");
  const [reportType, setReportType] = useState<"ALL" | ReportType>("ALL");
  const [decision, setDecision] = useState<ReviewDecision>("APPROVED");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const applySelectedReport = useCallback((report: LecturerReport) => {
    setSelected(report);
    setScore(report.lecturerScore?.toString() ?? "");
    setFeedback(report.lecturerFeedback ?? "");
    setDecision(report.workflowStatus === "REVISION_REQUIRED" ? "REVISION_REQUIRED" : "APPROVED");
  }, []);

  const openReport = useCallback(async (report: LecturerReport) => {
    applySelectedReport(report);
    setComments([]);
    setDetailError("");
    setReviewMessage("");

    if (!report.reportId) return;
    try {
      setLoadingDetail(true);
      const detail = await fetchLecturerReportDetail(report.reportId);
      applySelectedReport(detail.report);
      setComments(detail.comments);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "Không thể tải chi tiết báo cáo.");
    } finally {
      setLoadingDetail(false);
    }
  }, [applySelectedReport]);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await fetchLecturerReports();
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
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.reports ?? []).filter((report) => {
      const haystack = [
        report.studentName,
        report.studentCode,
        report.title,
        report.companyName,
        report.className,
        report.major,
      ].join(" ").toLocaleLowerCase("vi");
      const matchesWorkflow = workflow === "ALL"
        || (workflow === "PENDING_REVIEW" ? isPendingReview(report.workflowStatus) : report.workflowStatus === workflow);
      return (!keyword || haystack.includes(keyword))
        && (periodId === "ALL" || report.periodId === Number(periodId))
        && (submission === "ALL" || report.submissionStatus === submission)
        && matchesWorkflow
        && (reportType === "ALL" || report.reportType === reportType);
    });
  }, [data, periodId, reportType, search, submission, workflow]);

  async function handleReview() {
    if (!selected?.reportId) return;
    const numericScore = score.trim() ? Number(score) : null;
    if (decision === "APPROVED" && (numericScore === null || numericScore < 0 || numericScore > 10)) {
      setReviewMessage("Điểm duyệt phải nằm trong khoảng 0 đến 10.");
      return;
    }
    if (decision === "REVISION_REQUIRED" && !feedback.trim()) {
      setReviewMessage("Vui lòng nhập phản hồi khi yêu cầu chỉnh sửa.");
      return;
    }

    try {
      setSavingReview(true);
      setReviewMessage("");
      await reviewLecturerReport(selected.reportId, {
        status: decision,
        score: decision === "APPROVED" ? numericScore : null,
        feedback: feedback.trim(),
      });
      const detail = await fetchLecturerReportDetail(selected.reportId);
      applySelectedReport(detail.report);
      setComments(detail.comments);
      setReviewMessage("Đã lưu đánh giá và gửi thông báo cho sinh viên.");
      const refreshed = await fetchLecturerReports();
      setData(refreshed);
    } catch (saveError) {
      setReviewMessage(saveError instanceof Error ? saveError.message : "Không thể lưu đánh giá.");
    } finally {
      setSavingReview(false);
    }
  }

  async function handleComment() {
    if (!selected?.reportId || !commentText.trim()) return;
    try {
      setSendingComment(true);
      setDetailError("");
      const created = await addLecturerReportComment(selected.reportId, commentText.trim());
      setComments((current) => [...current, created]);
      setCommentText("");
    } catch (sendError) {
      setDetailError(sendError instanceof Error ? sendError.message : "Không thể gửi trao đổi.");
    } finally {
      setSendingComment(false);
    }
  }

  async function openFile(kind: "report" | "completion-letter", download: boolean) {
    if (!selected?.reportId) return;
    try {
      await openAuthenticatedFile(
        lecturerReportFileUrl(selected.reportId, kind, download),
        download,
      );
    } catch (openError) {
      setDetailError(openError instanceof Error ? openError.message : "Không thể mở báo cáo.");
    }
  }

  const summary = data?.summary;

  return (
    <LecturerShell title="Nhật ký & Báo cáo">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>THEO DÕI THỰC TẬP</p>
            <h1>Nhật ký & Báo cáo</h1>
            <p>Kỳ nộp, thời gian nộp và trạng thái đánh giá.</p>
          </div>
          <button className={styles.refreshButton} disabled={loading} onClick={loadReports} type="button">
            {loading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />}
            Làm mới
          </button>
        </header>

        <section className={styles.summaryGrid}>
          <button onClick={() => setSubmission("ALL")} type="button"><FileText size={20} /><span>Tổng kỳ báo cáo<strong>{summary?.total ?? 0}</strong></span></button>
          <button onClick={() => setSubmission("ON_TIME")} type="button"><CheckCircle2 size={20} /><span>Nộp đúng hạn<strong>{summary?.onTime ?? 0}</strong></span></button>
          <button onClick={() => setSubmission("LATE")} type="button"><Clock3 size={20} /><span>Nộp muộn<strong>{summary?.late ?? 0}</strong></span></button>
          <button onClick={() => setSubmission("NOT_SUBMITTED")} type="button"><AlertCircle size={20} /><span>Quá hạn chưa nộp<strong>{summary?.overdue ?? 0}</strong></span></button>
          <button onClick={() => setWorkflow("PENDING_REVIEW")} type="button"><Star size={20} /><span>Chờ đánh giá<strong>{summary?.pendingReview ?? 0}</strong></span></button>
          <button onClick={() => setWorkflow("APPROVED")} type="button"><FileCheck2 size={20} /><span>Đã duyệt<strong>{summary?.approved ?? 0}</strong></span></button>
        </section>

        <section className={styles.filterBand}>
          <div className={styles.searchBox}><Search size={17} /><input aria-label="Tìm báo cáo" placeholder="Tên, mã sinh viên, báo cáo, doanh nghiệp..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <label><Filter size={15} /><select aria-label="Đợt thực tập" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="ALL">Tất cả đợt</option>{data?.periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.semesterCode}</option>)}</select></label>
          <label><select aria-label="Tình trạng nộp" value={submission} onChange={(event) => setSubmission(event.target.value as SubmissionFilter)}><option value="ALL">Tất cả tình trạng nộp</option><option value="ON_TIME">Nộp đúng hạn</option><option value="LATE">Nộp muộn</option><option value="NOT_SUBMITTED">Quá hạn chưa nộp</option><option value="DRAFT">Bản nháp</option><option value="UPCOMING">Chưa đến hạn</option></select></label>
          <label><select aria-label="Trạng thái đánh giá" value={workflow} onChange={(event) => setWorkflow(event.target.value as WorkflowFilter)}><option value="ALL">Tất cả đánh giá</option><option value="PENDING_REVIEW">Chờ đánh giá</option><option value="REVISION_REQUIRED">Cần chỉnh sửa</option><option value="APPROVED">Đã duyệt</option></select></label>
          <label><select aria-label="Loại báo cáo" value={reportType} onChange={(event) => setReportType(event.target.value as "ALL" | ReportType)}><option value="ALL">Tất cả loại</option><option value="WEEKLY">Hàng tuần</option><option value="MIDTERM">Giữa kỳ</option><option value="FINAL">Cuối kỳ</option><option value="REFLECTION">Tổng kết</option></select></label>
        </section>

        {loading && <section className={styles.statePanel}><Loader2 className={styles.spin} size={30} /><p>Đang tải nhật ký báo cáo...</p></section>}
        {!loading && error && <section className={`${styles.statePanel} ${styles.errorState}`}><AlertCircle size={32} /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={loadReports} type="button">Thử lại</button></section>}

        {!loading && !error && (
          <div className={styles.workspace}>
            <section className={styles.reportListPanel}>
              <header><div><h2>Danh sách báo cáo</h2><p>{filteredReports.length} mục phù hợp</p></div></header>
              <div className={styles.reportList}>
                {filteredReports.map((report) => (
                  <button className={`${styles.reportRow} ${selected && reportKey(selected) === reportKey(report) ? styles.reportRowActive : ""}`} key={reportKey(report)} onClick={() => void openReport(report)} type="button">
                    <div className={styles.reportRowTop}><span className={styles.studentAvatar}>{report.studentName.trim().charAt(0).toUpperCase()}</span><span className={styles.studentBlock}><strong>{report.studentName}</strong><small>{report.studentCode} · {report.className || "Chưa có lớp/khóa"}</small></span><span className={`${styles.submissionBadge} ${styles[`submission${report.submissionStatus}`]}`}>{submissionLabel(report.submissionStatus)}</span></div>
                    <h3>{report.title}</h3>
                    <p>{reportTypeLabel(report.reportType)}{report.weekNumber ? ` · Tuần ${report.weekNumber}` : ""}</p>
                    <div className={styles.rowMeta}><span><CalendarClock size={13} />{formatDateTime(report.dueAt)}</span><span className={isPendingReview(report.workflowStatus) ? styles.reviewPending : ""}>{workflowLabel(report.workflowStatus)}</span></div>
                  </button>
                ))}
                {filteredReports.length === 0 && <div className={styles.emptyList}><FileText size={28} /><p>Không có báo cáo phù hợp bộ lọc.</p></div>}
              </div>
            </section>

            <section className={styles.detailPanel}>
              {!selected && <div className={styles.emptyDetail}><FileText size={34} /><p>Chưa có báo cáo để hiển thị.</p></div>}
              {selected && (
                <>
                  <header className={styles.detailHeader}>
                    <div><p>{reportTypeLabel(selected.reportType)}{selected.weekNumber ? ` · Tuần ${selected.weekNumber}` : ""}</p><h2>{selected.title}</h2></div>
                    <span className={`${styles.submissionBadge} ${styles[`submission${selected.submissionStatus}`]}`}>{submissionLabel(selected.submissionStatus)}</span>
                  </header>

                  {loadingDetail && <div className={styles.detailLoading}><Loader2 className={styles.spin} size={23} />Đang tải chi tiết...</div>}
                  {detailError && <div className={styles.inlineError}><AlertCircle size={17} />{detailError}</div>}

                  <div className={styles.studentStrip}>
                    <UserRound size={20} />
                    <div><span>Sinh viên</span><strong>{selected.studentName}</strong><small>{selected.studentCode} · {selected.className || "Chưa có lớp/khóa"} · {selected.major || "Chưa có ngành"}</small></div>
                    <div><span>Doanh nghiệp</span><strong>{selected.companyName || "Chưa cập nhật"}</strong><small>{selected.positionTitle || "Chưa cập nhật vị trí"}</small></div>
                    <div><span>Đợt thực tập</span><strong>{selected.periodName || "Chưa cập nhật"}</strong><small>{selected.semesterCode} · {selected.academicYear}</small></div>
                  </div>

                  <div className={styles.timeline}>
                    <div><span>Hạn nộp</span><strong>{formatDateTime(selected.dueAt)}</strong></div>
                    <div><span>Thời gian nộp</span><strong>{formatDateTime(selected.submittedAt)}</strong></div>
                    <div><span>Thời gian đánh giá</span><strong>{formatDateTime(selected.reviewedAt)}</strong></div>
                  </div>

                  {selected.submissionStatus === "LATE" && <div className={styles.lateNotice}><Clock3 size={18} /><div><strong>Nộp muộn {formatLateDuration(selected.lateByMinutes)}</strong><span>So sánh trực tiếp thời gian nộp với hạn nộp.</span></div></div>}
                  {selected.submissionStatus === "NOT_SUBMITTED" && <div className={styles.overdueNotice}><AlertCircle size={18} /><div><strong>Đã quá hạn nhưng chưa có bản nộp</strong><span>{selected.scheduleDescription || "Sinh viên chưa tạo hoặc chưa nộp báo cáo cho kỳ này."}</span></div></div>}

                  <section className={styles.contentSection}>
                    <h3>Nội dung báo cáo</h3>
                    <div className={styles.reportContent}>{selected.content?.trim() || selected.scheduleDescription || "Chưa có nội dung báo cáo."}</div>
                  </section>

                  {selected.reportId && (selected.fileName || selected.completionLetterName) && (
                    <section className={styles.attachmentSection}>
                      <h3>Tệp đính kèm</h3>

                      {selected.fileName && (
                        <div className={styles.attachmentRow}>
                          <FileText size={18} />
                          <span>
                            <strong>{selected.fileName}</strong>
                            <small>
                              {formatFileSize(selected.fileSize)} · {selected.mimeType || "Tệp báo cáo"}
                            </small>
                          </span>
                          <div className={styles.attachmentActions}>
                            <button
                              aria-label={`Xem file báo cáo ${selected.fileName}`}
                              onClick={() => void openFile("report", false)}
                              title="Xem file báo cáo"
                              type="button"
                            >
                              <Eye size={16} />
                              Xem file báo cáo
                            </button>
                            <button
                              aria-label={`Tải file báo cáo ${selected.fileName}`}
                              onClick={() => void openFile("report", true)}
                              title="Tải file"
                              type="button"
                            >
                              <Download size={16} />
                              Tải file
                            </button>
                          </div>
                        </div>
                      )}

                      {selected.completionLetterName && (
                        <div className={styles.attachmentRow}>
                          <FileCheck2 size={18} />
                          <span>
                            <strong>{selected.completionLetterName}</strong>
                            <small>
                              {formatFileSize(selected.completionLetterSize)} · Giấy xác nhận hoàn thành
                            </small>
                          </span>
                          <div className={styles.attachmentActions}>
                            <button
                              aria-label={`Xem giấy xác nhận ${selected.completionLetterName}`}
                              onClick={() => void openFile("completion-letter", false)}
                              title="Xem giấy xác nhận"
                              type="button"
                            >
                              <Eye size={16} />
                              Xem giấy xác nhận
                            </button>
                            <button
                              aria-label={`Tải giấy xác nhận ${selected.completionLetterName}`}
                              onClick={() => void openFile("completion-letter", true)}
                              title="Tải giấy xác nhận"
                              type="button"
                            >
                              <Download size={16} />
                              Tải giấy xác nhận
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {selected.reportId && selected.submittedAt && <section className={styles.reviewSection}><div className={styles.sectionHeading}><div><h3>Đánh giá báo cáo</h3><p>{workflowLabel(selected.workflowStatus)}</p></div>{selected.lecturerScore !== null && <strong className={styles.scoreDisplay}>{selected.lecturerScore.toFixed(1)}/10</strong>}</div><div className={styles.decisionControl}><button className={decision === "APPROVED" ? styles.decisionActiveApprove : ""} onClick={() => setDecision("APPROVED")} type="button"><CheckCircle2 size={16} />Duyệt</button><button className={decision === "REVISION_REQUIRED" ? styles.decisionActiveRevision : ""} onClick={() => setDecision("REVISION_REQUIRED")} type="button"><XCircle size={16} />Yêu cầu sửa</button></div><div className={styles.reviewFields}>{decision === "APPROVED" && <label><span>Điểm (0-10)</span><input max="10" min="0" step="0.1" type="number" value={score} onChange={(event) => setScore(event.target.value)} /></label>}<label className={styles.feedbackField}><span>Phản hồi</span><textarea maxLength={5000} rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label></div>{reviewMessage && <p className={reviewMessage.startsWith("Đã lưu") ? styles.successMessage : styles.formError}>{reviewMessage}</p>}<button className={styles.saveReviewButton} disabled={savingReview} onClick={() => void handleReview()} type="button">{savingReview ? <Loader2 className={styles.spin} size={16} /> : <Star size={16} />}Lưu đánh giá</button></section>}

                  {selected.reportId && <section className={styles.commentSection}><div className={styles.sectionHeading}><div><h3>Trao đổi</h3><p>{comments.length} phản hồi</p></div><MessageSquareText size={19} /></div><div className={styles.comments}>{comments.map((comment) => <article key={comment.id}><div><strong>{comment.userName}</strong><span>{comment.userRole === "LECTURER" ? "Giảng viên" : "Sinh viên"} · {formatDateTime(comment.createdAt)}</span></div><p>{comment.comment}</p></article>)}{comments.length === 0 && <p className={styles.noComments}>Chưa có trao đổi cho báo cáo này.</p>}</div><div className={styles.commentComposer}><textarea aria-label="Nội dung trao đổi" maxLength={5000} placeholder="Nhập phản hồi cho sinh viên..." rows={3} value={commentText} onChange={(event) => setCommentText(event.target.value)} /><button disabled={sendingComment || !commentText.trim()} onClick={() => void handleComment()} title="Gửi phản hồi" type="button">{sendingComment ? <Loader2 className={styles.spin} size={17} /> : <Send size={17} />}</button></div></section>}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </LecturerShell>
  );
}
