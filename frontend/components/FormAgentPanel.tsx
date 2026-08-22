"use client";

// FormAgentPanel.tsx — Hiển thị THUẦN, không tự gọi API, không có ô
// nhập riêng nữa.
//
// FIX lớn: trước đây component này tự quản lý session + tự gọi API +
// có ô nhập text riêng bên trong — khiến trải nghiệm "tạo 1 ô nhập
// mới" tách biệt khỏi chat chính. Giờ mọi state (status, nội dung,
// loading, lỗi...) đều do trang cha (page.tsx) quản lý và truyền vào
// qua props; mọi hành động (Có/Không, Xác nhận, Hủy) đều là callback
// props gọi ngược lên cha. Việc TRẢ LỜI TỰ DO (bù thông tin) giờ hoàn
// toàn đi qua Ô NHẬP CHÍNH của trang chat, không còn ô nhập ở đây.

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface FormAgentPanelProps {
    phase: "confirm" | "working";
    detectedFormName?: string;
    status?: string | null;
    displayText?: string;
    loading?: boolean;
    error?: string | null;
    docxReady?: boolean;
    sessionId?: string | null;
    onConfirmYes?: () => void;
    onConfirmNo?: () => void;
    onApprove?: () => void;
    onCancelSession?: () => void;
}

export default function FormAgentPanel({
    phase,
    detectedFormName,
    status,
    displayText,
    loading,
    error,
    docxReady,
    sessionId,
    onConfirmYes,
    onConfirmNo,
    onApprove,
    onCancelSession,
}: FormAgentPanelProps) {
    // ── Bước xác nhận đơn giản — KHÔNG có nút, chỉ hỏi bằng chữ, chờ
    // sinh viên gõ trả lời tự nhiên ở ô nhập chính bên dưới. ─────────
    if (phase === "confirm") {
        return (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-blue-900">
                    🤖 Agent điền đơn
                </h3>
                <p className="text-sm text-gray-800">
                    Bạn có muốn mình giúp điền{" "}
                    <strong>{detectedFormName ?? "biểu mẫu này"}</strong> ngay
                    bây giờ không?
                </p>
                <p className="text-xs text-gray-500 italic">
                    Gõ &quot;có&quot; hoặc &quot;không&quot; ngay trong ô nhập
                    tin nhắn bên dưới nhé 👇
                </p>
            </div>
        );
    }

    // ── Đang làm việc: hỏi bù, chờ xác nhận, hoặc đã xong ────────────
    const downloadUrl =
        sessionId != null
            ? `${API_BASE}/api/v1/form-agent/download/${sessionId}`
            : null;

    return (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-900">
                    🤖 Agent điền đơn
                    {status ? ` — ${status}` : ""}
                </h3>
                {sessionId && status !== "approved" && status !== "cancelled" && (
                    <button
                        onClick={onCancelSession}
                        disabled={loading}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                        Hủy phiên
                    </button>
                )}
            </div>

            {loading && (
                <p className="text-sm text-gray-500">Đang xử lý...</p>
            )}

            {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    ⚠️ {error}
                </p>
            )}

            {displayText && !loading && (
                <div className="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-lg border border-gray-200 p-3">
                    {displayText}
                </div>
            )}

            {status === "approved" && (
                <div className="space-y-2">
                    <p className="text-sm text-green-700 font-medium">
                        ✅ Đã xác nhận xong!
                    </p>
                    {downloadUrl && docxReady && (
                        <a
                            href={downloadUrl}
                            className="inline-block text-sm bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700"
                        >
                            ⬇️ Tải file đã điền
                        </a>
                    )}
                </div>
            )}

            {status === "cancelled" && (
                <p className="text-sm text-gray-600">Đã hủy phiên điền đơn.</p>
            )}

            {status === "awaiting_review" && (
                <button
                    onClick={onApprove}
                    disabled={loading}
                    className="self-start bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
                >
                    ✅ Xác nhận, đúng rồi
                </button>
            )}

            {status === "collecting_info" && !loading && (
                <p className="text-xs text-gray-500 italic">
                    Trả lời ngay trong ô nhập tin nhắn bên dưới nhé 👇
                </p>
            )}
        </div>
    );
}