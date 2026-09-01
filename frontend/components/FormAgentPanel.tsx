"use client";

// FormAgentPanel.tsx — Hiển thị THUẦN, không tự gọi API, không có ô
// nhập riêng nữa.
//
// FIX lớn (giữ nguyên từ bản gốc): mọi state (status, nội dung,
// loading, lỗi...) đều do trang cha (page.tsx) quản lý và truyền vào
// qua props; mọi hành động (Có/Không, Xác nhận, Hủy) đều là callback
// props gọi ngược lên cha. Việc TRẢ LỜI TỰ DO (bù thông tin) đi qua
// Ô NHẬP CHÍNH của trang chat, không có ô nhập ở đây.
//
// FIX (UI card thay vì text thô): "displayText" ở trạng thái
// collecting_info luôn là 1 chuỗi markdown cố định dạng bullet list —
// xem build_ask_message() trong form_tool.py. parseDisplayText() bóc
// tách phần notice tự động điền / mô tả / từng dòng "- ..." / hint,
// resolveFieldIcon() đoán icon theo từ khóa trong nhãn field.
//
// FIX MỚI (round 3 — restyle theo bản "cute", nhiều màu, có icon
// trang trí): thay toàn bộ className từ tông xanh dương đơn sắc sang
// bảng màu xoay vòng (xanh dương/tím/xanh lá/cam) cho từng field,
// avatar to hơn, card viền bo tròn hơn (rounded-3xl), thêm icon trang
// trí (Sparkles, Heart, MessageCircle, Send...) ở vài chỗ cho vui mắt
// — KHÔNG đổi bất kỳ logic/props/callback nào, chỉ đổi phần trình bày.

import {
    Building2,
    Briefcase,
    Layers,
    GraduationCap,
    BookOpen,
    User,
    Users,
    Calendar,
    Globe,
    Contact,
    BadgeCheck,
    Mail,
    Phone,
    Clock,
    FileText,
    MapPin,
    HelpCircle,
    Lightbulb,
    Search,
    Star,
    ThumbsUp,
    MessageSquare,
    School,
    Info,
    X,
    ChevronRight,
    Sparkles,
    Send,
    Trash2,
    Pencil,
    RefreshCw,
    CheckCircle2,
    ClipboardList,
    type LucideIcon,
} from "lucide-react";
import React from "react";

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FormAgentPanelProps {
    phase: "confirm" | "working";
    detectedFormName?: string;
    status?: string | null;
    displayText?: string;
    loading?: boolean;
    error?: string | null;
    docxReady?: boolean;
    sessionId?: string | null;
    locale?: "vi" | "en";
    isLatest?: boolean;
    onConfirmYes?: () => void;
    onConfirmNo?: () => void;
    onApprove?: () => void;
    onCancelSession?: () => void;
    /** Người dùng muốn sửa lại 1 vài thông tin trước khi xác nhận —
     * cha (page.tsx) xử lý bằng cách focus ô nhập chat chính, có thể
     * kèm gợi ý placeholder. Panel này KHÔNG tự có ô nhập riêng. */
    onRequestEdit?: () => void;
}


// =============================================================================
// FontScope — nhúng font Inter CHỈ áp dụng cho FormAgentPanel, không
// đụng tới layout.tsx hay file nào khác.
// =============================================================================

