BEGIN;


-- ============================================================
-- RESET DATA - DEVELOPMENT ONLY
-- ============================================================

TRUNCATE TABLE
    calendar_events,
    notifications,
    lecturer_student_messages,
    rag_index_jobs,
    knowledge_document_versions,
    knowledge_documents,
    ai_prompts,
    deadlines,
    checklist_items,
    report_comments,
    lecturer_student_notes,
    evaluations,
    weekly_reports,
    weekly_report_schedules,
    internships,
    internship_applications,
    company_mentors,
    companies,
    semesters,
    lecturer_profiles,
    student_profiles,
    users
RESTART IDENTITY CASCADE;


-- ============================================================
-- 1. USERS
-- ============================================================

INSERT INTO users (
    email,
    full_name,
    phone,
    role,
    is_active
)
VALUES
(
    'lecturer@vinuni.edu.vn',
    'Nguyễn Minh Anh',
    '0901000001',
    'LECTURER',
    TRUE
),
(
    'student01@vinuni.edu.vn',
    'Nguyễn Văn An',
    '0902000001',
    'STUDENT',
    TRUE
),
(
    'student02@vinuni.edu.vn',
    'Trần Minh Bình',
    '0902000002',
    'STUDENT',
    TRUE
),
(
    'student03@vinuni.edu.vn',
    'Lê Hoàng Nam',
    '0902000003',
    'STUDENT',
    TRUE
),
(
    'student04@vinuni.edu.vn',
    'Phạm Thu Hà',
    '0902000004',
    'STUDENT',
    TRUE
),
(
    'admin@vinuni.edu.vn',
    'Internova Admin',
    '0903000001',
    'ADMIN',
    TRUE
);


-- ID sau insert:
--
-- lecturer = 1
-- student1 = 2
-- student2 = 3
-- student3 = 4
-- student4 = 5
-- admin    = 6


-- ============================================================
-- 2. STUDENT PROFILES
-- ============================================================

INSERT INTO student_profiles (
    student_id,
    student_code,
    faculty,
    major,
    cohort,
    gpa,
    skills
)
VALUES
(
    2,
    '2A202601001',
    'College of Engineering and Computer Science',
    'Computer Science',
    '2026',
    3.65,
    ARRAY[
        'Python',
        'FastAPI',
        'PostgreSQL'
    ]
),
(
    3,
    '2A202601002',
    'College of Engineering and Computer Science',
    'Computer Science',
    '2026',
    3.42,
    ARRAY[
        'React',
        'Next.js',
        'TypeScript'
    ]
),
(
    4,
    '2A202601003',
    'College of Engineering and Computer Science',
    'Data Science',
    '2026',
    3.71,
    ARRAY[
        'Python',
        'Machine Learning',
        'SQL'
    ]
),
(
    5,
    '2A202601004',
    'College of Business and Management',
    'Business Administration',
    '2026',
    3.55,
    ARRAY[
        'Communication',
        'Marketing',
        'Excel'
    ]
);


-- ============================================================
-- 3. LECTURER PROFILES
-- ============================================================

INSERT INTO lecturer_profiles (
    lecturer_id,
    lecturer_code,
    academic_title,
    faculty,
    specialization
)
VALUES
(
    1,
    'GV001',
    'TS',
    'College of Engineering and Computer Science',
    'Artificial Intelligence and Software Engineering'
);


-- ============================================================
-- 4. SEMESTERS
-- ============================================================

INSERT INTO semesters (
    name,
    academic_year,
    semester_code,
    start_date,
    end_date,
    registration_start_date,
    registration_end_date,
    is_active
)
VALUES
(
    'Summer 2026',
    '2025-2026',
    'SUMMER-2026',
    '2026-06-01',
    '2026-08-31',
    '2026-05-01',
    '2026-05-20',
    TRUE
);


-- semester id = 1


-- ============================================================
-- 5. COMPANIES
-- ============================================================

