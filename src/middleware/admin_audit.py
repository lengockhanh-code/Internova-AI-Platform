from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from uuid import uuid4

from fastapi import Request
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from src.security.auth import decode_access_token
from src.services.admin_audit_logs_service import record_admin_audit_event


@dataclass(frozen=True)
class AuditDescriptor:
    action: str
    category: str
    resource_type: str
    resource_id: str | None
    resource_label: str
    detail: str
    severity: str = "LOW"


def _resource_id(parts: list[str], marker: str) -> str | None:
    try:
        value = parts[parts.index(marker) + 1]
    except (ValueError, IndexError):
        return None
    return value if value.isdigit() else None


def describe_admin_action(method: str, path: str) -> AuditDescriptor | None:
    if method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return None
    if not (path.startswith("/api/v1/admin/") or path == "/api/v1/chat/reload"):
        return None

    parts = [part for part in path.split("/") if part]
    if path == "/api/v1/admin/system/configuration":
        return AuditDescriptor(
            "SYSTEM_CONFIGURATION_UPDATED",
            "SYSTEM",
            "CONFIGURATION",
            None,
            "Cấu hình hệ thống",
            "Cập nhật cấu hình vận hành hệ thống",
            "HIGH",
        )
    if "/system/users" in path:
        resource_id = _resource_id(parts, "users")
        if method == "POST":
            return AuditDescriptor("USER_CREATED", "ACCOUNT", "USER", None, "Tài khoản mới", "Tạo tài khoản người dùng", "MEDIUM")
        if path.endswith("/status"):
            return AuditDescriptor("USER_STATUS_CHANGED", "ACCESS", "USER", resource_id, f"Tài khoản #{resource_id}", "Thay đổi trạng thái truy cập tài khoản", "HIGH")
        return AuditDescriptor("USER_UPDATED", "ACCOUNT", "USER", resource_id, f"Tài khoản #{resource_id}", "Cập nhật tài khoản và vai trò", "HIGH")

    if "/admin/lecturers" in path:
        resource_id = _resource_id(parts, "lecturers")
        resource_label = f"Giảng viên #{resource_id}" if resource_id else "Giảng viên mới"
        if method == "POST":
            return AuditDescriptor("LECTURER_CREATED", "ACCOUNT", "LECTURER", None, resource_label, "Tạo tài khoản và hồ sơ giảng viên", "MEDIUM")
        if path.endswith("/status"):
            return AuditDescriptor("LECTURER_STATUS_CHANGED", "ACCESS", "LECTURER", resource_id, resource_label, "Thay đổi trạng thái truy cập của giảng viên", "HIGH")
        if method == "DELETE":
            return AuditDescriptor("LECTURER_DEACTIVATED", "ACCESS", "LECTURER", resource_id, resource_label, "Vô hiệu hóa tài khoản giảng viên", "HIGH")
        return AuditDescriptor("LECTURER_UPDATED", "ACCOUNT", "LECTURER", resource_id, resource_label, "Cập nhật hồ sơ chuyên môn của giảng viên", "MEDIUM")

    if "/students" in path:
        resource_id = _resource_id(parts, "students")
        action = {"POST": "STUDENT_CREATED", "PATCH": "STUDENT_UPDATED", "DELETE": "STUDENT_DEACTIVATED"}.get(method, "STUDENT_CHANGED")
        return AuditDescriptor(action, "ACCOUNT", "STUDENT", resource_id, f"Sinh viên #{resource_id}" if resource_id else "Sinh viên mới", "Thay đổi hồ sơ sinh viên", "HIGH" if method == "DELETE" else "MEDIUM")

    if "/knowledge/documents" in path:
        document_id = _resource_id(parts, "documents")
        resource_label = f"Tài liệu #{document_id}" if document_id else "Tài liệu mới"
        if "/versions" in path:
            action = "DOCUMENT_VERSION_ACTIVATED" if path.endswith("/set-current") else "DOCUMENT_VERSION_CREATED"
            detail = "Đặt phiên bản tài liệu hiện hành" if path.endswith("/set-current") else "Tải lên phiên bản tài liệu"
            return AuditDescriptor(action, "KNOWLEDGE", "DOCUMENT_VERSION", document_id, resource_label, detail, "MEDIUM")
        if path.endswith("/archive"):
            return AuditDescriptor("DOCUMENT_ARCHIVED", "KNOWLEDGE", "DOCUMENT", document_id, resource_label, "Lưu trữ tài liệu Knowledge Base", "HIGH")
        action = {"POST": "DOCUMENT_CREATED", "PATCH": "DOCUMENT_UPDATED", "DELETE": "DOCUMENT_DELETED"}.get(method, "DOCUMENT_CHANGED")
        return AuditDescriptor(action, "KNOWLEDGE", "DOCUMENT", document_id, resource_label, "Thay đổi tài liệu Knowledge Base", "HIGH" if method == "DELETE" else "MEDIUM")

    if path.endswith("/knowledge/reindex"):
        return AuditDescriptor("RAG_INDEX_REBUILT", "RAG", "RAG_INDEX", None, "RAG index", "Xây dựng và kích hoạt lại RAG index", "HIGH")
    if path == "/api/v1/chat/reload":
        return AuditDescriptor("RAG_PIPELINE_RELOADED", "RAG", "RAG_PIPELINE", None, "RAG pipeline", "Nạp lại pipeline RAG đang hoạt động", "MEDIUM")
    if "/internships" in path:
        resource_id = _resource_id(parts, "internships")
        return AuditDescriptor("INTERNSHIP_REVIEWED", "INTERNSHIP", "INTERNSHIP_APPLICATION", resource_id, f"Đăng ký #{resource_id}", "Cập nhật phân công hoặc xét duyệt thực tập", "MEDIUM")
    if "/alerts/" in path:
        alert_id = _resource_id(parts, "alerts") or (parts[-2] if len(parts) > 1 else None)
        return AuditDescriptor("ALERT_STATE_CHANGED", "OBSERVABILITY", "ALERT", alert_id, f"Cảnh báo {alert_id}", "Cập nhật trạng thái cảnh báo", "MEDIUM")

    return AuditDescriptor("ADMIN_CHANGE", "SYSTEM", "SYSTEM_RESOURCE", None, path, "Thực hiện thay đổi trong trang quản trị", "MEDIUM")


