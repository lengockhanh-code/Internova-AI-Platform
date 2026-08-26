import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.admin_knowledge_base_routes import (
    router as admin_knowledge_base_router,
)

# Admin
from src.api.admin_observability_routes import (
    router as admin_observability_router,
)

# Auth
from src.api.auth_routes import router as auth_router
from src.api.chat_history_routes import (
    router as chat_history_router,
)
from src.api.checklist_routes import (
    router as checklist_router,
)
from src.api.document_routes import (
    router as document_router,
)
from src.api.form_agent_routes import router as form_agent_router
from src.api.internship_profile_routes import (
    router as internship_profile_router,
)
from src.api.internship_registration_routes import (
    router as internship_registration_router,
)
from src.api.lecturer_application_routes import (
    router as lecturer_application_router,
)
from src.api.lecturer_evaluation_routes import (
    router as lecturer_evaluation_router,
)
from src.api.lecturer_notification_routes import (
    router as lecturer_notification_router,
)
from src.api.lecturer_reminder_routes import (
    router as lecturer_reminder_router,
)
from src.api.lecturer_report_routes import (
    router as lecturer_report_router,
)

# Lecturer
from src.api.lecturer_routes import (
    router as lecturer_router,
)
from src.api.lecturer_settings_routes import (
    router as lecturer_settings_router,
)
from src.api.lecturer_students_routes import (
    router as lecturer_students_router,
)
from src.api.notification_routes import (
    router as notification_router,
)
from src.api.notification_websocket_routes import (
    router as notification_websocket_router,
)

# ============================================================
# API ROUTERS
# ============================================================
# Chatbot / RAG
from src.api.routes import router as chat_router

# Student
from src.api.student_dashboard_routes import (
    router as student_dashboard_router,
)
from src.api.student_routes import (
    router as student_reports_router,
)
from src.api.student_settings_routes import (
    router as student_settings_router,
)

# Config
from src.config import get_settings

# ============================================================
# APP LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    configure_rag_logging()

    print(
        f"Starting {settings.app_name} "
        f"in {settings.app_env} mode"
    )

    yield

    print("Shutting down...")

# ============================================================
# RAG BASELINE LOGGING
# ============================================================

def configure_rag_logging() -> None:
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s - %(message)s"
    )

    logger_levels = {
        "src.rag.query_pipeline": logging.INFO,
        "src.rag.evidence": logging.INFO,
        "src.services.chat_service": logging.DEBUG,
    }

    for logger_name, level in logger_levels.items():
        target_logger = logging.getLogger(logger_name)
        target_logger.setLevel(level)

        # Tránh thêm handler nhiều lần khi app reload/import lại.
        if not any(
            getattr(handler, "_internova_rag_handler", False)
            for handler in target_logger.handlers
        ):
            handler = logging.StreamHandler()
            handler.setLevel(level)
            handler.setFormatter(formatter)
            handler._internova_rag_handler = True  # type: ignore[attr-defined]

            target_logger.addHandler(handler)

        # Không truyền tiếp lên root logger để tránh log bị in 2 lần.
        target_logger.propagate = False



# ============================================================
# SETTINGS
# ============================================================

settings = get_settings()


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Internova API",
    description=(
        "Backend API for Internova "
        "Internship Support Platform"
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# API ROUTES
# ============================================================

# Auth
app.include_router(
    auth_router,
    prefix="/api/v1",
)

# Chatbot / RAG
app.include_router(
    chat_router,
    prefix="/api/v1",
)

app.include_router(
    chat_history_router,
    prefix="/api/v1",
)

# Student Dashboard
app.include_router(
    student_dashboard_router,
    prefix="/api/v1",
)

app.include_router(
    student_settings_router,
    prefix="/api/v1",
)

# Student Checklist
app.include_router(
    checklist_router,
    prefix="/api/v1",
)

# Student Reports
app.include_router(
    student_reports_router,
    prefix="/api/v1",
)

# Student Internship Profile
app.include_router(
    internship_profile_router,
    prefix="/api/v1",
)

# Student Internship Registration
app.include_router(
    internship_registration_router,
    prefix="/api/v1",
)

# Lecturer Dashboard
app.include_router(
    lecturer_router,
    prefix="/api/v1",
)

# Lecturer Students
app.include_router(
    lecturer_students_router,
    prefix="/api/v1",
)

app.include_router(
    lecturer_report_router,
    prefix="/api/v1",
)

app.include_router(
    lecturer_application_router,
    prefix="/api/v1",
)

app.include_router(
    lecturer_evaluation_router,
    prefix="/api/v1",
)

app.include_router(
    lecturer_reminder_router,
    prefix="/api/v1",
)

app.include_router(
    lecturer_notification_router,
    prefix="/api/v1",
)

app.include_router(
    lecturer_settings_router,
    prefix="/api/v1",
)

app.include_router(
    notification_router,
    prefix="/api/v1",
)

app.include_router(
    notification_websocket_router,
    prefix="/api/v1",
)

app.include_router(
    document_router,
    prefix="/api/v1",
)

app.include_router(
    admin_observability_router,
)

app.include_router(
    admin_knowledge_base_router,
)

app.include_router(
    form_agent_router,
    prefix="/api/v1",
)

# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "env": settings.app_env,
    }


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():
    return {
        "name": "Internova API",
        "status": "running",
        "docs": "/docs",
    }
