const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export class KnowledgeBaseApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KnowledgeBaseApiError";
    this.status = status;
  }
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};

  const token =
    window.localStorage.getItem("internova_access_token") ||
    window.localStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("auth_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        message = body.detail;
      }
    } catch {}

    throw new KnowledgeBaseApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export type KnowledgeDocumentVersion = {
  id: number;
  version: string;
  fileUrl: string | null;
  fileHash: string | null;
  extractedTextPath: string | null;
  chunkPath: string | null;
  effectiveDate: string | null;
  status: string;
  createdAt: string | null;
};

export type KnowledgeIndexJob = {
  id: number;
  jobType: string;
  status: string;
  chunksCreated: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
};

export type KnowledgeUser = {
  id: number;
  fullName: string;
  email: string;
};

export type KnowledgeDocument = {
  id: number;
  title: string;
  documentType: string;
  description: string | null;
  fileUrl: string | null;
  currentVersion: string | null;
  year: number | null;
  status: string;
  uploadedBy: KnowledgeUser | null;
  createdAt: string | null;
  updatedAt: string | null;
  currentVersionInfo: KnowledgeDocumentVersion | null;
  latestIndexJob: KnowledgeIndexJob | null;
};

export type KnowledgeDocumentDetail = KnowledgeDocument & {
  versions: KnowledgeDocumentVersion[];
};

export type KnowledgeDocumentFilters = {
  types: string[];
  statuses: string[];
  years: number[];
};

export type KnowledgeDocumentsParams = {
  search?: string;
  documentType?: string;
  status?: string;
  year?: number;
  page?: number;
  pageSize?: number;
};

export type KnowledgeDocumentsResponse = {
  items: KnowledgeDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: KnowledgeDocumentFilters;
};

export type KnowledgeDocumentDetailResponse = {
  document: KnowledgeDocumentDetail;
};

export type KnowledgeDocumentPayload = {
  title: string;
  documentType: string;
  description: string | null;
  fileUrl: string | null;
  currentVersion: string | null;
  year: number | null;
  status: string;
};

export type KnowledgeDocumentActionResponse = {
  documentId: number;
  message: string;
};

export type KnowledgeDocumentVersionsResponse = {
  items: KnowledgeDocumentVersion[];
};

export type KnowledgeVersionActionResponse = {
  documentId: number;
  versionId: number;
  message: string;
};

export type KnowledgeVersionUploadPayload = {
  version: string;
  status: string;
  effectiveDate: string | null;
  file: File;
};

function documentsQuery(params: KnowledgeDocumentsParams): string {
  const query = new URLSearchParams();

  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.documentType) query.set("document_type", params.documentType);
  if (params.status) query.set("status", params.status);
  if (params.year) query.set("year", String(params.year));
  query.set("page", String(params.page ?? 1));
  query.set("page_size", String(params.pageSize ?? 10));

  return query.toString();
}

export const adminKnowledgeBaseApi = {
  documents: (params: KnowledgeDocumentsParams = {}) =>
    request<KnowledgeDocumentsResponse>(
      `/api/v1/admin/knowledge/documents?${documentsQuery(params)}`,
    ),

  document: (id: number) =>
    request<KnowledgeDocumentDetailResponse>(
      `/api/v1/admin/knowledge/documents/${encodeURIComponent(id)}`,
    ),

  createDocument: (payload: KnowledgeDocumentPayload) =>
    request<KnowledgeDocumentDetailResponse>(
      "/api/v1/admin/knowledge/documents",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  updateDocument: (id: number, payload: Partial<KnowledgeDocumentPayload>) =>
    request<KnowledgeDocumentDetailResponse>(
      `/api/v1/admin/knowledge/documents/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),

  archiveDocument: (id: number) =>
    request<KnowledgeDocumentDetailResponse>(
      `/api/v1/admin/knowledge/documents/${encodeURIComponent(id)}/archive`,
      {
        method: "POST",
      },
    ),

  deleteDocument: (id: number) =>
    request<KnowledgeDocumentActionResponse>(
      `/api/v1/admin/knowledge/documents/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    ),

  versions: (documentId: number) =>
    request<KnowledgeDocumentVersionsResponse>(
      `/api/v1/admin/knowledge/documents/${encodeURIComponent(documentId)}/versions`,
    ),

  uploadVersion: (
    documentId: number,
    payload: KnowledgeVersionUploadPayload,
  ) => {
    const body = new FormData();
    body.set("version", payload.version);
    body.set("status", payload.status);
    if (payload.effectiveDate) {
      body.set("effective_date", payload.effectiveDate);
    }
    body.set("file", payload.file);

    return request<KnowledgeVersionActionResponse>(
      `/api/v1/admin/knowledge/documents/${encodeURIComponent(documentId)}/versions`,
      {
        method: "POST",
        body,
      },
    );
  },

  setCurrentVersion: (documentId: number, versionId: number) =>
    request<KnowledgeVersionActionResponse>(
      `/api/v1/admin/knowledge/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/set-current`,
      {
        method: "POST",
      },
    ),
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
