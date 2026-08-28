"use client";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";
import { useSettings } from "@/context/settings-provider";

import {
    MessageSquare,
    FileCheck2,
    Info,
    Briefcase,
    Calendar,
    TrendingUp,
    CheckCircle2,
    Circle,
    ArrowRight,
    LoaderCircle,
    AlertTriangle,
} from "lucide-react";

import {
    useEffect,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import styles from "./page.module.css";


const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


type Internship = {
    id: number;

    status: string;

    companyName: string | null;

    positionTitle: string | null;

    startDate: string | null;

    endDate: string | null;

    progressPercentage: number;
};


type DashboardDeadline = {
    id: number;

    title: string;

    subtitle: string | null;

    dueAt: string;

    countdownDays: number;
};


type WeeklyTask = {
    id: number;

    label: string;

    done: boolean;
};


type StudentDashboardData = {
    user: {
        id: number;

        fullName: string;

        firstName: string;

        avatarUrl: string | null;
    };

    internship:
        Internship | null;

    deadlines:
        DashboardDeadline[];

    weeklyProgress: {
        weekNumber:
            number | null;

        startDate:
            string | null;

        endDate:
            string | null;

        progressPercentage:
            number;

        tasks:
            WeeklyTask[];
    };
};


/* =========================================================
   DATE FORMATTERS
   ========================================================= */

function formatDate(
    value: string | null,
    locale: string
) {
    if (!value) {
        return locale === "vi"
            ? "Chưa cập nhật"
            : "Not updated yet";
    }

    return new Intl.DateTimeFormat(
        locale === "vi" ? "vi-VN" : "en-US",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }
    ).format(
        new Date(value)
    );
}


function formatShortDate(
    value: string | null,
    locale: string
) {
    if (!value) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        locale === "vi" ? "vi-VN" : "en-US",
        {
            day: "2-digit",
            month: "2-digit",
        }
    ).format(
        new Date(value)
    );
}


/* =========================================================
   INTERNSHIP STATUS
   ========================================================= */

function getInternshipStatus(
    status: string,
    t: (k: string) => string
) {
    switch (status) {
        case "IN_PROGRESS":
            return t("dashboard.status.in_progress");

        case "NOT_STARTED":
            return t("dashboard.status.not_started");

        case "PAUSED":
            return t("dashboard.status.not_started");

        case "COMPLETED":
            return t("dashboard.status.completed");

        default:
            return status;
    }
}


/* =========================================================
   DEADLINE COUNTDOWN
   ========================================================= */

