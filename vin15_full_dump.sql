--
-- PostgreSQL database dump
--

\restrict 5e4BnQM5r5IJK04URPzBoU1CWYUDNQFZOt9AduNGdM5ek1dQZ0vYP9Hz1pmPsqO

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.weekly_reports DROP CONSTRAINT IF EXISTS weekly_reports_schedule_id_fkey;
ALTER TABLE IF EXISTS ONLY public.weekly_reports DROP CONSTRAINT IF EXISTS weekly_reports_internship_id_fkey;
ALTER TABLE IF EXISTS ONLY public.weekly_report_schedules DROP CONSTRAINT IF EXISTS weekly_report_schedules_semester_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_profiles DROP CONSTRAINT IF EXISTS student_profiles_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.report_comments DROP CONSTRAINT IF EXISTS report_comments_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.report_comments DROP CONSTRAINT IF EXISTS report_comments_report_id_fkey;
ALTER TABLE IF EXISTS ONLY public.report_comments DROP CONSTRAINT IF EXISTS report_comments_parent_comment_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rag_index_jobs DROP CONSTRAINT IF EXISTS rag_index_jobs_document_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_notes DROP CONSTRAINT IF EXISTS lecturer_student_notes_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_notes DROP CONSTRAINT IF EXISTS lecturer_student_notes_lecturer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_notes DROP CONSTRAINT IF EXISTS lecturer_student_notes_internship_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_messages DROP CONSTRAINT IF EXISTS lecturer_student_messages_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_messages DROP CONSTRAINT IF EXISTS lecturer_student_messages_lecturer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_messages DROP CONSTRAINT IF EXISTS lecturer_student_messages_internship_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_profiles DROP CONSTRAINT IF EXISTS lecturer_profiles_lecturer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.knowledge_documents DROP CONSTRAINT IF EXISTS knowledge_documents_uploaded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.knowledge_document_versions DROP CONSTRAINT IF EXISTS knowledge_document_versions_document_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_semester_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_lecturer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_company_mentor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_application_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internship_documents DROP CONSTRAINT IF EXISTS internship_documents_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internship_documents DROP CONSTRAINT IF EXISTS internship_documents_internship_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internship_applications DROP CONSTRAINT IF EXISTS internship_applications_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internship_applications DROP CONSTRAINT IF EXISTS internship_applications_semester_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internship_applications DROP CONSTRAINT IF EXISTS internship_applications_company_mentor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internship_applications DROP CONSTRAINT IF EXISTS internship_applications_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internship_applications DROP CONSTRAINT IF EXISTS internship_applications_assigned_lecturer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluations DROP CONSTRAINT IF EXISTS evaluations_internship_id_fkey;
ALTER TABLE IF EXISTS ONLY public.evaluations DROP CONSTRAINT IF EXISTS evaluations_evaluator_id_fkey;
ALTER TABLE IF EXISTS ONLY public.deadlines DROP CONSTRAINT IF EXISTS deadlines_semester_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_mentors DROP CONSTRAINT IF EXISTS company_mentors_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_internship_id_fkey;
ALTER TABLE IF EXISTS ONLY public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_semester_id_fkey;
ALTER TABLE IF EXISTS ONLY public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_internship_id_fkey;
ALTER TABLE IF EXISTS ONLY public.application_documents DROP CONSTRAINT IF EXISTS application_documents_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.application_documents DROP CONSTRAINT IF EXISTS application_documents_application_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ai_prompts DROP CONSTRAINT IF EXISTS ai_prompts_created_by_fkey;
DROP INDEX IF EXISTS public.idx_weekly_reports_unique_week;
DROP INDEX IF EXISTS public.idx_weekly_reports_type;
DROP INDEX IF EXISTS public.idx_weekly_reports_status;
DROP INDEX IF EXISTS public.idx_weekly_reports_internship_status;
DROP INDEX IF EXISTS public.idx_weekly_reports_internship;
DROP INDEX IF EXISTS public.idx_weekly_reports_due_at;
DROP INDEX IF EXISTS public.idx_users_role;
DROP INDEX IF EXISTS public.idx_reports_unique_special_type;
DROP INDEX IF EXISTS public.idx_notifications_user_read;
DROP INDEX IF EXISTS public.idx_notifications_user_created;
DROP INDEX IF EXISTS public.idx_notifications_user;
DROP INDEX IF EXISTS public.idx_lecturer_student_messages_student_unread;
DROP INDEX IF EXISTS public.idx_lecturer_student_messages_conversation;
DROP INDEX IF EXISTS public.idx_internships_student;
DROP INDEX IF EXISTS public.idx_internships_status;
DROP INDEX IF EXISTS public.idx_internships_lecturer;
DROP INDEX IF EXISTS public.idx_internship_documents_student;
DROP INDEX IF EXISTS public.idx_internship_documents_internship;
DROP INDEX IF EXISTS public.idx_deadlines_due_active;
DROP INDEX IF EXISTS public.idx_calendar_start;
DROP INDEX IF EXISTS public.idx_calendar_events_user_start;
DROP INDEX IF EXISTS public.idx_application_documents_student;
DROP INDEX IF EXISTS public.idx_application_documents_application;
ALTER TABLE IF EXISTS ONLY public.weekly_reports DROP CONSTRAINT IF EXISTS weekly_reports_pkey;
ALTER TABLE IF EXISTS ONLY public.weekly_report_schedules DROP CONSTRAINT IF EXISTS weekly_report_schedules_semester_id_week_number_key;
ALTER TABLE IF EXISTS ONLY public.weekly_report_schedules DROP CONSTRAINT IF EXISTS weekly_report_schedules_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.student_profiles DROP CONSTRAINT IF EXISTS student_profiles_student_id_key;
ALTER TABLE IF EXISTS ONLY public.student_profiles DROP CONSTRAINT IF EXISTS student_profiles_student_code_key;
ALTER TABLE IF EXISTS ONLY public.student_profiles DROP CONSTRAINT IF EXISTS student_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.semesters DROP CONSTRAINT IF EXISTS semesters_semester_code_key;
ALTER TABLE IF EXISTS ONLY public.semesters DROP CONSTRAINT IF EXISTS semesters_pkey;
ALTER TABLE IF EXISTS ONLY public.report_comments DROP CONSTRAINT IF EXISTS report_comments_pkey;
ALTER TABLE IF EXISTS ONLY public.rag_index_jobs DROP CONSTRAINT IF EXISTS rag_index_jobs_pkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_key;
ALTER TABLE IF EXISTS ONLY public.notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_pkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_notes DROP CONSTRAINT IF EXISTS lecturer_student_notes_pkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_student_messages DROP CONSTRAINT IF EXISTS lecturer_student_messages_pkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_profiles DROP CONSTRAINT IF EXISTS lecturer_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.lecturer_profiles DROP CONSTRAINT IF EXISTS lecturer_profiles_lecturer_id_key;
ALTER TABLE IF EXISTS ONLY public.lecturer_profiles DROP CONSTRAINT IF EXISTS lecturer_profiles_lecturer_code_key;
ALTER TABLE IF EXISTS ONLY public.knowledge_documents DROP CONSTRAINT IF EXISTS knowledge_documents_pkey;
ALTER TABLE IF EXISTS ONLY public.knowledge_document_versions DROP CONSTRAINT IF EXISTS knowledge_document_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.knowledge_document_versions DROP CONSTRAINT IF EXISTS knowledge_document_versions_document_id_version_key;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_pkey;
ALTER TABLE IF EXISTS ONLY public.internships DROP CONSTRAINT IF EXISTS internships_application_id_key;
ALTER TABLE IF EXISTS ONLY public.internship_documents DROP CONSTRAINT IF EXISTS internship_documents_pkey;
ALTER TABLE IF EXISTS ONLY public.internship_documents DROP CONSTRAINT IF EXISTS internship_documents_internship_id_document_type_key;
ALTER TABLE IF EXISTS ONLY public.internship_applications DROP CONSTRAINT IF EXISTS internship_applications_pkey;
ALTER TABLE IF EXISTS ONLY public.evaluations DROP CONSTRAINT IF EXISTS evaluations_pkey;
ALTER TABLE IF EXISTS ONLY public.deadlines DROP CONSTRAINT IF EXISTS deadlines_pkey;
ALTER TABLE IF EXISTS ONLY public.company_mentors DROP CONSTRAINT IF EXISTS company_mentors_pkey;
ALTER TABLE IF EXISTS ONLY public.companies DROP CONSTRAINT IF EXISTS companies_pkey;
ALTER TABLE IF EXISTS ONLY public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_pkey;
ALTER TABLE IF EXISTS ONLY public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_pkey;
ALTER TABLE IF EXISTS ONLY public.application_documents DROP CONSTRAINT IF EXISTS application_documents_pkey;
ALTER TABLE IF EXISTS ONLY public.application_documents DROP CONSTRAINT IF EXISTS application_documents_application_id_document_type_key;
ALTER TABLE IF EXISTS ONLY public.ai_prompts DROP CONSTRAINT IF EXISTS ai_prompts_pkey;
ALTER TABLE IF EXISTS public.weekly_reports ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.weekly_report_schedules ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.student_profiles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.semesters ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.report_comments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rag_index_jobs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notification_preferences ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.lecturer_student_notes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.lecturer_student_messages ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.lecturer_profiles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.knowledge_documents ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.knowledge_document_versions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.internships ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.internship_documents ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.internship_applications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.evaluations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.deadlines ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.company_mentors ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.companies ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.checklist_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.calendar_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.application_documents ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.ai_prompts ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.weekly_reports_id_seq;
DROP TABLE IF EXISTS public.weekly_reports;
DROP SEQUENCE IF EXISTS public.weekly_report_schedules_id_seq;
DROP TABLE IF EXISTS public.weekly_report_schedules;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.student_profiles_id_seq;
DROP TABLE IF EXISTS public.student_profiles;
DROP SEQUENCE IF EXISTS public.semesters_id_seq;
DROP TABLE IF EXISTS public.semesters;
DROP SEQUENCE IF EXISTS public.report_comments_id_seq;
DROP TABLE IF EXISTS public.report_comments;
DROP SEQUENCE IF EXISTS public.rag_index_jobs_id_seq;
DROP TABLE IF EXISTS public.rag_index_jobs;
DROP SEQUENCE IF EXISTS public.notifications_id_seq;
DROP TABLE IF EXISTS public.notifications;
DROP SEQUENCE IF EXISTS public.notification_preferences_id_seq;
DROP TABLE IF EXISTS public.notification_preferences;
DROP SEQUENCE IF EXISTS public.lecturer_student_notes_id_seq;
DROP TABLE IF EXISTS public.lecturer_student_notes;
DROP SEQUENCE IF EXISTS public.lecturer_student_messages_id_seq;
DROP TABLE IF EXISTS public.lecturer_student_messages;
DROP SEQUENCE IF EXISTS public.lecturer_profiles_id_seq;
DROP TABLE IF EXISTS public.lecturer_profiles;
DROP SEQUENCE IF EXISTS public.knowledge_documents_id_seq;
DROP TABLE IF EXISTS public.knowledge_documents;
DROP SEQUENCE IF EXISTS public.knowledge_document_versions_id_seq;
DROP TABLE IF EXISTS public.knowledge_document_versions;
DROP SEQUENCE IF EXISTS public.internships_id_seq;
DROP TABLE IF EXISTS public.internships;
DROP SEQUENCE IF EXISTS public.internship_documents_id_seq;
DROP TABLE IF EXISTS public.internship_documents;
DROP SEQUENCE IF EXISTS public.internship_applications_id_seq;
DROP TABLE IF EXISTS public.internship_applications;
DROP SEQUENCE IF EXISTS public.evaluations_id_seq;
DROP TABLE IF EXISTS public.evaluations;
DROP SEQUENCE IF EXISTS public.deadlines_id_seq;
DROP TABLE IF EXISTS public.deadlines;
DROP SEQUENCE IF EXISTS public.company_mentors_id_seq;
DROP TABLE IF EXISTS public.company_mentors;
DROP SEQUENCE IF EXISTS public.companies_id_seq;
DROP TABLE IF EXISTS public.companies;
DROP SEQUENCE IF EXISTS public.checklist_items_id_seq;
DROP TABLE IF EXISTS public.checklist_items;
DROP SEQUENCE IF EXISTS public.calendar_events_id_seq;
DROP TABLE IF EXISTS public.calendar_events;
DROP SEQUENCE IF EXISTS public.application_documents_id_seq;
DROP TABLE IF EXISTS public.application_documents;
DROP SEQUENCE IF EXISTS public.ai_prompts_id_seq;
DROP TABLE IF EXISTS public.ai_prompts;
DROP EXTENSION IF EXISTS citext;
--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompts (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    feature character varying(100) NOT NULL,
    system_prompt text,
    user_prompt_template text,
    version character varying(30),
    is_active boolean DEFAULT true NOT NULL,
    created_by bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_prompts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_prompts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_prompts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_prompts_id_seq OWNED BY public.ai_prompts.id;


--
-- Name: application_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_documents (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    student_id bigint NOT NULL,
    document_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    original_file_name character varying(255) NOT NULL,
    mime_type character varying(150) NOT NULL,
    file_size bigint NOT NULL,
    file_data bytea NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT application_documents_document_type_check CHECK (((document_type)::text = ANY ((ARRAY['CV'::character varying, 'OFFER_LETTER'::character varying, 'JOB_DESCRIPTION'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT application_documents_file_size_check CHECK ((file_size >= 0))
);


--
-- Name: application_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.application_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: application_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.application_documents_id_seq OWNED BY public.application_documents.id;


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id bigint NOT NULL,
    user_id bigint,
    internship_id bigint,
    semester_id bigint,
    title character varying(255) NOT NULL,
    description text,
    event_type character varying(100),
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    location text,
    is_all_day boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- Name: checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_items (
    id bigint NOT NULL,
    internship_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    due_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    priority character varying(20) DEFAULT 'MEDIUM'::character varying NOT NULL,
    CONSTRAINT checklist_items_priority_check CHECK (((priority)::text = ANY ((ARRAY['HIGH'::character varying, 'MEDIUM'::character varying, 'LOW'::character varying])::text[]))),
    CONSTRAINT checklist_items_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying])::text[])))
);


--
-- Name: checklist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checklist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_items_id_seq OWNED BY public.checklist_items.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    industry character varying(150),
    description text,
    address text,
    website text,
    contact_name character varying(150),
    contact_email public.citext,
    phone character varying(30),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: company_mentors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_mentors (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    full_name character varying(150) NOT NULL,
    email public.citext,
    phone character varying(30),
    "position" character varying(150),
    department character varying(150),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: company_mentors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.company_mentors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: company_mentors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.company_mentors_id_seq OWNED BY public.company_mentors.id;


--
-- Name: deadlines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deadlines (
    id bigint NOT NULL,
    semester_id bigint,
    title character varying(255) NOT NULL,
    description text,
    deadline_type character varying(100) NOT NULL,
    target_role character varying(30),
    due_at timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT deadlines_target_role_check CHECK (((target_role IS NULL) OR ((target_role)::text = ANY ((ARRAY['STUDENT'::character varying, 'LECTURER'::character varying, 'ADMIN'::character varying, 'ALL'::character varying])::text[]))))
);


--
-- Name: deadlines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deadlines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deadlines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deadlines_id_seq OWNED BY public.deadlines.id;


--
-- Name: evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluations (
    id bigint NOT NULL,
    internship_id bigint NOT NULL,
    evaluator_id bigint,
    evaluator_type character varying(30) NOT NULL,
    evaluation_type character varying(50),
    total_score numeric(5,2),
    feedback text,
    strengths text,
    improvements text,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    submitted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT evaluations_evaluator_type_check CHECK (((evaluator_type)::text = ANY ((ARRAY['LECTURER'::character varying, 'COMPANY_MENTOR'::character varying, 'STUDENT'::character varying, 'ADMIN'::character varying])::text[]))),
    CONSTRAINT evaluations_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'CONFIRMED'::character varying])::text[])))
);


