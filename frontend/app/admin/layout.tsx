"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin-sidebar/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const isLoginPage = pathname === "/admin/login";
      const token = localStorage.getItem("internova_access_token");
      const userStr = localStorage.getItem("internova_user");

      if (isLoginPage) {
        if (token && userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user.role === "ADMIN") {
             router.replace("/admin/monitoring");
              return;
            }
          } catch (e) {
            // Ignored
          }
        }
        setAuthorized(true);
        setLoading(false);
        return;
      }

      if (!token || !userStr) {
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const user = JSON.parse(userStr);
        if (user.role !== "ADMIN") {
          router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setAuthorized(true);
      } catch (e) {
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (loading) {
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

  if (!authorized) {
    return null;
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
