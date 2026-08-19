"use client";

import {
    Bell,
    ChevronDown,
    GraduationCap,
    Menu,
    User,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
    useEffect,
    useState,
} from "react";

import styles from "./header.module.css";
import {
    fetchStudentUnreadCount,
    subscribeStudentNotificationEvents,
    subscribeStudentUnreadCount,
} from "@/lib/studentNotifications";


const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:8000";


interface UserInfo {
    fullName: string;
    role: string;
    avatarUrl?: string | null;
}


export default function Header() {
    const router = useRouter();
    const [user, setUser] =
        useState<UserInfo | null>(null);
    const [unreadCount, setUnreadCount] =
        useState(0);


    useEffect(() => {
        async function fetchUser() {
            const token =
                localStorage.getItem(
                    "internova_access_token"
                );


            if (!token) {
                return;
            }


            try {
                const response =
                    await fetch(
                        `${API_BASE_URL}/api/v1/auth/me`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                if (response.status === 401) {
                    localStorage.removeItem("internova_access_token");
                    localStorage.removeItem("internova_user");
                    window.alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");
                    window.location.replace("/auth/login");
                    return;
                }

                if (!response.ok) {
                    return;
                }


                const data =
                    await response.json();


                setUser(data);

            } catch (error) {
                console.error(
                    "Không thể tải thông tin người dùng:",
                    error
                );
            }
        }


        void fetchUser();
    }, []);


    useEffect(() => {
        if (user?.role !== "STUDENT") {
            return;
        }

        let active = true;
        void fetchStudentUnreadCount()
            .then((count) => {
                if (active) setUnreadCount(count);
            })
            .catch(() => undefined);

        const unsubscribeRealtime =
            subscribeStudentNotificationEvents(
                () => setUnreadCount((count) => count + 1),
            );
        const unsubscribeCount =
            subscribeStudentUnreadCount(setUnreadCount);

        return () => {
            active = false;
            unsubscribeRealtime();
            unsubscribeCount();
        };
    }, [user?.role]);


    function getRoleLabel(
        role?: string
    ) {
        switch (role) {
            case "STUDENT":
                return "Sinh viên";

            case "LECTURER":
                return "Giảng viên";

            case "ADMIN":
                return "Quản trị viên";

            default:
                return "Người dùng";
        }
    }


    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <button
                    aria-label="Mở menu"
                    className={styles.mobileMenuButton}
                    onClick={() => window.dispatchEvent(
                        new Event("internova:toggle-student-sidebar"),
                    )}
                    type="button"
                >
                    <Menu size={20} />
                </button>

                <span
                    className={
                        styles.logoIcon
                    }
                >
                    <GraduationCap
                        size={22}
                    />
                </span>

                <div
                    className={
                        styles.logoText
                    }
                >
                    <strong>
                        Internova
                    </strong>

                    <span>
                        Internship Assistant
                    </span>
                </div>
            </div>


            <div
                className={
                    styles.headerRight
                }
            >
                {user && (
                    <>
                        {user.role === "STUDENT" && (
                            <button
                                aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ""}`}
                                className={styles.notificationButton}
                                onClick={() => router.push("/student/notification")}
                                title="Lịch và thông báo"
                                type="button"
                            >
                                <Bell size={19} />
                                {unreadCount > 0 && (
                                    <span>{unreadCount > 99 ? "99+" : unreadCount}</span>
                                )}
                            </button>
                        )}

                        <div
                            className={
                                styles.headerBadge
                            }
                        >
                            <span
                                className={
                                    styles.roleDot
                                }
                            />

                            {getRoleLabel(
                                user.role
                            )}
                        </div>


                        <button
                            type="button"
                            className={
                                styles.headerUser
                            }
                        >
                            <span
                                className={
                                    styles.headerAvatar
                                }
                            >
                                {user.avatarUrl ? (
                                    <img
                                        src={
                                            user.avatarUrl
                                        }
                                        alt={
                                            user.fullName
                                        }
                                    />
                                ) : (
                                    <User
                                        size={17}
                                    />
                                )}
                            </span>


                            <span
                                className={
                                    styles.userInfo
                                }
                            >
                                <strong>
                                    {
                                        user.fullName
                                    }
                                </strong>

                                <small>
                                    {
                                        getRoleLabel(
                                            user.role
                                        )
                                    }
                                </small>
                            </span>


                            <ChevronDown
                                size={16}
                                className={
                                    styles.headerChevron
                                }
                            />
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