function getDeadlineCountdown(
    days: number,
    locale: string
) {
    if (locale === "vi") {
        if (days === 0) {
            return "(Hôm nay)";
        }

        if (days === 1) {
            return "(Ngày mai)";
        }

        if (days > 1) {
            return `(${days} ngày nữa)`;
        }

        return `(Quá hạn ${Math.abs(
            days
        )} ngày)`;
    } else {
        if (days === 0) {
            return "(Today)";
        }

        if (days === 1) {
            return "(Tomorrow)";
        }

        if (days > 1) {
            return `(${days} days left)`;
        }

        return `(Overdue ${Math.abs(
            days
        )} days)`;
    }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

export default function Dashboard() {
    const router =
        useRouter();

    const { t, locale } =
        useSettings();


    const [
        data,
        setData,
    ] =
        useState<
            StudentDashboardData |
            null
        >(null);


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


    /* =====================================================
       LOGOUT
       ===================================================== */

    function logoutAndRedirect() {
        localStorage.removeItem(
            "internova_access_token"
        );

        localStorage.removeItem(
            "internova_user"
        );

        window.alert(
            "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại."
        );

        router.push(
            "/auth/login"
        );
    }


    /* =====================================================
       LOAD DASHBOARD
       ===================================================== */

    async function loadDashboard() {
        try {
            setLoading(true);
            setError("");


            const token =
                localStorage.getItem(
                    "internova_access_token"
                );


            if (!token) {
                logoutAndRedirect();

                return;
            }


            const response =
                await fetch(
                    `${API_URL}/api/v1/student/dashboard`,
                    {
                        method:
                            "GET",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        cache:
                            "no-store",
                    }
                );


            const result =
                await response.json();


            if (
                response.status ===
                401
            ) {
                logoutAndRedirect();

                return;
            }


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể tải dashboard."
                );
            }


            setData(
                result
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


    /* =====================================================
       INITIAL LOAD
       ===================================================== */

    useEffect(() => {
        // Initial client-side API synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDashboard();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    /* =====================================================
       LOADING STATE
       ===================================================== */

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
                            {
                                locale === "vi"
                                    ? "Đang tải dashboard..."
                                    : "Loading dashboard..."
                            }
                        </p>
                    </main>
                </div>
            </div>
        );
    }


    /* =====================================================
       ERROR STATE
       ===================================================== */

    if (
        error ||
        !data
    ) {
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
                        <AlertTriangle
                            size={36}
                        />

                        <h2>
                            {
                                locale === "vi"
                                    ? "Không thể tải dashboard"
                                    : "Unable to load dashboard"
                            }
                        </h2>

                        <p>
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                void loadDashboard()
                            }
                        >
                            {
                                t(
                                    "dashboard.try_again"
                                )
                            }
                        </button>
                    </main>
                </div>
            </div>
        );
    }


    const internship =
        data.internship;


    const weekly =
        data.weeklyProgress;


    /* =====================================================
       MAIN DASHBOARD
       ===================================================== */

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
                        styles.dashboard
                    }
                >

                    {/* =====================================
                        WELCOME
                    ====================================== */}

                    <div
                        className={
                            styles.dashboardWelcome
                        }
                    >
                        <h1>
                            {
                                t(
                                    "dashboard.welcome"
                                )
                            }
                            ,{" "}

                            {
                                data.user
                                    .firstName
                            }
                            {" "}

                            <span
                                aria-hidden="true"
                            >
                                👋
                            </span>
                        </h1>


                        <p>
                            {
                                t(
                                    "dashboard.welcome_sub"
                                )
                            }
                        </p>
                    </div>


                    {/* =====================================
                        AI FEATURES
                    ====================================== */}

                    <section
                        className={`${styles.dashboardPanel} ${styles.featureGrid}`}
                    >

                        {/* AI CONSULTING */}

                        <article
                            className={
                                styles.featureCard
                            }
                        >
                            <div
                                className={
                                    styles.featureIcon
                                }
                            >
                                <MessageSquare
                                    size={28}
                                    strokeWidth={
                                        2
                                    }
                                />
                            </div>


                            <h3>
                                {
                                    t(
                                        "dashboard.ai_consulting"
                                    )
                                }
                            </h3>


                            <p>
                                {
                                    t(
                                        "dashboard.ai_consulting_desc"
                                    )
                                }
                            </p>


                            <button
                                type="button"
                                className={
                                    styles.featureCta
                                }
                                onClick={() =>
                                    router.push(
                                        "/student/chatbot"
                                    )
                                }
                            >
                                {
                                    t(
                                        "dashboard.ai_consulting_btn"
                                    )
                                }

                                <ArrowRight
                                    size={15}
                                />
                            </button>
                        </article>


                        {/* AI REVIEW */}

                        <article
                            className={
                                styles.featureCard
                            }
                        >
                            <div
                                className={
                                    styles.featureIconWrapper
                                }
                            >
                                <div
                                    className={
                                        styles.featureIcon
                                    }
                                >
                                    <FileCheck2
                                        size={28}
                                        strokeWidth={
                                            2
                                        }
                                    />
                                </div>

                                <span
                                    className={
                                        styles.devBadge
                                    }
                                >
                                    {
                                        t(
                                            "dashboard.ai_review_badge"
                                        )
                                    }
                                </span>
                            </div>


                            <h3>
                                {
                                    t(
                                        "dashboard.ai_review"
                                    )
                                }
                            </h3>


                            <p>
                                {
                                    t(
                                        "dashboard.ai_review_desc"
                                    )
                                }
                            </p>


                            <button
                                type="button"
                                className={`${styles.featureCta} ${styles.featureCtaDisabled}`}
                                disabled
                                aria-disabled="true"
                            >
                                {
                                    t(
                                        "dashboard.ai_review_coming_soon"
                                    )
                                }

                                <ArrowRight
                                    size={15}
                                />
                            </button>
                        </article>
                    </section>


                    {/* =====================================
                        STATUS GRID
                    ====================================== */}

                    <section
                        className={`${styles.dashboardPanel} ${styles.statusGrid}`}
                    >

                        {/* =================================
                            INTERNSHIP
                        ================================== */}

                        <article
                            className={
                                styles.statusCard
                            }
                        >
                            <div
                                className={
                                    styles.statusCardHeader
                                }
                            >
                                <Briefcase
                                    size={18}
                                />

                                <h4>
                                    {
                                        t(
                                            "dashboard.status_title"
                                        )
                                    }
                                </h4>
                            </div>


                            {internship ? (
                                <>
                                    <span
                                        className={
                                            styles.statusPill
                                        }
                                    >
                                        {
                                            getInternshipStatus(
                                                internship.status,
                                                t
                                            )
                                        }
                                    </span>


                                    <dl
                                        className={
                                            styles.statusList
                                        }
                                    >
                                        {/* COMPANY */}

                                        <div
                                            className={
                                                styles.statusRow
                                            }
                                        >
                                            <dt>
                                                {
                                                    t(
                                                        "dashboard.status_company"
                                                    )
                                                }
                                            </dt>

                                            <dd>
                                                {
                                                    internship.companyName ??
                                                    t(
                                                        "dashboard.status_not_update"
                                                    )
                                                }
                                            </dd>
                                        </div>


                                        {/* POSITION */}

                                        <div
                                            className={
                                                styles.statusRow
                                            }
                                        >
                                            <dt>
                                                {
                                                    t(
                                                        "dashboard.status_position"
                                                    )
                                                }
                                            </dt>

                                            <dd>
                                                {
                                                    internship.positionTitle ??
                                                    t(
                                                        "dashboard.status_not_update"
                                                    )
                                                }
                                            </dd>
                                        </div>


                                        {/* DURATION */}

                                        <div
                                            className={
                                                styles.statusRow
                                            }
                                        >
                                            <dt>
                                                {
                                                    t(
                                                        "dashboard.status_duration"
                                                    )
                                                }
                                            </dt>

                                            <dd>
                                                {
                                                    formatDate(
                                                        internship.startDate,
                                                        locale
                                                    )
                                                }

                                                {" - "}

                                                {
                                                    formatDate(
                                                        internship.endDate,
                                                        locale
                                                    )
                                                }
                                            </dd>
                                        </div>
                                    </dl>


                                    <button
                                        type="button"
                                        className={
                                            styles.statusCta
                                        }
                                        onClick={() =>
                                            router.push(
                                                "/student/internship-profile"
                                            )
                                        }
                                    >
                                        {
                                            t(
                                                "dashboard.status_view_profile"
                                            )
                                        }
                                    </button>
                                </>
                            ) : (
                                <div
                                    className={
                                        styles.emptyCard
                                    }
                                >
                                    <p>
                                        {
                                            t(
                                                "dashboard.status_no_internship"
                                            )
                                        }
                                    </p>

                                    <button
                                        type="button"
                                        className={
                                            styles.statusCta
                                        }
                                        onClick={() =>
                                            router.push(
                                                "/student/internship-registration"
                                            )
                                        }
                                    >
                                        {
                                            t(
                                                "dashboard.status_register_btn"
                                            )
                                        }
                                    </button>
                                </div>
                            )}
                        </article>


                        {/* =================================
                            DEADLINES
                        ================================== */}

                        <article
                            className={
                                styles.statusCard
                            }
                        >
                            <div
                                className={
                                    styles.statusCardHeader
                                }
                            >
                                <Calendar
                                    size={18}
                                />

                                <h4>
                                    {
                                        t(
                                            "dashboard.deadlines_title"
                                        )
                                    }
                                </h4>
                            </div>


                            {
                                data.deadlines
                                    .length >
                                0 ? (
                                    <ul
                                        className={
                                            styles.deadlineList
                                        }
                                    >
                                        {
                                            data.deadlines.map(
                                                (
                                                    item
                                                ) => (
                                                    <li
                                                        key={
                                                            item.id
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                styles.deadlineDot
                                                            }
                                                        />


                                                        <div
                                                            className={
                                                                styles.deadlineInfo
                                                            }
                                                        >
                                                            <div>
                                                                <p
                                                                    className={
                                                                        styles.deadlineTitle
                                                                    }
                                                                >
                                                                    {
                                                                        item.title
                                                                    }
                                                                </p>


                                                                <p
                                                                    className={
                                                                        styles.deadlineSubtitle
                                                                    }
                                                                >
                                                                    {
                                                                        item.subtitle ??
                                                                        "Deadline"
                                                                    }
                                                                </p>
                                                            </div>


                                                            <div
                                                                className={
                                                                    styles.deadlineDate
                                                                }
                                                            >
                                                                <p>
                                                                    {
                                                                        formatDate(
                                                                            item.dueAt,
                                                                            locale
                                                                        )
                                                                    }
                                                                </p>

                                                                <p>
                                                                    {
                                                                        getDeadlineCountdown(
                                                                            item.countdownDays,
                                                                            locale
                                                                        )
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </li>
                                                )
                                            )
                                        }
                                    </ul>
                                ) : (
                                    <div
                                        className={
                                            styles.emptyCard
                                        }
                                    >
                                        <p>
                                            {
                                                locale === "vi"
                                                    ? "Không có deadline sắp tới."
                                                    : "No upcoming deadlines."
                                            }
                                        </p>
                                    </div>
                                )
                            }


                            <button
                                type="button"
                                className={
                                    styles.statusCta
                                }
                                onClick={() =>
                                    router.push(
                                        "/student/notification"
                                    )
                                }
                            >
                                {
                                    t(
                                        "dashboard.deadlines_view_all"
                                    )
                                }
                            </button>
                        </article>


                        {/* =================================
                            WEEK PROGRESS
                        ================================== */}

                        <article
                            className={
                                styles.statusCard
                            }
                        >
                            <div
                                className={
                                    styles.statusCardHeader
                                }
                            >
                                <TrendingUp
                                    size={18}
                                />

                                <h4>
                                    {
                                        t(
                                            "dashboard.progress_title"
                                        )
                                    }
                                </h4>
                            </div>


                            {
                                weekly.weekNumber ? (
                                    <>
                                        <div className={styles.progressVisual}>
                                            <div
                                                className={styles.progressRing}
                                                style={{
                                                    background: `conic-gradient(#123b73 ${weekly.progressPercentage * 3.6}deg, #e7ecf4 0deg)`,
                                                }}
                                            >
                                                <div className={styles.progressRingInner}>
                                                    <strong>{weekly.progressPercentage}%</strong>
                                                </div>
                                            </div>

                                            <p className={styles.progressCaption}>
                                                {locale === "vi"
                                                    ? `Bạn đã hoàn thành ${weekly.progressPercentage}% công việc tuần này.`
                                                    : `You have completed ${weekly.progressPercentage}% of this week's work.`}
                                            </p>

                                            <p className={styles.progressWeekMeta}>
                                                {t("dashboard.progress_week")} {weekly.weekNumber}
                                                {" · "}
                                                {formatShortDate(weekly.startDate, locale)}
                                                {" - "}
                                                {formatShortDate(weekly.endDate, locale)}
                                            </p>
                                        </div>


                                        {/* TASK LIST */}

                                        <ul
                                            className={
                                                styles.checklist
                                            }
                                        >
                                            {
                                                weekly.tasks.map(
                                                    (
                                                        item
                                                    ) => (
                                                        <li
                                                            key={
                                                                item.id
                                                            }
                                                        >
                                                            {
                                                                item.done ? (
                                                                    <CheckCircle2
                                                                        size={
                                                                            16
                                                                        }
                                                                        className={
                                                                            styles.checkDone
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <Circle
                                                                        size={
                                                                            16
                                                                        }
                                                                        className={
                                                                            styles.checkPending
                                                                        }
                                                                    />
                                                                )
                                                            }


                                                            <span>
                                                                {
                                                                    item.label
                                                                }
                                                            </span>
                                                        </li>
                                                    )
                                                )
                                            }
                                        </ul>
                                    </>
                                ) : (
                                    <div
                                        className={
                                            styles.emptyCard
                                        }
                                    >
                                        <p>
                                            {
                                                t(
                                                    "dashboard.progress_none"
                                                )
                                            }
                                        </p>
                                    </div>
                                )
                            }


                            <button
                                type="button"
                                className={
                                    styles.statusCta
                                }
                                onClick={() =>
                                    router.push(
                                        "/student/checklist"
                                    )
                                }
                            >
                                {
                                    t(
                                        "dashboard.progress_view_detail"
                                    )
                                }
                            </button>
                        </article>
                    </section>


                    {/* =====================================
                        TIP
                    ====================================== */}

                    <div
                        className={
                            styles.tipBanner
                        }
                    >
                        <Info
                            size={18}
                        />

                        <p>
                            <strong>
                                {
                                    t(
                                        "dashboard.tip_title"
                                    )
                                }
                            </strong>
                            {" "}

                            {
                                t(
                                    "dashboard.tip_content"
                                )
                            }
                        </p>
                    </div>

                    <footer className={styles.dashboardFooter}>
                        <span>© 2026 AI Internova. {locale === "vi" ? "Tất cả quyền được bảo lưu." : "All rights reserved."}</span>
                        <div>
                            <button type="button">{locale === "vi" ? "Chính sách bảo mật" : "Privacy policy"}</button>
                            <button type="button">{locale === "vi" ? "Điều khoản sử dụng" : "Terms of use"}</button>
                        </div>
                    </footer>
                </main>
            </div>
        </div>
    );
}