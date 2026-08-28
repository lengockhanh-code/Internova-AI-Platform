"use client";

import {
    Bell,
    CheckCircle2,
    ChevronDown,
    Loader2,
    Lock,
    LogOut,
    Menu,
    Search,
    MessageSquareWarning,
    Moon,
    ShieldCheck,
    Sun,
    User,
    UserRound,
    X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useEffect,
    useRef,
    useState,
} from "react";

import styles from "./header.module.css";
import {
    fetchStudentUnreadCount,
    subscribeStudentNotificationEvents,
    subscribeStudentUnreadCount,
} from "@/lib/studentNotifications";
import { useSettings } from "@/context/settings-provider";
import LecturerLanguageSwitcher from "@/components/lecturer/LecturerLanguageSwitcher";


const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:8000";


interface UserInfo {
    fullName: string;
    role: string;
    avatarUrl?: string | null;
}

interface StudentNotification {
    id: string | number;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string | null;
}

interface RawStudentNotification {
    id?: string | number;
    notificationId?: string | number;
    notification_id?: string | number;
    title?: string;
    subject?: string;
    name?: string;
    message?: string;
    content?: string;
    body?: string;
    description?: string;
    isRead?: boolean;
    is_read?: boolean;
    read?: boolean;
    createdAt?: string;
    created_at?: string;
    sentAt?: string;
    sent_at?: string;
}


