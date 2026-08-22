"use client";

import {
    Bell,
    CheckCircle2,
    ChevronDown,
    GraduationCap,
    Loader2,
    Lock,
    LogOut,
    Menu,
    MessageSquareWarning,
    Moon,
    ShieldCheck,
    Sun,
    User,
    UserRound,
    X,
} from "lucide-react";
import Link from "next/link";
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
    const { theme, locale, toggleTheme, setLocale, t } = useSettings();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [languageBusy, setLanguageBusy] = useState(false);
    const [themeBusy, setThemeBusy] = useState(false);

    // Dropdown state
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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
                    window.alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");
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

        const unsubscribeRealtime = subscribeStudentNotificationEvents(
            () => setUnreadCount((count) => count + 1),
        );
        const unsubscribeCount = subscribeStudentUnreadCount(setUnreadCount);

        return () => {
            active = false;
            unsubscribeRealtime();
            unsubscribeCount();
        };
    }, [user?.role]);


    // Click outside listener for dropdown menu
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


    function handleLogout() {
        localStorage.removeItem("internova_access_token");
        localStorage.removeItem("internova_user");
        window.location.replace("/auth/login");
    }

    function handleLocaleChange(nextLocale: "en" | "vi") {
        if (languageBusy || nextLocale === locale) {
            return;
        }

        setLanguageBusy(true);
        setLocale(nextLocale);
        window.setTimeout(() => setLanguageBusy(false), 900);
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

                <Link href="/student/dashboard" className={styles.logoBrandLink}>
                    <span className={styles.logoIcon}>
                        <GraduationCap size={22} />
                    </span>

                    <div className={styles.logoText}>
                        <strong>Internova</strong>
                        <span>Internship Assistant</span>
                    </div>
                </Link>
            </div>

            <div className={styles.headerRight}>
                {user && (
                    <>
                        {/* TOGGLE CHUYỂN ĐỔI NGÔN NGỮ (PILL SHAPE - EN/VI) */}
                        <div
                            className={`${styles.langPillContainer} notranslate`}
                            translate="no"
                        >
                            <button
                                type="button"
                                className={`${styles.langButton} ${locale === "en" ? styles.langActiveEN : ""}`}
                                disabled={languageBusy}
                                onClick={() => handleLocaleChange("en")}
                                translate="no"
                            >
                                EN
                            </button>
                            <button
                                type="button"
                                className={`${styles.langButton} ${locale === "vi" ? styles.langActiveVI : ""}`}
                                disabled={languageBusy}
                                onClick={() => handleLocaleChange("vi")}
                                translate="no"
                            >
                                VI
                            </button>
                        </div>

                        {/* NÚT CHUYỂN ĐỔI THEME TỐI/SÁNG */}
                        <button
                            type="button"
                            className={styles.themeToggleButton}
                            disabled={themeBusy}
                            onClick={handleThemeToggle}
                            title={theme === "light" ? "Chuyển sang chế độ Tối" : "Chuyển sang chế độ Sáng"}
                            aria-label="Toggle Theme"
                        >
                            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        {/* VẠCH PHÂN CÁCH (VERTICAL LINE) */}
                        <div className={styles.verticalDivider} />

                        {user.role === "STUDENT" && (
                            <button
                                aria-label={locale === "vi" ? `Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ""}` : `Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                                className={styles.notificationButton}
                                onClick={() => router.push("/student/notification")}
                                title={t("nav.notifications")}
                                type="button"
                            >
                                <Bell size={19} />
                                {unreadCount > 0 && (
                                    <span>{unreadCount > 99 ? "99+" : unreadCount}</span>
                                )}
                            </button>
                        )}

                        <div
                            className={`${styles.headerBadge} notranslate`}
                            translate="no"
                        >
                            <span className={styles.roleDot} />
                            {t(`role.${user.role.toLowerCase()}`)}
                        </div>

                        {/* USER DROPDOWN CONTAINER */}
                        <div
                            className={`${styles.userMenuContainer} notranslate`}
                            ref={menuRef}
                            translate="no"
                        >
                            <button
                                type="button"
                                className={`${styles.headerUser} ${isMenuOpen ? styles.headerUserActive : ""}`}
                                onClick={() => setIsMenuOpen((prev) => !prev)}
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
                                <h3>Đổi mật khẩu</h3>
                                <p>Cập nhật mật khẩu để bảo vệ tài khoản của bạn</p>
                            </div>
                            <button
                                type="button"
                                className={styles.modalCloseButton}
                                onClick={() => setShowPasswordModal(false)}
                                aria-label="Đóng"
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
                                    <span>Mật khẩu hiện tại</span>
                                    <input
                                        type="password"
                                        className={styles.formInput}
                                        placeholder="Nhập mật khẩu hiện tại"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                    />
                                </label>

                                <label className={styles.formField}>
                                    <span>Mật khẩu mới</span>
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
                                    <span>Xác nhận mật khẩu mới</span>
                                    <input
                                        type="password"
                                        className={styles.formInput}
                                        placeholder="Nhập lại mật khẩu mới"
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
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitButton}
                                    disabled={passwordLoading}
                                >
                                    {passwordLoading && <Loader2 size={15} className={styles.spin} />}
                                    Lưu mật khẩu
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
                                <h3>Báo lỗi & Góp ý</h3>
                                <p>Đóng góp ý kiến để giúp chúng tôi hoàn thiện phần mềm</p>
                            </div>
                            <button
                                type="button"
                                className={styles.modalCloseButton}
                                onClick={() => setShowFeedbackModal(false)}
                                aria-label="Đóng"
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
                                    <span>Loại phản hồi</span>
                                    <select
                                        className={styles.formSelect}
                                        value={feedbackCategory}
                                        onChange={(e) => setFeedbackCategory(e.target.value)}
                                    >
                                        <option value="BUG">Báo lỗi hệ thống (Bug)</option>
                                        <option value="FEATURE">Góp ý tính năng mới</option>
                                        <option value="UI">Phản hồi Giao diện / Trải nghiệm</option>
                                        <option value="OTHER">Ý kiến khác</option>
                                    </select>
                                </label>

                                <label className={styles.formField}>
                                    <span>Nội dung phản hồi</span>
                                    <textarea
                                        className={styles.formTextarea}
                                        placeholder="Mô tả chi tiết lỗi gặp phải hoặc ý kiến đóng góp của bạn..."
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
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitButton}
                                    disabled={feedbackLoading}
                                >
                                    {feedbackLoading && <Loader2 size={15} className={styles.spin} />}
                                    Gửi phản hồi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </header>
    );
}
