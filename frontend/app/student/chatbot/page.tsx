"use client";

import {
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";
import FormAgentPanel from "@/components/FormAgentPanel";
import { useSettings } from "@/context/settings-provider";

import {
    BrainCircuit,
    ChevronDown,
    CircleCheck,
    ArrowDown,
    ArrowRight,
    Clock,
    ClipboardList,
    CircleHelp,
    Database,
    Download,
    Eye,
    FileText,
    History,
    ListTree,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Check,
    ShieldCheck,
    Square,
    Send,
    Trash2,
    X,
} from "lucide-react";

import styles from "./page.module.css";



const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


const CHAT_MESSAGES_KEY_PREFIX =
    "internova_chat_messages";

const CHAT_SESSION_KEY_PREFIX =
    "internova_chat_session_id";

const CHAT_SESSION_DRAFT_KEY_PREFIX =
    "internova_chat_session_draft";

const CHAT_UPDATED_EVENT =
    "internova:chat-updated";

let unscopedChatStorageId: string | null = null;

type ChatRuntimeWindow = Window & {
    __internovaChatStreamActive?: boolean;
    __internovaChatAbortController?: AbortController | null;
    // Session that currently owns the active streaming request.
    // This lets the stream continue safely while the user browses another chat.
    __internovaChatStreamSessionId?: string | null;
};


/*
 * Messenger-like history rendering:
 * - Fetch only 10 newest messages when a session is opened.
 * - Keep only the currently fetched history pages in memory.
 * - Automatically fetch/prepend 10 older messages when the user scrolls upward.
 */
const INITIAL_VISIBLE_MESSAGES = 10;
const CHAT_HISTORY_PAGE_SIZE = 10;
const NEAR_BOTTOM_THRESHOLD_PX = 180;

const CHAT_HISTORY_CURSOR_KEY =
    "internova_chat_history_cursor";

const CHAT_HISTORY_HAS_MORE_KEY =
    "internova_chat_history_has_more";
// 8 text lines at the current line-height, including vertical padding.
const COMPOSER_MAX_HEIGHT_PX = 194;


function resizeComposer(
    textarea: HTMLTextAreaElement | null,
) {
    if (!textarea) {
        return;
    }

    textarea.style.height =
        "auto";

    const nextHeight =
        Math.min(
            textarea.scrollHeight,
            COMPOSER_MAX_HEIGHT_PX,
        );

    textarea.style.height =
        `${nextHeight}px`;

    textarea.style.overflowY =
        textarea.scrollHeight >
        COMPOSER_MAX_HEIGHT_PX
            ? "auto"
            : "hidden";
}
const CHAT_INPUT_MAX_HEIGHT_PX = 200;


function findScrollableParent(
    element: HTMLElement | null,
): HTMLElement | null {
    let current =
        element?.parentElement ?? null;

    while (current) {
        const style =
            window.getComputedStyle(current);

        const overflowY =
            style.overflowY;

        if (
            (
                overflowY === "auto"
                ||
                overflowY === "scroll"
            )
            &&
            current.scrollHeight >
            current.clientHeight
        ) {
            return current;
        }

        current =
            current.parentElement;
    }

    return null;
}


type Source = {
    document_name?: string;
    document_type?: string;

    page?: number | null;
    section?: string | null;
    subsection?: string | null;

    chunk_id?: string | null;
    quote_original?: string | null;

    file_name?: string | null;
    preview_url?: string | null;
    download_url?: string | null;

    metadata?: Record<string, unknown> | null;
};


type ChatPhase =
    | "idle"
    | "retrieving"
    | "thinking"
    | "answering"
    | "streaming"
    | "done"
    | "error";


type ProcessingStep = {
    id: string;
    status: "pending" | "running" | "completed" | "error";
    engine?: string | null;
    model?: string | null;
    detail?: string | null;
    metrics?: Record<string, string | number | boolean | null>;
    references?: Source[];
};


type ProcessingSummary = {
    provider?: string | null;
    responseModel?: string | null;
    embeddingModel?: string | null;
    routeIntent?: string | null;
    routeScope?: string | null;
    latencyMs?: number | null;
    steps?: ProcessingStep[];
};


type Message = {
    id: string;

    role:
    | "user"
    | "assistant";

    content: string;

    sources?: Source[];

    confidence?: number;

    needsRetrieval?: boolean;

    status?: string;

    streamPhase?: ChatPhase;

    createdAt?: string;

    processingSteps?: ProcessingStep[];

    processing?: ProcessingSummary;

    startedAtMs?: number;
    completedAtMs?: number;

    // ── FORM AGENT: kết quả kiểm tra độc lập, không phụ thuộc vào
    // cách backend gắn nhãn document_type cho sources ────────────────
    detectedForm?: string | null;

    // Mỗi lượt của agent điền đơn là 1 tin nhắn assistant riêng, y hệt
    // tin nhắn RAG bình thường — không còn 1 panel cố định tách biệt.
    isFormAgentMessage?: boolean;
    formAgentPhase?: "confirm" | "working";
    formAgentSessionId?: string | null;
    formAgentStatus?: string | null;
    formAgentDetectedName?: string;
    formAgentDocxReady?: boolean;
    formAgentLoading?: boolean;
    formAgentErrorMsg?: string | null;
    // ── HẾT PHẦN FORM AGENT ──────────────────────────────────────────
};


type ChatHistorySession = {
    id: string;
    title: string;
    status: "ACTIVE" | "ARCHIVED";
    messageCount: number;
    lastMessagePreview: string | null;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
};


type ChatSessionsResponse = {
    sessions: ChatHistorySession[];
};


type ChatMessagesPageResponse = {
    messages: Message[];
    nextCursor?: string | null;
    hasMore?: boolean;
};


type StreamEvent = {
    type: "status" | "token" | "final" | "error";
    phase?: ChatPhase;
    token?: string;
    detail?: string;
    response?: string;
    session_id?: string | null;
    needs_retrieval?: boolean;
    route_intent?: string | null;
    route_scope?: string | null;
    step?: ProcessingStep | null;
    processing?: ProcessingSummary;
    form_agent?: {
        session_id?: string | null;
        status?: string | null;
        detected_form?: string | null;
        docx_ready?: boolean;
    };
    result?: {
        answer?: string;
        answer_status?: string;
        confidence?: number;
        needs_retrieval?: boolean;
        route_intent?: string | null;
        route_scope?: string | null;
        sources?: Source[];
    };
};


function mergeProcessingSteps(
    current: ProcessingStep[] = [],
    incoming: ProcessingStep[] = [],
) {
    const next = [...current];

    for (const step of incoming) {
        const index = next.findIndex(item => item.id === step.id);
        if (index < 0) {
            next.push(step);
            continue;
        }

        const previous = next[index];
        next[index] = {
            ...previous,
            ...step,
            metrics: {
                ...(previous.metrics ?? {}),
                ...(step.metrics ?? {}),
            },
        };
    }

    return next;
}



function getToken() {
    if (typeof window === "undefined") {
        return null;
    }
    return localStorage.getItem("internova_access_token");
}

function getChatStorageUserId(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const storedUser = JSON.parse(
            localStorage.getItem("internova_user") ?? "null",
        ) as { id?: string | number } | null;
        const userId = String(storedUser?.id ?? "").trim();

        if (userId) {
            return userId;
        }
    } catch {
        // Fall back to the authenticated token when local user data is invalid.
    }

    try {
        const encodedPayload = getToken()?.split(".")[1];
        if (!encodedPayload) {
            return null;
        }

        const normalizedPayload = encodedPayload
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
        const payload = JSON.parse(atob(normalizedPayload)) as {
            user_id?: string | number;
            sub?: string | number;
        };
        const userId = String(payload.user_id ?? payload.sub ?? "").trim();

        return userId || null;
    } catch {
        return null;
    }
}

function getChatStorageKey(prefix: string): string {
    const userId = getChatStorageUserId();

    if (userId) {
        return `${prefix}:user:${userId}`;
    }

    // Do not let malformed local auth data fall back to a shared chat key.
    unscopedChatStorageId ??= crypto.randomUUID();
    return `${prefix}:unscoped:${unscopedChatStorageId}`;
}

function getChatMessagesStorageKey(): string {
    return getChatStorageKey(CHAT_MESSAGES_KEY_PREFIX);
}

function getChatSessionStorageKey(): string {
    return getChatStorageKey(CHAT_SESSION_KEY_PREFIX);
}

function getChatSessionDraftStorageKey(
    sessionId: string,
): string {
    return `${getChatStorageKey(CHAT_SESSION_DRAFT_KEY_PREFIX)}:session:${sessionId}`;
}

function readChatSessionDraft(
    sessionId: string,
): Message[] | null {
    if (typeof window === "undefined" || !sessionId) {
        return null;
    }

    try {
        const stored = sessionStorage.getItem(
            getChatSessionDraftStorageKey(sessionId),
        );

        if (!stored) {
            return null;
        }

        const parsed = JSON.parse(stored) as Message[];
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function mergeChatMessages(
    serverMessages: Message[],
    draftMessages: Message[],
): Message[] {
    if (draftMessages.length === 0) {
        return serverMessages;
    }

    const draftById = new Map(
        draftMessages.map(message => [message.id, message]),
    );
    const serverIds = new Set(
        serverMessages.map(message => message.id),
    );

    return [
        ...serverMessages.map(
            message => draftById.get(message.id) ?? message,
        ),
        ...draftMessages.filter(
            message => !serverIds.has(message.id),
        ),
    ];
}

function formatChatTimestamp(
    value: string,
    locale: "vi" | "en",
) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat(
        locale === "en" ? "en-GB" : "vi-VN",
        {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        },
    ).format(date);
}

function resolveApiUrl(
    value?: string | null,
): string | null {
    if (!value) {
        return null;
    }

    if (
        value.startsWith("http://")
        ||
        value.startsWith("https://")
    ) {
        return value;
    }

    const path =
        value.startsWith("/")
            ? value
            : `/${value}`;

    return `${API_URL}${path}`;
}


function getPhaseLabel(
    phase: ChatPhase,
    locale: "vi" | "en" = "vi",
): string {
    const labels: Record<ChatPhase, { vi: string; en: string }> = {
        retrieving: { vi: "Đang tìm tài liệu", en: "Searching documents" },
        thinking:   { vi: "Đang suy nghĩ", en: "Thinking" },
        answering:  { vi: "Đang trả lời", en: "Answering" },
        streaming:  { vi: "Đang trả lời", en: "Answering" },
        done:       { vi: "Đã hoàn tất", en: "Completed" },
        error:      { vi: "Đã dừng xử lý", en: "Processing stopped" },
        idle:       { vi: "", en: "" },
    };
    return labels[phase]?.[locale] ?? "";
}



function shouldAnimatePhase(
    phase: ChatPhase,
): boolean {
    return (
        phase === "retrieving"
        ||
        phase === "thinking"
        ||
        phase === "answering"
        ||
        phase === "streaming"
    );
}


export default function RagChatPage() {

    const { locale, t } = useSettings();

    const welcomeMessage: Message = {
        id: "welcome",
        role: "assistant",
        content: t("chat.welcome"),
    };

    const suggestions = [
        t("chat.suggestion.1"),
        t("chat.suggestion.2"),
        t("chat.suggestion.3"),
    ];

    const suggestionIcons = [
        Clock,
        ClipboardList,
        CircleHelp,
    ];

    const [
        messages,
        setMessages,
    ] =
        useState<Message[]>([
            welcomeMessage,
        ]);


    const [
        chatSessions,
        setChatSessions,
    ] = useState<ChatHistorySession[]>([]);

    const [
        historyLoading,
        setHistoryLoading,
    ] = useState(false);

    const [
        historyError,
        setHistoryError,
    ] = useState("");

    const [
        historyOpen,
        setHistoryOpen,
    ] = useState(false);

    const [
        switchingSessionId,
        setSwitchingSessionId,
    ] = useState<string | null>(null);

    const [
        renamingSessionId,
        setRenamingSessionId,
    ] = useState<string | null>(null);

    const [
        renameTitle,
        setRenameTitle,
    ] = useState("");

    const [
        deletingSessionId,
        setDeletingSessionId,
    ] = useState<string | null>(null);


    const [
        input,
        setInput,
    ] =
        useState("");


    const composerInputRef =
        useRef<HTMLTextAreaElement | null>(
            null
        );


    useLayoutEffect(
        () => {
            resizeComposer(
                composerInputRef.current
            );
        },
        [
            input,
        ]
    );


    const [
        loading,
        setLoading,
    ] =
        useState(false);


    // ── FORM AGENT: mỗi lượt là 1 tin nhắn assistant bình thường,
    // hiện tự nhiên trong dòng chat — không còn panel cố định.
    const [activeFormAgentSessionId, setActiveFormAgentSessionId] = useState<string | null>(null);
    const [activeFormAgentStatus, setActiveFormAgentStatus] = useState<string | null>(null);


    function normalizeFormIntentText(value: string): string {
        return value
            .toLowerCase()
            .replace(/\u0111/g, "d")
            .replace(/\u0110/g, "d")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function isExplicitFormFillRequest(value: string): boolean {
        const normalized = normalizeFormIntentText(value);
        const hasFormTarget = /\b(form|don|bieu mau)\b/.test(normalized);
        const hasFillOrCreateAction = /\b(dien|lam|tao|fill|complete|prepare)\b/.test(normalized);
        const directCommand = /^(dien|lam|tao|fill|complete|prepare)\s+(form|don|bieu mau)\b/.test(normalized);
        const asksForHelp = [
            "giup",
            "ho",
            "gium",
            "cho minh",
            "cho em",
            "cho toi",
            "toi muon",
            "em muon",
            "minh muon",
            "can ban",
            "can minh",
            "bat dau",
            "lam luon",
            "dien luon",
            "help me",
            "i want",
            "please",
        ].some(phrase => normalized.includes(phrase));
        const asksAboutInstructions = [
            "cach dien",
            "huong dan dien",
            "quy trinh dien",
            "tai form",
            "download form",
            "form nao",
            "can form nao",
        ].some(phrase => normalized.includes(phrase));

        return hasFormTarget && hasFillOrCreateAction && (directCommand || asksForHelp) && !asksAboutInstructions;
    }

    function isActiveFormAgentTurn(status: string | null): boolean {
        return status === "selecting_form"
            || status === "collecting_info"
            || status === "awaiting_review";
    }

    function updateMessageById(
        messageId: string,
        updater: (current: Message) => Message,
    ) {
        setMessages(current =>
            current.map(item =>
                item.id === messageId ? updater(item) : item
            )
        );
    }

    // Bắt đầu phiên Form Agent trực tiếp (từ nút bấm hoặc từ câu chat xác nhận)
    async function startFormAgent(
        formName?: string,
        userPrompt?: string,
        visibleUserMessage?: Message,
    ) {
        const newId = crypto.randomUUID();

        setMessages(current => [
            ...current,
            {
                id: newId,
                role: "assistant",
                content: "",
                isFormAgentMessage: true,
                formAgentPhase: "working",
                formAgentDetectedName: formName,
                formAgentLoading: true,
            },
        ]);

        requestAnimationFrame(() => scrollToBottom("smooth"));

        try {
            if (visibleUserMessage) {
                await persistStandaloneMessage(
                    visibleUserMessage.id,
                    "USER",
                    visibleUserMessage.content,
                    visibleUserMessage.content,
                );
            }

            const res = await fetch(`${API_URL}/api/v1/form-agent/turn`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: null,
                    message: userPrompt || "bắt đầu điền đơn",
                    detected_form: formName || undefined,
                }),
            });
            if (!res.ok) throw new Error(`Lỗi server: ${res.status}`);
            const data = await res.json();
            const assistantContent =
                data.ask_message || data.review_summary_markdown || "";

            updateMessageById(newId, m => ({
                ...m,
                formAgentSessionId: data.session_id,
                formAgentStatus: data.status,
                content: assistantContent,
                formAgentDocxReady: data.docx_ready,
                formAgentLoading: false,
                formAgentErrorMsg: data.error ?? null,
            }));

            setActiveFormAgentSessionId(data.session_id);
            setActiveFormAgentStatus(data.status);

            await persistStandaloneMessage(
                newId,
                "ASSISTANT",
                assistantContent,
                visibleUserMessage?.content
                    || formName
                    || (locale === "en" ? "Fill a form" : "Điền biểu mẫu"),
            );
            void loadChatSessions();
        } catch (err) {
            updateMessageById(newId, m => ({
                ...m,
                formAgentLoading: false,
                formAgentErrorMsg: err instanceof Error ? err.message : "Đã có lỗi xảy ra",
            }));
        }
    }

    // Bấm nút gợi ý -> Chạy Form Agent trực tiếp ngay lập tức
