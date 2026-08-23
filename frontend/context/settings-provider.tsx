"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { usePathname } from "next/navigation";

type Theme = "light" | "dark";
type Locale = "vi" | "en";

interface SettingsContextProps {
    theme: Theme;
    locale: Locale;
    toggleTheme: () => void;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
}

type GoogleTranslateElementConstructor = new (
    options: {
        pageLanguage: string;
        includedLanguages: string;
        autoDisplay: boolean;
    },
    elementId: string,
) => unknown;

declare global {
    interface Window {
        google?: {
            translate?: {
                TranslateElement?: GoogleTranslateElementConstructor;
            };
        };
        googleTranslateElementInit?: () => void;
        __internovaGoogleTranslateReady?: boolean;
    }
}

const SettingsContext =
    createContext<SettingsContextProps | undefined>(undefined);

const GOOGLE_TRANSLATE_SCRIPT_ID = "internova-google-translate-script";
const GOOGLE_TRANSLATE_ELEMENT_ID = "internova-google-translate-element";
const GOOGLE_TRANSLATE_STYLE_ID = "internova-google-translate-style";
let googleTranslateDomGuardInstalled = false;
let googleTranslateApplyRun = 0;
let googleTranslateApplyTimers: ReturnType<typeof setTimeout>[] = [];

const translations: Record<Locale, Record<string, string>> = {
    vi: {
        "nav.dashboard": "Bảng điều khiển",
        "nav.notifications": "Lịch và thông báo",
        "nav.account": "Tài khoản của sinh viên",
        "nav.account.sub": "Hồ sơ & thông tin cá nhân",
        "nav.role": "Vai trò hệ thống",
        "nav.role.sub": "Quyền hạn của tài khoản",
        "nav.change_password": "Đổi mật khẩu",
        "nav.change_password.sub": "Cập nhật mật khẩu bảo mật",
        "nav.feedback": "Báo lỗi / Góp ý",
        "nav.feedback.sub": "Gửi phản hồi cho hệ thống",
        "nav.logout": "Đăng xuất",
        "role.student": "Sinh viên",
        "role.lecturer": "Giảng viên",
        "role.admin": "Quản trị viên",
        "role.user": "Người dùng",
        "header.menu_account": "Menu tài khoản",
        "header.open_menu": "Mở menu",
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
        "sidebar.notifications": "Lịch & Thông báo",
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
        "chat.welcome": "Xin chào! 👋 Mình là **Internova AI**, trợ lý hỗ trợ thực tập dành cho sinh viên VinUni.\n\nBạn có thể hỏi mình về **quy trình đăng ký thực tập, điều kiện, biểu mẫu, báo cáo, đánh giá và các quy định liên quan**.\n\nMình sẽ trả lời dựa trên tài liệu chính thức được cung cấp trong hệ thống.",
        "chat.suggestion.1": "Thời gian nộp báo cáo thực tập là khi nào?",
        "chat.suggestion.2": "Quy trình đăng ký thực tập gồm những bước nào?",
        "chat.suggestion.3": "Nếu nộp báo cáo trễ thì có bị trừ điểm không?",
    },
    en: {
        "nav.dashboard": "Dashboard",
        "nav.notifications": "Schedules & Notifications",
        "nav.account": "Student Profile",
        "nav.account.sub": "Profile & personal info",
        "nav.role": "System Role",
        "nav.role.sub": "Account permissions",
        "nav.change_password": "Change Password",
        "nav.change_password.sub": "Update secure password",
        "nav.feedback": "Report Bug / Feedback",
        "nav.feedback.sub": "Send feedback to the system",
        "nav.logout": "Log Out",
        "role.student": "Student",
        "role.lecturer": "Lecturer",
        "role.admin": "Administrator",
        "role.user": "User",
        "header.menu_account": "Account menu",
        "header.open_menu": "Open menu",
        "sidebar.overview": "OVERVIEW",
        "sidebar.internship": "INTERNSHIP",
        "sidebar.ai_support": "AI ASSISTANT",
        "sidebar.personal": "PERSONAL",
        "sidebar.dashboard": "Dashboard",
        "sidebar.register": "Register Internship",
        "sidebar.profile": "Internship Profile",
        "sidebar.report": "Reports",
        "sidebar.checklist": "Checklist",
        "sidebar.chatbot": "AI Chatbot",
        "sidebar.notifications": "Schedules & Alerts",
        "sidebar.settings": "Settings",
        "sidebar.footer_desc": "Student Internship Platform",
        "dashboard.welcome": "Welcome",
        "dashboard.welcome_sub": "Internova accompanies you on your journey towards an effective and professional internship.",
        "dashboard.ai_consulting": "Academic Advising (RAG)",
        "dashboard.ai_consulting_desc": "Ask questions about internship procedures, regulations, processes and get answers from the system.",
        "dashboard.ai_consulting_btn": "Start Advising",
        "dashboard.ai_review": "AI Report Review",
        "dashboard.ai_review_desc": "Check internship reports, detect missing content and receive improvement suggestions before submission.",
        "dashboard.ai_review_btn": "Review Report",
        "dashboard.ai_review_badge": "In development",
        "dashboard.ai_review_coming_soon": "Coming soon",
        "dashboard.deadlines_fallback": "Deadline",
        "dashboard.status_title": "Internship Status",
        "dashboard.status_company": "Company:",
        "dashboard.status_position": "Position:",
        "dashboard.status_duration": "Duration:",
        "dashboard.status_not_update": "Not updated yet",
        "dashboard.status_view_profile": "View Profile Details",
        "dashboard.status_no_internship": "You do not have an active internship period.",
        "dashboard.status_register_btn": "Register Internship",
        "dashboard.deadlines_title": "Upcoming Deadlines",
        "dashboard.deadlines_none": "No upcoming deadlines.",
        "dashboard.deadlines_view_all": "View All Deadlines",
        "dashboard.progress_title": "This Week's Progress",
        "dashboard.progress_week": "Week",
        "dashboard.progress_none": "No progress for the current week.",
        "dashboard.progress_view_detail": "View Progress Details",
        "dashboard.tip_title": "Tip:",
        "dashboard.tip_content": "Update your progress regularly and actively communicate with your mentor for the best internship experience!",
        "dashboard.try_again": "Try again",
        "dashboard.status.not_started": "Not started",
        "dashboard.status.in_progress": "In progress",
        "dashboard.status.completed": "Completed",
        "chat.welcome": "Hello! 👋 I'm **Internova AI**, an internship support assistant for VinUni students.\n\nYou can ask me about **internship registration procedures, eligibility requirements, forms, reports, evaluations, and related regulations**.\n\nI will answer based on the official documents available in the system.",
        "chat.suggestion.1": "When is the internship report submission deadline?",
        "chat.suggestion.2": "What are the steps in the internship registration process?",
        "chat.suggestion.3": "Will I lose points if I submit my internship report late?",
    },
};