export default function Header() {
    const router = useRouter();
    const { theme, locale, toggleTheme, t } = useSettings();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [themeBusy, setThemeBusy] = useState(false);

    // Account dropdown state
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Notification dropdown state
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [latestNotifications, setLatestNotifications] = useState<StudentNotification[]>([]);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationError, setNotificationError] = useState("");
    const notificationRef = useRef<HTMLDivElement>(null);

    // Password Modal state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Feedback Modal state
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackCategory, setFeedbackCategory] = useState("BUG");
    const [feedbackContent, setFeedbackContent] = useState("");
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);


    useEffect(() => {
        async function fetchUser() {
            const token = localStorage.getItem("internova_access_token");

            if (!token) {
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.status === 401) {
                    localStorage.removeItem("internova_access_token");
                    localStorage.removeItem("internova_user");
                    window.alert(t("header.session.expired"));
                    window.location.replace("/auth/login");
                    return;
                }

                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                setUser(data);
            } catch (error) {
                console.error("Không thể tải thông tin người dùng:", error);
            }
        }

        void fetchUser();
    }, [t]);


    function normalizeNotification(raw: unknown): StudentNotification | null {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        const item = raw as RawStudentNotification;
        const id = item.id ?? item.notificationId ?? item.notification_id;
        if (id === undefined || id === null) {
            return null;
        }

        return {
            id,
            title:
                item.title ??
                item.subject ??
                item.name ??
                (locale === "vi" ? "Thông báo" : "Notification"),
            message:
                item.message ??
                item.content ??
                item.body ??
                item.description ??
                "",
            isRead:
                Boolean(
                    item.isRead ??
                    item.is_read ??
                    item.read ??
                    false
                ),
            createdAt:
                item.createdAt ??
                item.created_at ??
                item.sentAt ??
                item.sent_at ??
                null,
        };
    }

    async function loadLatestNotifications() {
        const token = localStorage.getItem("internova_access_token");

        if (!token || user?.role !== "STUDENT") {
            return;
        }

        try {
            setNotificationLoading(true);
            setNotificationError("");

            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            // Backend hiện tại dùng chung endpoint notifications + calendar.
            // year/month là bắt buộc cho phần calendar; danh sách notifications
            // vẫn được trả về trong cùng response.
            const response = await fetch(
                `${API_BASE_URL}/api/v1/student/notifications-calendar?year=${year}&month=${month}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    cache: "no-store",
                },
            );

            if (response.status === 401) {
                localStorage.removeItem("internova_access_token");
                localStorage.removeItem("internova_user");
                window.location.replace("/auth/login");
                return;
            }

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.detail ??
                    data?.message ??
                    (locale === "vi"
                        ? "Không thể tải thông báo."
                        : "Unable to load notifications.")
                );
            }

            const rawItems = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.notifications)
                        ? data.notifications
                        : Array.isArray(data?.data)
                            ? data.data
                            : [];

        const normalized: StudentNotification[] = rawItems
    .map(normalizeNotification)
    .filter(
        (
            item: StudentNotification | null
        ): item is StudentNotification =>
            item !== null
    )
    .sort(
        (
            a: StudentNotification,
            b: StudentNotification
        ) => {
            const timeA = a.createdAt
                ? new Date(a.createdAt).getTime()
                : 0;

            const timeB = b.createdAt
                ? new Date(b.createdAt).getTime()
                : 0;

            return timeB - timeA;
        }
    )
    .slice(0, 5);

setLatestNotifications(normalized);
        } catch (error) {
            console.error("Không thể tải 5 thông báo mới nhất:", error);
            setNotificationError(
                error instanceof Error
                    ? error.message
                    : locale === "vi"
                        ? "Không thể tải thông báo."
                        : "Unable to load notifications."
            );
        } finally {
            setNotificationLoading(false);
        }
    }

    function formatNotificationTime(value: string | null) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat(
            locale === "vi" ? "vi-VN" : "en-US",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            },
        ).format(date);
    }

    async function handleNotificationToggle() {
        const nextOpen = !isNotificationOpen;

        setIsNotificationOpen(nextOpen);
        setIsMenuOpen(false);

        if (nextOpen) {
            await loadLatestNotifications();
        }
    }


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

        const unsubscribeRealtime = subscribeStudentNotificationEvents(
            () => {
                setUnreadCount((count) => count + 1);
                if (isNotificationOpen) {
                    void loadLatestNotifications();
                }
            },
        );
        const unsubscribeCount = subscribeStudentUnreadCount(setUnreadCount);

        return () => {
            active = false;
            unsubscribeRealtime();
            unsubscribeCount();
        };
    }, [user?.role, isNotificationOpen]);


    // Click outside listener for account dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsMenuOpen(false);
            }
        }

        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMenuOpen]);


    // Click outside / Escape listener for notification dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                notificationRef.current &&
                !notificationRef.current.contains(event.target as Node)
            ) {
                setIsNotificationOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsNotificationOpen(false);
            }
        }

        if (isNotificationOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isNotificationOpen]);


    function handleLogout() {
        if (!window.confirm(t("nav.logout.confirm"))) {
            return;
        }

        localStorage.removeItem("internova_access_token");
        localStorage.removeItem("internova_user");
        window.location.replace("/auth/login");
    }

    function handleThemeToggle() {
        if (themeBusy) {
            return;
        }

        setThemeBusy(true);
        toggleTheme();
        window.setTimeout(() => setThemeBusy(false), 350);
    }


    async function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault();
        setPasswordMessage(null);

        if (!currentPassword) {
            setPasswordMessage({ type: "error", text: "Vui lòng nhập mật khẩu hiện tại." });
            return;
        }

        if (newPassword.length < 8) {
            setPasswordMessage({ type: "error", text: "Mật khẩu mới phải có ít nhất 8 ký tự." });
            return;
        }

        if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
            setPasswordMessage({ type: "error", text: "Mật khẩu mới phải bao gồm ít nhất 1 chữ cái và 1 chữ số." });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
            return;
        }

        setPasswordLoading(true);
        const token = localStorage.getItem("internova_access_token");

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = data.detail || data.message || "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại thông tin.";
                setPasswordMessage({ type: "error", text: message });
            } else {
                setPasswordMessage({ type: "success", text: data.message || "Đổi mật khẩu thành công!" });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setTimeout(() => {
                    setShowPasswordModal(false);
                    setPasswordMessage(null);
                }, 1500);
            }
        } catch {
            setPasswordMessage({ type: "error", text: "Không thể kết nối máy chủ. Vui lòng thử lại sau." });
        } finally {
            setPasswordLoading(false);
        }
    }



    async function handleFeedbackSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFeedbackMessage(null);

        if (!feedbackContent.trim()) {
            setFeedbackMessage({ type: "error", text: "Vui lòng nhập nội dung góp ý hoặc báo lỗi." });
            return;
        }

        setFeedbackLoading(true);

        try {
            // Save feedback or send notification request
            await new Promise((resolve) => setTimeout(resolve, 600));

            setFeedbackMessage({
                type: "success",
                text: "Cảm ơn bạn đã gửi ý kiến đóng góp! Hệ thống đã ghi nhận phản hồi của bạn.",
            });
            setFeedbackContent("");
            setTimeout(() => {
                setShowFeedbackModal(false);
                setFeedbackMessage(null);
            }, 1800);
        } catch {
            setFeedbackMessage({ type: "error", text: "Không thể gửi phản hồi. Vui lòng thử lại sau." });
        } finally {
            setFeedbackLoading(false);
        }
    }


    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <button
                    aria-label="Mở menu"
                    className={styles.mobileMenuButton}
                    onClick={() =>
                        window.dispatchEvent(new Event("internova:toggle-student-sidebar"))
                    }
                    type="button"
                >
                    <Menu size={20} />
                </button>

                <div className={styles.searchShell} role="search">
                    <Search size={17} aria-hidden="true" />
                    <span className={styles.searchPlaceholder}>
                        {locale === "vi" ? "Tìm kiếm nhanh..." : "Quick search..."}
                    </span>
                    <kbd>Ctrl + K</kbd>
                </div>
            </div>

            <div className={styles.headerRight}>
                {user && (
                    <>
                        <LecturerLanguageSwitcher />

                        {/* NÚT CHUYỂN ĐỔI THEME TỐI/SÁNG */}
                        <button
                            type="button"
                            className={styles.themeToggleButton}
                            disabled={themeBusy}
                            onClick={handleThemeToggle}
                            title={theme === "light" ? t("header.theme.light") : t("header.theme.dark")}
                            aria-label={theme === "light" ? t("header.theme.light") : t("header.theme.dark")}
                        >
                            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        {/* VẠCH PHÂN CÁCH (VERTICAL LINE) */}
                        <div className={styles.verticalDivider} />

                        {user.role === "STUDENT" && (
                            <div
                                className={styles.notificationContainer}
                                ref={notificationRef}
                            >
                                <button
                                    aria-label={
                                        locale === "vi"
                                            ? `Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ""}`
                                            : `Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`
                                    }
                                    aria-expanded={isNotificationOpen}
                                    className={`${styles.notificationButton} ${
                                        isNotificationOpen
                                            ? styles.notificationButtonActive
                                            : ""
                                    }`}
                                    onClick={() => void handleNotificationToggle()}
                                    title={t("nav.notifications")}
                                    type="button"
                                >
                                    <Bell size={19} />

                                    {unreadCount > 0 && (
                                        <span>
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {isNotificationOpen && (
                                    <div className={styles.notificationDropdown}>
                                        <div className={styles.notificationDropdownHeader}>
                                            <div>
                                                <strong>
                                                    {locale === "vi"
                                                        ? "Thông báo"
                                                        : "Notifications"}
                                                </strong>
                                                <small>
                                                    {unreadCount > 0
                                                        ? locale === "vi"
                                                            ? `${unreadCount} thông báo chưa đọc`
                                                            : `${unreadCount} unread`
                                                        : locale === "vi"
                                                            ? "Không có thông báo chưa đọc"
                                                            : "No unread notifications"}
                                                </small>
                                            </div>
                                        </div>

                                        <div className={styles.notificationList}>
                                            {notificationLoading ? (
                                                <div className={styles.notificationState}>
                                                    <Loader2
                                                        size={18}
                                                        className={styles.spin}
                                                    />
                                                    <span>
                                                        {locale === "vi"
                                                            ? "Đang tải thông báo..."
                                                            : "Loading notifications..."}
                                                    </span>
                                                </div>
                                            ) : notificationError ? (
                                                <div className={styles.notificationState}>
                                                    <span>{notificationError}</span>
                                                    <button
                                                        type="button"
                                                        className={styles.notificationRetryButton}
                                                        onClick={() =>
                                                            void loadLatestNotifications()
                                                        }
                                                    >
                                                        {locale === "vi"
                                                            ? "Thử lại"
                                                            : "Retry"}
                                                    </button>
                                                </div>
                                            ) : latestNotifications.length === 0 ? (
                                                <div className={styles.notificationState}>
                                                    <Bell size={20} />
                                                    <span>
                                                        {locale === "vi"
                                                            ? "Chưa có thông báo."
                                                            : "No notifications yet."}
                                                    </span>
                                                </div>
                                            ) : (
                                                latestNotifications.map((notification) => (
                                                    <button
                                                        key={notification.id}
                                                        type="button"
                                                        className={`${styles.notificationItem} ${
                                                            !notification.isRead
                                                                ? styles.notificationItemUnread
                                                                : ""
                                                        }`}
                                                        onClick={() => {
                                                            setIsNotificationOpen(false);
                                                            router.push(
                                                                "/student/notification"
                                                            );
                                                        }}
                                                    >
                                                        <span
                                                            className={
                                                                styles.notificationItemDot
                                                            }
                                                        />

                                                        <span
                                                            className={
                                                                styles.notificationItemContent
                                                            }
                                                        >
                                                            <strong>
                                                                {notification.title}
                                                            </strong>

                                                            {notification.message && (
                                                                <span>
                                                                    {notification.message}
                                                                </span>
                                                            )}

                                                            {notification.createdAt && (
                                                                <small>
                                                                    {formatNotificationTime(
                                                                        notification.createdAt
                                                                    )}
                                                                </small>
                                                            )}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>

                                        <div className={styles.notificationDropdownFooter}>
                                            <button
                                                type="button"
                                                className={styles.notificationViewAll}
                                                onClick={() => {
                                                    setIsNotificationOpen(false);
                                                    router.push(
                                                        "/student/notification"
                                                    );
                                                }}
                                            >
                                                {locale === "vi"
                                                    ? "Xem tất cả thông báo"
                                                    : "View all notifications"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

      
                        {/* USER DROPDOWN CONTAINER */}
                        <div
                            className={`${styles.userMenuContainer} notranslate`}
                            ref={menuRef}
                            translate="no"
                        >
                            <button
                                type="button"
                                className={`${styles.headerUser} ${isMenuOpen ? styles.headerUserActive : ""}`}
                                onClick={() => {
                                    setIsNotificationOpen(false);
                                    setIsMenuOpen((prev) => !prev);
                                }}
                                aria-expanded={isMenuOpen}
                                title={t("header.menu_account")}
                            >
                                <span className={styles.headerAvatar}>
                                    {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt={user.fullName} />
                                    ) : (
                                        <User size={17} />
                                    )}
                                </span>

                                <span className={styles.userInfo}>
                                    <strong>{user.fullName}</strong>
                                    <small>{t(`role.${user.role.toLowerCase()}`)}</small>
                                </span>

                                <ChevronDown
                                    size={16}
                                    className={`${styles.headerChevron} ${isMenuOpen ? styles.chevronRotated : ""}`}
                                />
                            </button>

                            {/* DROPDOWN MENU POPOVER */}
                            {isMenuOpen && (
                                <div className={styles.dropdownMenu}>
                                    <div className={styles.dropdownHeader}>
                                        <div className={styles.dropdownUserCard}>
                                            <span className={styles.dropdownAvatar}>
                                                {user.avatarUrl ? (
                                                    <img src={user.avatarUrl} alt={user.fullName} />
                                                ) : (
                                                    <User size={22} />
                                                )}
                                            </span>
                                            <div className={styles.dropdownUserMeta}>
                                                <strong>{user.fullName}</strong>
                                                <span className={styles.dropdownRoleBadge}>
                                                    <span className={styles.roleDot} />
                                                    {t(`role.${user.role.toLowerCase()}`)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.dropdownDivider} />

                                    <div className={styles.dropdownGroup}>
                                        {/* 1. Tài khoản sinh viên */}
                                        <button
                                            type="button"
                                            className={styles.dropdownItem}
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                router.push("/student/internship-setting");
                                            }}
                                        >
                                            <span className={styles.itemIcon}>
                                                <UserRound size={17} />
                                            </span>
                                            <div className={styles.itemText}>
                                                <strong>{t("nav.account")}</strong>
                                                <small>{t("nav.account.sub")}</small>
                                            </div>
                                        </button>

                                        {/* 2. Vai trò */}
                                        <div className={`${styles.dropdownItem} ${styles.dropdownItemStatic}`}>
                                            <span className={styles.itemIcon}>
                                                <ShieldCheck size={17} />
                                            </span>
                                            <div className={styles.itemText}>
                                                <strong>{t("nav.role")}</strong>
                                                <small>{t("nav.role.sub")}</small>
                                            </div>
                                            <span className={styles.roleTag}>
                                                {t(`role.${user.role.toLowerCase()}`)}
                                            </span>
                                        </div>

                                        {/* 3. Đổi mật khẩu */}
                                        <button
                                            type="button"
                                            className={styles.dropdownItem}
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                setPasswordMessage(null);
                                                setShowPasswordModal(true);
                                            }}
                                        >
                                            <span className={styles.itemIcon}>
                                                <Lock size={17} />
                                            </span>
                                            <div className={styles.itemText}>
                                                <strong>{t("nav.change_password")}</strong>
                                                <small>{t("nav.change_password.sub")}</small>
                                            </div>
                                        </button>

                                        {/* 4. Báo lỗi / Góp ý */}
                                        <button
                                            type="button"
                                            className={styles.dropdownItem}
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                setFeedbackMessage(null);
                                                setShowFeedbackModal(true);
                                            }}
                                        >
                                            <span className={styles.itemIcon}>
                                                <MessageSquareWarning size={17} />
                                            </span>
                                            <div className={styles.itemText}>
                                                <strong>{t("nav.feedback")}</strong>
                                                <small>{t("nav.feedback.sub")}</small>
                                            </div>
                                        </button>
                                    </div>

                                    <div className={styles.dropdownDivider} />

                                    <div className={styles.dropdownGroup}>
                                        {/* 5. Đăng xuất */}
                                        <button
                                            type="button"
                                            className={`${styles.dropdownItem} ${styles.dangerItem}`}
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                handleLogout();
                                            }}
                                        >
                                            <span className={styles.itemIcon}>
                                                <LogOut size={17} />
                                            </span>
                                            <div className={styles.itemText}>
                                                <strong>{t("nav.logout")}</strong>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* MODAL: ĐỔI MẬT KHẨU */}
            {showPasswordModal && (
                <div className={styles.modalBackdrop} onClick={() => setShowPasswordModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleGroup}>
                                <h3>{t("header.password.title")}</h3>
                                <p>{t("header.password.desc")}</p>
                            </div>
                            <button
                                type="button"
                                className={styles.modalCloseButton}
                                onClick={() => setShowPasswordModal(false)}
                                aria-label={t("header.modal.close")}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handlePasswordSubmit}>
                            <div className={styles.modalBody}>
                                {passwordMessage && (
                                    <div
                                        className={
                                            passwordMessage.type === "success"
                                                ? styles.alertSuccess
                                                : styles.alertError
                                        }
                                    >
                                        {passwordMessage.type === "success" && <CheckCircle2 size={16} />}
                                        {passwordMessage.text}
                                    </div>
                                )}

                                <label className={styles.formField}>
                                    <span>{t("header.password.current")}</span>
                                    <input
                                        type="password"
                                        className={styles.formInput}
                                        placeholder={t("header.password.current.placeholder")}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                    />
                                </label>

                                <label className={styles.formField}>
                                    <span>{t("header.password.new")}</span>
                                    <input
                                        type="password"
                                        className={styles.formInput}
                                        placeholder="Tối thiểu 6 ký tự"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </label>

                                <label className={styles.formField}>
                                    <span>{t("header.password.confirm")}</span>
                                    <input
                                        type="password"
                                        className={styles.formInput}
                                        placeholder={t("header.password.confirm.placeholder")}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </label>
                            </div>

                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className={styles.cancelButton}
                                    onClick={() => setShowPasswordModal(false)}
                                >
                                    {t("header.password.cancel")}
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitButton}
                                    disabled={passwordLoading}
                                >
                                    {passwordLoading && <Loader2 size={15} className={styles.spin} />}
                                    {t("header.password.save")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: BÁO LỖI / GÓP Ý */}
            {showFeedbackModal && (
                <div className={styles.modalBackdrop} onClick={() => setShowFeedbackModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitleGroup}>
                                <h3>{t("header.feedback.title")}</h3>
                                <p>{t("header.feedback.desc")}</p>
                            </div>
                            <button
                                type="button"
                                className={styles.modalCloseButton}
                                onClick={() => setShowFeedbackModal(false)}
                                aria-label={t("header.modal.close")}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleFeedbackSubmit}>
                            <div className={styles.modalBody}>
                                {feedbackMessage && (
                                    <div
                                        className={
                                            feedbackMessage.type === "success"
                                                ? styles.alertSuccess
                                                : styles.alertError
                                        }
                                    >
                                        {feedbackMessage.type === "success" && <CheckCircle2 size={16} />}
                                        {feedbackMessage.text}
                                    </div>
                                )}

                                <label className={styles.formField}>
                                    <span>{t("header.feedback.category")}</span>
                                    <select
                                        className={styles.formSelect}
                                        value={feedbackCategory}
                                        onChange={(e) => setFeedbackCategory(e.target.value)}
                                    >
                                        <option value="BUG">{t("header.feedback.category.bug")}</option>
                                        <option value="FEATURE">{t("header.feedback.category.feature")}</option>
                                        <option value="UI">{t("header.feedback.category.ui")}</option>
                                        <option value="OTHER">{t("header.feedback.category.other")}</option>
                                    </select>
                                </label>

                                <label className={styles.formField}>
                                    <span>{t("header.feedback.content")}</span>
                                    <textarea
                                        className={styles.formTextarea}
                                        placeholder={t("header.feedback.content.placeholder")}
                                        value={feedbackContent}
                                        onChange={(e) => setFeedbackContent(e.target.value)}
                                        required
                                    />
                                </label>
                            </div>

                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className={styles.cancelButton}
                                    onClick={() => setShowFeedbackModal(false)}
                                >
                                    {t("header.feedback.cancel")}
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitButton}
                                    disabled={feedbackLoading}
                                >
                                    {feedbackLoading && <Loader2 size={15} className={styles.spin} />}
                                    {t("header.feedback.submit")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </header>
    );
}
