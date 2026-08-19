-- ============================================================
-- CONSOLIDATED SCHEMA
-- (Gộp toàn bộ CREATE TABLE + ALTER TABLE thành bảng hoàn chỉnh,
--  loại bỏ các khối ALTER bị lặp lại)
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;


-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT,

    full_name VARCHAR(150) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(30),

    role VARCHAR(20) NOT NULL
        CHECK (
            role IN (
                'STUDENT',
                'LECTURER',
                'ADMIN'
            )
        ),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- gender
    gender VARCHAR(20)
        CHECK (
            gender IS NULL
            OR gender IN (
                'MALE',
                'FEMALE',
                'OTHER'
            )
        ),

    -- auth
    auth_provider VARCHAR(20)
        NOT NULL DEFAULT 'LOCAL'
        CHECK (
            auth_provider IN (
                'LOCAL',
                'GOOGLE'
            )
        ),
    google_sub VARCHAR(255),

    -- avatar (lưu trực tiếp trong PostgreSQL)
    avatar_data BYTEA,
    avatar_mime_type VARCHAR(100),
    avatar_file_name VARCHAR(255),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
ON users(google_sub)
WHERE google_sub IS NOT NULL;


-- ============================================================
-- 2. STUDENT PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS student_profiles (
    id BIGSERIAL PRIMARY KEY,

    student_id BIGINT UNIQUE NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    student_code VARCHAR(50) UNIQUE NOT NULL,

    faculty VARCHAR(150),
    major VARCHAR(150),
    cohort VARCHAR(50),

    gpa NUMERIC(4,2),

    skills TEXT[],

    cv_url TEXT,
    github_url TEXT,
    linkedin_url TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. LECTURER PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS lecturer_profiles (
    id BIGSERIAL PRIMARY KEY,

    lecturer_id BIGINT UNIQUE NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    lecturer_code VARCHAR(50) UNIQUE,

    academic_title VARCHAR(100),
    faculty VARCHAR(150),
    specialization TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. SEMESTERS
-- ============================================================

CREATE TABLE IF NOT EXISTS semesters (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    academic_year VARCHAR(20),
    semester_code VARCHAR(50) UNIQUE,

    start_date DATE,
    end_date DATE,

    registration_start_date DATE,
    registration_end_date DATE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 5. COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    industry VARCHAR(150),

    description TEXT,
    address TEXT,
    website TEXT,

    contact_name VARCHAR(150),
    contact_email CITEXT,
    phone VARCHAR(30),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. COMPANY MENTORS
-- ============================================================

CREATE TABLE IF NOT EXISTS company_mentors (
    id BIGSERIAL PRIMARY KEY,

    company_id BIGINT NOT NULL
        REFERENCES companies(id)
        ON DELETE CASCADE,

    full_name VARCHAR(150) NOT NULL,

    email CITEXT,
    phone VARCHAR(30),

    position VARCHAR(150),
    department VARCHAR(150),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 7. INTERNSHIP APPLICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS internship_applications (
    id BIGSERIAL PRIMARY KEY,

    student_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    semester_id BIGINT
        REFERENCES semesters(id)
        ON DELETE SET NULL,

    company_id BIGINT
        REFERENCES companies(id)
        ON DELETE SET NULL,

    company_mentor_id BIGINT
        REFERENCES company_mentors(id)
        ON DELETE SET NULL,

    assigned_lecturer_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    position_title VARCHAR(200),

    internship_type VARCHAR(50),
    description TEXT,

    expected_start_date DATE,
    expected_end_date DATE,

    cv_url TEXT,
    application_file_url TEXT,

    -- công việc / tín chỉ
    work_mode VARCHAR(20)
        CHECK (
            work_mode IS NULL
            OR work_mode IN (
                'ONSITE',
                'REMOTE',
                'HYBRID'
            )
        ),
    credits INTEGER
        CHECK (
            credits IS NULL
            OR credits > 0
        ),

    status VARCHAR(30)
        NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'UNDER_REVIEW',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    lecturer_comment TEXT,

    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. INTERNSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS internships (
    id BIGSERIAL PRIMARY KEY,

    student_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    lecturer_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    semester_id BIGINT
        REFERENCES semesters(id)
        ON DELETE SET NULL,

    company_id BIGINT
        REFERENCES companies(id)
        ON DELETE SET NULL,

    company_mentor_id BIGINT
        REFERENCES company_mentors(id)
        ON DELETE SET NULL,

    application_id BIGINT UNIQUE
        REFERENCES internship_applications(id)
        ON DELETE SET NULL,

    position_title VARCHAR(200) NOT NULL,

    description TEXT,

    start_date DATE,
    end_date DATE,

    required_hours INTEGER,
    completed_hours INTEGER NOT NULL DEFAULT 0,

    progress_percentage NUMERIC(5,2)
        NOT NULL DEFAULT 0
        CHECK (
            progress_percentage >= 0
            AND progress_percentage <= 100
        ),

    status VARCHAR(30)
        NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (
            status IN (
                'NOT_STARTED',
                'IN_PROGRESS',
                'PAUSED',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 9. WEEKLY REPORT SCHEDULES
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_report_schedules (
    id BIGSERIAL PRIMARY KEY,

    semester_id BIGINT NOT NULL
        REFERENCES semesters(id)
        ON DELETE CASCADE,

    week_number INTEGER NOT NULL
        CHECK (week_number > 0),

    title VARCHAR(255),
    description TEXT,

    start_date DATE,
    due_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (
        semester_id,
        week_number
    )
);


-- ============================================================
-- 10. WEEKLY REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_reports (
    id BIGSERIAL PRIMARY KEY,

    internship_id BIGINT NOT NULL
        REFERENCES internships(id)
        ON DELETE CASCADE,

    schedule_id BIGINT
        REFERENCES weekly_report_schedules(id)
        ON DELETE SET NULL,

    -- WEEKLY có week_number; MIDTERM/FINAL/REFLECTION không cần
    week_number INTEGER
        CHECK (week_number IS NULL OR week_number > 0),

    report_type VARCHAR(30)
        NOT NULL DEFAULT 'WEEKLY'
        CHECK (
            report_type IN (
                'WEEKLY',
                'MIDTERM',
                'FINAL',
                'REFLECTION'
            )
        ),

    title VARCHAR(255),

    content TEXT,
    file_url TEXT,

    -- File báo cáo lưu trực tiếp trong PostgreSQL
    file_data BYTEA,
    file_name VARCHAR(255),
    mime_type VARCHAR(150),
    file_size BIGINT,

    -- Giấy xác nhận hoàn thành thực tập (chỉ dùng cho FINAL)
    completion_letter_data BYTEA,
    completion_letter_name VARCHAR(255),
    completion_letter_mime_type VARCHAR(150),
    completion_letter_size BIGINT,

    status VARCHAR(30)
        NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'LATE',
                'UNDER_REVIEW',
                'REVISION_REQUIRED',
                'APPROVED'
            )
        ),

    lecturer_feedback TEXT,
    lecturer_score NUMERIC(5,2),

    due_at TIMESTAMP,
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Mỗi internship chỉ có 1 Weekly Report cho mỗi tuần (report_type = WEEKLY)
CREATE UNIQUE INDEX IF NOT EXISTS
idx_weekly_reports_unique_week
ON weekly_reports (
    internship_id,
    week_number
)
WHERE report_type = 'WEEKLY';

-- Mỗi internship: 1 Mid-term, 1 Final, 1 Reflection
CREATE UNIQUE INDEX IF NOT EXISTS
idx_reports_unique_special_type
ON weekly_reports (
    internship_id,
    report_type
)
WHERE report_type IN (
    'MIDTERM',
    'FINAL',
    'REFLECTION'
);


-- ============================================================
-- 11. EVALUATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluations (
    id BIGSERIAL PRIMARY KEY,

    internship_id BIGINT NOT NULL
        REFERENCES internships(id)
        ON DELETE CASCADE,

    evaluator_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    evaluator_type VARCHAR(30) NOT NULL
        CHECK (
            evaluator_type IN (
                'LECTURER',
                'COMPANY_MENTOR',
                'STUDENT',
                'ADMIN'
            )
        ),

    evaluation_type VARCHAR(50),

    total_score NUMERIC(5,2),

    feedback TEXT,
    strengths TEXT,
    improvements TEXT,

    status VARCHAR(30)
        NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'CONFIRMED'
            )
        ),

    submitted_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 12. LECTURER STUDENT NOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS lecturer_student_notes (
    id BIGSERIAL PRIMARY KEY,

    lecturer_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,

    student_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    internship_id BIGINT
        REFERENCES internships(id)
        ON DELETE CASCADE,

    note TEXT NOT NULL,

    is_private BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 13. REPORT COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS report_comments (
    id BIGSERIAL PRIMARY KEY,

    report_id BIGINT NOT NULL
        REFERENCES weekly_reports(id)
        ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    comment TEXT NOT NULL,

    parent_comment_id BIGINT
        REFERENCES report_comments(id)
        ON DELETE CASCADE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 14. CHECKLIST ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS checklist_items (
    id BIGSERIAL PRIMARY KEY,

    internship_id BIGINT NOT NULL
        REFERENCES internships(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    category VARCHAR(100),

    priority VARCHAR(20)
        NOT NULL DEFAULT 'MEDIUM'
        CHECK (
            priority IN (
                'HIGH',
                'MEDIUM',
                'LOW'
            )
        ),

    status VARCHAR(20)
        NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'IN_PROGRESS',
                'COMPLETED'
            )
        ),

    due_at TIMESTAMP,
    completed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 15. DEADLINES
-- ============================================================

CREATE TABLE IF NOT EXISTS deadlines (
    id BIGSERIAL PRIMARY KEY,

    semester_id BIGINT
        REFERENCES semesters(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    deadline_type VARCHAR(100) NOT NULL,

    target_role VARCHAR(30)
        CHECK (
            target_role IS NULL
            OR target_role IN (
                'STUDENT',
                'LECTURER',
                'ADMIN',
                'ALL'
            )
        ),

    due_at TIMESTAMP NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 16. AI PROMPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_prompts (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    feature VARCHAR(100) NOT NULL,

    system_prompt TEXT,
    user_prompt_template TEXT,

    version VARCHAR(30),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 17. KNOWLEDGE DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id BIGSERIAL PRIMARY KEY,

    title VARCHAR(255) NOT NULL,

    document_type VARCHAR(100) NOT NULL,

    description TEXT,

    file_url TEXT,

    current_version VARCHAR(30),

    year INTEGER,

    status VARCHAR(30)
        NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'ARCHIVED'
            )
        ),

    uploaded_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 18. KNOWLEDGE DOCUMENT VERSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_document_versions (
    id BIGSERIAL PRIMARY KEY,

    document_id BIGINT NOT NULL
        REFERENCES knowledge_documents(id)
        ON DELETE CASCADE,

    version VARCHAR(30) NOT NULL,

    file_url TEXT,
    file_hash VARCHAR(255),

    extracted_text_path TEXT,
    chunk_path TEXT,

    effective_date DATE,

    status VARCHAR(30)
        NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'SUPERSEDED',
                'ARCHIVED'
            )
        ),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (
        document_id,
        version
    )
);


-- ============================================================
-- 19. RAG INDEX JOBS
-- ============================================================

CREATE TABLE IF NOT EXISTS rag_index_jobs (
    id BIGSERIAL PRIMARY KEY,

    document_version_id BIGINT
        REFERENCES knowledge_document_versions(id)
        ON DELETE CASCADE,

    job_type VARCHAR(50)
        NOT NULL DEFAULT 'FULL_INDEX',

    status VARCHAR(30)
        NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'RUNNING',
                'COMPLETED',
                'FAILED'
            )
        ),

    chunks_created INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,

    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 20. LECTURER - STUDENT MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS lecturer_student_messages (
    id BIGSERIAL PRIMARY KEY,

    lecturer_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    student_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    internship_id BIGINT
        REFERENCES internships(id)
        ON DELETE SET NULL,

    message_type VARCHAR(30)
        NOT NULL DEFAULT 'MESSAGE'
        CHECK (
            message_type IN (
                'MESSAGE',
                'REMINDER',
                'WARNING'
            )
        ),

    content TEXT NOT NULL
        CHECK (LENGTH(BTRIM(content)) > 0),

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 21. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    notification_type VARCHAR(100),

    severity VARCHAR(20)
        NOT NULL DEFAULT 'INFO'
        CHECK (
            severity IN (
                'INFO',
                'SUCCESS',
                'WARNING',
                'ERROR'
            )
        ),

    related_type VARCHAR(100),
    related_id BIGINT,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    read_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 21. CALENDAR EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE CASCADE,

    internship_id BIGINT
        REFERENCES internships(id)
        ON DELETE CASCADE,

    semester_id BIGINT
        REFERENCES semesters(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    description TEXT,

    event_type VARCHAR(100),

    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,

    location TEXT,

    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 22. INTERNSHIP DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS internship_documents (
    id BIGSERIAL PRIMARY KEY,

    internship_id BIGINT NOT NULL
        REFERENCES internships(id)
        ON DELETE CASCADE,

    student_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    document_type VARCHAR(50) NOT NULL
        CHECK (
            document_type IN (
                'CV',
                'APPLICATION',
                'CONFIRMATION',
                'INTERNSHIP_PLAN',
                'OTHER'
            )
        ),

    title VARCHAR(255) NOT NULL,

    original_file_name VARCHAR(255) NOT NULL,

    mime_type VARCHAR(150) NOT NULL,

    file_size BIGINT NOT NULL
        CHECK (file_size >= 0),

    -- FILE THẬT ĐƯỢC LƯU TRONG POSTGRESQL
    file_data BYTEA NOT NULL,

    status VARCHAR(30)
        NOT NULL DEFAULT 'UPLOADED'
        CHECK (
            status IN (
                'UPLOADED',
                'UNDER_REVIEW',
                'APPROVED',
                'REJECTED'
            )
        ),

    uploaded_at TIMESTAMP
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP
        NOT NULL DEFAULT NOW(),

    UNIQUE (
        internship_id,
        document_type
    )
);


-- ============================================================
-- 23. APPLICATION DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS application_documents (
    id BIGSERIAL PRIMARY KEY,

    application_id BIGINT NOT NULL
        REFERENCES internship_applications(id)
        ON DELETE CASCADE,

    student_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    document_type VARCHAR(50) NOT NULL
        CHECK (
            document_type IN (
                'CV',
                'OFFER_LETTER',
                'JOB_DESCRIPTION',
                'OTHER'
            )
        ),

    title VARCHAR(255) NOT NULL,

    original_file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,

    file_size BIGINT NOT NULL
        CHECK (file_size >= 0),

    file_data BYTEA NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (
        application_id,
        document_type
    )
);


-- ============================================================
-- 24. NOTIFICATION PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    report_deadline BOOLEAN
        NOT NULL DEFAULT TRUE,

    lecturer_feedback BOOLEAN
        NOT NULL DEFAULT TRUE,

    internship_status BOOLEAN
        NOT NULL DEFAULT TRUE,

    email_notifications BOOLEAN
        NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP
        NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

CREATE INDEX IF NOT EXISTS idx_internships_student
ON internships(student_id);

CREATE INDEX IF NOT EXISTS idx_internships_lecturer
ON internships(lecturer_id);

CREATE INDEX IF NOT EXISTS idx_internships_status
ON internships(status);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_internship
ON weekly_reports(internship_id);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_status
ON weekly_reports(status);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_internship_status
ON weekly_reports(internship_id, status);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_due_at
ON weekly_reports(due_at);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_type
ON weekly_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_lecturer_student_messages_conversation
ON lecturer_student_messages(lecturer_id, student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lecturer_student_messages_student_unread
ON lecturer_student_messages(student_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_start
ON calendar_events(start_time);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start
ON calendar_events(user_id, start_time);

CREATE INDEX IF NOT EXISTS idx_deadlines_due_active
ON deadlines(due_at, is_active);

CREATE INDEX IF NOT EXISTS idx_internship_documents_internship
ON internship_documents(internship_id);

CREATE INDEX IF NOT EXISTS idx_internship_documents_student
ON internship_documents(student_id);

CREATE INDEX IF NOT EXISTS idx_application_documents_application
ON application_documents(application_id);

CREATE INDEX IF NOT EXISTS idx_application_documents_student
ON application_documents(student_id);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_data BYTEA;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_mime_type VARCHAR(100);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_file_name VARCHAR(255);
ALTER TABLE public.student_profiles
ADD COLUMN IF NOT EXISTS class_name VARCHAR(100);

UPDATE public.student_profiles
SET
    major = 'Computer Science',
    class_name = 'CS2026-A',
    updated_at = NOW()
WHERE student_code = '2A202601001';

UPDATE public.student_profiles
SET
    major = 'Computer Science',
    class_name = 'CS2026-B',
    updated_at = NOW()
WHERE student_code = '2A202601002';

UPDATE public.student_profiles
SET
    major = 'Data Science',
    class_name = 'DS2026-A',
    updated_at = NOW()
WHERE student_code = '2A202601003';
COMMIT;
