"use client";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";

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


function formatDate(
    value: string | null
) {
    if (!value) {
        return "Chưa cập nhật";
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


function formatShortDate(
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
        }
    ).format(
        new Date(value)
    );
}


function getInternshipStatus(
    status: string
) {
    switch (status) {
        case "IN_PROGRESS":
            return "Đang thực tập";

        case "NOT_STARTED":
            return "Chưa bắt đầu";

        case "PAUSED":
            return "Tạm dừng";

        case "COMPLETED":
            return "Đã hoàn thành";

        default:
            return status;
    }
}


function getDeadlineCountdown(
    days: number
) {
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
}


export default function Dashboard() {
    const router =
        useRouter();


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


    function logoutAndRedirect() {
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


    useEffect(() => {
        // Initial client-side API synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDashboard();
    }, []);


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
                            Đang tải
                            dashboard...
                        </p>
                    </main>
                </div>
            </div>
        );
    }


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
                            Không thể tải
                            dashboard
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
                            Thử lại
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

                    {/* WELCOME */}

                    <div
                        className={
                            styles.dashboardWelcome
                        }
                    >
                        <h1>
                            Xin chào,{" "}
                            {
                                data.user
                                    .firstName
                            }{" "}

                            <span
                                aria-hidden="true"
                            >
                                👋
                            </span>
                        </h1>


                        <p>
                            Internova đồng hành cùng
                            bạn trong hành trình thực
                            tập hiệu quả và chuyên
                            nghiệp.
                        </p>
                    </div>


                    {/* AI FEATURES */}

                    <section
                        className={`${styles.dashboardPanel} ${styles.featureGrid}`}
                    >

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
                                Tư vấn học vụ
                                (RAG)
                            </h3>


                            <p>
                                Đặt câu hỏi về quy
                                trình, quy định, thủ
                                tục thực tập và nhận
                                câu trả lời từ hệ
                                thống.
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
                                Bắt đầu tư vấn

                                <ArrowRight
                                    size={15}
                                />
                            </button>
                        </article>


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
                                <FileCheck2
                                    size={28}
                                    strokeWidth={
                                        2
                                    }
                                />
                            </div>


                            <h3>
                                AI Review báo cáo
                            </h3>


                            <p>
                                Kiểm tra báo cáo thực
                                tập, phát hiện nội dung
                                còn thiếu và nhận gợi ý
                                cải thiện trước khi nộp.
                            </p>


                            <button
                                type="button"
                                className={
                                    styles.featureCta
                                }
                                onClick={() =>
                                    router.push(
                                        "/student/internship-report"
                                    )
                                }
                            >
                                Review báo cáo

                                <ArrowRight
                                    size={15}
                                />
                            </button>
                        </article>
                    </section>


                    {/* STATUS GRID */}

                    <section
                        className={`${styles.dashboardPanel} ${styles.statusGrid}`}
                    >

                        {/* INTERNSHIP */}

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
                                    Trạng thái
                                    thực tập
                                </h4>
                            </div>


                            {internship ? (
                                <>
                                    <span
                                        className={
                                            styles.statusPill
                                        }
                                    >
                                        {getInternshipStatus(
                                            internship.status
                                        )}
                                    </span>


                                    <dl
                                        className={
                                            styles.statusList
                                        }
                                    >
                                        <div
                                            className={
                                                styles.statusRow
                                            }
                                        >
                                            <dt>
                                                Công ty:
                                            </dt>

                                            <dd>
                                                {internship.companyName ??
                                                    "Chưa cập nhật"}
                                            </dd>
                                        </div>


                                        <div
                                            className={
                                                styles.statusRow
                                            }
                                        >
                                            <dt>
                                                Vị trí:
                                            </dt>

                                            <dd>
                                                {internship.positionTitle ??
                                                    "Chưa cập nhật"}
                                            </dd>
                                        </div>


                                        <div
                                            className={
                                                styles.statusRow
                                            }
                                        >
                                            <dt>
                                                Thời gian:
                                            </dt>

                                            <dd>
                                                {formatDate(
                                                    internship.startDate
                                                )}

                                                {" - "}

                                                {formatDate(
                                                    internship.endDate
                                                )}
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
                                        Xem chi tiết hồ sơ
                                    </button>
                                </>
                            ) : (
                                <div
                                    className={
                                        styles.emptyCard
                                    }
                                >
                                    <p>
                                        Bạn chưa có kỳ
                                        thực tập đang
                                        hoạt động.
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
                                        Đăng ký thực tập
                                    </button>
                                </div>
                            )}
                        </article>


                        {/* DEADLINES */}

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
                                    Deadline sắp tới
                                </h4>
                            </div>


                            {data.deadlines
                                .length >
                                0 ? (
                                <ul
                                    className={
                                        styles.deadlineList
                                    }
                                >
                                    {data.deadlines.map(
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
                                                            {item.subtitle ??
                                                                "Deadline"}
                                                        </p>
                                                    </div>


                                                    <div
                                                        className={
                                                            styles.deadlineDate
                                                        }
                                                    >
                                                        <p>
                                                            {formatDate(
                                                                item.dueAt
                                                            )}
                                                        </p>

                                                        <p>
                                                            {getDeadlineCountdown(
                                                                item.countdownDays
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </li>
                                        )
                                    )}
                                </ul>
                            ) : (
                                <div
                                    className={
                                        styles.emptyCard
                                    }
                                >
                                    <p>
                                        Không có
                                        deadline sắp
                                        tới.
                                    </p>
                                </div>
                            )}


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
                                Xem tất cả deadline
                            </button>
                        </article>


                        {/* WEEK PROGRESS */}

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
                                    Tiến độ tuần này
                                </h4>
                            </div>


                            {weekly.weekNumber ? (
                                <>
                                    <div
                                        className={
                                            styles.progressHeader
                                        }
                                    >
                                        <p>
                                            Tuần{" "}
                                            {
                                                weekly.weekNumber
                                            }{" "}

                                            <span>
                                                (
                                                {formatShortDate(
                                                    weekly.startDate
                                                )}

                                                {" - "}

                                                {formatShortDate(
                                                    weekly.endDate
                                                )}
                                                )
                                            </span>
                                        </p>


                                        <span
                                            className={
                                                styles.progressBadge
                                            }
                                        >
                                            {
                                                weekly.progressPercentage
                                            }
                                            %
                                        </span>
                                    </div>


                                    <div
                                        className={
                                            styles.progressBar
                                        }
                                    >
                                        <div
                                            className={
                                                styles.progressBarFill
                                            }
                                            style={{
                                                width:
                                                    `${weekly.progressPercentage}%`,
                                            }}
                                        />
                                    </div>


                                    <ul
                                        className={
                                            styles.checklist
                                        }
                                    >
                                        {weekly.tasks.map(
                                            (
                                                item
                                            ) => (
                                                <li
                                                    key={
                                                        item.id
                                                    }
                                                >
                                                    {item.done ? (
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
                                                    )}


                                                    <span>
                                                        {
                                                            item.label
                                                        }
                                                    </span>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </>
                            ) : (
                                <div
                                    className={
                                        styles.emptyCard
                                    }
                                >
                                    <p>
                                        Chưa có tiến
                                        độ tuần hiện
                                        tại.
                                    </p>
                                </div>
                            )}


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
                                Xem chi tiết tiến độ
                            </button>
                        </article>
                    </section>


                    {/* TIP */}

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
                                Mẹo:
                            </strong>{" "}

                            Hãy cập nhật tiến độ
                            thường xuyên và chủ động
                            trao đổi với mentor để có
                            trải nghiệm thực tập tốt
                            nhất!
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}
