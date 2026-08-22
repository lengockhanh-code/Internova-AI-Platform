"use client";

import Link from "next/link";

import {
    ArrowLeft,
    ArrowRight,
    BotMessageSquare,
    CheckCircle2,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    Sparkles,
} from "lucide-react";

import {
    FormEvent,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import styles from "./page.module.css";


const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";



export default function LoginPage() {
    const router =
        useRouter();


    const [
        showPassword,
        setShowPassword,
    ] =
        useState(false);



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


            if (
                data.user?.role !== "STUDENT"
                &&
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
                JSON.stringify(
                    data.user
                )
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

            if (
                data.user.role ===
                "LECTURER"
            ) {
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
                            <CheckCircle2
                                size={22}
                            />
                        </div>


                        <div>
                            <strong>
                                Một cổng đăng nhập duy nhất
                            </strong>

                            <p>
                                Internova tự nhận diện tài khoản sinh viên hoặc giảng viên sau khi xác thực.
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
                            Nhập email và mật khẩu. Hệ thống sẽ tự động nhận diện vai trò của tài khoản.
                        </p>
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
