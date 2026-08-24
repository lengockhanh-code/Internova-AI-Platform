"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
    Home,
    FileText,
    BarChart2,
    ClipboardList,
    Bot,
    BriefcaseBusiness,
    Bell,
    Settings,
    X,
} from "lucide-react";

import styles from "./sidebar.module.css";
import { useSettings } from "@/context/settings-provider";

const translationMap: Record<string, string> = {
    "TỔNG QUAN": "sidebar.overview",
    "THỰC TẬP": "sidebar.internship",
    "HỖ TRỢ AI": "sidebar.ai_support",
    "CÁ NHÂN": "sidebar.personal",
    "Dashboard": "sidebar.dashboard",
    "Đăng ký thực tập": "sidebar.register",
    "Hồ sơ thực tập": "sidebar.profile",
    "Báo cáo": "sidebar.report",
    "Checklist": "sidebar.checklist",
    "Hỏi đáp AI": "sidebar.chatbot",
    "Lịch & Thông báo": "sidebar.notifications",
    "Cài đặt": "sidebar.settings"
};

const navGroups = [
    {
        title: "TỔNG QUAN",
        items: [
            {
                label: "Dashboard",
                href: "/student/dashboard",
                icon: Home,
            },
        ],
    },
    {
        title: "THỰC TẬP",
        items: [
            {
                label: "Đăng ký thực tập",
                href: "/student/internship-registration",
                icon: BriefcaseBusiness,
            },
            {
                label: "Hồ sơ thực tập",
                href: "/student/internship-profile",
                icon: FileText,
            },
            {
                label: "Báo cáo",
                href: "/student/internship-report",
                icon: BarChart2,
            },
            {
                label: "Checklist",
                href: "/student/checklist",
                icon: ClipboardList,
            },
        ],
    },
    {
        title: "HỖ TRỢ AI",
        items: [
            {
                label: "Hỏi đáp AI",
                href: "/student/chatbot",
                icon: Bot,
            },
        ],
    },
    {
        title: "CÁ NHÂN",
        items: [
            {
                label: "Lịch & Thông báo",
                href: "/student/notification",
                icon: Bell,
            },
            {
                label: "Cài đặt",
                href: "/student/internship-setting",
                icon: Settings,
            },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { t } = useSettings();

    const [mobileOpen, setMobileOpen] =
        useState(false);

    useEffect(() => {
        const toggleSidebar = () =>
            setMobileOpen(
                (open) => !open
            );

        window.addEventListener(
            "internova:toggle-student-sidebar",
            toggleSidebar,
        );

        return () => {
            window.removeEventListener(
                "internova:toggle-student-sidebar",
                toggleSidebar,
            );
        };
    }, []);

    const isActive = (
        href: string
    ) => {
        return (
            pathname === href ||
            pathname.startsWith(
                `${href}/`
            )
        );
    };

    return (
        <>
            <aside
                className={`${styles.sidebar} ${
                    mobileOpen
                        ? styles.mobileOpen
                        : ""
                } notranslate`}
                translate="no"
            >
                <div>
                    <div
                        className={
                            styles.sidebarLogo
                        }
                    >
                        <Link
                            href="/student/dashboard"
                            className={
                                styles.logoBrandLink
                            }
                            onClick={() =>
                                setMobileOpen(
                                    false
                                )
                            }
                        >
                            <Image
                                src="/vinuni-internship-logo.svg"
                                alt="Internova for VinUni logo"
                                width={40}
                                height={40}
                                loading="eager"
                            />

                            <span className="notranslate" translate="no">
                                AI Internova
                            </span>
                        </Link>

                        <button
                            aria-label="Đóng menu"
                            className={
                                styles.mobileCloseButton
                            }
                            onClick={() =>
                                setMobileOpen(
                                    false
                                )
                            }
                            type="button"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <nav
                        className={
                            styles.sidebarNav
                        }
                    >
                        {navGroups.map(
                            (group) => (
                                <div
                                    key={
                                        group.title
                                    }
                                    className={
                                        styles.navGroup
                                    }
                                >
                                    <p
                                        className={
                                            styles.navGroupTitle
                                        }
                                    >
                                        {
                                            t(translationMap[group.title] || group.title)
                                        }
                                    </p>

                                    <div
                                        className={
                                            styles.navGroupItems
                                        }
                                    >
                                        {group.items.map(
                                            ({
                                                label,
                                                href,
                                                icon: Icon,
                                            }) => (
                                                <Link
                                                    key={
                                                        href
                                                    }
                                                    href={
                                                        href
                                                    }
                                                    className={`${styles.sidebarNavItem} ${
                                                        isActive(
                                                            href
                                                        )
                                                            ? styles.active
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        setMobileOpen(
                                                            false
                                                        )
                                                    }
                                                >
                                                    <Icon
                                                        size={
                                                            19
                                                        }
                                                        strokeWidth={
                                                            2
                                                        }
                                                    />

                                                    <span>
                                                        {
                                                            t(translationMap[label] || label)
                                                        }
                                                    </span>
                                                </Link>
                                            )
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </nav>
                </div>

                <div
                    className={
                        styles.sidebarFooterCard
                    }
                >
                    <Image
                        src="/vinuni-internship-logo.svg"
                        alt="AI Internova logo"
                        width={40}
                        height={40}
                        className={
                            styles.sidebarFooterIcon
                        }
                    />

                    <p
                        className={`${styles.sidebarFooterTitle} notranslate`}
                        translate="no"
                    >
                        AI Internova
                    </p>
                </div>
            </aside>

            {mobileOpen && (
                <button
                    aria-label="Đóng menu"
                    className={
                        styles.mobileOverlay
                    }
                    onClick={() =>
                        setMobileOpen(false)
                    }
                    type="button"
                />
            )}
        </>
    );
}
