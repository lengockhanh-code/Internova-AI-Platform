"use client";

import { GraduationCap, LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import {
  API_BASE_URL,
  clearLecturerSession,
  getAccessToken,
  getStoredUser,
  lecturerFetch,
} from "@/lib/lecturerAuth";

import styles from "./layout.module.css";

export default function LecturerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function verifySession() {
      const token = getAccessToken();
      const storedUser = getStoredUser();
      const storedRole = storedUser?.role?.trim().toUpperCase();

      if (!token || storedRole !== "LECTURER") {
        clearLecturerSession();
        router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const response = await lecturerFetch(`${API_BASE_URL}/api/v1/auth/me`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Phiên đăng nhập không hợp lệ.");
        }

        const user = (await response.json()) as { role?: string };
        const normalizedRole = user.role?.trim().toUpperCase();

        if (normalizedRole !== "LECTURER") {
          clearLecturerSession();
          router.replace(normalizedRole === "STUDENT" ? "/student/dashboard" : "/auth/login");
          return;
        }

        setAuthorized(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        clearLecturerSession();
        router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
      }
    }

    void verifySession();
    return () => controller.abort();
  }, [pathname, router]);

  if (!authorized) {
    return (
      <main className={styles.guardScreen}>
        <div className={styles.guardCard}>
          <span><GraduationCap size={28} /></span>
          <LoaderCircle className={styles.spinner} size={25} />
          <strong>Đang xác thực tài khoản giảng viên</strong>
          <p>Vui lòng chờ trong giây lát…</p>
        </div>
      </main>
    );
  }

  return children;
}