INSERT INTO companies (
    name,
    industry,
    description,
    address,
    website,
    contact_name,
    contact_email,
    phone
)
VALUES
(
    'FPT Software',
    'Software',
    'Công ty phát triển phần mềm.',
    'Hà Nội',
    'https://fptsoftware.com',
    'Nguyễn HR',
    'hr@fpt.example',
    '0240000001'
),
(
    'Viettel Digital',
    'Technology',
    'Công ty công nghệ và dịch vụ số.',
    'Hà Nội',
    'https://viettel.example',
    'Trần HR',
    'hr@viettel.example',
    '0240000002'
),
(
    'TechNova',
    'Artificial Intelligence',
    'Công ty AI thử nghiệm dành cho Internova.',
    'Hà Nội',
    'https://technova.example',
    'Lê HR',
    'hr@technova.example',
    '0240000003'
);


-- ============================================================
-- 6. COMPANY MENTORS
-- ============================================================

INSERT INTO company_mentors (
    company_id,
    full_name,
    email,
    phone,
    position,
    department
)
VALUES
(
    1,
    'Nguyễn Đức Long',
    'long@fpt.example',
    '0904000001',
    'Senior Software Engineer',
    'Backend'
),
(
    2,
    'Trần Quang Huy',
    'huy@viettel.example',
    '0904000002',
    'Technical Lead',
    'Digital Platform'
),
(
    3,
    'Phạm Minh Đức',
    'duc@technova.example',
    '0904000003',
    'AI Engineer',
    'Artificial Intelligence'
);


-- ============================================================
-- 7. INTERNSHIP APPLICATIONS
-- ============================================================

INSERT INTO internship_applications (
    student_id,
    semester_id,
    company_id,
    company_mentor_id,
    assigned_lecturer_id,
    position_title,
    internship_type,
    description,
    expected_start_date,
    expected_end_date,
    status,
    submitted_at,
    reviewed_at
)
VALUES
(
    2,
    1,
    1,
    1,
    1,
    'Backend Intern',
    'FULL_TIME',
    'Backend internship using Python and FastAPI.',
    '2026-06-01',
    '2026-08-31',
    'APPROVED',
    '2026-05-10 09:00:00',
    '2026-05-12 10:00:00'
),
(
    3,
    1,
    2,
    2,
    1,
    'Frontend Intern',
    'FULL_TIME',
    'Frontend internship using React and Next.js.',
    '2026-06-01',
    '2026-08-31',
    'APPROVED',
    '2026-05-11 09:00:00',
    '2026-05-13 10:00:00'
),
(
    4,
    1,
    3,
    3,
    1,
    'AI Intern',
    'FULL_TIME',
    'AI internship.',
    '2026-06-01',
    '2026-08-31',
    'APPROVED',
    '2026-05-12 09:00:00',
    '2026-05-14 10:00:00'
),
(
    5,
    1,
    1,
    1,
    1,
    'Business Analyst Intern',
    'FULL_TIME',
    'Business internship.',
    '2026-06-01',
    '2026-08-31',
    'UNDER_REVIEW',
    '2026-05-15 09:00:00',
    NULL
);


-- ============================================================
-- 8. INTERNSHIPS
-- ============================================================

INSERT INTO internships (
    student_id,
    lecturer_id,
    semester_id,
    company_id,
    company_mentor_id,
    application_id,
    position_title,
    description,
    start_date,
    end_date,
    required_hours,
    completed_hours,
    progress_percentage,
    status
)
VALUES
(
    2,
    1,
    1,
    1,
    1,
    1,
    'Backend Intern',
    'Backend development internship.',
    '2026-06-01',
    '2026-08-31',
    240,
    170,
    71,
    'IN_PROGRESS'
),
(
    3,
    1,
    1,
    2,
    2,
    2,
    'Frontend Intern',
    'Frontend development internship.',
    '2026-06-01',
    '2026-08-31',
    240,
    145,
    60,
    'IN_PROGRESS'
),
(
    4,
    1,
    1,
    3,
    3,
    3,
    'AI Intern',
    'AI development internship.',
    '2026-06-01',
    '2026-08-31',
    240,
    240,
    100,
    'COMPLETED'
);


-- ============================================================
-- 9. WEEKLY REPORT SCHEDULES
-- ============================================================

