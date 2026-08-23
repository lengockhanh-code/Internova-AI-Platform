"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

type Theme = "light" | "dark";
type Locale = "vi" | "en";

interface SettingsContextProps {
    theme: Theme;
    locale: Locale;
    toggleTheme: () => void;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
}

const SettingsContext =
    createContext<SettingsContextProps | undefined>(undefined);

const translations: Record<Locale, Record<string, string>> = {
    vi: {
        "nav.dashboard": "Bảng điều khiển",
        "nav.notifications": "Lịch và thông báo",
        "nav.account": "Tài khoản sinh viên",
        "nav.account.sub": "Hồ sơ và thông tin cá nhân",
        "nav.role": "Vai trò hệ thống",
        "nav.role.sub": "Quyền hạn của tài khoản",
        "nav.change_password": "Đổi mật khẩu",
        "nav.change_password.sub": "Cập nhật mật khẩu bảo mật",
        "nav.feedback": "Báo lỗi / Góp ý",
        "nav.feedback.sub": "Gửi phản hồi cho hệ thống",
        "nav.logout": "Đăng xuất",
        "nav.logout.confirm": "Bạn có chắc chắn muốn đăng xuất?",
        "role.student": "Sinh viên",
        "role.lecturer": "Giảng viên",
        "role.admin": "Quản trị viên",
        "role.user": "Người dùng",
        "header.menu_account": "Menu tài khoản",
        "header.open_menu": "Mở menu",
        "header.theme.light": "Chuyển sang chế độ tối",
        "header.theme.dark": "Chuyển sang chế độ sáng",
        "header.modal.close": "Đóng",
        "header.password.title": "Đổi mật khẩu",
        "header.password.desc": "Cập nhật mật khẩu để bảo vệ tài khoản của bạn",
        "header.password.current": "Mật khẩu hiện tại",
        "header.password.current.placeholder": "Nhập mật khẩu hiện tại",
        "header.password.new": "Mật khẩu mới",
        "header.password.new.placeholder": "Tối thiểu 6 ký tự",
        "header.password.confirm": "Xác nhận mật khẩu mới",
        "header.password.confirm.placeholder": "Nhập lại mật khẩu mới",
        "header.password.cancel": "Hủy",
        "header.password.save": "Lưu mật khẩu",
        "header.feedback.title": "Báo lỗi và Góp ý",
        "header.feedback.desc": "Đóng góp ý kiến để giúp chúng tôi hoàn thiện phần mềm",
        "header.feedback.category": "Loại phản hồi",
        "header.feedback.content": "Nội dung phản hồi",
        "header.feedback.content.placeholder": "Mô tả chi tiết lỗi gặp phải hoặc ý kiến đóng góp của bạn...",
        "header.feedback.cancel": "Hủy",
        "header.feedback.submit": "Gửi phản hồi",
        "header.feedback.category.bug": "Báo lỗi hệ thống (Bug)",
        "header.feedback.category.feature": "Góp ý tính năng mới",
        "header.feedback.category.ui": "Phản hồi Giao diện / Trải nghiệm",
        "header.feedback.category.other": "Ý kiến khác",
        "header.session.expired": "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.",
        "sidebar.overview": "TỔNG QUAN",
        "sidebar.internship": "THỰC TẬP",
        "sidebar.ai_support": "HỖ TRỢ AI",
        "sidebar.personal": "CÁ NHÂN",
        "sidebar.dashboard": "Dashboard",
        "sidebar.register": "Đăng ký thực tập",
        "sidebar.profile": "Hồ sơ thực tập",
        "sidebar.report": "Báo cáo",
        "sidebar.checklist": "Checklist",
        "sidebar.chatbot": "Hỏi đáp AI",
        "sidebar.notifications": "Lịch và Thông báo",
        "sidebar.settings": "Cài đặt",
        "sidebar.footer_desc": "Nền tảng hỗ trợ thực tập sinh viên",
        "dashboard.welcome": "Xin chào",
        "dashboard.welcome_sub": "Internova đồng hành cùng bạn trong hành trình thực tập hiệu quả và chuyên nghiệp.",
        "dashboard.ai_consulting": "Tư vấn học vụ (RAG)",
        "dashboard.ai_consulting_desc": "Đặt câu hỏi về quy trình, quy định, thủ tục thực tập và nhận câu trả lời từ hệ thống.",
        "dashboard.ai_consulting_btn": "Bắt đầu tư vấn",
        "dashboard.ai_review": "AI Review báo cáo",
        "dashboard.ai_review_desc": "Kiểm tra báo cáo thực tập, phát hiện nội dung còn thiếu và nhận gợi ý cải thiện trước khi nộp.",
        "dashboard.ai_review_btn": "Review báo cáo",
        "dashboard.ai_review_badge": "Đang phát triển",
        "dashboard.ai_review_coming_soon": "Sắp ra mắt",
        "dashboard.deadlines_fallback": "Deadline",
        "dashboard.status_title": "Trạng thái thực tập",
        "dashboard.status_company": "Công ty:",
        "dashboard.status_position": "Vị trí:",
        "dashboard.status_duration": "Thời gian:",
        "dashboard.status_not_update": "Chưa cập nhật",
        "dashboard.status_view_profile": "Xem chi tiết hồ sơ",
        "dashboard.status_no_internship": "Bạn chưa có kỳ thực tập đang hoạt động.",
        "dashboard.status_register_btn": "Đăng ký thực tập",
        "dashboard.deadlines_title": "Deadline sắp tới",
        "dashboard.deadlines_none": "Không có deadline sắp tới.",
        "dashboard.deadlines_view_all": "Xem tất cả deadline",
        "dashboard.progress_title": "Tiến độ tuần này",
        "dashboard.progress_week": "Tuần",
        "dashboard.progress_none": "Chưa có tiến độ tuần hiện tại.",
        "dashboard.progress_view_detail": "Xem chi tiết tiến độ",
        "dashboard.tip_title": "Mẹo:",
        "dashboard.tip_content": "Hãy cập nhật tiến độ thường xuyên và chủ động trao đổi với mentor để có trải nghiệm thực tập tốt nhất!",
        "dashboard.try_again": "Thử lại",
        "dashboard.status.not_started": "Chưa bắt đầu",
        "dashboard.status.in_progress": "Đang thực tập",
        "dashboard.status.completed": "Đã hoàn thành",
    },
    en: {
        "nav.dashboard": "Dashboard",
        "nav.notifications": "Schedules and Notifications",
        "nav.account": "Student Account",
        "nav.account.sub": "Profile and personal information",
        "nav.role": "System Role",
        "nav.role.sub": "Account permissions",
        "nav.change_password": "Change Password",
        "nav.change_password.sub": "Update your secure password",
        "nav.feedback": "Bug Report / Feedback",
        "nav.feedback.sub": "Send feedback to the system",
        "nav.logout": "Log Out",
        "nav.logout.confirm": "Are you sure you want to log out?",
        "role.student": "Student",
        "role.lecturer": "Lecturer",
        "role.admin": "Administrator",
        "role.user": "User",
        "header.menu_account": "Account menu",
        "header.open_menu": "Open menu",
        "header.theme.light": "Switch to dark mode",
        "header.theme.dark": "Switch to light mode",
        "header.modal.close": "Close",
        "header.password.title": "Change Password",
        "header.password.desc": "Update your password to protect your account",
        "header.password.current": "Current password",
        "header.password.current.placeholder": "Enter current password",
        "header.password.new": "New password",
        "header.password.new.placeholder": "At least 6 characters",
        "header.password.confirm": "Confirm new password",
        "header.password.confirm.placeholder": "Re-enter new password",
        "header.password.cancel": "Cancel",
        "header.password.save": "Save password",
        "header.feedback.title": "Bug Report and Feedback",
        "header.feedback.desc": "Share feedback to help us improve the software",
        "header.feedback.category": "Feedback type",
        "header.feedback.content": "Feedback content",
        "header.feedback.content.placeholder": "Describe the issue or your suggestion in detail...",
        "header.feedback.cancel": "Cancel",
        "header.feedback.submit": "Send feedback",
        "header.feedback.category.bug": "System bug report",
        "header.feedback.category.feature": "New feature suggestion",
        "header.feedback.category.ui": "UI / UX feedback",
        "header.feedback.category.other": "Other feedback",
        "header.session.expired": "Your session has expired. Please sign in again.",
        "sidebar.overview": "OVERVIEW",
        "sidebar.internship": "INTERNSHIP",
        "sidebar.ai_support": "AI SUPPORT",
        "sidebar.personal": "PERSONAL",
        "sidebar.dashboard": "Dashboard",
        "sidebar.register": "Internship Registration",
        "sidebar.profile": "Internship Profile",
        "sidebar.report": "Reports",
        "sidebar.checklist": "Checklist",
        "sidebar.chatbot": "AI Chat",
        "sidebar.notifications": "Schedules and Notifications",
        "sidebar.settings": "Settings",
        "sidebar.footer_desc": "Student internship support platform",
        "dashboard.welcome": "Welcome",
        "dashboard.welcome_sub": "Internova supports you throughout an effective and professional internship journey.",
        "dashboard.ai_consulting": "Academic Advising (RAG)",
        "dashboard.ai_consulting_desc": "Ask about internship procedures, policies, and workflows and receive answers from the system.",
        "dashboard.ai_consulting_btn": "Start Advising",
        "dashboard.ai_review": "AI Report Review",
        "dashboard.ai_review_desc": "Check internship reports, detect missing content, and get suggestions before submission.",
        "dashboard.ai_review_btn": "Review Report",
        "dashboard.ai_review_badge": "In development",
        "dashboard.ai_review_coming_soon": "Coming soon",
        "dashboard.deadlines_fallback": "Deadline",
        "dashboard.status_title": "Internship Status",
        "dashboard.status_company": "Company:",
        "dashboard.status_position": "Position:",
        "dashboard.status_duration": "Duration:",
        "dashboard.status_not_update": "Not updated",
        "dashboard.status_view_profile": "View profile details",
        "dashboard.status_no_internship": "You do not have an active internship period.",
        "dashboard.status_register_btn": "Register Internship",
        "dashboard.deadlines_title": "Upcoming Deadlines",
        "dashboard.deadlines_none": "No upcoming deadlines.",
        "dashboard.deadlines_view_all": "View all deadlines",
        "dashboard.progress_title": "This Week's Progress",
        "dashboard.progress_week": "Week",
        "dashboard.progress_none": "No progress for the current week.",
        "dashboard.progress_view_detail": "View progress details",
        "dashboard.tip_title": "Tip:",
        "dashboard.tip_content": "Update your progress regularly and proactively communicate with your mentor for the best internship experience.",
        "dashboard.try_again": "Try again",
        "dashboard.status.not_started": "Not started",
        "dashboard.status.in_progress": "In progress",
        "dashboard.status.completed": "Completed",
    },
};

