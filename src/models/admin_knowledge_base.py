from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815


DocumentStatus = Literal["ACTIVE", "INACTIVE", "ARCHIVED"]

DocumentType = Literal[
    "PDF",
    "DOCX",
]

RagDocumentType = Literal[
    "policy",
    "form",
    "agreement",
    "talent_handbook",
    "capstone_booklet",
    "knowledge",
]


class AdminKnowledgeUser(BaseModel):
    id: int
    fullName: str
    email: str


class AdminKnowledgeDocumentVersion(BaseModel):
    id: int
    version: str
    fileUrl: str | None = None
    fileHash: str | None = None
    extractedTextPath: str | None = None
    chunkPath: str | None = None
    effectiveDate: str | None = None
    status: str
    createdAt: str | None = None


class AdminKnowledgeIndexJob(BaseModel):
    id: int
    jobType: str
    status: str
    chunksCreated: int = 0
    errorMessage: str | None = None
    startedAt: str | None = None
    completedAt: str | None = None
    createdAt: str | None = None


class AdminKnowledgeDocumentListItem(BaseModel):
    id: int
    title: str
    documentType: DocumentType
    ragDocumentType: RagDocumentType | None = None
    description: str | None = None
    fileUrl: str | None = None
    currentVersion: str | None = None
    year: int | None = None
    status: str
    uploadedBy: AdminKnowledgeUser | None = None
    createdAt: str | None = None
    updatedAt: str | None = None
    currentVersionInfo: AdminKnowledgeDocumentVersion | None = None
    latestIndexJob: AdminKnowledgeIndexJob | None = None


class AdminKnowledgeDocumentFilters(BaseModel):
    types: list[str] = Field(default_factory=list)
    statuses: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)


class AdminKnowledgeDocumentsResponse(BaseModel):
    items: list[AdminKnowledgeDocumentListItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    pageSize: int = 10
    totalPages: int = 0
    filters: AdminKnowledgeDocumentFilters = Field(
        default_factory=AdminKnowledgeDocumentFilters,
    )


class AdminKnowledgeDocumentDetail(AdminKnowledgeDocumentListItem):
    versions: list[AdminKnowledgeDocumentVersion] = Field(default_factory=list)


class AdminKnowledgeDocumentDetailResponse(BaseModel):
    document: AdminKnowledgeDocumentDetail


class AdminKnowledgeDocumentCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    documentType: DocumentType
    ragDocumentType: RagDocumentType
    description: str | None = None
    fileUrl: str | None = None
    currentVersion: str | None = Field(default=None, max_length=30)
    year: int | None = None
    status: DocumentStatus = "ACTIVE"


class AdminKnowledgeDocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    documentType: DocumentType | None = None
    ragDocumentType: RagDocumentType | None = None
    description: str | None = None
    fileUrl: str | None = None
    currentVersion: str | None = Field(default=None, max_length=30)
    year: int | None = None
    status: DocumentStatus | None = None


class AdminKnowledgeDocumentActionResponse(BaseModel):
    documentId: int
    message: str


class AdminKnowledgeDocumentVersionsResponse(BaseModel):
    items: list[AdminKnowledgeDocumentVersion] = Field(default_factory=list)


class AdminKnowledgeVersionActionResponse(BaseModel):
    documentId: int
    versionId: int
    message: str


class AdminRagChunkSummary(BaseModel):
    total: int = 0
    documents: int = 0
    translated: int = 0
    averageCharacters: int = 0


class AdminRagChunkFilters(BaseModel):
    documentNames: list[str] = Field(default_factory=list)
    documentTypes: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)


class AdminRagChunkListItem(BaseModel):
    chunkId: str
    position: int
    documentName: str
    documentType: str
    sourcePriority: int
    contentPreview: str
    language: str
    page: int | None = None
    section: str | None = None
    subsection: str | None = None
    topic: str | None = None
    policyVersion: str | None = None
    effectiveDate: str | None = None
    ingestedAt: str | None = None
    characterCount: int = 0
    wordCount: int = 0
    sourceElementCount: int = 0
    hasTranslation: bool = False


class AdminRagChunksResponse(BaseModel):
    items: list[AdminRagChunkListItem] = Field(default_factory=list)
    summary: AdminRagChunkSummary = Field(default_factory=AdminRagChunkSummary)
    filters: AdminRagChunkFilters = Field(default_factory=AdminRagChunkFilters)
    activeBuildId: str
    page: int = 1
    pageSize: int = 25
    total: int = 0
    totalPages: int = 0


class AdminRagChunkDetail(AdminRagChunkListItem):
    contentOriginal: str
    contentVi: str | None = None
    fileHash: str | None = None
    createdDate: str | None = None
    fileSizeBytes: int | None = None
    sourceElementIds: list[str] = Field(default_factory=list)


class AdminRagChunkDetailResponse(BaseModel):
    chunk: AdminRagChunkDetail
    activeBuildId: str
