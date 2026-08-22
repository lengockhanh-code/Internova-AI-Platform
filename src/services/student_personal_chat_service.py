from __future__ import annotations

import logging
import re
import unicodedata
from functools import lru_cache
from datetime import datetime
from typing import Any, Callable, Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings
from src.rag.schemas import QueryResult

logger = logging.getLogger(__name__)


PERSONAL_PATTERNS = (
    "của tôi",
    "của em",
    "của mình",
    "của tớ",
    "của tui",
    "của tao",
    "tôi có",
    "em có",
    "mình có",
    "thông tin cá nhân",
    "thông tin của tôi",
    "thông tin của em",
    "hồ sơ của tôi",
    "hồ sơ của em",
    "tài khoản của tôi",
    "tài khoản của em",
    "deadline của tôi",
    "deadline của em",
    "deadline sắp tới",
    "dealine sắp tới",
    "hạn của tôi",
    "hạn của em",
    "hạn nộp của tôi",
    "hạn nộp của em",
    "việc cần làm của tôi",
    "việc cần làm của em",
    "checklist của tôi",
    "checklist của em",
    "báo cáo của tôi",
    "báo cáo của em",
    "kỳ thực tập của tôi",
    "kỳ thực tập của em",
    "lịch của tôi",
    "lịch của em",
    "my",
    "mine",
    "my account",
    "my profile",
    "my personal information",
    "my student information",
    "my student profile",
    "my internship",
    "my internship information",
    "my company",
    "my supervisor",
    "my lecturer",
    "my mentor",
    "my report",
    "my reports",
    "my checklist",
    "my task",
    "my tasks",
    "my todo",
    "my todos",
    "my deadline",
    "my deadlines",
    "my dealine",
    "my dealines",
    "upcoming deadline",
    "upcoming deadlines",
    "upcoming due date",
    "upcoming due dates",
    "next deadline",
    "next due date",
    "what is my deadline",
    "when is my deadline",
    "what are my deadlines",
    "when are my deadlines",
)

DEADLINE_KEYWORDS = (
    "deadline",
    "deadlines",
    "dealine",
    "dealines",
    "due date",
    "due dates",
    "due",
    "upcoming",
    "next",
    "schedule",
    "calendar",
    "hạn",
    "han",
    "hạn nộp",
    "han nop",
    "sắp tới",
    "sap toi",
    "lịch",
    "lich",
    "nộp",
    "nop",
)

PROFILE_KEYWORDS = (
    "profile",
    "student profile",
    "personal information",
    "student information",
    "account",
    "hồ sơ",
    "ho so",
    "thông tin",
    "thong tin",
    "thông tin cá nhân",
    "thong tin ca nhan",
    "mssv",
    "student id",
    "student code",
    "mã số",
    "ma so",
    "gpa",
    "major",
    "faculty",
    "cohort",
    "skills",
    "ngành",
    "nganh",
    "khoa",
    "khóa",
    "khoa hoc",
)

INTERNSHIP_KEYWORDS = (
    "internship",
    "internship information",
    "placement",
    "company",
    "organization",
    "supervisor",
    "lecturer",
    "mentor",
    "position",
    "role",
    "thực tập",
    "thuc tap",
    "công ty",
    "cong ty",
    "doanh nghiệp",
    "doanh nghiep",
    "giảng viên",
    "giang vien",
    "người hướng dẫn",
    "nguoi huong dan",
    "vị trí",
    "vi tri",
)

CHECKLIST_KEYWORDS = (
    "checklist",
    "task",
    "tasks",
    "todo",
    "todos",
    "to do",
    "action item",
    "action items",
    "việc cần làm",
    "viec can lam",
    "cần làm",
    "can lam",
)

REPORT_KEYWORDS = (
    "report",
    "reports",
    "weekly report",
    "weekly reports",
    "final report",
    "midterm report",
    "submission",
    "submissions",
    "assignment",
    "assignments",
    "báo cáo",
    "bao cao",
    "bài nộp",
    "bai nop",
)

