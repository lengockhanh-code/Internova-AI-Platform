"use client";

import {
  Activity, AlertCircle, ArrowRight, BriefcaseBusiness, Building2,
  CheckCircle2, ChevronRight, ClipboardCheck, Clock3, FileCheck2,
  FileText, GraduationCap, Loader2, RefreshCw, Sparkles,
  TrendingUp, UserCheck, Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminInternshipsApi, type ApplicationListItem, type ApplicationsResponse } from "@/services/admin-internships.service";
import { adminLecturersApi, type AdminLecturersResponse } from "@/services/admin-lecturers.service";
import { adminReportsApi, type AdminReportsResponse } from "@/services/admin-reports.service";
import { adminStudentsApi, type AdminStudentsResponse } from "@/services/admin-students.service";
import {
  formatMoney,
  formatMs,
  observabilityApi,
  scorePercent,
  type AlertsResponse,
  type ObservabilityStatusResponse,
  type OverviewResponse,
  type TimeRange,
} from "@/lib/adminObservability";
import styles from "./page.module.css";

type DashboardData = {
  students: AdminStudentsResponse;
  lecturers: AdminLecturersResponse;
  internships: ApplicationsResponse;
  reports: AdminReportsResponse;
};

type AiDashboardData = {
  overview: OverviewResponse;
  alerts: AlertsResponse;
  status: ObservabilityStatusResponse;
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const relativeFormatter = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
const APPLICATION_STATUS = {
  SUBMITTED: { label: "Chờ tiếp nhận", className: "pending" },
  UNDER_REVIEW: { label: "Đang xét duyệt", className: "review" },
  APPROVED: { label: "Đã duyệt", className: "approved" },
  REJECTED: { label: "Từ chối", className: "rejected" },
} as const;
const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  "1h": "1 giờ", "24h": "24 giờ", yesterday: "hôm qua", "2d": "2 ngày",
  "3d": "3 ngày", "7d": "7 ngày", "14d": "14 ngày", "30d": "30 ngày",
};

function formatNumber(value: number | undefined): string {
  return (value ?? 0).toLocaleString("vi-VN");
}

