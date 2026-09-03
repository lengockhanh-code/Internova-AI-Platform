"use client";

import {
  Activity,
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  KeyRound,
  Loader2,
  Network,
  RefreshCw,
  RotateCcw,
  Save,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import {
  adminConfigurationApi,
  type AdminConfigurationResponse,
  type AdminConfigurationValues,
  type ConfigurationServiceState,
} from "@/services/admin-configuration.service";

import styles from "./page.module.css";

type SectionId = "general" | "ai" | "performance" | "notifications" | "integrations";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Settings2 }> = [
  { id: "general", label: "Tổng quan", icon: Settings2 },
  { id: "ai", label: "AI & RAG", icon: Sparkles },
  { id: "performance", label: "Cache & giới hạn", icon: Gauge },
  { id: "notifications", label: "Thông báo", icon: Clock3 },
  { id: "integrations", label: "Tích hợp", icon: Network },
];

const FIELD_LABELS: Partial<Record<keyof AdminConfigurationValues, string>> = {
  appName: "Tên ứng dụng",
  logLevel: "Mức ghi log",
  sessionTimeoutMinutes: "Thời hạn phiên đăng nhập",
  copilotTimezone: "Múi giờ hệ thống",
  notificationWorkerEnabled: "Worker thông báo",
  notificationPollSeconds: "Chu kỳ kiểm tra thông báo",
  smartDeadlineDaysBefore: "Nhắc trước hạn",
  chatRateLimitEnabled: "Giới hạn tần suất chat",
  chatRateLimitPerMinute: "Số yêu cầu chat mỗi phút",
  llmGuardrailEnabled: "LLM guardrail",
  dynamicConversationEnabled: "Hội thoại động",
  llmRoutingEnabled: "LLM routing",
  generalSupportEnabled: "Hỗ trợ câu hỏi chung",
  chatModel: "Mô hình hội thoại",
  embeddingModel: "Mô hình embedding",
  rerankModel: "Mô hình rerank",
  llmTemperature: "Temperature",
  resultCacheTtlSeconds: "Result cache TTL",
  routeCacheTtlSeconds: "Route cache TTL",
  retrievalCacheTtlSeconds: "Retrieval cache TTL",
  redisEnabled: "Redis cache",
};

const SERVICE_LABELS: Record<string, { label: string; icon: typeof Database }> = {
  database: { label: "PostgreSQL", icon: Database },
  redis: { label: "Redis", icon: Activity },
  openai: { label: "OpenAI", icon: Bot },
  googleAuth: { label: "Google OAuth", icon: KeyRound },
  vectorStore: { label: "Vector Store", icon: ServerCog },
};

const STATUS_LABELS: Record<ConfigurationServiceState, string> = {
  ONLINE: "Đang hoạt động",
  OFFLINE: "Mất kết nối",
  DISABLED: "Đã tắt",
  CONFIGURED: "Đã cấu hình",
  NOT_CONFIGURED: "Chưa cấu hình",
};

