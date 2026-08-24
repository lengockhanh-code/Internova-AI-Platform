"use client";

import {
    memo,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";
import FormAgentPanel from "@/components/FormAgentPanel";
import { useSettings } from "@/context/settings-provider";

import {
    Bot,
    ChevronDown,
    ArrowDown,
    Download,
    Eye,
    FileText,
    ListTree,
    Plus,
    Square,
    Send,
    User,
} from "lucide-react";

import styles from "./page.module.css";



const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


const CHAT_MESSAGES_KEY =
    "internova_chat_messages";

const CHAT_SESSION_KEY =
    "internova_chat_session_id";

const CHAT_UPDATED_EVENT =
    "internova:chat-updated";

type ChatRuntimeWindow = Window & {
    __internovaChatStreamActive?: boolean;
    __internovaChatAbortController?: AbortController | null;
};


/*
 * Messenger-like history rendering:
 * - Keep the full conversation in state/storage.
 * - Only mount the newest messages in the DOM.
 * - Automatically prepend older messages when the user scrolls upward.
 */
const INITIAL_VISIBLE_MESSAGES = 30;
const LOAD_OLDER_MESSAGES_STEP = 25;
const NEAR_BOTTOM_THRESHOLD_PX = 180;
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
    | "done"
    | "error";


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
    result?: {
        answer?: string;
        answer_status?: string;
        confidence?: number;
        needs_retrieval?: boolean;
        sources?: Source[];
    };
};



