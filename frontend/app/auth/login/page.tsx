"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    ShieldCheck,
} from "lucide-react";

import styles from "./page.module.css";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";

export default function LoginPage() {
    const router = useRouter();

    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setIsLoading(true);
        setError("");

        const formData = new FormData(
            event.currentTarget
        );

        const email = String(
            formData.get("email") ?? ""
        ).trim();

        const password = String(
            formData.get("password") ?? ""
        );

        try {
            const response = await fetch(
                `${API_URL}/api/v1/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email,
                        password,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ??
                    "Đăng nhập thất bại."
                );
            }

            if (
                data.user?.role !== "STUDENT" &&
                data.user?.role !== "LECTURER"
            ) {
                throw new Error(
                    "Tài khoản này không được phép đăng nhập tại cổng sinh viên/giảng viên."
                );
            }

            localStorage.setItem(
                "internova_access_token",
                data.accessToken
            );

            localStorage.setItem(
                "internova_user",
                JSON.stringify(data.user)
            );

            localStorage.setItem(
                "internova_theme",
                "light"
            );
            document.documentElement.classList.remove(
                "dark"
            );

            const requestedPath =
                new URLSearchParams(
                    window.location.search
                ).get("next");

            if (data.user.role === "LECTURER") {
                router.push(
                    requestedPath?.startsWith(
                        "/lecturer/"
                    )
                        ? requestedPath
                        : "/lecturer/dashboard"
                );

                return;
            }

            router.push(
                requestedPath?.startsWith(
                    "/student/"
                )
                    ? requestedPath
                    : "/student/dashboard"
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Đăng nhập thất bại."
            );
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className={styles.authPage}>
            <section
                className={styles.visualPanel}
                aria-label="Internova university access experience"
            >
                <video
                    className={styles.campusVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                >
                    <source
                        src="/videos/university_video.mp4"
                        type="video/mp4"
                    />
                </video>

                <div className={styles.videoOverlay} />
                <div className={styles.videoTexture} aria-hidden="true" />
                <div className={styles.edgeLine} aria-hidden="true" />

                <header className={styles.brand}>
                    <span className={styles.brandMark}>
                        <Image
                            src="/intern.png"
                            alt="Internova"
                            width={48}
                            height={48}
                            priority
                            className={styles.brandLogo}
                        />
                    </span>

                    <span className={styles.brandText}>
                        <strong>Internova</strong>
                        <span>AI Student Support Platform</span>
                    </span>
                </header>

                <div className={styles.visualStatus} aria-hidden="true">
                    <span className={styles.statusDot} />
                    <span>UNIVERSITY ACCESS · ONLINE</span>
                </div>

                <div className={styles.visualContent}>
                    <p className={styles.eyebrow}>
                        INTERNOVA · DIGITAL UNIVERSITY GATEWAY
                    </p>

                    <h1>
                        Hành trình đại học,
                        <span>được kết nối thông minh.</span>
                    </h1>

                    <p className={styles.visualDescription}>
                        Một điểm truy cập duy nhất cho thông tin,
                        hồ sơ, thực tập và trợ lý AI trong suốt
                        hành trình sinh viên.
                    </p>
                </div>

                <div className={styles.visualMeta}>
                    <span>AI STUDENT SUPPORT</span>
                    <span>ACCESS PORTAL / 2026</span>
                </div>
            </section>

            <section className={styles.authPanel}>
                <div className={styles.authAmbient} aria-hidden="true" />

                <Link href="/" className={styles.backHome}>
                    <ArrowLeft size={16} />
                    Quay lại Internova
                </Link>

                <div className={styles.mobileBrand}>
                    <Image
                        src="/intern.png"
                        alt="Internova"
                        width={42}
                        height={42}
                        priority
                        className={styles.mobileBrandLogo}
                    />
                    <div>
                        <strong>Internova</strong>
                        <span>AI Student Support Platform</span>
                    </div>
                </div>

                <div className={styles.authInner}>
                    <div className={styles.portalTag}>
                        <span className={styles.portalTagDot} />
                        STUDENT &amp; LECTURER PORTAL
                    </div>

                    <div className={styles.formHeader}>
                        <h2>Chào mừng trở lại.</h2>
                        <p>
                            Đăng nhập để tiếp tục hành trình học tập,
                            thực tập và các nhiệm vụ của bạn trên Internova.
                        </p>
                    </div>

                    <form
                        className={styles.loginForm}
                        onSubmit={handleSubmit}
                    >
                        <div className={styles.formGroup}>
                            <label htmlFor="email">
                                Địa chỉ email
                            </label>

                            <div className={styles.inputWrapper}>
                                <Mail size={18} aria-hidden="true" />
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="name@university.edu"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <div className={styles.passwordLabel}>
                                <label htmlFor="password">
                                    Mật khẩu
                                </label>

                                <Link href="/auth/forgot-password">
                                    Quên mật khẩu?
                                </Link>
                            </div>

                            <div className={styles.inputWrapper}>
                                <LockKeyhole size={18} aria-hidden="true" />
                                <input
                                    id="password"
                                    name="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="Nhập mật khẩu"
                                    autoComplete="current-password"
                                    required
                                />

                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() =>
                                        setShowPassword(
                                            current => !current
                                        )
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Ẩn mật khẩu"
                                            : "Hiện mật khẩu"
                                    }
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div
                                className={styles.errorMessage}
                                role="alert"
                                aria-live="polite"
                            >
                                {error}
                            </div>
                        )}

                        <div className={styles.formUtilities}>
                            <label className={styles.rememberRow}>
                                <input
                                    type="checkbox"
                                    name="remember"
                                />
                                <span>Ghi nhớ đăng nhập</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            className={styles.loginButton}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span
                                        className={styles.loadingSpinner}
                                        aria-hidden="true"
                                    />
                                    Đang đăng nhập...
                                </>
                            ) : (
                                <>
                                    Đăng nhập
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className={styles.authSwitch}>
                        <span>Chưa có tài khoản?</span>
                        <Link href="/auth/register">
                            Đăng ký
                        </Link>
                    </div>

                    <div className={styles.securityNote}>
                        <span className={styles.securityIcon}>
                            <ShieldCheck size={17} />
                        </span>
                        <div>
                            <strong>Secure university access</strong>
                            <p>
                                Phiên đăng nhập được bảo vệ và phân quyền
                                theo tài khoản của bạn.
                            </p>
                        </div>
                    </div>

                    <p className={styles.terms}>
                        Trang đăng ký công khai chỉ dành cho sinh viên.
                        Tài khoản giảng viên do hệ thống cấp.
                    </p>
                </div>

                <footer className={styles.authFooter}>
                    <span>© 2026 Internova</span>
                    <span>Protected access</span>
                </footer>
            </section>
        </main>
    );
}
