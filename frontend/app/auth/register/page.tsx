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
    UserRound,
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
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


type Gender =
    | "MALE"
    | "FEMALE"
    | "OTHER";


type RegisterFormState = {
    firstName: string;
    lastName: string;
    studentCode: string;
    gender: Gender | "";
    email: string;
    password: string;
    confirmPassword: string;
};


const INITIAL_FORM: RegisterFormState = {
    firstName: "",
    lastName: "",
    studentCode: "",
    gender: "",
    email: "",
    password: "",
    confirmPassword: "",
};


export default function RegisterPage() {
    const router =
        useRouter();


    const [
        form,
        setForm,
    ] =
        useState<RegisterFormState>(
            INITIAL_FORM
        );


    const [
        showPassword,
        setShowPassword,
    ] =
        useState(false);


    const [
        showConfirmPassword,
        setShowConfirmPassword,
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


    const [
        successMessage,
        setSuccessMessage,
    ] =
        useState("");


    function handleChange(
        event:
            React.ChangeEvent<
                HTMLInputElement |
                HTMLSelectElement
            >
    ) {
        const {
            name,
            value,
        } =
            event.target;


        setForm(
            previous => ({
                ...previous,
                [name]: value,
            })
        );
    }


    function handleEmailChange(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        let value =
            event.target.value
                .trimStart()
                .toLowerCase();

        value = value.replace(
            /@vinuni\.edu\.vn$/i,
            ""
        );

        value = value.replace(
            /\s/g,
            ""
        );

        setForm(
            previous => ({
                ...previous,
                email: value,
            })
        );
    }


    function validateForm() {
        const firstName =
            form.firstName.trim();

        const lastName =
            form.lastName.trim();

        const studentCode =
            form.studentCode.trim();

        const email =
            form.email.trim();


        if (!firstName) {
            return "Vui lòng nhập tên.";
        }


        if (!lastName) {
            return "Vui lòng nhập họ.";
        }


        if (!studentCode) {
            return "Vui lòng nhập mã số sinh viên.";
        }


        if (!email) {
            return "Vui lòng nhập tên tài khoản email.";
        }

        if (
            !/^[a-zA-Z0-9._-]+$/.test(
                email
            )
        ) {
            return (
                "Tên tài khoản email chỉ được chứa "
                + "chữ, số, dấu chấm, gạch dưới hoặc gạch ngang."
            );
        }


        if (
            form.password.length <
            8
        ) {
            return (
                "Mật khẩu phải có "
                + "ít nhất 8 ký tự."
            );
        }


        if (
            form.password !==
            form.confirmPassword
        ) {
            return (
                "Mật khẩu xác nhận "
                + "không khớp."
            );
        }


        return null;
    }


    async function handleSubmit(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();


        setError("");
        setSuccessMessage("");


        const validationError =
            validateForm();


        if (validationError) {
            setError(
                validationError
            );

            return;
        }


        try {
            setIsLoading(
                true
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/auth/register`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                firstName:
                                    form.firstName.trim(),

                                lastName:
                                    form.lastName.trim(),

                                studentCode:
                                    form.studentCode
                                        .trim()
                                        .toUpperCase(),

                                gender:
                                    form.gender ||
                                    null,

                                email:
                                    `${form.email
                                        .trim()
                                        .toLowerCase()}@vinuni.edu.vn`,

                                password:
                                    form.password,
                            }),
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.detail ??
                    "Đăng ký thất bại."
                );
            }


            /*
             * Backend trả accessToken luôn.
             * Đăng ký thành công -> đăng nhập luôn.
             */

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


            setSuccessMessage(
                "Đăng ký thành công."
            );


            /*
             * Chỉ STUDENT được đăng ký
             * từ trang public.
             */

            if (
                data.user?.role !==
                "STUDENT"
            ) {
                localStorage.removeItem(
                    "internova_access_token"
                );

                localStorage.removeItem(
                    "internova_user"
                );


                throw new Error(
                    "Tài khoản đăng ký không hợp lệ."
                );
            }


            router.push(
                "/student/dashboard"
            );


        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Đăng ký thất bại."
            );

        } finally {
            setIsLoading(
                false
            );
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

                            Dành cho sinh viên
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
                            Tạo tài khoản sinh viên
                            để quản lý hồ sơ thực tập,
                            báo cáo, checklist và sử
                            dụng trợ lý AI của
                            Internova.
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
                                    Quản lý hồ sơ và tiến độ
                                </span>
                            </div>


                            <div>
                                <CheckCircle2
                                    size={18}
                                />

                                <span>
                                    Theo dõi báo cáo thực tập
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
                            <GraduationCap
                                size={22}
                            />
                        </div>


                        <div>
                            <strong>
                                Tài khoản sinh viên
                            </strong>

                            <p>
                                Trang đăng ký này chỉ
                                tạo tài khoản STUDENT.
                                Lecturer và Admin không
                                thể đăng ký tại đây.
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
                            Tạo tài khoản mới
                        </p>


                        <h2>
                            Đăng ký Internova
                        </h2>


                        <p>
                            Điền thông tin sinh viên
                            để bắt đầu sử dụng hệ
                            thống.
                        </p>
                    </div>


                    {/* ======================================
                        REGISTER FORM
                    ====================================== */}

                    <form
                        className={
                            styles.loginForm
                        }
                        onSubmit={
                            handleSubmit
                        }
                    >
                        {/* FIRST NAME */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <label
                                htmlFor="firstName"
                            >
                                Tên
                            </label>


                            <div
                                className={
                                    styles.inputWrapper
                                }
                            >
                                <UserRound
                                    size={19}
                                />

                                <input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    placeholder="Nhập tên của bạn"
                                    value={
                                        form.firstName
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    autoComplete="given-name"
                                    required
                                />
                            </div>
                        </div>


                        {/* LAST NAME */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <label
                                htmlFor="lastName"
                            >
                                Họ
                            </label>


                            <div
                                className={
                                    styles.inputWrapper
                                }
                            >
                                <UserRound
                                    size={19}
                                />

                                <input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    placeholder="Nhập họ của bạn "
                                    value={
                                        form.lastName
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    autoComplete="family-name"
                                    required
                                />
                            </div>
                        </div>


                        {/* STUDENT CODE */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <label
                                htmlFor="studentCode"
                            >
                                Mã số sinh viên
                            </label>


                            <div
                                className={
                                    styles.inputWrapper
                                }
                            >
                                <GraduationCap
                                    size={19}
                                />

                                <input
                                    id="studentCode"
                                    name="studentCode"
                                    type="text"
                                    placeholder="Ví dụ: 2A202601057"
                                    value={
                                        form.studentCode
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    autoComplete="off"
                                    required
                                />
                            </div>

                            <p
                                style={{
                                    margin: "6px 0 0",
                                    color: "#64748b",
                                    fontSize: "12px",
                                    lineHeight: 1.5,
                                }}
                            >
                                Mã số sinh viên phải có sẵn trong dữ liệu nhà trường và chưa được liên kết với tài khoản nào.
                            </p>
                        </div>


                        {/* GENDER */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <label
                                htmlFor="gender"
                            >
                                Giới tính
                            </label>


                            <div
                                className={
                                    styles.inputWrapper
                                }
                            >
                                <UserRound
                                    size={19}
                                />

                                <select
                                    id="gender"
                                    name="gender"
                                    value={
                                        form.gender
                                    }
                                    onChange={
                                        handleChange
                                    }
                                >
                                    <option value="">
                                        Không chọn
                                    </option>

                                    <option value="MALE">
                                        Nam
                                    </option>

                                    <option value="FEMALE">
                                        Nữ
                                    </option>

                                    <option value="OTHER">
                                        Khác
                                    </option>
                                </select>
                            </div>
                        </div>


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
                                    type="text"
                                    inputMode="email"
                                    placeholder="ten.tai.khoan"
                                    value={
                                        form.email
                                    }
                                    onChange={
                                        handleEmailChange
                                    }
                                    autoComplete="email"
                                    style={{
                                        minWidth: 0,
                                        flex: 1,
                                    }}
                                    required
                                />

                                <span
                                    aria-hidden="true"
                                    style={{
                                        color: "#64748b",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    @vinuni.edu.vn
                                </span>
                            </div>
                        </div>


                        {/* PASSWORD */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <label
                                htmlFor="password"
                            >
                                Mật khẩu
                            </label>


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
                                    placeholder="Ít nhất 8 ký tự"
                                    value={
                                        form.password
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    autoComplete="new-password"
                                    required
                                />


                                <button
                                    type="button"
                                    className={
                                        styles.passwordToggle
                                    }
                                    onClick={() =>
                                        setShowPassword(
                                            previous =>
                                                !previous
                                        )
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Ẩn mật khẩu"
                                            : "Hiện mật khẩu"
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


                        {/* CONFIRM PASSWORD */}

                        <div
                            className={
                                styles.formGroup
                            }
                        >
                            <label
                                htmlFor="confirmPassword"
                            >
                                Xác nhận mật khẩu
                            </label>


                            <div
                                className={
                                    styles.inputWrapper
                                }
                            >
                                <LockKeyhole
                                    size={19}
                                />

                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={
                                        showConfirmPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="Nhập lại mật khẩu"
                                    value={
                                        form.confirmPassword
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    autoComplete="new-password"
                                    required
                                />


                                <button
                                    type="button"
                                    className={
                                        styles.passwordToggle
                                    }
                                    onClick={() =>
                                        setShowConfirmPassword(
                                            previous =>
                                                !previous
                                        )
                                    }
                                    aria-label={
                                        showConfirmPassword
                                            ? "Ẩn mật khẩu"
                                            : "Hiện mật khẩu"
                                    }
                                >
                                    {showConfirmPassword ? (
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


                        {/* ERROR */}

                        {error && (
                            <div
                                role="alert"
                                style={{
                                    padding:
                                        "10px 12px",

                                    borderRadius:
                                        "8px",

                                    background:
                                        "#fef2f2",

                                    color:
                                        "#dc2626",

                                    fontSize:
                                        "13px",
                                }}
                            >
                                {error}
                            </div>
                        )}


                        {/* SUCCESS */}

                        {successMessage && (
                            <div
                                style={{
                                    padding:
                                        "10px 12px",

                                    borderRadius:
                                        "8px",

                                    background:
                                        "#ecfdf5",

                                    color:
                                        "#047857",

                                    fontSize:
                                        "13px",
                                }}
                            >
                                {successMessage}
                            </div>
                        )}


                        {/* TERMS */}

                        <label
                            className={
                                styles.rememberRow
                            }
                        >
                            <input
                                type="checkbox"
                                required
                            />

                            <span>
                                Tôi đồng ý với Điều khoản
                                sử dụng và Chính sách
                                bảo mật.
                            </span>
                        </label>


                        {/* SUBMIT */}

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

                                    Đang đăng ký...
                                </>
                            ) : (
                                <>
                                    Tạo tài khoản

                                    <ArrowRight
                                        size={18}
                                    />
                                </>
                            )}
                        </button>
                    </form>


                    {/* ======================================
                        GOOGLE
                    ====================================== */}

                   


                    {/* ======================================
                        LOGIN LINK
                    ====================================== */}

                    <div
                        className={
                            styles.authSwitch
                        }
                    >
                        Đã có tài khoản?

                        <Link
                            href="/auth/login"
                        >
                            Đăng nhập ngay
                        </Link>
                    </div>


                    <p
                        className={
                            styles.terms
                        }
                    >
                        Tài khoản tạo từ trang này
                        luôn có vai trò{" "}
                        <strong>
                            STUDENT
                        </strong>.
                    </p>
                </div>
            </section>
        </main>
    );
}