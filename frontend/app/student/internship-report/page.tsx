"use client";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";

import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Download,
    Eye,
    FileCheck2,
    FileText,
    LoaderCircle,
    Pencil,
    Plus,
    Send,
    Sparkles,
    Trash2,
    UploadCloud,
    X,
} from "lucide-react";

import {
    ChangeEvent,
    FormEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import styles from "./page.module.css";


const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


/* ============================================================
   TYPES
============================================================ */

type ReportType =
    | "WEEKLY"
    | "MIDTERM"
    | "FINAL"
    | "REFLECTION";


type ReportStatus =
    | "DRAFT"
    | "SUBMITTED"
    | "LATE"
    | "UNDER_REVIEW"
    | "REVISION_REQUIRED"
    | "APPROVED";


type AiReviewResult = {
    completeness_score: number;

    summary: string;

    strengths: string[];

    issues: string[];

    suggestions: string[];
};


type ReportItem = {
    id: number;

    report_type: ReportType;

    week_number: number | null;

    title: string;

    content: string | null;

    status: ReportStatus;

    file_name: string | null;

    file_size: number | null;

    mime_type: string | null;

    completion_letter_name: string | null;

    completion_letter_size: number | null;

    due_at: string | null;

    submitted_at: string | null;

    reviewed_at: string | null;

    lecturer_feedback: string | null;

    lecturer_score: number | null;
};


type ReportsResponse = {
    has_internship: boolean;

    reports: ReportItem[];

    statistics: {
        total: number;

        submitted: number;

        under_review: number;

        approved: number;

        progress: number;
    };

    next_deadline: {
        report_id: number;

        title: string;

        report_type: ReportType;

        week_number: number | null;

        due_at: string;
    } | null;
};


type ReportForm = {
    title: string;

    report_type: ReportType;

    week_number: string;

    content: string;
};


const EMPTY_FORM: ReportForm = {
    title: "",

    report_type: "WEEKLY",

    week_number: "",

    content: "",
};


/* ============================================================
   HELPERS
============================================================ */

function reportTypeLabel(
    type: ReportType
) {
    switch (type) {
        case "WEEKLY":
            return "Báo cáo tuần";

        case "MIDTERM":
            return "Mid-term Checkpoint";

        case "FINAL":
            return "Báo cáo kết thúc";

        case "REFLECTION":
            return "Student Reflection";
    }
}


function statusLabel(
    status: ReportStatus
) {
    switch (status) {
        case "DRAFT":
            return "Bản nháp";

        case "SUBMITTED":
            return "Đã nộp";

        case "LATE":
            return "Nộp trễ";

        case "UNDER_REVIEW":
            return "Đang xem xét";

        case "REVISION_REQUIRED":
            return "Cần chỉnh sửa";

        case "APPROVED":
            return "Đã duyệt";
    }
}


function formatDate(
    value: string | null
) {
    if (!value) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "vi-VN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }
    ).format(
        new Date(value)
    );
}


function formatFileSize(
    value: number | null
) {
    if (!value) {
        return "";
    }

    if (
        value <
        1024
    ) {
        return `${value} B`;
    }

    if (
        value <
        1024 * 1024
    ) {
        return `${(
            value /
            1024
        ).toFixed(1)} KB`;
    }

    return `${(
        value /
        (
            1024 *
            1024
        )
    ).toFixed(1)} MB`;
}


/* ============================================================
   PAGE
============================================================ */

