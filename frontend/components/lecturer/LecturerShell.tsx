"use client";

import {
  Bell,
  Bot,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Star,
  UsersRound,
  X,
} from "lucide-react";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { lecturerFetch as fetch } from "@/lib/lecturerAuth";
import {
  fetchLecturerUnreadCount,
  subscribeLecturerUnreadCount,
} from "@/lib/lecturerNotifications";

import LecturerLanguageSwitcher from "./LecturerLanguageSwitcher";
import styles from "./LecturerShell.module.css";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

interface LecturerInfo {
  fullName: string;
  academicTitle: string | null;
  specialization: string | null;
}

interface DashboardResponse {
  lecturer?: Partial<LecturerInfo>;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  href?: string;
}

const managementItems: NavItem[] = [
  {
    label: "Tổng quan",
    icon: LayoutDashboard,
    href: "/lecturer/dashboard",
  },
  {
    label: "Sinh viên của tôi",
    icon: UsersRound,
    href: "/lecturer/students",
  },
  {
    label: "Đợt thực tập",
    icon: CalendarDays,
    href: "/lecturer/internship-periods",
  },
  {
    label: "Hồ sơ đăng ký",
    icon: ClipboardCheck,
    href: "/lecturer/applications",
  },
  {
    label: "Nhật ký & Báo cáo",
    icon: FileText,
    href: "/lecturer/reports",
  },
  {
    label: "Đánh giá",
    icon: Star,
    href: "/lecturer/evaluations",
  },
  {
    label: "Nhắc nhở & Cảnh báo",
    icon: Bell,
    href: "/lecturer/reminders",
  },
];

const aiItems: NavItem[] = [
  {
    label: "Trợ lý AI",
    icon: Bot,
  },
];

function getInitials(fullName: string): string {
  const name = fullName.trim();

  if (!name) {
    return "GV";
  }

  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function SidebarSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <section className={styles.sidebarSection}>
      <p className={styles.sidebarLabel}>{title}</p>

      <div className={styles.navList}>
        {items.map((item) => {
          const Icon = item.icon;

          const active = item.href
            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
            : false;

          return (
            <button
              className={`${styles.navItem} ${
                active ? styles.navItemActive : ""
              }`}
              key={item.label}
              onClick={() => {
                if (item.href) {
                  onNavigate(item.href);
                }
              }}
              type="button"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{item.label}</span>

              {!item.href && (
                <ChevronDown
                  className={styles.itemChevron}
                  size={15}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function LecturerShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [lecturer, setLecturer] = useState<LecturerInfo>({
    fullName: "Giảng viên",
    academicTitle: null,
    specialization: null,
  });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHeader() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/lecturers/dashboard`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as DashboardResponse;

        setLecturer({
          fullName:
            typeof data.lecturer?.fullName === "string"
              ? data.lecturer.fullName
              : "Giảng viên",
          academicTitle:
            typeof data.lecturer?.academicTitle === "string"
              ? data.lecturer.academicTitle
              : null,
          specialization:
            typeof data.lecturer?.specialization === "string"
              ? data.lecturer.specialization
              : null,
        });

      } catch {
        // Header vẫn render với fallback nếu backend tạm thời lỗi.
      }
    }

    void loadHeader();
    const refreshUnreadCount = () => {
      void fetchLecturerUnreadCount()
        .then(setUnreadCount)
        .catch(() => undefined);
    };
    refreshUnreadCount();
    const unsubscribe = subscribeLecturerUnreadCount(setUnreadCount);
    const interval = window.setInterval(refreshUnreadCount, 60_000);
    window.addEventListener("focus", refreshUnreadCount);

    return () => {
      controller.abort();
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshUnreadCount);
    };
  }, []);

  const displayName = useMemo(() => {
    if (lecturer.academicTitle) {
      return `${lecturer.academicTitle}. ${lecturer.fullName}`;
    }

    return lecturer.fullName;
  }, [lecturer]);

  function navigate(href: string) {
    setMobileOpen(false);
    router.push(href);
  }

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${
          mobileOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Image
              alt="AI Internova logo"
              height={46}
              priority
              src="/vinuni-internship-logo.svg"
              width={46}
            />
          </div>

          <div className={`${styles.brandText} notranslate`} translate="no">
            <strong>AI Internova</strong>
            <span>Hỗ trợ thực tập sinh viên</span>
          </div>

          <button
            aria-label="Đóng menu"
            className={styles.mobileClose}
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <SidebarSection
          items={managementItems}
          onNavigate={navigate}
          pathname={pathname}
          title="QUẢN LÝ"
        />

        <SidebarSection
          items={aiItems}
          onNavigate={navigate}
          pathname={pathname}
          title="AI HỖ TRỢ"
        />

        <section className={styles.sidebarSection}>
          <p className={styles.sidebarLabel}>CÀI ĐẶT</p>

          <div className={styles.navList}>
            <button
              className={`${styles.navItem} ${
                pathname === "/lecturer/notifications" ? styles.navItemActive : ""
              }`}
              onClick={() => navigate("/lecturer/notifications")}
              type="button"
            >
              <Bell size={19} />
              <span>Thông báo</span>
            </button>

            <button
              className={`${styles.navItem} ${
                pathname === "/lecturer/settings" ? styles.navItemActive : ""
              }`}
              onClick={() => navigate("/lecturer/settings")}
              type="button"
            >
              <Settings size={19} />
              <span>Cài đặt cá nhân</span>
            </button>
          </div>
        </section>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Đóng menu"
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              aria-label="Mở menu"
              className={styles.menuButton}
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu size={22} />
            </button>

            <Menu className={styles.desktopMenu} size={22} />

            <strong className={styles.pageTitle}>{title}</strong>
          </div>

          <div className={styles.topbarRight}>
            <LecturerLanguageSwitcher />

            <button
              aria-label="Tìm kiếm"
              className={styles.iconButton}
              type="button"
            >
              <Search size={20} />
            </button>

            <button
              aria-label="Thông báo"
              className={styles.notificationButton}
              onClick={() => navigate("/lecturer/notifications")}
              type="button"
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span>{Math.min(unreadCount, 99)}</span>
              )}
            </button>

            <div className={styles.account}>
              <div className={styles.accountAvatar}>
                {getInitials(lecturer.fullName)}
              </div>

              <div className={styles.accountText}>
                <strong>{displayName}</strong>
                <span>
                  {lecturer.specialization || "Giảng viên"}
                </span>
              </div>

              <ChevronDown size={17} />
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