function percent(value: number, total: number): number {
  return total ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

function relativeDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Chưa cập nhật";
  const days = Math.round((time - Date.now()) / 86_400_000);
  return Math.abs(days) <= 7 ? relativeFormatter.format(days, "day") : shortDateFormatter.format(new Date(time));
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0)).join("").toUpperCase() || "AD";
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function storedAdminName(): string {
  if (typeof window === "undefined") return "Quản trị viên";
  const storedUser = window.localStorage.getItem("internova_user");
  if (!storedUser) return "Quản trị viên";
  try {
    const user = JSON.parse(storedUser) as { fullName?: string };
    return user.fullName?.trim() || "Quản trị viên";
  } catch {
    return "Quản trị viên";
  }
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [adminName] = useState(storedAdminName);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [aiData, setAiData] = useState<AiDashboardData | null>(null);
  const [aiRange, setAiRange] = useState<TimeRange>("24h");
  const [aiLoading, setAiLoading] = useState(true);
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [students, lecturers, internships, reports] = await Promise.all([
        adminStudentsApi.list({ page: 1, pageSize: 100 }),
        adminLecturersApi.list({ page: 1, pageSize: 100 }),
        adminInternshipsApi.list(),
        adminReportsApi.list(),
      ]);
      setData({ students, lecturers, internships, reports });
      setUpdatedAt(new Date());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tải dữ liệu dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAiDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setAiRefreshing(true); else setAiLoading(true);
    setAiError(null);
    try {
      const [overview, alerts, status] = await Promise.all([
        observabilityApi.overview(aiRange),
        observabilityApi.alerts(aiRange),
        observabilityApi.status(),
      ]);
      setAiData({ overview, alerts, status });
    } catch (requestError) {
      setAiError(requestError instanceof Error ? requestError.message : "Không thể tải dữ liệu AI Monitoring.");
    } finally {
      setAiLoading(false);
      setAiRefreshing(false);
    }
  }, [aiRange]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadDashboard]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadAiDashboard(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAiDashboard]);

  const recentApplications = useMemo(() => [...(data?.internships.applications ?? [])]
    .sort((left, right) => (right.submittedAt ? new Date(right.submittedAt).getTime() : 0) - (left.submittedAt ? new Date(left.submittedAt).getTime() : 0))
    .slice(0, 5), [data]);

  const urgentReports = useMemo(() => [...(data?.reports.reports ?? [])]
    .filter((report) => ["UPCOMING", "NOT_SUBMITTED", "DRAFT"].includes(report.submissionStatus))
    .sort((left, right) => (left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER) - (right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER))
    .slice(0, 3), [data]);

  if (loading && !data) {
    return <main className={styles.page}><div className={styles.loadingState}><span><Loader2 size={25} /></span><strong>Đang tổng hợp dữ liệu vận hành</strong><p>Dashboard sẽ sẵn sàng trong giây lát.</p></div></main>;
  }

  const students = data?.students.summary;
  const lecturers = data?.lecturers.summary;
  const internships = data?.internships.summary;
  const reports = data?.reports.summary;
  const totalActions = (internships?.submitted ?? 0) + (internships?.underReview ?? 0) + (internships?.unassigned ?? 0) + (reports?.pendingReview ?? 0) + (reports?.overdue ?? 0);
  const internshipApprovalRate = percent(internships?.approved ?? 0, internships?.total ?? 0);
  const reviewRate = percent(internships?.underReview ?? 0, internships?.total ?? 0);
  const submittedRate = percent(internships?.submitted ?? 0, internships?.total ?? 0);
  const reportCompletionRate = percent(reports?.submitted ?? 0, reports?.total ?? 0);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div><span className={styles.eyebrow}><Sparkles size={15} /> TRUNG TÂM ĐIỀU HÀNH</span><h1>{greeting()}, {adminName.split(" ").slice(-1)[0]}</h1><p>{dateFormatter.format(new Date())} · Theo dõi toàn cảnh chương trình thực tập.</p></div>
        <div className={styles.headerActions}>
          {updatedAt && <span className={styles.updatedAt}>Cập nhật {relativeDate(updatedAt.toISOString())}</span>}
          <button type="button" className={styles.refreshButton} disabled={refreshing || aiRefreshing} onClick={() => { void loadDashboard(true); void loadAiDashboard(true); }}><RefreshCw className={refreshing || aiRefreshing ? styles.spin : ""} size={17} />{refreshing || aiRefreshing ? "Đang cập nhật" : "Làm mới"}</button>
          <span className={styles.avatar} aria-label={adminName}>{initials(adminName)}</span>
        </div>
      </header>

      {error && <div className={styles.errorBanner} role="alert"><AlertCircle size={18} /><div><strong>Chưa thể cập nhật dữ liệu mới</strong><span>{error}</span></div><button type="button" onClick={() => void loadDashboard(true)}>Thử lại</button></div>}

      <AiOverviewSection
        data={aiData}
        error={aiError}
        loading={aiLoading}
        refreshing={aiRefreshing}
        range={aiRange}
        setRange={setAiRange}
        refresh={() => void loadAiDashboard(true)}
      />

      <div className={styles.sectionHeading}>
        <div><span>VẬN HÀNH CHƯƠNG TRÌNH</span><h2>Thống kê thực tập</h2></div>
        <p>Sinh viên, giảng viên, hồ sơ và tiến độ báo cáo.</p>
      </div>

      <section className={styles.metricGrid} aria-label="Chỉ số tổng quan">
        <MetricCard icon={GraduationCap} label="Tổng sinh viên" value={formatNumber(students?.total)} note={`${formatNumber(students?.active)} tài khoản hoạt động`} tone="indigo" href="/admin/students" />
        <MetricCard icon={BriefcaseBusiness} label="Hồ sơ thực tập" value={formatNumber(internships?.total)} note={`${internshipApprovalRate}% đã được phê duyệt`} tone="blue" href="/admin/internships" />
        <MetricCard icon={UserCheck} label="Giảng viên" value={formatNumber(lecturers?.total)} note={`${formatNumber(lecturers?.available)} sẵn sàng phân công`} tone="emerald" href="/admin/lecturers" />
        <MetricCard icon={ClipboardCheck} label="Cần xử lý" value={formatNumber(totalActions)} note={`${formatNumber(reports?.overdue)} báo cáo quá hạn`} tone="amber" href="/admin/reports" />
      </section>

      <section className={styles.mainGrid}>
        <article className={`${styles.panel} ${styles.overviewPanel}`}>
          <PanelHeader title="Tiến độ đăng ký thực tập" subtitle="Phân bổ trạng thái hồ sơ trong toàn hệ thống" action={<Link href="/admin/internships">Xem chi tiết <ArrowRight size={14} /></Link>} />
          <div className={styles.applicationOverview}>
            <div className={styles.donutWrap}>
              <div className={styles.donut} style={{ background: internships?.total ? `conic-gradient(#5966e8 0 ${internshipApprovalRate}%, #63b3ed ${internshipApprovalRate}% ${internshipApprovalRate + reviewRate}%, #f0b65d ${internshipApprovalRate + reviewRate}% ${internshipApprovalRate + reviewRate + submittedRate}%, #ef7d78 0)` : "#edf0f5" }}><div><strong>{internshipApprovalRate}%</strong><span>đã duyệt</span></div></div>
              <p><TrendingUp size={15} /> {formatNumber(internships?.approved)} hồ sơ đã hoàn tất xét duyệt</p>
            </div>
            <div className={styles.funnelList}>
              <ProgressRow label="Đã duyệt" value={internships?.approved ?? 0} total={internships?.total ?? 0} tone="approved" />
              <ProgressRow label="Đang xét duyệt" value={internships?.underReview ?? 0} total={internships?.total ?? 0} tone="review" />
              <ProgressRow label="Chờ tiếp nhận" value={internships?.submitted ?? 0} total={internships?.total ?? 0} tone="pending" />
              <ProgressRow label="Từ chối" value={internships?.rejected ?? 0} total={internships?.total ?? 0} tone="rejected" />
            </div>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.actionPanel}`}>
          <PanelHeader title="Công việc cần chú ý" subtitle="Các hạng mục đang chờ Admin xử lý" />
          <div className={styles.actionList}>
            <ActionItem icon={Clock3} tone="amber" value={internships?.submitted ?? 0} label="Hồ sơ mới chờ tiếp nhận" href="/admin/internships" />
            <ActionItem icon={Users} tone="blue" value={internships?.unassigned ?? 0} label="Hồ sơ chưa có giảng viên" href="/admin/internships" />
            <ActionItem icon={FileCheck2} tone="purple" value={reports?.pendingReview ?? 0} label="Báo cáo chờ đánh giá" href="/admin/reports" />
            <ActionItem icon={AlertCircle} tone="red" value={reports?.overdue ?? 0} label="Báo cáo đã quá hạn" href="/admin/reports" />
          </div>
        </article>
      </section>

      <section className={styles.contentGrid}>
        <article className={`${styles.panel} ${styles.recentPanel}`}>
          <PanelHeader title="Hồ sơ gần đây" subtitle="Các đăng ký thực tập mới nhất" action={<Link href="/admin/internships">Tất cả hồ sơ <ChevronRight size={14} /></Link>} />
          {recentApplications.length ? <div className={styles.applicationList}>{recentApplications.map((application) => <ApplicationRow key={application.applicationId} application={application} />)}</div> : <EmptyState icon={BriefcaseBusiness} text="Chưa có hồ sơ đăng ký thực tập." />}
        </article>

        <div className={styles.sideStack}>
          <article className={styles.panel}>
            <PanelHeader title="Tiến độ báo cáo" subtitle="Tỷ lệ nộp trên tổng số báo cáo" />
            <div className={styles.reportHero}><div><span>Hoàn thành</span><strong>{reportCompletionRate}%</strong></div><div className={styles.reportTrack}><span style={{ width: `${reportCompletionRate}%` }} /></div><div className={styles.reportLegend}><span><i className={styles.onTimeDot} /> Đúng hạn <strong>{formatNumber(reports?.onTime)}</strong></span><span><i className={styles.lateDot} /> Nộp muộn <strong>{formatNumber(reports?.late)}</strong></span><span><i className={styles.overdueDot} /> Quá hạn <strong>{formatNumber(reports?.overdue)}</strong></span></div></div>
          </article>
          <article className={styles.panel}>
            <PanelHeader title="Phân bổ giảng viên" subtitle="Tải hướng dẫn hiện tại" />
            <div className={styles.workloadGrid}><WorkloadCell label="Sẵn sàng" value={lecturers?.available ?? 0} tone="green" /><WorkloadCell label="Đã phân công" value={lecturers?.assigned ?? 0} tone="blue" /><WorkloadCell label="Tải cao" value={lecturers?.highWorkload ?? 0} tone="red" /></div>
            <div className={styles.averageLoad}><span><Activity size={15} /> Trung bình mỗi giảng viên</span><strong>{(lecturers?.averageLoad ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} sinh viên</strong></div>
          </article>
        </div>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.panel}>
          <PanelHeader title="Mốc báo cáo sắp tới" subtitle="Ưu tiên theo hạn nộp gần nhất" action={<Link href="/admin/reports">Quản lý báo cáo <ArrowRight size={14} /></Link>} />
          {urgentReports.length ? <div className={styles.deadlineList}>{urgentReports.map((report, index) => <div className={styles.deadlineItem} key={`${report.internshipId}-${report.scheduleId}-${index}`}><span className={styles.deadlineDate}><strong>{report.dueAt ? new Date(report.dueAt).getDate().toString().padStart(2, "0") : "--"}</strong><small>{report.dueAt ? `TH${new Date(report.dueAt).getMonth() + 1}` : "N/A"}</small></span><div><strong>{report.title}</strong><span>{report.studentName} · {report.companyName}</span></div><span className={`${styles.deadlineBadge} ${report.submissionStatus === "NOT_SUBMITTED" ? styles.deadlineLate : ""}`}>{relativeDate(report.dueAt)}</span></div>)}</div> : <EmptyState icon={CheckCircle2} text="Không có mốc báo cáo cần ưu tiên." />}
        </article>
        <article className={`${styles.panel} ${styles.quickPanel}`}>
          <PanelHeader title="Truy cập nhanh" subtitle="Đi đến các khu vực quản trị thường dùng" />
          <div className={styles.quickGrid}><QuickLink icon={GraduationCap} label="Sinh viên" href="/admin/students" /><QuickLink icon={UserCheck} label="Giảng viên" href="/admin/lecturers" /><QuickLink icon={FileText} label="Báo cáo" href="/admin/reports" /><QuickLink icon={Building2} label="Hồ sơ" href="/admin/internships" /></div>
        </article>
      </section>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone, href }: { icon: typeof Users; label: string; value: string; note: string; tone: "indigo" | "blue" | "emerald" | "amber"; href: string }) {
  return <Link href={href} className={styles.metricCard}><span className={`${styles.metricIcon} ${styles[tone]}`}><Icon size={21} /></span><span className={styles.metricContent}><small>{label}</small><strong>{value}</strong><em>{note}</em></span><ChevronRight className={styles.metricArrow} size={18} /></Link>;
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className={styles.panelHeader}><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>;
}

function ProgressRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: "approved" | "review" | "pending" | "rejected" }) {
  return <div className={styles.progressRow}><div><span><i className={styles[`${tone}Dot`]} />{label}</span><strong>{formatNumber(value)} <small>· {percent(value, total)}%</small></strong></div><div className={styles.progressTrack}><span className={styles[tone]} style={{ width: `${percent(value, total)}%` }} /></div></div>;
}

function ActionItem({ icon: Icon, tone, value, label, href }: { icon: typeof Clock3; tone: "amber" | "blue" | "purple" | "red"; value: number; label: string; href: string }) {
  return <Link href={href} className={styles.actionItem}><span className={styles[tone]}><Icon size={18} /></span><div><strong>{formatNumber(value)}</strong><small>{label}</small></div><ChevronRight size={16} /></Link>;
}

function ApplicationRow({ application }: { application: ApplicationListItem }) {
  const status = APPLICATION_STATUS[application.status];
  return <Link href="/admin/internships" className={styles.applicationRow}><span className={styles.studentAvatar}>{initials(application.studentName)}</span><div className={styles.applicationStudent}><strong>{application.studentName}</strong><span>{application.studentCode} · {application.major || "Chưa cập nhật ngành"}</span></div><div className={styles.companyCell}><strong>{application.companyName || "Chưa cập nhật doanh nghiệp"}</strong><span>{application.internshipPosition || "Chưa cập nhật vị trí"}</span></div><span className={`${styles.statusBadge} ${styles[status.className]}`}>{status.label}</span><time>{relativeDate(application.submittedAt)}</time><ChevronRight size={16} /></Link>;
}

function WorkloadCell({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "red" }) {
  return <div className={styles.workloadCell}><span className={styles[tone]} /><strong>{formatNumber(value)}</strong><small>{label}</small></div>;
}

function QuickLink({ icon: Icon, label, href }: { icon: typeof Users; label: string; href: string }) {
  return <Link href={href} className={styles.quickLink}><span><Icon size={19} /></span><strong>{label}</strong><ChevronRight size={15} /></Link>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return <div className={styles.emptyState}><Icon size={22} /><span>{text}</span></div>;
}

function AiOverviewSection({ data, error, loading, refreshing, range, setRange, refresh }: { data: AiDashboardData | null; error: string | null; loading: boolean; refreshing: boolean; range: TimeRange; setRange: (range: TimeRange) => void; refresh: () => void }) {
  const overview = data?.overview;
  const status = data?.status;
  const alerts = data?.alerts;
  const health = !status?.configured || status.health?.ok === false
    ? "offline"
    : (alerts?.critical ?? 0) > 0
      ? "critical"
      : (alerts?.active ?? 0) > 0
        ? "warning"
        : "healthy";
  const healthLabel = health === "healthy" ? "Hệ thống ổn định" : health === "warning" ? "Cần theo dõi" : health === "critical" ? "Có lỗi nghiêm trọng" : "Chưa kết nối";

  return (
    <section className={styles.aiSection} aria-labelledby="ai-overview-title">
      <header className={styles.aiHeader}>
        <div className={styles.aiTitle}><span><Sparkles size={18} /></span><div><small>AI INTELLIGENCE · LIVE TELEMETRY</small><h2 id="ai-overview-title">Tổng quan vận hành AI</h2><p>Hiệu năng chatbot RAG, chất lượng phản hồi và mức sử dụng LLM.</p></div></div>
        <div className={styles.aiControls}>
          <span className={`${styles.aiHealth} ${health === "healthy" ? "" : styles[health]}`}><i />{healthLabel}</span>
          <select aria-label="Khoảng thời gian thống kê AI" value={range} onChange={(event) => setRange(event.target.value as TimeRange)}><option value="1h">1 giờ</option><option value="24h">24 giờ</option><option value="7d">7 ngày</option><option value="14d">14 ngày</option><option value="30d">30 ngày</option></select>
          <button type="button" onClick={refresh} disabled={refreshing} aria-label="Làm mới thống kê AI"><RefreshCw className={refreshing ? styles.spin : ""} size={16} /></button>
          <Link href="/admin/ai-monitoring">Phân tích sâu <ArrowRight size={14} /></Link>
        </div>
      </header>

      {error && <div className={styles.aiError}><AlertCircle size={16} /><span><strong>Không tải được AI telemetry.</strong> {error}</span><button type="button" onClick={refresh}>Thử lại</button></div>}
      {overview?.data_truncated && <div className={styles.aiNotice}>Dữ liệu đang được giới hạn theo cấu hình OBSERVABILITY_MAX_OBSERVATIONS.</div>}

      {loading && !data ? <div className={styles.aiLoading}><Loader2 size={20} /><span>Đang đọc telemetry từ hệ thống AI…</span></div> : !data ? (
        <div className={styles.aiEmpty}>Chưa có dữ liệu AI telemetry để hiển thị.</div>
      ) : (
        <>
          <div className={styles.aiMetricGrid}>
            <AiMetric icon={Activity} label="Tổng request" value={formatNumber(overview?.requests.total)} note={`${formatNumber(overview?.requests.active_sessions)} phiên hoạt động`} />
            <AiMetric icon={Users} label="Active users" value={formatNumber(overview?.requests.active_users)} note={`Trong ${TIME_RANGE_LABEL[range]}`} />
            <AiMetric icon={Clock3} label="P95 end-to-end" value={formatMs(overview?.latency.p95_ms)} note={`P50 ${formatMs(overview?.latency.p50_ms)} · P99 ${formatMs(overview?.latency.p99_ms)}`} tone={(overview?.latency.p95_ms ?? 0) > 8000 ? "warning" : "default"} />
            <AiMetric icon={AlertCircle} label="Error rate" value={`${Number(overview?.requests.error_rate_pct ?? 0).toFixed(2)}%`} note={`${alerts?.active ?? 0} cảnh báo đang mở`} tone={(overview?.requests.error_rate_pct ?? 0) > 5 ? "danger" : "default"} />
            <AiMetric icon={FileText} label="LLM tokens" value={formatNumber(overview?.llm.total_tokens)} note={`${formatNumber(overview?.llm.calls)} lượt gọi model`} />
            <AiMetric icon={TrendingUp} label="Chi phí LLM" value={formatMoney(overview?.llm.total_cost_usd)} note={`${formatMoney(overview?.llm.avg_cost_per_request_usd)} / request`} />
          </div>

          <div className={styles.aiChartsGrid}>
            <article className={`${styles.aiPanel} ${styles.aiTrafficPanel}`}>
              <div className={styles.aiPanelHeader}><div><h3>Request traffic</h3><p>Phân bố lượt gọi theo bucket thời gian</p></div><span><i /> LIVE</span></div>
              <div className={styles.trafficSummary}><span>Tổng <strong>{formatNumber(overview?.requests.total)}</strong></span><span>Cao nhất / bucket <strong>{formatNumber(overview?.traffic.peak)}</strong></span><span>Trung bình latency <strong>{formatMs(overview?.latency.avg_ms)}</strong></span></div>
              <AiTrafficChart points={overview?.traffic.points ?? []} />
            </article>

            <article className={styles.aiPanel}>
              <div className={styles.aiPanelHeader}><div><h3>Phân vị độ trễ</h3><p>End-to-end latency · không phải thời gian model</p></div><Link href="/admin/ai-monitoring">Chi tiết <ChevronRight size={13} /></Link></div>
              <AiLatencyChart latency={data.overview.latency} />
            </article>

            <article className={styles.aiPanel}>
              <div className={styles.aiPanelHeader}><div><h3>Chất lượng AI & RAG</h3><p>Score ghi nhận trực tiếp trên trace</p></div><Link href="/admin/ai-monitoring/rag">RAG Analytics <ChevronRight size={13} /></Link></div>
              <div className={styles.aiQualityList}>
                <AiQuality label="Groundedness pass" value={scorePercent(overview?.quality, "groundedness_pass")} />
                <AiQuality label="Retrieval success" value={scorePercent(overview?.quality, "retrieval_success")} />
                <AiQuality label="Answer rate" value={scorePercent(overview?.quality, "answer_rate")} />
                <AiQuality label="RAG confidence" value={scorePercent(overview?.quality, "rag_confidence")} />
              </div>
            </article>

            <article className={styles.aiPanel}>
              <div className={styles.aiPanelHeader}><div><h3>Pipeline latency P95</h3><p>Các stage tốn thời gian nhất</p></div><Link href="/admin/ai-monitoring/traces">Traces <ChevronRight size={13} /></Link></div>
              <AiPipeline rows={overview?.pipeline ?? []} />
            </article>

            <article className={styles.aiPanel}>
              <div className={styles.aiPanelHeader}><div><h3>Service health</h3><p>Tình trạng suy ra từ telemetry gần đây</p></div><Link href="/admin/ai-monitoring/errors">Errors <ChevronRight size={13} /></Link></div>
              <AiReliability errorRate={overview?.requests.error_rate_pct ?? 0} activeAlerts={alerts?.active ?? 0} criticalAlerts={alerts?.critical ?? 0} />
              <AiServiceHealth rows={data.overview.service_health ?? []} />
              <div className={styles.aiAlertSummary}><span className={alerts?.critical ? styles.alertCritical : styles.alertSafe}><AlertCircle size={15} />{alerts?.critical ?? 0} critical</span><span>{alerts?.active ?? 0} cảnh báo đang hoạt động</span><Link href="/admin/ai-monitoring/alerts">Xem alerts</Link></div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}

function AiMetric({ icon: Icon, label, value, note, tone = "default" }: { icon: typeof Activity; label: string; value: string; note: string; tone?: "default" | "warning" | "danger" }) {
  return <article className={`${styles.aiMetric} ${tone === "default" ? "" : styles[tone]}`}><span><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>;
}

function AiQuality({ label, value }: { label: string; value: number | null }) {
  const safeValue = value == null ? null : Math.max(0, Math.min(100, value));
  return <div className={styles.aiQuality}><div><span>{label}</span>{safeValue == null ? <small>Chưa có score</small> : <strong>{safeValue.toFixed(1)}%</strong>}</div><div><span style={{ width: `${safeValue ?? 0}%` }} /></div></div>;
}

function AiPipeline({ rows }: { rows: OverviewResponse["pipeline"] }) {
  const sortedRows = [...rows].sort((left, right) => right.p95_ms - left.p95_ms).slice(0, 4);
  const max = Math.max(1, ...sortedRows.map((row) => row.p95_ms));
  if (!sortedRows.length) return <div className={styles.aiEmpty}>Chưa có RAG stage span trong khoảng thời gian này.</div>;
  return <div className={styles.aiPipeline}>{sortedRows.map((row) => <div key={row.name}><span>{row.name.replace(/^rag\./, "")}</span><div><i style={{ width: `${Math.max(2, row.p95_ms / max * 100)}%` }} /></div><strong>{formatMs(row.p95_ms)}</strong><small className={row.errors ? styles.hasError : ""}>{row.errors} err</small></div>)}</div>;
}

function AiLatencyChart({ latency }: { latency: OverviewResponse["latency"] }) {
  const points = [
    { label: "P50", value: latency.p50_ms, tone: "p50" },
    { label: "P95", value: latency.p95_ms, tone: "p95" },
    { label: "P99", value: latency.p99_ms, tone: "p99" },
  ] as const;
  const max = Math.max(1, ...points.map((point) => point.value));
  return <div className={styles.latencyChart}><div className={styles.latencyBars}>{points.map((point) => <div key={point.label}><strong>{formatMs(point.value)}</strong><span><i className={styles[point.tone]} style={{ height: `${Math.max(5, point.value / max * 100)}%` }} /></span><small>{point.label}</small></div>)}</div><p><span>AVG</span><strong>{formatMs(latency.avg_ms)}</strong><em>Thời gian phản hồi trung bình</em></p></div>;
}

function AiServiceHealth({ rows }: { rows: OverviewResponse["service_health"] }) {
  if (!rows.length) return <div className={styles.aiEmpty}>Chưa có dữ liệu service health.</div>;
  const max = Math.max(1, ...rows.map((row) => row.p95_ms));
  return <div className={styles.serviceHealthList}>{rows.slice(0, 5).map((row) => <div key={row.name}><span><i className={row.status === "healthy" ? styles.serviceHealthy : row.status === "error" ? styles.serviceError : styles.serviceWarning} />{row.name}</span><div><i style={{ width: `${Math.max(2, row.p95_ms / max * 100)}%` }} /></div><strong>{formatMs(row.p95_ms)}</strong><small>{Number(row.error_rate_pct || 0).toFixed(1)}% lỗi</small></div>)}</div>;
}

function AiReliability({ errorRate, activeAlerts, criticalAlerts }: { errorRate: number; activeAlerts: number; criticalAlerts: number }) {
  const safeErrorRate = Math.max(0, Math.min(100, errorRate));
  const successRate = 100 - safeErrorRate;
  return <div className={styles.reliabilityOverview}><div className={styles.reliabilityRing} style={{ background: `conic-gradient(#4caf73 0 ${successRate}%, #eb7770 ${successRate}% 100%)` }}><span><strong>{successRate.toFixed(1)}%</strong><small>thành công</small></span></div><div><span>Error rate<strong>{safeErrorRate.toFixed(2)}%</strong></span><span>Active alerts<strong>{activeAlerts}</strong></span><span>Critical<strong className={criticalAlerts ? styles.dangerText : ""}>{criticalAlerts}</strong></span></div></div>;
}

function AiTrafficChart({ points }: { points: OverviewResponse["traffic"]["points"] }) {
  if (!points.length) return <div className={styles.aiEmpty}>Chưa có dữ liệu traffic trong khoảng thời gian này.</div>;
  const max = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : index / (points.length - 1) * 100;
    const y = 88 - point.value / max * 72;
    return `${x},${y}`;
  }).join(" ");
  const areaCoordinates = `0,100 ${coordinates} 100,100`;
  const timeLabel = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  };
  return <div className={styles.aiChart}><div><span /><span /><span /><span /></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Biểu đồ lưu lượng request AI"><defs><linearGradient id="aiTrafficGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b8cff" stopOpacity=".42" /><stop offset="1" stopColor="#8b8cff" stopOpacity="0" /></linearGradient></defs><polygon points={areaCoordinates} fill="url(#aiTrafficGradient)" /><polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><footer><span>{timeLabel(points[0].time)}</span><span>{timeLabel(points[points.length - 1].time)}</span></footer></div>;
}