REPORT_PENDING_KEYWORDS = (
    "chưa nộp",
    "chua nop",
    "chưa gửi",
    "chua gui",
    "cần nộp",
    "can nop",
    "phải nộp",
    "phai nop",
    "còn báo cáo",
    "con bao cao",
    "báo cáo còn",
    "bao cao con",
    "báo cáo nào chưa",
    "bao cao nao chua",
    "báo cáo chưa",
    "bao cao chua",
    "báo cáo cần",
    "bao cao can",
    "pending report",
    "pending reports",
    "unsubmitted report",
    "unsubmitted reports",
    "not submitted",
    "missing report",
    "missing reports",
    "reports due",
    "report due",
    "due reports",
    "have any pending reports",
    "which reports have i not submitted",
    "what reports do i need to submit",
    "which reports do i need to submit",
    "what do i need to submit",
    "reports i need to submit",
    "reports i have to submit",
    "need to submit",
    "have to submit",
)

REPORT_STATUS_QUESTION_KEYWORDS = REPORT_PENDING_KEYWORDS + (
    "which",
    "what",
    "show",
    "list",
    "have any",
    "còn",
    "con",
    "nào",
    "nao",
)

FIRST_PERSON_TERMS = (
    "tôi",
    "toi",
    "em",
    "mình",
    "minh",
    "tớ",
    "to",
    "tui",
    "tao",
    "me",
    "my",
    "mine",
    "myself",
    "i",
)

PERSONAL_TOPIC_KEYWORDS = (
    DEADLINE_KEYWORDS
    + PROFILE_KEYWORDS
    + INTERNSHIP_KEYWORDS
    + CHECKLIST_KEYWORDS
    + REPORT_KEYWORDS
)


POLICY_SCOPE_MARKERS = (
    "theo quy định", "theo quy dinh", "theo policy", "quy định", "quy dinh",
    "chính sách", "chinh sach", "policy", "official policy", "regulation",
    "requirement", "requirements", "required for students", "internship requirement",
    "sinh viên phải", "sinh vien phai", "mọi sinh viên", "moi sinh vien",
    "all students", "internship students", "quy trình", "quy trinh", "procedure",
)

CURRENT_STATE_MARKERS = (
    "hiện tại", "hien tai", "bây giờ", "bay gio", "của tôi", "cua toi",
    "của em", "cua em", "của mình", "cua minh", "my ", "mine",
    "tôi có", "toi co", "em có", "em co", "mình có", "minh co",
    "tôi đã", "toi da", "em đã", "em da", "have i", "do i have",
    "am i", "my current", "for me",
)

PersonalScope = Literal["personal", "policy", "ambiguous"]


def _semantic_personal_scope(message: str) -> PersonalScope:
    """Use an LLM only for genuinely ambiguous personal-vs-policy questions.

    Fast deterministic cases never pay this network cost. On model failure we
    return ``ambiguous`` so the caller preserves the previous safe behavior.
    """
    return _semantic_personal_scope_cached(message.strip())


@lru_cache(maxsize=512)
def _semantic_personal_scope_cached(message: str) -> PersonalScope:
    settings = get_settings()
    if not settings.openai_api_key:
        return "ambiguous"

    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=settings.openai_chat_model or settings.model_name,
            api_key=settings.openai_api_key,
            temperature=0,
            max_tokens=8,
            max_retries=0,
            timeout=5.0,
        )
        response = llm.invoke([
            (
                "system",
                "Classify a logged-in student's message. Return exactly PERSONAL or POLICY. "
                "PERSONAL means the user asks about their own current DB-backed state, assigned "
                "reports/tasks/deadlines/profile/internship or submission status. POLICY means the "
                "user asks about general rules, requirements, procedures, or what students in "
                "general must do. First-person wording such as 'what reports do I need to submit' "
                "is PERSONAL unless the wording explicitly asks according to policy/regulation.",
            ),
            ("human", message),
        ])
        content = str(getattr(response, "content", "")).strip().upper()
        if "PERSONAL" in content:
            return "personal"
        if "POLICY" in content:
            return "policy"
    except Exception as exc:
        logger.debug("Personal intent semantic fallback failed: %s", exc)

    return "ambiguous"