def _actor_claims(request: Request) -> tuple[int | None, str | None]:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return None, None
    try:
        payload = decode_access_token(authorization.split(" ", 1)[1])
        return int(payload["sub"]), str(payload.get("role") or "") or None
    except Exception:
        return None, None


def _safe_query_keys(request: Request) -> list[str]:
    blocked = ("password", "token", "secret", "key", "authorization")
    return sorted({
        key: value
        for key, value in request.query_params.multi_items()
        if not any(fragment in key.lower() for fragment in blocked)
    })


class AdminAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        descriptor = describe_admin_action(request.method.upper(), request.url.path)
        if descriptor is None:
            return await call_next(request)

        started = perf_counter()
        request_id = request.headers.get("x-request-id") or str(uuid4())
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            actor_id, actor_role = _actor_claims(request)
            forwarded_for = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
            client_ip = forwarded_for or (request.client.host if request.client else None)
            outcome = "SUCCESS" if status_code < 400 else "FAILED"
            severity = descriptor.severity
            if status_code >= 500:
                severity = "CRITICAL"
            elif status_code >= 400 and severity == "LOW":
                severity = "MEDIUM"
            await run_in_threadpool(
                record_admin_audit_event,
                {
                    "request_id": request_id[:100],
                    "actor_id": actor_id,
                    "actor_role": actor_role,
                    "action": descriptor.action,
                    "category": descriptor.category,
                    "resource_type": descriptor.resource_type,
                    "resource_id": descriptor.resource_id,
                    "resource_label": descriptor.resource_label,
                    "outcome": outcome,
                    "severity": severity,
                    "http_method": request.method.upper(),
                    "request_path": request.url.path,
                    "http_status": status_code,
                    "ip_address": client_ip[:64] if client_ip else None,
                    "user_agent": request.headers.get("user-agent", "")[:1000] or None,
                    "detail": descriptor.detail,
                    "metadata": {"queryKeys": _safe_query_keys(request)},
                    "duration_ms": max(0, round((perf_counter() - started) * 1000)),
                },
            )
