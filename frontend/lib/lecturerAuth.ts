export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export const ACCESS_TOKEN_KEY = "internova_access_token";
export const USER_STORAGE_KEY = "internova_user";

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
      window.alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");
      window.location.replace("/auth/login");
    }
    throw new Error("Session expired");
  }

  return response;
}

export async function openAuthenticatedFile(
  url: string,
  download = false,
): Promise<void> {
  const response = await lecturerFetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Không thể mở tệp (${response.status}).`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

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
    window.open(objectUrl, "_blank", "noopener,noreferrer");
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