def classify_student_personal_scope(message: str) -> PersonalScope:
    """Classify whether a student message should query personal DB or RAG.

    The classifier is deliberately hierarchical:
    1. explicit policy wording -> RAG;
    2. explicit/current first-person state -> DB;
    3. obvious report/deadline status questions -> DB;
    4. only genuinely ambiguous personal topics use the semantic fallback.
    """
    normalized = _normalize_for_matching(message)

    has_policy_marker = _contains_any(normalized, POLICY_SCOPE_MARKERS)
    if has_policy_marker:
        return "policy"

    if _contains_any(normalized, PERSONAL_PATTERNS):
        return "personal"

    has_first_person = _contains_any_word(normalized, FIRST_PERSON_TERMS)
    has_personal_topic = _contains_any(normalized, PERSONAL_TOPIC_KEYWORDS)
    if has_first_person and has_personal_topic:
        return "personal"

    if _contains_any(normalized, CURRENT_STATE_MARKERS) and has_personal_topic:
        return "personal"

    deadline_question = _contains_any(normalized, DEADLINE_KEYWORDS) and _contains_any(
        normalized,
        ("what", "when", "which", "list", "show", "tell", "là gì", "la gi",
         "khi nào", "khi nao", "bao giờ", "bao gio", "sắp tới", "sap toi"),
    )
    report_status_question = _contains_any(normalized, REPORT_KEYWORDS) and _contains_any(
        normalized, REPORT_STATUS_QUESTION_KEYWORDS,
    )
    if deadline_question or report_status_question:
        return "personal"

    if has_personal_topic:
        semantic = _semantic_personal_scope(message)
        if semantic != "ambiguous":
            return semantic

    return "policy"

STATUS_LABELS = {
    "DRAFT": "bản nháp",
    "SUBMITTED": "đã nộp",
    "UNDER_REVIEW": "đang chờ duyệt",
    "APPROVED": "đã duyệt",
    "REVISION_REQUIRED": "cần chỉnh sửa",
    "REJECTED": "bị từ chối",
    "PENDING": "chưa làm",
    "IN_PROGRESS": "đang làm",
    "COMPLETED": "đã hoàn thành",
    "NOT_STARTED": "chưa bắt đầu",
    "ONGOING": "đang diễn ra",
    "FINISHED": "đã kết thúc",
}



@lru_cache(maxsize=4)
def _get_personal_answer_llm(model_name: str):
    """Reuse the personal-answer LLM client/HTTP pool."""
    from langchain_openai import ChatOpenAI

    settings = get_settings()
    return ChatOpenAI(
        model=model_name,
        api_key=settings.openai_api_key,
        temperature=0.1,
        max_tokens=900,
        max_retries=1,
        timeout=20.0,
    )


def _generate_personal_answer(
    message: str,
    personal_context: str,
    fallback_answer: str,
    on_token: Callable[[str], None] | None = None,
) -> str:
    """Turn authenticated DB facts into a focused answer to the actual question.

    This is deliberately NOT a policy engine. Personal DB facts may be used to
    answer the student's own state/status, but official rules must still go
    through the normal RAG path.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        return fallback_answer

    system_prompt = """
You are the personal-data answer layer of Internova AI.

You receive:
1. the student's CURRENT question;
2. authenticated facts queried from the application's database.

Your job is to answer the exact personal question, not dump every database field.

STRICT RULES:
- Use ONLY the authenticated database facts supplied below for personal facts.
- Do not invent reports, deadlines, status, GPA, company, lecturer, dates, tasks,
  submissions, or any other personal value.
- Do not invent or decide university policy, eligibility, exceptions, approvals,
  permissions, or legal/administrative outcomes.
- If the current question actually requires an official policy conclusion,
  clearly say that the personal database facts alone are not enough; that part
  must be checked against official policy.
- Distinguish "no matching database record was found" from "the thing does not
  exist in university policy".
- Answer only what the student asked. Do not dump unrelated profile fields.
- When several database facts are relevant, reason over them and summarize the
  conclusion first, then the supporting facts.
- Preserve exact names, dates, statuses and numbers from the database.
- Respond in the language of the CURRENT user message.
- Be concise, natural and useful.
""".strip()

    user_prompt = f"""
CURRENT STUDENT QUESTION:
{message}

AUTHENTICATED DATABASE FACTS:
{personal_context or "(no matching personal record was found)"}