INSERT INTO weekly_report_schedules (
    semester_id,
    week_number,
    title,
    description,
    start_date,
    due_at
)
VALUES
(
    1,
    1,
    'Báo cáo tuần 1',
    'Báo cáo hoạt động tuần đầu tiên.',
    '2026-06-01',
    '2026-06-07 23:59:59'
),
(
    1,
    2,
    'Báo cáo tuần 2',
    'Báo cáo hoạt động tuần 2.',
    '2026-06-08',
    '2026-06-14 23:59:59'
),
(
    1,
    3,
    'Báo cáo tuần 3',
    'Báo cáo hoạt động tuần 3.',
    '2026-06-15',
    '2026-06-21 23:59:59'
);


-- ============================================================
-- 10. WEEKLY REPORTS
-- ============================================================

INSERT INTO weekly_reports (
    internship_id,
    schedule_id,
    week_number,
    title,
    content,
    status,
    lecturer_feedback,
    lecturer_score,
    due_at,
    submitted_at,
    reviewed_at
)
VALUES
(
    1,
    1,
    1,
    'Báo cáo tuần 1 - Nguyễn Văn An',
    'Đã setup môi trường backend và tìm hiểu dự án.',
    'APPROVED',
    'Hoàn thành tốt.',
    85,
    '2026-06-07 23:59:59',
    '2026-06-07 20:00:00',
    '2026-06-08 09:00:00'
),
(
    1,
    2,
    2,
    'Báo cáo tuần 2 - Nguyễn Văn An',
    'Phát triển API và PostgreSQL.',
    'SUBMITTED',
    NULL,
    NULL,
    '2026-06-14 23:59:59',
    '2026-06-14 21:00:00',
    NULL
),
(
    2,
    1,
    1,
    'Báo cáo tuần 1 - Trần Minh Bình',
    'Xây dựng giao diện dashboard.',
    'UNDER_REVIEW',
    NULL,
    NULL,
    '2026-06-07 23:59:59',
    '2026-06-07 22:00:00',
    NULL
),
(
    3,
    1,
    1,
    'Báo cáo tuần 1 - Lê Hoàng Nam',
    'Tìm hiểu RAG pipeline.',
    'APPROVED',
    'Tốt.',
    92,
    '2026-06-07 23:59:59',
    '2026-06-06 21:00:00',
    '2026-06-08 10:00:00'
);


-- ============================================================
-- 11. EVALUATIONS
-- ============================================================

INSERT INTO evaluations (
    internship_id,
    evaluator_id,
    evaluator_type,
    evaluation_type,
    total_score,
    feedback,
    strengths,
    improvements,
    status,
    submitted_at
)
VALUES
(
    1,
    1,
    'LECTURER',
    'MIDTERM',
    85,
    'Sinh viên có tiến bộ tốt.',
    'Chủ động và kỹ thuật tốt.',
    'Cải thiện tài liệu hóa.',
    'CONFIRMED',
    '2026-07-01 09:00:00'
),
(
    2,
    1,
    'LECTURER',
    'MIDTERM',
    80,
    'Hoàn thành công việc đúng hạn.',
    'UI tốt.',
    'Cần cải thiện testing.',
    'CONFIRMED',
    '2026-07-01 09:10:00'
),
(
    3,
    1,
    'LECTURER',
    'FINAL',
    93,
    'Hoàn thành xuất sắc.',
    'Khả năng nghiên cứu tốt.',
    'Tiếp tục nâng cao kỹ năng triển khai.',
    'CONFIRMED',
    '2026-08-01 09:00:00'
);


-- ============================================================
-- 12. LECTURER STUDENT NOTES
-- ============================================================

INSERT INTO lecturer_student_notes (
    lecturer_id,
    student_id,
    internship_id,
    note,
    is_private
)
VALUES
(
    1,
    2,
    1,
    'Sinh viên cần bổ sung phần testing cho API.',
    TRUE
),
(
    1,
    3,
    2,
    'Theo dõi thêm tiến độ frontend trong tuần tới.',
    TRUE
),
(
    1,
    4,
    3,
    'Sinh viên có khả năng nghiên cứu AI tốt.',
    TRUE
);


-- ============================================================
-- 13. REPORT COMMENTS
-- ============================================================

