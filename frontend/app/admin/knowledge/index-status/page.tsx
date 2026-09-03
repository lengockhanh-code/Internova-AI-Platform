"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  HardDrive,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  adminKnowledgeBaseApi,
  formatDateTime,
  KnowledgeBaseApiError,
  type KnowledgeIndexStatus,
  type KnowledgeReindexResponse,
} from "@/lib/adminKnowledgeBase";

import styles from "./page.module.css";

type StatusTone = "ready" | "degraded" | "notReady";

const STATUS_COPY: Record<StatusTone, { label: string; description: string }> = {
  ready: {
    label: "Sẵn sàng phục vụ",
    description: "Active index đầy đủ và đang được chatbot sử dụng.",
  },
  degraded: {
    label: "Hoạt động hạn chế",
    description: "Active index tồn tại nhưng có thành phần chưa sẵn sàng.",
  },
  notReady: {
    label: "Chưa sẵn sàng",
    description: "Chưa có active index hợp lệ để phục vụ truy vấn.",
  },
};

function toneOf(status: string | null | undefined): StatusTone {
  if (status === "READY") return "ready";
  if (status === "DEGRADED") return "degraded";
  return "notReady";
}

function formatDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
): string {
  if (!startedAt) return "-";

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "-";

  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining ? `${minutes} phút ${remaining} giây` : `${minutes} phút`;
}

