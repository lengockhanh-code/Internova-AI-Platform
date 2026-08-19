"use client";

import {
    Activity,
    AlertTriangle,
    BarChart3,
    Bot,
    ChevronDown,
    ClipboardList,
    Database,
    FileText,
    Gauge,
    LayoutDashboard,
    LogOut,
    ScrollText,
    Settings,
    ShieldCheck,
    Sparkles,
    Users,
    UserRoundCog,
    Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./admin-sidebar.module.css";

type MenuChild = {
    label: string;
    href: string;
    icon?: LucideIcon;
};

type MenuLinkItem = {
    type: "link";
    label: string;
    href: string;
    icon: LucideIcon;
};

type MenuTreeItem = {
    type: "group";
    label: string;
    icon: LucideIcon;
    children: MenuChild[];
};

type MenuItem = MenuLinkItem | MenuTreeItem;

type MenuSection = {
    group: string;
    items: MenuItem[];
};

const MENU: MenuSection[] = [
    {
        group: "TỔNG QUAN",
        items: [
            {
                type: "link",
                label: "Dashboard",
                href: "/admin",
                icon: LayoutDashboard,
            },
        ],
    },
    {
        group: "QUẢN LÝ THỰC TẬP",
        items: [
            {
                type: "link",
                label: "Sinh viên",
                href: "/admin/students",
                icon: Users,
            },
            {
                type: "link",
                label: "Đăng ký thực tập",
                href: "/admin/internships",
                icon: ClipboardList,
            },
            {
                type: "link",
                label: "Báo cáo",
                href: "/admin/reports",
                icon: FileText,
            },
            {
                type: "link",
                label: "Form / Tài liệu",
                href: "/admin/forms",
                icon: ScrollText,
            },
            {
                type: "link",
                label: "Đánh giá",
                href: "/admin/evaluations",
                icon: ShieldCheck,
            },
        ],
    },
    {
        group: "AI & DATA",
        items: [
            {
                type: "group",
                label: "AI Monitoring",
                icon: Activity,
                children: [
                    {
                        label: "Overview",
                        href: "/admin/ai-monitoring",
                        icon: Gauge,
                    },
                    {
                        label: "RAG Analytics",
                        href: "/admin/ai-monitoring/rag",
                        icon: Workflow,
                    },
                    {
                        label: "LLM Usage & Cost",
                        href: "/admin/ai-monitoring/llm",
                        icon: BarChart3,
                    },
                    {
                        label: "Logs",
                        href: "/admin/ai-monitoring/logs",
                        icon: ScrollText,
                    },
                    {
                        label: "Traces",
                        href: "/admin/ai-monitoring/traces",
                        icon: Activity,
                    },
                    {
                        label: "Errors",
                        href: "/admin/ai-monitoring/errors",
                        icon: AlertTriangle,
                    },
                    {
                        label: "Alerts",
                        href: "/admin/ai-monitoring/alerts",
                        icon: ShieldCheck,
                    },
                ],
            },
            {
                type: "group",
                label: "Knowledge Base",
                icon: Database,
                children: [
                    {
                        label: "Documents",
                        href: "/admin/knowledge/documents",
                    },
                    {
                        label: "Chunks",
                        href: "/admin/knowledge/chunks",
                    },
                    {
                        label: "Index Status",
                        href: "/admin/knowledge/index-status",
                    },
                    {
                        label: "Re-index / Reload",
                        href: "/admin/knowledge/reindex",
                    },
                ],
            },
        ],
    },
    {
        group: "HỆ THỐNG",
        items: [
            {
                type: "link",
                label: "Users & Roles",
                href: "/admin/system/users",
                icon: UserRoundCog,
            },
            {
                type: "link",
                label: "Audit Logs",
                href: "/admin/system/audit-logs",
                icon: ScrollText,
            },
            {
                type: "link",
                label: "Configuration",
                href: "/admin/system/configuration",
                icon: Settings,
            },
        ],
    },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        "AI Monitoring": true,
        "Knowledge Base": false,
    });

    const isActive = (href: string): boolean => {
        if (href === "/admin") {
            return pathname === "/admin";
        }

        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const toggleGroup = (label: string) => {
        setOpenGroups((current) => ({
            ...current,
            [label]: !current[label],
        }));
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.brand}>
                <div className={styles.brandIcon}>
                    <Sparkles size={20} />
                </div>

                <div className={styles.brandText}>
                    <strong>Internova</strong>
                    <span>Admin Console</span>
                </div>
            </div>

            <div className={styles.adminBadge}>
                <div className={styles.adminBadgeIcon}>
                    <Bot size={17} />
                </div>

                <div>
                    <strong>AI Operations</strong>
                    <span>
                        <i className={styles.statusDot} />
                        Production
                    </span>
                </div>
            </div>

            <nav className={styles.nav}>
                {MENU.map((section) => (
                    <div key={section.group} className={styles.navGroup}>
                        <div className={styles.groupLabel}>
                            {section.group}
                        </div>

                        {section.items.map((item) => {
                            const Icon = item.icon;

                            if (item.type === "link") {
                                return (
                                    <Link
                                        key={item.label}
                                        href={item.href}
                                        className={`${styles.navItem} ${
                                            isActive(item.href)
                                                ? styles.active
                                                : ""
                                        }`}
                                    >
                                        <Icon size={18} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            }

                            const isOpen =
                                openGroups[item.label] ?? false;

                            const childActive =
                                item.children.some((child) =>
                                    isActive(child.href),
                                );

                            return (
                                <div
                                    key={item.label}
                                    className={styles.menuTree}
                                >
                                    <button
                                        type="button"
                                        className={`${styles.navItem} ${
                                            styles.treeButton
                                        } ${
                                            childActive
                                                ? styles.parentActive
                                                : ""
                                        }`}
                                        onClick={() =>
                                            toggleGroup(item.label)
                                        }
                                    >
                                        <Icon size={18} />
                                        <span>{item.label}</span>

                                        <ChevronDown
                                            size={16}
                                            className={`${styles.chevron} ${
                                                isOpen
                                                    ? styles.chevronOpen
                                                    : ""
                                            }`}
                                        />
                                    </button>

                                    <div
                                        className={`${styles.subMenuWrapper} ${
                                            isOpen
                                                ? styles.subMenuOpen
                                                : ""
                                        }`}
                                    >
                                        <div className={styles.subMenu}>
                                            {item.children.map((child) => {
                                                const ChildIcon =
                                                    child.icon;

                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        className={`${styles.subItem} ${
                                                            isActive(
                                                                child.href,
                                                            )
                                                                ? styles.subActive
                                                                : ""
                                                        }`}
                                                    >
                                                        {ChildIcon ? (
                                                            <ChildIcon
                                                                size={15}
                                                            />
                                                        ) : (
                                                            <span
                                                                className={
                                                                    styles.subDot
                                                                }
                                                            />
                                                        )}

                                                        <span>
                                                            {child.label}
                                                        </span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className={styles.sidebarFooter}>
                <button
                    type="button"
                    className={styles.logoutButton}
                    onClick={() => {
                        localStorage.removeItem("internova_access_token");
                        localStorage.removeItem("internova_user");
                        router.push("/admin/login");
                    }}
                >
                    <LogOut size={18} />
                    <span>Đăng xuất</span>
                </button>
            </div>
        </aside>
    );
}