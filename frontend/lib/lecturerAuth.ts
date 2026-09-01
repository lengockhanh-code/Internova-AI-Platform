export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export const ACCESS_TOKEN_KEY = "internova_access_token";
export const USER_STORAGE_KEY = "internova_user";

let lecturerSignOutInProgress = false;

export interface StoredUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as StoredUser;
  } catch {
    return null;
  }
}

export function clearLecturerSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function signOutLecturer(): void {
  if (typeof window === "undefined") return;

  lecturerSignOutInProgress = true;
  clearLecturerSession();
  window.location.replace("/auth/login");
}

export async function lecturerFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      clearLecturerSession();

      if (!lecturerSignOutInProgress) {
        window.alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");
        window.location.replace("/auth/login");
      }
    }
    throw new Error("Session expired");
  }

  return response;
}

export async function openAuthenticatedFile(
  url: string,
  download = false,
): Promise<void> {
  // Open the preview tab during the click event. Waiting for the authenticated
  // fetch first can cause browsers to treat window.open as a blocked popup.
  const previewWindow = !download
    ? window.open("about:blank", "_blank")
    : null;

  if (previewWindow) previewWindow.opener = null;

  let response: Response;
  try {
    response = await lecturerFetch(url, { cache: "no-store" });
  } catch (error) {
    previewWindow?.close();
    throw error;
  }

  if (!response.ok) {
    previewWindow?.close();
    throw new Error(`Không thể mở tệp (${response.status}).`);
  }

  let objectUrl: string;
  try {
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }

  if (download) {
    const disposition = response.headers.get("content-disposition") || "";
    const fileName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ||
      disposition.match(/filename="?([^";]+)"?/i)?.[1] ||
      "tai-lieu";
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = decodeURIComponent(fileName);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } else {
    if (previewWindow) previewWindow.location.replace(objectUrl);
    else {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