function getToken() {
    if (typeof window === "undefined") {
        return null;
    }
    return localStorage.getItem("internova_access_token");
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
        thinking:   { vi: "Đang suy nghĩ",     en: "Thinking" },
        answering:  { vi: "Đang trả lời",       en: "Answering" },
        done:       { vi: "",                   en: "" },
        error:      { vi: "",                   en: "" },
        idle:       { vi: "",                   en: "" },
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

    const [
        messages,
        setMessages,
    ] =
        useState<Message[]>([
            welcomeMessage,
        ]);


    const [
        input,
        setInput,
    ] =
        useState("");


    const [
        loading,
        setLoading,
    ] =
        useState(false);


    // ── FORM AGENT: mỗi lượt là 1 tin nhắn assistant bình thường,
    // hiện tự nhiên trong dòng chat — không còn panel cố định.
    const [pendingSuggestedForm, setPendingSuggestedForm] = useState<string | null>(null);
    const [activeFormAgentSessionId, setActiveFormAgentSessionId] = useState<string | null>(null);
    const [activeFormAgentStatus, setActiveFormAgentStatus] = useState<string | null>(null);

    const CONFIRM_ONLY_TOKENS = new Set([
        "co", "uh", "um", "uk", "u", "ok", "okay", "duoc", "roi",
        "dong", "y", "vang", "ung", "yes", "yep", "sure",
        "giup", "minh", "mik", "mjk", "em", "toi", "voi",
        "nhe", "di", "luon", "dien", "form", "don", "gium", "ho",
        "da", "a", "can",
        "lam", "tao", "dung", "1", "2", "3", "4", "5",
    ]);

    function isPureConfirmReply(message: string): boolean {
        const normalized = message
            .toLowerCase()
            .replace(/đ/g, "d")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/(\d)\.(\d)/g, "$1 $2");

        const tokens = normalized.split(/\s+/).filter(Boolean);

        if (tokens.length === 0 || tokens.length > 10) return false;

        return tokens.every(t => CONFIRM_ONLY_TOKENS.has(t));
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
    async function startFormAgent(formName?: string, userPrompt?: string) {
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

            updateMessageById(newId, m => ({
                ...m,
                formAgentSessionId: data.session_id,
                formAgentStatus: data.status,
                content: data.ask_message || data.review_summary_markdown || "",
                formAgentDocxReady: data.docx_ready,
                formAgentLoading: false,
                formAgentErrorMsg: data.error ?? null,
            }));

            setActiveFormAgentSessionId(data.session_id);
            setActiveFormAgentStatus(data.status);
            setPendingSuggestedForm(null);
        } catch (err) {
            updateMessageById(newId, m => ({
                ...m,
                formAgentLoading: false,
                formAgentErrorMsg: err instanceof Error ? err.message : "Đã có lỗi xảy ra",
            }));
            setPendingSuggestedForm(null);
        }
    }

    // Bấm nút gợi ý -> Chạy Form Agent trực tiếp ngay lập tức
    function handleFormAgentRequest(formName?: string) {
        setPendingSuggestedForm(null);
        void startFormAgent(formName, "bắt đầu điền đơn");
    }

    // Sinh viên gõ câu trả lời cho agent NGAY TẠI Ô NHẬP CHÍNH →
    // THÊM 1 tin nhắn assistant mới (không sửa tin nhắn cũ) chứa
    // câu hỏi/kết quả tiếp theo — giống hệt cách chat RAG bình
    // thường thêm tin nhắn mới mỗi lượt.
    async function continueFormAgentTurn(userText: string) {
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

            updateMessageById(newId, m => ({
                ...m,
                formAgentSessionId: data.session_id,
                formAgentStatus: data.status,
                content: data.ask_message || data.review_summary_markdown || "",
                formAgentDocxReady: data.docx_ready,
                formAgentLoading: false,
                formAgentErrorMsg: data.error ?? null,
            }));

            setActiveFormAgentStatus(data.status);
            if (data.status === "approved" || data.status === "cancelled") {
                setActiveFormAgentSessionId(null);
                setActiveFormAgentStatus(null);
            }
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

        sessionStorage.setItem(
            CHAT_MESSAGES_KEY,
            JSON.stringify(nextMessages)
        );

        window.dispatchEvent(
            new Event(CHAT_UPDATED_EVENT)
        );
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

        try {
            const storedMessages =
                sessionStorage.getItem(
                    CHAT_MESSAGES_KEY
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
                CHAT_MESSAGES_KEY
            );
        }


        let sessionId =
            sessionStorage.getItem(
                CHAT_SESSION_KEY
            );


        if (!sessionId) {

            sessionId =
                crypto.randomUUID();


            sessionStorage.setItem(
                CHAT_SESSION_KEY,
                sessionId
            );
        }


        sessionIdRef.current =
            sessionId;


        setStorageLoaded(
            true
        );

    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        const syncFromStorage = () => {
            const stored =
                sessionStorage.getItem(
                    CHAT_MESSAGES_KEY
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
                CHAT_MESSAGES_KEY,
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

    const hiddenMessageCount =
        Math.max(
            0,
            messages.length -
            visibleMessages.length
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
    ]);


    /*
     * Load older messages automatically when the top sentinel becomes
     * visible, similar to Messenger/Telegram history pagination.
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
            hiddenMessageCount <= 0
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

                    preserveScrollRef.current = {
                        element: list,
                        previousScrollHeight: list.scrollHeight,
                    };

                    setVisibleMessageCount(
                        current =>
                            Math.min(
                                messages.length,
                                current +
                                LOAD_OLDER_MESSAGES_STEP
                            )
                    );
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
        hiddenMessageCount,
        messages.length,
        visibleMessageCount,
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



    /* ============================================================
       NEW CHAT
    ============================================================ */

    function startNewChat() {

        const runtime =
            getChatRuntime();

        (
            runtime.__internovaChatAbortController
            ??
            abortControllerRef.current
        )?.abort();

        runtime.__internovaChatAbortController =
            null;

        runtime.__internovaChatStreamActive =
            false;

        abortControllerRef.current =
            null;

        const newSessionId =
            crypto.randomUUID();


        sessionIdRef.current =
            newSessionId;


        sessionStorage.setItem(
            CHAT_SESSION_KEY,
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

        isNearBottomRef.current =
            true;


        setInput("");


        setLoading(
            false
        );

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
        setShowJumpToLatest(false);

        setPendingSuggestedForm(null);
        setActiveFormAgentSessionId(null);
        setActiveFormAgentStatus(null);
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
            (activeFormAgentStatus === "collecting_info" || activeFormAgentStatus === "awaiting_review")
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
                "huy", "huy phien", "huy don", "huy dien don", "cancel",
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

            void continueFormAgentTurn(message);
            return;
        }

        // ── FORM AGENT 2: Nếu có form vừa được gợi ý VÀ người dùng gõ xác nhận ──
        if (pendingSuggestedForm && !activeFormAgentSessionId) {
            const noWords = ["khong", "thoi", "khoi", "no", "khong can"];
            const normalized = message
                .toLowerCase()
                .replace(/đ/g, "d")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
            const tokens = normalized.split(/\s+/).filter(Boolean);
            const isExplicitNo = tokens.some(t => noWords.includes(t));

            if (!isExplicitNo && isPureConfirmReply(message)) {
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

                const targetForm = pendingSuggestedForm;
                setPendingSuggestedForm(null);
                void startFormAgent(targetForm, message);
                return;
            }

            // Nếu là câu hỏi khác hoặc câu từ chối -> xóa pending form và tiếp tục chạy xuống RAG
            setPendingSuggestedForm(null);
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
                CHAT_SESSION_KEY,
                newSessionId
            );
        }


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
        };


        isNearBottomRef.current =
            true;
        setShowJumpToLatest(false);

        const nextMessages = [
            ...messagesRef.current,
            userMessage,
            assistantMessage,
        ];

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
            const nextMessages =
                messagesRef.current.map(
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

            persistMessages(
                nextMessages
            );

            setMessages(
                nextMessages
            );
        };

        // ── FORM AGENT: kiểm tra độc lập, tách biệt hoàn toàn khỏi
        // luồng chat/auth chính — lỗi ở đây không bao giờ ảnh hưởng
        // tới việc gửi/nhận tin nhắn bình thường.
        const checkFormRelevance = async (
            contextText: string,
        ) => {
            try {
                const res = await fetch(
                    `${API_URL}/api/v1/form-agent/detect`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: contextText }),
                    }
                );
                if (!res.ok) return;
                const data: { detected_form?: string | null } =
                    await res.json();
                if (data.detected_form) {
                    setPendingSuggestedForm(data.detected_form);
                    updateAssistantMessage(current => ({
                        ...current,
                        detectedForm: data.detected_form,
                    }));
                }
            } catch {
                // Im lặng bỏ qua — chỉ là gợi ý phụ.
            }
        };
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
                    streamPhase:
                        "answering",
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

            const response =
                await fetch(
                    `${API_URL}/api/v1/chat/stream`,
                    {
                        method: "POST",
                        headers,
                        signal: requestController.signal,
                        body: JSON.stringify({
                            message,
                            session_id: sessionIdRef.current,
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
                        status: "done",
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
                    sources: [],
                    confidence:
                        undefined,
                    needsRetrieval:
                        false,
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

            abortControllerRef.current = null;

            window.dispatchEvent(
                new Event(CHAT_UPDATED_EVENT)
            );

            setLoading(
                false
            );

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
                    className={
                        styles.chatPage
                    }
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

                            <div
                                className={
                                    styles.titleRow
                                }
                            >

                                <span
                                    className={
                                        styles.titleIcon
                                    }
                                >
                                    <Image
                                        src="/vinuni-internship-logo.svg"
                                        alt="AI Internova logo"
                                        width={44}
                                        height={44}
                                        priority
                                        className={styles.titleLogo}
                                    />
                                </span>


                                <div>

                                    <h1 className="notranslate" translate="no">
                                        AI Internova
                                    </h1>

                                </div>

                            </div>


                            <p>
                                {locale === "en"
                                    ? "AI assistant answers based on official university documents. If no information is found, the AI will let you know."
                                    : "Trợ lý AI trả lời dựa trên tài liệu chính thức của nhà trường. Nếu không tìm thấy thông tin, AI sẽ cho bạn biết."}
                            </p>

                        </div>



                        <div
                            className={
                                styles.chatHeaderActions
                            }
                        >

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

                            {hiddenMessageCount >
                                0 && (
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
                                        {locale === "en"
                                            ? <>Scroll up to see {hiddenMessageCount} older message{hiddenMessageCount !== 1 ? "s" : ""}</>
                                            : <>Cuộn lên để xem {hiddenMessageCount}{" "}tin nhắn cũ</>}
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
                                            onFillRequest={(formName) => handleFormAgentRequest(formName)}
                                            onFormAgentApprove={handleFormAgentApprove}
                                            onFormAgentCancelSession={handleFormAgentCancelSession}
                                        />
                                    </div>

                                )
                            )}

                            {/* =================================================
                                SUGGESTIONS
                            ================================================= */}

                            {messages.length ===
                                1 && (

                                    <div
                                        className={
                                            `${styles.suggestionList} notranslate`
                                        }
                                        translate="no"
                                    >

                                        {suggestions.map(
                                            suggestion => (

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
                                                    {
                                                        suggestion
                                                    }
                                                </button>

                                            )
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
                                        ref={chatInputRef}
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
                                            (activeFormAgentStatus === "collecting_info" || activeFormAgentStatus === "awaiting_review")
                                                ? (locale === "en"
                                                    ? "Enter information for the form (or type 'cancel' to stop)..."
                                                    : "Nhập thông tin cho đơn (hoặc gõ 'hủy' để dừng)...")
                                                : pendingSuggestedForm
                                                    ? (locale === "en"
                                                        ? `Type 'yes' to fill ${pendingSuggestedForm}, or ask another question...`
                                                        : `Gõ 'có' để điền ${pendingSuggestedForm}, hoặc nhập câu hỏi tiếp theo...`)
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


    return (

        <div
            className={
                isUser
                    ? styles.userMessageRow
                    : styles.aiMessageRow
            }
        >

            <div
                className={
                    isUser
                        ? styles.userAvatar
                        : styles.aiAvatar
                }
            >

                {isUser ? (
                    <User size={18} />
                ) : (
                    <Bot
                        size={20}
                        strokeWidth={2}
                    />
                )}

            </div>


            {showStreamingStatus ? (

                <div
                    className={
                        styles.streamingOnly
                    }
                    aria-live="polite"
                >

                    <span
                        className={
                            styles.streamingLabel
                        }
                    >
                        {
                            getPhaseLabel(
                                streamPhase,
                                locale
                            )
                        }
                    </span>


                    <span
                        className={
                            styles.typingDots
                        }
                        aria-hidden="true"
                    >
                        <span />
                        <span />
                        <span />
                    </span>

                </div>

            ) : (

                (
                    isUser
                    ||
                    hasRenderableContent
                    ||
                    formSource
                    ||
                    message.isFormAgentMessage
                    ||
                    (
                        message.sources
                        &&
                        message.sources.length > 0
                    )
                ) && (

                    <div
                        className={
                            isUser
                                ? styles.userBubble
                                : styles.aiBubble
                        }
                    >

                        {isUser ? (

                            <p
                                className={
                                    styles.userMessageText
                                }
                            >
                                {
                                    message.content
                                }
                            </p>

                        ) : message.isFormAgentMessage ? (

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
                                className={
                                    `${styles.markdownContent} notranslate`
                                }
                                translate="no"
                            >

                                <ReactMarkdown
                                    remarkPlugins={[
                                        remarkGfm,
                                    ]}
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


                        {!isUser &&
                            formSource && (

                                <FormResourceCard
                                    source={formSource}
                                    locale={locale}
                                    onFillRequest={onFillRequest}
                                />

                            )}

                        {/* ── FORM AGENT: gợi ý độc lập, không phụ thuộc
                             formSource — chỉ hiện khi CHƯA có
                             FormResourceCard ở trên ────────────────────── */}
                        {!isUser &&
                            !formSource &&
                            message.detectedForm && (

                                <button
                                    type="button"
                                    onClick={() => onFillRequest?.(message.detectedForm ?? undefined)}
                                    style={{
                                        marginTop: 10,
                                        width: "100%",
                                        padding: "8px 14px",
                                        borderRadius: 8,
                                        border: "1px solid #93c5fd",
                                        background: "#eff6ff",
                                        color: "#1d4ed8",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        fontWeight: 500,
                                    }}
                                >
                                    🤖 {locale === "en"
                                    ? `Need help filling ${message.detectedForm}?`
                                    : `Cần mình giúp điền ${message.detectedForm} luôn không?`}
                                </button>

                            )}
                        {/* ── HẾT PHẦN FORM AGENT ──────────────────────── */}


                        {!isUser &&
                            message.needsRetrieval === true &&
                            confidencePercent !== null &&
                            confidencePercent > 0 && (

                                <div
                                    className={
                                        styles.answerMeta
                                    }
                                >

                                    <span>
                                        {locale === "en" ? "Confidence" : "Độ tin cậy"}
                                    </span>


                                    <div
                                        className={
                                            styles.confidenceTrack
                                        }
                                        aria-hidden="true"
                                    >

                                        <div
                                            className={
                                                styles.confidenceFill
                                            }
                                            style={{
                                                width:
                                                    `${confidencePercent}%`,
                                            }}
                                        />

                                    </div>


                                    <strong>
                                        {
                                            confidencePercent
                                        }
                                        %
                                    </strong>

                                </div>

                            )}


                        {!isUser &&
                            message.sources &&
                            message.sources.length > 0 && (

                                <Sources
                                    sources={
                                        message.sources
                                    }
                                    locale={locale}
                                    onFillRequest={onFillRequest}
                                />

                            )}

                    </div>

                )

            )}

        </div>
    );
});



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
                    style={{
                        marginTop: 10,
                        width: "100%",
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid #93c5fd",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 500,
                    }}
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