RAW SAFE FALLBACK:
{fallback_answer}

Answer the student's current question using the authenticated database facts.
""".strip()

    try:
        llm = _get_personal_answer_llm(
            settings.openai_chat_model or settings.model_name
        )

        if on_token is None:
            response = llm.invoke([
                ("system", system_prompt),
                ("human", user_prompt),
            ])
            content = getattr(response, "content", "")
            if isinstance(content, str) and content.strip():
                return content.strip()
            return fallback_answer

        pieces: list[str] = []
        for chunk in llm.stream([
            ("system", system_prompt),
            ("human", user_prompt),
        ]):
            content = getattr(chunk, "content", "")
            if not content:
                continue
            if isinstance(content, list):
                token = "".join(
                    str(item.get("text", ""))
                    if isinstance(item, dict)
                    else str(item)
                    for item in content
                )
            else:
                token = str(content)
            if token:
                pieces.append(token)
                on_token(token)

        answer = "".join(pieces).strip()
        return answer or fallback_answer

    except Exception as exc:
        logger.warning(
            "Personal answer generation failed; using deterministic DB fallback: %s",
            exc,
        )
        return fallback_answer



def answer_student_personal_question(
    db: Session,
    current_user: dict,
    message: str,
    personal_scope: PersonalScope | None = None,
    on_token: Callable[[str], None] | None = None,
) -> QueryResult | None:
    """Return a DB-grounded personal answer, or None to keep normal RAG behavior."""

    if str(current_user.get("role") or "").upper() != "STUDENT":
        return None

    resolved_scope = personal_scope or classify_student_personal_scope(message)
    if resolved_scope != "personal":
        return None

    normalized = _normalize_for_matching(message)

    student_id = int(current_user["id"])
    sections: list[str] = []

    wants_deadlines = _contains_any(normalized, DEADLINE_KEYWORDS)
    wants_profile = _contains_any(normalized, PROFILE_KEYWORDS)
    wants_internship = _contains_any(normalized, INTERNSHIP_KEYWORDS)
    wants_checklist = _contains_any(normalized, CHECKLIST_KEYWORDS)
    wants_reports = _contains_any(normalized, REPORT_KEYWORDS)
    wants_pending_reports = wants_reports and _contains_any(
        normalized,
        REPORT_PENDING_KEYWORDS,
    )

    if not any((
        wants_deadlines,
        wants_profile,
        wants_internship,
        wants_checklist,
        wants_reports,
    )):
        wants_profile = True
        wants_internship = True
        wants_deadlines = True

    if wants_profile:
        profile = _get_student_profile(db, student_id)
        if profile:
            sections.append(_format_profile(profile))

    if wants_internship:
        internship = _get_current_internship(db, student_id)
        if internship:
            sections.append(_format_internship(internship))

    if wants_deadlines:
        deadlines = _get_upcoming_deadlines(db, student_id)
        if deadlines:
            sections.append(_format_deadlines(deadlines))

    if wants_checklist:
        checklist_items = _get_upcoming_checklist_items(db, student_id)
        if checklist_items:
            sections.append(_format_checklist(checklist_items))

    if wants_reports:
        if wants_pending_reports:
            reports = _get_pending_reports(db, student_id)
            if reports:
                sections.append(_format_reports(reports, pending_only=True))
        else:
            reports = _get_recent_reports(db, student_id)
            if reports:
                sections.append(_format_reports(reports))

    missing_sections: list[str] = []

    if wants_deadlines and not any(section.startswith("Các deadline") for section in sections):
        missing_sections.append("Hiện tại hệ thống chưa ghi nhận deadline sắp tới nào của bạn.")

    if wants_checklist and not any(section.startswith("Các việc checklist") for section in sections):
        missing_sections.append("Hiện tại hệ thống chưa ghi nhận checklist chưa hoàn thành nào của bạn.")

    has_report_section = any(
        section.startswith("Một số báo cáo")
        or section.startswith("Các báo cáo chưa nộp")
        for section in sections
    )
    if wants_reports and not has_report_section:
        if wants_pending_reports:
            missing_sections.append(
                "Hiện tại hệ thống chưa ghi nhận báo cáo nào đang ở trạng thái chưa nộp/cần nộp của bạn."
            )
        else:
            missing_sections.append("Hiện tại hệ thống chưa ghi nhận báo cáo nào của bạn.")

    if wants_internship and not any(section.startswith("Thông tin kỳ thực tập") for section in sections):
        missing_sections.append("Hiện tại hệ thống chưa ghi nhận kỳ thực tập nào gắn với tài khoản của bạn.")

    if wants_profile and not any(section.startswith("Thông tin sinh viên") for section in sections):
        missing_sections.append("Hiện tại hệ thống chưa ghi nhận hồ sơ sinh viên cho tài khoản của bạn.")

    answer_parts = sections + missing_sections

    if answer_parts:
        fallback_answer = "\n\n".join(answer_parts)
        status = "answered" if sections else "not_found"
        confidence = 1.0 if sections else 0.0
    else:
        fallback_answer = (
            "Mình chưa tìm thấy thông tin cá nhân phù hợp trong tài khoản của bạn."
        )
        status = "not_found"
        confidence = 0.0

    # DB remains the source of truth, but a model now interprets the student's
    # actual question instead of returning a raw profile/status dump.
    personal_context = "\n\n".join(answer_parts)
    answer = _generate_personal_answer(
        message=message,
        personal_context=personal_context,
        fallback_answer=fallback_answer,
        on_token=on_token,
    )

    return QueryResult(
        query=message,
        answer=answer,
        answer_status=status,
        answer_language="vi",
        confidence=confidence,
        sources=[],
        route_intent="personal_student_info",
        route_scope="personal_student",
        guardrail_passed=True,
    )


def _normalize_for_matching(message: str) -> str:
    lowered = " ".join(message.strip().lower().split())
    ascii_text = _strip_accents(lowered).replace("đ", "d")
    ascii_text = _collapse_common_typos(ascii_text)
    return f"{lowered} {ascii_text}"


def _strip_accents(value: str) -> str:
    return "".join(
        ch
        for ch in unicodedata.normalize("NFD", value)
        if unicodedata.category(ch) != "Mn"
    )


def _collapse_common_typos(value: str) -> str:
    return (
        value
        .replace("dealine", "deadline")
        .replace("dealines", "deadlines")
        .replace("dedline", "deadline")
        .replace("dedlines", "deadlines")
        .replace("dead line", "deadline")
        .replace("due-date", "due date")
    )


def _looks_personal(normalized: str) -> bool:
    """Backward-compatible local heuristic used by older imports/tests."""
    if _contains_any(normalized, POLICY_SCOPE_MARKERS):
        return False
    if _contains_any(normalized, PERSONAL_PATTERNS):
        return True
    has_first_person = _contains_any_word(normalized, FIRST_PERSON_TERMS)
    has_personal_topic = _contains_any(normalized, PERSONAL_TOPIC_KEYWORDS)
    if has_first_person and has_personal_topic:
        return True
    deadline_question = _contains_any(normalized, DEADLINE_KEYWORDS) and _contains_any(
        normalized,
        ("what", "when", "which", "list", "show", "tell", "là gì", "la gi",
         "khi nào", "khi nao", "bao giờ", "bao gio", "sắp tới", "sap toi"),
    )
    report_status_question = _contains_any(normalized, REPORT_KEYWORDS) and _contains_any(
        normalized, REPORT_STATUS_QUESTION_KEYWORDS,
    )
    return deadline_question or report_status_question


def _contains_any(normalized: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in normalized for keyword in keywords)


def _contains_any_word(normalized: str, keywords: tuple[str, ...]) -> bool:
    return any(
        re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", normalized)
        for keyword in keywords
    )


def _get_student_profile(db: Session, student_id: int) -> dict[str, Any] | None:
    return db.execute(
        text(
            """
            SELECT
                u.full_name,
                u.email,
                sp.student_code,
                sp.faculty,
                sp.major,
                sp.cohort,
                sp.gpa,
                sp.skills,
                sp.cv_url,
                sp.github_url,
                sp.linkedin_url
            FROM users AS u
            LEFT JOIN student_profiles AS sp
                ON sp.student_id = u.id
            WHERE u.id = :student_id
              AND u.role = 'STUDENT'
            LIMIT 1
            """
        ),
        {"student_id": student_id},
    ).mappings().first()


def _get_current_internship(db: Session, student_id: int) -> dict[str, Any] | None:
    return db.execute(
        text(
            """
            SELECT
                i.id,
                i.position_title,
                i.description,
                i.start_date,
                i.end_date,
                i.status,
                c.name AS company_name,
                s.name AS semester_name,
                s.semester_code,
                lecturer.full_name AS lecturer_name
            FROM internships AS i
            LEFT JOIN companies AS c
                ON c.id = i.company_id
            LEFT JOIN semesters AS s
                ON s.id = i.semester_id
            LEFT JOIN users AS lecturer
                ON lecturer.id = i.lecturer_id
            WHERE i.student_id = :student_id
            ORDER BY
                CASE
                    WHEN i.status IN ('IN_PROGRESS', 'ONGOING', 'NOT_STARTED') THEN 0
                    ELSE 1
                END,
                i.start_date DESC NULLS LAST,
                i.id DESC
            LIMIT 1
            """
        ),
        {"student_id": student_id},
    ).mappings().first()


def _get_upcoming_deadlines(db: Session, student_id: int) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """
            WITH current_internship AS (
                SELECT id, semester_id
                FROM internships
                WHERE student_id = :student_id
                ORDER BY
                    CASE
                        WHEN status IN ('IN_PROGRESS', 'ONGOING', 'NOT_STARTED') THEN 0
                        ELSE 1
                    END,
                    start_date DESC NULLS LAST,
                    id DESC
                LIMIT 1
            )
            SELECT *
            FROM (
                SELECT
                    'report' AS source_type,
                    wr.title,
                    wr.due_at,
                    wr.status,
                    wr.report_type AS detail
                FROM weekly_reports AS wr
                JOIN current_internship AS ci
                    ON ci.id = wr.internship_id
                WHERE wr.due_at IS NOT NULL
                  AND wr.due_at >= NOW()
                  AND wr.status IN ('DRAFT', 'REVISION_REQUIRED')

                UNION ALL

                SELECT
                    'checklist' AS source_type,
                    ci_item.title,
                    ci_item.due_at,
                    ci_item.status,
                    ci_item.category AS detail
                FROM checklist_items AS ci_item
                JOIN current_internship AS ci
                    ON ci.id = ci_item.internship_id
                WHERE ci_item.due_at IS NOT NULL
                  AND ci_item.due_at >= NOW()
                  AND ci_item.status <> 'COMPLETED'

                UNION ALL

                SELECT
                    'deadline' AS source_type,
                    d.title,
                    d.due_at,
                    d.deadline_type AS status,
                    d.description AS detail
                FROM deadlines AS d
                LEFT JOIN current_internship AS ci
                    ON TRUE
                WHERE d.is_active = TRUE
                  AND d.due_at >= NOW()
                  AND (d.target_role IS NULL OR d.target_role IN ('STUDENT', 'ALL'))
                  AND (d.semester_id IS NULL OR d.semester_id = ci.semester_id)
            ) AS upcoming
            ORDER BY due_at ASC
            LIMIT 5
            """
        ),
        {"student_id": student_id},
    ).mappings().all()

    return [dict(row) for row in rows]


def _get_upcoming_checklist_items(db: Session, student_id: int) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT
                ci.title,
                ci.status,
                ci.priority,
                ci.due_at
            FROM checklist_items AS ci
            JOIN internships AS i
                ON i.id = ci.internship_id
            WHERE i.student_id = :student_id
              AND ci.status <> 'COMPLETED'
            ORDER BY ci.due_at ASC NULLS LAST, ci.id ASC
            LIMIT 5
            """
        ),
        {"student_id": student_id},
    ).mappings().all()

    return [dict(row) for row in rows]