function setGoogleTranslateCookie(locale: Locale) {
    const cookieValue = locale === "en" ? "/vi/en" : "/vi/vi";
    const hostnameParts = window.location.hostname.split(".");
    const baseCookie = `googtrans=${cookieValue};path=/;SameSite=Lax`;

    document.cookie = baseCookie;

    if (hostnameParts.length > 1) {
        document.cookie = `${baseCookie};domain=.${hostnameParts.slice(-2).join(".")}`;
    }
}

function resetGoogleTranslateCookie() {
    const hostnameParts = window.location.hostname.split(".");
    const expiredCookie = "googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;SameSite=Lax";

    document.cookie = expiredCookie;
    document.cookie = "googtrans=/vi/vi;path=/;SameSite=Lax";

    if (hostnameParts.length > 1) {
        const domain = `.${hostnameParts.slice(-2).join(".")}`;
        document.cookie = `${expiredCookie};domain=${domain}`;
        document.cookie = `googtrans=/vi/vi;path=/;domain=${domain};SameSite=Lax`;
    }
}

function ensureGoogleTranslateContainer() {
    if (document.getElementById(GOOGLE_TRANSLATE_ELEMENT_ID)) {
        return;
    }

    const container = document.createElement("div");
    container.id = GOOGLE_TRANSLATE_ELEMENT_ID;
    container.setAttribute("aria-hidden", "true");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);
}

