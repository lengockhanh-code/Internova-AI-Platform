"use client";

import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Hourglass,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Send,
  Star,
  Target,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import {
  fetchLecturerEvaluationDetail,
  fetchLecturerEvaluations,
  saveLecturerEvaluation,
  type EvaluationDisplayStatus,
  type EvaluationStatus,
  type EvaluationType,
  type LecturerEvaluationDetail,
  type LecturerEvaluationItem,
  type LecturerEvaluationsResponse,
} from "@/lib/lecturerEvaluations";
import styles from "./page.module.css";

type StatusFilter = "ALL" | EvaluationDisplayStatus;

function statusLabel(status: EvaluationDisplayStatus): string {
  return {
    NOT_STARTED: "Chưa đánh giá",
    DRAFT: "Bản nháp",
    SUBMITTED: "Đã nộp",
    CONFIRMED: "Đã xác nhận",
  }[status];
}

function evaluationTypeLabel(type: EvaluationType): string {
  return type === "MIDTERM" ? "Giữa kỳ" : "Cuối kỳ";
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

function reportTypeLabel(type: string, week: number | null): string {
  if (type === "WEEKLY") return week ? `Báo cáo tuần ${week}` : "Báo cáo tuần";
  if (type === "MIDTERM") return "Báo cáo giữa kỳ";
  if (type === "FINAL") return "Báo cáo cuối kỳ";
  if (type === "REFLECTION") return "Báo cáo tổng kết";
  return "Báo cáo thực tập";
}

function evaluatorLabel(type: string): string {
  if (type === "COMPANY_MENTOR") return "Mentor doanh nghiệp";
  if (type === "STUDENT") return "Sinh viên tự đánh giá";
  if (type === "ADMIN") return "Quản trị viên";
  return "Giảng viên";
}

export default function LecturerEvaluationsPage() {
  const [data, setData] = useState<LecturerEvaluationsResponse | null>(null);
  const [selected, setSelected] = useState<LecturerEvaluationItem | null>(null);
  const [detail, setDetail] = useState<LecturerEvaluationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [periodId, setPeriodId] = useState("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [evaluationType, setEvaluationType] = useState<"ALL" | EvaluationType>("ALL");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");

  const applyDetail = useCallback((result: LecturerEvaluationDetail) => {
    setDetail(result);
    setSelected(result.evaluation);
    setScore(result.currentEvaluation?.totalScore?.toString() ?? "");
    setFeedback(result.currentEvaluation?.feedback ?? "");
    setStrengths(result.currentEvaluation?.strengths ?? "");
    setImprovements(result.currentEvaluation?.improvements ?? "");
  }, []);

  const openEvaluation = useCallback(async (item: LecturerEvaluationItem) => {
    setSelected(item);
    setLoadingDetail(true);
    setDetailError("");
    setMessage("");
    try {
      const result = await fetchLecturerEvaluationDetail(item.internshipId, item.evaluationType);
      applyDetail(result);
    } catch (loadError) {
      setDetail(null);
      setDetailError(loadError instanceof Error ? loadError.message : "Không thể tải phiếu đánh giá.");
    } finally {
      setLoadingDetail(false);
    }
  }, [applyDetail]);

  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchLecturerEvaluations();
      setData(result);
      const first = result.evaluations[0] ?? null;
      if (first) await openEvaluation(first);
      else {
        setSelected(null);
        setDetail(null);
      }
    } catch (loadError) {
      setData(null);
      setDetail(null);
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu đánh giá.");
    } finally {
      setLoading(false);
    }
  }, [openEvaluation]);

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvaluations();
  }, [loadEvaluations]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.evaluations ?? []).filter((item) => {
      const haystack = [
        item.studentName,
        item.studentCode,
        item.className,
        item.major,
        item.companyName,
        item.positionTitle,
      ].join(" ").toLocaleLowerCase("vi");
      return (!keyword || haystack.includes(keyword))
        && (periodId === "ALL" || item.periodId === Number(periodId))
        && (status === "ALL" || item.status === status)
        && (evaluationType === "ALL" || item.evaluationType === evaluationType);
    });
  }, [data, evaluationType, periodId, search, status]);

  async function refreshSelected() {
    if (!selected) return;
    const [list, selectedDetail] = await Promise.all([
      fetchLecturerEvaluations(),
      fetchLecturerEvaluationDetail(selected.internshipId, selected.evaluationType),
    ]);
    setData(list);
    applyDetail(selectedDetail);
  }

  async function submitEvaluation(nextStatus: EvaluationStatus) {
    if (!selected || !detail) return;
    const numericScore = score.trim() ? Number(score) : null;
    if (numericScore !== null && (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 10)) {
      setMessage("Tổng điểm phải nằm trong khoảng từ 0 đến 10.");
      return;
    }
    if (nextStatus !== "DRAFT" && numericScore === null) {
      setMessage("Vui lòng nhập tổng điểm trước khi nộp đánh giá.");
      return;
    }
    if (nextStatus !== "DRAFT" && !feedback.trim()) {
      setMessage("Vui lòng nhập nhận xét chung trước khi nộp đánh giá.");
      return;
    }
    if (nextStatus === "CONFIRMED" && (!strengths.trim() || !improvements.trim())) {
      setMessage("Cần nhập điểm mạnh và nội dung cần cải thiện trước khi xác nhận.");
      return;
    }
    if (nextStatus !== "DRAFT") {
      const action = nextStatus === "CONFIRMED" ? "xác nhận và khóa" : "nộp";
      if (!window.confirm(`Bạn có chắc muốn ${action} phiếu đánh giá ${evaluationTypeLabel(selected.evaluationType).toLowerCase()}?`)) return;
    }

    setSaving(true);
    setMessage("");
    try {
      const result = await saveLecturerEvaluation(selected.internshipId, selected.evaluationType, {
        status: nextStatus,
        totalScore: numericScore,
        feedback,
        strengths,
        improvements,
      });
      await refreshSelected();
      setMessage(result.message);
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Không thể lưu phiếu đánh giá.");
    } finally {
      setSaving(false);
    }
  }

  const summary = data?.summary;
  const locked = detail?.evaluation.status === "CONFIRMED";
  const isSuccessMessage = message.startsWith("Đã");

  return (
    <LecturerShell title="Đánh giá thực tập">
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>KẾT QUẢ THỰC TẬP</p>
            <h1>Đánh giá sinh viên</h1>
            <p>Theo dõi căn cứ, chấm điểm và xác nhận kết quả giữa kỳ hoặc cuối kỳ.</p>
          </div>
          <button className={styles.refreshButton} disabled={loading} onClick={() => void loadEvaluations()} type="button">
            {loading ? <Loader2 className={styles.spin} size={17} /> : <RefreshCw size={17} />}
            Làm mới
          </button>
        </header>

        <section className={styles.summaryGrid}>
          <button onClick={() => setStatus("ALL")} type="button"><ClipboardList size={20} /><span>Tổng lượt<strong>{summary?.total ?? 0}</strong></span></button>
          <button onClick={() => setStatus("NOT_STARTED")} type="button"><Hourglass size={20} /><span>Chưa đánh giá<strong>{summary?.notStarted ?? 0}</strong></span></button>
          <button onClick={() => setStatus("DRAFT")} type="button"><FileText size={20} /><span>Bản nháp<strong>{summary?.draft ?? 0}</strong></span></button>
          <button onClick={() => setStatus("SUBMITTED")} type="button"><Send size={20} /><span>Đã nộp<strong>{summary?.submitted ?? 0}</strong></span></button>
          <button onClick={() => setStatus("CONFIRMED")} type="button"><CheckCircle2 size={20} /><span>Đã xác nhận<strong>{summary?.confirmed ?? 0}</strong></span></button>
          <div><Award size={20} /><span>Điểm trung bình<strong>{summary?.averageScore !== null && summary?.averageScore !== undefined ? `${summary.averageScore.toFixed(1)}/10` : "--"}</strong></span></div>
        </section>

        <section className={styles.filterBand}>
          <div className={styles.searchBox}><Search size={17} /><input aria-label="Tìm sinh viên" placeholder="Tên, mã sinh viên, doanh nghiệp, vị trí..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <label><Filter size={15} /><select aria-label="Trạng thái đánh giá" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="ALL">Tất cả trạng thái</option><option value="NOT_STARTED">Chưa đánh giá</option><option value="DRAFT">Bản nháp</option><option value="SUBMITTED">Đã nộp</option><option value="CONFIRMED">Đã xác nhận</option></select></label>
          <label><select aria-label="Loại đánh giá" value={evaluationType} onChange={(event) => setEvaluationType(event.target.value as "ALL" | EvaluationType)}><option value="ALL">Giữa kỳ và cuối kỳ</option><option value="MIDTERM">Đánh giá giữa kỳ</option><option value="FINAL">Đánh giá cuối kỳ</option></select></label>
          <label><select aria-label="Đợt thực tập" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="ALL">Tất cả đợt</option>{data?.periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.semesterCode}</option>)}</select></label>
        </section>

        {loading && <section className={styles.statePanel}><Loader2 className={styles.spin} size={30} /><p>Đang tải danh sách đánh giá...</p></section>}
        {!loading && error && <section className={`${styles.statePanel} ${styles.errorState}`}><AlertCircle size={32} /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={() => void loadEvaluations()} type="button">Thử lại</button></section>}

        {!loading && !error && <div className={styles.workspace}>
          <section className={styles.listPanel}>
            <header><div><h2>Phiếu đánh giá</h2><p>{filtered.length} lượt phù hợp</p></div></header>
            <div className={styles.evaluationList}>
              {filtered.map((item) => {
                const active = selected?.internshipId === item.internshipId && selected.evaluationType === item.evaluationType;
                return <button className={`${styles.evaluationRow} ${active ? styles.evaluationRowActive : ""}`} key={`${item.internshipId}-${item.evaluationType}`} onClick={() => void openEvaluation(item)} type="button">
                  <div className={styles.rowTop}><span className={styles.avatar}>{item.studentName.trim().charAt(0).toUpperCase()}</span><span className={styles.studentName}><strong>{item.studentName}</strong><small>{item.studentCode} · {item.className || "Chưa có lớp/khóa"}</small></span><span className={`${styles.statusBadge} ${styles[`status${item.status}`]}`}>{statusLabel(item.status)}</span></div>
                  <div className={styles.rowTitle}><strong>{evaluationTypeLabel(item.evaluationType)}</strong>{item.totalScore !== null && <span>{item.totalScore.toFixed(1)}/10</span>}</div>
                  <p>{item.positionTitle || "Chưa cập nhật vị trí"} · {item.companyName || "Chưa cập nhật doanh nghiệp"}</p>
                  <div className={styles.rowMeta}><span><BarChart3 size={13} />Tiến độ {item.progressPercentage.toFixed(0)}%</span><span><FileCheck2 size={13} />{item.reportSubmitted}/{item.reportTotal} báo cáo</span></div>
                </button>;
              })}
              {filtered.length === 0 && <div className={styles.emptyList}><ClipboardList size={29} /><p>Không có lượt đánh giá phù hợp bộ lọc.</p></div>}
            </div>
          </section>

          <section className={styles.detailPanel}>
            {loadingDetail && <div className={styles.detailLoading}><Loader2 className={styles.spin} size={22} />Đang tải phiếu đánh giá...</div>}
            {detailError && <div className={styles.inlineError}><AlertCircle size={17} />{detailError}</div>}
            {!detail && !loadingDetail && <div className={styles.emptyDetail}><Star size={34} /><p>Chọn một sinh viên để bắt đầu đánh giá.</p></div>}

            {detail && <>
              <header className={styles.detailHeader}>
                <div><p>{evaluationTypeLabel(detail.evaluation.evaluationType).toUpperCase()} · KỲ THỰC TẬP #{detail.evaluation.internshipId}</p><h2>{detail.evaluation.studentName}</h2><span>{detail.evaluation.studentCode} · {detail.evaluation.periodName}</span></div>
                <span className={`${styles.statusBadge} ${styles[`status${detail.evaluation.status}`]}`}>{statusLabel(detail.evaluation.status)}</span>
              </header>

              <section className={styles.metricsBand}>
                <div><Target size={18} /><span>Tiến độ<strong>{detail.evaluation.progressPercentage.toFixed(0)}%</strong></span></div>
                <div><Clock3 size={18} /><span>Giờ thực tập<strong>{detail.evaluation.completedHours}/{detail.evaluation.requiredHours ?? "--"}</strong></span></div>
                <div><FileCheck2 size={18} /><span>Báo cáo đã nộp<strong>{detail.evaluation.reportSubmitted}/{detail.evaluation.reportTotal}</strong></span></div>
                <div><Award size={18} /><span>TB báo cáo<strong>{detail.evaluation.reportAverageScore !== null ? `${detail.evaluation.reportAverageScore.toFixed(1)}/10` : "--"}</strong></span></div>
              </section>

              <section className={styles.infoSection}>
                <div className={styles.sectionHeading}><GraduationCap size={19} /><div><h3>Thông tin thực tập</h3><p>Thông tin sinh viên và đơn vị tiếp nhận</p></div></div>
                <div className={styles.infoGrid}>
                  <div><span>Lớp / Khóa</span><strong>{detail.evaluation.className || "Chưa cập nhật"}</strong></div>
                  <div><span>Ngành</span><strong>{detail.evaluation.major || "Chưa cập nhật"}</strong></div>
                  <div><span>Email</span><strong>{detail.evaluation.email || "Chưa cập nhật"}</strong></div>
                  <div><span>Doanh nghiệp</span><strong>{detail.evaluation.companyName || "Chưa cập nhật"}</strong></div>
                  <div><span>Mentor</span><strong>{detail.evaluation.mentorName || "Chưa cập nhật"}</strong></div>
                  <div><span>Vị trí</span><strong>{detail.evaluation.positionTitle || "Chưa cập nhật"}</strong></div>
                  <div><span>Thời gian</span><strong>{formatDate(detail.evaluation.startDate)} - {formatDate(detail.evaluation.endDate)}</strong></div>
                </div>
              </section>

              {detail.readinessIssues.length > 0 && <section className={styles.warningSection}>
                <div className={styles.sectionHeading}><AlertCircle size={19} /><div><h3>Nội dung cần lưu ý</h3><p>Không chặn đánh giá nhưng cần được giảng viên kiểm tra</p></div></div>
                <ul>{detail.readinessIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </section>}

              <section className={styles.infoSection}>
                <div className={styles.sectionHeading}><BookOpenCheck size={19} /><div><h3>Căn cứ từ báo cáo</h3><p>Điểm, thời hạn và phản hồi đã ghi nhận</p></div></div>
                <div className={styles.reportTable}>
                  {detail.reports.map((report) => <article key={report.id}>
                    <FileText size={17} />
                    <span><strong>{reportTypeLabel(report.reportType, report.weekNumber)}</strong><small>{report.title} · Nộp {formatDateTime(report.submittedAt)}</small></span>
                    <em className={report.isLate || report.isOverdue ? styles.reportWarning : ""}>{report.isOverdue ? "Quá hạn" : report.isLate ? "Nộp muộn" : report.submittedAt ? "Đúng hạn" : "Chưa nộp"}</em>
                    <b>{report.lecturerScore !== null ? `${report.lecturerScore.toFixed(1)}/10` : "--"}</b>
                  </article>)}
                  {detail.reports.length === 0 && <div className={styles.noData}><AlertCircle size={17} />Chưa có báo cáo cho kỳ thực tập này.</div>}
                </div>
              </section>

              <section className={styles.infoSection}>
                <div className={styles.sectionHeading}><UserRound size={19} /><div><h3>Đánh giá đối chiếu</h3><p>Ý kiến từ mentor, sinh viên hoặc quản trị viên</p></div></div>
                <div className={styles.comparisonList}>
                  {detail.relatedEvaluations.map((record) => <article key={record.id}><div><Building2 size={17} /><span><strong>{evaluatorLabel(record.evaluatorType)}</strong><small>{record.evaluatorName || "Chưa cập nhật người đánh giá"} · {formatDateTime(record.submittedAt)}</small></span><b>{record.totalScore !== null ? `${record.totalScore.toFixed(1)}/10` : "--"}</b></div>{record.feedback && <p>{record.feedback}</p>}</article>)}
                  {detail.relatedEvaluations.length === 0 && <div className={styles.noData}><UserRound size={17} />Chưa có đánh giá từ các bên khác.</div>}
                </div>
              </section>

              <section className={locked ? styles.lockedSection : styles.formSection}>
                <div className={styles.sectionHeading}>{locked ? <CheckCircle2 size={19} /> : <Star size={19} />}<div><h3>{locked ? "Kết quả đã xác nhận" : "Phiếu đánh giá của giảng viên"}</h3><p>{locked ? `Xác nhận lúc ${formatDateTime(detail.currentEvaluation?.submittedAt ?? null)}` : "Tổng điểm được tính trên thang 10"}</p></div></div>
                <div className={styles.scoreField}><label htmlFor="evaluation-score">Tổng điểm</label><div><input disabled={locked} id="evaluation-score" inputMode="decimal" max="10" min="0" placeholder="0" step="0.1" type="number" value={score} onChange={(event) => setScore(event.target.value)} /><span>/ 10</span></div></div>
                <label className={styles.textField}><span>Nhận xét chung</span><textarea disabled={locked} maxLength={5000} placeholder="Nhận xét về kết quả, thái độ và mức độ hoàn thành..." rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label>
                <div className={styles.twoFields}>
                  <label className={styles.textField}><span>Điểm mạnh</span><textarea disabled={locked} maxLength={5000} placeholder="Năng lực, thái độ hoặc kết quả nổi bật..." rows={4} value={strengths} onChange={(event) => setStrengths(event.target.value)} /></label>
                  <label className={styles.textField}><span>Nội dung cần cải thiện</span><textarea disabled={locked} maxLength={5000} placeholder="Nội dung sinh viên cần tiếp tục cải thiện..." rows={4} value={improvements} onChange={(event) => setImprovements(event.target.value)} /></label>
                </div>
                {message && <p className={isSuccessMessage ? styles.successMessage : styles.formError}>{message}</p>}
                {!locked && <div className={styles.formActions}>
                  {detail.evaluation.status !== "SUBMITTED" && <button className={styles.draftButton} disabled={saving} onClick={() => void submitEvaluation("DRAFT")} type="button">{saving ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />}Lưu nháp</button>}
                  <button className={styles.submitButton} disabled={saving} onClick={() => void submitEvaluation("SUBMITTED")} type="button"><Send size={16} />{detail.evaluation.status === "SUBMITTED" ? "Cập nhật bản đã nộp" : "Nộp đánh giá"}</button>
                  {detail.evaluation.status === "SUBMITTED" && <button className={styles.confirmButton} disabled={saving} onClick={() => void submitEvaluation("CONFIRMED")} type="button"><CheckCircle2 size={16} />Xác nhận kết quả</button>}
                </div>}
              </section>
            </>}
          </section>
        </div>}
      </main>
    </LecturerShell>
  );
}