INSERT INTO report_comments (
    report_id,
    user_id,
    comment
)
VALUES
(
    1,
    1,
    'Báo cáo rõ ràng, bổ sung thêm kết quả thực tế.'
),
(
    2,
    1,
    'Cần mô tả chi tiết hơn API đã triển khai.'
);


-- ============================================================
-- 14. CHECKLIST ITEMS
-- ============================================================

INSERT INTO checklist_items (
    internship_id,
    title,
    description,
    category,
    status,
    due_at,
    completed_at
)
VALUES
(
    1,
    'Cập nhật CV',
    'Cập nhật CV trước kỳ thực tập.',
    'PREPARATION',
    'COMPLETED',
    '2026-05-20 23:59:59',
    '2026-05-18 10:00:00'
),
(
    1,
    'Nộp xác nhận thực tập',
    'Nộp xác nhận từ doanh nghiệp.',
    'DOCUMENT',
    'COMPLETED',
    '2026-06-05 23:59:59',
    '2026-06-03 09:00:00'
),
(
    2,
    'Hoàn thành kế hoạch thực tập',
    'Gửi kế hoạch cho giảng viên.',
    'PLAN',
    'IN_PROGRESS',
    '2026-08-15 23:59:59',
    NULL
);


-- ============================================================
-- 15. DEADLINES
-- ============================================================

INSERT INTO deadlines (
    semester_id,
    title,
    description,
    deadline_type,
    target_role,
    due_at,
    is_active
)
VALUES
(
    1,
    'Chấm báo cáo tuần',
    'Giảng viên hoàn thành review báo cáo sinh viên.',
    'REPORT_REVIEW',
    'LECTURER',
    '2026-08-15 23:59:59',
    TRUE
),
(
    1,
    'Đánh giá cuối kỳ',
    'Hoàn thành đánh giá cuối kỳ.',
    'FINAL_EVALUATION',
    'LECTURER',
    '2026-08-25 23:59:59',
    TRUE
),
(
    1,
    'Nộp báo cáo cuối kỳ',
    'Sinh viên nộp báo cáo cuối kỳ.',
    'FINAL_REPORT',
    'STUDENT',
    '2026-08-20 23:59:59',
    TRUE
);


-- ============================================================
-- 16. AI PROMPTS
-- ============================================================

INSERT INTO ai_prompts (
    name,
    feature,
    system_prompt,
    user_prompt_template,
    version,
    is_active,
    created_by
)
VALUES
(
    'Internova RAG Assistant',
    'RAG_CHATBOT',
    'Bạn là trợ lý AI hỗ trợ sinh viên về thực tập.',
    'Câu hỏi của sinh viên: {query}',
    '1.0',
    TRUE,
    6
),
(
    'Report Reviewer',
    'REPORT_REVIEW',
    'Bạn là AI hỗ trợ review báo cáo thực tập.',
    'Hãy review báo cáo: {report}',
    '1.0',
    TRUE,
    6
);


-- ============================================================
-- 17. KNOWLEDGE DOCUMENTS
-- ============================================================

INSERT INTO knowledge_documents (
    title,
    document_type,
    description,
    file_url,
    current_version,
    year,
    status,
    uploaded_by
)
VALUES
(
    'Internship Management Policy',
    'PDF',
    'Quy chế quản lý thực tập.',
    '/documents/internship-policy.pdf',
    '2.0',
    2025,
    'ACTIVE',
    6
),
(
    'Capstone Booklet',
    'PDF',
    'Tài liệu hướng dẫn Capstone.',
    '/documents/capstone-booklet.pdf',
    '1.0',
    2026,
    'ACTIVE',
    6
);


-- ============================================================
-- 18. KNOWLEDGE DOCUMENT VERSIONS
-- ============================================================

INSERT INTO knowledge_document_versions (
    document_id,
    version,
    file_url,
    file_hash,
    extracted_text_path,
    chunk_path,
    effective_date,
    status
)
VALUES
(
    1,
    '2.0',
    '/documents/internship-policy.pdf',
    'dev-policy-hash',
    'data/rag/policy.txt',
    'data/rag/policy_chunks.jsonl',
    '2025-10-15',
    'ACTIVE'
),
(
    2,
    '1.0',
    '/documents/capstone-booklet.pdf',
    'dev-capstone-hash',
    'data/rag/capstone.txt',
    'data/rag/capstone_chunks.jsonl',
    '2026-01-01',
    'ACTIVE'
);