function ensureGoogleTranslateStyles() {
    if (document.getElementById(GOOGLE_TRANSLATE_STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = GOOGLE_TRANSLATE_STYLE_ID;
    style.textContent = `
        .goog-te-banner-frame,
        .goog-te-balloon-frame,
        #goog-gt-tt,
        .goog-te-spinner-pos {
            display: none !important;
        }

        body {
            top: 0 !important;
        }

        body > .skiptranslate {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

function installGoogleTranslateDomGuard() {
    if (googleTranslateDomGuardInstalled || typeof Node === "undefined") {
        return;
    }

    googleTranslateDomGuardInstalled = true;

    const originalRemoveChild = Node.prototype.removeChild;
    const originalInsertBefore = Node.prototype.insertBefore;

    Node.prototype.removeChild = function removeChildSafely<T extends Node>(
        child: T,
    ): T {
        if (child.parentNode !== this) {
            return child;
        }

        return originalRemoveChild.call(this, child) as T;
    };

    Node.prototype.insertBefore = function insertBeforeSafely<T extends Node>(
        newNode: T,
        referenceNode: Node | null,
    ): T {
        if (referenceNode && referenceNode.parentNode !== this) {
            return this.appendChild(newNode) as T;
        }

        return originalInsertBefore.call(
            this,
            newNode,
            referenceNode,
        ) as T;
    };
}

function cancelQueuedGoogleTranslate() {
    googleTranslateApplyRun += 1;

    googleTranslateApplyTimers.forEach(clearTimeout);
    googleTranslateApplyTimers = [];
}

function queueGoogleTranslateTask(
    callback: () => void,
    delay: number,
) {
    const timer = setTimeout(() => {
        googleTranslateApplyTimers = googleTranslateApplyTimers.filter(
            item => item !== timer,
        );
        callback();
    }, delay);

    googleTranslateApplyTimers.push(timer);
}

function applyGoogleTranslate(
    locale: Locale,
    attempts = 0,
    runId = googleTranslateApplyRun,
    force = false,
) {
    if (runId !== googleTranslateApplyRun) {
        return;
    }

    setGoogleTranslateCookie(locale);
    document.documentElement.setAttribute("lang", locale);

    const combo =
        document.querySelector<HTMLSelectElement>(".goog-te-combo");

    if (combo) {
        const nextValue = locale === "en" ? "en" : "vi";
        if (force || combo.value !== nextValue) {
            combo.value = nextValue;
            try {
                combo.dispatchEvent(
                    new Event("change", { bubbles: true }),
                );
            } catch {
                window.setTimeout(
                    () =>
                        applyGoogleTranslate(
                            locale,
                            attempts + 1,
                            runId,
                            force,
                        ),
                    300,
                );
            }
        }
        return;
    }

    if (attempts < 8) {
        queueGoogleTranslateTask(
            () =>
                applyGoogleTranslate(
                    locale,
                    attempts + 1,
                    runId,
                    force,
                ),
            250,
        );
    }
}

function loadGoogleTranslate(
    locale: Locale,
    runId = googleTranslateApplyRun,
) {
    if (runId !== googleTranslateApplyRun) {
        return;
    }

    installGoogleTranslateDomGuard();
    ensureGoogleTranslateContainer();
    ensureGoogleTranslateStyles();
    setGoogleTranslateCookie(locale);

    window.googleTranslateElementInit = () => {
        if (runId !== googleTranslateApplyRun) {
            return;
        }

        const TranslateElement =
            window.google?.translate?.TranslateElement;

        if (!TranslateElement) {
            return;
        }

        new TranslateElement(
            {
                pageLanguage: "vi",
                includedLanguages: "vi,en",
                autoDisplay: false,
            },
            GOOGLE_TRANSLATE_ELEMENT_ID,
        );

        window.__internovaGoogleTranslateReady = true;
        applyGoogleTranslate(locale, 0, runId);
    };

    if (window.__internovaGoogleTranslateReady) {
        applyGoogleTranslate(locale, 0, runId);
        return;
    }

    if (document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID)) {
        return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_TRANSLATE_SCRIPT_ID;
    script.src =
        "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
}

function requestGoogleTranslate(locale: Locale, delay = 180) {
    const runId = googleTranslateApplyRun + 1;
    googleTranslateApplyRun = runId;

    googleTranslateApplyTimers.forEach(clearTimeout);
    googleTranslateApplyTimers = [];

    queueGoogleTranslateTask(() => {
        loadGoogleTranslate(locale, runId);
    }, delay);

    queueGoogleTranslateTask(() => {
        applyGoogleTranslate(locale, 0, runId, true);
    }, delay + 900);
}

export function SettingsProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [theme, setTheme] = useState<Theme>("light");
    const [locale, setLocaleState] = useState<Locale>("vi");
    const [settingsReady, setSettingsReady] = useState(false);
    const isStudentChatbotPage =
        pathname.startsWith("/student/chatbot");
    const autoTranslateEnabled =
        pathname.startsWith("/student/") &&
        !isStudentChatbotPage;
    const studentUiEnabled =
        pathname.startsWith("/student/");

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
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

        setSettingsReady(true);

        if (!window.location.pathname.startsWith("/student/")) {
            resetGoogleTranslateCookie();
        }
        /* eslint-enable react-hooks/set-state-in-effect */
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle(
            "dark",
            studentUiEnabled && theme === "dark",
        );
    }, [studentUiEnabled, theme]);

    useEffect(() => {
        if (!settingsReady) {
            return;
        }

        if (autoTranslateEnabled) {
            requestGoogleTranslate(locale);
            return;
        }

        cancelQueuedGoogleTranslate();
        resetGoogleTranslateCookie();
        document.documentElement.setAttribute("lang", "vi");

        const combo =
            document.querySelector<HTMLSelectElement>(".goog-te-combo");

        if (combo && combo.value !== "vi") {
            combo.value = "vi";
            try {
                combo.dispatchEvent(
                    new Event("change", { bubbles: true }),
                );
            } catch {
                // Google Translate can mutate the DOM while routes change.
            }
        }
    }, [autoTranslateEnabled, locale, settingsReady]);

    const value = useMemo<SettingsContextProps>(() => {
        const toggleTheme = () => {
            const nextTheme = theme === "light" ? "dark" : "light";
            setTheme(nextTheme);
            localStorage.setItem("internova_theme", nextTheme);
            document.documentElement.classList.toggle(
                "dark",
                studentUiEnabled && nextTheme === "dark",
            );
        };

        const setLocale = (newLocale: Locale) => {
            if (newLocale === locale) {
                return;
            }

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
    }, [locale, studentUiEnabled, theme]);

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