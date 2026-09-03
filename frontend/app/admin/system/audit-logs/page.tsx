"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Copy,
  Download,
  Eye,
  FileClock,
  FilterX,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminAuditLogsApi,
  type AdminAuditLog,
  type AdminAuditLogsResponse,
  type AuditLogFilters,
  type AuditSeverity,
} from "@/services/admin-audit-logs.service";
import styles from "./page.module.css";

const CATEGORY_LABELS: Record<string, string> = {
  ACCOUNT: "Tài khoản",
  ACCESS: "Quyền truy cập",
  KNOWLEDGE: "Knowledge Base",
  RAG: "RAG & Index",
  INTERNSHIP: "Thực tập",
  EVALUATION: "Đánh giá",
  OBSERVABILITY: "Giám sát",
  SYSTEM: "Hệ thống",
};

const ACTION_LABELS: Record<string, string> = {
  USER_CREATED: "Tạo tài khoản",
  USER_UPDATED: "Cập nhật tài khoản",
  USER_STATUS_CHANGED: "Đổi trạng thái tài khoản",
  LECTURER_CREATED: "Tạo giảng viên",
  LECTURER_UPDATED: "Cập nhật giảng viên",
  LECTURER_STATUS_CHANGED: "Đổi trạng thái giảng viên",
  LECTURER_DEACTIVATED: "Vô hiệu hóa giảng viên",
  STUDENT_CREATED: "Tạo hồ sơ sinh viên",
  STUDENT_UPDATED: "Cập nhật sinh viên",
  STUDENT_DEACTIVATED: "Vô hiệu hóa sinh viên",
  DOCUMENT_CREATED: "Tạo tài liệu",
  DOCUMENT_UPDATED: "Cập nhật tài liệu",
  DOCUMENT_DELETED: "Xóa tài liệu",
  DOCUMENT_ARCHIVED: "Lưu trữ tài liệu",
  DOCUMENT_VERSION_CREATED: "Tải phiên bản mới",
  DOCUMENT_VERSION_ACTIVATED: "Đổi phiên bản hiện hành",
  RAG_INDEX_REBUILT: "Xây dựng lại RAG index",
  RAG_PIPELINE_RELOADED: "Nạp lại RAG pipeline",
  INTERNSHIP_REVIEWED: "Xét duyệt thực tập",
  ALERT_STATE_CHANGED: "Cập nhật cảnh báo",
  SYSTEM_CONFIGURATION_UPDATED: "Cập nhật cấu hình hệ thống",
  AUDIT_LOGGING_ENABLED: "Kích hoạt Audit Logs",
  ADMIN_CHANGE: "Thay đổi hệ thống",
};

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  CRITICAL: "Nghiêm trọng",
};

const EMPTY_DATA: AdminAuditLogsResponse = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  summary: { total: 0, success: 0, failed: 0, highRisk: 0, activeActors: 0, successRate: 0 },
  trend: [],
  categories: [],
  actors: [],
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

function shortTime(value: string): { date: string; time: string } {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date),
  };
}

