"use client";

import Image from "next/image";

import {
    memo,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";

import {
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


const welcomeMessage: Message = {
    id: "welcome",

    role: "assistant",

    content:
        "Xin chào! 👋 Mình là **Internova AI**, trợ lý hỗ trợ thực tập dành cho sinh viên VinUni.\n\nBạn có thể hỏi mình về **quy trình đăng ký thực tập, điều kiện, biểu mẫu, báo cáo, đánh giá và các quy định liên quan**.\n\nMình sẽ trả lời dựa trên tài liệu chính thức được cung cấp trong hệ thống.",
};


const suggestions = [
    "Thời gian nộp báo cáo thực tập là khi nào?",

    "Quy trình đăng ký thực tập gồm những bước nào?",

    "Nếu nộp báo cáo trễ thì có bị trừ điểm không?",
];

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
): string {
    switch (phase) {
        case "retrieving":
            return "Đang tìm tài liệu";
        case "thinking":
            return "Đang suy nghĩ";
        case "answering":
            return "Đang trả lời";
        case "done":
            return "";
        case "error":
            return "";
        default:
            return "";
    }
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

    const notifyChatUpdated = () => {
        window.dispatchEvent(
            new Event(
                CHAT_UPDATED_EVENT
            )
        );
    };

    const persistMessages = (
        nextMessages: Message[],
    ) => {
        messagesRef.current =
            nextMessages;

        try {
            sessionStorage.setItem(
                CHAT_MESSAGES_KEY,
                JSON.stringify(
                    nextMessages
                )
            );

            notifyChatUpdated();

        } catch (error) {
            console.error(
                "Không thể lưu lịch sử chat:",
                error
            );
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
                    const runtime =
                        getChatRuntime();

                    const streamStillRunning =
                        runtime.__internovaChatStreamActive
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
                                Boolean(
                                    msg.content
                                )
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
            try {
                const stored =
                    sessionStorage.getItem(
                        CHAT_MESSAGES_KEY
                    );

                if (!stored) {
                    return;
                }

                const parsed =
                    JSON.parse(
                        stored
                    ) as Message[];

                if (
                    !Array.isArray(parsed)
                    ||
                    parsed.length === 0
                ) {
                    return;
                }

                messagesRef.current =
                    parsed;

                setMessages(
                    parsed
                );

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
            ||
            loading
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
        loading,
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

        const activeController =
            runtime.__internovaChatAbortController
            ??
            abortControllerRef.current;

        activeController?.abort();

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


    }


    /* ============================================================
       STOP GENERATION
    ============================================================ */
    function stopGeneration() {
        const runtime =
            getChatRuntime();

        const controller =
            runtime.__internovaChatAbortController
            ??
            abortControllerRef.current;

        if (controller) {
            controller.abort();
        }

        abortControllerRef.current =
            null;

        runtime.__internovaChatAbortController =
            null;

        runtime.__internovaChatStreamActive =
            false;

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
            const next =
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
                next
            );

            setMessages(
                next
            );
        };

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
                ===
                abortControllerRef.current
            ) {
                runtime.__internovaChatAbortController =
                    null;
            }

            runtime.__internovaChatStreamActive =
                false;

            abortControllerRef.current = null;

            notifyChatUpdated();

            setLoading(
                false
            );

        }
    }



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
                                        src="/internova.png"
                                        alt="Internova"
                                        width={36}
                                        height={36}
                                        priority
                                    />
                                </span>


                                <div>

                                    <h1>
                                        Internova AI
                                    </h1>

                                </div>

                            </div>


                            <p>
                                Trợ lý AI trả lời dựa
                                trên tài liệu chính thức
                                của nhà trường. Nếu
                                không tìm thấy thông tin,
                                AI sẽ cho bạn biết.
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
                                    Cuộc trò chuyện mới
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
                                styles.messageList
                            }
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
                                    Cuộn lên để xem{" "}
                                    {
                                        hiddenMessageCount
                                    }{" "}
                                    tin nhắn cũ
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
                                            message={message}
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
                                        styles.suggestionList
                                    }
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
                                    aria-label="Xem các câu hỏi đã gửi"
                                    title="Các câu hỏi đã gửi"
                                >
                                    <ListTree size={18} />
                                </button>

                                {promptNavOpen && (
                                    <div className={styles.promptNavigatorPanel}>
                                        <div className={styles.promptNavigatorTitle}>
                                            Câu hỏi của bạn
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
                                        aria-label="Đi tới tin nhắn mới nhất"
                                        title="Đi tới tin nhắn mới nhất"
                                    >
                                        <ArrowDown size={18} />
                                    </button>
                                )}

                                <div
                                    className={
                                        styles.chatComposer
                                    }
                                >

                                    <textarea
                                        rows={1}
                                        value={
                                            input
                                        }
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
                                            "Nhập câu hỏi của bạn về học vụ, quy định, thủ tục thực tập..."
                                        }
                                    />

                                    {loading ? (
                                        <button
                                            type="button"
                                            className={styles.sendButton}
                                            onClick={stopGeneration}
                                            aria-label="Dừng trả lời"
                                            title="Dừng trả lời"
                                        >
                                            <Square size={16} fill="currentColor" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className={styles.sendButton}
                                            onClick={() => void sendMessage()}
                                            disabled={!input.trim()}
                                            aria-label="Gửi"
                                            title="Gửi"
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
}: {
    message: Message;
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
                    <Image
                        src="/internova.png"
                        alt="Internova"
                        width={20}
                        height={20}
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
                                streamPhase
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

                        ) : hasRenderableContent ? (

                            <div
                                className={
                                    styles.markdownContent
                                }
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
                            />

                        )}


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
                                    Độ tin cậy
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
}: {
    sources: Source[];
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
                        nguồn tham khảo
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
                                                styles
                                                    .sourceQuote
                                            }
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
}: {
    source: Source;
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
                            "Biểu mẫu thực tập"}
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
                            ? "Ẩn mẫu"
                            : "Xem mẫu"}
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

                        Tải mẫu
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
                        Mở bản xem trước
                        trong tab mới
                    </a>
                </div>
            )}
        </div>
    );
}