export function SettingsProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [theme, setTheme] = useState<Theme>("light");
    const [locale, setLocaleState] = useState<Locale>("vi");

    useEffect(() => {
        const savedTheme =
            localStorage.getItem("internova_theme") as Theme | null;
        const savedLocale =
            localStorage.getItem("internova_locale") as Locale | null;

        const initialTheme =
            savedTheme ??
            (window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light");
        const initialLocale = savedLocale ?? "vi";

        setTheme(initialTheme);
        setLocaleState(initialLocale);
        document.documentElement.classList.toggle(
            "dark",
            window.location.pathname.startsWith("/student/") &&
            initialTheme === "dark",
        );
        document.documentElement.setAttribute("lang", initialLocale);
    }, []);

    const value = useMemo<SettingsContextProps>(() => {
        const isStudentUi =
            typeof window !== "undefined" &&
            window.location.pathname.startsWith("/student/");

        const toggleTheme = () => {
            const nextTheme = theme === "light" ? "dark" : "light";
            setTheme(nextTheme);
            localStorage.setItem("internova_theme", nextTheme);
            document.documentElement.classList.toggle(
                "dark",
                isStudentUi && nextTheme === "dark",
            );
        };

        const setLocale = (newLocale: Locale) => {
            setLocaleState(newLocale);
            localStorage.setItem("internova_locale", newLocale);
            document.documentElement.setAttribute("lang", newLocale);
        };

        const t = (key: string): string => {
            return translations[locale]?.[key] || key;
        };

        return {
            theme,
            locale,
            toggleTheme,
            setLocale,
            t,
        };
    }, [locale, theme]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error(
            "useSettings must be used inside SettingsProvider",
        );
    }
    return context;
}
