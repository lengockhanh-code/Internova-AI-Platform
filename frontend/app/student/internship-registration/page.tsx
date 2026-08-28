"use client";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";

import {
    ArrowLeft,
    ArrowRight,
    Bot,
    Building2,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    Eye,
    FileText,
    GraduationCap,
    Info,
    LoaderCircle,
    Mail,
    MapPin,
    Paperclip,
    Phone,
    Sparkles,
    Trash2,
    UploadCloud,
    UserRound,
} from "lucide-react";

import {
    ChangeEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { useRouter } from "next/navigation";

import styles from "./page.module.css";


const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


type RegistrationForm = {
    fullName: string;
    studentCode: string;
    email: string;
    phone: string;
    faculty: string;
    major: string;
    cohort: string;
    credits: string;

    companyName: string;
    industry: string;
    companyAddress: string;
    companyWebsite: string;

    internshipPosition: string;
    jobDescription: string;
    workMode: string;
    startDate: string;
    endDate: string;

    mentorName: string;
    mentorPosition: string;
    mentorEmail: string;
    mentorPhone: string;
};


type RegistrationDocument = {
    id: number;

    documentType: string;

    title: string;

    originalFileName: string;

    fileSize: number;

    mimeType: string;
};


type RegistrationResponse = {
    student: {
        id: number;

        fullName: string;

        studentCode: string | null;

        email: string;

        phone: string | null;

        faculty: string | null;

        major: string | null;

        cohort: string | null;
    };

    application: {
        id: number;

        status: string;

        credits: number | null;

        companyName: string | null;

        industry: string | null;

        companyAddress: string | null;

        companyWebsite: string | null;

        internshipPosition: string | null;

        jobDescription: string | null;

        workMode: string | null;

        startDate: string | null;

        endDate: string | null;

        mentorName: string | null;

        mentorPosition: string | null;

        mentorEmail: string | null;

        mentorPhone: string | null;

        submittedAt: string | null;
    } | null;

    documents: RegistrationDocument[];
};


const initialForm: RegistrationForm = {
    fullName: "",
    studentCode: "",
    email: "",
    phone: "",
    faculty: "",
    major: "",
    cohort: "",
    credits: "3",

    companyName: "",
    industry: "",
    companyAddress: "",
    companyWebsite: "",

    internshipPosition: "",
    jobDescription: "",
    workMode: "onsite",
    startDate: "",
    endDate: "",

    mentorName: "",
    mentorPosition: "",
    mentorEmail: "",
    mentorPhone: "",
};


const steps = [
    {
        number: 1,
        title: "Sinh viên",
        description: "Thông tin cá nhân",
        icon: GraduationCap,
    },
    {
        number: 2,
        title: "Doanh nghiệp",
        description: "Thông tin công ty",
        icon: Building2,
    },
    {
        number: 3,
        title: "Thực tập",
        description: "Vị trí và thời gian",
        icon: CalendarDays,
    },
    {
        number: 4,
        title: "Mentor",
        description: "Người hướng dẫn",
        icon: UserRound,
    },
    {
        number: 5,
        title: "Xác nhận",
        description: "Kiểm tra và gửi",
        icon: CheckCircle2,
    },
];


export default function InternshipRegistrationPage() {
    const router = useRouter();

    const [currentStep, setCurrentStep] =
        useState(1);

    const [form, setForm] =
        useState<RegistrationForm>(
            initialForm
        );

    const [applicationId, setApplicationId] =
        useState<number | null>(
            null
        );

    const [
        applicationStatus,
        setApplicationStatus,
    ] =
        useState("DRAFT");

    const [documents, setDocuments] =
        useState<RegistrationDocument[]>(
            []
        );

    const [confirmed, setConfirmed] =
        useState(false);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState("");

    const [aiPrompt, setAiPrompt] =
        useState("");

    const [showAiPanel, setShowAiPanel] =
        useState(false);

    const [aiLoading, setAiLoading] =
        useState(false);

    const progress = useMemo(() => {
        return (
            (currentStep - 1) /
            (steps.length - 1)
        ) * 100;
    }, [currentStep]);


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
       LOAD
    ======================================================== */

    async function loadRegistration() {
        const token = getToken();

        if (!token) {
            redirectLogin();
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_URL}/api/v1/student/internship-registration`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                    },

                    cache: "no-store",
                }
            );

            const data =
                (await response.json()) as
                RegistrationResponse & {
                    detail?: string;
                };


            if (
                response.status ===
                401
            ) {
                redirectLogin();
                return;
            }


            if (!response.ok) {
                throw new Error(
                    data.detail ??
                    "Không thể tải hồ sơ đăng ký."
                );
            }


            setForm({
                fullName:
                    data.student.fullName ??
                    "",

                studentCode:
                    data.student.studentCode ??
                    "",

                email:
                    data.student.email ??
                    "",

                phone:
                    data.student.phone ??
                    "",

                faculty:
                    data.student.faculty ??
                    "",

                major:
                    data.student.major ??
                    "",

                cohort:
                    data.student.cohort ??
                    "",

                credits:
                    String(
                        data.application
                            ?.credits ??
                        3
                    ),

                companyName:
                    data.application
                        ?.companyName ??
                    "",

                industry:
                    data.application
                        ?.industry ??
                    "",

                companyAddress:
                    data.application
                        ?.companyAddress ??
                    "",

                companyWebsite:
                    data.application
                        ?.companyWebsite ??
                    "",

                internshipPosition:
                    data.application
                        ?.internshipPosition ??
                    "",

                jobDescription:
                    data.application
                        ?.jobDescription ??
                    "",

                workMode:
                    (
                        data.application
                            ?.workMode ??
                        "ONSITE"
                    ).toLowerCase(),

                startDate:
                    data.application
                        ?.startDate ??
                    "",

                endDate:
                    data.application
                        ?.endDate ??
                    "",

                mentorName:
                    data.application
                        ?.mentorName ??
                    "",

                mentorPosition:
                    data.application
                        ?.mentorPosition ??
                    "",

                mentorEmail:
                    data.application
                        ?.mentorEmail ??
                    "",

                mentorPhone:
                    data.application
                        ?.mentorPhone ??
                    "",
            });


            setApplicationId(
                data.application?.id ??
                null
            );


            setApplicationStatus(
                data.application
                    ?.status ??
                "DRAFT"
            );


            setDocuments(
                data.documents ??
                []
            );

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Có lỗi xảy ra."
            );

        } finally {
            setLoading(false);
        }
    }


    useEffect(() => {
        // Initial client-side API synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadRegistration();
    }, []);


    /* ========================================================
       FORM
    ======================================================== */

    function handleChange(
        event:
            | ChangeEvent<HTMLInputElement>
            | ChangeEvent<HTMLTextAreaElement>
            | ChangeEvent<HTMLSelectElement>
    ) {
        const {
            name,
            value,
        } = event.target;


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
       VALIDATION
    ======================================================== */

    function validateCurrentForm() {
        if (
            currentStep >= 2 &&
            !form.companyName.trim()
        ) {
            alert(
                "Vui lòng nhập tên doanh nghiệp."
            );

            return false;
        }


        if (
            currentStep >= 3 &&
            !form.internshipPosition.trim()
        ) {
            alert(
                "Vui lòng nhập vị trí thực tập."
            );

            return false;
        }


        if (
            currentStep >= 3 &&
            (
                !form.startDate ||
                !form.endDate
            )
        ) {
            alert(
                "Vui lòng nhập thời gian thực tập."
            );

            return false;
        }


        if (
            form.startDate &&
            form.endDate &&
            new Date(
                form.endDate
            ) <=
            new Date(
                form.startDate
            )
        ) {
            alert(
                "Ngày kết thúc phải sau ngày bắt đầu."
            );

            return false;
        }


        if (
            currentStep >= 4 &&
            !form.mentorName.trim()
        ) {
            alert(
                "Vui lòng nhập tên mentor."
            );

            return false;
        }


        return true;
    }


    /* ========================================================
       SAVE DRAFT
    ======================================================== */

    async function saveDraft() {
        if (
            applicationStatus !==
            "DRAFT" &&
            applicationStatus !==
            "REJECTED"
        ) {
            return true;
        }


        if (!validateCurrentForm()) {
            return false;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return false;
        }


        try {
            setSaving(
                true
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/internship-registration/draft`,
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
                                credits:
                                    Number(
                                        form.credits
                                    ),

                                companyName:
                                    form.companyName,

                                industry:
                                    form.industry ||
                                    null,

                                companyAddress:
                                    form.companyAddress ||
                                    null,

                                companyWebsite:
                                    form.companyWebsite ||
                                    null,

                                internshipPosition:
                                    form.internshipPosition,

                                jobDescription:
                                    form.jobDescription ||
                                    null,

                                workMode:
                                    form.workMode,

                                startDate:
                                    form.startDate,

                                endDate:
                                    form.endDate,

                                mentorName:
                                    form.mentorName,

                                mentorPosition:
                                    form.mentorPosition ||
                                    null,

                                mentorEmail:
                                    form.mentorEmail ||
                                    null,

                                mentorPhone:
                                    form.mentorPhone ||
                                    null,
                            }),
                    }
                );


            const data =
                await response.json();


            if (
                response.status ===
                401
            ) {
                redirectLogin();

                return false;
            }


            if (!response.ok) {
                throw new Error(
                    data.detail ??
                    "Không thể lưu hồ sơ."
                );
            }


            setApplicationId(
                data.application
                    ?.id ??
                applicationId
            );


            setApplicationStatus(
                data.application
                    ?.status ??
                "DRAFT"
            );


            setDocuments(
                data.documents ??
                documents
            );


            return true;

        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể lưu hồ sơ."
            );

            return false;

        } finally {
            setSaving(
                false
            );
        }
    }


    /* ========================================================
       NEXT / BACK
    ======================================================== */

    async function goToNextStep() {
        if (
            currentStep === 1
        ) {
            setCurrentStep(2);
            return;
        }


        const saved =
            await saveDraft();


        if (!saved) {
            return;
        }


        setCurrentStep(
            (
                previous
            ) =>
                Math.min(
                    previous + 1,
                    steps.length
                )
        );
    }


    function goToPreviousStep() {
        setCurrentStep(
            (
                previous
            ) =>
                Math.max(
                    previous - 1,
                    1
                )
        );
    }


    /* ========================================================
       STEP CLICK
    ======================================================== */

    async function goToStep(
        stepNumber: number
    ) {
        if (
            stepNumber >
            currentStep
        ) {
            if (
                currentStep >
                1
            ) {
                const saved =
                    await saveDraft();

                if (!saved) {
                    return;
                }
            }
        }

        setCurrentStep(
            stepNumber
        );
    }


    /* ========================================================
       SUBMIT
    ======================================================== */

    async function handleSubmit() {
        if (!confirmed) {
            alert(
                "Bạn cần xác nhận thông tin trước khi gửi đăng ký."
            );

            return;
        }


        const saved =
            await saveDraft();


        if (!saved) {
            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {
            setSubmitting(
                true
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/internship-registration/submit`,
                    {
                        method:
                            "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.detail ??
                    "Không thể gửi đăng ký."
                );
            }


            setApplicationStatus(
                data.application
                    ?.status ??
                "SUBMITTED"
            );


            setConfirmed(
                false
            );


            alert(
                "Đã gửi đăng ký thành công."
            );


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể gửi đăng ký."
            );

        } finally {
            setSubmitting(
                false
            );
        }
    }


    /* ========================================================
       DELETE DRAFT
    ======================================================== */

    async function deleteDraft() {
        if (
            applicationStatus !==
            "DRAFT"
        ) {
            return;
        }


        if (
            !window.confirm(
                "Bạn có chắc muốn xóa toàn bộ bản nháp đăng ký?"
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
                `${API_URL}/api/v1/student/internship-registration`,
                {
                    method:
                        "DELETE",

                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                    },
                }
            );


        const data =
            await response.json();


        if (!response.ok) {
            alert(
                data.detail ??
                "Không thể xóa bản nháp."
            );

            return;
        }


        setApplicationId(
            null
        );

        setApplicationStatus(
            "DRAFT"
        );

        setDocuments(
            []
        );


        setForm(
            (
                previous
            ) => ({
                ...initialForm,

                fullName:
                    previous.fullName,

                studentCode:
                    previous.studentCode,

                email:
                    previous.email,

                phone:
                    previous.phone,

                faculty:
                    previous.faculty,

                major:
                    previous.major,

                cohort:
                    previous.cohort,
            })
        );


        setCurrentStep(
            1
        );
    }


    /* ========================================================
       AI EXTRACT
    ======================================================== */

    async function applyAiData() {
        if (
            !aiPrompt.trim()
        ) {
            alert(
                "Hãy nhập mô tả thông tin thực tập."
            );

            return;
        }


        /*
         * Hiện tại không dùng dữ liệu giả ABC Tech nữa.
         *
         * Endpoint AI riêng sẽ được nối sau:
         * POST /api/v1/student/internship-registration/ai-extract
         *
         * Không tự điền dữ liệu mẫu.
         */

        try {
            setAiLoading(
                true
            );

            alert(
                "Chức năng AI Extract chưa được nối endpoint backend. Form sẽ không tự sinh dữ liệu giả."
            );

        } finally {
            setAiLoading(
                false
            );
        }
    }


    /* ========================================================
       LOADING
    ======================================================== */

    if (loading) {
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
                        <LoaderCircle
                            size={34}
                            className={
                                styles.spinner
                            }
                        />

                        <p>
                            Đang tải hồ sơ
                            đăng ký...
                        </p>
                    </main>
                </div>
            </div>
        );
    }


    if (error) {
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
                        <Info
                            size={35}
                        />

                        <h2>
                            Không thể tải
                            hồ sơ
                        </h2>

                        <p>
                            {error}
                        </p>

                        <button
                            onClick={() =>
                                void loadRegistration()
                            }
                        >
                            Thử lại
                        </button>
                    </main>
                </div>
            </div>
        );
    }


    const isEditable =
        applicationStatus ===
        "DRAFT" ||
        applicationStatus ===
        "REJECTED";


    return (
        <div className={styles.layout}>
            <Sidebar />

            <div className={styles.main}>
                <Header />

                <main
                    className={
                        styles.registrationPage
                    }
                >
                    {/* HEADER */}

                    <section
                        className={
                            styles.pageHeader
                        }
                    >
                        <div>
                            <div
                                className={
                                    styles.titleRow
                                }
                            >
                                <span
                                    className={
                                        styles.titleIcon
                                    }
                                >
                                    <FileText
                                        size={28}
                                    />
                                </span>

                                <div>
                                    <h1>
                                        Đăng ký học
                                        phần thực tập
                                    </h1>

                                    <p>
                                        Khai báo thông
                                        tin doanh
                                        nghiệp, vị
                                        trí, mentor và
                                        thời gian thực
                                        tập.
                                    </p>
                                </div>
                            </div>
                        </div>


                        <div
                            className={
                                styles.headerActions
                            }
                        >
                            {applicationId &&
                                applicationStatus ===
                                "DRAFT" && (
                                    <button
                                        type="button"
                                        className={
                                            styles.deleteDraftButton
                                        }
                                        onClick={() =>
                                            void deleteDraft()
                                        }
                                    >
                                        <Trash2
                                            size={17}
                                        />

                                        Xóa bản nháp
                                    </button>
                                )}



                        </div>
                    </section>


                    {/* STEPS */}

                    <section
                        className={
                            styles.stepCard
                        }
                    >
                        <div
                            className={
                                styles.stepProgress
                            }
                        >
                            <div
                                className={
                                    styles.stepProgressFill
                                }
                                style={{
                                    width:
                                        `${progress}%`,
                                }}
                            />
                        </div>


                        <div
                            className={
                                styles.stepList
                            }
                        >
                            {steps.map(
                                (
                                    step
                                ) => {
                                    const Icon =
                                        step.icon;

                                    const isActive =
                                        step.number ===
                                        currentStep;

                                    const isCompleted =
                                        step.number <
                                        currentStep;


                                    return (
                                        <button
                                            key={
                                                step.number
                                            }
                                            type="button"
                                            className={`${styles.stepItem} ${isActive
                                                ? styles.stepActive
                                                : ""
                                                } ${isCompleted
                                                    ? styles.stepCompleted
                                                    : ""
                                                }`}
                                            onClick={() =>
                                                void goToStep(
                                                    step.number
                                                )
                                            }
                                        >
                                            <span
                                                className={
                                                    styles.stepIcon
                                                }
                                            >
                                                {isCompleted ? (
                                                    <Check
                                                        size={
                                                            18
                                                        }
                                                    />
                                                ) : (
                                                    <Icon
                                                        size={
                                                            18
                                                        }
                                                    />
                                                )}
                                            </span>


                                            <span
                                                className={
                                                    styles.stepText
                                                }
                                            >
                                                <strong>
                                                    {
                                                        step.title
                                                    }
                                                </strong>

                                                <small>
                                                    {
                                                        step.description
                                                    }
                                                </small>
                                            </span>
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </section>


                    {/* FORM */}

                    <section
                        className={
                            styles.formLayout
                        }
                    >
                        <div
                            className={
                                styles.formCard
                            }
                        >

                            {currentStep ===
                                1 && (
                                    <StudentInformationStep
                                        form={
                                            form
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    />
                                )}


                            {currentStep ===
                                2 && (
                                    <CompanyInformationStep
                                        form={
                                            form
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        documents={
                                            documents
                                        }
                                        onRefresh={
                                            loadRegistration
                                        }
                                        onSaveDraft={
                                            saveDraft
                                        }
                                        disabled={
                                            !isEditable
                                        }
                                    />
                                )}


                            {currentStep ===
                                3 && (
                                    <InternshipInformationStep
                                        form={
                                            form
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        documents={
                                            documents
                                        }
                                        onRefresh={
                                            loadRegistration
                                        }
                                        onSaveDraft={
                                            saveDraft
                                        }
                                        disabled={
                                            !isEditable
                                        }
                                    />
                                )}


                            {currentStep ===
                                4 && (
                                    <MentorInformationStep
                                        form={
                                            form
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    />
                                )}


                            {currentStep ===
                                5 && (
                                    <ReviewStep
                                        form={
                                            form
                                        }
                                        status={
                                            applicationStatus
                                        }
                                        confirmed={
                                            confirmed
                                        }
                                        onConfirmedChange={
                                            setConfirmed
                                        }
                                    />
                                )}


                            <div
                                className={
                                    styles.formActions
                                }
                            >
                                <button
                                    type="button"
                                    className={
                                        styles.secondaryButton
                                    }
                                    onClick={
                                        goToPreviousStep
                                    }
                                    disabled={
                                        currentStep ===
                                        1
                                    }
                                >
                                    <ArrowLeft
                                        size={17}
                                    />

                                    Quay lại
                                </button>


                                {currentStep <
                                    steps.length ? (
                                    <button
                                        type="button"
                                        className={
                                            styles.primaryButton
                                        }
                                        onClick={() =>
                                            void goToNextStep()
                                        }
                                        disabled={
                                            saving
                                        }
                                    >
                                        {saving
                                            ? "Đang lưu..."
                                            : "Tiếp tục"}

                                        <ArrowRight
                                            size={
                                                17
                                            }
                                        />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className={
                                            styles.submitButton
                                        }
                                        onClick={() =>
                                            void handleSubmit()
                                        }
                                        disabled={
                                            submitting ||
                                            !confirmed ||
                                            applicationStatus ===
                                            "SUBMITTED" ||
                                            applicationStatus ===
                                            "UNDER_REVIEW" ||
                                            applicationStatus ===
                                            "APPROVED"
                                        }
                                    >
                                        {submitting ? (
                                            <LoaderCircle
                                                size={
                                                    17
                                                }
                                                className={
                                                    styles.spinner
                                                }
                                            />
                                        ) : (
                                            <CheckCircle2
                                                size={
                                                    17
                                                }
                                            />
                                        )}


                                        {submitting
                                            ? "Đang gửi..."
                                            : applicationStatus ===
                                                "SUBMITTED" ||
                                                applicationStatus ===
                                                "UNDER_REVIEW"
                                                ? "Đã gửi đăng ký"
                                                : applicationStatus ===
                                                    "APPROVED"
                                                    ? "Đã được duyệt"
                                                    : "Gửi đăng ký"}
                                    </button>
                                )}
                            </div>
                        </div>


                        {/* SIDEBAR STATUS */}

                        <aside
                            className={
                                styles.sideColumn
                            }
                        >
                            <article
                                className={
                                    styles.statusCard
                                }
                            >
                                <div
                                    className={
                                        styles.sideCardHeader
                                    }
                                >
                                    <Info
                                        size={20}
                                    />

                                    <h2>
                                        Trạng thái
                                        đăng ký
                                    </h2>
                                </div>


                                <span
                                    className={
                                        styles.statusBadge
                                    }
                                >
                                    {getStatusLabel(
                                        applicationStatus
                                    )}
                                </span>


                                <div
                                    className={
                                        styles.statusTimeline
                                    }
                                >
                                    <TimelineItem
                                        title="Tạo hồ sơ đăng ký"
                                        description={
                                            applicationId
                                                ? "Bản nháp đã được lưu trong hệ thống."
                                                : "Khởi tạo hồ sơ thực tập."
                                        }
                                        state={
                                            applicationId
                                                ? "completed"
                                                : "active"
                                        }
                                    />


                                    <TimelineItem
                                        title="Gửi đăng ký"
                                        description="Gửi hồ sơ để giảng viên phụ trách kiểm tra."
                                        state={
                                            [
                                                "SUBMITTED",
                                                "UNDER_REVIEW",
                                                "APPROVED",
                                            ].includes(
                                                applicationStatus
                                            )
                                                ? "completed"
                                                : applicationId
                                                    ? "active"
                                                    : "pending"
                                        }
                                    />


                                    <TimelineItem
                                        title="Giảng viên duyệt"
                                        description="Nhận kết quả duyệt hoặc yêu cầu bổ sung."
                                        state={
                                            applicationStatus ===
                                            "APPROVED"
                                                ? "completed"
                                                : [
                                                    "SUBMITTED",
                                                    "UNDER_REVIEW",
                                                ].includes(
                                                    applicationStatus
                                                )
                                                    ? "active"
                                                    : "pending"
                                        }
                                    />
                                </div>
                            </article>


                            <article
                                className={
                                    styles.requirementCard
                                }
                            >
                                <div
                                    className={
                                        styles.sideCardHeader
                                    }
                                >
                                    <Paperclip
                                        size={20}
                                    />

                                    <h2>
                                        Tài liệu
                                        cần chuẩn bị
                                    </h2>
                                </div>


                                <ul
                                    className={
                                        styles.requirementList
                                    }
                                >
                                    <RequirementItem
                                        label="CV cá nhân"
                                        completed={documents.some(
                                            (
                                                item
                                            ) =>
                                                item.documentType ===
                                                "CV"
                                        )}
                                    />

                                    <RequirementItem
                                        label="Job Description"
                                        completed={documents.some(
                                            (
                                                item
                                            ) =>
                                                item.documentType ===
                                                "JOB_DESCRIPTION"
                                        )}
                                    />

                                    <RequirementItem
                                        label="Offer Letter hoặc giấy xác nhận"
                                        completed={documents.some(
                                            (
                                                item
                                            ) =>
                                                item.documentType ===
                                                "OFFER_LETTER"
                                        )}
                                    />

                                    <RequirementItem
                                        label="Thông tin mentor doanh nghiệp"
                                        completed={
                                            Boolean(
                                                form.mentorName &&
                                                form.mentorEmail
                                            )
                                        }
                                    />
                                </ul>
                            </article>
                        </aside>
                    </section>
                </main>
            </div>


            {/* AI PANEL */}

            {showAiPanel && (
                <div
                    className={
                        styles.aiOverlay
                    }
                    onMouseDown={() =>
                        setShowAiPanel(
                            false
                        )
                    }
                >
                    <section
                        className={
                            styles.aiPanel
                        }
                        onMouseDown={(
                            event
                        ) =>
                            event.stopPropagation()
                        }
                    >
                        <div
                            className={
                                styles.aiPanelHeader
                            }
                        >
                            <div
                                className={
                                    styles.aiPanelTitle
                                }
                            >
                                <span
                                    className={
                                        styles.aiPanelIcon
                                    }
                                >
                                    <Bot
                                        size={22}
                                    />
                                </span>

                                <div>
                                    <h2>
                                        Internova AI
                                    </h2>

                                    <p>
                                        Trợ lý điền
                                        hồ sơ thực
                                        tập
                                    </p>
                                </div>
                            </div>


                            <button
                                type="button"
                                className={
                                    styles.closeButton
                                }
                                onClick={() =>
                                    setShowAiPanel(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>
                        </div>


                        <div
                            className={
                                styles.aiPanelBody
                            }
                        >
                            <div
                                className={
                                    styles.aiMessage
                                }
                            >
                                <Bot
                                    size={18}
                                />

                                <p>
                                    Hãy mô tả nơi
                                    thực tập, vị trí,
                                    thời gian và
                                    mentor.
                                </p>
                            </div>


                            <textarea
                                value={
                                    aiPrompt
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAiPrompt(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                placeholder="Ví dụ: Tôi thực tập tại FPT Software..."
                            />
                        </div>


                        <div
                            className={
                                styles.aiPanelFooter
                            }
                        >
                            <button
                                type="button"
                                className={
                                    styles.secondaryButton
                                }
                                onClick={() =>
                                    setShowAiPanel(
                                        false
                                    )
                                }
                            >
                                Hủy
                            </button>


                            <button
                                type="button"
                                className={
                                    styles.primaryButton
                                }
                                disabled={
                                    aiLoading
                                }
                                onClick={() =>
                                    void applyAiData()
                                }
                            >
                                <Sparkles
                                    size={17}
                                />

                                {aiLoading
                                    ? "Đang phân tích..."
                                    : "Phân tích và áp dụng"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}


/* ============================================================
   STUDENT STEP
============================================================ */

type StepProps = {
    form: RegistrationForm;

    onChange: (
        event:
            | ChangeEvent<HTMLInputElement>
            | ChangeEvent<HTMLTextAreaElement>
            | ChangeEvent<HTMLSelectElement>
    ) => void;
};


function StudentInformationStep({
    form,
    onChange,
}: StepProps) {
    return (
        <>
            <FormSectionHeader
                icon={
                    GraduationCap
                }
                title="Thông tin sinh viên"
                description="Thông tin được lấy từ tài khoản sinh viên đang đăng nhập."
            />


            <div
                className={
                    styles.formGrid
                }
            >
                <FormField
                    label="Họ và tên"
                    name="fullName"
                    value={
                        form.fullName
                    }
                    icon={
                        UserRound
                    }
                    onChange={
                        onChange
                    }
                    disabled
                />


                <FormField
                    label="Mã số sinh viên"
                    name="studentCode"
                    value={
                        form.studentCode
                    }
                    icon={
                        GraduationCap
                    }
                    onChange={
                        onChange
                    }
                    disabled
                />


                <FormField
                    label="Email VinUni"
                    name="email"
                    type="email"
                    value={
                        form.email
                    }
                    icon={
                        Mail
                    }
                    onChange={
                        onChange
                    }
                    disabled
                />


                <FormField
                    label="Số điện thoại"
                    name="phone"
                    value={
                        form.phone
                    }
                    icon={
                        Phone
                    }
                    onChange={
                        onChange
                    }
                    disabled
                />


                <FormField
                    label="Khoa"
                    name="faculty"
                    value={
                        form.faculty
                    }
                    onChange={
                        onChange
                    }
                    disabled
                />


                <FormField
                    label="Ngành học"
                    name="major"
                    value={
                        form.major
                    }
                    onChange={
                        onChange
                    }
                    disabled
                />


                <FormField
                    label="Khóa"
                    name="cohort"
                    value={
                        form.cohort
                    }
                    onChange={
                        onChange
                    }
                    disabled
                />


                <div
                    className={
                        styles.fieldGroup
                    }
                >
                    <label
                        htmlFor="credits"
                    >
                        Số tín chỉ
                        đăng ký
                    </label>

                    <div
                        className={
                            styles.selectWrapper
                        }
                    >
                        <select
                            id="credits"
                            name="credits"
                            value={
                                form.credits
                            }
                            onChange={
                                onChange
                            }
                        >
                            <option value="2">
                                2 tín chỉ
                            </option>

                            <option value="3">
                                3 tín chỉ
                            </option>

                            <option value="4">
                                4 tín chỉ
                            </option>

                            <option value="6">
                                6 tín chỉ
                            </option>
                        </select>

                        <ChevronDown
                            size={17}
                        />
                    </div>
                </div>
            </div>


            <div
                className={
                    styles.formInfo
                }
            >
                <Info
                    size={17}
                />

                Thông tin sinh
                viên được lấy
                trực tiếp từ hệ
                thống.
            </div>
        </>
    );
}


/* ============================================================
   COMPANY STEP
============================================================ */

function CompanyInformationStep({
    form,
    onChange,
    documents,
    onRefresh,
    onSaveDraft,
    disabled,
}: StepProps & {
    documents:
    RegistrationDocument[];

    onRefresh:
    () => Promise<void>;

    onSaveDraft:
    () => Promise<boolean>;

    disabled:
    boolean;
}) {
    return (
        <>
            <FormSectionHeader
                icon={Building2}
                title="Thông tin doanh nghiệp"
                description="Khai báo đơn vị tiếp nhận sinh viên thực tập."
            />


            <div
                className={
                    styles.formGrid
                }
            >
                <FormField
                    label="Tên doanh nghiệp"
                    name="companyName"
                    value={
                        form.companyName
                    }
                    placeholder="Ví dụ: FPT Software"
                    icon={
                        Building2
                    }
                    onChange={
                        onChange
                    }
                    disabled={
                        disabled
                    }
                />


                <FormField
                    label="Lĩnh vực hoạt động"
                    name="industry"
                    value={
                        form.industry
                    }
                    placeholder="Công nghệ thông tin"
                    onChange={
                        onChange
                    }
                    disabled={
                        disabled
                    }
                />


                <FormField
                    label="Website"
                    name="companyWebsite"
                    value={
                        form.companyWebsite
                    }
                    placeholder="https://example.com"
                    onChange={
                        onChange
                    }
                    disabled={
                        disabled
                    }
                />


                <FormField
                    label="Địa chỉ doanh nghiệp"
                    name="companyAddress"
                    value={
                        form.companyAddress
                    }
                    placeholder="Địa chỉ làm việc"
                    icon={
                        MapPin
                    }
                    onChange={
                        onChange
                    }
                    fullWidth
                    disabled={
                        disabled
                    }
                />
            </div>


            <UploadArea
                title="Giấy xác nhận hoặc Offer Letter"
                description="PDF, DOC, DOCX - tối đa 10MB"
                documentType="OFFER_LETTER"
                documents={
                    documents
                }
                onRefresh={
                    onRefresh
                }
                onSaveDraft={
                    onSaveDraft
                }
                disabled={
                    disabled
                }
            />
        </>
    );
}


/* ============================================================
   INTERNSHIP STEP
============================================================ */

function InternshipInformationStep({
    form,
    onChange,
    documents,
    onRefresh,
    onSaveDraft,
    disabled,
}: StepProps & {
    documents:
    RegistrationDocument[];

    onRefresh:
    () => Promise<void>;

    onSaveDraft:
    () => Promise<boolean>;

    disabled:
    boolean;
}) {
    return (
        <>
            <FormSectionHeader
                icon={
                    CalendarDays
                }
                title="Thông tin thực tập"
                description="Khai báo vị trí, hình thức và thời gian làm việc."
            />


            <div
                className={
                    styles.formGrid
                }
            >
                <FormField
                    label="Vị trí thực tập"
                    name="internshipPosition"
                    value={
                        form.internshipPosition
                    }
                    placeholder="Software Engineering Intern"
                    onChange={
                        onChange
                    }
                    fullWidth
                    disabled={
                        disabled
                    }
                />


                <div
                    className={
                        styles.fieldGroup
                    }
                >
                    <label
                        htmlFor="workMode"
                    >
                        Hình thức làm
                        việc
                    </label>

                    <div
                        className={
                            styles.selectWrapper
                        }
                    >
                        <select
                            id="workMode"
                            name="workMode"
                            value={
                                form.workMode
                            }
                            onChange={
                                onChange
                            }
                            disabled={
                                disabled
                            }
                        >
                            <option value="onsite">
                                Tại văn phòng
                            </option>

                            <option value="remote">
                                Từ xa
                            </option>

                            <option value="hybrid">
                                Kết hợp
                            </option>
                        </select>

                        <ChevronDown
                            size={17}
                        />
                    </div>
                </div>


                <FormField
                    label="Ngày bắt đầu"
                    name="startDate"
                    type="date"
                    value={
                        form.startDate
                    }
                    onChange={
                        onChange
                    }
                    disabled={
                        disabled
                    }
                />


                <FormField
                    label="Ngày kết thúc"
                    name="endDate"
                    type="date"
                    value={
                        form.endDate
                    }
                    onChange={
                        onChange
                    }
                    disabled={
                        disabled
                    }
                />


                <div
                    className={`${styles.fieldGroup} ${styles.fullWidth}`}
                >
                    <label
                        htmlFor="jobDescription"
                    >
                        Mô tả công
                        việc
                    </label>

                    <textarea
                        id="jobDescription"
                        name="jobDescription"
                        value={
                            form.jobDescription
                        }
                        onChange={
                            onChange
                        }
                        disabled={
                            disabled
                        }
                        placeholder="Mô tả nhiệm vụ, công nghệ sử dụng..."
                        rows={6}
                    />
                </div>
            </div>


            <UploadArea
                title="Job Description"
                description="Tải JD lên hệ thống"
                documentType="JOB_DESCRIPTION"
                documents={
                    documents
                }
                onRefresh={
                    onRefresh
                }
                onSaveDraft={
                    onSaveDraft
                }
                disabled={
                    disabled
                }
            />
        </>
    );
}


/* ============================================================
   MENTOR
============================================================ */

function MentorInformationStep({
    form,
    onChange,
}: StepProps) {
    return (
        <>
            <FormSectionHeader
                icon={
                    UserRound
                }
                title="Mentor doanh nghiệp"
                description="Thông tin người trực tiếp hướng dẫn."
            />

            <div
                className={
                    styles.formGrid
                }
            >
                <FormField
                    label="Họ và tên mentor"
                    name="mentorName"
                    value={
                        form.mentorName
                    }
                    icon={
                        UserRound
                    }
                    onChange={
                        onChange
                    }
                />

                <FormField
                    label="Chức vụ"
                    name="mentorPosition"
                    value={
                        form.mentorPosition
                    }
                    onChange={
                        onChange
                    }
                />

                <FormField
                    label="Email mentor"
                    name="mentorEmail"
                    type="email"
                    value={
                        form.mentorEmail
                    }
                    icon={
                        Mail
                    }
                    onChange={
                        onChange
                    }
                />

                <FormField
                    label="Số điện thoại"
                    name="mentorPhone"
                    value={
                        form.mentorPhone
                    }
                    icon={
                        Phone
                    }
                    onChange={
                        onChange
                    }
                />
            </div>
        </>
    );
}


/* ============================================================
   REVIEW
============================================================ */

function ReviewStep({
    form,
    status,
    confirmed,
    onConfirmedChange,
}: {
    form:
    RegistrationForm;

    status: string;

    confirmed: boolean;

    onConfirmedChange:
    (value: boolean) =>
        void;
}) {
    return (
        <>
            <FormSectionHeader
                icon={
                    CheckCircle2
                }
                title="Kiểm tra và xác nhận"
                description="Xem lại toàn bộ thông tin trước khi gửi."
            />


            {[
                "SUBMITTED",
                "UNDER_REVIEW",
                "APPROVED",
            ].includes(
                status
            ) && (
                    <div
                        className={
                            styles.submittedMessage
                        }
                    >
                        <CheckCircle2
                            size={28}
                        />

                        <div>
                            <h3>
                                Hồ sơ đã được
                                gửi
                            </h3>

                            <p>
                                {getStatusLabel(
                                    status
                                )}
                            </p>
                        </div>
                    </div>
                )}


            <div
                className={
                    styles.reviewGrid
                }
            >
                <ReviewSection
                    title="Sinh viên"
                >
                    <ReviewRow
                        label="Họ tên"
                        value={
                            form.fullName
                        }
                    />

                    <ReviewRow
                        label="MSSV"
                        value={
                            form.studentCode
                        }
                    />

                    <ReviewRow
                        label="Ngành"
                        value={
                            form.major
                        }
                    />

                    <ReviewRow
                        label="Tín chỉ"
                        value={`${form.credits} tín chỉ`}
                    />
                </ReviewSection>


                <ReviewSection
                    title="Doanh nghiệp"
                >
                    <ReviewRow
                        label="Tên công ty"
                        value={
                            form.companyName
                        }
                    />

                    <ReviewRow
                        label="Lĩnh vực"
                        value={
                            form.industry
                        }
                    />

                    <ReviewRow
                        label="Địa chỉ"
                        value={
                            form.companyAddress
                        }
                    />
                </ReviewSection>


                <ReviewSection
                    title="Thực tập"
                >
                    <ReviewRow
                        label="Vị trí"
                        value={
                            form.internshipPosition
                        }
                    />

                    <ReviewRow
                        label="Hình thức"
                        value={
                            getWorkModeLabel(
                                form.workMode
                            )
                        }
                    />

                    <ReviewRow
                        label="Bắt đầu"
                        value={
                            form.startDate
                        }
                    />

                    <ReviewRow
                        label="Kết thúc"
                        value={
                            form.endDate
                        }
                    />
                </ReviewSection>


                <ReviewSection
                    title="Mentor"
                >
                    <ReviewRow
                        label="Họ tên"
                        value={
                            form.mentorName
                        }
                    />

                    <ReviewRow
                        label="Chức vụ"
                        value={
                            form.mentorPosition
                        }
                    />

                    <ReviewRow
                        label="Email"
                        value={
                            form.mentorEmail
                        }
                    />

                    <ReviewRow
                        label="Điện thoại"
                        value={
                            form.mentorPhone
                        }
                    />
                </ReviewSection>
            </div>


            <label
                className={
                    styles.confirmBox
                }
            >
                <input
                    type="checkbox"
                    checked={
                        confirmed
                    }
                    disabled={[
                        "SUBMITTED",
                        "UNDER_REVIEW",
                        "APPROVED",
                    ].includes(
                        status
                    )}
                    onChange={(
                        event
                    ) =>
                        onConfirmedChange(
                            event
                                .target
                                .checked
                        )
                    }
                />

                <span>
                    Tôi xác nhận các
                    thông tin trên là
                    chính xác.
                </span>
            </label>
        </>
    );
}


/* ============================================================
   UPLOAD AREA
============================================================ */

function UploadArea({
    title,
    description,
    documentType,
    documents,
    onRefresh,
    onSaveDraft,
    disabled,
}: {
    title: string;

    description: string;

    documentType: string;

    documents:
    RegistrationDocument[];

    onRefresh:
    () => Promise<void>;

    onSaveDraft:
    () => Promise<boolean>;

    disabled: boolean;
}) {
    const inputRef =
        useRef<HTMLInputElement>(
            null
        );

    const [
        uploading,
        setUploading,
    ] =
        useState(false);

    const [
        deleting,
        setDeleting,
    ] =
        useState(false);


    const document =
        documents.find(
            (
                item
            ) =>
                item.documentType ===
                documentType
        );


    async function uploadFile(
        event:
            ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0];


        if (!file) {
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


        const valid =
            [
                ".pdf",
                ".doc",
                ".docx",
            ].some(
                (
                    extension
                ) =>
                    file.name
                        .toLowerCase()
                        .endsWith(
                            extension
                        )
            );


        if (!valid) {
            alert(
                "Chỉ hỗ trợ PDF, DOC, DOCX."
            );

            return;
        }


        const saved =
            await onSaveDraft();


        if (!saved) {
            return;
        }


        const token =
            localStorage.getItem(
                "internova_access_token"
            );


        if (!token) {
            return;
        }


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        try {
            setUploading(
                true
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/internship-registration/documents/${documentType}`,
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


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.detail ??
                    "Upload thất bại."
                );
            }


            await onRefresh();


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Upload thất bại."
            );

        } finally {
            setUploading(
                false
            );

            if (
                inputRef.current
            ) {
                inputRef.current.value =
                    "";
            }
        }
    }


    async function viewFile() {
        if (!document) {
            return;
        }


        const token =
            localStorage.getItem(
                "internova_access_token"
            );


        const response =
            await fetch(
                `${API_URL}/api/v1/student/internship-registration/documents/${document.id}/file`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                    },
                }
            );


        if (!response.ok) {
            alert(
                "Không thể mở tài liệu."
            );

            return;
        }


        const blob =
            await response.blob();


        const url =
            URL.createObjectURL(
                blob
            );


        window.open(
            url,
            "_blank"
        );


        window.setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            60000
        );
    }


    async function removeFile() {
        if (!document) {
            return;
        }


        if (
            !window.confirm(
                `Xóa "${document.originalFileName}"?`
            )
        ) {
            return;
        }


        const token =
            localStorage.getItem(
                "internova_access_token"
            );


        try {
            setDeleting(
                true
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/internship-registration/documents/${document.id}`,
                    {
                        method:
                            "DELETE",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.detail ??
                    "Không thể xóa file."
                );
            }


            await onRefresh();

        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể xóa file."
            );

        } finally {
            setDeleting(
                false
            );
        }
    }


    return (
        <div
            className={
                styles.uploadArea
            }
        >
            <input
                ref={
                    inputRef
                }
                type="file"
                accept=".pdf,.doc,.docx"
                hidden
                onChange={
                    uploadFile
                }
            />


            <span
                className={
                    styles.uploadIcon
                }
            >
                <UploadCloud
                    size={25}
                />
            </span>


            <span
                className={
                    styles.uploadContent
                }
            >
                <strong>
                    {title}
                </strong>

                <small>
                    {document
                        ? document
                            .originalFileName
                        : description}
                </small>
            </span>


            <div
                className={
                    styles.uploadActions
                }
            >
                {document && (
                    <button
                        type="button"
                        onClick={() =>
                            void viewFile()
                        }
                    >
                        <Eye
                            size={15}
                        />

                        Xem
                    </button>
                )}


                <button
                    type="button"
                    disabled={
                        disabled ||
                        uploading
                    }
                    onClick={() =>
                        inputRef.current?.click()
                    }
                >
                    <UploadCloud
                        size={15}
                    />

                    {uploading
                        ? "Đang tải..."
                        : document
                            ? "Thay tệp"
                            : "Chọn tệp"}
                </button>


                {document && (
                    <button
                        type="button"
                        disabled={
                            disabled ||
                            deleting
                        }
                        onClick={() =>
                            void removeFile()
                        }
                    >
                        <Trash2
                            size={15}
                        />

                        {deleting
                            ? "Đang xóa"
                            : "Xóa"}
                    </button>
                )}
            </div>
        </div>
    );
}


/* ============================================================
   HELPERS UI
============================================================ */

function FormSectionHeader({
    icon: Icon,
    title,
    description,
}: {
    icon:
    React.ElementType;

    title: string;

    description:
    string;
}) {
    return (
        <div
            className={
                styles.formSectionHeader
            }
        >
            <span>
                <Icon
                    size={22}
                />
            </span>

            <div>
                <h2>
                    {title}
                </h2>

                <p>
                    {description}
                </p>
            </div>
        </div>
    );
}


function FormField({
    label,
    name,
    value,
    placeholder,
    type = "text",
    icon: Icon,
    onChange,
    fullWidth = false,
    disabled = false,
}: {
    label: string;

    name:
    keyof RegistrationForm;

    value: string;

    placeholder?: string;

    type?: string;

    icon?:
    React.ElementType;

    onChange:
    StepProps["onChange"];

    fullWidth?:
    boolean;

    disabled?:
    boolean;
}) {
    return (
        <div
            className={`${styles.fieldGroup} ${fullWidth
                ? styles.fullWidth
                : ""
                }`}
        >
            <label
                htmlFor={
                    name
                }
            >
                {label}
            </label>


            <div
                className={
                    styles.inputWrapper
                }
            >
                {Icon && (
                    <Icon
                        size={17}
                    />
                )}

                <input
                    id={
                        name
                    }
                    name={
                        name
                    }
                    type={
                        type
                    }
                    value={
                        value
                    }
                    placeholder={
                        placeholder
                    }
                    onChange={
                        onChange
                    }
                    disabled={
                        disabled
                    }
                />
            </div>
        </div>
    );
}


function ReviewSection({
    title,
    children,
}: {
    title: string;

    children:
    React.ReactNode;
}) {
    return (
        <section
            className={
                styles.reviewSection
            }
        >
            <h3>
                {title}
            </h3>

            {children}
        </section>
    );
}


function ReviewRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div
            className={
                styles.reviewRow
            }
        >
            <span>
                {label}
            </span>

            <strong>
                {value ||
                    "Chưa cung cấp"}
            </strong>
        </div>
    );
}


function TimelineItem({
    title,
    description,
    state,
}: {
    title: string;

    description:
    string;

    state:
    "completed" |
    "active" |
    "pending";
}) {
    const itemClass =
        state === "completed"
            ? styles.timelineItemCompleted
            : state === "active"
                ? styles.timelineItemActive
                : styles.timelineItemPending;

    const dotClass =
        state === "completed"
            ? styles.timelineDotCompleted
            : state === "active"
                ? styles.timelineDotActive
                : styles.timelineDotPending;

    return (
        <div
            className={`${styles.timelineItem} ${itemClass}`}
        >
            <span
                className={dotClass}
                aria-hidden="true"
            />

            <div>
                <strong>
                    {title}
                </strong>

                <p>
                    {description}
                </p>
            </div>
        </div>
    );
}


function RequirementItem({
    label,
    completed,
}: {
    label: string;

    completed:
    boolean;
}) {
    return (
        <li>
            {completed ? (
                <CheckCircle2
                    size={16}
                />
            ) : (
                <FileText
                    size={16}
                />
            )}

            {label}
        </li>
    );
}


function getWorkModeLabel(
    value: string
) {
    if (
        value === "remote"
    ) {
        return "Từ xa";
    }

    if (
        value === "hybrid"
    ) {
        return "Kết hợp";
    }

    return "Tại văn phòng";
}


function getStatusLabel(
    status: string
) {
    switch (status) {
        case "DRAFT":
            return "Bản nháp";

        case "SUBMITTED":
            return "Đã gửi - chờ duyệt";

        case "UNDER_REVIEW":
            return "Đang được xem xét";

        case "APPROVED":
            return "Đã được duyệt";

        case "REJECTED":
            return "Yêu cầu chỉnh sửa";

        case "CANCELLED":
            return "Đã hủy";

        default:
            return status;
    }
}
