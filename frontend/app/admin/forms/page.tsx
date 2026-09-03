"use client";

import {
  AlertCircle,
  Archive,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  adminKnowledgeBaseApi,
  formatDateTime,
  openKnowledgeDocumentVersion,
  type KnowledgeDocument,
  type KnowledgeDocumentDetail,
  type KnowledgeDocumentPayload,
  type KnowledgeDocumentType,
  type KnowledgeDocumentVersion,
  type KnowledgeDocumentsResponse,
  type KnowledgeRagDocumentType,
} from "@/lib/adminKnowledgeBase";

import styles from "./page.module.css";

const CATEGORY_OPTIONS: { value: KnowledgeRagDocumentType; label: string }[] = [
  { value: "form", label: "Biểu mẫu" },
  { value: "agreement", label: "Thỏa thuận" },
  { value: "policy", label: "Quy định / Chính sách" },
  { value: "talent_handbook", label: "Sổ tay nghề nghiệp" },
  { value: "capstone_booklet", label: "Tài liệu Capstone" },
  { value: "knowledge", label: "Tài liệu tham khảo" },
];

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface DocumentForm {
  title: string;
  documentType: KnowledgeDocumentType;
  category: KnowledgeRagDocumentType;
  description: string;
  year: string;
  status: string;
  version: string;
  file: File | null;
}

interface VersionForm {
  version: string;
  effectiveDate: string;
  file: File | null;
}

const emptyDocumentForm: DocumentForm = {
  title: "",
  documentType: "PDF",
  category: "form",
  description: "",
  year: String(new Date().getFullYear()),
  status: "ACTIVE",
  version: "1.0",
  file: null,
};

const emptyVersionForm: VersionForm = { version: "", effectiveDate: "", file: null };

function categoryLabel(value: KnowledgeRagDocumentType | null): string {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? "Chưa phân loại";
}

function statusLabel(value: string): string {
  if (value === "ACTIVE") return "Đang phát hành";
  if (value === "INACTIVE") return "Tạm ngưng";
  if (value === "ARCHIVED") return "Đã lưu trữ";
  return value;
}

function typeFromFile(file: File): KnowledgeDocumentType | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".docx")) return "DOCX";
  return null;
}