def _get_recent_reports(db: Session, student_id: int) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT
                wr.title,
                wr.report_type,
                wr.week_number,
                wr.status,
                wr.due_at,
                wr.submitted_at
            FROM weekly_reports AS wr
            JOIN internships AS i
                ON i.id = wr.internship_id
            WHERE i.student_id = :student_id
            ORDER BY wr.due_at ASC NULLS LAST, wr.id DESC
            LIMIT 5
            """
        ),
        {"student_id": student_id},
    ).mappings().all()

    return [dict(row) for row in rows]


def _get_pending_reports(db: Session, student_id: int) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT
                wr.title,
                wr.report_type,
                wr.week_number,
                wr.status,
                wr.due_at,
                wr.submitted_at
            FROM weekly_reports AS wr
            JOIN internships AS i
                ON i.id = wr.internship_id
            WHERE i.student_id = :student_id
              AND (
                  wr.submitted_at IS NULL
                  OR wr.status IN ('DRAFT', 'REVISION_REQUIRED', 'PENDING', 'NOT_STARTED')
              )
            ORDER BY wr.due_at ASC NULLS LAST, wr.id ASC
            LIMIT 5
            """
        ),
        {"student_id": student_id},
    ).mappings().all()

    return [dict(row) for row in rows]


def _format_profile(profile: dict[str, Any]) -> str:
    lines = ["Thông tin sinh viên mình tìm thấy:"]
    _append_line(lines, "Họ tên", profile.get("full_name"))
    _append_line(lines, "Email", profile.get("email"))
    _append_line(lines, "Mã sinh viên", profile.get("student_code"))
    _append_line(lines, "Khoa", profile.get("faculty"))
    _append_line(lines, "Ngành", profile.get("major"))
    _append_line(lines, "Khóa", profile.get("cohort"))
    _append_line(lines, "GPA", profile.get("gpa"))
    skills = profile.get("skills")
    if skills:
        lines.append(f"- Kỹ năng: {', '.join(skills)}")
    return "\n".join(lines)


