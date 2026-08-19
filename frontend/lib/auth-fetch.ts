let isHandlingUnauthorized = false;

function clearAuth() {
    localStorage.removeItem("internova_access_token");
    localStorage.removeItem("internova_user");
}

export function handleUnauthorized() {
    if (typeof window === "undefined") {
        return;
    }

    // Có thể nhiều API cùng trả 401 một lúc.
    // Chỉ hiện thông báo + redirect 1 lần.
    if (isHandlingUnauthorized) {
        return;
    }

    isHandlingUnauthorized = true;

    clearAuth();

    window.alert(
        "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục."
    );

    window.location.replace("/auth/login");
}

export async function authFetch(
    input: RequestInfo | URL,
    init: RequestInit = {}
): Promise<Response> {
    if (typeof window === "undefined") {
        return fetch(input, init);
    }

    const token = localStorage.getItem(
        "internova_access_token"
    );

    if (!token) {
        handleUnauthorized();

        throw new Error(
            "Authentication required"
        );
    }

    const headers = new Headers(
        init.headers
    );

    headers.set(
        "Authorization",
        `Bearer ${token}`
    );

    const response = await fetch(
        input,
        {
            ...init,
            headers,
        }
    );

    if (response.status === 401) {
        handleUnauthorized();

        throw new Error(
            "Session expired"
        );
    }

    return response;
}