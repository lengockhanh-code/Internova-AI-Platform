# 🚀 Hướng Dẫn Deploy Toàn Bộ Dự Án (Backend + Frontend)

> **Kiến trúc:** Backend FastAPI (Docker) deploy lên **Render** | Frontend Next.js deploy lên **Vercel**
> **Nhánh production:** `develop`
> **Tự động cập nhật:** CÓ — mỗi lần `git push` lên nhánh `develop` là cả 2 nền tảng tự deploy lại

---

## PHẦN 1: Deploy Backend FastAPI lên Render (Docker)

### Bước 1 — Đảm bảo `.env` KHÔNG có trong git

```bash
# Kiểm tra .env đã có trong .gitignore chưa
cat .gitignore | grep ".env"
# Phải thấy dòng .env xuất hiện → OK
```

### Bước 2 — Push code lên GitHub

```bash
git add .
git commit -m "chore: add production Dockerfile and requirements"
git push origin develop
```

### Bước 3 — Tạo Web Service trên Render

1. Vào https://render.com → Đăng nhập bằng GitHub
2. Bấm **"New +"** → chọn **"Web Service"**
3. Kết nối GitHub → chọn repository của bạn
4. Cấu hình như sau:

| Trường | Giá trị |
|--------|---------|
| **Name** | `internova-backend` |
| **Branch** | `develop` |
| **Runtime** | `Docker` |
| **Dockerfile Path** | `./Dockerfile` |
| **Instance Type** | `Free` (hoặc Starter $7/tháng nếu cần) |

### Bước 4 — Khai báo Environment Variables trên Render

Vào tab **"Environment"** → Bấm **"Add from .env"** → Paste nội dung file `.env` vào → Render tự parse.

Sau đó **sửa lại** các giá trị cho production:

```
APP_ENV=production
DATABASE_URL=postgresql://...  ← URL PostgreSQL thật (Render có thể tạo DB miễn phí)
CORS_ORIGINS=https://internova-frontend.vercel.app,http://localhost:3000
CHROMA_PERSIST_DIR=/app/Data/chroma
LANGCHAIN_TRACING_V2=false
```

> **Giữ nguyên:** OPENAI_API_KEY, AI_LOG_API_KEY, PyJWT keys

### Bước 5 — Deploy

- Bấm **"Create Web Service"** → Render sẽ tự kéo code, build Docker image và khởi chạy.
- Sau khoảng **5-10 phút**, bạn sẽ nhận được URL dạng: `https://internova-backend.onrender.com`
- Kiểm tra bằng cách mở: `https://internova-backend.onrender.com/health` → phải thấy `{"status":"ok"}`

### Tự động cập nhật Backend
> Mỗi khi bạn `git push origin develop`, Render tự detect, build Docker mới và deploy không downtime.

---

## PHẦN 2: Deploy Frontend Next.js lên Vercel

### Bước 1 — Push code lên GitHub

```bash
git add frontend/
git commit -m "chore: prepare frontend for Vercel deploy"
git push origin develop
```

### Bước 2 — Tạo Project trên Vercel

1. Vào https://vercel.com → Đăng nhập bằng GitHub
2. Bấm **"Add New Project"** → chọn repository của bạn → **"Import"**
3. Cấu hình quan trọng:

| Trường | Giá trị |
|--------|---------|
| **Framework Preset** | `Next.js` |
| **Root Directory** | `frontend` ← RẤT QUAN TRỌNG |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |

> ⚠️ **Root Directory PHẢI đặt là `frontend`** vì code Next.js của bạn nằm trong subfolder!

### Bước 3 — Khai báo Environment Variables trên Vercel

Trong màn hình cấu hình, tìm phần **"Environment Variables"** → Bấm **"Import .env"** → paste nội dung `frontend/.env` vào.

Sau đó **sửa lại**:

| Biến | Giá trị local | Giá trị production |
|------|-------------|-------------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | `https://internova-backend.onrender.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | (giữ nguyên) | (giữ nguyên) |

Scope: chọn **Production + Preview + Development** cho tất cả.

### Bước 4 — Cấu hình Production Branch

Sau khi deploy xong, vào **Project Settings → Git**:
- **Production Branch:** đổi từ `main` thành `develop`

### Bước 5 — Deploy

- Bấm **"Deploy"** → Vercel build Next.js trong ~2-3 phút.
- Kết quả: `https://internova-frontend.vercel.app`

### Tự động cập nhật Frontend
> Mỗi khi bạn `git push origin develop`, Vercel tự build lại web trong ~2 phút.
> Các Pull Request sẽ được tạo **Preview URL riêng** để test trước khi merge.

---

## PHẦN 3: Cập nhật CORS Backend

Sau khi có URL Vercel, quay lại **Render → Environment** → sửa:
```
CORS_ORIGINS=https://internova-frontend.vercel.app,http://localhost:3000
```
→ Bấm **"Save Changes"** → Render tự restart container.

---

## Tổng quan CI/CD sau khi hoàn tất

```
git push origin develop
        │
        ├──► Render build Docker image mới (FastAPI Backend)
        │    └── ~5-10 phút → internova-backend.onrender.com cập nhật
        │
        └──► Vercel build Next.js mới (Frontend)
             └── ~2-3 phút → internova-frontend.vercel.app cập nhật
```

---

## Kiểm tra sau deploy

```bash
# Backend OK?
curl https://internova-backend.onrender.com/health
# Kết quả: {"status":"ok","env":"production"}

# API docs OK?
# Mở: https://internova-backend.onrender.com/docs
```
