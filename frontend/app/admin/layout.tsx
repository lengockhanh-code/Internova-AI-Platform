"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin-sidebar/admin-sidebar";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

function clearAdminSession() {
  localStorage.removeItem("internova_access_token");
  localStorage.removeItem("internova_user");
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorizedPath, setAuthorizedPath] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function verifyAdminSession() {
      if (pathname === "/admin/login") {
        setAuthorizedPath(pathname);
        return;
      }

      setAuthorizedPath(null);

      const token = localStorage.getItem("internova_access_token");
      const userStr = localStorage.getItem("internova_user");

      if (!token || !userStr) {
        clearAdminSession();
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const storedUser = JSON.parse(userStr) as { role?: string };
        if (storedUser.role !== "ADMIN") {
          clearAdminSession();
          router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const currentUser = await response.json() as {
          id: number;
          email: string;
          fullName: string;
          role: string;
          avatarUrl?: string | null;
        };

        if (currentUser.role !== "ADMIN") {
          throw new Error("Admin role is required");
        }

        if (localStorage.getItem("internova_access_token") !== token) {
          return;
        }

        localStorage.setItem("internova_user", JSON.stringify(currentUser));
        setAuthorizedPath(pathname);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        clearAdminSession();
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      }
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === "internova_access_token" ||
        event.key === "internova_user"
      ) {
        void verifyAdminSession();
      }
    };

    void verifyAdminSession();
    window.addEventListener("storage", handleStorageChange);

    return () => {
      controller.abort();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [pathname, router]);

  if (authorizedPath !== pathname) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#0B0F19",
        color: "#94A3B8",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            border: "3px solid rgba(255,255,255,0.1)",
            borderTopColor: "#3B82F6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span>Đang xác thực quyền truy cập...</span>
        </div>
      </div>
    );
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f6f8fb" }}>
      <AdminSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
