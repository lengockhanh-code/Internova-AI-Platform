"use client";

import Link from "next/link";

import {
    ArrowLeft,
    ArrowRight,
    BotMessageSquare,
    CheckCircle2,
    Eye,
    EyeOff,
    GraduationCap,
    LockKeyhole,
    Mail,
    Sparkles,
    UserRoundCheck,
} from "lucide-react";

import {
    FormEvent,
    useEffect,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import styles from "./page.module.css";


const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";


type LoginRole =
    | "STUDENT"
    | "LECTURER";


export default function LoginPage() {
    const router =
        useRouter();


    const [
        showPassword,
        setShowPassword,
    ] =
        useState(false);


    const [
        role,
        setRole,
    ] =
        useState<LoginRole>(
            "STUDENT"
        );


    const [
        isLoading,
        setIsLoading,
    ] =
        useState(false);


    const [
        error,
        setError,
    ] =
        useState("");


    async function handleSubmit(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setIsLoading(true);

        setError("");


        const formData =
            new FormData(
                event.currentTarget
            );


        const email =
            String(
                formData.get(
                    "email"
                ) ?? ""
            ).trim();


        const password =
            String(
                formData.get(
                    "password"
                ) ?? ""
            );


        try {

            const response =
                await fetch(
                    `${API_URL}/api/v1/auth/login`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                email,
                                password,
                                role,
                            }),
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.detail ??
                    "Đăng nhập thất bại."
                );
            }


            localStorage.setItem(
                "internova_access_token",
                data.accessToken
            );


            localStorage.setItem(
                "internova_user",
                JSON.stringify(
                    data.user
                )
            );


            if (
                data.user.role ===
                "LECTURER"
            ) {
                const requestedPath =
                    new URLSearchParams(
                        window.location.search
                    ).get("next");

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
                "/student/dashboard"
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
        <main
            className={
                styles.authPage
            }
        >
            <Link
                href="/"
                className={styles.backHome}
            >
                <ArrowLeft size={16} />
                Về trang chủ
            </Link>

            <div
                className={
                    styles.backgroundGlowOne
                }
            />

            <div
                className={
                    styles.backgroundGlowTwo
                }
            />

            <div
                className={
                    styles.backgroundGrid
                }
            />


            <section
                className={
                    styles.authCard
                }
            >
                {/* ==========================================
                    LEFT
                ========================================== */}

                <div
                    className={
                        styles.authLeft
                    }
                >
                    <div
                        className={
                            styles.brand
                        }
                    >
                        <span
                            className={
                                styles.brandIcon
                            }
                        >
                            <BotMessageSquare
                                size={30}
                                strokeWidth={1.8}
                            />
                        </span>

                        <div>
                            <strong>
                                Internova
                            </strong>

                            <span>
                                AI Internship Assistant
                            </span>
                        </div>
                    </div>


                    <div
                        className={
                            styles.heroContent
                        }
                    >
                        <span
                            className={
                                styles.heroBadge
                            }
                        >
                            <Sparkles
                                size={15}
                            />

                            Nền tảng hỗ trợ thực tập
                            bằng AI
                        </span>


                        <h1>
                            Bắt đầu hành trình

                            <span>
                                {" "}
                                thực tập thông minh
                            </span>
                        </h1>


                        <p
                            className={
                                styles.authDesc
                            }
                        >
                            Internova hỗ trợ sinh viên
                            quản lý quá trình thực tập
                            và giúp giảng viên theo dõi,
                            đánh giá sinh viên.
                        </p>


                        <div
                            className={
                                styles.featureList
                            }
                        >
                            <div>
                                <CheckCircle2
                                    size={18}
                                />

                                <span>
                                    Tư vấn học vụ bằng RAG
                                </span>
                            </div>


                            <div>
                                <CheckCircle2
                                    size={18}
                                />

                                <span>
                                    Quản lý hồ sơ thực tập
                                </span>
                            </div>


                            <div>
                                <CheckCircle2
                                    size={18}
                                />

                                <span>
                                    Theo dõi báo cáo và
                                    tiến độ
                                </span>
                            </div>
                        </div>
                    </div>


                    <div
                        className={
                            styles.decorativeCard
                        }
                    >
                        <div
                            className={
                                styles.decorativeIcon
                            }
                        >
                            {role ===
                            "STUDENT" ? (
                                <GraduationCap
                                    size={22}
                                />
                            ) : (
                                <UserRoundCheck
                                    size={22}
                                />
                            )}
                        </div>


                        <div>
                            <strong>
                                {role ===
                                "STUDENT"
                                    ? "Không gian sinh viên"
                                    : "Không gian giảng viên"}
                            </strong>

                            <p>
                                {role ===
                                "STUDENT"
                                    ? (
                                        "Quản lý internship, "
                                        + "checklist và báo cáo."
                                    )
                                    : (
                                        "Theo dõi sinh viên, "
                                        + "tiến độ và báo cáo."
                                    )}
                            </p>
                        </div>
                    </div>
                </div>


                {/* ==========================================
                    RIGHT
                ========================================== */}

                <div
                    className={
                        styles.authRight
                    }
                >
                    <div
                        className={
                            styles.formHeader
                        }
                    >
                        <span
                            className={
                                styles.mobileLogo
                            }
                        >
                            <BotMessageSquare
                                size={24}
                            />
                        </span>


                        <p
                            className={
                                styles.welcomeText
                            }
                        >
                            Chào mừng trở lại
                        </p>


                        <h2>
                            Đăng nhập Internova
                        </h2>


                        <p>
                            Chọn chức vụ và nhập thông
                            tin tài khoản để tiếp tục.
                        </p>
                    </div>


                    {/* ======================================
                        ROLE
                    ====================================== */}

                    <div
                        className={
                            styles.formGroup
                        }
                    >
                        <label>
                            Chức vụ
                        </label>


                        <div
                            style={{
                                display:
                                    "grid",

                                gridTemplateColumns:
                                    "1fr 1fr",

                                gap:
                                    "10px",
                            }}
                        >
                            <button
                                type="button"

                                onClick={() =>
                                    setRole(
                                        "STUDENT"
                                    )
                                }

                                style={{
                                    height:
                                        "46px",

                                    border:
                                        role ===
                                        "STUDENT"
                                            ? "1px solid #2563eb"
                                            : "1px solid #dbe2ea",

                                    borderRadius:
                                        "10px",

                                    background:
                                        role ===
                                        "STUDENT"
                                            ? "#eff6ff"
                                            : "#ffffff",

                                    color:
                                        role ===
                                        "STUDENT"
                                            ? "#2563eb"
                                            : "#475569",

                                    cursor:
                                        "pointer",

                                    fontWeight:
                                        600,
                                }}
                            >
                                Sinh viên
                            </button>


                            <button
                                type="button"

                                onClick={() =>
                                    setRole(
                                        "LECTURER"
                                    )
                                }

                                style={{
                                    height:
                                        "46px",

                                    border:
                                        role ===
                                        "LECTURER"
                                            ? "1px solid #2563eb"
                                            : "1px solid #dbe2ea",

                                    borderRadius:
                                        "10px",

                                    background:
                                        role ===
                                        "LECTURER"
                                            ? "#eff6ff"
                                            : "#ffffff",

                                    color:
                                        role ===
                                        "LECTURER"
                                            ? "#2563eb"
                                            : "#475569",

                                    cursor:
                                        "pointer",

                                    fontWeight:
                                        600,
                                }}
                            >
                                Giảng viên
                            </button>
                        </div>
                    </div>


                    <form
                        className={
                            styles.loginForm
                        }
                        onSubmit={
                            handleSubmit
                        }
                    >
                        {/* EMAIL */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <label
                                htmlFor="email"
                            >
                                Địa chỉ email
                            </label>


                            <div
                                className={
                                    styles.inputWrapper
                                }
                            >
                                <Mail
                                    size={19}
                                />

                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="Nhập email"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>


                        {/* PASSWORD */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <div
                                className={
                                    styles.passwordLabel
                                }
                            >
                                <label
                                    htmlFor="password"
                                >
                                    Mật khẩu
                                </label>


                                <Link
                                    href="/auth/forgot-password"
                                >
                                    Quên mật khẩu?
                                </Link>
                            </div>


                            <div
                                className={
                                    styles.inputWrapper
                                }
                            >
                                <LockKeyhole
                                    size={19}
                                />

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

                                    className={
                                        styles.passwordToggle
                                    }

                                    onClick={() =>
                                        setShowPassword(
                                            current =>
                                                !current
                                        )
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff
                                            size={18}
                                        />
                                    ) : (
                                        <Eye
                                            size={18}
                                        />
                                    )}
                                </button>
                            </div>
                        </div>


                        {error && (
                            <div
                                className={
                                    styles.errorMessage
                                }
                            >
                                {error}
                            </div>
                        )}


                        <label
                            className={
                                styles.rememberRow
                            }
                        >
                            <input
                                type="checkbox"
                                name="remember"
                            />

                            <span>
                                Ghi nhớ đăng nhập
                            </span>
                        </label>


                        <button
                            type="submit"

                            className={
                                styles.loginButton
                            }

                            disabled={
                                isLoading
                            }
                        >
                            {isLoading ? (
                                <>
                                    <span
                                        className={
                                            styles.loadingSpinner
                                        }
                                    />

                                    Đang đăng nhập...
                                </>
                            ) : (
                                <>
                                    Đăng nhập

                                    <ArrowRight
                                        size={18}
                                    />
                                </>
                            )}
                        </button>
                    </form>


                    {/* Không còn Google */}


                    <div
                        className={
                            styles.authSwitch
                        }
                    >
                        Chưa có tài khoản sinh viên?

                        <Link
                            href="/auth/register"
                        >
                            Đăng ký ngay
                        </Link>
                    </div>


                    <p
                        className={
                            styles.terms
                        }
                    >
                        Trang đăng ký công khai chỉ
                        dành cho sinh viên. Tài khoản
                        giảng viên do hệ thống cấp.
                    </p>
                </div>
            </section>
        </main>
    );
}