--
-- Name: evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluations_id_seq OWNED BY public.evaluations.id;


--
-- Name: internship_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internship_applications (
    id bigint NOT NULL,
    student_id bigint NOT NULL,
    semester_id bigint,
    company_id bigint,
    company_mentor_id bigint,
    assigned_lecturer_id bigint,
    position_title character varying(200),
    internship_type character varying(50),
    description text,
    expected_start_date date,
    expected_end_date date,
    cv_url text,
    application_file_url text,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    lecturer_comment text,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    work_mode character varying(20),
    credits integer,
    CONSTRAINT internship_applications_credits_check CHECK (((credits IS NULL) OR (credits > 0))),
    CONSTRAINT internship_applications_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'UNDER_REVIEW'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT internship_applications_work_mode_check CHECK (((work_mode IS NULL) OR ((work_mode)::text = ANY ((ARRAY['ONSITE'::character varying, 'REMOTE'::character varying, 'HYBRID'::character varying])::text[]))))
);


--
-- Name: internship_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.internship_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: internship_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.internship_applications_id_seq OWNED BY public.internship_applications.id;


--
-- Name: internship_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internship_documents (
    id bigint NOT NULL,
    internship_id bigint NOT NULL,
    student_id bigint NOT NULL,
    document_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    original_file_name character varying(255) NOT NULL,
    mime_type character varying(150) NOT NULL,
    file_size bigint NOT NULL,
    file_data bytea NOT NULL,
    status character varying(30) DEFAULT 'UPLOADED'::character varying NOT NULL,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT internship_documents_document_type_check CHECK (((document_type)::text = ANY ((ARRAY['CV'::character varying, 'APPLICATION'::character varying, 'CONFIRMATION'::character varying, 'INTERNSHIP_PLAN'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT internship_documents_file_size_check CHECK ((file_size >= 0)),
    CONSTRAINT internship_documents_status_check CHECK (((status)::text = ANY ((ARRAY['UPLOADED'::character varying, 'UNDER_REVIEW'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: internship_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.internship_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: internship_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.internship_documents_id_seq OWNED BY public.internship_documents.id;


--
-- Name: internships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internships (
    id bigint NOT NULL,
    student_id bigint NOT NULL,
    lecturer_id bigint,
    semester_id bigint,
    company_id bigint,
    company_mentor_id bigint,
    application_id bigint,
    position_title character varying(200) NOT NULL,
    description text,
    start_date date,
    end_date date,
    required_hours integer,
    completed_hours integer DEFAULT 0 NOT NULL,
    progress_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'NOT_STARTED'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT internships_progress_percentage_check CHECK (((progress_percentage >= (0)::numeric) AND (progress_percentage <= (100)::numeric))),
    CONSTRAINT internships_status_check CHECK (((status)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'IN_PROGRESS'::character varying, 'PAUSED'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: internships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.internships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: internships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.internships_id_seq OWNED BY public.internships.id;


--
-- Name: knowledge_document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_document_versions (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    version character varying(30) NOT NULL,
    file_url text,
    file_hash character varying(255),
    extracted_text_path text,
    chunk_path text,
    effective_date date,
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_document_versions_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUPERSEDED'::character varying, 'ARCHIVED'::character varying])::text[])))
);


--
-- Name: knowledge_document_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_document_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_document_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_document_versions_id_seq OWNED BY public.knowledge_document_versions.id;


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id bigint NOT NULL,
    title character varying(255) NOT NULL,
    document_type character varying(100) NOT NULL,
    description text,
    file_url text,
    current_version character varying(30),
    year integer,
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    uploaded_by bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_documents_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ARCHIVED'::character varying])::text[])))
);


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_documents_id_seq OWNED BY public.knowledge_documents.id;


--
-- Name: lecturer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lecturer_profiles (
    id bigint NOT NULL,
    lecturer_id bigint NOT NULL,
    lecturer_code character varying(50),
    academic_title character varying(100),
    faculty character varying(150),
    specialization text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: lecturer_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lecturer_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lecturer_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lecturer_profiles_id_seq OWNED BY public.lecturer_profiles.id;


--
-- Name: lecturer_student_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lecturer_student_messages (
    id bigint NOT NULL,
    lecturer_id bigint NOT NULL,
    student_id bigint NOT NULL,
    internship_id bigint,
    message_type character varying(30) DEFAULT 'MESSAGE'::character varying NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT lecturer_student_messages_content_check CHECK ((length(btrim(content)) > 0)),
    CONSTRAINT lecturer_student_messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['MESSAGE'::character varying, 'REMINDER'::character varying, 'WARNING'::character varying])::text[])))
);


--
-- Name: lecturer_student_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lecturer_student_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lecturer_student_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lecturer_student_messages_id_seq OWNED BY public.lecturer_student_messages.id;


--
-- Name: lecturer_student_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lecturer_student_notes (
    id bigint NOT NULL,
    lecturer_id bigint,
    student_id bigint NOT NULL,
    internship_id bigint,
    note text NOT NULL,
    is_private boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: lecturer_student_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lecturer_student_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lecturer_student_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lecturer_student_notes_id_seq OWNED BY public.lecturer_student_notes.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    report_deadline boolean DEFAULT true NOT NULL,
    lecturer_feedback boolean DEFAULT true NOT NULL,
    internship_status boolean DEFAULT true NOT NULL,
    email_notifications boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_preferences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    notification_type character varying(100),
    severity character varying(20) DEFAULT 'INFO'::character varying NOT NULL,
    related_type character varying(100),
    related_id bigint,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_severity_check CHECK (((severity)::text = ANY ((ARRAY['INFO'::character varying, 'SUCCESS'::character varying, 'WARNING'::character varying, 'ERROR'::character varying])::text[])))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: rag_index_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_index_jobs (
    id bigint NOT NULL,
    document_version_id bigint,
    job_type character varying(50) DEFAULT 'FULL_INDEX'::character varying NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    chunks_created integer DEFAULT 0 NOT NULL,
    error_message text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT rag_index_jobs_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: rag_index_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rag_index_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rag_index_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rag_index_jobs_id_seq OWNED BY public.rag_index_jobs.id;


--
-- Name: report_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_comments (
    id bigint NOT NULL,
    report_id bigint NOT NULL,
    user_id bigint NOT NULL,
    comment text NOT NULL,
    parent_comment_id bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: report_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_comments_id_seq OWNED BY public.report_comments.id;


--
-- Name: semesters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.semesters (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    academic_year character varying(20),
    semester_code character varying(50),
    start_date date,
    end_date date,
    registration_start_date date,
    registration_end_date date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: semesters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.semesters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: semesters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.semesters_id_seq OWNED BY public.semesters.id;


--
-- Name: student_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_profiles (
    id bigint NOT NULL,
    student_id bigint NOT NULL,
    student_code character varying(50) NOT NULL,
    faculty character varying(150),
    major character varying(150),
    cohort character varying(50),
    gpa numeric(4,2),
    skills text[],
    cv_url text,
    github_url text,
    linkedin_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    class_name character varying(100)
);


--
-- Name: student_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_profiles_id_seq OWNED BY public.student_profiles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email public.citext NOT NULL,
    password_hash text,
    full_name character varying(150) NOT NULL,
    avatar_url text,
    phone character varying(30),
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    gender character varying(20),
    avatar_data bytea,
    avatar_mime_type character varying(100),
    avatar_file_name character varying(255),
    CONSTRAINT users_gender_check CHECK (((gender IS NULL) OR ((gender)::text = ANY ((ARRAY['MALE'::character varying, 'FEMALE'::character varying, 'OTHER'::character varying])::text[])))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['STUDENT'::character varying, 'LECTURER'::character varying, 'ADMIN'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: weekly_report_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_report_schedules (
    id bigint NOT NULL,
    semester_id bigint NOT NULL,
    week_number integer NOT NULL,
    title character varying(255),
    description text,
    start_date date,
    due_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT weekly_report_schedules_week_number_check CHECK ((week_number > 0))
);


--
-- Name: weekly_report_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_report_schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_report_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_report_schedules_id_seq OWNED BY public.weekly_report_schedules.id;


--
-- Name: weekly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_reports (
    id bigint NOT NULL,
    internship_id bigint NOT NULL,
    schedule_id bigint,
    week_number integer,
    title character varying(255),
    content text,
    file_url text,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    lecturer_feedback text,
    lecturer_score numeric(5,2),
    due_at timestamp without time zone,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    report_type character varying(30) DEFAULT 'WEEKLY'::character varying NOT NULL,
    file_data bytea,
    file_name character varying(255),
    mime_type character varying(150),
    file_size bigint,
    completion_letter_data bytea,
    completion_letter_name character varying(255),
    completion_letter_mime_type character varying(150),
    completion_letter_size bigint,
    CONSTRAINT weekly_reports_report_type_check CHECK (((report_type)::text = ANY ((ARRAY['WEEKLY'::character varying, 'MIDTERM'::character varying, 'FINAL'::character varying, 'REFLECTION'::character varying])::text[]))),
    CONSTRAINT weekly_reports_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'LATE'::character varying, 'UNDER_REVIEW'::character varying, 'REVISION_REQUIRED'::character varying, 'APPROVED'::character varying])::text[]))),
    CONSTRAINT weekly_reports_week_number_check CHECK ((week_number > 0))
);


--
-- Name: weekly_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_reports_id_seq OWNED BY public.weekly_reports.id;


--
-- Name: ai_prompts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts ALTER COLUMN id SET DEFAULT nextval('public.ai_prompts_id_seq'::regclass);


--
-- Name: application_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents ALTER COLUMN id SET DEFAULT nextval('public.application_documents_id_seq'::regclass);


--
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- Name: checklist_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items ALTER COLUMN id SET DEFAULT nextval('public.checklist_items_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: company_mentors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_mentors ALTER COLUMN id SET DEFAULT nextval('public.company_mentors_id_seq'::regclass);


--
-- Name: deadlines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadlines ALTER COLUMN id SET DEFAULT nextval('public.deadlines_id_seq'::regclass);


--
-- Name: evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations ALTER COLUMN id SET DEFAULT nextval('public.evaluations_id_seq'::regclass);


--
-- Name: internship_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_applications ALTER COLUMN id SET DEFAULT nextval('public.internship_applications_id_seq'::regclass);


--
-- Name: internship_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_documents ALTER COLUMN id SET DEFAULT nextval('public.internship_documents_id_seq'::regclass);


--
-- Name: internships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships ALTER COLUMN id SET DEFAULT nextval('public.internships_id_seq'::regclass);


--
-- Name: knowledge_document_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_document_versions ALTER COLUMN id SET DEFAULT nextval('public.knowledge_document_versions_id_seq'::regclass);


--
-- Name: knowledge_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents ALTER COLUMN id SET DEFAULT nextval('public.knowledge_documents_id_seq'::regclass);


--
-- Name: lecturer_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_profiles ALTER COLUMN id SET DEFAULT nextval('public.lecturer_profiles_id_seq'::regclass);


--
-- Name: lecturer_student_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_messages ALTER COLUMN id SET DEFAULT nextval('public.lecturer_student_messages_id_seq'::regclass);


--
-- Name: lecturer_student_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_notes ALTER COLUMN id SET DEFAULT nextval('public.lecturer_student_notes_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: rag_index_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_index_jobs ALTER COLUMN id SET DEFAULT nextval('public.rag_index_jobs_id_seq'::regclass);


--
-- Name: report_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_comments ALTER COLUMN id SET DEFAULT nextval('public.report_comments_id_seq'::regclass);


--
-- Name: semesters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters ALTER COLUMN id SET DEFAULT nextval('public.semesters_id_seq'::regclass);


--
-- Name: student_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles ALTER COLUMN id SET DEFAULT nextval('public.student_profiles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: weekly_report_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_report_schedules ALTER COLUMN id SET DEFAULT nextval('public.weekly_report_schedules_id_seq'::regclass);


--
-- Name: weekly_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports ALTER COLUMN id SET DEFAULT nextval('public.weekly_reports_id_seq'::regclass);


--
-- Data for Name: ai_prompts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_prompts (id, name, feature, system_prompt, user_prompt_template, version, is_active, created_by, created_at, updated_at) FROM stdin;
1	Internova RAG Assistant	RAG_CHATBOT	Bạn là trợ lý AI hỗ trợ sinh viên về thực tập.	Câu hỏi của sinh viên: {query}	1.0	t	6	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	Report Reviewer	REPORT_REVIEW	Bạn là AI hỗ trợ review báo cáo thực tập.	Hãy review báo cáo: {report}	1.0	t	6	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: application_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.application_documents (id, application_id, student_id, document_type, title, original_file_name, mime_type, file_size, file_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.calendar_events (id, user_id, internship_id, semester_id, title, description, event_type, start_time, end_time, location, is_all_day, created_at, updated_at) FROM stdin;
1	1	1	1	Review báo cáo Nguyễn Văn An	[student_id:2] Review báo cáo tuần của sinh viên.	STUDENT_REMINDER	2026-08-12 09:00:00	2026-08-12 10:00:00	Online	f	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	1	2	1	Trao đổi với Trần Minh Bình	[student_id:3] Họp cập nhật tiến độ thực tập.	STUDENT_REMINDER	2026-08-14 14:00:00	2026-08-14 15:00:00	Room 201	f	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
3	2	1	1	Deadline báo cáo	Nộp báo cáo thực tập.	REPORT_DEADLINE	2026-08-20 23:59:59	\N	\N	f	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: checklist_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.checklist_items (id, internship_id, title, description, category, status, due_at, completed_at, created_at, updated_at, priority) FROM stdin;
1	1	Cập nhật CV	Cập nhật CV trước kỳ thực tập.	PREPARATION	COMPLETED	2026-05-20 23:59:59	2026-05-18 10:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	MEDIUM
2	1	Nộp xác nhận thực tập	Nộp xác nhận từ doanh nghiệp.	DOCUMENT	COMPLETED	2026-06-05 23:59:59	2026-06-03 09:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	MEDIUM
3	2	Hoàn thành kế hoạch thực tập	Gửi kế hoạch cho giảng viên.	PLAN	IN_PROGRESS	2026-08-15 23:59:59	\N	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	MEDIUM
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.companies (id, name, industry, description, address, website, contact_name, contact_email, phone, is_active, created_at, updated_at) FROM stdin;
1	FPT Software	Software	Công ty phát triển phần mềm.	Hà Nội	https://fptsoftware.com	Nguyễn HR	hr@fpt.example	0240000001	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	Viettel Digital	Technology	Công ty công nghệ và dịch vụ số.	Hà Nội	https://viettel.example	Trần HR	hr@viettel.example	0240000002	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
3	TechNova	Artificial Intelligence	Công ty AI thử nghiệm dành cho Internova.	Hà Nội	https://technova.example	Lê HR	hr@technova.example	0240000003	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: company_mentors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.company_mentors (id, company_id, full_name, email, phone, "position", department, created_at, updated_at) FROM stdin;
1	1	Nguyễn Đức Long	long@fpt.example	0904000001	Senior Software Engineer	Backend	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	2	Trần Quang Huy	huy@viettel.example	0904000002	Technical Lead	Digital Platform	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
3	3	Phạm Minh Đức	duc@technova.example	0904000003	AI Engineer	Artificial Intelligence	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: deadlines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deadlines (id, semester_id, title, description, deadline_type, target_role, due_at, is_active, created_at, updated_at) FROM stdin;
1	1	Chấm báo cáo tuần	Giảng viên hoàn thành review báo cáo sinh viên.	REPORT_REVIEW	LECTURER	2026-08-15 23:59:59	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	1	Đánh giá cuối kỳ	Hoàn thành đánh giá cuối kỳ.	FINAL_EVALUATION	LECTURER	2026-08-25 23:59:59	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
3	1	Nộp báo cáo cuối kỳ	Sinh viên nộp báo cáo cuối kỳ.	FINAL_REPORT	STUDENT	2026-08-20 23:59:59	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: evaluations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluations (id, internship_id, evaluator_id, evaluator_type, evaluation_type, total_score, feedback, strengths, improvements, status, submitted_at, created_at, updated_at) FROM stdin;
1	1	1	LECTURER	MIDTERM	85.00	Sinh viên có tiến bộ tốt.	Chủ động và kỹ thuật tốt.	Cải thiện tài liệu hóa.	CONFIRMED	2026-07-01 09:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	2	1	LECTURER	MIDTERM	80.00	Hoàn thành công việc đúng hạn.	UI tốt.	Cần cải thiện testing.	CONFIRMED	2026-07-01 09:10:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
3	3	1	LECTURER	FINAL	93.00	Hoàn thành xuất sắc.	Khả năng nghiên cứu tốt.	Tiếp tục nâng cao kỹ năng triển khai.	CONFIRMED	2026-08-01 09:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: internship_applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.internship_applications (id, student_id, semester_id, company_id, company_mentor_id, assigned_lecturer_id, position_title, internship_type, description, expected_start_date, expected_end_date, cv_url, application_file_url, status, lecturer_comment, submitted_at, reviewed_at, created_at, updated_at, work_mode, credits) FROM stdin;
1	2	1	1	1	1	Backend Intern	FULL_TIME	Backend internship using Python and FastAPI.	2026-06-01	2026-08-31	\N	\N	APPROVED	\N	2026-05-10 09:00:00	2026-05-12 10:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N
2	3	1	2	2	1	Frontend Intern	FULL_TIME	Frontend internship using React and Next.js.	2026-06-01	2026-08-31	\N	\N	APPROVED	\N	2026-05-11 09:00:00	2026-05-13 10:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N
3	4	1	3	3	1	AI Intern	FULL_TIME	AI internship.	2026-06-01	2026-08-31	\N	\N	APPROVED	\N	2026-05-12 09:00:00	2026-05-14 10:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N
4	5	1	1	1	1	Business Analyst Intern	FULL_TIME	Business internship.	2026-06-01	2026-08-31	\N	\N	UNDER_REVIEW	\N	2026-05-15 09:00:00	\N	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N
\.


--
-- Data for Name: internship_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.internship_documents (id, internship_id, student_id, document_type, title, original_file_name, mime_type, file_size, file_data, status, uploaded_at, updated_at) FROM stdin;
\.


--
-- Data for Name: internships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.internships (id, student_id, lecturer_id, semester_id, company_id, company_mentor_id, application_id, position_title, description, start_date, end_date, required_hours, completed_hours, progress_percentage, status, created_at, updated_at) FROM stdin;
1	2	1	1	1	1	1	Backend Intern	Backend development internship.	2026-06-01	2026-08-31	240	170	71.00	IN_PROGRESS	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	3	1	1	2	2	2	Frontend Intern	Frontend development internship.	2026-06-01	2026-08-31	240	145	60.00	IN_PROGRESS	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
3	4	1	1	3	3	3	AI Intern	AI development internship.	2026-06-01	2026-08-31	240	240	100.00	COMPLETED	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: knowledge_document_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_document_versions (id, document_id, version, file_url, file_hash, extracted_text_path, chunk_path, effective_date, status, created_at) FROM stdin;
1	1	2.0	/documents/internship-policy.pdf	dev-policy-hash	data/rag/policy.txt	data/rag/policy_chunks.jsonl	2025-10-15	ACTIVE	2026-08-09 17:08:41.926224
2	2	1.0	/documents/capstone-booklet.pdf	dev-capstone-hash	data/rag/capstone.txt	data/rag/capstone_chunks.jsonl	2026-01-01	ACTIVE	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: knowledge_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_documents (id, title, document_type, description, file_url, current_version, year, status, uploaded_by, created_at, updated_at) FROM stdin;
1	Internship Management Policy	PDF	Quy chế quản lý thực tập.	/documents/internship-policy.pdf	2.0	2025	ACTIVE	6	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	Capstone Booklet	PDF	Tài liệu hướng dẫn Capstone.	/documents/capstone-booklet.pdf	1.0	2026	ACTIVE	6	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: lecturer_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lecturer_profiles (id, lecturer_id, lecturer_code, academic_title, faculty, specialization, created_at, updated_at) FROM stdin;
1	1	GV001	TS	College of Engineering and Computer Science	Artificial Intelligence and Software Engineering	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: lecturer_student_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lecturer_student_messages (id, lecturer_id, student_id, internship_id, message_type, content, is_read, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: lecturer_student_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lecturer_student_notes (id, lecturer_id, student_id, internship_id, note, is_private, created_at, updated_at) FROM stdin;
1	1	2	1	Sinh viên cần bổ sung phần testing cho API.	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	1	3	2	Theo dõi thêm tiến độ frontend trong tuần tới.	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
3	1	4	3	Sinh viên có khả năng nghiên cứu AI tốt.	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_preferences (id, user_id, report_deadline, lecturer_feedback, internship_status, email_notifications, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, message, notification_type, severity, related_type, related_id, is_read, read_at, created_at) FROM stdin;
1	1	Báo cáo mới	Nguyễn Văn An vừa nộp báo cáo tuần.	REPORT	INFO	WEEKLY_REPORT	2	f	\N	2026-08-09 17:08:41.926224
2	1	Báo cáo cần xử lý	Một báo cáo đang chờ giảng viên review.	REPORT_WARNING	WARNING	WEEKLY_REPORT	3	f	\N	2026-08-09 17:08:41.926224
3	2	Sắp đến hạn báo cáo	Bạn sắp đến hạn nộp báo cáo.	DEADLINE	WARNING	DEADLINE	3	f	\N	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: rag_index_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rag_index_jobs (id, document_version_id, job_type, status, chunks_created, error_message, started_at, completed_at, created_at) FROM stdin;
1	1	FULL_INDEX	COMPLETED	150	\N	2026-08-01 08:00:00	2026-08-01 08:05:00	2026-08-09 17:08:41.926224
2	2	FULL_INDEX	COMPLETED	90	\N	2026-08-01 08:10:00	2026-08-01 08:13:00	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: report_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_comments (id, report_id, user_id, comment, parent_comment_id, created_at, updated_at) FROM stdin;
1	1	1	Báo cáo rõ ràng, bổ sung thêm kết quả thực tế.	\N	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	2	1	Cần mô tả chi tiết hơn API đã triển khai.	\N	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: semesters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.semesters (id, name, academic_year, semester_code, start_date, end_date, registration_start_date, registration_end_date, is_active, created_at, updated_at) FROM stdin;
1	Summer 2026	2025-2026	SUMMER-2026	2026-06-01	2026-08-31	2026-05-01	2026-05-20	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224
2	Spring 2026	2025-2026	SP26	2026-01-12	2026-04-20	\N	\N	f	2026-08-14 09:16:58.093574	2026-08-14 09:16:58.093574
3	Summer 2026	2025-2026	SU26	2026-05-20	2026-08-10	\N	\N	f	2026-08-14 09:16:58.093574	2026-08-14 09:16:58.093574
4	Fall 2026	2026-2027	FA26	2026-08-15	2026-11-15	\N	\N	t	2026-08-14 09:16:58.093574	2026-08-14 09:16:58.093574
5	Spring 2027	2026-2027	SP27	2027-01-10	2027-04-15	\N	\N	t	2026-08-14 09:16:58.093574	2026-08-14 09:16:58.093574
\.


--
-- Data for Name: student_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.student_profiles (id, student_id, student_code, faculty, major, cohort, gpa, skills, cv_url, github_url, linkedin_url, created_at, updated_at, class_name) FROM stdin;
4	5	2A202601004	College of Business and Management	Business Administration	2026	3.55	{Communication,Marketing,Excel}	\N	\N	\N	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N
5	7	2A202601278	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-09 22:57:31.239507	2026-08-09 22:57:31.239507	\N
1	2	2A202601001	College of Engineering and Computer Science	Computer Science	2026	3.65	{Python,FastAPI,PostgreSQL}	\N	\N	\N	2026-08-09 17:08:41.926224	2026-08-14 09:37:13.552718	CS2026-A
2	3	2A202601002	College of Engineering and Computer Science	Computer Science	2026	3.42	{React,Next.js,TypeScript}	\N	\N	\N	2026-08-09 17:08:41.926224	2026-08-14 09:37:13.552718	CS2026-B
3	4	2A202601003	College of Engineering and Computer Science	Data Science	2026	3.71	{Python,"Machine Learning",SQL}	\N	\N	\N	2026-08-09 17:08:41.926224	2026-08-14 09:37:13.552718	DS2026-A
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, full_name, avatar_url, phone, role, is_active, created_at, updated_at, gender, avatar_data, avatar_mime_type, avatar_file_name) FROM stdin;
7	khanhtrummatfb@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$TbcKeUL3JmccfRjHEpKUgg$Kq0CwtS3pb7aHGaeuBOw/94MZtKOaBbuKHQqLKd2dGA	khánh lê	\N	\N	STUDENT	t	2026-08-09 22:57:31.239507	2026-08-09 22:57:31.239507	MALE	\N	\N	\N
1	lecturer@vinuni.edu.vn	$argon2id$v=19$m=65536,t=3,p=4$3bmYcO9/GBvG4L1eu/DjdQ$zT4q35+gFus4SxvTs5zaY1wbuMQI9AiSX0xMvrhOcD4	Nguyễn Minh Anh	\N	0901000001	LECTURER	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N	\N	\N
2	student01@vinuni.edu.vn	$argon2id$v=19$m=65536,t=3,p=4$3bmYcO9/GBvG4L1eu/DjdQ$zT4q35+gFus4SxvTs5zaY1wbuMQI9AiSX0xMvrhOcD4	Nguyễn Văn An	\N	0902000001	STUDENT	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N	\N	\N
3	student02@vinuni.edu.vn	$argon2id$v=19$m=65536,t=3,p=4$3bmYcO9/GBvG4L1eu/DjdQ$zT4q35+gFus4SxvTs5zaY1wbuMQI9AiSX0xMvrhOcD4	Trần Minh Bình	\N	0902000002	STUDENT	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N	\N	\N
4	student03@vinuni.edu.vn	$argon2id$v=19$m=65536,t=3,p=4$3bmYcO9/GBvG4L1eu/DjdQ$zT4q35+gFus4SxvTs5zaY1wbuMQI9AiSX0xMvrhOcD4	Lê Hoàng Nam	\N	0902000003	STUDENT	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N	\N	\N
5	student04@vinuni.edu.vn	$argon2id$v=19$m=65536,t=3,p=4$3bmYcO9/GBvG4L1eu/DjdQ$zT4q35+gFus4SxvTs5zaY1wbuMQI9AiSX0xMvrhOcD4	Phạm Thu Hà	\N	0902000004	STUDENT	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N	\N	\N
6	admin@vinuni.edu.vn	$argon2id$v=19$m=65536,t=3,p=4$3bmYcO9/GBvG4L1eu/DjdQ$zT4q35+gFus4SxvTs5zaY1wbuMQI9AiSX0xMvrhOcD4	Internova Admin	\N	0903000001	ADMIN	t	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	\N	\N	\N	\N
\.


--
-- Data for Name: weekly_report_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.weekly_report_schedules (id, semester_id, week_number, title, description, start_date, due_at, created_at) FROM stdin;
1	1	1	Báo cáo tuần 1	Báo cáo hoạt động tuần đầu tiên.	2026-06-01	2026-06-07 23:59:59	2026-08-09 17:08:41.926224
2	1	2	Báo cáo tuần 2	Báo cáo hoạt động tuần 2.	2026-06-08	2026-06-14 23:59:59	2026-08-09 17:08:41.926224
3	1	3	Báo cáo tuần 3	Báo cáo hoạt động tuần 3.	2026-06-15	2026-06-21 23:59:59	2026-08-09 17:08:41.926224
\.


--
-- Data for Name: weekly_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.weekly_reports (id, internship_id, schedule_id, week_number, title, content, file_url, status, lecturer_feedback, lecturer_score, due_at, submitted_at, reviewed_at, created_at, updated_at, report_type, file_data, file_name, mime_type, file_size, completion_letter_data, completion_letter_name, completion_letter_mime_type, completion_letter_size) FROM stdin;
1	1	1	1	Báo cáo tuần 1 - Nguyễn Văn An	Đã setup môi trường backend và tìm hiểu dự án.	\N	APPROVED	Hoàn thành tốt.	85.00	2026-06-07 23:59:59	2026-06-07 20:00:00	2026-06-08 09:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	WEEKLY	\N	\N	\N	\N	\N	\N	\N	\N
2	1	2	2	Báo cáo tuần 2 - Nguyễn Văn An	Phát triển API và PostgreSQL.	\N	SUBMITTED	\N	\N	2026-06-14 23:59:59	2026-06-14 21:00:00	\N	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	WEEKLY	\N	\N	\N	\N	\N	\N	\N	\N
3	2	1	1	Báo cáo tuần 1 - Trần Minh Bình	Xây dựng giao diện dashboard.	\N	UNDER_REVIEW	\N	\N	2026-06-07 23:59:59	2026-06-07 22:00:00	\N	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	WEEKLY	\N	\N	\N	\N	\N	\N	\N	\N
4	3	1	1	Báo cáo tuần 1 - Lê Hoàng Nam	Tìm hiểu RAG pipeline.	\N	APPROVED	Tốt.	92.00	2026-06-07 23:59:59	2026-06-06 21:00:00	2026-06-08 10:00:00	2026-08-09 17:08:41.926224	2026-08-09 17:08:41.926224	WEEKLY	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Name: ai_prompts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ai_prompts_id_seq', 2, true);


--
-- Name: application_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.application_documents_id_seq', 1, false);


--
-- Name: calendar_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.calendar_events_id_seq', 3, true);


--
-- Name: checklist_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.checklist_items_id_seq', 3, true);


--
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.companies_id_seq', 3, true);


--
-- Name: company_mentors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.company_mentors_id_seq', 3, true);


--
-- Name: deadlines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.deadlines_id_seq', 3, true);


--
-- Name: evaluations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.evaluations_id_seq', 3, true);


--
-- Name: internship_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.internship_applications_id_seq', 4, true);


--
-- Name: internship_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.internship_documents_id_seq', 1, true);


--
-- Name: internships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.internships_id_seq', 3, true);


--
-- Name: knowledge_document_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knowledge_document_versions_id_seq', 2, true);


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.knowledge_documents_id_seq', 2, true);


--
-- Name: lecturer_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lecturer_profiles_id_seq', 1, true);


--
-- Name: lecturer_student_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lecturer_student_messages_id_seq', 1, false);


--
-- Name: lecturer_student_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lecturer_student_notes_id_seq', 3, true);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notification_preferences_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 3, true);


--
-- Name: rag_index_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rag_index_jobs_id_seq', 2, true);


--
-- Name: report_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.report_comments_id_seq', 2, true);


--
-- Name: semesters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.semesters_id_seq', 5, true);


--
-- Name: student_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.student_profiles_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: weekly_report_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.weekly_report_schedules_id_seq', 3, true);


--
-- Name: weekly_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.weekly_reports_id_seq', 4, true);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


--
-- Name: application_documents application_documents_application_id_document_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_application_id_document_type_key UNIQUE (application_id, document_type);


--
-- Name: application_documents application_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_mentors company_mentors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_mentors
    ADD CONSTRAINT company_mentors_pkey PRIMARY KEY (id);


--
-- Name: deadlines deadlines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadlines
    ADD CONSTRAINT deadlines_pkey PRIMARY KEY (id);


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_pkey PRIMARY KEY (id);


--
-- Name: internship_applications internship_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_applications
    ADD CONSTRAINT internship_applications_pkey PRIMARY KEY (id);


--
-- Name: internship_documents internship_documents_internship_id_document_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_documents
    ADD CONSTRAINT internship_documents_internship_id_document_type_key UNIQUE (internship_id, document_type);


--
-- Name: internship_documents internship_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_documents
    ADD CONSTRAINT internship_documents_pkey PRIMARY KEY (id);


--
-- Name: internships internships_application_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_application_id_key UNIQUE (application_id);


--
-- Name: internships internships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_pkey PRIMARY KEY (id);


--
-- Name: knowledge_document_versions knowledge_document_versions_document_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_document_versions
    ADD CONSTRAINT knowledge_document_versions_document_id_version_key UNIQUE (document_id, version);


--
-- Name: knowledge_document_versions knowledge_document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_document_versions
    ADD CONSTRAINT knowledge_document_versions_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: lecturer_profiles lecturer_profiles_lecturer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_profiles
    ADD CONSTRAINT lecturer_profiles_lecturer_code_key UNIQUE (lecturer_code);


--
-- Name: lecturer_profiles lecturer_profiles_lecturer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_profiles
    ADD CONSTRAINT lecturer_profiles_lecturer_id_key UNIQUE (lecturer_id);


--
-- Name: lecturer_profiles lecturer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_profiles
    ADD CONSTRAINT lecturer_profiles_pkey PRIMARY KEY (id);


--
-- Name: lecturer_student_messages lecturer_student_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_messages
    ADD CONSTRAINT lecturer_student_messages_pkey PRIMARY KEY (id);


--
-- Name: lecturer_student_notes lecturer_student_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_notes
    ADD CONSTRAINT lecturer_student_notes_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: rag_index_jobs rag_index_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_index_jobs
    ADD CONSTRAINT rag_index_jobs_pkey PRIMARY KEY (id);


--
-- Name: report_comments report_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_comments
    ADD CONSTRAINT report_comments_pkey PRIMARY KEY (id);


--
-- Name: semesters semesters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_pkey PRIMARY KEY (id);


--
-- Name: semesters semesters_semester_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_semester_code_key UNIQUE (semester_code);


--
-- Name: student_profiles student_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_pkey PRIMARY KEY (id);


--
-- Name: student_profiles student_profiles_student_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_student_code_key UNIQUE (student_code);


--
-- Name: student_profiles student_profiles_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_student_id_key UNIQUE (student_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: weekly_report_schedules weekly_report_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_report_schedules
    ADD CONSTRAINT weekly_report_schedules_pkey PRIMARY KEY (id);


--
-- Name: weekly_report_schedules weekly_report_schedules_semester_id_week_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_report_schedules
    ADD CONSTRAINT weekly_report_schedules_semester_id_week_number_key UNIQUE (semester_id, week_number);


--
-- Name: weekly_reports weekly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_pkey PRIMARY KEY (id);


--
-- Name: idx_application_documents_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_documents_application ON public.application_documents USING btree (application_id);


--
-- Name: idx_application_documents_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_documents_student ON public.application_documents USING btree (student_id);


--
-- Name: idx_calendar_events_user_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_user_start ON public.calendar_events USING btree (user_id, start_time);


--
-- Name: idx_calendar_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_start ON public.calendar_events USING btree (start_time);


--
-- Name: idx_deadlines_due_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deadlines_due_active ON public.deadlines USING btree (due_at, is_active);


--
-- Name: idx_internship_documents_internship; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internship_documents_internship ON public.internship_documents USING btree (internship_id);


--
-- Name: idx_internship_documents_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internship_documents_student ON public.internship_documents USING btree (student_id);


--
-- Name: idx_internships_lecturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internships_lecturer ON public.internships USING btree (lecturer_id);


--
-- Name: idx_internships_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internships_status ON public.internships USING btree (status);


--
-- Name: idx_internships_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internships_student ON public.internships USING btree (student_id);


--
-- Name: idx_lecturer_student_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lecturer_student_messages_conversation ON public.lecturer_student_messages USING btree (lecturer_id, student_id, created_at DESC);


--
-- Name: idx_lecturer_student_messages_student_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lecturer_student_messages_student_unread ON public.lecturer_student_messages USING btree (student_id, is_read, created_at DESC);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_reports_unique_special_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_reports_unique_special_type ON public.weekly_reports USING btree (internship_id, report_type) WHERE ((report_type)::text = ANY ((ARRAY['MIDTERM'::character varying, 'FINAL'::character varying, 'REFLECTION'::character varying])::text[]));


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_weekly_reports_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_reports_due_at ON public.weekly_reports USING btree (due_at);


--
-- Name: idx_weekly_reports_internship; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_reports_internship ON public.weekly_reports USING btree (internship_id);


--
-- Name: idx_weekly_reports_internship_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_reports_internship_status ON public.weekly_reports USING btree (internship_id, status);


--
-- Name: idx_weekly_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_reports_status ON public.weekly_reports USING btree (status);


--
-- Name: idx_weekly_reports_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_reports_type ON public.weekly_reports USING btree (report_type);


--
-- Name: idx_weekly_reports_unique_week; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_weekly_reports_unique_week ON public.weekly_reports USING btree (internship_id, week_number) WHERE ((report_type)::text = 'WEEKLY'::text);


--
-- Name: ai_prompts ai_prompts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: application_documents application_documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.internship_applications(id) ON DELETE CASCADE;


--
-- Name: application_documents application_documents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_internship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES public.internships(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_semester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: checklist_items checklist_items_internship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES public.internships(id) ON DELETE CASCADE;


--
-- Name: company_mentors company_mentors_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_mentors
    ADD CONSTRAINT company_mentors_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: deadlines deadlines_semester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deadlines
    ADD CONSTRAINT deadlines_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE CASCADE;


--
-- Name: evaluations evaluations_evaluator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: evaluations evaluations_internship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES public.internships(id) ON DELETE CASCADE;


--
-- Name: internship_applications internship_applications_assigned_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_applications
    ADD CONSTRAINT internship_applications_assigned_lecturer_id_fkey FOREIGN KEY (assigned_lecturer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: internship_applications internship_applications_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_applications
    ADD CONSTRAINT internship_applications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: internship_applications internship_applications_company_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_applications
    ADD CONSTRAINT internship_applications_company_mentor_id_fkey FOREIGN KEY (company_mentor_id) REFERENCES public.company_mentors(id) ON DELETE SET NULL;


--
-- Name: internship_applications internship_applications_semester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_applications
    ADD CONSTRAINT internship_applications_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE SET NULL;


--
-- Name: internship_applications internship_applications_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_applications
    ADD CONSTRAINT internship_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: internship_documents internship_documents_internship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_documents
    ADD CONSTRAINT internship_documents_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES public.internships(id) ON DELETE CASCADE;


--
-- Name: internship_documents internship_documents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internship_documents
    ADD CONSTRAINT internship_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: internships internships_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.internship_applications(id) ON DELETE SET NULL;


--
-- Name: internships internships_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: internships internships_company_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_company_mentor_id_fkey FOREIGN KEY (company_mentor_id) REFERENCES public.company_mentors(id) ON DELETE SET NULL;


--
-- Name: internships internships_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: internships internships_semester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE SET NULL;


--
-- Name: internships internships_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internships
    ADD CONSTRAINT internships_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_document_versions knowledge_document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_document_versions
    ADD CONSTRAINT knowledge_document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lecturer_profiles lecturer_profiles_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_profiles
    ADD CONSTRAINT lecturer_profiles_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lecturer_student_messages lecturer_student_messages_internship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_messages
    ADD CONSTRAINT lecturer_student_messages_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES public.internships(id) ON DELETE SET NULL;


--
-- Name: lecturer_student_messages lecturer_student_messages_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_messages
    ADD CONSTRAINT lecturer_student_messages_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lecturer_student_messages lecturer_student_messages_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_messages
    ADD CONSTRAINT lecturer_student_messages_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lecturer_student_notes lecturer_student_notes_internship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_notes
    ADD CONSTRAINT lecturer_student_notes_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES public.internships(id) ON DELETE CASCADE;


--
-- Name: lecturer_student_notes lecturer_student_notes_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_notes
    ADD CONSTRAINT lecturer_student_notes_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lecturer_student_notes lecturer_student_notes_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturer_student_notes
    ADD CONSTRAINT lecturer_student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: rag_index_jobs rag_index_jobs_document_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_index_jobs
    ADD CONSTRAINT rag_index_jobs_document_version_id_fkey FOREIGN KEY (document_version_id) REFERENCES public.knowledge_document_versions(id) ON DELETE CASCADE;


--
-- Name: report_comments report_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_comments
    ADD CONSTRAINT report_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.report_comments(id) ON DELETE CASCADE;


--
-- Name: report_comments report_comments_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_comments
    ADD CONSTRAINT report_comments_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.weekly_reports(id) ON DELETE CASCADE;


--
-- Name: report_comments report_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_comments
    ADD CONSTRAINT report_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_profiles student_profiles_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: weekly_report_schedules weekly_report_schedules_semester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_report_schedules
    ADD CONSTRAINT weekly_report_schedules_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE CASCADE;


--
-- Name: weekly_reports weekly_reports_internship_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES public.internships(id) ON DELETE CASCADE;


--
-- Name: weekly_reports weekly_reports_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.weekly_report_schedules(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 5e4BnQM5r5IJK04URPzBoU1CWYUDNQFZOt9AduNGdM5ek1dQZ0vYP9Hz1pmPsqO