function FontScope() {
    return (
        <style jsx global>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            .fap-scope, .fap-scope * {
                font-family: 'Inter', 'Roboto', Arial, sans-serif;
            }
        `}</style>
    );
}

// =============================================================================
// AgentAvatar — dùng ảnh minh họa thật (public/agent-avatar.png).
// =============================================================================

function AgentAvatar({ size = 32, animated = false }: { size?: number; animated?: boolean }) {
    return (
        <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
            {animated && (
                <>
                    <span className="absolute inset-0 rounded-full bg-indigo-300 opacity-60 animate-ping" />
                    <span className="absolute inset-0 rounded-full bg-indigo-200 opacity-40 animate-pulse" />
                </>
            )}
            <span
                className={`relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full ring-4 ring-white/70 ${animated ? "fap-avatar-think" : ""}`}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/agent-avatar.png"
                    alt="Agent"
                    width={size}
                    height={size}
                    className="h-full w-full object-contain"
                />
            </span>
            {animated && (
                <style jsx>{`
                    .fap-avatar-think {
                        animation: fap-avatar-bob 1.6s ease-in-out infinite;
                    }
                    @keyframes fap-avatar-bob {
                        0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
                        50% { transform: translateY(-2px) rotate(-4deg) scale(1.05); }
                    }
                    @media (prefers-reduced-motion: reduce) {
                        .fap-avatar-think { animation: none; }
                    }
                `}</style>
            )}
        </span>
    );
}

// =============================================================================
// Markdown-lite renderer — CHỈ xử lý **bold**.
// =============================================================================

function renderInlineMarkdown(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        parts.push(
            <strong key={key++} className="font-semibold text-indigo-600 underline decoration-indigo-300 decoration-2 underline-offset-2">
                {match[1]}
            </strong>
        );
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));

    return parts;
}

/** Tách phần "ℹ️ *...*" (notice tự động điền) khỏi mô tả chính. */
function splitAutoFillNotice(intro: string): { notice: string | null; description: string } {
    const markerIdx = intro.indexOf("ℹ️");
    if (markerIdx === -1) return { notice: null, description: intro.trim() };

    const afterMarker = intro.slice(markerIdx + 2).trim();
    if (!afterMarker.startsWith("*")) return { notice: null, description: intro.trim() };

    let i = 1;
    while (i < afterMarker.length) {
        if (afterMarker[i] === "*") {
            const prevIsStar = afterMarker[i - 1] === "*";
            const nextIsStar = afterMarker[i + 1] === "*";
            if (!prevIsStar && !nextIsStar) break;
        }
        i++;
    }

    if (i >= afterMarker.length) return { notice: null, description: intro.trim() };

    const notice = afterMarker.slice(1, i).trim();
    const description = afterMarker.slice(i + 1).trim();
    return { notice, description };
}

// =============================================================================
// Parse displayText -> danh sách field
// =============================================================================

interface ParsedField {
    label: string;
    icon: LucideIcon;
}

interface ParsedDisplayText {
    notice: string | null;
    description: string;
    fields: ParsedField[];
    hint: string;
}

const KEYWORD_ICON_RULES: Array<[string, LucideIcon]> = [
    ["ten cong ty", Building2],
    ["cong ty tiep nhan", Building2],
    ["vi tri thuc tap", Briefcase],
    ["vi tri", Briefcase],
    ["loai hinh thuc tap", Layers],
    ["loai hinh", Layers],
    ["tin chi", GraduationCap],
    ["ma mon hoc", BookOpen],
    ["ma mon", BookOpen],
    ["ho ten day du", User],
    ["ho ten", User],
    ["ten in", User],
    ["ten day du", User],
    ["phong ban", Users],
    ["thoi gian thuc tap", Calendar],
    ["ngay xay ra", Calendar],
    ["khoa", GraduationCap],
    ["college", School],
    ["nganh nghe", Globe],
    ["website", Globe],
    ["nguoi lien he", Contact],
    ["nguoi huong dan", Contact],
    ["giang vien", Contact],
    ["chuc danh", BadgeCheck],
    ["email", Mail],
    ["dien thoai", Phone],
    ["sdt", Phone],
    ["so gio", Clock],
    ["gio xay ra", Clock],
    ["mo ta", FileText],
    ["thong tin bo sung", FileText],
    ["dia diem", MapPin],
    ["nhan chung", Users],
    ["lan dau", HelpCircle],
    ["de xuat", Lightbulb],
    ["nguon", Search],
    ["diem danh gia", Star],
    ["danh gia tong quan", Star],
    ["gioi thieu", ThumbsUp],
    ["nhan xet", MessageSquare],
    ["mssv", Contact],
    ["ma so sinh vien", Contact],
];

function normalizeVi(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
}

function resolveFieldIcon(label: string): LucideIcon {
    const normalized = normalizeVi(label);
    for (const [keyword, icon] of KEYWORD_ICON_RULES) {
        if (normalized.includes(keyword)) return icon;
    }
    return FileText;
}

function parseDisplayText(text: string): ParsedDisplayText | null {
    const lines = text.split("\n");
    const bulletIndices: number[] = [];
    lines.forEach((line, i) => {
        if (/^\s*-\s+.+/.test(line)) bulletIndices.push(i);
    });

    if (bulletIndices.length === 0) return null;

    const firstBullet = bulletIndices[0];
    const lastBullet = bulletIndices[bulletIndices.length - 1];

    const introRaw = lines.slice(0, firstBullet).join(" ").trim();
    const hint = lines.slice(lastBullet + 1).join(" ").trim();

    const { notice, description } = splitAutoFillNotice(introRaw);

    const fields: ParsedField[] = bulletIndices.map((i) => {
        const label = lines[i].replace(/^\s*-\s+/, "").trim();
        return { label, icon: resolveFieldIcon(label) };
    });

    return { notice, description, fields, hint };
}

// =============================================================================
// Bảng màu xoay vòng cho từng field — đúng ảnh mẫu (xanh dương / tím /
// xanh lá / cam), lặp lại nếu số field nhiều hơn 4.
// =============================================================================

interface FieldPalette {
    border: string;
    iconBg: string;
    iconText: string;
    numberBg: string;
}

const FIELD_COLOR_PALETTE: FieldPalette[] = [
    { border: "border-blue-400", iconBg: "bg-blue-50", iconText: "text-blue-500", numberBg: "bg-blue-500" },
    { border: "border-purple-400", iconBg: "bg-purple-50", iconText: "text-purple-500", numberBg: "bg-purple-500" },
    { border: "border-emerald-400", iconBg: "bg-emerald-50", iconText: "text-emerald-500", numberBg: "bg-emerald-500" },
    { border: "border-amber-400", iconBg: "bg-amber-50", iconText: "text-amber-500", numberBg: "bg-amber-500" },
];

// =============================================================================
// StatusBadge — pill có icon, map raw status string
// =============================================================================

function StatusBadge({ status, locale, isLatest = true }: { status?: string | null; locale: "vi" | "en"; isLatest?: boolean }) {
    if (!status) return null;

    if (!isLatest && status !== "approved" && status !== "cancelled") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-sm bg-white text-gray-500 border border-gray-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" strokeWidth={2.5} />
                {locale === "en" ? "Past step" : "Bước đã qua"}
            </span>
        );
    }

    const map: Record<string, { label_vi: string; label_en: string; className: string; icon: LucideIcon; spin?: boolean }> = {
        collecting_info: {
            label_vi: "Đang xử lý",
            label_en: "In progress",
            className: "bg-white text-blue-600 border border-blue-200",
            icon: RefreshCw,
            spin: true,
        },
        awaiting_review: {
            label_vi: "Chờ xác nhận",
            label_en: "Awaiting confirmation",
            className: "bg-white text-amber-600 border border-amber-200",
            icon: HelpCircle,
        },
        approved: {
            label_vi: "Hoàn thành",
            label_en: "Completed",
            className: "bg-white text-emerald-600 border border-emerald-200",
            icon: CheckCircle2,
        },
        cancelled: {
            label_vi: "Đã hủy",
            label_en: "Cancelled",
            className: "bg-white text-gray-500 border border-gray-200",
            icon: X,
        },
    };

    const entry = map[status] ?? {
        label_vi: status,
        label_en: status,
        className: "bg-white text-gray-500 border border-gray-200",
        icon: Info,
    };

    const Icon = entry.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-sm ${entry.className}`}>
            <Icon className={`h-3.5 w-3.5 ${entry.spin ? "animate-spin" : ""}`} strokeWidth={2.5} />
            {locale === "en" ? entry.label_en : entry.label_vi}
        </span>
    );
}

