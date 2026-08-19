# ============================================================
# Stage 1: Builder
# ============================================================
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv

ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        gcc \
        g++ \
        libffi-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv "${VIRTUAL_ENV}"

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# ============================================================
# Stage 2: Production
# ============================================================
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv

ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

RUN useradd \
    --create-home \
    --uid 1000 \
    --shell /usr/sbin/nologin \
    appuser

COPY . .

RUN mkdir -p \
    /app/data/chroma \
    /app/data/rag \
    /app/database \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 10000

# ============================================================
# Health Check
# ============================================================
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=60s \
    --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# ============================================================
# Production Server
# ============================================================
CMD ["sh", "-c", "gunicorn src.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers ${WEB_CONCURRENCY:-1} \
    --bind 0.0.0.0:${PORT:-10000} \
    --timeout 120 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile -"]