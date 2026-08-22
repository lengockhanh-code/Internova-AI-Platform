"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, ShieldAlert, KeyRound, Loader2 } from "lucide-react";
import styles from "./page.module.css";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear any existing session when loading login page
  useEffect(() => {
    localStorage.removeItem("internova_access_token");
    localStorage.removeItem("internova_user");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          role: "ADMIN",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      }

      localStorage.setItem("internova_access_token", data.accessToken);
      localStorage.setItem("internova_user", JSON.stringify(data.user));

      const next = searchParams.get("next");
      if (next && next.startsWith("/admin")) {
        router.replace(next);
      } else {
        router.replace("/admin/ai-monitoring");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.adminLoginPage}>
      <Link
  href="/"
  className={styles.backHome}
>
  ← Về trang chủ
</Link>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>
              <KeyRound size={20} strokeWidth={2} />
            </span>
            <span className={styles.brandText}>Internova Admin</span>
          </div>
          <h1 className={styles.title}>Hệ thống Quản trị</h1>
          <p className={styles.subtitle}>Vui lòng đăng nhập để tiếp tục</p>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="email">
              Email quản trị viên
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <Mail size={18} />
              </span>
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="admin@vinuni.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="password">
              Mật khẩu
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <Lock size={18} />
              </span>
              <input
                id="password"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className={styles.spin} />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              <span>Đăng nhập</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