-- ============================================================
-- 19. RAG INDEX JOBS
-- ============================================================

INSERT INTO rag_index_jobs (
    document_version_id,
    job_type,
    status,
    chunks_created,
    started_at,
    completed_at
)
VALUES
(
    1,
    'FULL_INDEX',
    'COMPLETED',
    150,
    '2026-08-01 08:00:00',
    '2026-08-01 08:05:00'
),
(
    2,
    'FULL_INDEX',
    'COMPLETED',
    90,
    '2026-08-01 08:10:00',
    '2026-08-01 08:13:00'
);


-- ============================================================
-- 20. NOTIFICATIONS
-- ============================================================

INSERT INTO notifications (
    user_id,
    title,
    message,
    notification_type,
    severity,
    related_type,
    related_id,
    is_read
)
VALUES
(
    1,
    'Báo cáo mới',
    'Nguyễn Văn An vừa nộp báo cáo tuần.',
    'REPORT',
    'INFO',
    'WEEKLY_REPORT',
    2,
    FALSE
),
(
    1,
    'Báo cáo cần xử lý',
    'Một báo cáo đang chờ giảng viên review.',
    'REPORT_WARNING',
    'WARNING',
    'WEEKLY_REPORT',
    3,
    FALSE
),
(
    2,
    'Sắp đến hạn báo cáo',
    'Bạn sắp đến hạn nộp báo cáo.',
    'DEADLINE',
    'WARNING',
    'DEADLINE',
    3,
    FALSE
);


-- ============================================================
-- 21. CALENDAR EVENTS
-- ============================================================

INSERT INTO calendar_events (
    user_id,
    internship_id,
    semester_id,
    title,
    description,
    event_type,
    start_time,
    end_time,
    location,
    is_all_day
)
VALUES
(
    1,
    1,
    1,
    'Review báo cáo Nguyễn Văn An',
    '[student_id:2] Review báo cáo tuần của sinh viên.',
    'STUDENT_REMINDER',
    '2026-08-12 09:00:00',
    '2026-08-12 10:00:00',
    'Online',
    FALSE
),
(
    1,
    2,
    1,
    'Trao đổi với Trần Minh Bình',
    '[student_id:3] Họp cập nhật tiến độ thực tập.',
    'STUDENT_REMINDER',
    '2026-08-14 14:00:00',
    '2026-08-14 15:00:00',
    'Room 201',
    FALSE
),
(
    2,
    1,
    1,
    'Deadline báo cáo',
    'Nộp báo cáo thực tập.',
    'REPORT_DEADLINE',
    '2026-08-20 23:59:59',
    NULL,
    NULL,
    FALSE
);

UPDATE users
SET password_hash = '$argon2id$v=19$m=65536,t=3,p=4$3bmYcO9/GBvG4L1eu/DjdQ$zT4q35+gFus4SxvTs5zaY1wbuMQI9AiSX0xMvrhOcD4'
WHERE email IN (
    'lecturer@vinuni.edu.vn',
    'student01@vinuni.edu.vn',
    'student02@vinuni.edu.vn',
    'student03@vinuni.edu.vn',
    'student04@vinuni.edu.vn',
    'admin@vinuni.edu.vn'
);


INSERT INTO public.semesters (
    name,
    semester_code,
    academic_year,
    start_date,
    end_date,
    is_active
)
VALUES
(
    'Spring 2026',
    'SP26',
    '2025-2026',
    DATE '2026-01-12',
    DATE '2026-04-20',
    FALSE
),
(
    'Summer 2026',
    'SU26',
    '2025-2026',
    DATE '2026-05-20',
    DATE '2026-08-10',
    FALSE
),
(
    'Fall 2026',
    'FA26',
    '2026-2027',
    DATE '2026-08-15',
    DATE '2026-11-15',
    TRUE
),
(
    'Spring 2027',
    'SP27',
    '2026-2027',
    DATE '2027-01-10',
    DATE '2027-04-15',
    TRUE
);



COMMIT;