function relativeTime(value: string | null | undefined, now: number): string {
  if (!value) return "Chưa từng kích hoạt";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Không xác định";

  const seconds = Math.round((time - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function jobLabel(status: string | null): string {
  switch (status) {
    case "RUNNING": return "Đang chạy";
    case "COMPLETED": return "Hoàn tất";
    case "FAILED": return "Thất bại";
    default: return status || "Chưa có job";
  }
}

export default function AdminKnowledgeIndexStatusPage() {
  const [indexStatus, setIndexStatus] = useState<KnowledgeIndexStatus | null>(null);
  const [result, setResult] = useState<KnowledgeReindexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const requestId = useRef(0);

  const loadStatus = useCallback(async (quiet = false) => {
    const currentRequest = ++requestId.current;
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await adminKnowledgeBaseApi.indexStatus();
      if (currentRequest !== requestId.current) return;
      setIndexStatus(response);
      setUpdatedAt(Date.now());
      setError("");
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải trạng thái RAG index.",
      );
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadStatus(), 0);
    const refreshTimer = window.setInterval(() => void loadStatus(true), 30_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      requestId.current += 1;
    };
  }, [loadStatus]);

  const tone = toneOf(indexStatus?.status);
  const statusCopy = STATUS_COPY[tone];
  const externalJobRunning = indexStatus?.lastJobStatus === "RUNNING";

  const checks = useMemo(() => indexStatus ? [
    {
      name: "Active pointer",
      detail: "Con trỏ tới bản build đang phục vụ",
      ready: indexStatus.pointerExists && !indexStatus.pointerError,
      icon: Server,
    },
    {
      name: "Chroma vector store",
      detail: "Kho vector cho semantic retrieval",
      ready: indexStatus.chromaReady,
      icon: Database,
    },
    {
      name: "BM25 lexical index",
      detail: "Chỉ mục từ khóa cho hybrid search",
      ready: indexStatus.bm25Ready,
      icon: Search,
    },
    {
      name: "Index manifest",
      detail: "Metadata và số liệu của active build",
      ready: indexStatus.manifestReady,
      icon: FileCheck2,
    },
  ] : [], [indexStatus]);

  const readyChecks = checks.filter(check => check.ready).length;

  const startReindex = async () => {
    setConfirmOpen(false);
    setReindexing(true);
    setResult(null);
    setError("");

    try {
      const response = await adminKnowledgeBaseApi.reindex();
      setResult(response);
      await loadStatus(true);
    } catch (reindexError) {
      const message = reindexError instanceof KnowledgeBaseApiError && reindexError.status === 409
        ? "Một tiến trình rebuild khác đang chạy. Trạng thái sẽ tiếp tục được cập nhật tự động."
        : reindexError instanceof Error
          ? reindexError.message
          : "Không thể rebuild RAG index.";
      setError(message);
      await loadStatus(true);
    } finally {
      setReindexing(false);
    }
  };

  const copyBuildId = async () => {
    if (!indexStatus?.activeBuildId) return;
    await navigator.clipboard.writeText(indexStatus.activeBuildId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><Database size={15} /> KNOWLEDGE BASE</span>
          <h1>RAG Index Status</h1>
          <p>Theo dõi active build và sức khỏe các thành phần retrieval.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.liveStatus} ${styles[tone]}`}>
            <i />{indexStatus?.status ?? (loading ? "LOADING" : "UNKNOWN")}
          </span>
          <button
            aria-label="Làm mới trạng thái"
            className={styles.iconButton}
            disabled={refreshing || loading}
            onClick={() => void loadStatus(true)}
            title="Làm mới trạng thái"
            type="button"
          >
            <RefreshCw className={refreshing ? styles.spin : ""} size={17} />
          </button>
          <button
            className={styles.primaryButton}
            disabled={reindexing || externalJobRunning}
            onClick={() => setConfirmOpen(true)}
            type="button"
          >
            {reindexing || externalJobRunning
              ? <Loader2 className={styles.spin} size={16} />
              : <RotateCcw size={16} />}
            {reindexing ? "Đang rebuild" : externalJobRunning ? "Job đang chạy" : "Rebuild index"}
          </button>
        </div>
      </header>

      {loading && !indexStatus && (
        <section className={styles.state}>
          <Loader2 className={styles.spin} size={25} />
          <p>Đang kiểm tra active RAG index...</p>
        </section>
      )}

      {error && (
        <section className={styles.errorBanner} role="alert">
          <AlertCircle size={18} />
          <div><strong>Không thể cập nhật trạng thái</strong><span>{error}</span></div>
          <button onClick={() => void loadStatus()} type="button">Thử lại</button>
        </section>
      )}

      {reindexing && (
        <section className={styles.progressBanner} aria-live="polite">
          <Loader2 className={styles.spin} size={19} />
          <div>
            <strong>Đang tạo RAG index mới</strong>
            <span>Active build hiện tại vẫn tiếp tục phục vụ trong lúc xử lý.</span>
          </div>
        </section>
      )}

      {result && (
        <section className={styles.successBanner} aria-live="polite">
          <CheckCircle2 size={19} />
          <div>
            <strong>Rebuild hoàn tất trong {result.durationSeconds.toFixed(1)} giây</strong>
            <span>{result.documentsIndexed} tài liệu · {result.chunksCreated} chunks · {result.buildId}</span>
          </div>
          <Link href="/admin/knowledge/chunks">Xem chunks <ArrowRight size={14} /></Link>
        </section>
      )}

      {indexStatus && (
        <>
          <section className={`${styles.statusBand} ${styles[tone]}`}>
            <div className={styles.statusIcon}>
              {tone === "ready"
                ? <ShieldCheck />
                : tone === "degraded"
                  ? <TriangleAlert />
                  : <AlertCircle />}
            </div>
            <div className={styles.statusMessage}>
              <span>TRẠNG THÁI PHỤC VỤ</span>
              <h2>{statusCopy.label}</h2>
              <p>{statusCopy.description}</p>
            </div>
            <div className={styles.statusScore}>
              <strong>{readyChecks}/{checks.length}</strong>
              <span>thành phần sẵn sàng</span>
            </div>
          </section>

          <section className={styles.summaryGrid} aria-label="Tổng quan active index">
            <div><FileText /><span>Tài liệu<strong>{indexStatus.documentsIndexed}</strong><small>Trong manifest</small></span></div>
            <div><Layers3 /><span>Chunks<strong>{indexStatus.chunksIndexed}</strong><small>Đang phục vụ retrieval</small></span></div>
            <div><Activity /><span>Health checks<strong>{readyChecks}/{checks.length}</strong><small>{readyChecks === checks.length ? "Tất cả bình thường" : "Cần kiểm tra"}</small></span></div>
            <div><Clock3 /><span>Kích hoạt<strong>{relativeTime(indexStatus.activatedAt, now)}</strong><small>{formatDateTime(indexStatus.activatedAt)}</small></span></div>
          </section>

          <div className={styles.contentGrid}>
            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <div><h2>Sức khỏe retrieval</h2><p>Kiểm tra các artifact của active build</p></div>
                <span>{readyChecks === checks.length ? "HEALTHY" : "ATTENTION"}</span>
              </header>
              <div className={styles.checkList}>
                {checks.map(check => {
                  const Icon = check.icon;
                  return (
                    <div className={styles.checkRow} key={check.name}>
                      <div className={styles.checkIcon}><Icon size={17} /></div>
                      <div><strong>{check.name}</strong><span>{check.detail}</span></div>
                      <span className={check.ready ? styles.checkReady : styles.checkFailed}>
                        {check.ready ? <Check size={14} /> : <X size={14} />}
                        {check.ready ? "Ready" : "Unavailable"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <div><h2>Active deployment</h2><p>Bản index chatbot đang sử dụng</p></div>
                <HardDrive size={18} />
              </header>
              <dl className={styles.detailList}>
                <div className={styles.buildRow}>
                  <dt>Build ID</dt>
                  <dd title={indexStatus.activeBuildId ?? undefined}>{indexStatus.activeBuildId ?? "-"}</dd>
                  <button
                    aria-label="Sao chép build ID"
                    disabled={!indexStatus.activeBuildId}
                    onClick={() => void copyBuildId()}
                    title="Sao chép build ID"
                    type="button"
                  >
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                  </button>
                </div>
                <div><dt>Kích hoạt lúc</dt><dd>{formatDateTime(indexStatus.activatedAt)}</dd></div>
                <div><dt>Active pointer</dt><dd>{indexStatus.pointerExists ? "Đã xuất bản" : "Không tồn tại"}</dd></div>
                <div><dt>Cập nhật màn hình</dt><dd>{updatedAt ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(updatedAt) : "-"}</dd></div>
              </dl>
              <footer className={styles.panelLinks}>
                <Link href="/admin/knowledge/documents">Documents <ArrowRight size={14} /></Link>
                <Link href="/admin/knowledge/chunks">Chunks <ArrowRight size={14} /></Link>
              </footer>
            </section>
          </div>

          <section className={styles.jobPanel}>
            <header className={styles.panelHeader}>
              <div><h2>Index job gần nhất</h2><p>Lần rebuild mới nhất được ghi nhận trong hệ thống</p></div>
              <span className={`${styles.jobBadge} ${styles[`job${indexStatus.lastJobStatus || "Unknown"}`]}`}>
                {indexStatus.lastJobStatus === "RUNNING" && <Loader2 className={styles.spin} size={13} />}
                {jobLabel(indexStatus.lastJobStatus)}
              </span>
            </header>
            <div className={styles.jobMetrics}>
              <div><span>Bắt đầu</span><strong>{formatDateTime(indexStatus.lastJobStartedAt)}</strong></div>
              <div><span>Hoàn tất</span><strong>{formatDateTime(indexStatus.lastJobCompletedAt)}</strong></div>
              <div><span>Thời lượng</span><strong>{formatDuration(indexStatus.lastJobStartedAt, indexStatus.lastJobCompletedAt)}</strong></div>
              <div><span>Kết quả phục vụ</span><strong>{indexStatus.status}</strong></div>
            </div>
          </section>

          {(indexStatus.pointerError || indexStatus.lastJobError) ? (
            <section className={styles.diagnosticsError}>
              <TriangleAlert size={18} />
              <div>
                <strong>Phát hiện lỗi index</strong>
                {indexStatus.pointerError && <p>Pointer: {indexStatus.pointerError}</p>}
                {indexStatus.lastJobError && <p>Job gần nhất: {indexStatus.lastJobError}</p>}
              </div>
            </section>
          ) : (
            <section className={styles.diagnosticsOk}>
              <CheckCircle2 size={17} />
              <span>Không phát hiện lỗi ở active pointer hoặc job gần nhất.</span>
            </section>
          )}
        </>
      )}

      {confirmOpen && (
        <div className={styles.modalBackdrop} onMouseDown={() => setConfirmOpen(false)}>
          <section
            aria-labelledby="reindex-title"
            aria-modal="true"
            className={styles.modal}
            onMouseDown={event => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div className={styles.modalIcon}><RotateCcw size={19} /></div>
              <button aria-label="Đóng" onClick={() => setConfirmOpen(false)} title="Đóng" type="button"><X size={18} /></button>
            </header>
            <h2 id="reindex-title">Rebuild toàn bộ RAG index?</h2>
            <p>Hệ thống sẽ đọc các tài liệu ACTIVE và phiên bản hiện hành để tạo build mới. Build đang active vẫn phục vụ cho đến khi build mới hoàn tất.</p>
            <dl>
              <div><dt>Active build</dt><dd>{indexStatus?.activeBuildId ?? "Chưa có"}</dd></div>
              <div><dt>Nguồn hiện tại</dt><dd>{indexStatus?.documentsIndexed ?? 0} tài liệu</dd></div>
            </dl>
            <footer>
              <button className={styles.cancelButton} onClick={() => setConfirmOpen(false)} type="button">Hủy</button>
              <button className={styles.confirmButton} onClick={() => void startReindex()} type="button"><RotateCcw size={16} />Bắt đầu rebuild</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