export default function AdminFormsPage() {
  const [data, setData] = useState<KnowledgeDocumentsResponse | null>(null);
  const [selected, setSelected] = useState<KnowledgeDocumentDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [documentType, setDocumentType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [versionFilter, setVersionFilter] = useState("ALL");
  const [documentModal, setDocumentModal] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [documentForm, setDocumentForm] = useState<DocumentForm>(emptyDocumentForm);
  const [formError, setFormError] = useState("");
  const [versionModal, setVersionModal] = useState(false);
  const [versionForm, setVersionForm] = useState<VersionForm>(emptyVersionForm);

  const openDetail = useCallback(async (documentId: number) => {
    setSelectedId(documentId);
    setDetailLoading(true);
    setMessage("");
    try {
      const response = await adminKnowledgeBaseApi.document(documentId);
      setSelected(response.document);
    } catch (loadError) {
      setSelected(null);
      setMessage(loadError instanceof Error ? loadError.message : "Không thể tải chi tiết tài liệu.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (keepSelection = false) => {
    setLoading(!keepSelection);
    setError("");
    try {
      const response = await adminKnowledgeBaseApi.documents({ page: 1, pageSize: 100 });
      setData(response);
      const nextId = keepSelection && selectedId
        ? selectedId
        : response.items[0]?.id ?? null;
      if (nextId) await openDetail(nextId);
      else {
        setSelectedId(null);
        setSelected(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải thư viện tài liệu.");
    } finally {
      setLoading(false);
    }
  }, [openDetail, selectedId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadDocuments(), 0);
    return () => window.clearTimeout(timeout);
    // Load once; row selection is managed separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.items ?? []).filter((document) => {
      const haystack = [document.title, document.description ?? "", document.currentVersion ?? ""]
        .join(" ").toLocaleLowerCase("vi");
      return (!keyword || haystack.includes(keyword))
        && (category === "ALL" || document.ragDocumentType === category)
        && (documentType === "ALL" || document.documentType === documentType)
        && (status === "ALL" || document.status === status)
        && (year === "ALL" || document.year === Number(year))
        && (versionFilter === "ALL"
          || (versionFilter === "CURRENT" ? Boolean(document.currentVersionInfo) : !document.currentVersionInfo));
    });
  }, [category, data, documentType, search, status, versionFilter, year]);

  const years = useMemo(
    () => Array.from(new Set((data?.items ?? []).map((item) => item.year).filter((item): item is number => item !== null))).sort((a, b) => b - a),
    [data],
  );

  const summary = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: data?.total ?? 0,
      active: items.filter((item) => item.status === "ACTIVE").length,
      forms: items.filter((item) => item.ragDocumentType === "form").length,
      agreements: items.filter((item) => item.ragDocumentType === "agreement").length,
      missingVersion: items.filter((item) => !item.currentVersionInfo).length,
    };
  }, [data]);

  function openCreate() {
    setFormMode("create");
    setDocumentForm({ ...emptyDocumentForm, year: String(new Date().getFullYear()) });
    setFormError("");
    setDocumentModal(true);
  }

  function openEdit() {
    if (!selected) return;
    setFormMode("edit");
    setDocumentForm({
      title: selected.title,
      documentType: selected.documentType,
      category: selected.ragDocumentType ?? "form",
      description: selected.description ?? "",
      year: selected.year?.toString() ?? "",
      status: selected.status,
      version: selected.currentVersion ?? "",
      file: null,
    });
    setFormError("");
    setDocumentModal(true);
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formMode === "create" && !documentForm.file) {
      setFormError("Vui lòng chọn tệp PDF hoặc DOCX cho tài liệu mới.");
      return;
    }
    const detectedType = documentForm.file ? typeFromFile(documentForm.file) : documentForm.documentType;
    if (!detectedType) {
      setFormError("Chỉ hỗ trợ tệp PDF và DOCX.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload: KnowledgeDocumentPayload = {
        title: documentForm.title.trim(),
        documentType: detectedType,
        ragDocumentType: documentForm.category,
        description: documentForm.description.trim() || null,
        fileUrl: null,
        currentVersion: null,
        year: documentForm.year ? Number(documentForm.year) : null,
        status: documentForm.status,
      };
      let response = formMode === "create"
        ? await adminKnowledgeBaseApi.createDocument(payload)
        : await adminKnowledgeBaseApi.updateDocument(selected!.id, payload);

      if (formMode === "create" && documentForm.file) {
        const upload = await adminKnowledgeBaseApi.uploadVersion(response.document.id, {
          version: documentForm.version.trim() || "1.0",
          status: "ACTIVE",
          effectiveDate: null,
          file: documentForm.file,
        });
        await adminKnowledgeBaseApi.setCurrentVersion(response.document.id, upload.versionId);
        response = await adminKnowledgeBaseApi.document(response.document.id);
      }
      setSelected(response.document);
      setSelectedId(response.document.id);
      setDocumentModal(false);
      await loadDocuments(true);
      setMessage(formMode === "create" ? "Đã thêm và phát hành tài liệu." : "Đã cập nhật thông tin tài liệu.");
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Không thể lưu tài liệu.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelected() {
    if (!selected || !window.confirm(`Lưu trữ tài liệu “${selected.title}”?`)) return;
    setActionBusy(true);
    try {
      const response = await adminKnowledgeBaseApi.archiveDocument(selected.id);
      setSelected(response.document);
      await loadDocuments(true);
      setMessage("Đã chuyển tài liệu vào kho lưu trữ.");
    } catch (archiveError) {
      setMessage(archiveError instanceof Error ? archiveError.message : "Không thể lưu trữ tài liệu.");
    } finally {
      setActionBusy(false);
    }
  }

  function openVersionModal() {
    setVersionForm(emptyVersionForm);
    setFormError("");
    setVersionModal(true);
  }

  async function submitVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !versionForm.file) {
      setFormError("Vui lòng chọn tệp phiên bản mới.");
      return;
    }
    const detectedType = typeFromFile(versionForm.file);
    if (detectedType !== selected.documentType) {
      setFormError(`Phiên bản mới phải là tệp ${selected.documentType}.`);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await adminKnowledgeBaseApi.uploadVersion(selected.id, {
        version: versionForm.version.trim(),
        status: "ACTIVE",
        effectiveDate: versionForm.effectiveDate || null,
        file: versionForm.file,
      });
      setVersionModal(false);
      await openDetail(selected.id);
      await loadDocuments(true);
      setMessage("Đã tải lên phiên bản tài liệu mới.");
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Không thể tải phiên bản mới.");
    } finally {
      setSaving(false);
    }
  }

  async function setCurrentVersion(version: KnowledgeDocumentVersion) {
    if (!selected) return;
    setActionBusy(true);
    try {
      await adminKnowledgeBaseApi.setCurrentVersion(selected.id, version.id);
      await openDetail(selected.id);
      await loadDocuments(true);
      setMessage(`Đã phát hành phiên bản ${version.version}.`);
    } catch (versionError) {
      setMessage(versionError instanceof Error ? versionError.message : "Không thể phát hành phiên bản.");
    } finally {
      setActionBusy(false);
    }
  }

  async function openVersion(version: KnowledgeDocumentVersion, download: boolean) {
    if (!selected) return;
    try {
      await openKnowledgeDocumentVersion(selected.id, version.id, download);
    } catch (openError) {
      setMessage(openError instanceof Error ? openError.message : "Không thể mở tệp tài liệu.");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}><FolderOpen size={15} /> QUẢN LÝ THỰC TẬP</span><h1>Form / Tài liệu</h1><p>Quản lý biểu mẫu, quy định và tài liệu chính thức cung cấp cho sinh viên, giảng viên.</p></div>
        <div className={styles.headerActions}><button className={styles.secondaryButton} disabled={loading} onClick={() => void loadDocuments(true)} type="button"><RefreshCw className={loading ? styles.spin : ""} size={17} /> Làm mới</button><button className={styles.primaryButton} onClick={openCreate} type="button"><Plus size={18} /> Thêm tài liệu</button></div>
      </header>

      <section className={styles.summaryGrid}>
        <button onClick={() => { setCategory("ALL"); setStatus("ALL"); setVersionFilter("ALL"); }} type="button"><FolderOpen /><span>Tổng tài liệu<strong>{summary.total}</strong></span></button>
        <button onClick={() => setStatus("ACTIVE")} type="button"><CheckCircle2 /><span>Đang phát hành<strong>{summary.active}</strong></span></button>
        <button onClick={() => setCategory("form")} type="button"><FileText /><span>Biểu mẫu<strong>{summary.forms}</strong></span></button>
        <button onClick={() => setCategory("agreement")} type="button"><ShieldCheck /><span>Thỏa thuận<strong>{summary.agreements}</strong></span></button>
        <button onClick={() => setVersionFilter("MISSING")} type="button"><AlertCircle /><span>Chưa có phiên bản<strong>{summary.missingVersion}</strong></span></button>
      </section>

      <section className={styles.filters}>
        <label className={styles.searchBox}><Search size={17} /><input aria-label="Tìm tài liệu" placeholder="Tên tài liệu, mô tả, phiên bản..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><Filter size={15} /><select aria-label="Danh mục" value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">Tất cả danh mục</option>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><select aria-label="Loại tệp" value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="ALL">Tất cả định dạng</option><option value="PDF">PDF</option><option value="DOCX">DOCX</option></select></label>
        <label><select aria-label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang phát hành</option><option value="INACTIVE">Tạm ngưng</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>
        <label><CalendarDays size={15} /><select aria-label="Năm" value={year} onChange={(event) => setYear(event.target.value)}><option value="ALL">Tất cả năm</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><History size={15} /><select aria-label="Tình trạng phiên bản" value={versionFilter} onChange={(event) => setVersionFilter(event.target.value)}><option value="ALL">Tất cả phiên bản</option><option value="CURRENT">Đã có phiên bản</option><option value="MISSING">Chưa có phiên bản</option></select></label>
      </section>

      {loading && <section className={styles.state}><Loader2 className={styles.spin} /><p>Đang tải thư viện tài liệu...</p></section>}
      {!loading && error && <section className={`${styles.state} ${styles.error}`}><AlertCircle /><h2>Không thể tải dữ liệu</h2><p>{error}</p><button onClick={() => void loadDocuments()} type="button">Thử lại</button></section>}

      {!loading && !error && <div className={styles.workspace}>
        <section className={styles.listPanel}><header><div><h2>Thư viện tài liệu</h2><p>{filtered.length} tài liệu phù hợp</p></div></header><div className={styles.documentList}>
          {filtered.map((document: KnowledgeDocument) => <button className={`${styles.documentRow} ${selectedId === document.id ? styles.rowActive : ""}`} key={document.id} onClick={() => void openDetail(document.id)} type="button"><span className={`${styles.fileIcon} ${document.documentType === "PDF" ? styles.pdf : styles.docx}`}><FileText /></span><span className={styles.documentInfo}><strong>{document.title}</strong><small>{categoryLabel(document.ragDocumentType)} · {document.year ?? "Chưa có năm"}</small><span>Phiên bản {document.currentVersion || "—"} · {formatDateTime(document.updatedAt)}</span></span><span className={`${styles.statusBadge} ${styles[`status${document.status}`]}`}>{statusLabel(document.status)}</span></button>)}
          {!filtered.length && <div className={styles.empty}><FolderOpen /><p>Không có tài liệu phù hợp bộ lọc.</p></div>}
        </div></section>

        <section className={styles.detailPanel}>
          {detailLoading && <div className={styles.detailLoading}><Loader2 className={styles.spin} /> Đang tải chi tiết...</div>}
          {!selected && !detailLoading && <div className={styles.empty}><FolderOpen /><p>Chọn một tài liệu để xem chi tiết.</p></div>}
          {selected && <>
            <header className={styles.detailHeader}><div><span>{categoryLabel(selected.ragDocumentType)}</span><h2>{selected.title}</h2><p>{selected.description || "Chưa có mô tả tài liệu."}</p></div><div className={styles.detailActions}><button aria-label="Chỉnh sửa" disabled={actionBusy} onClick={openEdit} type="button"><Pencil /></button><button aria-label="Lưu trữ" disabled={actionBusy || selected.status === "ARCHIVED"} onClick={() => void archiveSelected()} type="button"><Archive /></button></div></header>

            <section className={styles.releaseCard}><div className={styles.releaseIcon}><BookOpenCheck /></div><div><span>Phiên bản đang phát hành</span><strong>{selected.currentVersion ? `Phiên bản ${selected.currentVersion}` : "Chưa chọn phiên bản phát hành"}</strong><small>{selected.currentVersionInfo?.effectiveDate ? `Hiệu lực từ ${selected.currentVersionInfo.effectiveDate}` : "Chưa cập nhật ngày hiệu lực"}</small></div><span className={`${styles.statusBadge} ${styles[`status${selected.status}`]}`}>{statusLabel(selected.status)}</span></section>

            <section className={styles.metaGrid}><div><span>Định dạng</span><strong>{selected.documentType}</strong></div><div><span>Danh mục</span><strong>{categoryLabel(selected.ragDocumentType)}</strong></div><div><span>Năm ban hành</span><strong>{selected.year ?? "Chưa cập nhật"}</strong></div><div><span>Người tải lên</span><strong>{selected.uploadedBy?.fullName || "Không xác định"}</strong></div><div><span>Ngày tạo</span><strong>{formatDateTime(selected.createdAt)}</strong></div><div><span>Cập nhật gần nhất</span><strong>{formatDateTime(selected.updatedAt)}</strong></div></section>

            <section className={styles.versionSection}><div className={styles.sectionTitle}><div><History /><span><h3>Lịch sử phiên bản</h3><p>Quản lý tệp, ngày hiệu lực và phiên bản đang phát hành</p></span></div><button onClick={openVersionModal} type="button"><Upload /> Tải phiên bản mới</button></div><div className={styles.versions}>
              {selected.versions.map((version) => <article key={version.id}><div className={styles.versionMark}><FileCheck2 /></div><div className={styles.versionInfo}><strong>Phiên bản {version.version}</strong><span>{version.effectiveDate ? `Hiệu lực ${version.effectiveDate}` : "Chưa có ngày hiệu lực"} · {formatDateTime(version.createdAt)}</span><small>{version.status}</small></div><div className={styles.versionActions}><button title="Xem tài liệu" onClick={() => void openVersion(version, false)} type="button"><Eye /></button><button title="Tải tài liệu" onClick={() => void openVersion(version, true)} type="button"><Download /></button>{selected.currentVersion === version.version ? <span className={styles.currentPill}>Đang phát hành</span> : <button className={styles.publishButton} disabled={actionBusy || version.status !== "ACTIVE"} onClick={() => void setCurrentVersion(version)} type="button">Phát hành</button>}</div></article>)}
              {!selected.versions.length && <div className={styles.noVersion}><AlertCircle /> Tài liệu chưa có tệp phiên bản nào.</div>}
            </div></section>
            {message && <p className={styles.message}>{message}</p>}
          </>}
        </section>
      </div>}

      {documentModal && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDocumentModal(false); }}><form className={styles.modal} onSubmit={submitDocument}><header><div><span>{formMode === "create" ? "TÀI LIỆU MỚI" : "CHỈNH SỬA"}</span><h2>{formMode === "create" ? "Thêm form / tài liệu" : "Cập nhật tài liệu"}</h2></div><button disabled={saving} onClick={() => setDocumentModal(false)} type="button"><X /></button></header><div className={styles.formBody}>
        <label className={styles.fullField}><span>Tên tài liệu *</span><input maxLength={255} required value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} /></label>
        <label><span>Danh mục *</span><select value={documentForm.category} onChange={(event) => setDocumentForm({ ...documentForm, category: event.target.value as KnowledgeRagDocumentType })}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>Định dạng *</span><select disabled={formMode === "create" && Boolean(documentForm.file)} value={documentForm.documentType} onChange={(event) => setDocumentForm({ ...documentForm, documentType: event.target.value as KnowledgeDocumentType })}><option value="PDF">PDF</option><option value="DOCX">DOCX</option></select></label>
        <label><span>Năm ban hành</span><input min="2000" max="2100" type="number" value={documentForm.year} onChange={(event) => setDocumentForm({ ...documentForm, year: event.target.value })} /></label>
        <label><span>Trạng thái</span><select value={documentForm.status} onChange={(event) => setDocumentForm({ ...documentForm, status: event.target.value })}><option value="ACTIVE">Đang phát hành</option><option value="INACTIVE">Tạm ngưng</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>
        <label className={styles.fullField}><span>Mô tả</span><textarea rows={4} value={documentForm.description} onChange={(event) => setDocumentForm({ ...documentForm, description: event.target.value })} /></label>
        {formMode === "create" && <><label><span>Phiên bản đầu tiên *</span><input maxLength={30} required value={documentForm.version} onChange={(event) => setDocumentForm({ ...documentForm, version: event.target.value })} /></label><label className={styles.fileField}><span>Tệp PDF/DOCX *</span><input accept={ACCEPT} required type="file" onChange={(event) => { const file = event.target.files?.[0] ?? null; setDocumentForm({ ...documentForm, file, documentType: file ? typeFromFile(file) ?? documentForm.documentType : documentForm.documentType }); }} /></label></>}
        {formError && <p className={styles.formError}><AlertCircle />{formError}</p>}
      </div><footer><button disabled={saving} onClick={() => setDocumentModal(false)} type="button">Hủy</button><button className={styles.saveButton} disabled={saving} type="submit">{saving && <Loader2 className={styles.spin} />} {formMode === "create" ? "Thêm và phát hành" : "Lưu thay đổi"}</button></footer></form></div>}

      {versionModal && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setVersionModal(false); }}><form className={`${styles.modal} ${styles.smallModal}`} onSubmit={submitVersion}><header><div><span>PHIÊN BẢN MỚI</span><h2>Tải lên tệp tài liệu</h2></div><button disabled={saving} onClick={() => setVersionModal(false)} type="button"><X /></button></header><div className={styles.formBody}><label><span>Số phiên bản *</span><input maxLength={30} placeholder="Ví dụ: 2.0" required value={versionForm.version} onChange={(event) => setVersionForm({ ...versionForm, version: event.target.value })} /></label><label><span>Ngày hiệu lực</span><input type="date" value={versionForm.effectiveDate} onChange={(event) => setVersionForm({ ...versionForm, effectiveDate: event.target.value })} /></label><label className={`${styles.fullField} ${styles.fileField}`}><span>Tệp {selected?.documentType} *</span><input accept={ACCEPT} required type="file" onChange={(event) => setVersionForm({ ...versionForm, file: event.target.files?.[0] ?? null })} /></label>{formError && <p className={styles.formError}><AlertCircle />{formError}</p>}</div><footer><button disabled={saving} onClick={() => setVersionModal(false)} type="button">Hủy</button><button className={styles.saveButton} disabled={saving} type="submit">{saving && <Loader2 className={styles.spin} />} Tải phiên bản</button></footer></form></div>}
    </main>
  );
}