export default function AdminAuditLogsPage() {
  const [data, setData] = useState<AdminAuditLogsResponse>(EMPTY_DATA);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [severity, setSeverity] = useState("");
  const [actorId, setActorId] = useState("");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminAuditLog | null>(null);
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState("");

  const filters = useMemo<AuditLogFilters>(() => ({
    search,
    category,
    outcome,
    severity,
    actorId: actorId ? Number(actorId) : null,
    timeRange,
    page,
    pageSize: 20,
  }), [actorId, category, outcome, page, search, severity, timeRange]);

  const loadLogs = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await adminAuditLogsApi.list(filters);
      setData(response);
      setError("");
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải audit log.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs, search]);

  useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => void loadLogs(true), 30000);
    return () => window.clearInterval(interval);
  }, [live, loadLogs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setOutcome("");
    setSeverity("");
    setActorId("");
    setTimeRange("7d");
    setPage(1);
  };

  const hasFilters = Boolean(search || category || outcome || severity || actorId || timeRange !== "7d");
  const trendMax = Math.max(1, ...data.trend.map((item) => item.success + item.failed));

  const exportCsv = async () => {
    setExporting(true);
    try {
      await adminAuditLogsApi.exportCsv(filters);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Không thể xuất audit log.");
    } finally {
      setExporting(false);
    }
  };

  const copyValue = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1400);
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><ShieldCheck size={15} /> HỆ THỐNG</span>
          <h1>Audit Logs</h1>
          <p>Theo dõi đầy đủ thao tác quản trị, thay đổi quyền và sự kiện ảnh hưởng hệ thống.</p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.liveToggle} title="Tự động làm mới mỗi 30 giây">
            <input checked={live} onChange={(event) => setLive(event.target.checked)} type="checkbox" />
            <span aria-hidden="true" />
            Live
          </label>
          <button className={styles.iconButton} disabled={refreshing} onClick={() => void loadLogs(true)} title="Làm mới" type="button">
            <RefreshCw className={refreshing ? styles.spin : ""} size={17} />
          </button>
          <button className={styles.exportButton} disabled={exporting} onClick={() => void exportCsv()} type="button">
            {exporting ? <Loader2 className={styles.spin} size={16} /> : <Download size={16} />} Xuất CSV
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBanner} role="alert"><AlertCircle size={17} /><span>{error}</span><button aria-label="Đóng" onClick={() => setError("")} title="Đóng" type="button"><X size={16} /></button></div>}

      <section className={styles.statsGrid} aria-label="Tổng quan audit">
        <article><span className={styles.statIcon}><Activity size={19} /></span><div><small>SỰ KIỆN TRONG KỲ</small><strong>{data.summary.total.toLocaleString("vi-VN")}</strong><em>{timeRange === "all" ? "Toàn bộ dữ liệu" : `Phạm vi ${timeRange}`}</em></div></article>
        <article><span className={styles.statIcon}><CheckCircle2 size={19} /></span><div><small>TỶ LỆ THÀNH CÔNG</small><strong>{data.summary.successRate}%</strong><em>{data.summary.success.toLocaleString("vi-VN")} thao tác hoàn tất</em></div></article>
        <article><span className={styles.statIcon}><ShieldAlert size={19} /></span><div><small>THẤT BẠI / RỦI RO CAO</small><strong>{data.summary.failed} <i>/ {data.summary.highRisk}</i></strong><em>Cần được rà soát</em></div></article>
        <article><span className={styles.statIcon}><Users size={19} /></span><div><small>QUẢN TRỊ VIÊN HOẠT ĐỘNG</small><strong>{data.summary.activeActors}</strong><em>Số actor khác nhau trong kỳ</em></div></article>
      </section>

      <section className={styles.insightBand}>
        <div className={styles.trendBlock}>
          <div className={styles.sectionHeading}><div><h2>Hoạt động 7 ngày</h2><p>Thành công và thất bại theo ngày</p></div><div className={styles.legend}><span><i className={styles.successDot} />Thành công</span><span><i className={styles.failedDot} />Thất bại</span></div></div>
          <div className={styles.trendChart}>
            {data.trend.map((item) => {
              const total = item.success + item.failed;
              return <div className={styles.trendColumn} key={item.date} title={`${item.date}: ${total} sự kiện`}><div className={styles.barTrack}><span className={styles.successBar} style={{ height: `${(item.success / trendMax) * 100}%` }} /><span className={styles.failedBar} style={{ height: `${(item.failed / trendMax) * 100}%` }} /></div><small>{new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(new Date(`${item.date}T00:00:00`))}</small></div>;
            })}
          </div>
        </div>
        <div className={styles.categoryBlock}>
          <div className={styles.sectionHeading}><div><h2>Nhóm hoạt động</h2><p>Phân bổ trong phạm vi đang chọn</p></div></div>
          <div className={styles.categoryList}>
            {data.categories.slice(0, 5).map((item) => <button className={category === item.value ? styles.categoryActive : ""} key={item.value} onClick={() => updateFilter(setCategory, category === item.value ? "" : item.value)} type="button"><span>{CATEGORY_LABELS[item.value] ?? item.label}</span><strong>{item.count}</strong></button>)}
            {!data.categories.length && <span className={styles.noCategory}>Chưa có dữ liệu phân loại</span>}
          </div>
        </div>
      </section>

      <section className={styles.logPanel}>
        <div className={styles.toolbar}>
          <label className={styles.searchBox}><Search size={16} /><input aria-label="Tìm audit log" onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Tìm hành động, actor, resource, request ID..." value={search} />{search && <button aria-label="Xóa tìm kiếm" onClick={() => updateFilter(setSearch, "")} title="Xóa" type="button"><X size={14} /></button>}</label>
          <select aria-label="Khoảng thời gian" onChange={(event) => { setTimeRange(event.target.value as typeof timeRange); setPage(1); }} value={timeRange}><option value="24h">24 giờ qua</option><option value="7d">7 ngày qua</option><option value="30d">30 ngày qua</option><option value="all">Toàn bộ</option></select>
          <select aria-label="Nhóm hoạt động" onChange={(event) => updateFilter(setCategory, event.target.value)} value={category}><option value="">Tất cả nhóm</option>{data.categories.map((item) => <option key={item.value} value={item.value}>{CATEGORY_LABELS[item.value] ?? item.label} ({item.count})</option>)}</select>
          <select aria-label="Kết quả" onChange={(event) => updateFilter(setOutcome, event.target.value)} value={outcome}><option value="">Mọi kết quả</option><option value="SUCCESS">Thành công</option><option value="FAILED">Thất bại</option></select>
          <select aria-label="Mức độ" onChange={(event) => updateFilter(setSeverity, event.target.value)} value={severity}><option value="">Mọi mức độ</option><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option><option value="CRITICAL">Nghiêm trọng</option></select>
          <select aria-label="Người thực hiện" onChange={(event) => updateFilter(setActorId, event.target.value)} value={actorId}><option value="">Mọi quản trị viên</option>{data.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select>
          <button className={styles.clearButton} disabled={!hasFilters} onClick={clearFilters} title="Xóa bộ lọc" type="button"><FilterX size={16} /></button>
        </div>

        <div className={styles.tableTitle}><div><h2>Nhật ký hoạt động</h2><p>Bản ghi audit bất biến, sắp xếp mới nhất trước</p></div><span>{lastUpdated ? `Cập nhật ${lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đang đồng bộ"}</span></div>

        {loading ? <div className={styles.state}><Loader2 className={styles.spin} size={28} /><strong>Đang tải audit log...</strong></div> : data.items.length === 0 ? <div className={styles.state}><FileClock size={31} /><strong>Chưa có sự kiện phù hợp</strong><p>Thử mở rộng khoảng thời gian hoặc xóa bớt bộ lọc hiện tại.</p>{hasFilters && <button onClick={clearFilters} type="button">Xóa bộ lọc</button>}</div> : <div className={styles.tableWrap}><table><thead><tr><th>THỜI GIAN</th><th>NGƯỜI THỰC HIỆN</th><th>HÀNH ĐỘNG</th><th>ĐỐI TƯỢNG</th><th>KẾT QUẢ</th><th>MỨC ĐỘ</th><th>IP / HTTP</th><th aria-label="Chi tiết" /></tr></thead><tbody>{data.items.map((item) => { const time = shortTime(item.createdAt); return <tr key={item.id} onClick={() => setSelected(item)}><td><span className={styles.timeCell}><strong>{time.time}</strong><small>{time.date}</small></span></td><td><span className={styles.actorCell}><i>{initials(item.actor.name)}</i><span><strong>{item.actor.name}</strong><small>{item.actor.email ?? item.actor.role ?? "Không xác định"}</small></span></span></td><td><span className={styles.actionCell}><strong>{ACTION_LABELS[item.action] ?? item.action}</strong><small>{CATEGORY_LABELS[item.category] ?? item.category}</small></span></td><td><span className={styles.resourceCell}><strong>{item.resourceLabel ?? "Hệ thống"}</strong><small>{item.resourceType ?? "SYSTEM"}</small></span></td><td><span className={`${styles.outcome} ${item.outcome === "SUCCESS" ? styles.success : styles.failed}`}>{item.outcome === "SUCCESS" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}{item.outcome === "SUCCESS" ? "Thành công" : "Thất bại"}</span></td><td><span className={`${styles.severity} ${styles[`severity${item.severity}`]}`}>{SEVERITY_LABELS[item.severity]}</span></td><td><span className={styles.httpCell}><strong>{item.ipAddress ?? "-"}</strong><small><b>{item.httpMethod}</b> {item.httpStatus} · {item.durationMs}ms</small></span></td><td><button className={styles.viewButton} onClick={(event) => { event.stopPropagation(); setSelected(item); }} title="Xem chi tiết" type="button"><Eye size={16} /></button></td></tr>; })}</tbody></table></div>}

        {!loading && data.items.length > 0 && <footer className={styles.pagination}><span>Hiển thị {(data.page - 1) * data.pageSize + 1}-{Math.min(data.page * data.pageSize, data.total)} trong {data.total.toLocaleString("vi-VN")} bản ghi</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} title="Trang trước" type="button"><ChevronLeft size={16} /></button><strong>Trang {data.page} / {data.totalPages}</strong><button disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)} title="Trang sau" type="button"><ChevronRight size={16} /></button></div></footer>}
      </section>

      {selected && <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside aria-modal="true" className={styles.drawer} role="dialog"><header><div><span>CHI TIẾT SỰ KIỆN</span><h2>{ACTION_LABELS[selected.action] ?? selected.action}</h2><p>{formatDateTime(selected.createdAt)}</p></div><button aria-label="Đóng" onClick={() => setSelected(null)} title="Đóng" type="button"><X size={18} /></button></header><div className={styles.drawerBody}><section className={styles.eventStatus}><span className={`${styles.outcome} ${selected.outcome === "SUCCESS" ? styles.success : styles.failed}`}>{selected.outcome === "SUCCESS" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{selected.outcome === "SUCCESS" ? "Thành công" : "Thất bại"}</span><span className={`${styles.severity} ${styles[`severity${selected.severity}`]}`}>{SEVERITY_LABELS[selected.severity]}</span><span>{CATEGORY_LABELS[selected.category] ?? selected.category}</span></section><section className={styles.detailSection}><h3><CircleUserRound size={15} /> Người thực hiện</h3><dl><div><dt>Họ tên</dt><dd>{selected.actor.name}</dd></div><div><dt>Email</dt><dd>{selected.actor.email ?? "Không xác định"}</dd></div><div><dt>Vai trò</dt><dd>{selected.actor.role ?? "Không xác định"}</dd></div><div><dt>Địa chỉ IP</dt><dd>{selected.ipAddress ?? "Không xác định"}</dd></div></dl></section><section className={styles.detailSection}><h3><Activity size={15} /> Thao tác</h3><p className={styles.detailText}>{selected.detail}</p><dl><div><dt>Đối tượng</dt><dd>{selected.resourceLabel ?? "Hệ thống"}</dd></div><div><dt>Loại</dt><dd>{selected.resourceType ?? "SYSTEM"}</dd></div><div><dt>HTTP</dt><dd><code>{selected.httpMethod} {selected.httpStatus}</code></dd></div><div><dt>Thời lượng</dt><dd>{selected.durationMs} ms</dd></div></dl><code className={styles.path}>{selected.requestPath}</code></section><section className={styles.detailSection}><h3><Clock3 size={15} /> Định danh truy vết</h3>{[["Event ID", selected.eventId, "event"], ["Request ID", selected.requestId, "request"]].map(([label, value, key]) => <div className={styles.copyRow} key={key}><span><small>{label}</small><code>{value}</code></span><button onClick={() => void copyValue(value, key)} title={`Sao chép ${label}`} type="button"><Copy size={14} />{copied === key ? "Đã chép" : "Sao chép"}</button></div>)}</section><section className={styles.detailSection}><h3>Metadata an toàn</h3><pre>{JSON.stringify(selected.metadata, null, 2)}</pre><small className={styles.privacyNote}>Request body, token và thông tin xác thực không được lưu trong audit log.</small></section><section className={styles.detailSection}><h3>Thiết bị</h3><p className={styles.userAgent}>{selected.userAgent ?? "Không có thông tin user agent."}</p></section></div></aside></div>}
    </main>
  );
}