def _format_internship(internship: dict[str, Any]) -> str:
    lines = ["Thông tin kỳ thực tập hiện tại/gần nhất:"]
    _append_line(lines, "Công ty", internship.get("company_name"))
    _append_line(lines, "Vị trí", internship.get("position_title"))
    _append_line(lines, "Giảng viên hướng dẫn", internship.get("lecturer_name"))
    _append_line(lines, "Học kỳ", internship.get("semester_name") or internship.get("semester_code"))
    _append_line(lines, "Ngày bắt đầu", _format_date(internship.get("start_date")))
    _append_line(lines, "Ngày kết thúc", _format_date(internship.get("end_date")))
    _append_line(lines, "Trạng thái", _label(internship.get("status")))
    return "\n".join(lines)


def _format_deadlines(deadlines: list[dict[str, Any]]) -> str:
    lines = ["Các deadline sắp tới của bạn:"]
    for row in deadlines:
        title = row.get("title") or "Deadline"
        due_at = _format_datetime(row.get("due_at"))
        status = _label(row.get("status"))
        lines.append(f"- {title}: {due_at}" + (f" ({status})" if status else ""))
    return "\n".join(lines)


def _format_checklist(items: list[dict[str, Any]]) -> str:
    lines = ["Các việc checklist chưa hoàn thành:"]
    for row in items:
        title = row.get("title") or "Việc cần làm"
        due_at = _format_datetime(row.get("due_at")) if row.get("due_at") else "chưa có hạn"
        status = _label(row.get("status"))
        lines.append(f"- {title}: {status or 'chưa rõ trạng thái'}, hạn {due_at}")
    return "\n".join(lines)


def _format_reports(reports: list[dict[str, Any]], pending_only: bool = False) -> str:
    lines = ["Các báo cáo chưa nộp/cần xử lý của bạn:" if pending_only else "Một số báo cáo của bạn:"]
    for row in reports:
        title = row.get("title") or row.get("report_type") or "Báo cáo"
        due_at = _format_datetime(row.get("due_at")) if row.get("due_at") else "chưa có hạn"
        status = _label(row.get("status"))
        lines.append(f"- {title}: {status or 'chưa rõ trạng thái'}, hạn {due_at}")
    return "\n".join(lines)


def _append_line(lines: list[str], label: str, value: Any) -> None:
    if value is not None and value != "":
        lines.append(f"- {label}: {value}")


def _format_date(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _format_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _label(value: Any) -> str:
    if value is None:
        return ""
    raw = str(value)
    return STATUS_LABELS.get(raw, raw)