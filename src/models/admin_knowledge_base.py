from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


DocumentStatus = Literal["ACTIVE", "INACTIVE", "ARCHIVED"]


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
    documentType: str
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
    documentType: str = Field(min_length=1, max_length=100)
    description: str | None = None
    fileUrl: str | None = None
    currentVersion: str | None = Field(default=None, max_length=30)
    year: int | None = None
    status: DocumentStatus = "ACTIVE"


class AdminKnowledgeDocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    documentType: str | None = Field(default=None, min_length=1, max_length=100)
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
