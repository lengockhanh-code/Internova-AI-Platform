"use client";

import {
  AlignLeft,
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Database,
  FileText,
  Filter,
  Hash,
  Languages,
  Layers3,
  Loader2,
  RefreshCw,
  Ruler,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  adminKnowledgeBaseApi,
  formatDateTime,
  type KnowledgeChunkDetail,
  type KnowledgeChunkListItem,
  type KnowledgeChunksResponse,
} from "@/lib/adminKnowledgeBase";

import styles from "./page.module.css";

const PAGE_SIZE = 25;

function formatBytes(value: number | null): string {
  if (value === null) return "--";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function locationLabel(chunk: KnowledgeChunkListItem): string {
  if (chunk.page !== null) return `Trang ${chunk.page}`;
  if (chunk.section) return chunk.section;
  if (chunk.topic) return chunk.topic;
  return `Vị trí ${chunk.position}`;
}

export default function AdminKnowledgeChunksPage() {
  const [data, setData] = useState<KnowledgeChunksResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeChunkDetail | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [copied, setCopied] = useState(false);
  const selectedRef = useRef<string | null>(null);
  const detailRequest = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      documentName: documentName || undefined,
      documentType: documentType || undefined,
      language: language || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, documentName, documentType, language, page],
  );

  const openChunk = useCallback(async (chunkId: string) => {
    const requestId = ++detailRequest.current;
    selectedRef.current = chunkId;
    setSelectedId(chunkId);
    setDetailLoading(true);
    setDetailError("");
    setCopied(false);
    try {
      const response = await adminKnowledgeBaseApi.chunk(chunkId);
      if (requestId === detailRequest.current) setDetail(response.chunk);
    } catch (loadError) {
      if (requestId === detailRequest.current) {
        setDetail(null);
        setDetailError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải nội dung chunk.",
        );
      }
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }, []);

  const loadChunks = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await adminKnowledgeBaseApi.chunks(query);
      setData(response);
      if (response.page !== page) setPage(response.page);
      const currentId = selectedRef.current;
      const next = response.items.find(item => item.chunkId === currentId)
        ?? response.items[0]
        ?? null;
      if (next) await openChunk(next.chunkId);
      else {
        selectedRef.current = null;
        setSelectedId(null);
        setDetail(null);
      }
    } catch (loadError) {
      setData(null);
      setDetail(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách chunks.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [openChunk, page, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadChunks(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadChunks]);

  const copyChunkId = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.chunkId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const summary = data?.summary;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><Database size={15} /> KNOWLEDGE BASE</span>
          <h1>RAG Chunks</h1>
          <p>Kiểm tra các đoạn tri thức đang được chatbot sử dụng trong active index.</p>
        </div>
        <div className={styles.headerStatus}>
          <span><i />{data?.activeBuildId ?? "Chưa có active build"}</span>
          <button aria-label="Làm mới chunks" disabled={refreshing} onClick={() => void loadChunks(true)} title="Làm mới" type="button">
            <RefreshCw className={refreshing ? styles.spin : ""} size={17} />
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Tổng quan chunks">
        <div><Layers3 /><span>Tổng chunks<strong>{summary?.total ?? "--"}</strong><small>Trong active build</small></span></div>
        <div><FileText /><span>Tài liệu nguồn<strong>{summary?.documents ?? "--"}</strong><small>Đã được lập chỉ mục</small></span></div>
        <div><Languages /><span>Có bản dịch<strong>{summary?.translated ?? "--"}</strong><small>Nội dung tiếng Việt</small></span></div>
        <div><Ruler /><span>Độ dài trung bình<strong>{summary?.averageCharacters ?? "--"}</strong><small>Ký tự mỗi chunk</small></span></div>
      </section>

      <section className={styles.filters} aria-label="Bộ lọc chunks">
        <label className={styles.searchBox}><Search size={16} /><input aria-label="Tìm kiếm chunk" onChange={event => setSearch(event.target.value)} placeholder="Nội dung, chunk ID, section..." value={search} /></label>
        <label><Filter size={15} /><select aria-label="Tài liệu nguồn" onChange={event => { setDocumentName(event.target.value); setPage(1); }} value={documentName}><option value="">Tất cả tài liệu</option>{data?.filters.documentNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <label><select aria-label="Loại tri thức" onChange={event => { setDocumentType(event.target.value); setPage(1); }} value={documentType}><option value="">Tất cả loại</option>{data?.filters.documentTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <label><select aria-label="Ngôn ngữ" onChange={event => { setLanguage(event.target.value); setPage(1); }} value={language}><option value="">Tất cả ngôn ngữ</option>{data?.filters.languages.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
      </section>

      {loading && !data && <section className={styles.state}><Loader2 className={styles.spin} /><p>Đang đọc active RAG index...</p></section>}
      {!loading && error && <section className={`${styles.state} ${styles.errorState}`}><Braces /><h2>Không thể tải chunks</h2><p>{error}</p><button onClick={() => void loadChunks()} type="button">Thử lại</button></section>}

      {data && !error && <div className={styles.workspace}>
        <section className={styles.listPanel}>
          <header><div><h2>Danh sách chunks</h2><p>{data.total} kết quả phù hợp</p></div><span>{data.page}/{Math.max(data.totalPages, 1)}</span></header>
          <div className={styles.chunkList}>
            {data.items.map(chunk => <button className={`${styles.chunkRow} ${selectedId === chunk.chunkId ? styles.activeRow : ""}`} key={chunk.chunkId} onClick={() => void openChunk(chunk.chunkId)} type="button">
              <div className={styles.rowTop}><span className={styles.position}>#{chunk.position}</span><strong>{chunk.documentName}</strong><em>{chunk.documentType}</em></div>
              <p>{chunk.contentPreview || "Chunk không có nội dung hiển thị."}</p>
              <div className={styles.rowMeta}><span><Hash size={12} />{chunk.chunkId}</span><span>{locationLabel(chunk)}</span><span>{chunk.wordCount} từ</span></div>
            </button>)}
            {!data.items.length && <div className={styles.empty}><Layers3 size={28} /><p>Không có chunk phù hợp bộ lọc.</p></div>}
          </div>
          <footer className={styles.pagination}>
            <button aria-label="Trang trước" disabled={data.page <= 1 || loading} onClick={() => setPage(current => Math.max(1, current - 1))} title="Trang trước" type="button"><ChevronLeft /></button>
            <span>Trang <strong>{data.page}</strong> / {Math.max(data.totalPages, 1)}</span>
            <button aria-label="Trang sau" disabled={!data.totalPages || data.page >= data.totalPages || loading} onClick={() => setPage(current => current + 1)} title="Trang sau" type="button"><ChevronRight /></button>
          </footer>
        </section>

        <section className={styles.detailPanel}>
          {detailLoading && <div className={styles.detailLoading}><Loader2 className={styles.spin} />Đang tải chi tiết...</div>}
          {detailError && <div className={styles.inlineError}>{detailError}</div>}
          {!detail && !detailLoading && <div className={styles.emptyDetail}><AlignLeft size={32} /><p>Chọn một chunk để xem nội dung.</p></div>}

          {detail && <>
            <header className={styles.detailHeader}>
              <div><span>CHUNK #{detail.position}</span><h2>{detail.documentName}</h2><p>{detail.section || detail.topic || "Không có tiêu đề section"}</p></div>
              <button aria-label="Sao chép chunk ID" onClick={() => void copyChunkId()} title="Sao chép chunk ID" type="button">{copied ? <Check /> : <Clipboard />}</button>
            </header>

            <section className={styles.metricsBand}>
              <div><Hash /><span>Chunk ID<strong title={detail.chunkId}>{detail.chunkId}</strong></span></div>
              <div><AlignLeft /><span>Số từ<strong>{detail.wordCount}</strong></span></div>
              <div><Ruler /><span>Ký tự<strong>{detail.characterCount}</strong></span></div>
              <div><Braces /><span>Source elements<strong>{detail.sourceElementCount}</strong></span></div>
            </section>

            <section className={styles.contentSection}>
              <div className={styles.sectionHeading}><div><h3>Nội dung gốc</h3><p>{detail.language.toUpperCase()} · {locationLabel(detail)}</p></div></div>
              <article>{detail.contentOriginal || "Không có nội dung."}</article>
            </section>

            {detail.contentVi && <section className={styles.contentSection}>
              <div className={styles.sectionHeading}><div><h3>Bản tiếng Việt</h3><p>Nội dung được lưu cùng chunk</p></div></div>
              <article>{detail.contentVi}</article>
            </section>}

            <section className={styles.metadataSection}>
              <div className={styles.sectionHeading}><div><h3>Metadata</h3><p>Thông tin truy xuất và nguồn dữ liệu</p></div></div>
              <div className={styles.metadataGrid}>
                <div><span>Document type</span><strong>{detail.documentType}</strong></div>
                <div><span>Source priority</span><strong>{detail.sourcePriority}</strong></div>
                <div><span>Page</span><strong>{detail.page ?? "--"}</strong></div>
                <div><span>Policy version</span><strong>{detail.policyVersion ?? "--"}</strong></div>
                <div><span>Effective date</span><strong>{detail.effectiveDate ?? "--"}</strong></div>
                <div><span>File size</span><strong>{formatBytes(detail.fileSizeBytes)}</strong></div>
                <div><span>Ingested</span><strong>{formatDateTime(detail.ingestedAt)}</strong></div>
                <div><span>Created</span><strong>{formatDateTime(detail.createdDate)}</strong></div>
              </div>
              <div className={styles.hashLine}><span>File hash</span><code>{detail.fileHash ?? "--"}</code></div>
            </section>

            <section className={styles.elementsSection}>
              <div className={styles.sectionHeading}><div><h3>Source elements</h3><p>{detail.sourceElementIds.length} phần tử tạo nên chunk</p></div></div>
              <div>{detail.sourceElementIds.map(element => <code key={element}>{element}</code>)}{!detail.sourceElementIds.length && <p>Không có source element ID.</p>}</div>
            </section>
          </>}
        </section>
      </div>}
    </main>
  );
}