function Toggle({ checked, disabled = false, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles.toggleDisabled : ""}`}>
      <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span><i /></span>
    </label>
  );
}

function SettingRow({ title, description, control }: { title: string; description: string; control: ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <div><strong>{title}</strong><p>{description}</p></div>
      <div className={styles.control}>{control}</div>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <header className={styles.sectionHeader}><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div></header>;
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa xác định";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export default function AdminConfigurationPage() {
  const [data, setData] = useState<AdminConfigurationResponse | null>(null);
  const [saved, setSaved] = useState<AdminConfigurationValues | null>(null);
  const [draft, setDraft] = useState<AdminConfigurationValues | null>(null);
  const [section, setSection] = useState<SectionId>("general");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadConfiguration = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await adminConfigurationApi.get();
      setData(response);
      setSaved(response.values);
      setDraft(response.values);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải cấu hình hệ thống.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConfiguration(), 0);
    return () => window.clearTimeout(timer);
  }, [loadConfiguration]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving]);

  const changedKeys = useMemo(() => {
    if (!draft || !saved) return [] as Array<keyof AdminConfigurationValues>;
    return (Object.keys(draft) as Array<keyof AdminConfigurationValues>).filter((key) => draft[key] !== saved[key]);
  }, [draft, saved]);

  const setValue = <K extends keyof AdminConfigurationValues>(key: K, value: AdminConfigurationValues[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const saveConfiguration = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await adminConfigurationApi.update(draft);
      setData(response);
      setSaved(response.values);
      setDraft(response.values);
      setMessage(response.message || "Đã lưu cấu hình.");
      setError("");
      setConfirmOpen(false);
      window.setTimeout(() => setMessage(""), 5000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu cấu hình hệ thống.");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (changedKeys.length) setConfirmOpen(true);
  };

  if (loading && !draft) {
    return <main className={styles.page}><div className={styles.loadingState}><Loader2 className={styles.spin} size={30} /><strong>Đang tải cấu hình hệ thống...</strong></div></main>;
  }

  if (!draft || !data) {
    return <main className={styles.page}><div className={styles.loadingState}><AlertCircle size={32} /><strong>Không thể mở Configuration</strong><p>{error}</p><button onClick={() => void loadConfiguration()} type="button"><RefreshCw size={16} />Thử lại</button></div></main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}><ServerCog size={15} /> QUẢN TRỊ HỆ THỐNG</span><h1>Configuration</h1><p>Quản lý cấu hình vận hành, AI, cache, giới hạn truy cập và trạng thái tích hợp.</p></div>
        <div className={styles.headerMeta}><span className={styles.environment}><i />{data.meta.environment}</span><button className={styles.iconButton} disabled={refreshing} onClick={() => void loadConfiguration(true)} title="Tải lại cấu hình" type="button"><RefreshCw className={refreshing ? styles.spin : ""} size={17} /></button></div>
      </header>

      {message && <div className={styles.successBanner}><CheckCircle2 size={17} /><span>{message}</span><button aria-label="Đóng" onClick={() => setMessage("")} title="Đóng" type="button"><X size={15} /></button></div>}
      {error && <div className={styles.errorBanner} role="alert"><AlertCircle size={17} /><span>{error}</span><button aria-label="Đóng" onClick={() => setError("")} title="Đóng" type="button"><X size={15} /></button></div>}
      {data.meta.restartRequired && <div className={styles.restartBanner}><RefreshCw size={17} /><div><strong>Cần khởi động lại backend</strong><span>Một số tiến trình giữ cấu hình trong bộ nhớ và chỉ nhận giá trị mới sau khi khởi động lại.</span></div></div>}

      <section className={styles.statusStrip}>
        <div><span>TRẠNG THÁI HỆ THỐNG</span><strong>{Object.values(data.services).filter((value) => value === "ONLINE" || value === "CONFIGURED").length}/5 dịch vụ sẵn sàng</strong></div>
        {Object.entries(data.services).map(([key, value]) => {
          const entry = SERVICE_LABELS[key];
          const Icon = entry.icon;
          return <article key={key}><Icon size={17} /><span><strong>{entry.label}</strong><small>{STATUS_LABELS[value]}</small></span><i className={styles[`status${value}`]} /></article>;
        })}
      </section>

      <form className={styles.workspace} onSubmit={submit}>
        <nav className={styles.sectionNav} aria-label="Nhóm cấu hình">
          <div><strong>Cấu hình</strong><span>Nguồn: {data.meta.source}</span></div>
          {SECTIONS.map((item) => { const Icon = item.icon; return <button className={section === item.id ? styles.navActive : ""} key={item.id} onClick={() => setSection(item.id)} type="button"><Icon size={16} />{item.label}{section === item.id && <Check size={14} />}</button>; })}
          <footer><ShieldCheck size={16} /><span><strong>Dữ liệu nhạy cảm được bảo vệ</strong><small>Khóa API và chuỗi kết nối không được trả về trình duyệt.</small></span></footer>
        </nav>

        <div className={styles.settingsContent}>
          {section === "general" && <>
            <SectionHeader icon={<Settings2 size={19} />} title="Cấu hình chung" description="Danh tính ứng dụng, nhật ký, múi giờ và thời hạn phiên truy cập." />
            <div className={styles.settingGroup}>
              <SettingRow title="Tên ứng dụng" description="Tên dịch vụ xuất hiện trong thông tin vận hành." control={<input maxLength={100} onChange={(event) => setValue("appName", event.target.value)} required value={draft.appName} />} />
              <SettingRow title="Môi trường triển khai" description="Được quản lý bởi APP_ENV và không chỉnh sửa từ trang quản trị." control={<div className={styles.readonlyValue}><ShieldCheck size={14} />{data.meta.environment}</div>} />
              <SettingRow title="Mức ghi log" description="Mức chi tiết của nhật ký backend sau khi khởi động lại." control={<select onChange={(event) => setValue("logLevel", event.target.value as AdminConfigurationValues["logLevel"])} value={draft.logLevel}><option value="DEBUG">DEBUG</option><option value="INFO">INFO</option><option value="WARNING">WARNING</option><option value="ERROR">ERROR</option></select>} />
              <SettingRow title="Thời hạn phiên đăng nhập" description="Khoảng thời gian access token còn hiệu lực." control={<div className={styles.numberInput}><input max={10080} min={5} onChange={(event) => setValue("sessionTimeoutMinutes", Number(event.target.value))} required type="number" value={draft.sessionTimeoutMinutes} /><span>phút</span></div>} />
              <SettingRow title="Múi giờ hệ thống" description="Áp dụng cho lịch nhắc việc và các tác vụ Copilot." control={<input list="timezone-options" onChange={(event) => setValue("copilotTimezone", event.target.value)} required value={draft.copilotTimezone} />} />
              <datalist id="timezone-options"><option value="Asia/Ho_Chi_Minh" /><option value="Asia/Bangkok" /><option value="UTC" /></datalist>
            </div>
          </>}

          {section === "ai" && <>
            <SectionHeader icon={<Sparkles size={19} />} title="AI & RAG" description="Mô hình và các lớp kiểm soát đang dùng cho hội thoại và truy xuất tri thức." />
            <div className={styles.settingGroup}>
              <SettingRow title="Mô hình hội thoại" description="Mô hình sinh câu trả lời chính của chatbot." control={<input maxLength={150} onChange={(event) => setValue("chatModel", event.target.value)} required value={draft.chatModel} />} />
              <SettingRow title="Mô hình embedding" description="Thay đổi giá trị này yêu cầu xây dựng lại RAG index." control={<input maxLength={150} onChange={(event) => setValue("embeddingModel", event.target.value)} required value={draft.embeddingModel} />} />
              <SettingRow title="Mô hình rerank" description="Mô hình xếp hạng lại bằng chứng truy xuất." control={<input maxLength={150} onChange={(event) => setValue("rerankModel", event.target.value)} required value={draft.rerankModel} />} />
              <SettingRow title="Temperature" description="Giá trị thấp ưu tiên tính ổn định; giá trị cao tăng độ đa dạng." control={<div className={styles.rangeControl}><input max={2} min={0} onChange={(event) => setValue("llmTemperature", Number(event.target.value))} step={0.1} type="range" value={draft.llmTemperature} /><output>{draft.llmTemperature.toFixed(1)}</output></div>} />
              <SettingRow title="LLM guardrail" description="Kiểm tra bổ sung trước khi trả nội dung cho người dùng." control={<Toggle checked={draft.llmGuardrailEnabled} onChange={(value) => setValue("llmGuardrailEnabled", value)} />} />
              <SettingRow title="LLM routing" description="Cho phép bộ định tuyến dùng mô hình để chọn luồng xử lý." control={<Toggle checked={draft.llmRoutingEnabled} onChange={(value) => setValue("llmRoutingEnabled", value)} />} />
              <SettingRow title="Hội thoại động" description="Giữ ngữ cảnh linh hoạt giữa các lượt trò chuyện." control={<Toggle checked={draft.dynamicConversationEnabled} onChange={(value) => setValue("dynamicConversationEnabled", value)} />} />
              <SettingRow title="Hỗ trợ câu hỏi chung" description="Cho phép chatbot xử lý câu hỏi ngoài phạm vi quy trình thực tập." control={<Toggle checked={draft.generalSupportEnabled} onChange={(value) => setValue("generalSupportEnabled", value)} />} />
            </div>
          </>}

          {section === "performance" && <>
            <SectionHeader icon={<Gauge size={19} />} title="Cache & giới hạn" description="Kiểm soát thời gian lưu cache và lưu lượng hội thoại." />
            <div className={styles.settingGroup}>
              <SettingRow title="Redis cache" description="Kích hoạt cache và khóa phân tán cho pipeline chatbot." control={<Toggle checked={draft.redisEnabled} onChange={(value) => setValue("redisEnabled", value)} />} />
              <SettingRow title="Result cache TTL" description="Thời gian giữ câu trả lời RAG hoàn chỉnh." control={<div className={styles.numberInput}><input max={86400} min={0} onChange={(event) => setValue("resultCacheTtlSeconds", Number(event.target.value))} type="number" value={draft.resultCacheTtlSeconds} /><span>giây</span></div>} />
              <SettingRow title="Route cache TTL" description="Thời gian lưu kết quả phân loại và định tuyến." control={<div className={styles.numberInput}><input max={86400} min={0} onChange={(event) => setValue("routeCacheTtlSeconds", Number(event.target.value))} type="number" value={draft.routeCacheTtlSeconds} /><span>giây</span></div>} />
              <SettingRow title="Retrieval cache TTL" description="Thời gian lưu kết quả tìm kiếm vector, BM25 và RRF." control={<div className={styles.numberInput}><input max={86400} min={0} onChange={(event) => setValue("retrievalCacheTtlSeconds", Number(event.target.value))} type="number" value={draft.retrievalCacheTtlSeconds} /><span>giây</span></div>} />
              <SettingRow title="Giới hạn tần suất chat" description="Bảo vệ API chatbot trước lượng yêu cầu bất thường." control={<Toggle checked={draft.chatRateLimitEnabled} onChange={(value) => setValue("chatRateLimitEnabled", value)} />} />
              <SettingRow title="Số yêu cầu mỗi phút" description="Giới hạn áp dụng cho từng người dùng khi rate limit hoạt động." control={<div className={styles.numberInput}><input disabled={!draft.chatRateLimitEnabled} max={1000} min={1} onChange={(event) => setValue("chatRateLimitPerMinute", Number(event.target.value))} type="number" value={draft.chatRateLimitPerMinute} /><span>req/phút</span></div>} />
            </div>
          </>}

          {section === "notifications" && <>
            <SectionHeader icon={<Clock3 size={19} />} title="Thông báo & nhắc hạn" description="Lịch chạy worker và thời điểm tạo nhắc việc thông minh." />
            <div className={styles.settingGroup}>
              <SettingRow title="Worker thông báo" description="Cho phép tiến trình nền tạo thông báo định kỳ." control={<Toggle checked={draft.notificationWorkerEnabled} onChange={(value) => setValue("notificationWorkerEnabled", value)} />} />
              <SettingRow title="Chu kỳ kiểm tra" description="Khoảng nghỉ giữa hai lần worker kiểm tra công việc đến hạn." control={<div className={styles.numberInput}><input disabled={!draft.notificationWorkerEnabled} max={3600} min={30} onChange={(event) => setValue("notificationPollSeconds", Number(event.target.value))} type="number" value={draft.notificationPollSeconds} /><span>giây</span></div>} />
              <SettingRow title="Nhắc trước hạn" description="Số ngày Copilot gửi nhắc trước deadline báo cáo hoặc công việc." control={<div className={styles.numberInput}><input max={30} min={0} onChange={(event) => setValue("smartDeadlineDaysBefore", Number(event.target.value))} type="number" value={draft.smartDeadlineDaysBefore} /><span>ngày</span></div>} />
              <SettingRow title="Múi giờ lịch chạy" description="Tất cả mốc nhắc hạn được quy đổi theo múi giờ hệ thống." control={<div className={styles.readonlyValue}><Clock3 size={14} />{draft.copilotTimezone}</div>} />
            </div>
          </>}

          {section === "integrations" && <>
            <SectionHeader icon={<Network size={19} />} title="Tích hợp & hạ tầng" description="Trạng thái kết nối hiện tại; thông tin xác thực luôn được ẩn." />
            <div className={styles.integrationGrid}>
              {Object.entries(data.services).map(([key, value]) => { const entry = SERVICE_LABELS[key]; const Icon = entry.icon; return <article key={key}><span className={styles.serviceIcon}><Icon size={19} /></span><div><strong>{entry.label}</strong><p>{STATUS_LABELS[value]}</p></div><span className={`${styles.serviceBadge} ${styles[`badge${value}`]}`}>{value === "ONLINE" || value === "CONFIGURED" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}{STATUS_LABELS[value]}</span></article>; })}
            </div>
            <div className={styles.securityNotice}><ShieldCheck size={20} /><div><strong>Thông tin xác thực không được hiển thị</strong><p>API key, JWT secret, Redis URL và chuỗi kết nối database chỉ được quản lý tại môi trường triển khai.</p></div></div>
          </>}
        </div>

        <footer className={styles.saveBar}>
          <div><strong>{changedKeys.length ? `${changedKeys.length} thay đổi chưa lưu` : "Cấu hình đã đồng bộ"}</strong><span>Cập nhật gần nhất: {formatDate(data.meta.updatedAt)}</span></div>
          <div><button disabled={!changedKeys.length || saving} onClick={() => setDraft(saved)} type="button"><RotateCcw size={16} />Hoàn tác</button><button className={styles.saveButton} disabled={!changedKeys.length || saving} type="submit"><Save size={16} />Lưu thay đổi</button></div>
        </footer>
      </form>

      {confirmOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmOpen(false); }}><section className={styles.confirmModal}><span className={styles.confirmIcon}><SlidersHorizontal size={22} /></span><h2>Xác nhận cập nhật cấu hình</h2><p>{changedKeys.length} giá trị sẽ được ghi vào nguồn cấu hình của backend.</p><ul>{changedKeys.slice(0, 6).map((key) => <li key={key}><Check size={13} />{FIELD_LABELS[key] || key}</li>)}{changedKeys.length > 6 && <li>Và {changedKeys.length - 6} thay đổi khác</li>}</ul><div className={styles.confirmWarning}><RefreshCw size={15} />Cần khởi động lại backend để mọi tiến trình nhận cấu hình mới.</div><footer><button disabled={saving} onClick={() => setConfirmOpen(false)} type="button">Hủy</button><button className={styles.saveButton} disabled={saving} onClick={() => void saveConfiguration()} type="button">{saving ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />}Xác nhận lưu</button></footer></section></div>}
    </main>
  );
}
