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
    8.5,
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
    9.2,
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
    8.5,
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
    8.0,
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
    9.3,
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
BEGIN;

DO $$
DECLARE
    student RECORD;
    target_user_id BIGINT;
BEGIN
    FOR student IN
        SELECT *
        FROM (
            VALUES
            ('2A202601101', 'pending.2a202601101@vinuni.edu.vn', 'Nguyễn Văn An', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.65, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-A'),
            ('2A202601102', 'pending.2a202601102@vinuni.edu.vn', 'Võ Minh Hà', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.82, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-A'),
            ('2A202601103', 'pending.2a202601103@vinuni.edu.vn', 'Lý Xuân Huy', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 2.99, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-A'),
            ('2A202601104', 'pending.2a202601104@vinuni.edu.vn', 'Vũ Phương My', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.16, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-A'),
            ('2A202601105', 'pending.2a202601105@vinuni.edu.vn', 'Dương Anh Phúc', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.33, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-A'),
            ('2A202601106', 'pending.2a202601106@vinuni.edu.vn', 'Phan Ngọc Thảo', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.50, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-A'),
            ('2A202601107', 'pending.2a202601107@vinuni.edu.vn', 'Ngô Hữu Tuấn', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.67, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-A'),
            ('2A202601108', 'pending.2a202601108@vinuni.edu.vn', 'Hoàng Diệu Nhung', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.84, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-A'),
            ('2A202601109', 'pending.2a202601109@vinuni.edu.vn', 'Hồ Minh Tùng', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.75, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-B'),
            ('2A202601110', 'pending.2a202601110@vinuni.edu.vn', 'Phạm Mai Giang', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.92, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-B'),
            ('2A202601111', 'pending.2a202601111@vinuni.edu.vn', 'Đỗ Thanh Hoàng', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.09, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-B'),
            ('2A202601112', 'pending.2a202601112@vinuni.edu.vn', 'Lê Bảo Mai', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.26, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-B'),
            ('2A202601113', 'pending.2a202601113@vinuni.edu.vn', 'Bùi Hoàng Phong', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.43, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-B'),
            ('2A202601114', 'pending.2a202601114@vinuni.edu.vn', 'Trần Minh Quỳnh', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.60, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-B'),
            ('2A202601115', 'pending.2a202601115@vinuni.edu.vn', 'Đặng Gia Trung', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.77, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-B'),
            ('2A202601116', 'pending.2a202601116@vinuni.edu.vn', 'Nguyễn Phương Chi', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 2.68, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-B'),
            ('2A202601117', 'pending.2a202601117@vinuni.edu.vn', 'Võ Quang Kiên', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.85, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-C'),
            ('2A202601118', 'pending.2a202601118@vinuni.edu.vn', 'Lý Ngọc Châu', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.02, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-C'),
            ('2A202601119', 'pending.2a202601119@vinuni.edu.vn', 'Vũ Công Hiếu', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.19, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-C'),
            ('2A202601120', 'pending.2a202601120@vinuni.edu.vn', 'Dương Diệu Linh', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.36, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-C'),
            ('2A202601121', 'pending.2a202601121@vinuni.edu.vn', 'Phan Nhật Nam', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.53, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-C'),
            ('2A202601122', 'pending.2a202601122@vinuni.edu.vn', 'Ngô Mai Phương', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.70, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-C'),
            ('2A202601123', 'pending.2a202601123@vinuni.edu.vn', 'Hoàng Tuấn Thắng', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.87, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-C'),
            ('2A202601124', 'pending.2a202601124@vinuni.edu.vn', 'Hồ Bảo Yến', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 2.78, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-C'),
            ('2A202601125', 'pending.2a202601125@vinuni.edu.vn', 'Phạm Đức Bách', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.95, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-A'),
            ('2A202601126', 'pending.2a202601126@vinuni.edu.vn', 'Đỗ Minh Anh', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.12, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-A'),
            ('2A202601127', 'pending.2a202601127@vinuni.edu.vn', 'Lê Văn Hải', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.29, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-A'),
            ('2A202601128', 'pending.2a202601128@vinuni.edu.vn', 'Bùi Phương Lan', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.46, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-A'),
            ('2A202601129', 'pending.2a202601129@vinuni.edu.vn', 'Trần Xuân Minh', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.63, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-A'),
            ('2A202601130', 'pending.2a202601130@vinuni.edu.vn', 'Đặng Ngọc Nhi', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.80, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-A'),
            ('2A202601131', 'pending.2a202601131@vinuni.edu.vn', 'Nguyễn Anh Thành', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 2.71, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-A'),
            ('2A202601132', 'pending.2a202601132@vinuni.edu.vn', 'Võ Diệu Vy', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 2.88, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-A'),
            ('2A202601133', 'pending.2a202601133@vinuni.edu.vn', 'Lý Hữu Đạt', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.05, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-B'),
            ('2A202601134', 'pending.2a202601134@vinuni.edu.vn', 'Vũ Mai Diệp', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.22, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-B'),
            ('2A202601135', 'pending.2a202601135@vinuni.edu.vn', 'Dương Minh Dũng', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.39, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-B'),
            ('2A202601136', 'pending.2a202601136@vinuni.edu.vn', 'Phan Bảo Hương', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.56, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-B'),
            ('2A202601137', 'pending.2a202601137@vinuni.edu.vn', 'Ngô Thanh Long', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.73, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-B'),
            ('2A202601138', 'pending.2a202601138@vinuni.edu.vn', 'Hoàng Minh Ngân', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.90, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-B'),
            ('2A202601139', 'pending.2a202601139@vinuni.edu.vn', 'Hồ Hoàng Sơn', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 2.81, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-B'),
            ('2A202601140', 'pending.2a202601140@vinuni.edu.vn', 'Phạm Phương Trinh', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 2.98, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-B'),
            ('2A202601141', 'pending.2a202601141@vinuni.edu.vn', 'Đỗ Gia Khang', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.15, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-C'),
            ('2A202601142', 'pending.2a202601142@vinuni.edu.vn', 'Lê Ngọc Thư', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.32, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-C'),
            ('2A202601143', 'pending.2a202601143@vinuni.edu.vn', 'Bùi Quang Bình', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.49, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-C'),
            ('2A202601144', 'pending.2a202601144@vinuni.edu.vn', 'Trần Diệu Hạnh', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.66, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-C'),
            ('2A202601145', 'pending.2a202601145@vinuni.edu.vn', 'Đặng Công Khánh', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.83, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-C'),
            ('2A202601146', 'pending.2a202601146@vinuni.edu.vn', 'Nguyễn Mai Nga', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 2.74, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-C'),
            ('2A202601147', 'pending.2a202601147@vinuni.edu.vn', 'Võ Nhật Quân', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 2.91, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-C'),
            ('2A202601148', 'pending.2a202601148@vinuni.edu.vn', 'Lý Bảo Trang', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.08, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-C'),
            ('2A202601149', 'pending.2a202601149@vinuni.edu.vn', 'Vũ Tuấn Việt', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.25, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-A'),
            ('2A202601150', 'pending.2a202601150@vinuni.edu.vn', 'Dương Minh Uyên', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.42, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-A'),
            ('2A202601151', 'pending.2a202601151@vinuni.edu.vn', 'Phan Đức An', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.59, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-A'),
            ('2A202601152', 'pending.2a202601152@vinuni.edu.vn', 'Ngô Phương Hà', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.76, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-A'),
            ('2A202601153', 'pending.2a202601153@vinuni.edu.vn', 'Hoàng Văn Huy', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 2.67, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-A'),
            ('2A202601154', 'pending.2a202601154@vinuni.edu.vn', 'Hồ Ngọc My', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 2.84, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-A'),
            ('2A202601155', 'pending.2a202601155@vinuni.edu.vn', 'Phạm Xuân Phúc', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.01, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-A'),
            ('2A202601156', 'pending.2a202601156@vinuni.edu.vn', 'Đỗ Diệu Thảo', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.18, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-A'),
            ('2A202601157', 'pending.2a202601157@vinuni.edu.vn', 'Lê Anh Tuấn', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.35, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-B'),
            ('2A202601158', 'pending.2a202601158@vinuni.edu.vn', 'Bùi Mai Nhung', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.52, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-B'),
            ('2A202601159', 'pending.2a202601159@vinuni.edu.vn', 'Trần Hữu Tùng', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.69, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-B'),
            ('2A202601160', 'pending.2a202601160@vinuni.edu.vn', 'Đặng Bảo Giang', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.86, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-B'),
            ('2A202601161', 'pending.2a202601161@vinuni.edu.vn', 'Nguyễn Minh Hoàng', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 2.77, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-B'),
            ('2A202601162', 'pending.2a202601162@vinuni.edu.vn', 'Võ Minh Mai', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 2.94, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-B'),
            ('2A202601163', 'pending.2a202601163@vinuni.edu.vn', 'Lý Thanh Phong', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.11, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-B'),
            ('2A202601164', 'pending.2a202601164@vinuni.edu.vn', 'Vũ Phương Quỳnh', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.28, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-B'),
            ('2A202601165', 'pending.2a202601165@vinuni.edu.vn', 'Dương Hoàng Trung', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.45, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-C'),
            ('2A202601166', 'pending.2a202601166@vinuni.edu.vn', 'Phan Ngọc Chi', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.62, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-C'),
            ('2A202601167', 'pending.2a202601167@vinuni.edu.vn', 'Ngô Gia Kiên', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.79, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-C'),
            ('2A202601168', 'pending.2a202601168@vinuni.edu.vn', 'Hoàng Diệu Châu', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 2.70, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-C'),
            ('2A202601169', 'pending.2a202601169@vinuni.edu.vn', 'Hồ Quang Hiếu', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 2.87, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-C'),
            ('2A202601170', 'pending.2a202601170@vinuni.edu.vn', 'Phạm Mai Linh', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.04, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-C'),
            ('2A202601171', 'pending.2a202601171@vinuni.edu.vn', 'Đỗ Công Nam', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.21, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-C'),
            ('2A202601172', 'pending.2a202601172@vinuni.edu.vn', 'Lê Bảo Phương', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.38, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-C'),
            ('2A202601173', 'pending.2a202601173@vinuni.edu.vn', 'Bùi Nhật Thắng', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.55, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-A'),
            ('2A202601174', 'pending.2a202601174@vinuni.edu.vn', 'Trần Minh Yến', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.72, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-A'),
            ('2A202601175', 'pending.2a202601175@vinuni.edu.vn', 'Đặng Tuấn Bách', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.89, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-A'),
            ('2A202601176', 'pending.2a202601176@vinuni.edu.vn', 'Nguyễn Phương Anh', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 2.80, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-A'),
            ('2A202601177', 'pending.2a202601177@vinuni.edu.vn', 'Võ Đức Hải', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 2.97, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-A'),
            ('2A202601178', 'pending.2a202601178@vinuni.edu.vn', 'Lý Ngọc Lan', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.14, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-A'),
            ('2A202601179', 'pending.2a202601179@vinuni.edu.vn', 'Vũ Văn Minh', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.31, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-A'),
            ('2A202601180', 'pending.2a202601180@vinuni.edu.vn', 'Dương Diệu Nhi', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.48, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-A'),
            ('2A202601181', 'pending.2a202601181@vinuni.edu.vn', 'Phan Xuân Thành', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.65, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-B'),
            ('2A202601182', 'pending.2a202601182@vinuni.edu.vn', 'Ngô Mai Vy', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.82, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-B'),
            ('2A202601183', 'pending.2a202601183@vinuni.edu.vn', 'Hoàng Anh Đạt', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 2.73, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-B'),
            ('2A202601184', 'pending.2a202601184@vinuni.edu.vn', 'Hồ Bảo Diệp', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 2.90, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-B'),
            ('2A202601185', 'pending.2a202601185@vinuni.edu.vn', 'Phạm Hữu Dũng', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.07, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-B'),
            ('2A202601186', 'pending.2a202601186@vinuni.edu.vn', 'Đỗ Minh Hương', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.24, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-B'),
            ('2A202601187', 'pending.2a202601187@vinuni.edu.vn', 'Lê Minh Long', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.41, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-B'),
            ('2A202601188', 'pending.2a202601188@vinuni.edu.vn', 'Bùi Phương Ngân', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.58, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-B'),
            ('2A202601189', 'pending.2a202601189@vinuni.edu.vn', 'Trần Thanh Sơn', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.75, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-C'),
            ('2A202601190', 'pending.2a202601190@vinuni.edu.vn', 'Đặng Ngọc Trinh', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.66, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-C'),
            ('2A202601191', 'pending.2a202601191@vinuni.edu.vn', 'Nguyễn Hoàng Khang', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 2.83, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-C'),
            ('2A202601192', 'pending.2a202601192@vinuni.edu.vn', 'Võ Diệu Thư', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.00, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-C'),
            ('2A202601193', 'pending.2a202601193@vinuni.edu.vn', 'Lý Gia Bình', 'MALE', 'College of Engineering and Computer Science', 'Electrical Engineering', '2026', 3.17, ARRAY['C++', 'Embedded Systems', 'MATLAB']::text[], 'EE2026-C'),
            ('2A202601194', 'pending.2a202601194@vinuni.edu.vn', 'Vũ Mai Hạnh', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.34, ARRAY['Communication', 'Marketing', 'Excel']::text[], 'BA2026-C'),
            ('2A202601195', 'pending.2a202601195@vinuni.edu.vn', 'Dương Quang Khánh', 'MALE', 'College of Business and Management', 'Business Administration', '2026', 3.51, ARRAY['Finance', 'Excel', 'Presentation']::text[], 'BA2026-C'),
            ('2A202601196', 'pending.2a202601196@vinuni.edu.vn', 'Phan Bảo Nga', 'FEMALE', 'College of Business and Management', 'Business Administration', '2026', 3.68, ARRAY['Project Management', 'Research', 'Communication']::text[], 'BA2026-C'),
            ('2A202601197', 'pending.2a202601197@vinuni.edu.vn', 'Ngô Công Quân', 'MALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 3.85, ARRAY['Python', 'FastAPI', 'PostgreSQL']::text[], 'CS2026-A'),
            ('2A202601198', 'pending.2a202601198@vinuni.edu.vn', 'Hoàng Minh Trang', 'FEMALE', 'College of Engineering and Computer Science', 'Computer Science', '2026', 2.76, ARRAY['React', 'Next.js', 'TypeScript']::text[], 'CS2026-A'),
            ('2A202601199', 'pending.2a202601199@vinuni.edu.vn', 'Hồ Nhật Việt', 'MALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 2.93, ARRAY['Python', 'Machine Learning', 'SQL']::text[], 'DS2026-A'),
            ('2A202601200', 'pending.2a202601200@vinuni.edu.vn', 'Phạm Phương Uyên', 'FEMALE', 'College of Engineering and Computer Science', 'Data Science', '2026', 3.10, ARRAY['Data Analysis', 'Pandas', 'Power BI']::text[], 'DS2026-A')
        ) AS seed_data(
            student_code,
            pending_email,
            full_name,
            gender,
            faculty,
            major,
            cohort,
            gpa,
            skills,
            class_name
        )
    LOOP
        -- ====================================================
        -- 1. KIỂM TRA USER ĐÃ CÓ CHƯA
        -- ====================================================

        SELECT id
        INTO target_user_id
        FROM public.users
        WHERE email = student.pending_email
        LIMIT 1;

        -- Nếu chưa có thì tạo user sinh viên
        IF target_user_id IS NULL THEN
            INSERT INTO public.users
            (
                email,
                password_hash,
                full_name,
                role,
                is_active,
                gender
            )
            VALUES
            (
                student.pending_email,
                NULL,
                student.full_name,
                'STUDENT',
                TRUE,
                student.gender
            )
            RETURNING id
            INTO target_user_id;
        END IF;


        -- ====================================================
        -- 2. CHỈ THÊM STUDENT_PROFILE NẾU MSSV CHƯA TỒN TẠI
        -- ====================================================

        IF NOT EXISTS (
            SELECT 1
            FROM public.student_profiles
            WHERE student_code = student.student_code
        ) THEN
            INSERT INTO public.student_profiles
            (
                student_id,
                student_code,
                faculty,
                major,
                cohort,
                gpa,
                skills,
                class_name
            )
            VALUES
            (
                target_user_id,
                student.student_code,
                student.faculty,
                student.major,
                student.cohort,
                student.gpa,
                student.skills,
                student.class_name
            );
        END IF;

        target_user_id := NULL;
    END LOOP;
END
$$;

COMMIT;
