"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Trash2,
  X,
} from "lucide-react";
import {
  adminKnowledgeBaseApi,
  formatDateTime,
  type KnowledgeDocument,
  type KnowledgeDocumentDetail,
  type KnowledgeDocumentPayload,
  type KnowledgeDocumentVersion,
  type KnowledgeDocumentsResponse,
} from "@/lib/adminKnowledgeBase";
import styles from "./page.module.css";

const PAGE_SIZE = 10;
const DOCUMENT_TYPE_OPTIONS = ["PDF", "DOC"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ARCHIVED"];
const VERSION_STATUS_OPTIONS = ["ACTIVE", "SUPERSEDED", "ARCHIVED"];

type DocumentFormValues = {
  title: string;
  documentType: string;
  description: string;
  fileUrl: string;
  currentVersion: string;
  year: string;
  status: string;
  file: File | null;
};

const emptyForm: DocumentFormValues = {
  title: "",
  documentType: "PDF",
  description: "",
  fileUrl: "",
  currentVersion: "",
  year: "",
  status: "ACTIVE",
  file: null,
};

type VersionFormValues = {
  version: string;
  status: string;
  effectiveDate: string;
  file: File | null;
};

const emptyVersionForm: VersionFormValues = {
  version: "",
  status: "ACTIVE",
  effectiveDate: "",
  file: null,
};

export default function KnowledgeDocumentsPage() {
  const [data, setData] = useState<KnowledgeDocumentsResponse | null>(null);
  const [selected, setSelected] = useState<KnowledgeDocumentDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formValues, setFormValues] = useState<DocumentFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [versionFormOpen, setVersionFormOpen] = useState(false);
  const [versionFormValues, setVersionFormValues] =
    useState<VersionFormValues>(emptyVersionForm);
  const [versionFormError, setVersionFormError] = useState<string | null>(null);
  const [versionSubmitting, setVersionSubmitting] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo(
    () => ({
      search: debouncedSearch,
      documentType: documentType || undefined,
      status: status || undefined,
      year: year ? Number(year) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, documentType, status, year, page],
  );

  const loadDocuments = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await adminKnowledgeBaseApi.documents(query);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load documents.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDocuments();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadDocuments]);

  useEffect(() => {
    if (!data) return;

    const timeout = window.setTimeout(() => {
      if (!selectedId && data.items.length > 0) {
        setSelectedId(data.items[0].id);
        return;
      }

      if (
        selectedId &&
        !data.items.some((item) => item.id === selectedId)
      ) {
        setSelected(null);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [data, selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const response = await adminKnowledgeBaseApi.document(selectedId);
        setSelected(response.document);
      } catch (err) {
        setDetailError(
          err instanceof Error ? err.message : "Unable to load document detail.",
        );
      } finally {
        setDetailLoading(false);
      }
    };

    const timeout = window.setTimeout(() => {
      void loadDetail();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [selectedId]);

  const totalPages = data?.totalPages ?? 0;

  const openCreateForm = () => {
    setFormMode("create");
    setFormValues(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (document: KnowledgeDocumentDetail) => {
    setFormMode("edit");
    setFormValues({
      title: document.title,
      documentType: document.documentType,
      description: document.description ?? "",
      fileUrl: document.fileUrl ?? "",
      currentVersion: document.currentVersion ?? "",
      year: document.year?.toString() ?? "",
      status: document.status,
      file: null,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const formPayload = (): KnowledgeDocumentPayload => {
    const uploadedVersion =
      formMode === "create" && formValues.file
        ? formValues.currentVersion.trim() || "1.0"
        : formValues.currentVersion.trim();

    return {
      title: formValues.title.trim(),
      documentType: formValues.documentType.trim(),
      description: nullableText(formValues.description),
      fileUrl: nullableText(formValues.fileUrl),
      currentVersion: nullableText(uploadedVersion),
      year: formValues.year.trim() ? Number(formValues.year) : null,
      status: formValues.status,
    };
  };

  const submitForm = async () => {
    const payload = formPayload();
    if (!payload.title || !payload.documentType) {
      setFormError("Title and type are required.");
      return;
    }

    if (payload.year !== null && !Number.isInteger(payload.year)) {
      setFormError("Year must be a valid number.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      let response =
        formMode === "create"
          ? await adminKnowledgeBaseApi.createDocument(payload)
          : await adminKnowledgeBaseApi.updateDocument(selectedId as number, payload);

      if (formMode === "create" && formValues.file) {
        const version = payload.currentVersion || "1.0";
        const upload = await adminKnowledgeBaseApi.uploadVersion(
          response.document.id,
          {
            version,
            status: "ACTIVE",
            effectiveDate: null,
            file: formValues.file,
          },
        );
        await adminKnowledgeBaseApi.setCurrentVersion(
          response.document.id,
          upload.versionId,
        );
        response = await adminKnowledgeBaseApi.document(response.document.id);
      }

      setSelected(response.document);
      setSelectedId(response.document.id);
      setFormOpen(false);
      await loadDocuments(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save document.");
    } finally {
      setSubmitting(false);
    }
  };

  const archiveSelected = async (document: KnowledgeDocumentDetail) => {
    if (!window.confirm(`Archive "${document.title}"?`)) return;

    setActionBusy(true);
    setDetailError(null);

    try {
      const response = await adminKnowledgeBaseApi.archiveDocument(document.id);
      setSelected(response.document);
      await loadDocuments(true);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Unable to archive document.");
    } finally {
      setActionBusy(false);
    }
  };

  const deleteSelected = async (document: KnowledgeDocumentDetail) => {
    const confirmed = window.confirm(
      `Delete "${document.title}" permanently? Related versions and index jobs may also be removed.`,
    );
    if (!confirmed) return;

    setActionBusy(true);
    setDetailError(null);

    try {
      await adminKnowledgeBaseApi.deleteDocument(document.id);
      setSelected(null);
      setSelectedId(null);
      await loadDocuments(true);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Unable to delete document.");
    } finally {
      setActionBusy(false);
    }
  };

  const openVersionForm = () => {
    setVersionFormValues(emptyVersionForm);
    setVersionFormError(null);
    setVersionFormOpen(true);
  };

  const submitVersionForm = async () => {
    if (!selected) return;

    const version = versionFormValues.version.trim();
    if (!version) {
      setVersionFormError("Version is required.");
      return;
    }
    if (!versionFormValues.file) {
      setVersionFormError("A file is required.");
      return;
    }

    setVersionSubmitting(true);
    setVersionFormError(null);

    try {
      await adminKnowledgeBaseApi.uploadVersion(selected.id, {
        version,
        status: versionFormValues.status,
        effectiveDate: nullableText(versionFormValues.effectiveDate),
        file: versionFormValues.file,
      });

      const response = await adminKnowledgeBaseApi.document(selected.id);
      setSelected(response.document);
      setVersionFormOpen(false);
      await loadDocuments(true);
    } catch (err) {
      setVersionFormError(
        err instanceof Error ? err.message : "Unable to upload version.",
      );
    } finally {
      setVersionSubmitting(false);
    }
  };

  const setCurrentVersion = async (version: KnowledgeDocumentVersion) => {
    if (!selected) return;
    setActionBusy(true);
    setDetailError(null);

    try {
      await adminKnowledgeBaseApi.setCurrentVersion(selected.id, version.id);
      const response = await adminKnowledgeBaseApi.document(selected.id);
      setSelected(response.document);
      await loadDocuments(true);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Unable to set current version.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Knowledge Base</p>
          <h1>Documents</h1>
          <p className={styles.description}>
            Manage the official document records used by the RAG knowledge base.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={openCreateForm}
          >
            <Plus size={17} />
            Add Document
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={() => loadDocuments(true)}
            disabled={refreshing}
            title="Refresh documents"
            aria-label="Refresh documents"
          >
            <RefreshCw size={18} className={refreshing ? styles.spin : ""} />
          </button>
        </div>
      </section>

      <section className={styles.toolbar}>
        <label className={styles.searchBox}>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, description, file URL"
          />
        </label>

        <select
          value={documentType}
          onChange={(event) => {
            setDocumentType(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by document type"
        >
          <option value="">All types</option>
          {data?.filters.types.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {data?.filters.statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(event) => {
            setYear(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by year"
        >
          <option value="">All years</option>
          {data?.filters.years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      {error && <div className={styles.errorBox}>{error}</div>}

      <section className={styles.contentGrid}>
        <div className={styles.tablePanel}>
          <div className={styles.tableHeader}>
            <div>
              <strong>{data?.total ?? 0}</strong>
              <span> documents</span>
            </div>
            <span>
              Page {data?.page ?? page}
              {totalPages ? ` of ${totalPages}` : ""}
            </span>
          </div>

          {loading ? (
            <div className={styles.emptyState}>Loading documents...</div>
          ) : !data?.items.length ? (
            <div className={styles.emptyState}>No documents found.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Year</th>
                    <th>Current Version</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      active={selectedId === document.id}
                      onSelect={() => setSelectedId(document.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.pagination}>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <span>{page}</span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || !totalPages || page >= totalPages}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <aside className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <Database size={18} />
            <span>Document Detail</span>
          </div>

          {detailLoading ? (
            <div className={styles.emptyState}>Loading detail...</div>
          ) : detailError ? (
            <div className={styles.errorBox}>{detailError}</div>
          ) : !selected ? (
            <div className={styles.emptyState}>Select a document.</div>
          ) : (
            <DocumentDetail
              document={selected}
              actionBusy={actionBusy}
              onEdit={() => openEditForm(selected)}
              onArchive={() => archiveSelected(selected)}
              onDelete={() => deleteSelected(selected)}
              onAddVersion={openVersionForm}
              onSetCurrentVersion={setCurrentVersion}
            />
          )}
        </aside>
      </section>

      {formOpen && (
        <DocumentFormModal
          mode={formMode}
          values={formValues}
          error={formError}
          submitting={submitting}
          onChange={setFormValues}
          onClose={() => setFormOpen(false)}
          onSubmit={submitForm}
        />
      )}

      {versionFormOpen && (
        <VersionFormModal
          values={versionFormValues}
          error={versionFormError}
          submitting={versionSubmitting}
          onChange={setVersionFormValues}
          onClose={() => setVersionFormOpen(false)}
          onSubmit={submitVersionForm}
        />
      )}
    </main>
  );
}

function DocumentRow({
  document,
  active,
  onSelect,
}: {
  document: KnowledgeDocument;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      className={active ? styles.activeRow : ""}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <td>
        <div className={styles.documentCell}>
          <FileText size={17} />
          <div>
            <strong>{document.title}</strong>
            <span>{document.description || document.fileUrl || "-"}</span>
          </div>
        </div>
      </td>
      <td>{document.documentType}</td>
      <td>
        <span className={`${styles.badge} ${styles[document.status.toLowerCase()] ?? ""}`}>
          {document.status}
        </span>
      </td>
      <td>{document.year ?? "-"}</td>
      <td>{document.currentVersion || document.currentVersionInfo?.version || "-"}</td>
      <td>{formatDateTime(document.updatedAt)}</td>
    </tr>
  );
}

function DocumentDetail({
  document,
  actionBusy,
  onEdit,
  onArchive,
  onDelete,
  onAddVersion,
  onSetCurrentVersion,
}: {
  document: KnowledgeDocumentDetail;
  actionBusy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddVersion: () => void;
  onSetCurrentVersion: (version: KnowledgeDocumentVersion) => void;
}) {
  return (
    <div className={styles.detailBody}>
      <div className={styles.detailTitleRow}>
        <div>
          <h2>{document.title}</h2>
          <p>{document.description || "No description."}</p>
        </div>

        <div className={styles.detailActions}>
          <button type="button" onClick={onEdit} disabled={actionBusy} title="Edit document">
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onArchive}
            disabled={actionBusy || document.status === "ARCHIVED"}
            title="Archive document"
          >
            <Archive size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={actionBusy}
            className={styles.dangerIconButton}
            title="Delete document"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className={styles.detailMeta}>
        <Meta label="Type" value={document.documentType} />
        <Meta label="Status" value={document.status} />
        <Meta label="Year" value={document.year?.toString() ?? "-"} />
        <Meta label="Current version" value={document.currentVersion ?? "-"} />
        <Meta label="File URL" value={document.fileUrl ?? "-"} />
        <Meta
          label="Uploaded by"
          value={
            document.uploadedBy
              ? `${document.uploadedBy.fullName} (${document.uploadedBy.email})`
              : "-"
          }
        />
        <Meta label="Created" value={formatDateTime(document.createdAt)} />
        <Meta label="Updated" value={formatDateTime(document.updatedAt)} />
      </div>

      {document.latestIndexJob && (
        <div className={styles.indexBox}>
          <div>
            <CalendarDays size={17} />
            <strong>Latest index job</strong>
          </div>
          <p>
            {document.latestIndexJob.status} · {document.latestIndexJob.chunksCreated} chunks
          </p>
          <span>{formatDateTime(document.latestIndexJob.completedAt)}</span>
        </div>
      )}

      <div className={styles.versions}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Versions</div>
          <button type="button" onClick={onAddVersion}>
            <Upload size={15} />
            Add Version
          </button>
        </div>
        {!document.versions.length ? (
          <div className={styles.emptyState}>No versions recorded.</div>
        ) : (
          document.versions.map((version) => (
            <div className={styles.versionRow} key={version.id}>
              <div>
                <strong>v{version.version}</strong>
                <span>{version.status}</span>
              </div>
              <div>
                <span>{version.effectiveDate || "No effective date"}</span>
                <span>{version.chunkPath || version.extractedTextPath || "-"}</span>
              </div>
              <div className={styles.versionActions}>
                {document.currentVersion === version.version ? (
                  <span className={styles.currentPill}>Current</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetCurrentVersion(version)}
                    disabled={actionBusy}
                  >
                    Set current
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DocumentFormModal({
  mode,
  values,
  error,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  values: DocumentFormValues;
  error: string | null;
  submitting: boolean;
  onChange: (values: DocumentFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const update = <K extends keyof DocumentFormValues>(
    field: K,
    value: DocumentFormValues[K],
  ) => {
    onChange({
      ...values,
      [field]: value,
    });
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.eyebrow}>Document Metadata</p>
            <h2>{mode === "create" ? "Add Document" : "Edit Document"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close form">
            <X size={18} />
          </button>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <div className={styles.formGrid}>
          <label>
            <span>Title</span>
            <input
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              maxLength={255}
            />
          </label>

          <label>
            <span>Type</span>
            <select
              value={values.documentType}
              onChange={(event) => update("documentType", event.target.value)}
            >
              {DOCUMENT_TYPE_OPTIONS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              value={values.status}
              onChange={(event) => update("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Year</span>
            <input
              value={values.year}
              onChange={(event) => update("year", event.target.value)}
              inputMode="numeric"
            />
          </label>

          <label>
            <span>Current Version</span>
            <input
              value={values.currentVersion}
              onChange={(event) => update("currentVersion", event.target.value)}
              maxLength={30}
            />
          </label>

          {mode === "create" ? (
            <label className={styles.fullField}>
              <span>File</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) =>
                  update("file", event.target.files?.[0] ?? null)
                }
              />
              <em className={styles.fieldHint}>
                The selected file will be saved as the first version of this document.
              </em>
            </label>
          ) : (
            <div className={`${styles.fullField} ${styles.fieldHintBox}`}>
              Use Add Version to upload or replace the document file.
            </div>
          )}

          <label className={styles.fullField}>
            <span>Description</span>
            <textarea
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              rows={4}
            />
          </label>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionFormModal({
  values,
  error,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  values: VersionFormValues;
  error: string | null;
  submitting: boolean;
  onChange: (values: VersionFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const update = <K extends keyof VersionFormValues>(
    field: K,
    value: VersionFormValues[K],
  ) => {
    onChange({
      ...values,
      [field]: value,
    });
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.eyebrow}>Document Version</p>
            <h2>Add Version</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close version form">
            <X size={18} />
          </button>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <div className={styles.formGrid}>
          <label>
            <span>Version</span>
            <input
              value={values.version}
              onChange={(event) => update("version", event.target.value)}
              maxLength={30}
              placeholder="1.0"
            />
          </label>

          <label>
            <span>Status</span>
            <select
              value={values.status}
              onChange={(event) => update("status", event.target.value)}
            >
              {VERSION_STATUS_OPTIONS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Effective Date</span>
            <input
              type="date"
              value={values.effectiveDate}
              onChange={(event) => update("effectiveDate", event.target.value)}
            />
          </label>

          <label className={styles.fullField}>
            <span>File</span>
            <input
              type="file"
              onChange={(event) =>
                update("file", event.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? "Uploading..." : "Upload Version"}
          </button>
        </div>
      </div>
    </div>
  );
}

function nullableText(value: string): string | null {
  const cleaned = value.trim();
  return cleaned || null;
}
