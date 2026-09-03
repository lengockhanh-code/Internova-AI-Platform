"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  FolderArchive,
  HardDrive,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Zap,
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
  type KnowledgeReloadResponse,
} from "@/lib/adminKnowledgeBase";

import styles from "./page.module.css";

type OperationMode = "reindex" | "reload";

const OPERATION_COPY: Record<OperationMode, {
  title: string;
  action: string;
  description: string;
  confirmation: string;
}> = {
  reindex: {
    title: "Full re-index",
    action: "Bắt đầu re-index",
    description: "Tạo build bất biến mới từ tất cả tài liệu ACTIVE và phiên bản hiện hành.",
    confirmation: "Build hiện tại vẫn phục vụ trong quá trình xử lý và chỉ được thay thế sau khi build mới vượt qua toàn bộ bước kiểm tra.",
  },
  reload: {
    title: "Reload active pipeline",
    action: "Reload pipeline",
    description: "Nạp lại Chroma và BM25 của active build vào bộ nhớ chatbot.",
    confirmation: "Thao tác này không đọc lại tài liệu, không tạo chunks mới và không thay đổi active build.",
  },
};

function elapsedLabel(startedAt: number | null, now: number): string {
  if (!startedAt) return "0 giây";
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.floor(seconds / 60)} phút ${seconds % 60} giây`;
}

function compactPath(value: string): string {
  return value.replaceAll("\\", "/");
}

export default function AdminKnowledgeReindexPage() {
  const [mode, setMode] = useState<OperationMode>("reindex");
  const [indexStatus, setIndexStatus] = useState<KnowledgeIndexStatus | null>(null);
  const [reindexResult, setReindexResult] = useState<KnowledgeReindexResponse | null>(null);
  const [reloadResult, setReloadResult] = useState<KnowledgeReloadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
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
      setError("");
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setError(loadError instanceof Error ? loadError.message : "Không thể tải trạng thái index.");
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

  useEffect(() => {
    if (!confirmOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmOpen]);

  const operation = OPERATION_COPY[mode];
  const successful = mode === "reindex" ? Boolean(reindexResult) : Boolean(reloadResult);
  const externalJobRunning = indexStatus?.lastJobStatus === "RUNNING";
  const activeReady = indexStatus?.status === "READY";

  const steps = useMemo(() => mode === "reindex" ? [
    { title: "Validate sources", detail: "Tài liệu ACTIVE, current versions và file hashes", icon: FileCheck2 },
    { title: "Extract & chunk", detail: "Chuẩn hóa nội dung và tạo chunks có metadata", icon: Layers3 },
    { title: "Build hybrid retrieval", detail: "Chroma vector store, BM25 và manifest", icon: Database },
    { title: "Atomic activation", detail: "Kiểm tra candidate rồi chuyển active pointer", icon: ShieldCheck },
  ] : [
    { title: "Resolve active pointer", detail: "Đọc đường dẫn build đã được xuất bản", icon: FileCheck2 },
    { title: "Load retrieval artifacts", detail: "Mở Chroma vector store và BM25 index", icon: HardDrive },
    { title: "Initialize pipeline", detail: "Khởi tạo hybrid retrieval trong bộ nhớ", icon: Activity },
    { title: "Atomic memory swap", detail: "Thay pipeline mà không xóa chat memory", icon: Zap },
  ], [mode]);

  const requirements = mode === "reindex" ? [
    { label: "Nguồn hiện hành", value: `${indexStatus?.documentsIndexed ?? 0} tài liệu trong active build`, state: (indexStatus?.documentsIndexed ?? 0) > 0 },
    { label: "Active pipeline", value: indexStatus?.status ?? "UNKNOWN", state: activeReady },
    { label: "Distributed lock", value: "Kiểm tra khi bắt đầu", state: null },
  ] : [
    { label: "Active pointer", value: indexStatus?.pointerExists ? "Sẵn sàng" : "Không tồn tại", state: Boolean(indexStatus?.pointerExists) },
    { label: "Chroma", value: indexStatus?.chromaReady ? "Sẵn sàng" : "Không khả dụng", state: Boolean(indexStatus?.chromaReady) },
    { label: "BM25", value: indexStatus?.bm25Ready ? "Sẵn sàng" : "Không khả dụng", state: Boolean(indexStatus?.bm25Ready) },
  ];

  const runOperation = async () => {
    setConfirmOpen(false);
    setRunning(true);
    setError("");
    setReindexResult(null);
    setReloadResult(null);
    setCompletedAt(null);
    setStartedAt(Date.now());

    try {
      if (mode === "reindex") {
        setReindexResult(await adminKnowledgeBaseApi.reindex());
      } else {
        setReloadResult(await adminKnowledgeBaseApi.reload());
      }
      setCompletedAt(Date.now());
      await loadStatus(true);
    } catch (operationError) {
      const message = operationError instanceof KnowledgeBaseApiError && operationError.status === 409
        ? "Một tiến trình re-index khác đang chạy. Vui lòng đợi job hiện tại hoàn tất."
        : operationError instanceof Error
          ? operationError.message
          : `Không thể thực hiện ${operation.title}.`;
      setError(message);
      await loadStatus(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><RotateCcw size={15} /> KNOWLEDGE BASE</span>
          <h1>Re-index / Reload</h1>
          <p>Vận hành vòng đời RAG index và pipeline đang phục vụ chatbot.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.statusBadge} ${activeReady ? styles.ready : styles.attention}`}>
            <i />{indexStatus?.status ?? (loading ? "LOADING" : "UNKNOWN")}
          </span>
          <button
            aria-label="Làm mới trạng thái"
            className={styles.iconButton}
            disabled={loading || refreshing || running}
            onClick={() => void loadStatus(true)}
            title="Làm mới trạng thái"
            type="button"
          >
            <RefreshCw className={refreshing ? styles.spin : ""} size={17} />
          </button>
          <Link className={styles.statusLink} href="/admin/knowledge/index-status">
            Index Status <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {loading && !indexStatus ? (
        <section className={styles.state}><Loader2 className={styles.spin} /><p>Đang đọc active build...</p></section>
      ) : (
        <>
          {error && (
            <section className={styles.errorBanner} role="alert">
              <AlertCircle size={18} />
              <div><strong>Thao tác không thành công</strong><span>{error}</span></div>
              <button onClick={() => setError("")} title="Đóng thông báo" type="button"><X size={16} /></button>
            </section>
          )}

          <section className={styles.overviewBand}>
            <div className={styles.buildIdentity}>
              <span>ACTIVE BUILD</span>
              <strong title={indexStatus?.activeBuildId ?? undefined}>{indexStatus?.activeBuildId ?? "Chưa có active build"}</strong>
              <small>Kích hoạt {formatDateTime(indexStatus?.activatedAt)}</small>
            </div>
            <div><FileText /><span>Tài liệu<strong>{indexStatus?.documentsIndexed ?? 0}</strong></span></div>
            <div><Layers3 /><span>Chunks<strong>{indexStatus?.chunksIndexed ?? 0}</strong></span></div>
            <div><Clock3 /><span>Job gần nhất<strong>{indexStatus?.lastJobStatus ?? "-"}</strong></span></div>
          </section>

          <section className={styles.modeSwitch} aria-label="Chế độ vận hành">
            <button
              className={mode === "reindex" ? styles.modeActive : ""}
              disabled={running}
              onClick={() => { setMode("reindex"); setError(""); }}
              type="button"
            >
              <Database size={18} />
              <span><strong>Full re-index</strong><small>Tạo và kích hoạt build mới</small></span>
            </button>
            <button
              className={mode === "reload" ? styles.modeActive : ""}
              disabled={running}
              onClick={() => { setMode("reload"); setError(""); }}
              type="button"
            >
              <RefreshCw size={18} />
              <span><strong>Reload pipeline</strong><small>Nạp lại active build hiện tại</small></span>
            </button>
          </section>

          <div className={styles.workspace}>
            <section className={styles.pipelinePanel}>
              <header className={styles.panelHeader}>
                <div><h2>Execution pipeline</h2><p>{operation.description}</p></div>
                {running && <span className={styles.runningBadge}><Loader2 className={styles.spin} size={13} />RUNNING</span>}
                {!running && successful && <span className={styles.completedBadge}><Check size={13} />COMPLETED</span>}
              </header>
              <div className={styles.steps}>
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div className={`${styles.step} ${successful ? styles.stepDone : ""}`} key={step.title}>
                      <div className={styles.stepMarker}>{successful ? <Check size={16} /> : <Icon size={17} />}</div>
                      <div><span>0{index + 1}</span><strong>{step.title}</strong><p>{step.detail}</p></div>
                    </div>
                  );
                })}
              </div>
              <footer className={styles.pipelineFooter}>
                <ShieldCheck size={15} />
                <span>{mode === "reindex" ? "Active build cũ không bị thay đổi nếu candidate thất bại." : "Chat memory được giữ nguyên trong quá trình reload."}</span>
              </footer>
            </section>

            <section className={styles.controlPanel}>
              <header className={styles.panelHeader}>
                <div><h2>{operation.title}</h2><p>Pre-flight status</p></div>
                {mode === "reindex" ? <Database size={18} /> : <Server size={18} />}
              </header>
              <div className={styles.requirements}>
                {requirements.map(item => (
                  <div key={item.label}>
                    <span className={item.state === null ? styles.neutralDot : item.state ? styles.goodDot : styles.badDot} />
                    <div><strong>{item.label}</strong><small>{item.value}</small></div>
                    {item.state !== null && (item.state ? <Check size={15} /> : <X size={15} />)}
                  </div>
                ))}
              </div>
              <div className={styles.operationNote}>
                {mode === "reindex" ? <FolderArchive size={17} /> : <RefreshCw size={17} />}
                <p>{operation.confirmation}</p>
              </div>
              <div className={styles.runMeta}>
                <span>Thời gian chạy</span>
                <strong>{running ? elapsedLabel(startedAt, now) : completedAt && startedAt ? elapsedLabel(startedAt, completedAt) : "Chưa bắt đầu"}</strong>
              </div>
              <button
                className={styles.runButton}
                disabled={running || externalJobRunning || (mode === "reload" && !indexStatus?.pointerExists)}
                onClick={() => setConfirmOpen(true)}
                type="button"
              >
                {running ? <Loader2 className={styles.spin} size={17} /> : mode === "reindex" ? <Database size={17} /> : <RefreshCw size={17} />}
                {running ? "Đang xử lý..." : externalJobRunning ? "Job khác đang chạy" : operation.action}
              </button>
            </section>
          </div>

          {reindexResult && mode === "reindex" && (
            <section className={styles.resultPanel}>
              <header className={styles.resultHeader}>
                <div className={styles.resultIcon}><CheckCircle2 size={21} /></div>
                <div><span>RE-INDEX COMPLETED</span><h2>Build mới đã được kích hoạt</h2><p>{reindexResult.buildId}</p></div>
                <strong>{reindexResult.durationSeconds.toFixed(1)}s</strong>
              </header>
              <div className={styles.resultMetrics}>
                <div><span>Tài liệu</span><strong>{reindexResult.documentsIndexed}</strong></div>
                <div><span>Chunks mới</span><strong>{reindexResult.chunksCreated}</strong></div>
                <div><span>Build đã dọn</span><strong>{reindexResult.removedBuilds.length}</strong></div>
                <div><span>Trạng thái</span><strong>{reindexResult.status}</strong></div>
              </div>
              <div className={styles.resultGrid}>
                <section>
                  <h3>Generated artifacts</h3>
                  <dl className={styles.artifacts}>
                    <div><dt>Chroma</dt><dd title={reindexResult.chromaDir}>{compactPath(reindexResult.chromaDir)}</dd></div>
                    <div><dt>BM25</dt><dd title={reindexResult.bm25Path}>{compactPath(reindexResult.bm25Path)}</dd></div>
                    <div><dt>Manifest</dt><dd title={reindexResult.manifestPath}>{compactPath(reindexResult.manifestPath)}</dd></div>
                    <div><dt>RAG output</dt><dd title={reindexResult.ragDir}>{compactPath(reindexResult.ragDir)}</dd></div>
                  </dl>
                </section>
                <section>
                  <h3>Indexed documents</h3>
                  <div className={styles.documentList}>
                    {reindexResult.documents.map((document, index) => (
                      <div key={document}><span>{index + 1}</span><FileText size={14} /><strong title={document}>{document}</strong></div>
                    ))}
                  </div>
                </section>
              </div>
              <footer className={styles.resultLinks}>
                <Link href="/admin/knowledge/index-status">Kiểm tra index <ArrowRight size={14} /></Link>
                <Link href="/admin/knowledge/chunks">Kiểm tra chunks <ArrowRight size={14} /></Link>
              </footer>
            </section>
          )}

          {reloadResult && mode === "reload" && (
            <section className={styles.reloadResult}>
              <div className={styles.resultIcon}><CheckCircle2 size={21} /></div>
              <div><span>PIPELINE RELOADED</span><h2>Active build đã được nạp lại</h2><p>{indexStatus?.activeBuildId ?? reloadResult.message}</p></div>
              <div className={styles.reloadChecks}>
                <span><Check size={14} /> Chroma</span>
                <span><Check size={14} /> BM25</span>
                <span><Check size={14} /> Chat memory</span>
              </div>
            </section>
          )}
        </>
      )}

      {confirmOpen && (
        <div className={styles.modalBackdrop} onMouseDown={() => setConfirmOpen(false)}>
          <section
            aria-labelledby="operation-title"
            aria-modal="true"
            className={styles.modal}
            onMouseDown={event => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <div className={styles.modalIcon}>{mode === "reindex" ? <Database size={19} /> : <RefreshCw size={19} />}</div>
              <button aria-label="Đóng" onClick={() => setConfirmOpen(false)} title="Đóng" type="button"><X size={18} /></button>
            </header>
            <h2 id="operation-title">Xác nhận {operation.title}</h2>
            <p>{operation.confirmation}</p>
            <dl>
              <div><dt>Thao tác</dt><dd>{operation.title}</dd></div>
              <div><dt>Active build</dt><dd title={indexStatus?.activeBuildId ?? undefined}>{indexStatus?.activeBuildId ?? "Chưa có"}</dd></div>
              <div><dt>Phạm vi</dt><dd>{mode === "reindex" ? `${indexStatus?.documentsIndexed ?? 0} tài liệu hiện hành` : "Pipeline trong bộ nhớ"}</dd></div>
            </dl>
            <footer>
              <button className={styles.cancelButton} onClick={() => setConfirmOpen(false)} type="button">Hủy</button>
              <button className={styles.confirmButton} onClick={() => void runOperation()} type="button">
                {mode === "reindex" ? <Database size={16} /> : <RefreshCw size={16} />}{operation.action}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