// =============================================================================
// Card hiển thị field — mỗi field 1 "thẻ" riêng, viền màu trái, cách
// nhau bằng gap thay vì divider mảnh như bản trước.
// =============================================================================

function ParsedFieldCard({ parsed, locale, isLatest = true }: { parsed: ParsedDisplayText; locale: "vi" | "en"; isLatest?: boolean }) {
    return (
        <div className="space-y-3">
            {parsed.notice && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/60 px-4 py-3">
                    <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500">
                            <Info className="h-3 w-3 text-white" strokeWidth={2.5} />
                        </span>
                        <p className="text-sm font-medium text-slate-600 pr-8">{renderInlineMarkdown(parsed.notice)}</p>
                    </div>
                    <img
                        src="/deco-clipboard.png"
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-1 -top-1 h-[52px] w-auto object-contain opacity-90"
                    />
                </div>
            )}

            {parsed.description && (
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                        <ClipboardList className="h-3.5 w-3.5 text-purple-500" strokeWidth={2} />
                    </span>
                    <p className="text-sm font-semibold text-indigo-900">
                        <span className="underline decoration-indigo-200 decoration-2 underline-offset-4">
                            {parsed.description}
                        </span>
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-2.5">
                {parsed.fields.map((field, i) => {
                    const Icon = field.icon;
                    const palette = FIELD_COLOR_PALETTE[i % FIELD_COLOR_PALETTE.length];
                    return (
                        <div
                            key={`${field.label}-${i}`}
                            className={`flex items-center gap-3 rounded-xl border-l-4 ${palette.border} bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100`}
                        >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${palette.iconBg}`}>
                                <Icon className={`h-4 w-4 ${palette.iconText}`} strokeWidth={2} />
                            </span>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${palette.numberBg}`}>
                                {i + 1}
                            </span>
                            <span className="flex-1 text-sm font-medium text-slate-800">{field.label}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                        </div>
                    );
                })}
            </div>

            {parsed.hint && (
                <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-50 to-purple-50/40 px-4 py-2.5">
                    <p className="flex-1 text-xs font-medium text-indigo-500">{renderInlineMarkdown(parsed.hint)}</p>
                    <img
                        src="/deco-chatheart.png"
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none h-8 w-auto shrink-0 object-contain"
                    />
                </div>
            )}

            {isLatest && (
                <div className="relative flex items-center px-1 py-1 overflow-hidden">
                    <img
                        src="/deco-airplane.png"
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute right-0 top-1/2 -translate-y-[65%] h-auto max-h-11 w-auto max-w-[85%] object-contain opacity-90"
                    />
                    <p className="relative z-10 text-xs font-medium text-indigo-500 max-w-[55%]">
                        {locale === "en"
                            ? "Reply right in the chat input below 👇"
                            : "Trả lời ngay trong ô nhập tin nhắn bên dưới nhé 👇"}
                    </p>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// useMinDurationLoading — giữ bubble "đang xử lý" hiện tối thiểu N ms.
// =============================================================================

const MIN_PROCESSING_MS = 6000;

function useMinDurationLoading(loading: boolean | undefined, minMs: number = MIN_PROCESSING_MS): boolean {
    const [visible, setVisible] = React.useState<boolean>(!!loading);
    const startRef = React.useRef<number | null>(null);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (loading) {
            startRef.current = Date.now();
            setVisible(true);
            return;
        }

        if (startRef.current === null) {
            setVisible(false);
            return;
        }

        const elapsed = Date.now() - startRef.current;
        const remaining = minMs - elapsed;

        if (remaining <= 0) {
            setVisible(false);
            startRef.current = null;
        } else {
            timeoutRef.current = setTimeout(() => {
                setVisible(false);
                startRef.current = null;
            }, remaining);
        }
    }, [loading, minMs]);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return visible;
}

// =============================================================================
// ProcessingIndicator
// =============================================================================

function TypingDots() {
    return (
        <span className="inline-flex gap-[3px]" aria-hidden="true">
            <span className="fap-typing-dot" />
            <span className="fap-typing-dot" />
            <span className="fap-typing-dot" />
            <style jsx>{`
                .fap-typing-dot {
                    width: 5px;
                    height: 5px;
                    border-radius: 9999px;
                    background: #a5b4fc;
                    animation: fap-bounce 1.2s infinite ease-in-out;
                }
                .fap-typing-dot:nth-child(2) { animation-delay: 0.2s; }
                .fap-typing-dot:nth-child(3) { animation-delay: 0.4s; }
                @keyframes fap-bounce {
                    0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
                    40% { opacity: 1; transform: translateY(-2px); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .fap-typing-dot { animation: none; opacity: 0.7; }
                }
            `}</style>
        </span>
    );
}

function formatNowTime(): string {
    return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function ProcessingIndicator({ locale }: { locale: "vi" | "en" }) {
    const time = React.useMemo(() => formatNowTime(), []);

    return (
        <div className="flex items-start gap-3" role="status" aria-live="polite">
            <AgentAvatar size={44} animated />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                        {locale === "en" ? "Agent is processing..." : "Agent đang xử lý thông tin..."}
                    </span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{time}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                    <TypingDots />
                    <span className="text-xs text-slate-500">
                        {locale === "en"
                            ? "Analyzing your request and preparing a reply"
                            : "Đang phân tích yêu cầu và chuẩn bị câu trả lời"}
                    </span>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Gửi đơn qua mailto: — KHÔNG cần backend.
//
// ⚠️ CẦN SỬA: thay các email TODO bên dưới bằng email thật của từng
// phòng ban trước khi dùng thật.
// =============================================================================

const DEPARTMENT_EMAIL_MAP: Array<[string, { name: string; email: string }]> = [
    ["form 1", { name: "Phòng Career Services", email: "TODO-career-services@vinuni.edu.vn" }],
    ["form 2", { name: "Phòng Quan hệ Quốc tế", email: "TODO-international-office@vinuni.edu.vn" }],
    ["form 3", { name: "Phòng Xử lý Khiếu nại Thực tập", email: "TODO-internship-grievance@vinuni.edu.vn" }],
    ["form 4", { name: "Phòng Đào tạo", email: "TODO-academic-office@vinuni.edu.vn" }],
];

function resolveDepartment(detectedFormName?: string): { name: string; email: string } {
    const normalized = normalizeVi(detectedFormName || "");
    for (const [keyword, dept] of DEPARTMENT_EMAIL_MAP) {
        if (normalized.includes(keyword)) return dept;
    }
    return { name: "Phòng Thực tập", email: "TODO-default@vinuni.edu.vn" };
}

function buildMailtoUrl(dept: { name: string; email: string }, formName: string, locale: "vi" | "en"): string {
    const subject =
        locale === "en"
            ? `[Form Submission] ${formName}`
            : `[Nộp đơn] ${formName}`;

    const body =
        locale === "en"
            ? `Dear ${dept.name},\n\nPlease find attached my completed ${formName}, filled out via Internova AI.\n\n(Note: please attach the .docx file you just downloaded to this email before sending — browsers cannot auto-attach files via mailto links.)\n\nBest regards,`
            : `Kính gửi ${dept.name},\n\nEm xin gửi đơn ${formName} đã hoàn thiện qua Internova AI, vui lòng xem file đính kèm.\n\n(Lưu ý: bạn cần tự đính kèm file .docx vừa tải về vào email này trước khi gửi — trình duyệt không thể tự động đính kèm file qua đường link mailto.)\n\nEm cảm ơn.`;

    return `mailto:${dept.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// =============================================================================
// Component chính — GIỮ NGUYÊN toàn bộ logic/props/callback cũ
// =============================================================================

export default function FormAgentPanel({
    phase,
    detectedFormName,
    status,
    displayText,
    loading,
    error,
    docxReady,
    sessionId,
    locale = "vi",
    isLatest = true,
    onConfirmYes,
    onConfirmNo,
    onApprove,
    onCancelSession,
    onRequestEdit,
}: FormAgentPanelProps) {
    // ── Bước xác nhận đơn giản ────────────────────────────────────────
    if (phase === "confirm") {
        return (
            <div className="fap-scope relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50/30 p-5 space-y-3 shadow-sm">
                <FontScope />
                <Sparkles className="pointer-events-none absolute right-5 top-5 h-5 w-5 text-indigo-200" strokeWidth={1.5} />
                <div className="flex items-center gap-3">
                    <AgentAvatar size={56} />
                    <h3 className="text-base font-bold text-indigo-900">
                        {locale === "en" ? "Form Agent" : "Agent điền đơn"}
                    </h3>
                </div>
                <p className="text-sm font-medium text-slate-700">
                    {locale === "en" ? (
                        <>
                            Do you want me to help you fill out{" "}
                            <strong className="text-indigo-600">{detectedFormName ?? "this form"}</strong> right now?
                        </>
                    ) : (
                        <>
                            Bạn có muốn mình giúp điền{" "}
                            <strong className="text-indigo-600">{detectedFormName ?? "biểu mẫu này"}</strong> ngay
                            bây giờ không?
                        </>
                    )}
                </p>
                {isLatest && (
                    <div className="flex items-center gap-2">
                        <Send className="h-3.5 w-3.5 shrink-0 text-indigo-400" strokeWidth={2} />
                        <p className="text-xs font-medium text-indigo-500">
                            {locale === "en" ? "Type \"yes\" or \"no\" right in the chat input below 👇" : "Gõ \"có\" hoặc \"không\" ngay trong ô nhập tin nhắn bên dưới nhé 👇"}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // ── Đang làm việc ─────────────────────────────────────────────────
    const downloadUrl =
        sessionId != null
            ? `${API_BASE}/api/v1/form-agent/download/${sessionId}`
            : null;

    const parsed = displayText ? parseDisplayText(displayText) : null;
    const showProcessing = isLatest && useMinDurationLoading(loading);

    return (
        <div className="fap-scope relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50/30 p-5 space-y-3 shadow-sm">
            <FontScope />

            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <AgentAvatar size={56} />
                    <div className="min-w-0">
                        <h3 className="text-lg font-extrabold text-indigo-950 truncate">
                            {locale === "en" ? "Information you need to provide" : "Thông tin bạn cần cung cấp"}
                        </h3>
                        <p className="text-xs font-medium text-slate-500">
                            {locale === "en"
                                ? "Please provide complete information to finish your form"
                                : "Vui lòng cung cấp đầy đủ thông tin để hoàn thiện đơn"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={status} locale={locale} isLatest={isLatest} />
                    {isLatest && sessionId && status !== "approved" && status !== "cancelled" && (
                        <button
                            onClick={onCancelSession}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 shadow-sm transition-colors hover:border-red-300 hover:bg-red-100 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                            {locale === "en" ? "Cancel" : "Hủy phiên"}
                        </button>
                    )}
                </div>
            </div>

            {showProcessing && <ProcessingIndicator locale={locale} />}

            {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                    ⚠️ {error}
                </p>
            )}

            {status === "cancelled" ? (
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
                    <X className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.2} />
                    <p className="text-sm text-gray-500">
                        {locale === "en" ? "Form filling session cancelled." : "Đã hủy phiên điền đơn."}
                    </p>
                </div>
            ) : (
                <>
                    {displayText && !showProcessing && (
                        parsed ? (
                            <ParsedFieldCard parsed={parsed} locale={locale} isLatest={isLatest} />
                        ) : (
                            <div className="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-xl border border-gray-200 p-3">
                                {renderInlineMarkdown(displayText)}
                            </div>
                        )
                    )}
                </>
            )}

            {status === "approved" && (
                <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-sm text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
                        {locale === "en" ? "Confirmed successfully!" : "Đã xác nhận xong!"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {downloadUrl && docxReady && (
                            <a
                                href={downloadUrl}
                                className="inline-flex items-center gap-1.5 text-sm bg-emerald-500 text-white rounded-xl px-4 py-2 font-medium shadow-sm hover:bg-emerald-600"
                            >
                                ⬇️ {locale === "en" ? "Download filled file" : "Tải file đã điền"}
                            </a>
                        )}
                        {docxReady && (
                            <a
                                href={buildMailtoUrl(resolveDepartment(detectedFormName), detectedFormName ?? "", locale)}
                                className="inline-flex items-center gap-1.5 text-sm bg-indigo-500 text-white rounded-xl px-4 py-2 font-medium shadow-sm hover:bg-indigo-600"
                            >
                                📧 {locale === "en" ? "Send form" : "Gửi đơn"}
                            </a>
                        )}
                    </div>
                    {docxReady && (
                        <p className="text-xs text-gray-500 italic">
                            {locale === "en"
                                ? "\"Send form\" opens your email app with the recipient/subject/body pre-filled — remember to attach the downloaded file before sending."
                                : "Nút \"Gửi đơn\" sẽ mở app email của bạn với người nhận/tiêu đề/nội dung đã điền sẵn — nhớ tự đính kèm file vừa tải về trước khi gửi nhé."}
                        </p>
                    )}
                </div>
            )}

            {status === "awaiting_review" && (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={onApprove}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 bg-indigo-500 text-white text-sm font-medium rounded-xl px-4 py-2 shadow-sm hover:bg-indigo-600 disabled:opacity-50"
                    >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
                        {locale === "en" ? "Confirm, looks good" : "Xác nhận, đúng rồi"}
                    </button>
                    {isLatest && (
                        <button
                            onClick={onRequestEdit}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 bg-white text-indigo-600 text-sm font-medium rounded-xl border border-indigo-200 px-4 py-2 shadow-sm hover:bg-indigo-50 disabled:opacity-50"
                        >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                            {locale === "en" ? "Edit" : "Sửa"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}