"use client";

import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Hourglass,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  adminEvaluationsApi,
  type AdminEvaluationDetail,
  type AdminEvaluationItem,
  type AdminEvaluationsResponse,
  type EvaluationDisplayStatus,
  type EvaluationType,
} from "@/services/admin-evaluations.service";

import styles from "./page.module.css";

type StatusFilter = "ALL" | EvaluationDisplayStatus;
type TypeFilter = "ALL" | EvaluationType;
type ScoreFilter = "ALL" | "SCORED" | "HIGH" | "LOW";

const statusLabels: Record<EvaluationDisplayStatus, string> = {
  NOT_STARTED: "Chưa đánh giá",
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  CONFIRMED: "Đã xác nhận",
};

const typeLabels: Record<EvaluationType, string> = {
  MIDTERM: "Giữa kỳ",
  FINAL: "Cuối kỳ",
};

function formatDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function reportLabel(type: string, week: number | null): string {
  if (type === "WEEKLY") return `Báo cáo tuần ${week ?? "-"}`;
  if (type === "MIDTERM") return "Báo cáo giữa kỳ";
  if (type === "FINAL") return "Báo cáo cuối kỳ";
  return "Báo cáo thực tập";
}

function evaluatorLabel(type: string): string {
  const labels: Record<string, string> = {
    LECTURER: "Giảng viên",
    COMPANY_MENTOR: "Mentor doanh nghiệp",
    STUDENT: "Sinh viên tự đánh giá",
    ADMIN: "Quản trị viên",
  };
  return labels[type] ?? type;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export default function AdminEvaluationsPage() {
  const [data, setData] = useState<AdminEvaluationsResponse | null>(null);
  const [selected, setSelected] = useState<AdminEvaluationItem | null>(null);
  const [detail, setDetail] = useState<AdminEvaluationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [evaluationType, setEvaluationType] = useState<TypeFilter>("ALL");
  const [periodId, setPeriodId] = useState("ALL");
  const [lecturerId, setLecturerId] = useState("ALL");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("ALL");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const detailRequest = useRef(0);

  const openEvaluation = useCallback(async (item: AdminEvaluationItem) => {
    const requestId = ++detailRequest.current;
    setSelected(item);
    setLoadingDetail(true);
    setDetailError("");
    try {
      const result = await adminEvaluationsApi.detail(
        item.internshipId,
        item.evaluationType,
      );
      if (requestId === detailRequest.current) setDetail(result);
    } catch (loadError) {
      if (requestId === detailRequest.current) {
        setDetail(null);
        setDetailError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải chi tiết đánh giá.",
        );
      }
    } finally {
      if (requestId === detailRequest.current) setLoadingDetail(false);
    }
  }, []);

  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminEvaluationsApi.list();
      setData(result);
      const nextSelected = selected
        ? result.evaluations.find(
            item => item.internshipId === selected.internshipId
              && item.evaluationType === selected.evaluationType,
          ) ?? result.evaluations[0] ?? null
        : result.evaluations[0] ?? null;
      if (nextSelected) await openEvaluation(nextSelected);
      else {
        setSelected(null);
        setDetail(null);
      }
    } catch (loadError) {
      setData(null);
      setDetail(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải dữ liệu đánh giá.",
      );
    } finally {
      setLoading(false);
    }
  }, [openEvaluation, selected]);

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvaluations();
    // The selected record is intentionally excluded from initial loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.evaluations ?? []).filter(item => {
      const haystack = [
        item.studentName,
        item.studentCode,
        item.className,
        item.major,
        item.companyName,
        item.positionTitle,
        item.assignedLecturer?.fullName ?? "",
        item.assignedLecturer?.lecturerCode ?? "",
      ].join(" ").toLocaleLowerCase("vi");
      const scoreMatches = scoreFilter === "ALL"
        || (scoreFilter === "SCORED" && item.totalScore !== null)
        || (scoreFilter === "HIGH" && (item.totalScore ?? -1) >= 8)
        || (scoreFilter === "LOW" && item.totalScore !== null && item.totalScore < 5);
      const needsAttention = item.reportOverdue > 0
        || (item.evaluationType === "FINAL"
          && item.progressPercentage < 100
          && item.status !== "CONFIRMED");
      return (!keyword || haystack.includes(keyword))
        && (status === "ALL" || item.status === status)
        && (evaluationType === "ALL" || item.evaluationType === evaluationType)
        && (periodId === "ALL" || item.periodId === Number(periodId))
        && (lecturerId === "ALL" || item.assignedLecturer?.id === Number(lecturerId))
        && (!attentionOnly || needsAttention)
        && scoreMatches;
    });
  }, [attentionOnly, data, evaluationType, lecturerId, periodId, scoreFilter, search, status]);

  function exportCsv() {
    const headers = [
      "Sinh viên", "Mã sinh viên", "Loại đánh giá", "Trạng thái", "Điểm",
      "Giảng viên", "Doanh nghiệp", "Kỳ thực tập", "Tiến độ", "Báo cáo quá hạn",
    ];
    const rows = filtered.map(item => [
      item.studentName,
      item.studentCode,
      typeLabels[item.evaluationType],
      statusLabels[item.status],
      item.totalScore,
      item.assignedLecturer?.fullName ?? "Chưa phân công",
      item.companyName,
      item.periodName,
      `${item.progressPercentage.toFixed(0)}%`,
      item.reportOverdue,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(csvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-evaluations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const summary = data?.summary;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><ClipboardCheck size={15} /> QUẢN TRỊ HỌC VỤ</span>
          <h1>Đánh giá thực tập</h1>
          <p>Theo dõi tiến độ chấm điểm, kết quả và căn cứ đánh giá trên toàn hệ thống.</p>
        </div>
        <div className={styles.headerActions}>
          <button disabled={!filtered.length} onClick={exportCsv} type="button"><Download size={16} />Xuất CSV</button>
          <button disabled={loading} onClick={() => void loadEvaluations()} type="button">
            {loading ? <Loader2 className={styles.spin} size={16} /> : <RefreshCw size={16} />}Làm mới
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Tổng quan đánh giá">
        <button aria-pressed={status === "ALL" && !attentionOnly} onClick={() => { setStatus("ALL"); setAttentionOnly(false); }} type="button"><ClipboardCheck /><span>Tổng lượt<strong>{summary?.total ?? 0}</strong><small>{summary?.students ?? 0} sinh viên</small></span></button>
        <button aria-pressed={status === "NOT_STARTED" && !attentionOnly} onClick={() => { setStatus("NOT_STARTED"); setAttentionOnly(false); }} type="button"><Hourglass /><span>Chưa bắt đầu<strong>{summary?.notStarted ?? 0}</strong><small>Cần phân công xử lý</small></span></button>
        <button aria-pressed={status === "SUBMITTED" && !attentionOnly} onClick={() => { setStatus("SUBMITTED"); setAttentionOnly(false); }} type="button"><FileCheck2 /><span>Chờ xác nhận<strong>{summary?.submitted ?? 0}</strong><small>Đã nộp kết quả</small></span></button>
        <button aria-pressed={status === "CONFIRMED" && !attentionOnly} onClick={() => { setStatus("CONFIRMED"); setAttentionOnly(false); }} type="button"><CheckCircle2 /><span>Đã xác nhận<strong>{summary?.confirmed ?? 0}</strong><small>{summary?.completionRate ?? 0}% hoàn tất</small></span></button>
        <button aria-pressed={scoreFilter === "SCORED" && !attentionOnly} onClick={() => { setScoreFilter(scoreFilter === "SCORED" ? "ALL" : "SCORED"); setAttentionOnly(false); }} type="button"><Award /><span>Điểm trung bình<strong>{summary?.averageScore == null ? "--" : summary.averageScore.toFixed(1)}</strong><small>Thang điểm 10</small></span></button>
        <button aria-pressed={attentionOnly} onClick={() => { setAttentionOnly(current => !current); setStatus("ALL"); setScoreFilter("ALL"); }} type="button"><AlertCircle /><span>Cần chú ý<strong>{summary?.needsAttention ?? 0}</strong><small>Tiến độ hoặc quá hạn</small></span></button>
      </section>

      <section className={styles.insightBand}>
        <div><Users size={15} /><span>Giảng viên phụ trách</span><strong>{summary?.lecturers ?? 0}</strong></div>
        <div><BarChart3 size={15} /><span>Đánh giá giữa kỳ</span><strong>{summary?.midterm ?? 0}</strong></div>
        <div><Star size={15} /><span>Đánh giá cuối kỳ</span><strong>{summary?.final ?? 0}</strong></div>
        <div><ShieldCheck size={15} /><span>Quyền truy cập</span><strong>Chỉ đọc</strong></div>
      </section>

      <section className={styles.filters} aria-label="Bộ lọc đánh giá">
        <label className={styles.searchBox}><Search size={16} /><input aria-label="Tìm kiếm đánh giá" onChange={event => setSearch(event.target.value)} placeholder="Sinh viên, mã số, giảng viên, doanh nghiệp..." value={search} /></label>
        <label><Filter size={15} /><select aria-label="Trạng thái" onChange={event => setStatus(event.target.value as StatusFilter)} value={status}><option value="ALL">Tất cả trạng thái</option><option value="NOT_STARTED">Chưa đánh giá</option><option value="DRAFT">Bản nháp</option><option value="SUBMITTED">Đã nộp</option><option value="CONFIRMED">Đã xác nhận</option></select></label>
        <label><select aria-label="Loại đánh giá" onChange={event => setEvaluationType(event.target.value as TypeFilter)} value={evaluationType}><option value="ALL">Giữa kỳ và cuối kỳ</option><option value="MIDTERM">Giữa kỳ</option><option value="FINAL">Cuối kỳ</option></select></label>
        <label><select aria-label="Kỳ thực tập" onChange={event => setPeriodId(event.target.value)} value={periodId}><option value="ALL">Tất cả kỳ</option>{data?.periods.map(period => <option key={period.id} value={period.id}>{period.name} · {period.semesterCode}</option>)}</select></label>
        <label><select aria-label="Giảng viên" onChange={event => setLecturerId(event.target.value)} value={lecturerId}><option value="ALL">Tất cả giảng viên</option>{data?.lecturers.map(lecturer => <option key={lecturer.id} value={lecturer.id}>{lecturer.fullName}</option>)}</select></label>
        <label><select aria-label="Mức điểm" onChange={event => setScoreFilter(event.target.value as ScoreFilter)} value={scoreFilter}><option value="ALL">Tất cả mức điểm</option><option value="SCORED">Đã có điểm</option><option value="HIGH">Từ 8 điểm</option><option value="LOW">Dưới 5 điểm</option></select></label>
      </section>

      {loading && !data && <section className={styles.state}><Loader2 className={styles.spin} size={28} /><p>Đang tải dữ liệu đánh giá...</p></section>}
      {!loading && error && <section className={`${styles.state} ${styles.errorState}`}><AlertCircle size={30} /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={() => void loadEvaluations()} type="button">Thử lại</button></section>}

      {data && !error && <div className={styles.workspace}>
        <section className={styles.listPanel}>
          <header><div><h2>Danh sách đánh giá</h2><p>{filtered.length} lượt phù hợp bộ lọc</p></div></header>
          <div className={styles.evaluationList}>
            {filtered.map(item => {
              const active = selected?.internshipId === item.internshipId
                && selected.evaluationType === item.evaluationType;
              return <button className={`${styles.evaluationRow} ${active ? styles.rowActive : ""}`} key={`${item.internshipId}-${item.evaluationType}`} onClick={() => void openEvaluation(item)} type="button">
                <div className={styles.rowHead}><span className={styles.avatar}>{item.studentName.trim().charAt(0).toUpperCase()}</span><span className={styles.student}><strong>{item.studentName}</strong><small>{item.studentCode} · {item.className || "Chưa có lớp"}</small></span><span className={`${styles.statusBadge} ${styles[`status${item.status}`]}`}>{statusLabels[item.status]}</span></div>
                <div className={styles.rowTitle}><strong>{typeLabels[item.evaluationType]}</strong><b>{item.totalScore === null ? "--" : item.totalScore.toFixed(1)}<small>/10</small></b></div>
                <p>{item.positionTitle || "Chưa cập nhật vị trí"} · {item.companyName || "Chưa cập nhật doanh nghiệp"}</p>
                <div className={styles.lecturerLine}><GraduationCap size={13} />{item.assignedLecturer?.fullName || "Chưa phân công giảng viên"}</div>
                <div className={styles.rowMeta}><span><BarChart3 size={13} />{item.progressPercentage.toFixed(0)}% tiến độ</span><span className={item.reportOverdue ? styles.warningText : ""}><FileText size={13} />{item.reportOverdue} quá hạn</span></div>
              </button>;
            })}
            {!filtered.length && <div className={styles.empty}><ClipboardCheck size={28} /><p>Không có lượt đánh giá phù hợp bộ lọc.</p></div>}
          </div>
        </section>

        <section className={styles.detailPanel}>
          {loadingDetail && <div className={styles.detailLoading}><Loader2 className={styles.spin} size={19} />Đang tải chi tiết...</div>}
          {detailError && <div className={styles.inlineError}><AlertCircle size={17} />{detailError}</div>}
          {!detail && !loadingDetail && <div className={styles.emptyDetail}><Star size={32} /><p>Chọn một lượt đánh giá để xem chi tiết.</p></div>}

          {detail && <>
            <header className={styles.detailHeader}><div><p>{typeLabels[detail.evaluation.evaluationType].toUpperCase()} · THỰC TẬP #{detail.evaluation.internshipId}</p><h2>{detail.evaluation.studentName}</h2><span>{detail.evaluation.studentCode} · {detail.evaluation.periodName}</span></div><span className={`${styles.statusBadge} ${styles[`status${detail.evaluation.status}`]}`}>{statusLabels[detail.evaluation.status]}</span></header>

            <section className={styles.metricsBand}>
              <div><Award /><span>Điểm đánh giá<strong>{detail.evaluation.totalScore === null ? "--" : `${detail.evaluation.totalScore.toFixed(1)}/10`}</strong></span></div>
              <div><BarChart3 /><span>Tiến độ<strong>{detail.evaluation.progressPercentage.toFixed(0)}%</strong></span></div>
              <div><Clock3 /><span>Giờ thực tập<strong>{detail.evaluation.completedHours}/{detail.evaluation.requiredHours ?? "--"}</strong></span></div>
              <div><FileCheck2 /><span>Báo cáo<strong>{detail.evaluation.reportSubmitted}/{detail.evaluation.reportTotal}</strong></span></div>
            </section>

            {detail.readinessIssues.length > 0 && <section className={styles.warningSection}><div className={styles.sectionHeading}><AlertCircle /><div><h3>Cần quản trị viên lưu ý</h3><p>Các yếu tố có thể ảnh hưởng tới tiến độ xác nhận</p></div></div><ul>{detail.readinessIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></section>}

            <section className={styles.section}><div className={styles.sectionHeading}><GraduationCap /><div><h3>Phân công và kỳ thực tập</h3><p>Thông tin quản lý của lượt đánh giá</p></div></div><div className={styles.infoGrid}>
              <div><span>Giảng viên</span><strong>{detail.evaluation.assignedLecturer?.fullName || "Chưa phân công"}</strong><small>{detail.evaluation.assignedLecturer?.lecturerCode || "--"}</small></div>
              <div><span>Sinh viên</span><strong>{detail.evaluation.studentName}</strong><small>{detail.evaluation.major || "Chưa cập nhật ngành"}</small></div>
              <div><span>Doanh nghiệp</span><strong>{detail.evaluation.companyName || "Chưa cập nhật"}</strong><small>{detail.evaluation.positionTitle || "Chưa cập nhật vị trí"}</small></div>
              <div><span>Mentor</span><strong>{detail.evaluation.mentorName || "Chưa cập nhật"}</strong><small>{formatDate(detail.evaluation.startDate)} - {formatDate(detail.evaluation.endDate)}</small></div>
            </div></section>

            <section className={styles.section}><div className={styles.sectionHeading}><ClipboardCheck /><div><h3>Kết quả của giảng viên</h3><p>Nội dung được lưu trong phiếu đánh giá chính thức</p></div></div>
              {!detail.currentEvaluation ? <div className={styles.noData}>Giảng viên chưa tạo phiếu đánh giá này.</div> : <div className={styles.resultBlock}>
                <div className={styles.resultMeta}><span>Người đánh giá<strong>{detail.currentEvaluation.evaluatorName || detail.evaluation.assignedLecturer?.fullName || "Giảng viên phụ trách"}</strong></span><span>Ngày cập nhật<strong>{formatDateTime(detail.currentEvaluation.updatedAt)}</strong></span><span>Trạng thái<strong>{statusLabels[detail.evaluation.status]}</strong></span></div>
                <article><h4>Nhận xét chung</h4><p>{detail.currentEvaluation.feedback || "Chưa có nhận xét."}</p></article>
                <div className={styles.twoColumns}><article><h4>Điểm mạnh</h4><p>{detail.currentEvaluation.strengths || "Chưa cập nhật."}</p></article><article><h4>Cần cải thiện</h4><p>{detail.currentEvaluation.improvements || "Chưa cập nhật."}</p></article></div>
              </div>}
            </section>

            <section className={styles.section}><div className={styles.sectionHeading}><BookOpenCheck /><div><h3>Căn cứ từ báo cáo</h3><p>Tiến độ nộp và điểm báo cáo của sinh viên</p></div></div><div className={styles.reportTable}>
              {detail.reports.map(report => <article key={report.id}><FileText /><span><strong>{reportLabel(report.reportType, report.weekNumber)}</strong><small>{report.title} · {formatDateTime(report.submittedAt)}</small></span><em className={report.isLate || report.isOverdue ? styles.warningText : ""}>{report.isOverdue ? "Quá hạn" : report.isLate ? "Nộp muộn" : report.submittedAt ? "Đã nộp" : "Chưa nộp"}</em><b>{report.lecturerScore === null ? "--" : `${report.lecturerScore.toFixed(1)}/10`}</b></article>)}
              {!detail.reports.length && <div className={styles.noData}>Chưa có báo cáo làm căn cứ đánh giá.</div>}
            </div></section>

            <section className={styles.section}><div className={styles.sectionHeading}><UserRound /><div><h3>Đánh giá đối chiếu</h3><p>Kết quả từ mentor, sinh viên hoặc bên liên quan</p></div></div><div className={styles.comparisonList}>
              {detail.relatedEvaluations.map(record => <article key={record.id}><div><Building2 /><span><strong>{evaluatorLabel(record.evaluatorType)}</strong><small>{record.evaluatorName || "Chưa cập nhật người đánh giá"} · {formatDateTime(record.submittedAt)}</small></span><b>{record.totalScore === null ? "--" : `${record.totalScore.toFixed(1)}/10`}</b></div>{record.feedback && <p>{record.feedback}</p>}</article>)}
              {!detail.relatedEvaluations.length && <div className={styles.noData}>Chưa có đánh giá từ các bên khác.</div>}
            </div></section>
          </>}
        </section>
      </div>}
    </main>
  );
}