// Sinh viên gõ câu trả lời cho agent NGAY TẠI Ô NHẬP CHÍNH →
    // THÊM 1 tin nhắn assistant mới (không sửa tin nhắn cũ) chứa
    // câu hỏi/kết quả tiếp theo — giống hệt cách chat RAG bình
    // thường thêm tin nhắn mới mỗi lượt.
    async function continueFormAgentTurn(
        userText: string,
        userMessageId: string,
    ) {
        const newId = crypto.randomUUID();

        setMessages(current => [
            ...current,
            {
                id: newId,
                role: "assistant",
                content: "",
                isFormAgentMessage: true,
                formAgentPhase: "working",
                formAgentSessionId: activeFormAgentSessionId,
                formAgentStatus: activeFormAgentStatus,
                formAgentLoading: true,
            },
        ]);

        requestAnimationFrame(() => scrollToBottom("smooth"));

        try {
            await persistStandaloneMessage(
                userMessageId,
                "USER",
                userText,
                userText,
            );

            const res = await fetch(`${API_URL}/api/v1/form-agent/turn`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: activeFormAgentSessionId,
                    message: userText,
                }),
            });
            if (!res.ok) throw new Error(`Lỗi server: ${res.status}`);
            const data = await res.json();
            const assistantContent =
                data.ask_message || data.review_summary_markdown || "";

            updateMessageById(newId, m => ({
                ...m,
                formAgentSessionId: data.session_id,
                formAgentStatus: data.status,
                content: assistantContent,
                formAgentDocxReady: data.docx_ready,
                formAgentLoading: false,
                formAgentErrorMsg: data.error ?? null,
            }));

            setActiveFormAgentStatus(data.status);
            if (data.status === "approved" || data.status === "cancelled") {
                setActiveFormAgentSessionId(null);
                setActiveFormAgentStatus(null);
            }

            await persistStandaloneMessage(
                newId,
                "ASSISTANT",
                assistantContent,
                userText,
            );
            void loadChatSessions();
        } catch (err) {
            updateMessageById(newId, m => ({
                ...m,
                formAgentLoading: false,
                formAgentErrorMsg: err instanceof Error ? err.message : "Đã có lỗi xảy ra",
            }));
        }
    }

    async function handleFormAgentApprove(messageId: string, sessionId: string) {
        updateMessageById(messageId, m => ({ ...m, formAgentLoading: true }));
        try {
            const res = await fetch(`${API_URL}/api/v1/form-agent/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId }),
            });
            if (!res.ok) throw new Error(`Lỗi server: ${res.status}`);
            const data = await res.json();
            updateMessageById(messageId, m => ({
                ...m,
                formAgentStatus: data.status,
                formAgentDocxReady: data.docx_ready,
                formAgentLoading: false,
            }));
            setActiveFormAgentSessionId(null);
            setActiveFormAgentStatus(null);
        } catch (err) {
            updateMessageById(messageId, m => ({
                ...m,
                formAgentLoading: false,
                formAgentErrorMsg: err instanceof Error ? err.message : "Đã có lỗi xảy ra",
            }));
        }
    }

    async function handleFormAgentCancelSession(messageId: string, sessionId: string) {
        updateMessageById(messageId, m => ({ ...m, formAgentLoading: true }));
        try {
            await fetch(`${API_URL}/api/v1/form-agent/cancel/${sessionId}`, {
                method: "POST",
            });
        } finally {
            updateMessageById(messageId, m => ({
                ...m,
                formAgentStatus: "cancelled",
                formAgentLoading: false,
            }));
            setActiveFormAgentSessionId(null);
            setActiveFormAgentStatus(null);
        }
    }
    // ── HẾT PHẦN FORM AGENT ──────────────────────────────────────────



    const [
        storageLoaded,
        setStorageLoaded,
    ] =
        useState(false);


    /*
     * Do not render the entire conversation at once.
     * This is the main mechanism that keeps long chats responsive.
     */
    const [
        visibleMessageCount,
        setVisibleMessageCount,
    ] =
        useState(
            INITIAL_VISIBLE_MESSAGES
        );

    /*
     * Server-side history pagination.
     * `messages` only contains pages that have actually been fetched.
     */
    const [
        olderCursor,
        setOlderCursor,
    ] = useState<string | null>(null);

    const [
        hasOlderMessages,
        setHasOlderMessages,
    ] = useState(false);

    const [
        olderMessagesLoading,
        setOlderMessagesLoading,
    ] = useState(false);

    const olderLoadInFlightRef =
        useRef(false);


    const bottomRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const topSentinelRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const messageListRef =
        useRef<HTMLDivElement | null>(
            null
        );

    const chatInputRef =
        useRef<HTMLTextAreaElement | null>(
            null
        );

    const bindChatInputRef = useCallback(
        (textarea: HTMLTextAreaElement | null) => {
            composerInputRef.current = textarea;
            chatInputRef.current = textarea;
        },
        []
    );


    const [
        showJumpToLatest,
        setShowJumpToLatest,
    ] = useState(false);


    const [
        promptNavOpen,
        setPromptNavOpen,
    ] = useState(false);


    const promptNavCloseTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(
            null
        );


    const userMessageRefs =
        useRef<Record<string, HTMLDivElement | null>>({});


    const streamFrameRef =
        useRef<number | null>(null);

    /*
     * Messenger does not force the user back to the newest message while
     * they are reading older history. We track whether the user is near
     * the bottom before auto-scrolling.
     */
    const isNearBottomRef =
        useRef(true);

    /*
     * When old messages are prepended, preserve the user's viewport so
     * the conversation does not jump.
     */
    const preserveScrollRef =
        useRef<{
            element: HTMLElement;
            previousScrollHeight: number;
        } | null>(
            null
        );


    const sessionIdRef =
        useRef<string>("");

    // Buffer streamed tokens and flush once per animation frame.
    // ReactMarkdown stays active while content is arriving.
    const streamBufferRef =
        useRef<string>("");

    const abortControllerRef =
        useRef<AbortController | null>(null);

    const messagesRef =
        useRef<Message[]>([
            welcomeMessage,
        ]);

    const getChatRuntime = () =>
        window as ChatRuntimeWindow;

    const persistMessages = (
        nextMessages: Message[],
    ) => {
        messagesRef.current = nextMessages;

        const activeSessionId = sessionIdRef.current;
        if (activeSessionId) {
            sessionStorage.setItem(
                getChatSessionDraftStorageKey(activeSessionId),
                JSON.stringify(nextMessages),
            );
        }

        sessionStorage.setItem(
            getChatMessagesStorageKey(),
            JSON.stringify(nextMessages)
        );

        window.dispatchEvent(
            new Event(CHAT_UPDATED_EVENT)
        );
    };

    const persistHistoryPagination = (
        cursor: string | null,
        hasMore: boolean,
    ) => {
        setOlderCursor(cursor);
        setHasOlderMessages(hasMore);

        if (cursor) {
            sessionStorage.setItem(
                CHAT_HISTORY_CURSOR_KEY,
                cursor,
            );
        } else {
            sessionStorage.removeItem(
                CHAT_HISTORY_CURSOR_KEY,
            );
        }

        sessionStorage.setItem(
            CHAT_HISTORY_HAS_MORE_KEY,
            hasMore ? "1" : "0",
        );
    };


    const authenticatedFetch = useCallback(
        (
            path: string,
            init?: RequestInit,
        ) => {
            const token = getToken();
            const headers = new Headers(init?.headers);

            if (token) {
                headers.set("Authorization", `Bearer ${token}`);
            }

            if (init?.body && !headers.has("Content-Type")) {
                headers.set("Content-Type", "application/json");
            }

            return fetch(`${API_URL}${path}`, {
                ...init,
                headers,
            });
        },
        [],
    );

    const loadChatSessions = useCallback(async () => {
        setHistoryLoading(true);
        setHistoryError("");

        try {
            const response = await authenticatedFetch(
                "/api/v1/chat/history/sessions",
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as ChatSessionsResponse;
            setChatSessions(data.sessions ?? []);
        } catch {
            setHistoryError(
                locale === "en"
                    ? "Unable to load chat history. Please check the backend connection."
                    : "Không thể tải lịch sử trò chuyện. Vui lòng kiểm tra kết nối backend.",
            );
        } finally {
            setHistoryLoading(false);
        }
    }, [authenticatedFetch, locale]);

    const persistStandaloneMessage = async (
        messageId: string,
        role: "USER" | "ASSISTANT",
        content: string,
        titleHint: string,
    ) => {
        const normalizedContent = content.trim();
        if (!normalizedContent || !sessionIdRef.current) {
            return;
        }

        const sessionId = sessionIdRef.current;
        const createResponse = await authenticatedFetch(
            "/api/v1/chat/history/sessions",
            {
                method: "POST",
                body: JSON.stringify({
                    id: sessionId,
                    title: titleHint.slice(0, 255),
                }),
            },
        );

        if (!createResponse.ok && createResponse.status !== 409) {
            throw new Error(`HTTP ${createResponse.status}`);
        }

        const messageResponse = await authenticatedFetch(
            `/api/v1/chat/history/sessions/${sessionId}/messages`,
            {
                method: "POST",
                body: JSON.stringify({
                    clientMessageId: messageId,
                    role,
                    content: normalizedContent,
                }),
            },
        );

        if (!messageResponse.ok) {
            throw new Error(`HTTP ${messageResponse.status}`);
        }
    };

    const openChatSession = async (sessionId: string) => {
        if (sessionId === sessionIdRef.current || switchingSessionId) {
            setHistoryOpen(false);
            return;
        }

        /*
         * IMPORTANT:
         * Do NOT call stopGeneration() here.
         * The current stream belongs to its original session and is allowed
         * to finish in the background while the user browses another chat.
         */
        setSwitchingSessionId(sessionId);
        setHistoryError("");
        olderLoadInFlightRef.current = false;
        setOlderMessagesLoading(false);

        try {
            /*
             * Important: fetch ONLY the newest page.
             * Backend contract:
             * GET /api/v1/chat/history/sessions/{sessionId}/messages?limit=10
             * -> { messages, nextCursor, hasMore }
             */
            const response = await authenticatedFetch(
                `/api/v1/chat/history/sessions/${sessionId}/messages?limit=${CHAT_HISTORY_PAGE_SIZE}`,
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as ChatMessagesPageResponse;
            const runtime = getChatRuntime();
            const streamBelongsToTarget =
                runtime.__internovaChatStreamActive === true
                &&
                runtime.__internovaChatStreamSessionId === sessionId;

            const liveDraft =
                streamBelongsToTarget
                    ? readChatSessionDraft(sessionId)
                    : null;

            const restoredMessages =
                liveDraft && liveDraft.length > 0
                    ? mergeChatMessages(
                        data.messages ?? [],
                        liveDraft,
                    )
                    : (data.messages ?? []);

            const nextCursor = data.nextCursor ?? null;
            const hasMore =
                Boolean(data.hasMore) &&
                Boolean(nextCursor);

            sessionIdRef.current = sessionId;
            sessionStorage.setItem(getChatSessionStorageKey(), sessionId);

            persistMessages(restoredMessages);
            setMessages(restoredMessages);

            // Keep the composer locked while any background stream is active.
            // This prevents a second concurrent stream from reusing the same refs.
            setLoading(
                runtime.__internovaChatStreamActive === true,
            );
            setVisibleMessageCount(
                Math.max(
                    restoredMessages.length,
                    INITIAL_VISIBLE_MESSAGES,
                ),
            );
            persistHistoryPagination(
                nextCursor,
                hasMore,
            );

            setActiveFormAgentSessionId(null);
            setActiveFormAgentStatus(null);
            setShowJumpToLatest(false);
            isNearBottomRef.current = true;
            setHistoryOpen(false);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    scrollToBottom("auto");
                });
            });
        } catch (error) {
            console.error("Không thể mở cuộc trò chuyện:", error);
            setHistoryError(
                locale === "en"
                    ? "Unable to open this conversation."
                    : "Không thể mở cuộc trò chuyện này.",
            );
        } finally {
            setSwitchingSessionId(null);
        }
    };

    const saveSessionTitle = async (sessionId: string) => {
        const title = renameTitle.trim();
        if (!title) {
            return;
        }

        try {
            const response = await authenticatedFetch(
                `/api/v1/chat/history/sessions/${sessionId}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ title }),
                },
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const updated = await response.json() as ChatHistorySession;
            setChatSessions(current =>
                current.map(item => item.id === updated.id ? updated : item),
            );
            setRenamingSessionId(null);
            setRenameTitle("");
        } catch (error) {
            console.error("Không thể đổi tên cuộc trò chuyện:", error);
            setHistoryError(
                locale === "en"
                    ? "Unable to rename this conversation."
                    : "Không thể đổi tên cuộc trò chuyện.",
            );
        }
    };

    const removeChatSession = async (sessionId: string) => {
        const confirmed = window.confirm(
            locale === "en"
                ? "Delete this conversation permanently?"
                : "Xóa vĩnh viễn cuộc trò chuyện này?",
        );
        if (!confirmed) {
            return;
        }

        setDeletingSessionId(sessionId);
        setHistoryError("");

        try {
            const response = await authenticatedFetch(
                `/api/v1/chat/history/sessions/${sessionId}`,
                { method: "DELETE" },
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            setChatSessions(current =>
                current.filter(item => item.id !== sessionId),
            );

            if (sessionIdRef.current === sessionId) {
                startNewChat();
            }
        } catch (error) {
            console.error("Không thể xóa cuộc trò chuyện:", error);
            setHistoryError(
                locale === "en"
                    ? "Unable to delete this conversation."
                    : "Không thể xóa cuộc trò chuyện.",
            );
        } finally {
            setDeletingSessionId(null);
        }
    };

    /* ============================================================
       LOAD CHAT FROM SESSION STORAGE
    ============================================================ */

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const token = getToken();
        if (!token) {
            window.location.replace("/auth/login");
            return;
        }

        // These legacy keys were shared by every account in the same tab.
        // Never restore them because their owner cannot be established safely.
        sessionStorage.removeItem(CHAT_MESSAGES_KEY_PREFIX);
        sessionStorage.removeItem(CHAT_SESSION_KEY_PREFIX);

        try {
            const storedMessages =
                sessionStorage.getItem(
                    getChatMessagesStorageKey()
                );

            if (storedMessages) {
                const parsed =
                    JSON.parse(
                        storedMessages
                    ) as Message[];

                if (
                    Array.isArray(
                        parsed
                    )
                    &&
                    parsed.length > 0
                ) {
                    const streamStillRunning =
                        getChatRuntime()
                            .__internovaChatStreamActive
                        === true;

                    const cleaned =
                        (
                            streamStillRunning
                                ? parsed
                                : parsed.map(
                                    msg => {
                                        if (
                                            msg.status === "streaming"
                                            ||
                                            msg.streamPhase === "thinking"
                                            ||
                                            msg.streamPhase === "answering"
                                            ||
                                            msg.streamPhase === "streaming"
                                        ) {
                                            return {
                                                ...msg,
                                                status: undefined,
                                                streamPhase: undefined,
                                                content:
                                                    msg.content
                                                    ||
                                                    "Cuộc trò chuyện bị gián đoạn.",
                                            };
                                        }

                                        return msg;
                                    }
                                )
                        ).filter(
                            msg =>
                                msg.role !== "assistant"
                                ||
                                Boolean(msg.content)
                                ||
                                streamStillRunning
                        );

                    messagesRef.current =
                        cleaned;

                    setMessages(
                        cleaned
                    );

                    setLoading(
                        streamStillRunning
                    );

                    setVisibleMessageCount(
                        INITIAL_VISIBLE_MESSAGES
                    );
                }
            }


        } catch (error) {

            console.error(
                "Không thể đọc lịch sử chat:",
                error
            );


            sessionStorage.removeItem(
                getChatMessagesStorageKey()
            );
        }


        let sessionId =
            sessionStorage.getItem(
                getChatSessionStorageKey()
            );


        if (!sessionId) {

            sessionId =
                crypto.randomUUID();


            sessionStorage.setItem(
                getChatSessionStorageKey(),
                sessionId
            );
        }


        sessionIdRef.current =
            sessionId;

        const storedHistoryCursor =
            sessionStorage.getItem(
                CHAT_HISTORY_CURSOR_KEY
            );

        const storedHistoryHasMore =
            sessionStorage.getItem(
                CHAT_HISTORY_HAS_MORE_KEY
            ) === "1";

        setOlderCursor(
            storedHistoryCursor
        );

        setHasOlderMessages(
            storedHistoryHasMore &&
            Boolean(storedHistoryCursor)
        );


        setStorageLoaded(
            true
        );

    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (storageLoaded) {
            void loadChatSessions();
        }
    }, [loadChatSessions, storageLoaded]);

    useEffect(() => {
        const syncFromStorage = () => {
            const stored =
                sessionStorage.getItem(
                    getChatMessagesStorageKey()
                );

            if (!stored) {
                return;
            }

            try {
                const parsed =
                    JSON.parse(stored) as Message[];

                if (
                    !Array.isArray(parsed)
                    ||
                    parsed.length === 0
                ) {
                    return;
                }

                messagesRef.current = parsed;
                setMessages(parsed);

                setLoading(
                    getChatRuntime()
                        .__internovaChatStreamActive
                    === true
                );
            } catch (error) {
                console.error(
                    "Không thể đồng bộ chat:",
                    error
                );
            }
        };

        window.addEventListener(
            CHAT_UPDATED_EVENT,
            syncFromStorage
        );

        return () => {
            window.removeEventListener(
                CHAT_UPDATED_EVENT,
                syncFromStorage
            );
        };
    }, []);


    /* ============================================================
       SAVE CHAT TO SESSION STORAGE
    ============================================================ */

    useEffect(() => {

        messagesRef.current =
            messages;

        if (
            !storageLoaded
        ) {
            return;
        }


        try {

            sessionStorage.setItem(
                getChatMessagesStorageKey(),
                JSON.stringify(
                    messages
                )
            );


        } catch (error) {

            console.error(
                "Không thể lưu lịch sử chat:",
                error
            );
        }

    }, [
        messages,
        storageLoaded,
    ]);



    /* ============================================================
       MESSENGER-LIKE SCROLL / HISTORY WINDOW
    ============================================================ */

    const visibleMessages =
        messages.slice(
            Math.max(
                0,
                messages.length -
                visibleMessageCount
            )
        );

    /*
     * Only follow the newest message if the user is already near the
     * bottom. If they scroll upward to read history, do not yank them
     * back down on every streamed chunk.
     */
    const scrollToBottom = (
        behavior: ScrollBehavior = "smooth"
    ) => {
        if (messageListRef.current) {
            messageListRef.current.scrollTo({
                top: messageListRef.current.scrollHeight,
                behavior,
            });
        } else {
            bottomRef.current?.scrollIntoView({
                behavior,
                block: "end",
                inline: "nearest",
            });
        }
    };


    /*
     * Scroll to bottom on new message if already near the bottom.
     */
    useEffect(() => {

        if (
            !isNearBottomRef.current
        ) {
            return;
        }

        scrollToBottom(
            loading
                ? "auto"
                : "smooth"
        );

    }, [
        messages,
        loading,
    ]);


    /*
     * Keep the viewport stable after older messages are prepended.
     */
    useLayoutEffect(() => {

        const snapshot =
            preserveScrollRef.current;

        if (!snapshot) {
            return;
        }

        const {
            element,
            previousScrollHeight,
        } = snapshot;

        const delta =
            element.scrollHeight -
            previousScrollHeight;

        if (delta > 0) {
            element.scrollTop += delta;
        }

        preserveScrollRef.current =
            null;

    }, [
        visibleMessageCount,
        messages.length,
    ]);


    const loadOlderMessages = useCallback(async () => {
        if (
            !sessionIdRef.current
            ||
            !hasOlderMessages
            ||
            !olderCursor
            ||
            olderLoadInFlightRef.current
        ) {
            return;
        }

        const list =
            messageListRef.current;

        if (!list) {
            return;
        }

        olderLoadInFlightRef.current = true;
        setOlderMessagesLoading(true);
        setHistoryError("");

        preserveScrollRef.current = {
            element: list,
            previousScrollHeight: list.scrollHeight,
        };

        try {
            const params =
                new URLSearchParams({
                    limit:
                        String(CHAT_HISTORY_PAGE_SIZE),
                    before:
                        olderCursor,
                });

            const response =
                await authenticatedFetch(
                    `/api/v1/chat/history/sessions/${sessionIdRef.current}/messages?${params.toString()}`,
                );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data =
                (await response.json()) as ChatMessagesPageResponse;

            const olderMessages =
                data.messages ?? [];

            const existingIds =
                new Set(
                    messagesRef.current.map(
                        item => item.id
                    )
                );

            const uniqueOlderMessages =
                olderMessages.filter(
                    item =>
                        !existingIds.has(item.id)
                );

            if (uniqueOlderMessages.length > 0) {
                const nextMessages = [
                    ...uniqueOlderMessages,
                    ...messagesRef.current,
                ];

                persistMessages(
                    nextMessages
                );

                setMessages(
                    nextMessages
                );

                setVisibleMessageCount(
                    current =>
                        current +
                        uniqueOlderMessages.length
                );
            } else {
                /*
                 * Nothing was prepended, therefore there is no DOM-height
                 * delta to compensate for.
                 */
                preserveScrollRef.current =
                    null;
            }

            const nextCursor =
                data.nextCursor ?? null;

            const hasMore =
                Boolean(data.hasMore) &&
                Boolean(nextCursor);

            persistHistoryPagination(
                nextCursor,
                hasMore,
            );
        } catch (error) {
            preserveScrollRef.current =
                null;

            console.error(
                "Không thể tải thêm tin nhắn cũ:",
                error
            );

            setHistoryError(
                locale === "en"
                    ? "Unable to load older messages."
                    : "Không thể tải thêm tin nhắn cũ.",
            );
        } finally {
            olderLoadInFlightRef.current =
                false;
            setOlderMessagesLoading(false);
        }
    }, [
        authenticatedFetch,
        hasOlderMessages,
        olderCursor,
        locale,
    ]);


    /*
     * When the top sentinel enters the viewport, fetch ONE older page
     * from the server. This is real network/database pagination, not
     * merely revealing messages that were already downloaded.
     */
    useEffect(() => {
        const sentinel =
            topSentinelRef.current;

        const list =
            messageListRef.current;

        if (
            !sentinel
            ||
            !list
            ||
            !hasOlderMessages
            ||
            olderMessagesLoading
        ) {
            return;
        }

        const observer =
            new IntersectionObserver(
                entries => {
                    const first =
                        entries[0];

                    if (
                        !first?.isIntersecting
                    ) {
                        return;
                    }

                    void loadOlderMessages();
                },
                {
                    root:
                        list,
                    rootMargin:
                        "220px 0px 0px 0px",
                    threshold:
                        0.01,
                }
            );

        observer.observe(
            sentinel
        );

        return () => {
            observer.disconnect();
        };
    }, [
        hasOlderMessages,
        olderMessagesLoading,
        loadOlderMessages,
    ]);


    function handleChatScroll(
        event:
            React.UIEvent<HTMLElement>,
    ) {
        const target =
            event.currentTarget;

        const distanceFromBottom =
            target.scrollHeight -
            target.scrollTop -
            target.clientHeight;

        const nearBottom =
            distanceFromBottom <=
            NEAR_BOTTOM_THRESHOLD_PX;

        isNearBottomRef.current =
            nearBottom;

        setShowJumpToLatest(
            !nearBottom
        );
    }


    function jumpToLatest() {
        isNearBottomRef.current = true;
        setShowJumpToLatest(false);

        scrollToBottom("smooth");
    }


    function jumpToUserPrompt(
        messageId: string,
    ) {
        const scrollToTarget = () => {
            const target =
                userMessageRefs.current[messageId];

            if (target && messageListRef.current) {
                const listRect =
                    messageListRef.current.getBoundingClientRect();
                const targetRect =
                    target.getBoundingClientRect();
                const offset =
                    targetRect.top -
                    listRect.top +
                    messageListRef.current.scrollTop -
                    (listRect.height / 2) +
                    (targetRect.height / 2);

                messageListRef.current.scrollTo({
                    top: Math.max(0, offset),
                    behavior: "smooth",
                });
            } else {
                target?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
            }
        };

        if (!userMessageRefs.current[messageId]) {
            setVisibleMessageCount(
                messages.length
            );

            requestAnimationFrame(() => {
                requestAnimationFrame(
                    scrollToTarget
                );
            });
        } else {
            scrollToTarget();
        }

        setPromptNavOpen(false);
    }


    const userPrompts =
        messages.filter(
            message =>
                message.role === "user"
        );

    // A history session can legitimately contain exactly one USER message
    // (for example while the answer is still running). Do not treat every
    // one-message session as the welcome screen.
    const isWelcomeState =
        messages.length === 1
        &&
        messages[0]?.id === "welcome"
        &&
        messages[0]?.role === "assistant";



    /* ============================================================
       NEW CHAT
    ============================================================ */

    function startNewChat() {

        const runtime =
            getChatRuntime();

        /*
         * Starting/browsing another chat must not cancel a response that is
         * already streaming in a different session.
         */
        const hasBackgroundStream =
            runtime.__internovaChatStreamActive === true;

        const newSessionId =
            crypto.randomUUID();


        sessionIdRef.current =
            newSessionId;


        sessionStorage.setItem(
            getChatSessionStorageKey(),
            newSessionId
        );


        const initialMessages = [
            welcomeMessage,
        ];

        persistMessages(
            initialMessages
        );

        setMessages(
            initialMessages
        );

        setVisibleMessageCount(
            INITIAL_VISIBLE_MESSAGES
        );

        olderLoadInFlightRef.current =
            false;

        setOlderMessagesLoading(
            false
        );

        persistHistoryPagination(
            null,
            false,
        );

        isNearBottomRef.current =
            true;


        setInput("");


        setLoading(
            hasBackgroundStream
        );

        if (!hasBackgroundStream) {
            if (
                streamFrameRef.current !==
                null
            ) {
                cancelAnimationFrame(
                    streamFrameRef.current
                );

                streamFrameRef.current = null;
            }

            streamBufferRef.current = "";
        }
        setShowJumpToLatest(false);

        setActiveFormAgentSessionId(null);
        setActiveFormAgentStatus(null);
        setHistoryOpen(false);
        setRenamingSessionId(null);
        setRenameTitle("");
    }


    /* ============================================================
       STOP GENERATION
    ============================================================ */
    function stopGeneration() {
        const runtime =
            getChatRuntime();

        (
            runtime.__internovaChatAbortController
            ??
            abortControllerRef.current
        )?.abort();

        abortControllerRef.current = null;
        runtime.__internovaChatAbortController = null;
        runtime.__internovaChatStreamActive = false;
        runtime.__internovaChatStreamSessionId = null;

        setLoading(false);
        if (streamFrameRef.current !== null) {
            cancelAnimationFrame(streamFrameRef.current);
            streamFrameRef.current = null;
        }
    }


    /* ============================================================
       SEND MESSAGE
    ============================================================ */

    async function sendMessage(
        predefinedMessage?: string,
    ) {

        const message =
            (
                predefinedMessage
                ??
                input
            ).trim();


        if (
            !message
            ||
            loading
        ) {
            return;
        }

        // ── FORM AGENT 1: Nếu đang có phiên Form Agent đang chạy ───────
        if (
            activeFormAgentSessionId &&
            isActiveFormAgentTurn(activeFormAgentStatus)
        ) {
            const userMessage: Message = {
                id: crypto.randomUUID(),
                role: "user",
                content: message,
            };

            setMessages(current => [...current, userMessage]);
            setInput("");
            isNearBottomRef.current = true;
            setShowJumpToLatest(false);

            requestAnimationFrame(() => {
                scrollToBottom("smooth");
            });

            // Kiểm tra câu từ chối / hủy phiên thực sự
            const cancelPhrases = [
                "huy", "huy phien", "huy don", "huy dien don", "dung", "dung lai", "cancel",
                "dung lai", "dung phien", "dung dien don", "khong dien nua",
                "khong muon dien nua", "thoi khong lam nua", "thoi khong dien nua"
            ];
            const normalized = message
                .toLowerCase()
                .replace(/đ/g, "d")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
            const tokens = normalized.split(/\s+/).filter(Boolean);
            const isExplicitCancel = cancelPhrases.some(p => {
                if (p.includes(" ")) return normalized.includes(p);
                return tokens.includes(p);
            });
            if (isExplicitCancel) {
                void handleFormAgentCancelSession(activeFormAgentSessionId, activeFormAgentSessionId);
                return;
            }

            void continueFormAgentTurn(message, userMessage.id);
            return;
        }

        // ── FORM AGENT 2: Chỉ mở agent khi người dùng chủ động muốn điền form ──

        // Start Form Agent only for a clear fill/create-form request; unclear form choice is handled inside the agent.
        if (!activeFormAgentSessionId && isExplicitFormFillRequest(message)) {
            const userMessage: Message = {
                id: crypto.randomUUID(),
                role: "user",
                content: message,
            };

            setMessages(current => [...current, userMessage]);
            setInput("");
            isNearBottomRef.current = true;
            setShowJumpToLatest(false);
            requestAnimationFrame(() => scrollToBottom("smooth"));

            void startFormAgent(undefined, message, userMessage);
            return;
        }
        // ── HẾT PHẦN FORM AGENT ──────────────────────────────────────


        if (
            !sessionIdRef.current
        ) {

            const newSessionId =
                crypto.randomUUID();


            sessionIdRef.current =
                newSessionId;


            sessionStorage.setItem(
                getChatSessionStorageKey(),
                newSessionId
            );
        }


        // Capture the owner session once. Never read sessionIdRef.current
        // later inside the stream because the user may browse another chat.
        const requestSessionId =
            sessionIdRef.current;

        const userMessage:
            Message = {

            id:
                crypto.randomUUID(),

            role:
                "user",

            content:
                message,
        };


        const assistantMessageId =
            crypto.randomUUID();


        const assistantMessage:
            Message = {

            id:
                assistantMessageId,

            role:
                "assistant",

            content:
                "",

            status:
                "streaming",

            streamPhase:
                "thinking",

            sources: [],

            startedAtMs: Date.now(),

            processingSteps: [
                {
                    id: "request",
                    status: "running",
                    engine: "Internova Chat API",
                    detail: "preparing_request",
                    metrics: {},
                },
            ],
        };


        isNearBottomRef.current =
            true;
        setShowJumpToLatest(false);

        const nextMessages = [
            ...messagesRef.current,
            userMessage,
            assistantMessage,
        ];

        // This snapshot belongs permanently to requestSessionId even if the
        // visible chat changes while the stream is still running.
        let streamMessages =
            nextMessages;

        persistMessages(
            nextMessages
        );

        setMessages(
            nextMessages
        );

        setInput("");

        setLoading(
            true
        );

        requestAnimationFrame(() => {
            scrollToBottom("smooth");
        });



        const updateAssistantMessage = (
            updater: (
                current: Message,
            ) => Message,
        ) => {
            streamMessages =
                streamMessages.map(
                    item => {
                        if (
                            item.id !==
                            assistantMessageId
                        ) {
                            return item;
                        }

                        return updater(item);
                    }
                );

            // Always persist the stream into its OWN session snapshot.
            // Therefore switching history never loses the in-flight answer.
            sessionStorage.setItem(
                getChatSessionDraftStorageKey(requestSessionId),
                JSON.stringify(streamMessages),
            );

            // Only paint into React state when the user is currently looking
            // at the session that owns this stream. Otherwise keep streaming
            // silently in the background.
            if (sessionIdRef.current !== requestSessionId) {
                return;
            }

            messagesRef.current =
                streamMessages;

            sessionStorage.setItem(
                getChatMessagesStorageKey(),
                JSON.stringify(streamMessages),
            );

            window.dispatchEvent(
                new Event(CHAT_UPDATED_EVENT),
            );

            setMessages(
                streamMessages
            );
        };

        // ── FORM AGENT: kiểm tra độc lập, tách biệt hoàn toàn khỏi
        // luồng chat/auth chính — lỗi ở đây không bao giờ ảnh hưởng
        // tới việc gửi/nhận tin nhắn bình thường.
        const checkFormRelevance = async (_contextText: string) => { void _contextText; };
        // ── HẾT PHẦN FORM AGENT ────────────────────────────────────────

        const flushStreamBuffer = () => {
            const chunk =
                streamBufferRef.current;

            streamBufferRef.current = "";
            streamFrameRef.current = null;

            if (!chunk) {
                return;
            }

            updateAssistantMessage(
                current => ({
                    ...current,
                    content:
                        current.content +
                        chunk,
                    // Token thật đã tới trình duyệt: từ đây UI là streaming,
                    // không còn hiển thị trạng thái "đang tạo câu trả lời".
                    streamPhase:
                        "streaming",
                })
            );
        };


        const queueStreamToken = (
            token: string,
        ) => {
            if (!token) {
                return;
            }

            streamBufferRef.current += token;

            if (streamFrameRef.current !== null) {
                return;
            }

            streamFrameRef.current =
                requestAnimationFrame(
                    flushStreamBuffer
                );
        };


        try {
            const token = getToken();
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const requestController =
                new AbortController();

            abortControllerRef.current =
                requestController;

            const runtime =
                getChatRuntime();

            runtime.__internovaChatAbortController =
                requestController;

            runtime.__internovaChatStreamActive =
                true;

            runtime.__internovaChatStreamSessionId =
                requestSessionId;

            const response =
                await fetch(
                    `${API_URL}/api/v1/chat/stream`,
                    {
                        method: "POST",
                        headers,
                        signal: requestController.signal,
                        body: JSON.stringify({
                            message,
                            session_id: requestSessionId,
                            client_message_id: userMessage.id,
                            assistant_message_id: assistantMessageId,
                        }),
                    }
                );


            if (response.status === 401) {
                if (typeof window !== "undefined") {
                    localStorage.removeItem("internova_access_token");
                    localStorage.removeItem("internova_user");
                    window.alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");
                    window.location.replace("/auth/login");
                }
                return;
            }

            if (!response.ok) {

                const errorData =
                    await response
                        .json()
                        .catch(
                            () => null
                        );


                throw new Error(
                    errorData?.detail
                    ??
                    `HTTP ${response.status}`
                );
            }


            if (!response.body) {
                throw new Error(
                    "Streaming không khả dụng trên trình duyệt này."
                );
            }


            const reader =
                response.body.getReader();

            const decoder =
                new TextDecoder();

            let buffer = "";

            let finalReceived =
                false;

            while (true) {
                const {
                    done,
                    value,
                } = await reader.read();

                buffer +=
                    decoder.decode(
                        value,
                        {
                            stream:
                                !done,
                        }
                    );

                const lines =
                    buffer.split("\n");

                buffer =
                    lines.pop() ?? "";

                for (const line of lines) {
                    const trimmedLine =
                        line.trim();

                    if (!trimmedLine) {
                        continue;
                    }

                    const event =
                        JSON.parse(
                            trimmedLine
                        ) as StreamEvent;

                    if (
                        event.type ===
                        "status"
                    ) {
                        const nextPhase =
                            event.phase
                            ??
                            "thinking";


                        updateAssistantMessage(
                            current => ({
                                ...current,
                                needsRetrieval:
                                    event.needs_retrieval
                                    ??
                                    current.needsRetrieval,
                                streamPhase:
                                    nextPhase,
                                processingSteps:
                                    event.step
                                        ? mergeProcessingSteps(
                                            current.processingSteps,
                                            [event.step],
                                        )
                                        : current.processingSteps,
                            })
                        );

                        continue;
                    }

                    if (
                        event.type ===
                        "token"
                    ) {
                        queueStreamToken(
                            event.token ?? ""
                        );

                        continue;
                    }

                    if (
                        event.type ===
                        "final"
                    ) {
                        if (
                            event.session_id
                            &&
                            sessionIdRef.current === requestSessionId
                        ) {
                            sessionIdRef.current = event.session_id;
                            sessionStorage.setItem(
                                getChatSessionStorageKey(),
                                event.session_id,
                            );
                        }

                        if (streamFrameRef.current !== null) {
                            cancelAnimationFrame(streamFrameRef.current);
                            streamFrameRef.current = null;
                        }

                        if (streamBufferRef.current) {
                            flushStreamBuffer();
                        }

                        finalReceived = true;

                        const needsRetrieval =
                            event.result
                                ?.needs_retrieval
                            === true;

                        const isFormAgentResponse =
                            event.form_agent != null
                            || event.route_intent === "form_agent"
                            || event.result?.route_intent === "form_agent";
                        const formAgentSessionId =
                            event.form_agent?.session_id
                            ?? event.session_id
                            ?? requestSessionId;
                        const formAgentStatus =
                            event.form_agent?.status
                            ?? (isFormAgentResponse ? "collecting_info" : null);

                        if (isFormAgentResponse && sessionIdRef.current === requestSessionId) {
                            if (formAgentStatus === "approved" || formAgentStatus === "cancelled") {
                                setActiveFormAgentSessionId(null);
                                setActiveFormAgentStatus(null);
                            } else {
                                setActiveFormAgentSessionId(formAgentSessionId);
                                setActiveFormAgentStatus(formAgentStatus);
                            }
                        }


                        updateAssistantMessage(
                            current => ({
                                ...current,
                                content:
                                    event.result
                                        ?.answer
                                    ??
                                    event.response
                                    ??
                                    current.content,
                                isFormAgentMessage:
                                    isFormAgentResponse
                                        ? true
                                        : current.isFormAgentMessage,
                                formAgentPhase:
                                    isFormAgentResponse
                                        ? "working"
                                        : current.formAgentPhase,
                                formAgentSessionId:
                                    isFormAgentResponse
                                        ? formAgentSessionId
                                        : current.formAgentSessionId,
                                formAgentStatus:
                                    isFormAgentResponse
                                        ? formAgentStatus
                                        : current.formAgentStatus,
                                formAgentDetectedName:
                                    isFormAgentResponse
                                        ? (event.form_agent?.detected_form ?? current.formAgentDetectedName)
                                        : current.formAgentDetectedName,
                                formAgentDocxReady:
                                    isFormAgentResponse
                                        ? Boolean(event.form_agent?.docx_ready)
                                        : current.formAgentDocxReady,
                                formAgentLoading:
                                    isFormAgentResponse
                                        ? false
                                        : current.formAgentLoading,
                                sources:
                                    needsRetrieval
                                        ? (
                                            event.result
                                                ?.sources
                                            ??
                                            []
                                        )
                                        : [],
                                confidence:
                                    needsRetrieval
                                        ? event.result
                                            ?.confidence
                                        : undefined,
                                needsRetrieval,
                                status:
                                    event.result
                                        ?.answer_status,
                                streamPhase:
                                    "done",
                                completedAtMs: Date.now(),
                                processing: event.processing,
                                processingSteps:
                                    mergeProcessingSteps(
                                        current.processingSteps,
                                        event.processing?.steps
                                        ?? [],
                                    ).map(step => ({
                                        ...step,
                                        status:
                                            step.status === "running"
                                                ? "completed"
                                                : step.status,
                                    })),
                            })
                        );

                        // ── FORM AGENT: kiểm tra độc lập ngay sau khi
                        // có câu trả lời cuối cùng ─────────────────────
                        void checkFormRelevance(
                            `${message}\n${event.result?.answer ??
                            event.response ??
                            ""
                            }`
                        );
                        // ── HẾT PHẦN FORM AGENT ────────────────────────

                        continue;
                    }

                    if (
                        event.type ===
                        "error"
                    ) {
                        throw new Error(
                            event.detail
                            ??
                            "Không thể stream câu trả lời."
                        );
                    }
                }

                if (done) {
                    break;
                }
            }

            if (
                !finalReceived
                &&
                buffer.trim()
            ) {
                const event =
                    JSON.parse(
                        buffer.trim()
                    ) as StreamEvent;

                if (
                    event.type ===
                    "final"
                ) {
                    if (
                        event.session_id
                        &&
                        sessionIdRef.current === requestSessionId
                    ) {
                        sessionIdRef.current = event.session_id;
                        sessionStorage.setItem(
                            getChatSessionStorageKey(),
                            event.session_id,
                        );
                    }

                    if (streamFrameRef.current !== null) {
                        cancelAnimationFrame(streamFrameRef.current);
                        streamFrameRef.current = null;
                    }

                    if (streamBufferRef.current) {
                        flushStreamBuffer();
                    }

                    const needsRetrieval =
                        event.result
                            ?.needs_retrieval
                        === true;

                    const isFormAgentResponse =
                        event.form_agent != null
                        || event.route_intent === "form_agent"
                        || event.result?.route_intent === "form_agent";
                    const formAgentSessionId =
                        event.form_agent?.session_id
                        ?? event.session_id
                        ?? requestSessionId;
                    const formAgentStatus =
                        event.form_agent?.status
                        ?? (isFormAgentResponse ? "collecting_info" : null);

                    if (isFormAgentResponse && sessionIdRef.current === requestSessionId) {
                        if (formAgentStatus === "approved" || formAgentStatus === "cancelled") {
                            setActiveFormAgentSessionId(null);
                            setActiveFormAgentStatus(null);
                        } else {
                            setActiveFormAgentSessionId(formAgentSessionId);
                            setActiveFormAgentStatus(formAgentStatus);
                        }
                    }


                    updateAssistantMessage(
                        current => ({
                            ...current,
                            content:
                                event.result
                                    ?.answer
                                ??
                                event.response
                                ??
                                current.content,
                            isFormAgentMessage:
                                isFormAgentResponse
                                    ? true
                                    : current.isFormAgentMessage,
                            formAgentPhase:
                                isFormAgentResponse
                                    ? "working"
                                    : current.formAgentPhase,
                            formAgentSessionId:
                                isFormAgentResponse
                                    ? formAgentSessionId
                                    : current.formAgentSessionId,
                            formAgentStatus:
                                isFormAgentResponse
                                    ? formAgentStatus
                                    : current.formAgentStatus,
                            formAgentDetectedName:
                                isFormAgentResponse
                                    ? (event.form_agent?.detected_form ?? current.formAgentDetectedName)
                                    : current.formAgentDetectedName,
                            formAgentDocxReady:
                                isFormAgentResponse
                                    ? Boolean(event.form_agent?.docx_ready)
                                    : current.formAgentDocxReady,
                            formAgentLoading:
                                isFormAgentResponse
                                    ? false
                                    : current.formAgentLoading,
                            sources:
                                needsRetrieval
                                    ? (
                                        event.result
                                            ?.sources
                                        ??
                                        []
                                    )
                                    : [],
                            confidence:
                                needsRetrieval
                                    ? event.result
                                        ?.confidence
                                    : undefined,
                            needsRetrieval,
                            status:
                                event.result
                                    ?.answer_status,
                            streamPhase:
                                "done",
                            completedAtMs: Date.now(),
                            processing: event.processing,
                            processingSteps:
                                mergeProcessingSteps(
                                    current.processingSteps,
                                    event.processing?.steps
                                    ?? [],
                                ).map(step => ({
                                    ...step,
                                    status:
                                        step.status === "running"
                                            ? "completed"
                                            : step.status,
                                })),
                        })
                    );

                    // ── FORM AGENT: kiểm tra độc lập (nhánh dự phòng) ──
                    void checkFormRelevance(
                        `${message}\n${event.result?.answer ??
                        event.response ??
                        ""
                        }`
                    );
                    // ── HẾT PHẦN FORM AGENT ─────────────────────────────
                }
            }


        } catch (error) {

            if ((error as Error).name === "AbortError") {
                updateAssistantMessage(
                    current => ({
                        ...current,
                        streamPhase: "done",
                        completedAtMs: Date.now(),
                        status: "done",
                        processingSteps: current.processingSteps?.map(step =>
                            step.status === "running"
                                ? {
                                    ...step,
                                    status: "error",
                                    detail: "response_interrupted",
                                }
                                : step,
                        ),
                    })
                );
                return;
            }

            console.error(
                "Chat request failed:",
                error
            );


            updateAssistantMessage(
                current => ({
                    ...current,
                    content:
                        "Xin lỗi, Internova AI hiện không thể xử lý câu hỏi. Vui lòng thử lại sau.",
                    status:
                        "insufficient_evidence",
                    streamPhase:
                        "error",
                    completedAtMs: Date.now(),
                    sources: [],
                    confidence:
                        undefined,
                    needsRetrieval:
                        false,
                    processingSteps: current.processingSteps?.map(step =>
                        step.status === "running"
                            ? {
                                ...step,
                                status: "error",
                                detail: "processing_failed",
                            }
                            : step,
                    ),
                })
            );


        } finally {

            if (streamFrameRef.current !== null) {
                cancelAnimationFrame(streamFrameRef.current);
                streamFrameRef.current = null;
            }

            streamBufferRef.current = "";

            const runtime =
                getChatRuntime();

            if (
                runtime.__internovaChatAbortController
                === abortControllerRef.current
            ) {
                runtime.__internovaChatAbortController =
                    null;
            }

            runtime.__internovaChatStreamActive =
                false;

            runtime.__internovaChatStreamSessionId =
                null;

            abortControllerRef.current = null;

            window.dispatchEvent(
                new Event(CHAT_UPDATED_EVENT)
            );

            setLoading(
                false
            );

            void loadChatSessions();

        }
    }



    /* ============================================================
       AUTO-RESIZE CHAT INPUT
    ============================================================ */

    useLayoutEffect(() => {
        const textarea = chatInputRef.current;

        if (!textarea) {
            return;
        }

        // Reset first so the textarea can shrink again when text is deleted
        // or after a message is sent.
        textarea.style.height = "auto";

        const nextHeight = Math.min(
            textarea.scrollHeight,
            CHAT_INPUT_MAX_HEIGHT_PX
        );

        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY =
            textarea.scrollHeight > CHAT_INPUT_MAX_HEIGHT_PX
                ? "auto"
                : "hidden";
    }, [input]);



    /* ============================================================
       ENTER TO SEND
    ============================================================ */

    function handleKeyDown(
        event:
            React.KeyboardEvent<
                HTMLTextAreaElement
            >
    ) {

        if (
            event.key ===
            "Enter"
            &&
            !event.shiftKey
        ) {

            event.preventDefault();


            void sendMessage();
        }
    }



    /* ============================================================
       RENDER
    ============================================================ */

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
                    className={`${styles.chatPage} ${
                        isWelcomeState
                            ? styles.chatPageWelcome
                            : ""
                    }`}
                >

                    {/* =================================================
                        HEADER
                    ================================================= */}

                    <section
                        className={
                            styles.chatHeader
                        }
                    >

                        <div
                            className={
                                styles.chatHeaderContent
                            }
                        >
                            <div className={styles.assistantIdentity}>
                                <span className={styles.assistantIdentityLogo}>
                                    <Image
                                        src="/intern.png"
                                        alt="VinUniversity"
                                        width={36}
                                        height={36}
                                        priority
                                    />
                                </span>

                                <span className={styles.assistantIdentityCopy}>
                                    <strong>Internova AI</strong>
                                    <small>
                                        {locale === "en"
                                            ? "VinUni Internship Assistant"
                                            : "Trợ lý thực tập VinUni"}
                                    </small>
                                </span>
                            </div>

                            <div className={styles.chatHeaderPolicy}>
                                <p>
                                    {locale === "en" ? (
                                        <>
                                            AI assistant answers based on official university documents.
                                            <br />
                                            If no information is found, the AI will let you know.
                                        </>
                                    ) : (
                                        <>
                                            Trợ lý AI trả lời dựa trên tài liệu chính thức của nhà trường.
                                            <br />
                                            Nếu không tìm thấy thông tin, AI sẽ cho bạn biết.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>



                        <div
                            className={
                                styles.chatHeaderActions
                            }
                        >

                            <button
                                type="button"
                                className={styles.newChatButton}
                                onClick={() => setHistoryOpen(current => !current)}
                                aria-expanded={historyOpen}
                                aria-controls="chat-history-panel"
                            >
                                <History size={17} />
                                <span>
                                    {locale === "en" ? "History" : "Lịch sử"}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.newChatButton
                                }
                                onClick={
                                    startNewChat
                                }
                            >

                                <Plus
                                    size={17}
                                />

                                <span>
                                    {locale === "en" ? "New conversation" : "Cuộc trò chuyện mới"}
                                </span>

                            </button>


                        </div>

                    </section>


                    <button
                        type="button"
                        className={`${styles.historyBackdrop} ${historyOpen ? styles.historyBackdropVisible : ""}`}
                        onClick={() => setHistoryOpen(false)}
                        aria-label={locale === "en" ? "Close history" : "Đóng lịch sử"}
                        tabIndex={historyOpen ? 0 : -1}
                    />

                    <aside
                        id="chat-history-panel"
                        className={`${styles.historyPanel} ${historyOpen ? styles.historyPanelOpen : ""}`}
                        aria-hidden={!historyOpen}
                        inert={!historyOpen}
                    >
                        <div className={styles.historyPanelHeader}>
                            <div>
                                <strong>
                                    {locale === "en" ? "Chat history" : "Lịch sử trò chuyện"}
                                </strong>
                                <span>
                                    {locale === "en"
                                        ? `${chatSessions.length} conversations`
                                        : `${chatSessions.length} cuộc trò chuyện`}
                                </span>
                            </div>

                            <button
                                type="button"
                                className={styles.historyCloseButton}
                                onClick={() => setHistoryOpen(false)}
                                aria-label={locale === "en" ? "Close" : "Đóng"}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.historyList}>
                            {historyLoading && chatSessions.length === 0 && (
                                <div className={styles.historyState}>
                                    <LoaderCircle className={styles.spinningIcon} size={20} />
                                    <span>{locale === "en" ? "Loading history..." : "Đang tải lịch sử..."}</span>
                                </div>
                            )}

                            {historyError && (
                                <div className={styles.historyError} role="alert">
                                    <span>{historyError}</span>
                                    <button type="button" onClick={() => void loadChatSessions()}>
                                        {locale === "en" ? "Retry" : "Thử lại"}
                                    </button>
                                </div>
                            )}

                            {!historyLoading && !historyError && chatSessions.length === 0 && (
                                <div className={styles.historyState}>
                                    <History size={24} />
                                    <span>
                                        {locale === "en"
                                            ? "Your conversations will appear here."
                                            : "Các cuộc trò chuyện của bạn sẽ xuất hiện tại đây."}
                                    </span>
                                </div>
                            )}

                            {chatSessions.map(session => {
                                const isActive = session.id === sessionIdRef.current;
                                const isSwitching = switchingSessionId === session.id;
                                const isRenaming = renamingSessionId === session.id;
                                const isDeleting = deletingSessionId === session.id;

                                return (
                                    <article
                                        key={session.id}
                                        className={`${styles.historyItem} ${isActive ? styles.historyItemActive : ""}`}
                                    >
                                        {isRenaming ? (
                                            <form
                                                className={styles.historyRenameForm}
                                                onSubmit={event => {
                                                    event.preventDefault();
                                                    void saveSessionTitle(session.id);
                                                }}
                                            >
                                                <input
                                                    value={renameTitle}
                                                    onChange={event => setRenameTitle(event.target.value)}
                                                    maxLength={255}
                                                    autoFocus
                                                    aria-label={locale === "en" ? "Conversation title" : "Tên cuộc trò chuyện"}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!renameTitle.trim()}
                                                    aria-label={locale === "en" ? "Save title" : "Lưu tên"}
                                                >
                                                    <Check size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRenamingSessionId(null);
                                                        setRenameTitle("");
                                                    }}
                                                    aria-label={locale === "en" ? "Cancel rename" : "Hủy đổi tên"}
                                                >
                                                    <X size={15} />
                                                </button>
                                            </form>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className={styles.historyItemMain}
                                                    onClick={() => void openChatSession(session.id)}
                                                    disabled={Boolean(switchingSessionId || deletingSessionId)}
                                                >
                                                    <span className={styles.historyItemTitle}>
                                                        {isSwitching && <LoaderCircle className={styles.spinningIcon} size={14} />}
                                                        {session.title}
                                                    </span>
                                                    <span className={styles.historyItemPreview}>
                                                        {session.lastMessagePreview
                                                            || (locale === "en" ? "No messages yet" : "Chưa có tin nhắn")}
                                                    </span>
                                                    <span className={styles.historyItemMeta}>
                                                        <time dateTime={session.lastMessageAt}>
                                                            {formatChatTimestamp(session.lastMessageAt, locale)}
                                                        </time>
                                                        <span>
                                                            {session.messageCount} {locale === "en" ? "messages" : "tin nhắn"}
                                                        </span>
                                                    </span>
                                                </button>

                                                <div className={styles.historyItemActions}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRenamingSessionId(session.id);
                                                            setRenameTitle(session.title);
                                                        }}
                                                        aria-label={locale === "en" ? "Rename" : "Đổi tên"}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void removeChatSession(session.id)}
                                                        disabled={isDeleting}
                                                        aria-label={locale === "en" ? "Delete" : "Xóa"}
                                                    >
                                                        {isDeleting
                                                            ? <LoaderCircle className={styles.spinningIcon} size={14} />
                                                            : <Trash2 size={14} />}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </aside>



                    {/* =================================================
                        CHAT
                    ================================================= */}

                    <section
                        className={
                            styles.chatContainer
                        }
                    >

                        <div
                            ref={
                                messageListRef
                            }
                            className={
                                `${styles.messageList} notranslate`
                            }
                            translate="no"
                            onScroll={
                                handleChatScroll
                            }
                        >

                            <div
                                ref={
                                    topSentinelRef
                                }
                                aria-hidden="true"
                                style={{
                                    height: 1,
                                    width: "100%",
                                }}
                            />

                            {(hasOlderMessages ||
                                olderMessagesLoading) && (
                                    <div
                                        style={{
                                            textAlign:
                                                "center",
                                            fontSize:
                                                12,
                                            opacity:
                                                0.55,
                                            padding:
                                                "4px 0 8px",
                                            userSelect:
                                                "none",
                                        }}
                                    >
                                        {olderMessagesLoading
                                            ? (
                                                locale === "en"
                                                    ? "Loading older messages..."
                                                    : "Đang tải tin nhắn cũ..."
                                            )
                                            : (
                                                locale === "en"
                                                    ? "Scroll up to load older messages"
                                                    : "Cuộn lên để tải thêm tin nhắn cũ"
                                            )}
                                    </div>
                                )}

                            {visibleMessages.map(
                                message => (

                                    <div
                                        key={message.id}
                                        ref={element => {
                                            if (message.role === "user") {
                                                userMessageRefs.current[message.id] = element;
                                            }
                                        }}
                                        data-message-id={message.id}
                                    >
                                        <MessageBubble
                                            message={
                                                message.id === "welcome"
                                                    ? {
                                                        ...message,
                                                        content: t("chat.welcome"),
                                                    }
                                                    : message
                                            }
                                            locale={locale}
                                            onFormAgentApprove={handleFormAgentApprove}
                                            onFormAgentCancelSession={handleFormAgentCancelSession}
                                        />
                                    </div>

                                )
                            )}

                            {/* =================================================
                                SUGGESTIONS
                            ================================================= */}

                            {isWelcomeState && (

                                    <div
                                        className={
                                            `${styles.suggestionList} notranslate`
                                        }
                                        translate="no"
                                    >

                                        {suggestions.map(
                                            (suggestion, index) => {
                                                const SuggestionIcon =
                                                    suggestionIcons[index] ?? CircleHelp;

                                                return (
                                                    <button
                                                        key={
                                                            suggestion
                                                        }
                                                        type="button"
                                                        disabled={
                                                            loading
                                                        }
                                                        onClick={
                                                            () =>
                                                                void sendMessage(
                                                                    suggestion
                                                                )
                                                        }
                                                    >
                                                        <span
                                                            className={styles.suggestionIcon}
                                                            aria-hidden="true"
                                                        >
                                                            <SuggestionIcon size={19} strokeWidth={1.9} />
                                                        </span>

                                                        <span className={styles.suggestionText}>
                                                            {suggestion}
                                                        </span>

                                                        <ArrowRight
                                                            className={styles.suggestionArrow}
                                                            size={17}
                                                            strokeWidth={1.8}
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                );
                                            }
                                        )}

                                    </div>

                                )}

                            <div
                                ref={
                                    bottomRef
                                }
                            />

                        </div>

                        {/* =================================================
                            FLOATING NAVIGATION
                        ================================================= */}

                        {userPrompts.length > 0 && (
                            <div
                                className={styles.promptNavigator}
                                onMouseEnter={() => {
                                    if (promptNavCloseTimerRef.current !== null) {
                                        clearTimeout(promptNavCloseTimerRef.current);
                                        promptNavCloseTimerRef.current = null;
                                    }
                                    setPromptNavOpen(true);
                                }}
                                onMouseLeave={() => {
                                    promptNavCloseTimerRef.current =
                                        setTimeout(
                                            () => setPromptNavOpen(false),
                                            140
                                        );
                                }}
                            >
                                <button
                                    type="button"
                                    className={styles.promptNavigatorButton}
                                    onClick={() =>
                                        setPromptNavOpen(current => !current)
                                    }
                                    aria-label={locale === "en" ? "View sent questions" : "Xem các câu hỏi đã gửi"}
                                    title={locale === "en" ? "Sent questions" : "Các câu hỏi đã gửi"}
                                >
                                    <ListTree size={18} />
                                </button>

                                {promptNavOpen && (
                                    <div className={styles.promptNavigatorPanel}>
                                        <div className={styles.promptNavigatorTitle}>
                                            {locale === "en" ? "Your questions" : "Câu hỏi của bạn"}
                                        </div>

                                        <div className={styles.promptNavigatorList}>
                                            {userPrompts
                                                .slice()
                                                .reverse()
                                                .map((prompt, index) => (
                                                    <button
                                                        key={prompt.id}
                                                        type="button"
                                                        className={styles.promptNavigatorItem}
                                                        onClick={() =>
                                                            jumpToUserPrompt(prompt.id)
                                                        }
                                                    >
                                                        <span className={styles.promptNavigatorIndex}>
                                                            {userPrompts.length - index}
                                                        </span>
                                                        <span className={styles.promptNavigatorText}>
                                                            {prompt.content}
                                                        </span>
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* =================================================
                            FIXED FOOTER: FLOATING INPUT BAR
                        ================================================= */}

                        <div
                            className={
                                styles.chatFooter
                            }
                        >
                            <div
                                className={
                                    styles.chatComposerWrapper
                                }
                            >
                                {showJumpToLatest && (
                                    <button
                                        type="button"
                                        className={styles.jumpToLatestButton}
                                        onClick={jumpToLatest}
                                        aria-label={locale === "en" ? "Go to latest message" : "Đi tới tin nhắn mới nhất"}
                                        title={locale === "en" ? "Go to latest message" : "Đi tới tin nhắn mới nhất"}
                                    >
                                        <ArrowDown size={18} />
                                    </button>
                                )}

                                <div
                                    className={
                                    `${styles.chatComposer} notranslate`
                                    }
                                translate="no"
                                >

                                    <textarea
                                        ref={
                                            bindChatInputRef
                                        }
                                        rows={1}
                                        value={
                                            input
                                        }
                                        style={{
                                            maxHeight: `${CHAT_INPUT_MAX_HEIGHT_PX}px`,
                                            overflowY: "hidden",
                                            resize: "none",
                                        }}
                                        onChange={
                                            event =>
                                                setInput(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                        onKeyDown={
                                            handleKeyDown
                                        }
                                        placeholder={
                                            activeFormAgentSessionId &&
                                            isActiveFormAgentTurn(activeFormAgentStatus)
                                                ? (locale === "en"
                                                    ? "Enter information for the form (or type 'cancel' to stop)..."
                                                    : "Nhập thông tin cho đơn (hoặc gõ 'hủy' để dừng)...")
                                                : (locale === "en"
                                                        ? "Ask about internship policies, procedures, forms..."
                                                        : "Nhập câu hỏi của bạn về học vụ, quy định, thủ tục thực tập...")
                                        }
                                    />

                                    {loading ? (
                                        <button
                                            type="button"
                                            className={styles.sendButton}
                                            onClick={stopGeneration}
                                            aria-label={locale === "en" ? "Stop" : "Dừng trả lời"}
                                            title={locale === "en" ? "Stop" : "Dừng trả lời"}
                                        >
                                            <Square size={16} fill="currentColor" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className={styles.sendButton}
                                            onClick={() => void sendMessage()}
                                            disabled={!input.trim()}
                                            aria-label={locale === "en" ? "Send" : "Gửi"}
                                            title={locale === "en" ? "Send" : "Gửi"}
                                        >
                                            <Send size={16} />
                                        </button>
                                    )}

                                </div>

                                <p className={styles.inputDisclaimer}>
                                    <ShieldCheck size={14} aria-hidden="true" />
                                    <span>
                                        {locale === "en"
                                            ? "AI Internova can make mistakes. Please check important information."
                                            : "AI Internova có thể mắc lỗi. Vui lòng kiểm tra lại thông tin quan trọng."}
                                    </span>
                                </p>
                            </div>
                        </div>

                    </section>

                </main>

            </div>

        </div>
    );
}



/* ============================================================
   MESSAGE
============================================================ */

function formatProcessingDuration(milliseconds: number, locale: "vi" | "en") {
    const safeMs = Math.max(0, milliseconds);
    const totalSeconds = safeMs / 1000;

    if (totalSeconds < 10) {
        const value = totalSeconds.toFixed(1).replace(".0", "");
        return locale === "en" ? `${value}s` : `${value} giây`;
    }

    const roundedSeconds = Math.round(totalSeconds);

    if (roundedSeconds < 60) {
        return locale === "en" ? `${roundedSeconds}s` : `${roundedSeconds} giây`;
    }

    const minutes = Math.floor(roundedSeconds / 60);
    const seconds = roundedSeconds % 60;

    return locale === "en"
        ? `${minutes}m ${seconds}s`
        : `${minutes} phút ${seconds} giây`;
}

const MessageBubble = memo(function MessageBubble({
    message,
    locale = "vi",
    onFillRequest,
    onFormAgentApprove,
    onFormAgentCancelSession,
}: {
    message: Message;
    locale?: "vi" | "en";
    onFillRequest?: (formName?: string) => void;
    onFormAgentApprove?: (messageId: string, sessionId: string) => void;
    onFormAgentCancelSession?: (messageId: string, sessionId: string) => void;
}) {

    const isUser =
        message.role ===
        "user";


    const confidencePercent =
        typeof message.confidence
            === "number"
            ? Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        message.confidence * 100
                    )
                )
            )
            : null;


    const formSource =
        !isUser
            ? message.sources?.find(
                source =>
                    source.document_type === "form"
                    &&
                    (
                        source.file_name
                        ||
                        source.preview_url
                        ||
                        source.download_url
                    )
            )
            : undefined;


    const streamPhase =
        message.streamPhase
        ??
        "done";


    const showStreamingStatus =
        !isUser
        &&
        shouldAnimatePhase(
            streamPhase
        )
        &&
        message.content.trim().length === 0;


    const hasRenderableContent =
        message.content.trim().length > 0;

    const processingSteps =
        message.processingSteps
        ?? message.processing?.steps
        ?? [];

    const responseDurationMs =
        typeof message.processing?.latencyMs === "number"
            ? message.processing.latencyMs
            : (
                typeof message.startedAtMs === "number"
                && typeof message.completedAtMs === "number"
                    ? Math.max(0, message.completedAtMs - message.startedAtMs)
                    : null
            );


    return (

        <div
            className={`${isUser
                ? styles.userMessageRow
                : styles.aiMessageRow
            } ${message.id === "welcome" ? styles.welcomeMessageRow : ""}`}
        >

            {isUser ? (
                <div className={styles.userBubble}>
                    <p className={styles.userMessageText}>
                        {message.content}
                    </p>
                </div>
            ) : (
                <div className={styles.aiResponseColumn}>
                    {(processingSteps.length > 0 || showStreamingStatus) && (
                        <div
                            className={styles.processingStandalone}
                            aria-live="polite"
                        >
                            {processingSteps.length > 0 ? (
                                <ProcessingTrace
                                    steps={processingSteps}
                                    processing={message.processing}
                                    sourceCount={message.sources?.length ?? 0}
                                    locale={locale}
                                    active={shouldAnimatePhase(streamPhase)}
                                    phase={streamPhase}
                                    durationMs={responseDurationMs}
                                />
                            ) : (
                                <div className={styles.liveStatusLine}>
                                    <span className={styles.streamingLabel}>
                                        {getPhaseLabel(streamPhase, locale)}
                                    </span>
                                    <span className={styles.typingDots} aria-hidden="true">
                                        <span />
                                        <span />
                                        <span />
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {(
                        hasRenderableContent
                        || formSource
                        || message.isFormAgentMessage
                        || (message.sources && message.sources.length > 0)
                    ) && (
                        <div className={styles.aiBubble}>
                            {message.isFormAgentMessage ? (
                                <FormAgentPanel
                                    phase={message.formAgentPhase ?? "working"}
                                    detectedFormName={message.formAgentDetectedName}
                                    status={message.formAgentStatus}
                                    displayText={message.content}
                                    loading={message.formAgentLoading}
                                    error={message.formAgentErrorMsg}
                                    docxReady={message.formAgentDocxReady}
                                    sessionId={message.formAgentSessionId}
                                    locale={locale}
                                    onApprove={() =>
                                        message.formAgentSessionId &&
                                        onFormAgentApprove?.(message.id, message.formAgentSessionId)
                                    }
                                    onCancelSession={() =>
                                        message.formAgentSessionId &&
                                        onFormAgentCancelSession?.(message.id, message.formAgentSessionId)
                                    }
                                />
                            ) : hasRenderableContent ? (
                                <div
                                    className={`${styles.markdownContent} notranslate`}
                                    translate="no"
                                >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            table: ({ node, ...props }) => (
                                                <div className={styles.tableResponsive}>
                                                    <table {...props} />
                                                </div>
                                            ),
                                            pre: ({ node, ...props }) => (
                                                <div className={styles.codeResponsive}>
                                                    <pre {...props} />
                                                </div>
                                            ),
                                        }}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                </div>
                            ) : null}

                            {formSource && (
                                <FormResourceCard
                                    source={formSource}
                                    locale={locale}
                                    onFillRequest={onFillRequest}
                                />
                            )}

                            {!formSource && message.detectedForm && onFillRequest && (
                                <button
                                    type="button"
                                    onClick={() => onFillRequest?.(message.detectedForm ?? undefined)}
                                    className={styles.formFillButton}
                                >
                                    🤖 {locale === "en"
                                        ? `Need help filling ${message.detectedForm}?`
                                        : `Cần mình giúp điền ${message.detectedForm} luôn không?`}
                                </button>
                            )}

                            {message.needsRetrieval === true &&
                                confidencePercent !== null &&
                                confidencePercent > 0 && (
                                    <div className={styles.answerMeta}>
                                        <span>
                                            {locale === "en" ? "Confidence" : "Độ tin cậy"}
                                        </span>
                                        <div
                                            className={styles.confidenceTrack}
                                            aria-hidden="true"
                                        >
                                            <div
                                                className={styles.confidenceFill}
                                                style={{ width: `${confidencePercent}%` }}
                                            />
                                        </div>
                                        <strong>{confidencePercent}%</strong>
                                    </div>
                                )}

                            {message.sources && message.sources.length > 0 && (
                                <Sources
                                    sources={message.sources}
                                    locale={locale}
                                    onFillRequest={onFillRequest}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
});



/* ============================================================
   SAFE PROCESSING TRACE
============================================================ */

function getProcessingStepLabel(
    stepId: string,
    locale: "vi" | "en",
) {
    const labels: Record<string, { vi: string; en: string }> = {
        request: { vi: "Tiếp nhận yêu cầu", en: "Request received" },
        safety: { vi: "Kiểm tra an toàn", en: "Safety check" },
        cache: { vi: "Kiểm tra bộ nhớ đệm", en: "Cache lookup" },
        routing: { vi: "Phân loại câu hỏi", en: "Question routing" },
        query_planning: { vi: "Lập kế hoạch tìm kiếm", en: "Search planning" },
        retrieval: { vi: "Tìm trong kho dữ liệu", en: "Knowledge retrieval" },
        reranking: { vi: "Chọn đoạn liên quan", en: "Relevance ranking" },
        references: { vi: "Chuẩn bị tài liệu tham khảo", en: "Reference selection" },
        evidence: { vi: "Kiểm tra bằng chứng", en: "Evidence validation" },
        generation: { vi: "Streaming câu trả lời", en: "Answer streaming" },
        verification: { vi: "Đối chiếu câu trả lời", en: "Answer verification" },
        personal_data: { vi: "Kiểm tra dữ liệu sinh viên", en: "Student data check" },
        form_agent: { vi: "Xử lý biểu mẫu", en: "Form processing" },
    };

    return labels[stepId]?.[locale]
        ?? (locale === "en" ? "Processing" : "Đang xử lý");
}


function getProcessingDetail(
    step: ProcessingStep,
    locale: "vi" | "en",
) {
    const metrics = step.metrics ?? {};
    const details: Record<string, { vi: string; en: string }> = {
        preparing_request: {
            vi: "Đang chuẩn bị và xác thực yêu cầu",
            en: "Preparing and authenticating the request",
        },
        request_authenticated: {
            vi: "Yêu cầu đã được xác thực",
            en: "Request authenticated",
        },
        input_safe: {
            vi: "Nội dung đạt kiểm tra đầu vào",
            en: "Input passed safety validation",
        },
        cached_answer_found: {
            vi: "Đã tìm thấy câu trả lời đã kiểm chứng trong bộ nhớ đệm",
            en: "Found a previously validated answer in cache",
        },
        route_selected: {
            vi: `Phạm vi: ${String(metrics.scope ?? "đang xác định")}`,
            en: `Scope: ${String(metrics.scope ?? "detecting")}`,
        },
        planning_search: {
            vi: "Đang tạo truy vấn tìm kiếm phù hợp",
            en: "Preparing relevant search queries",
        },
        search_plan_ready: {
            vi: `Đã chuẩn bị ${Number(metrics.query_count ?? 0) || 1} truy vấn tìm kiếm`,
            en: `Prepared ${Number(metrics.query_count ?? 0) || 1} search queries`,
        },
        searching_knowledge_base: {
            vi: "Đang tìm bằng Vector Search và BM25",
            en: "Searching with Vector Search and BM25",
        },
        retrieval_cache_hit: {
            vi: "Đã tìm thấy kết quả từ bộ nhớ đệm",
            en: "Retrieved matching cached results",
        },
        knowledge_matches_found: {
            vi: `Tìm thấy ${Number(metrics.combined_hits ?? metrics.references ?? 0)} kết quả phù hợp`,
            en: `Found ${Number(metrics.combined_hits ?? metrics.references ?? 0)} relevant results`,
        },
        ranking_relevant_passages: {
            vi: "Đang đánh giá mức độ liên quan",
            en: "Evaluating passage relevance",
        },
        relevant_passages_selected: {
            vi: `Đã chọn ${Number(metrics.selected_passages ?? 0) || "các"} đoạn phù hợp nhất`,
            en: `Selected ${Number(metrics.selected_passages ?? 0) || "the most"} relevant passages`,
        },
        candidate_references_selected: {
            vi: `Đã chuẩn bị ${Number(metrics.references ?? 0)} tài liệu để đối chiếu`,
            en: `Prepared ${Number(metrics.references ?? 0)} references for validation`,
        },
        checking_source_support: {
            vi: "Đang kiểm tra tài liệu có đủ căn cứ trả lời",
            en: "Checking whether sources support an answer",
        },
        source_support_checked: {
            vi: `Đã xác minh ${Number(metrics.supported_passages ?? metrics.references ?? 0)} nguồn/đoạn hỗ trợ`,
            en: `Verified ${Number(metrics.supported_passages ?? metrics.references ?? 0)} supporting sources/passages`,
        },
        generating_direct_answer: {
            vi: "Đang streaming câu trả lời",
            en: "Streaming the answer",
        },
        generating_grounded_answer: {
            vi: "Đang streaming câu trả lời dựa trên tài liệu đã chọn",
            en: "Streaming the answer from selected evidence",
        },
        draft_answer_ready: {
            vi: "Đã hoàn tất nội dung trả lời",
            en: "Answer content completed",
        },
        verifying_answer_against_sources: {
            vi: "Đang đối chiếu từng nhận định với nguồn",
            en: "Cross-checking claims against sources",
        },
        answer_verification_complete: {
            vi: "Đã hoàn tất kiểm tra độ bám nguồn",
            en: "Groundedness validation completed",
        },
        checking_personal_data: {
            vi: "Đang truy vấn dữ liệu được phép của tài khoản",
            en: "Querying authorized account data",
        },
        personal_data_checked: {
            vi: "Đã kiểm tra dữ liệu cá nhân được phân quyền",
            en: "Authorized personal data checked",
        },
        processing_form_request: {
            vi: "Form Agent đang xử lý yêu cầu",
            en: "Form Agent is processing the request",
        },
        form_request_processed: {
            vi: "Form Agent đã xử lý xong yêu cầu",
            en: "Form Agent completed the request",
        },
        response_interrupted: {
            vi: "Quá trình đã được người dùng dừng lại",
            en: "Processing was stopped by the user",
        },
        processing_failed: {
            vi: "Bước xử lý chưa hoàn tất do có lỗi",
            en: "This step did not complete because of an error",
        },
    };

    return details[step.detail ?? ""]?.[locale]
        ?? step.detail
        ?? "";
}


function ProcessingStepIcon({ step }: { step: ProcessingStep }) {
    if (step.status === "running") {
        return <LoaderCircle className={styles.spinningIcon} size={15} />;
    }

    if (step.status === "completed") {
        return <CircleCheck size={15} />;
    }

    if (step.id === "safety") {
        return <ShieldCheck size={15} />;
    }

    if (step.id === "retrieval" || step.id === "query_planning") {
        return <Search size={15} />;
    }

    if (step.id === "personal_data") {
        return <Database size={15} />;
    }

    return <BrainCircuit size={15} />;
}


function ProcessingTrace({
    steps,
    processing,
    sourceCount,
    locale,
    active,
    phase,
    durationMs,
}: {
    steps: ProcessingStep[];
    processing?: ProcessingSummary;
    sourceCount: number;
    locale: "vi" | "en";
    active: boolean;
    phase: ChatPhase;
    durationMs?: number | null;
}) {
    if (steps.length === 0) {
        return null;
    }

    const liveReferences = Array.from(
        new Map(
            steps
                .flatMap(step => step.references ?? [])
                .map(source => [
                    `${source.document_name ?? source.file_name ?? "source"}-${source.page ?? ""}`,
                    source,
                ]),
        ).values(),
    );

    const statusLabel =
        phase === "done" && typeof durationMs === "number"
            ? (
                locale === "en"
                    ? `Answered in ${formatProcessingDuration(durationMs, locale)}`
                    : `Đã trả lời trong ${formatProcessingDuration(durationMs, locale)}`
            )
            : (
                getPhaseLabel(phase, locale)
                || (locale === "en" ? "Processing" : "Đang xử lý")
            );

    return (
        <details
            className={`${styles.processingTrace} ${active ? styles.processingTraceActive : ""}`}
        >
            <summary
                className={styles.processingTraceSummary}
                aria-label={locale === "en" ? "Toggle processing steps" : "Mở hoặc thu gọn các bước xử lý"}
            >
                <span className={styles.processingTraceSummaryText}>
                    {statusLabel}
                </span>

                {active && (
                    <span className={styles.typingDots} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </span>
                )}

                <ChevronDown
                    className={styles.processingTraceChevron}
                    size={13}
                    aria-hidden="true"
                />
            </summary>

            <div className={styles.processingTraceBody}>
                {(processing?.responseModel || processing?.embeddingModel) && (
                    <div className={styles.processingModels}>
                        {processing.responseModel && (
                            <span>
                                {locale === "en" ? "Response" : "Trả lời"}: {processing.responseModel}
                            </span>
                        )}
                        {processing.embeddingModel && (
                            <span>
                                Embedding: {processing.embeddingModel}
                            </span>
                        )}
                    </div>
                )}

                <ol className={styles.processingStepList}>
                    {steps.map(step => (
                        <li
                            key={step.id}
                            className={`${styles.processingStep} ${step.status === "running" ? styles.processingStepRunning : ""} ${step.status === "error" ? styles.processingStepError : ""}`}
                        >
                            <span className={styles.processingStepIcon}>
                                <ProcessingStepIcon step={step} />
                            </span>

                            <span className={styles.processingStepContent}>
                                <strong>{getProcessingStepLabel(step.id, locale)}</strong>
                                <small>{getProcessingDetail(step, locale)}</small>

                                {(step.engine || step.model) && (
                                    <span className={styles.processingStepTech}>
                                        {step.engine && <span>{step.engine}</span>}
                                        {step.model && <span>Model: {step.model}</span>}
                                    </span>
                                )}
                            </span>
                        </li>
                    ))}
                </ol>

                {liveReferences.length > 0 && (
                    <div className={styles.processingReferences}>
                        <strong>
                            {locale === "en" ? "References checked" : "Tài liệu đã đối chiếu"}
                        </strong>
                        {liveReferences.map((source, index) => (
                            <div key={`${source.chunk_id ?? source.document_name ?? index}`}>
                                <FileText size={11} />
                                <span>
                                    {source.document_name
                                        || source.file_name
                                        || (locale === "en" ? "Official document" : "Tài liệu chính thức")}
                                </span>
                                {source.page && (
                                    <small>{locale === "en" ? "Page" : "Trang"} {source.page}</small>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {!active && (
                    <div className={styles.processingTraceFooter}>
                        <span>
                            {sourceCount > 0
                                ? `${sourceCount} ${locale === "en" ? "references" : "nguồn tham khảo"}`
                                : (locale === "en" ? "No document retrieval" : "Không cần truy xuất tài liệu")}
                        </span>
                        {typeof processing?.latencyMs === "number" && (
                            <span>{(processing.latencyMs / 1000).toFixed(1)}s</span>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}


/* ============================================================
   SOURCES
============================================================ */

function Sources({
    sources,
    locale = "vi",
    onFillRequest,
}: {
    sources: Source[];
    locale?: "vi" | "en";
    onFillRequest?: (formName?: string) => void;
}) {

    const [
        open,
        setOpen,
    ] =
        useState(false);


    return (

        <div
            className={
                styles.sources
            }
        >

            <button
                type="button"
                className={
                    styles.sourceTitle
                }
                onClick={
                    () =>
                        setOpen(
                            current =>
                                !current
                        )
                }
                aria-expanded={
                    open
                }
            >

                <div
                    className={
                        styles
                            .sourceTitleLeft
                    }
                >

                    <FileText
                        size={15}
                    />

                    <span>
                        {
                            sources.length
                        }{" "}
                        {locale === "en" ? (sources.length === 1 ? "source" : "sources") : "nguồn tham khảo"}
                    </span>

                </div>


                <ChevronDown
                    size={16}
                    className={
                        open
                            ? styles
                                .chevronOpen
                            : ""
                    }
                />

            </button>



            {open && (

                <div
                    className={
                        styles.sourceList
                    }
                >

                    {sources.map(
                        (
                            source,
                            index
                        ) => (

                            <div
                                key={
                                    `${source.document_name}-${source.page}-${index}`
                                }
                                className={
                                    styles
                                        .sourceItem
                                }
                            >

                                <span
                                    className={
                                        styles
                                            .sourceNumber
                                    }
                                >
                                    {
                                        index +
                                        1
                                    }
                                </span>


                                <div
                                    className={
                                        styles
                                            .sourceInfo
                                    }
                                >

                                    <strong>
                                        {
                                            source
                                                .document_name
                                            ??
                                            "Tài liệu"
                                        }
                                    </strong>


                                    <div
                                        className={
                                            styles
                                                .sourceMeta
                                        }
                                    >

                                        {source
                                            .document_type && (

                                                <span>
                                                    {
                                                        source
                                                            .document_type
                                                    }
                                                </span>

                                            )}


                                        {source.page && (

                                            <span>
                                                Trang{" "}
                                                {
                                                    source.page
                                                }
                                            </span>

                                        )}


                                        {source.section && (

                                            <span>
                                                {
                                                    source
                                                        .section
                                                }
                                            </span>

                                        )}

                                    </div>


                                    {source
                                        .quote_original && (

                                            <p
                                                className={
                                                    `${styles.sourceQuote} notranslate`
                                                }
                                                translate="no"
                                            >
                                                “
                                                {
                                                    source
                                                        .quote_original
                                                }
                                                ”
                                            </p>

                                        )}


                                    {source.document_type ===
                                        "form" &&
                                        (
                                            source.file_name
                                            ||
                                            source.preview_url
                                            ||
                                            source.download_url
                                        ) && (

                                            <FormResourceCard
                                                source={
                                                    source
                                                }
                                                locale={locale}
                                                onFillRequest={onFillRequest}
                                            />

                                        )}

                                </div>

                            </div>

                        )
                    )}

                </div>

            )}

        </div>
    );
}


/* ============================================================
   FORM RESOURCE
============================================================ */

function FormResourceCard({
    source,
    locale = "vi",
    onFillRequest,
}: {
    source: Source;
    locale?: "vi" | "en";
    onFillRequest?: (formName?: string) => void;
}) {
    const [
        previewOpen,
        setPreviewOpen,
    ] = useState(false);

    const previewUrl =
        resolveApiUrl(
            source.preview_url
        );

    const downloadUrl =
        resolveApiUrl(
            source.download_url
        );

    return (
        <div
            className={
                styles.formResourceCard
            }
        >
            <div
                className={
                    styles.formResourceHeader
                }
            >
                <span
                    className={
                        styles.formResourceIcon
                    }
                >
                    <FileText
                        size={18}
                    />
                </span>

                <div
                    className={
                        styles.formResourceInfo
                    }
                >
                    <strong>
                        {source.document_name
                            ??
                            (locale === "en" ? "Internship Form" : "Biểu mẫu thực tập")}
                    </strong>

                    {source.file_name && (
                        <span>
                            {source.file_name}
                        </span>
                    )}
                </div>
            </div>


            <div
                className={
                    styles.formResourceActions
                }
            >
                {previewUrl && (
                    <button
                        type="button"
                        className={
                            styles.formPreviewButton
                        }
                        onClick={() =>
                            setPreviewOpen(
                                current =>
                                    !current
                            )
                        }
                    >
                        <Eye
                            size={15}
                        />

                        {previewOpen
                            ? (locale === "en" ? "Hide preview" : "Ẩn mẫu")
                            : (locale === "en" ? "Preview" : "Xem mẫu")}
                    </button>
                )}


                {downloadUrl && (
                    <a
                        href={
                            downloadUrl
                        }
                        className={
                            styles.formDownloadButton
                        }
                        download
                        target="_blank"
                        rel="noreferrer"
                    >
                        <Download
                            size={15}
                        />

                        {locale === "en" ? "Download" : "Tải mẫu"}
                    </a>
                )}
            </div>


            {previewOpen &&
                previewUrl && (

                    <div
                        className={
                            styles.formPreviewWrapper
                        }
                    >
                        <iframe
                            src={
                                previewUrl
                            }
                            title={
                                source.document_name
                                ??
                                "Form preview"
                            }
                            className={
                                styles.formPreviewFrame
                            }
                        />

                        <a
                            href={
                                previewUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className={
                                styles.formOpenNewTab
                            }
                        >
                            {locale === "en" ? "Open preview in new tab" : "Mở bản xem trước trong tab mới"}
                        </a>
                    </div>
                )}

            {/* ── FORM AGENT: nút gợi ý điền đơn ngay tại đây ─────────── */}
            {onFillRequest && (
                <button
                    type="button"
                    onClick={() => onFillRequest(source.document_name)}
                                    className={styles.formFillButton}
                >
                    🤖 {locale === "en" 
                        ? `Need help filling ${source.document_name ?? "this form"}?`
                        : `Cần mình giúp điền ${source.document_name ?? "đơn này"} luôn không?`}
                </button>
            )}
            {/* ── HẾT PHẦN FORM AGENT ──────────────────────────────────── */}
        </div>
    );
}
