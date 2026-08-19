# ============================================================
# Stage 1: Builder — cài đặt toàn bộ dependencies Python
# ============================================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Không tạo file .pyc và log Python xuất ngay ra terminal
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Cài system dependencies cần để build các package native
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements trước để tận dụng Docker layer cache
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --user -r requirements.txt


# ============================================================
# Stage 2: Production — image nhỏ gọn
# ============================================================
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/root/.local/bin:$PATH \
    PORT=8000

# Chỉ cài runtime libraries cần thiết
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages từ builder
COPY --from=builder /root/.local /root/.local

# Tạo non-root user
RUN useradd \
    --create-home \
    --uid 1000 \
    --shell /usr/sbin/nologin \
    appuser

# Copy source code
COPY . .

# Project của bạn sử dụng "data" viết thường
RUN mkdir -p \
    /app/data/chroma \
    /app/data/rag \
    /app/database \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# ============================================================
# Health check
# ============================================================
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=60s \
    --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# ============================================================
# Production server
# ============================================================
# PORT do Render/Railway truyền vào khi deploy.
# Local nếu không có PORT thì mặc định 8000.
CMD ["sh", "-c", "gunicorn src.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers ${WEB_CONCURRENCY:-2} \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile -"]