export default function ReportsPage() {
    const router =
        useRouter();


    const [
        data,
        setData,
    ] =
        useState<ReportsResponse | null>(
            null
        );


    const [
        loading,
        setLoading,
    ] =
        useState(true);


    const [
        error,
        setError,
    ] =
        useState("");


    const [
        filter,
        setFilter,
    ] =
        useState<
            "ALL" |
            ReportStatus
        >(
            "ALL"
        );


    const [
        form,
        setForm,
    ] =
        useState<ReportForm>(
            EMPTY_FORM
        );


    const [
        reportModalOpen,
        setReportModalOpen,
    ] =
        useState(false);


    const [
        editingReport,
        setEditingReport,
    ] =
        useState<
            ReportItem |
            null
        >(
            null
        );


    const [
        saving,
        setSaving,
    ] =
        useState(false);


    const [
        uploadReport,
        setUploadReport,
    ] =
        useState<
            ReportItem |
            null
        >(
            null
        );


    const [
        uploadLetterReport,
        setUploadLetterReport,
    ] =
        useState<
            ReportItem |
            null
        >(
            null
        );


    const [
        uploadingId,
        setUploadingId,
    ] =
        useState<
            number |
            null
        >(
            null
        );


    const [
        reviewingId,
        setReviewingId,
    ] =
        useState<
            number |
            null
        >(
            null
        );


    const [
        submittingId,
        setSubmittingId,
    ] =
        useState<
            number |
            null
        >(
            null
        );


    /*
     * AI REVIEW CHỈ GIỮ TRONG STATE.
     * KHÔNG LƯU DATABASE.
     */

    const [
        aiReviewReport,
        setAiReviewReport,
    ] =
        useState<
            ReportItem |
            null
        >(
            null
        );


    const [
        aiReviewResult,
        setAiReviewResult,
    ] =
        useState<
            AiReviewResult |
            null
        >(
            null
        );


    const [
        feedbackReport,
        setFeedbackReport,
    ] =
        useState<
            ReportItem |
            null
        >(
            null
        );


    const reportFileInput =
        useRef<HTMLInputElement>(
            null
        );


    const completionLetterInput =
        useRef<HTMLInputElement>(
            null
        );


    /* ========================================================
       AUTH
    ======================================================== */

    function getToken() {
        return localStorage.getItem(
            "internova_access_token"
        );
    }


    function redirectLogin() {
        localStorage.removeItem(
            "internova_access_token"
        );

        localStorage.removeItem(
            "internova_user"
        );

        window.alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");

        router.push(
            "/auth/login"
        );
    }


    /* ========================================================
       LOAD REPORTS
    ======================================================== */

    async function loadReports() {
        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {
            setLoading(true);

            setError("");


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/reports`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        cache:
                            "no-store",
                    }
                );


            const payload =
                await response.json();


            if (
                response.status ===
                401
            ) {
                redirectLogin();

                return;
            }


            if (!response.ok) {
                throw new Error(
                    payload.detail ??
                    "Không thể tải báo cáo."
                );
            }


            setData(
                payload
            );


        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Có lỗi xảy ra."
            );

        } finally {
            setLoading(
                false
            );
        }
    }


    useEffect(
        () => {
            // Initial client-side API synchronization.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void loadReports();
        },
        []
    );


    /* ========================================================
       FILTER
    ======================================================== */

    const filteredReports =
        useMemo(
            () => {
                if (!data) {
                    return [];
                }


                if (
                    filter ===
                    "ALL"
                ) {
                    return data.reports;
                }


                return data.reports.filter(
                    (
                        report
                    ) =>
                        report.status ===
                        filter
                );
            },
            [
                data,
                filter,
            ]
        );


    /* ========================================================
       CREATE
    ======================================================== */

    function openCreateReport() {
        setEditingReport(
            null
        );

        setForm(
            EMPTY_FORM
        );

        setReportModalOpen(
            true
        );
    }


    /* ========================================================
       EDIT
    ======================================================== */

    function openEditReport(
        report: ReportItem
    ) {
        const editable =
            report.status ===
            "DRAFT"
            ||
            report.status ===
            "REVISION_REQUIRED";


        if (!editable) {
            return;
        }


        setEditingReport(
            report
        );


        setForm({
            title:
                report.title,

            report_type:
                report.report_type,

            week_number:
                report.week_number
                    ? String(
                        report.week_number
                    )
                    : "",

            content:
                report.content ??
                "",
        });


        setReportModalOpen(
            true
        );
    }


    function handleFormChange(
        event:
            ChangeEvent<
                HTMLInputElement |
                HTMLTextAreaElement |
                HTMLSelectElement
            >
    ) {
        const {
            name,
            value,
        } =
            event.target;


        setForm(
            (
                previous
            ) => ({
                ...previous,

                [name]:
                    value,
            })
        );
    }


    /* ========================================================
       SAVE CREATE / UPDATE
    ======================================================== */

    async function saveReport(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        if (
            !form.title.trim()
        ) {
            alert(
                "Tiêu đề không được để trống."
            );

            return;
        }


        if (
            form.report_type ===
            "WEEKLY"
            &&
            !form.week_number
        ) {
            alert(
                "Báo cáo tuần cần nhập số tuần."
            );

            return;
        }


        try {
            setSaving(true);


            let response:
                Response;


            if (
                editingReport
            ) {
                response =
                    await fetch(
                        `${API_URL}/api/v1/student/reports/${editingReport.id}`,
                        {
                            method:
                                "PUT",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`,
                            },

                            body:
                                JSON.stringify({
                                    title:
                                        form.title.trim(),

                                    content:
                                        form.content.trim()
                                        ||
                                        null,
                                }),
                        }
                    );

            } else {
                response =
                    await fetch(
                        `${API_URL}/api/v1/student/reports`,
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`,
                            },

                            body:
                                JSON.stringify({
                                    title:
                                        form.title.trim(),

                                    report_type:
                                        form.report_type,

                                    week_number:
                                        (
                                            form.report_type ===
                                                "WEEKLY"
                                                ? Number(
                                                    form.week_number
                                                )
                                                : null
                                        ),

                                    content:
                                        form.content.trim()
                                        ||
                                        null,
                                }),
                        }
                    );
            }


            const payload =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    payload.detail ??
                    "Không thể lưu báo cáo."
                );
            }


            setReportModalOpen(
                false
            );


            await loadReports();


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể lưu báo cáo."
            );

        } finally {
            setSaving(false);
        }
    }


    /* ========================================================
       DELETE
    ======================================================== */

    async function deleteReport(
        report: ReportItem
    ) {
        if (
            report.status !==
            "DRAFT"
        ) {
            return;
        }


        if (
            !window.confirm(
                `Bạn chắc chắn muốn xóa "${report.title}"?`
            )
        ) {
            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        const response =
            await fetch(
                `${API_URL}/api/v1/student/reports/${report.id}`,
                {
                    method:
                        "DELETE",

                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                    },
                }
            );


        const payload =
            await response.json();


        if (!response.ok) {
            alert(
                payload.detail ??
                "Không thể xóa báo cáo."
            );

            return;
        }


        await loadReports();
    }


    /* ========================================================
       REPORT FILE UPLOAD
    ======================================================== */

    function chooseReportFile(
        report: ReportItem
    ) {
        setUploadReport(
            report
        );


        if (
            reportFileInput.current
        ) {
            reportFileInput.current.value =
                "";

            reportFileInput.current.click();
        }
    }


    async function uploadReportFile(
        event:
            ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0];


        if (
            !file ||
            !uploadReport
        ) {
            return;
        }


        if (
            file.size >
            10 *
            1024 *
            1024
        ) {
            alert(
                "File không được vượt quá 10MB."
            );

            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        try {
            setUploadingId(
                uploadReport.id
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/reports/${uploadReport.id}/file`,
                    {
                        method:
                            "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            formData,
                    }
                );


            const payload =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    payload.detail ??
                    "Upload file thất bại."
                );
            }


            await loadReports();


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Upload file thất bại."
            );

        } finally {
            setUploadingId(
                null
            );

            setUploadReport(
                null
            );
        }
    }


    /* ========================================================
       COMPLETION LETTER
    ======================================================== */

    function chooseCompletionLetter(
        report: ReportItem
    ) {
        setUploadLetterReport(
            report
        );


        if (
            completionLetterInput.current
        ) {
            completionLetterInput.current.value =
                "";

            completionLetterInput.current.click();
        }
    }


    async function uploadCompletionLetter(
        event:
            ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0];


        if (
            !file ||
            !uploadLetterReport
        ) {
            return;
        }


        if (
            file.size >
            10 *
            1024 *
            1024
        ) {
            alert(
                "File không được vượt quá 10MB."
            );

            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        try {
            setUploadingId(
                uploadLetterReport.id
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/reports/${uploadLetterReport.id}/completion-letter`,
                    {
                        method:
                            "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            formData,
                    }
                );


            const payload =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    payload.detail ??
                    (
                        "Upload Letter of "
                        + "Completion thất bại."
                    )
                );
            }


            await loadReports();


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : (
                        "Upload Letter of "
                        + "Completion thất bại."
                    )
            );

        } finally {
            setUploadingId(
                null
            );

            setUploadLetterReport(
                null
            );
        }
    }


    /* ========================================================
       VIEW / DOWNLOAD PROTECTED FILE
    ======================================================== */

    async function openProtectedFile(
        url: string,
        filename: string,
        download: boolean
    ) {
        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        const response =
            await fetch(
                url,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                    },
                }
            );


        if (!response.ok) {
            let message =
                "Không thể mở tài liệu.";


            try {
                const payload =
                    await response.json();

                message =
                    payload.detail ??
                    message;

            } catch {
                // giữ message mặc định
            }


            alert(
                message
            );

            return;
        }


        const blob =
            await response.blob();


        const objectUrl =
            URL.createObjectURL(
                blob
            );


        if (download) {
            const link =
                document.createElement(
                    "a"
                );


            link.href =
                objectUrl;


            link.download =
                filename;


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            URL.revokeObjectURL(
                objectUrl
            );


            return;
        }


        window.open(
            objectUrl,
            "_blank"
        );


        window.setTimeout(
            () => {
                URL.revokeObjectURL(
                    objectUrl
                );
            },
            60000
        );
    }


    /* ========================================================
       AI REVIEW
       CHỈ TRẢ RESULT TẠM THỜI
    ======================================================== */

    async function reviewWithAi(
        report: ReportItem
    ) {
        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {
            setReviewingId(
                report.id
            );


            setAiReviewReport(
                null
            );


            setAiReviewResult(
                null
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/reports/${report.id}/ai-review`,
                    {
                        method:
                            "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },
                    }
                );


            const payload =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    payload.detail ??
                    "AI Review thất bại."
                );
            }


            /*
             * CHỈ GIỮ TRONG STATE.
             * KHÔNG SAVE DATABASE.
             */

            setAiReviewResult(
                payload
            );


            setAiReviewReport(
                report
            );


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "AI Review thất bại."
            );

        } finally {
            setReviewingId(
                null
            );
        }
    }


    function closeAiReview() {
        setAiReviewReport(
            null
        );

        setAiReviewResult(
            null
        );
    }


    /* ========================================================
       SUBMIT
    ======================================================== */

    async function submitReport(
        report: ReportItem
    ) {
        const confirmation =
            report.report_type ===
                "FINAL"
                ? (
                    "Final Report cần có Letter of Completion. "
                    + "Bạn chắc chắn muốn nộp?"
                )
                : (
                    report.status ===
                        "REVISION_REQUIRED"
                        ? "Bạn chắc chắn muốn nộp lại báo cáo?"
                        : "Bạn chắc chắn muốn nộp báo cáo?"
                );


        if (
            !window.confirm(
                confirmation
            )
        ) {
            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {
            setSubmittingId(
                report.id
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/reports/${report.id}/submit`,
                    {
                        method:
                            "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },
                    }
                );


            const payload =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    payload.detail ??
                    "Không thể nộp báo cáo."
                );
            }


            await loadReports();


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể nộp báo cáo."
            );

        } finally {
            setSubmittingId(
                null
            );
        }
    }


    /* ========================================================
       LOADING
    ======================================================== */

    if (loading) {
        return (
            <PageState
                loading
                message="Đang tải báo cáo..."
                onRetry={
                    loadReports
                }
            />
        );
    }


    /* ========================================================
       ERROR
    ======================================================== */

    if (
        error ||
        !data
    ) {
        return (
            <PageState
                message={
                    error ||
                    "Không thể tải dữ liệu."
                }
                onRetry={
                    loadReports
                }
            />
        );
    }


    /* ========================================================
       STATS
    ======================================================== */

    const stats = [
        {
            title:
                "Tổng báo cáo",

            value:
                data.statistics.total,

            description:
                "Trong kỳ thực tập",

            icon:
                FileText,
        },

        {
            title:
                "Đã nộp",

            value:
                data.statistics.submitted,

            description:
                "Đã gửi Faculty Mentor",

            icon:
                CheckCircle2,
        },

        {
            title:
                "Đang xem xét",

            value:
                data.statistics.under_review,

            description:
                "Chờ phản hồi",

            icon:
                Clock3,
        },

        {
            title:
                "Tiến độ",

            value:
                `${data.statistics.progress}%`,

            description:
                "Theo các báo cáo đã tạo",

            icon:
                BarChart3,
        },
    ];


    /* ========================================================
       RENDER
    ======================================================== */

    return (
        <div
            className={
                styles.layout
            }
        >
            <Sidebar />


            <div
                className={
                    styles.main
                }
            >
                <Header />


                <input
                    ref={
                        reportFileInput
                    }
                    hidden
                    type="file"
                    accept=".pdf,.docx"
                    onChange={
                        uploadReportFile
                    }
                />


                <input
                    ref={
                        completionLetterInput
                    }
                    hidden
                    type="file"
                    accept=".pdf,.docx,.jpg,.jpeg,.png"
                    onChange={
                        uploadCompletionLetter
                    }
                />


                <main
                    className={
                        styles.reportPage
                    }
                >
                    {/* ======================================
                        HEADER
                    ====================================== */}

                    <section
                        className={
                            styles.pageHeader
                        }
                    >
                        <div>
                            <h1>
                                Báo cáo thực tập
                            </h1>


                            <p>
                                Theo dõi báo cáo trong
                                quá trình thực tập,
                                Mid-term Checkpoint,
                                Final Report và
                                Student Reflection.
                            </p>
                        </div>


                        <button
                            type="button"
                            className={
                                styles.createButton
                            }
                            disabled={
                                !data.has_internship
                            }
                            onClick={
                                openCreateReport
                            }
                        >
                            <Plus
                                size={18}
                            />

                            Tạo báo cáo
                        </button>
                    </section>


                    {/* ======================================
                        POLICY NOTICE
                    ====================================== */}

                    <section
                        className={
                            styles.policyNotice
                        }
                    >
                        <FileCheck2
                            size={21}
                        />


                        <div>
                            <strong>
                                Quy trình báo cáo thực tập
                            </strong>


                            <p>
                                Mid-term Checkpoint dùng
                                để theo dõi tiến độ.
                                Final Report cần Letter
                                of Completion.
                                Student Reflection dùng
                                để phản ánh learning
                                outcomes và trải nghiệm
                                thực tập.
                            </p>
                        </div>
                    </section>


                    {/* ======================================
                        STATS
                    ====================================== */}

                    <section
                        className={
                            styles.statGrid
                        }
                    >
                        {stats.map(
                            ({
                                title,
                                value,
                                description,
                                icon:
                                Icon,
                            }) => (

                                <article
                                    key={
                                        title
                                    }
                                    className={
                                        styles.statCard
                                    }
                                >
                                    <div
                                        className={
                                            styles.statContent
                                        }
                                    >
                                        <p>
                                            {title}
                                        </p>

                                        <strong>
                                            {value}
                                        </strong>

                                        <span>
                                            {description}
                                        </span>
                                    </div>


                                    <span
                                        className={
                                            styles.statIcon
                                        }
                                    >
                                        <Icon
                                            size={23}
                                        />
                                    </span>
                                </article>
                            )
                        )}
                    </section>


                    {/* ======================================
                        CONTENT
                    ====================================== */}

                    <section
                        className={
                            styles.contentGrid
                        }
                    >
                        {/* REPORT LIST */}

                        <article
                            className={
                                styles.reportListCard
                            }
                        >
                            <div
                                className={
                                    styles.cardHeader
                                }
                            >
                                <div>
                                    <h2>
                                        Danh sách báo cáo
                                    </h2>

                                    <p>
                                        Báo cáo thuộc kỳ
                                        thực tập của tài
                                        khoản đang đăng
                                        nhập.
                                    </p>
                                </div>


                                <select
                                    className={
                                        styles.filterSelect
                                    }
                                    value={
                                        filter
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setFilter(event.target.value as "ALL" | ReportStatus)
                                    }
                                >
                                    <option value="ALL">
                                        Tất cả
                                    </option>

                                    <option value="DRAFT">
                                        Bản nháp
                                    </option>

                                    <option value="SUBMITTED">
                                        Đã nộp
                                    </option>

                                    <option value="LATE">
                                        Nộp trễ
                                    </option>

                                    <option value="UNDER_REVIEW">
                                        Đang xem xét
                                    </option>

                                    <option value="REVISION_REQUIRED">
                                        Cần chỉnh sửa
                                    </option>

                                    <option value="APPROVED">
                                        Đã duyệt
                                    </option>
                                </select>
                            </div>


                            {!data.has_internship ? (

                                <EmptyState
                                    title="Chưa có kỳ thực tập"
                                    description={
                                        "Bạn cần có kỳ thực tập "
                                        + "trước khi tạo báo cáo."
                                    }
                                />

                            ) : filteredReports.length ===
                                0 ? (

                                <EmptyState
                                    title="Chưa có báo cáo"
                                    description={
                                        "Tạo báo cáo mới "
                                        + "để bắt đầu."
                                    }
                                />

                            ) : (

                                <div
                                    className={
                                        styles.reportList
                                    }
                                >
                                    {filteredReports.map(
                                        (
                                            report
                                        ) => (

                                            <ReportCard
                                                key={
                                                    report.id
                                                }

                                                report={
                                                    report
                                                }

                                                reviewing={
                                                    reviewingId ===
                                                    report.id
                                                }

                                                uploading={
                                                    uploadingId ===
                                                    report.id
                                                }

                                                submitting={
                                                    submittingId ===
                                                    report.id
                                                }

                                                onEdit={() =>
                                                    openEditReport(
                                                        report
                                                    )
                                                }

                                                onDelete={() =>
                                                    void deleteReport(
                                                        report
                                                    )
                                                }

                                                onUpload={() =>
                                                    chooseReportFile(
                                                        report
                                                    )
                                                }

                                                onView={() =>
                                                    void openProtectedFile(
                                                        `${API_URL}/api/v1/student/reports/${report.id}/file`,
                                                        report.file_name ??
                                                        "report",
                                                        false
                                                    )
                                                }

                                                onDownload={() =>
                                                    void openProtectedFile(
                                                        `${API_URL}/api/v1/student/reports/${report.id}/file?download=true`,
                                                        report.file_name ??
                                                        "report",
                                                        true
                                                    )
                                                }

                                                onAiReview={() =>
                                                    void reviewWithAi(
                                                        report
                                                    )
                                                }

                                                onCompletionLetter={() =>
                                                    chooseCompletionLetter(
                                                        report
                                                    )
                                                }

                                                onViewCompletionLetter={() =>
                                                    void openProtectedFile(
                                                        `${API_URL}/api/v1/student/reports/${report.id}/completion-letter`,
                                                        report.completion_letter_name ??
                                                        "completion-letter",
                                                        false
                                                    )
                                                }

                                                onDownloadCompletionLetter={() =>
                                                    void openProtectedFile(
                                                        `${API_URL}/api/v1/student/reports/${report.id}/completion-letter?download=true`,
                                                        report.completion_letter_name ??
                                                        "completion-letter",
                                                        true
                                                    )
                                                }

                                                onFeedback={() =>
                                                    setFeedbackReport(
                                                        report
                                                    )
                                                }

                                                onSubmit={() =>
                                                    void submitReport(
                                                        report
                                                    )
                                                }
                                            />
                                        )
                                    )}
                                </div>
                            )}
                        </article>


                        {/* SIDE */}

                        <aside
                            className={
                                styles.sideColumn
                            }
                        >
                            <article
                                className={
                                    styles.progressCard
                                }
                            >
                                <div
                                    className={
                                        styles.sideTitle
                                    }
                                >
                                    <BarChart3
                                        size={21}
                                    />

                                    <h2>
                                        Tiến độ báo cáo
                                    </h2>
                                </div>


                                <strong
                                    className={
                                        styles.progressNumber
                                    }
                                >
                                    {
                                        data.statistics
                                            .progress
                                    }
                                    %
                                </strong>


                                <div
                                    className={
                                        styles.progressBar
                                    }
                                >
                                    <div
                                        className={
                                            styles.progressFill
                                        }
                                        style={{
                                            width:
                                                `${data.statistics.progress}%`,
                                        }}
                                    />
                                </div>


                                <div
                                    className={
                                        styles.progressStats
                                    }
                                >
                                    <span>
                                        Đã nộp
                                    </span>

                                    <strong>
                                        {
                                            data.statistics
                                                .submitted
                                        }
                                        /
                                        {
                                            data.statistics
                                                .total
                                        }
                                    </strong>
                                </div>


                                <div
                                    className={
                                        styles.progressStats
                                    }
                                >
                                    <span>
                                        Đã duyệt
                                    </span>

                                    <strong>
                                        {
                                            data.statistics
                                                .approved
                                        }
                                    </strong>
                                </div>
                            </article>


                            <article
                                className={
                                    styles.deadlineCard
                                }
                            >
                                <div
                                    className={
                                        styles.sideTitle
                                    }
                                >
                                    <CalendarDays
                                        size={21}
                                    />

                                    <h2>
                                        Deadline tiếp theo
                                    </h2>
                                </div>


                                {data.next_deadline ? (

                                    <div
                                        className={
                                            styles.deadlineContent
                                        }
                                    >
                                        <strong>
                                            {
                                                data.next_deadline
                                                    .title
                                            }
                                        </strong>

                                        <span>
                                            {reportTypeLabel(
                                                data.next_deadline
                                                    .report_type
                                            )}
                                        </span>

                                        <p>
                                            {formatDate(
                                                data.next_deadline
                                                    .due_at
                                            )}
                                        </p>
                                    </div>

                                ) : (

                                    <div
                                        className={
                                            styles.noDeadline
                                        }
                                    >
                                        <CheckCircle2
                                            size={30}
                                        />

                                        <p>
                                            Chưa có deadline
                                            sắp tới.
                                        </p>
                                    </div>
                                )}
                            </article>


                            <article
                                className={
                                    styles.aiInfoCard
                                }
                            >
                                <Sparkles
                                    size={21}
                                />

                                <h2>
                                    AI Review
                                </h2>


                                <p>
                                    AI chỉ review khi bạn
                                    bấm yêu cầu. Kết quả
                                    không được lưu vào
                                    database và không thay
                                    Faculty Mentor đánh giá.
                                </p>
                            </article>
                        </aside>
                    </section>
                </main>
            </div>


            {/* ==============================================
                REPORT CREATE / EDIT MODAL
            ============================================== */}

            {reportModalOpen && (

                <ReportModal
                    form={
                        form
                    }

                    editing={
                        Boolean(
                            editingReport
                        )
                    }

                    saving={
                        saving
                    }

                    onChange={
                        handleFormChange
                    }

                    onSubmit={
                        saveReport
                    }

                    onClose={() =>
                        setReportModalOpen(
                            false
                        )
                    }
                />
            )}


            {/* ==============================================
                AI REVIEW RESULT
            ============================================== */}

            {aiReviewReport &&
                aiReviewResult && (

                    <AiReviewModal
                        report={
                            aiReviewReport
                        }

                        review={
                            aiReviewResult
                        }

                        onClose={
                            closeAiReview
                        }

                        onEdit={() => {
                            const report =
                                aiReviewReport;


                            closeAiReview();


                            openEditReport(
                                report
                            );
                        }}
                    />
                )}


            {/* ==============================================
                LECTURER FEEDBACK
            ============================================== */}

            {feedbackReport && (

                <FeedbackModal
                    report={
                        feedbackReport
                    }

                    onClose={() =>
                        setFeedbackReport(
                            null
                        )
                    }
                />
            )}
        </div>
    );
}


/* ============================================================
   REPORT CARD
============================================================ */

function ReportCard({
    report,
    reviewing,
    uploading,
    submitting,

    onEdit,
    onDelete,
    onUpload,
    onView,
    onDownload,
    onAiReview,
    onCompletionLetter,
    onViewCompletionLetter,
    onDownloadCompletionLetter,
    onFeedback,
    onSubmit,
}: {
    report: ReportItem;

    reviewing: boolean;

    uploading: boolean;

    submitting: boolean;

    onEdit: () => void;

    onDelete: () => void;

    onUpload: () => void;

    onView: () => void;

    onDownload: () => void;

    onAiReview: () => void;

    onCompletionLetter: () => void;

    onViewCompletionLetter: () => void;

    onDownloadCompletionLetter: () => void;

    onFeedback: () => void;

    onSubmit: () => void;
}) {
    const editable =
        report.status ===
        "DRAFT"
        ||
        report.status ===
        "REVISION_REQUIRED";


    return (
        <article
            className={
                styles.reportCard
            }
        >
            <div
                className={
                    styles.reportCardMain
                }
            >
                <span
                    className={
                        styles.reportIcon
                    }
                >
                    <FileText
                        size={21}
                    />
                </span>


                <div
                    className={
                        styles.reportInformation
                    }
                >
                    <div
                        className={
                            styles.reportTitleRow
                        }
                    >
                        <h3>
                            {report.title}
                        </h3>


                        <span
                            className={`${styles.statusBadge} ${styles[
                                `status_${report.status}`
                            ]
                                }`}
                        >
                            {statusLabel(
                                report.status
                            )}
                        </span>
                    </div>


                    <p
                        className={
                            styles.reportType
                        }
                    >
                        {reportTypeLabel(
                            report.report_type
                        )}

                        {report.week_number
                            ? ` • Tuần ${report.week_number}`
                            : ""}
                    </p>


                    <div
                        className={
                            styles.reportMeta
                        }
                    >
                        <span>
                            Deadline:{" "}
                            {formatDate(
                                report.due_at
                            )}
                        </span>


                        <span>
                            Ngày nộp:{" "}
                            {formatDate(
                                report.submitted_at
                            )}
                        </span>
                    </div>


                    {report.file_name && (

                        <div
                            className={
                                styles.fileInfo
                            }
                        >
                            <FileText
                                size={13}
                            />

                            <span>
                                {
                                    report.file_name
                                }

                                {report.file_size
                                    ? ` • ${formatFileSize(
                                        report.file_size
                                    )}`
                                    : ""}
                            </span>
                        </div>
                    )}


                    {report.report_type ===
                        "FINAL" && (

                            <div
                                className={
                                    report.completion_letter_name
                                        ? styles.letterReady
                                        : styles.letterMissing
                                }
                            >
                                <FileCheck2
                                    size={13}
                                />

                                <span>
                                    Letter of Completion:{" "}

                                    {
                                        report.completion_letter_name
                                        ??
                                        "Chưa tải lên"
                                    }
                                </span>
                            </div>
                        )}


                    {report.status ===
                        "REVISION_REQUIRED"
                        &&
                        report.lecturer_feedback && (

                            <div
                                className={
                                    styles.revisionNotice
                                }
                            >
                                Faculty Mentor yêu cầu
                                chỉnh sửa báo cáo.
                            </div>
                        )}
                </div>
            </div>


            <div
                className={
                    styles.reportActions
                }
            >
                {editable && (

                    <button
                        type="button"
                        title="Chỉnh sửa"
                        onClick={
                            onEdit
                        }
                    >
                        <Pencil
                            size={16}
                        />
                    </button>
                )}


                {editable && (

                    <button
                        type="button"
                        title={
                            report.file_name
                                ? "Thay file"
                                : "Upload file"
                        }
                        disabled={
                            uploading
                        }
                        onClick={
                            onUpload
                        }
                    >
                        {uploading ? (

                            <LoaderCircle
                                size={16}
                                className={
                                    styles.spinner
                                }
                            />

                        ) : (

                            <UploadCloud
                                size={16}
                            />
                        )}
                    </button>
                )}


                {report.file_name && (
                    <>
                        <button
                            type="button"
                            title="Xem file"
                            onClick={
                                onView
                            }
                        >
                            <Eye
                                size={16}
                            />
                        </button>


                        <button
                            type="button"
                            title="Tải file"
                            onClick={
                                onDownload
                            }
                        >
                            <Download
                                size={16}
                            />
                        </button>
                    </>
                )}


                {report.report_type ===
                    "FINAL"
                    &&
                    editable && (

                        <button
                            type="button"
                            title={
                                report.completion_letter_name
                                    ? "Thay Letter of Completion"
                                    : "Upload Letter of Completion"
                            }
                            disabled={
                                uploading
                            }
                            onClick={
                                onCompletionLetter
                            }
                        >
                            <FileCheck2
                                size={16}
                            />
                        </button>
                    )}


                {report.completion_letter_name && (
                    <>
                        <button
                            type="button"
                            title="Xem Letter of Completion"
                            onClick={
                                onViewCompletionLetter
                            }
                        >
                            <Eye
                                size={16}
                            />
                        </button>


                        <button
                            type="button"
                            title="Tải Letter of Completion"
                            onClick={
                                onDownloadCompletionLetter
                            }
                        >
                            <Download
                                size={16}
                            />
                        </button>
                    </>
                )}


                {editable && (

                    <button
                        type="button"
                        title="AI Review"
                        className={
                            styles.aiAction
                        }
                        disabled={
                            reviewing
                        }
                        onClick={
                            onAiReview
                        }
                    >
                        {reviewing ? (

                            <LoaderCircle
                                size={16}
                                className={
                                    styles.spinner
                                }
                            />

                        ) : (

                            <Sparkles
                                size={16}
                            />
                        )}
                    </button>
                )}


                {report.lecturer_feedback && (

                    <button
                        type="button"
                        title="Xem phản hồi Faculty Mentor"
                        className={
                            styles.feedbackAction
                        }
                        onClick={
                            onFeedback
                        }
                    >
                        <CheckCircle2
                            size={16}
                        />
                    </button>
                )}


                {editable && (

                    <button
                        type="button"
                        title={
                            report.status ===
                                "REVISION_REQUIRED"
                                ? "Nộp lại"
                                : "Nộp báo cáo"
                        }
                        className={
                            styles.submitAction
                        }
                        disabled={
                            submitting
                        }
                        onClick={
                            onSubmit
                        }
                    >
                        {submitting ? (

                            <LoaderCircle
                                size={16}
                                className={
                                    styles.spinner
                                }
                            />

                        ) : (

                            <Send
                                size={16}
                            />
                        )}
                    </button>
                )}


                {report.status ===
                    "DRAFT" && (

                        <button
                            type="button"
                            title="Xóa bản nháp"
                            className={
                                styles.deleteAction
                            }
                            onClick={
                                onDelete
                            }
                        >
                            <Trash2
                                size={16}
                            />
                        </button>
                    )}
            </div>
        </article>
    );
}


/* ============================================================
   REPORT MODAL
============================================================ */

function ReportModal({
    form,
    editing,
    saving,
    onChange,
    onSubmit,
    onClose,
}: {
    form: ReportForm;

    editing: boolean;

    saving: boolean;

    onChange: (
        event:
            ChangeEvent<
                HTMLInputElement |
                HTMLTextAreaElement |
                HTMLSelectElement
            >
    ) => void;

    onSubmit: (
        event:
            FormEvent<HTMLFormElement>
    ) => void;

    onClose: () => void;
}) {
    return (
        <div
            className={
                styles.modalOverlay
            }
            onMouseDown={
                onClose
            }
        >
            <form
                className={
                    styles.reportModal
                }
                onSubmit={
                    onSubmit
                }
                onMouseDown={
                    (
                        event
                    ) =>
                        event.stopPropagation()
                }
            >
                <div
                    className={
                        styles.modalHeader
                    }
                >
                    <div>
                        <h2>
                            {editing
                                ? "Chỉnh sửa báo cáo"
                                : "Tạo báo cáo mới"}
                        </h2>


                        <p>
                            Báo cáo được lưu dưới
                            dạng bản nháp cho tới khi
                            bạn chủ động nộp.
                        </p>
                    </div>


                    <button
                        type="button"
                        aria-label="Đóng"
                        onClick={
                            onClose
                        }
                    >
                        <X
                            size={20}
                        />
                    </button>
                </div>


                <div
                    className={
                        styles.reportForm
                    }
                >
                    <label>
                        Tiêu đề

                        <input
                            name="title"
                            value={
                                form.title
                            }
                            onChange={
                                onChange
                            }
                            placeholder="Ví dụ: Mid-term Internship Report"
                            required
                        />
                    </label>


                    {!editing && (

                        <label>
                            Loại báo cáo

                            <select
                                name="report_type"
                                value={
                                    form.report_type
                                }
                                onChange={
                                    onChange
                                }
                            >
                                <option value="WEEKLY">
                                    Báo cáo tuần
                                    (nếu kỳ yêu cầu)
                                </option>

                                <option value="MIDTERM">
                                    Mid-term Checkpoint
                                </option>

                                <option value="FINAL">
                                    Final Report
                                </option>

                                <option value="REFLECTION">
                                    Student Reflection
                                </option>
                            </select>
                        </label>
                    )}


                    {!editing
                        &&
                        form.report_type ===
                        "WEEKLY"
                        && (

                            <label>
                                Tuần

                                <input
                                    name="week_number"
                                    type="number"
                                    min={1}
                                    value={
                                        form.week_number
                                    }
                                    onChange={
                                        onChange
                                    }
                                    placeholder="Ví dụ: 4"
                                    required
                                />
                            </label>
                        )}


                    <label
                        className={
                            styles.fullWidth
                        }
                    >
                        Nội dung báo cáo

                        <textarea
                            name="content"
                            rows={14}
                            value={
                                form.content
                            }
                            onChange={
                                onChange
                            }
                            placeholder={
                                getReportPlaceholder(
                                    form.report_type
                                )
                            }
                        />
                    </label>


                    <div
                        className={
                            styles.aiSupportNotice
                        }
                    >
                        <Sparkles
                            size={18}
                        />

                        <div>
                            <strong>
                                AI Review chỉ hỗ trợ
                            </strong>


                            <p>
                                Sau khi lưu bản nháp,
                                bạn có thể dùng AI
                                Review để kiểm tra nội
                                dung. Kết quả AI chỉ
                                tồn tại trong lần review
                                đó và không lưu DB.
                            </p>
                        </div>
                    </div>
                </div>


                <div
                    className={
                        styles.modalActions
                    }
                >
                    <button
                        type="button"
                        className={
                            styles.secondaryButton
                        }
                        onClick={
                            onClose
                        }
                    >
                        Hủy
                    </button>


                    <button
                        type="submit"
                        className={
                            styles.primaryButton
                        }
                        disabled={
                            saving
                        }
                    >
                        {saving ? (

                            <>
                                <LoaderCircle
                                    size={16}
                                    className={
                                        styles.spinner
                                    }
                                />

                                Đang lưu...
                            </>

                        ) : (

                            <>
                                <CheckCircle2
                                    size={16}
                                />

                                {editing
                                    ? "Lưu thay đổi"
                                    : "Tạo bản nháp"}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}


/* ============================================================
   PLACEHOLDER
============================================================ */

function getReportPlaceholder(
    type: ReportType
) {
    switch (type) {
        case "WEEKLY":
            return (
                "Mô tả công việc trong tuần, "
                + "kết quả đạt được, khó khăn, "
                + "bài học và kế hoạch tiếp theo..."
            );

        case "MIDTERM":
            return (
                "Mô tả tiến độ internship, "
                + "công việc đã hoàn thành, "
                + "kết quả hiện tại, khó khăn, "
                + "kỹ năng đã học và kế hoạch "
                + "cho giai đoạn tiếp theo..."
            );

        case "FINAL":
            return (
                "Tổng kết internship: mục tiêu, "
                + "công việc đã thực hiện, kết quả, "
                + "kỹ năng/kiến thức học được, "
                + "khó khăn và bài học..."
            );

        case "REFLECTION":
            return (
                "Phản ánh learning outcomes, "
                + "điều học được, sự phát triển "
                + "cá nhân, nghề nghiệp và những "
                + "điều bạn sẽ làm khác trong tương lai..."
            );
    }
}


/* ============================================================
   AI REVIEW MODAL
============================================================ */

function AiReviewModal({
    report,
    review,
    onClose,
    onEdit,
}: {
    report: ReportItem;

    review: AiReviewResult;

    onClose: () => void;

    onEdit: () => void;
}) {
    return (
        <div
            className={
                styles.modalOverlay
            }
            onMouseDown={
                onClose
            }
        >
            <section
                className={
                    styles.aiReviewModal
                }
                onMouseDown={
                    (
                        event
                    ) =>
                        event.stopPropagation()
                }
            >
                <div
                    className={
                        styles.modalHeader
                    }
                >
                    <div>
                        <h2>
                            AI Review
                        </h2>

                        <p>
                            {report.title}
                        </p>
                    </div>


                    <button
                        type="button"
                        aria-label="Đóng"
                        onClick={
                            onClose
                        }
                    >
                        <X
                            size={20}
                        />
                    </button>
                </div>


                <div
                    className={
                        styles.aiReviewBody
                    }
                >
                    <div
                        className={
                            styles.aiDisclaimer
                        }
                    >
                        <Sparkles
                            size={18}
                        />

                        <div>
                            <strong>
                                Kết quả tạm thời
                            </strong>

                            <p>
                                Kết quả này chỉ tồn tại
                                trong lần review hiện
                                tại. Khi đóng cửa sổ,
                                frontend sẽ xóa kết quả
                                khỏi state và database
                                không lưu gì.
                            </p>
                        </div>
                    </div>


                    <div
                        className={
                            styles.aiScore
                        }
                    >
                        <div>
                            <span>
                                Mức độ hoàn thiện
                            </span>

                            <p>
                                Không phải điểm học tập
                            </p>
                        </div>


                        <strong>
                            {
                                review
                                    .completeness_score
                            }
                            /100
                        </strong>
                    </div>


                    <ReviewSection
                        title="Nhận xét tổng quan"
                        items={[
                            review.summary
                        ]}
                        type="summary"
                    />


                    <ReviewSection
                        title="Điểm tốt"
                        items={
                            review.strengths
                        }
                        type="good"
                    />


                    <ReviewSection
                        title="Phần cần cải thiện"
                        items={
                            review.issues
                        }
                        type="warning"
                    />


                    <ReviewSection
                        title="Gợi ý chỉnh sửa"
                        items={
                            review.suggestions
                        }
                        type="suggestion"
                    />
                </div>


                <div
                    className={
                        styles.modalActions
                    }
                >
                    <button
                        type="button"
                        className={
                            styles.secondaryButton
                        }
                        onClick={
                            onClose
                        }
                    >
                        Đóng
                    </button>


                    <button
                        type="button"
                        className={
                            styles.primaryButton
                        }
                        onClick={
                            onEdit
                        }
                    >
                        <Pencil
                            size={16}
                        />

                        Quay lại chỉnh sửa
                    </button>
                </div>
            </section>
        </div>
    );
}


/* ============================================================
   REVIEW SECTION
============================================================ */

function ReviewSection({
    title,
    items,
    type,
}: {
    title: string;

    items: string[];

    type:
    | "summary"
    | "good"
    | "warning"
    | "suggestion";
}) {
    if (
        items.length ===
        0
    ) {
        return null;
    }


    const className =
        type ===
            "good"
            ? styles.reviewGood

            : type ===
                "warning"
                ? styles.reviewWarning

                : type ===
                    "suggestion"
                    ? styles.reviewSuggestion

                    : styles.reviewSummary;


    return (
        <section
            className={`${styles.reviewSection} ${className}`}
        >
            <h3>
                {title}
            </h3>


            <ul>
                {items.map(
                    (
                        item,
                        index
                    ) => (

                        <li
                            key={
                                `${type}-${index}`
                            }
                        >
                            {item}
                        </li>
                    )
                )}
            </ul>
        </section>
    );
}


/* ============================================================
   FEEDBACK MODAL
============================================================ */

function FeedbackModal({
    report,
    onClose,
}: {
    report: ReportItem;

    onClose: () => void;
}) {
    return (
        <div
            className={
                styles.modalOverlay
            }
            onMouseDown={
                onClose
            }
        >
            <section
                className={
                    styles.feedbackModal
                }
                onMouseDown={
                    (
                        event
                    ) =>
                        event.stopPropagation()
                }
            >
                <div
                    className={
                        styles.modalHeader
                    }
                >
                    <div>
                        <h2>
                            Phản hồi Faculty Mentor
                        </h2>

                        <p>
                            {report.title}
                        </p>
                    </div>


                    <button
                        type="button"
                        aria-label="Đóng"
                        onClick={
                            onClose
                        }
                    >
                        <X
                            size={20}
                        />
                    </button>
                </div>


                <div
                    className={
                        styles.feedbackBody
                    }
                >
                    {report.lecturer_score !==
                        null && (

                            <div
                                className={
                                    styles.lecturerScore
                                }
                            >
                                <span>
                                    Điểm đánh giá
                                </span>

                                <strong>
                                    {
                                        report
                                            .lecturer_score
                                    }
                                </strong>
                            </div>
                        )}


                    <section
                        className={
                            styles.feedbackText
                        }
                    >
                        <h3>
                            Nhận xét
                        </h3>

                        <p>
                            {
                                report
                                    .lecturer_feedback
                                ??
                                "Chưa có phản hồi."
                            }
                        </p>
                    </section>
                </div>
            </section>
        </div>
    );
}


/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
    title,
    description,
}: {
    title: string;

    description: string;
}) {
    return (
        <div
            className={
                styles.emptyState
            }
        >
            <FileText
                size={38}
            />

            <h3>
                {title}
            </h3>

            <p>
                {description}
            </p>
        </div>
    );
}


/* ============================================================
   PAGE STATE
============================================================ */

function PageState({
    message,
    loading = false,
    onRetry,
}: {
    message: string;

    loading?: boolean;

    onRetry:
    () => Promise<void>;
}) {
    return (
        <div
            className={
                styles.layout
            }
        >
            <Sidebar />


            <div
                className={
                    styles.main
                }
            >
                <Header />


                <main
                    className={
                        styles.statePage
                    }
                >
                    {loading ? (

                        <LoaderCircle
                            size={35}
                            className={
                                styles.spinner
                            }
                        />

                    ) : (

                        <AlertTriangle
                            size={35}
                        />
                    )}


                    <p>
                        {message}
                    </p>


                    {!loading && (

                        <button
                            type="button"
                            onClick={() =>
                                void onRetry()
                            }
                        >
                            Thử lại
                        </button>
                    )}
                </main>
            </div>
        </div>
    );
}
