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
    GraduationCap,
    LockKeyhole,
    Mail,
    ShieldCheck,
    UserRound,
} from "lucide-react";

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
    const router = useRouter();

    const [form, setForm] =
        useState<RegisterFormState>(INITIAL_FORM);

    const [showPassword, setShowPassword] =
        useState(false);

    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [isLoading, setIsLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");

    const [emailError, setEmailError] =
        useState("");

    function handleChange(
        event:
            React.ChangeEvent<
                HTMLInputElement |
                HTMLSelectElement
            >
    ) {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value,
        }));
    }

    function validateEmailLocalPart(
        value: string
    ) {
        if (!value) {
            return "";
        }

        if (value.length > 64) {
            return "Phần trước @ không được vượt quá 64 ký tự.";
        }

        if (value.includes("@")) {
            return (
                "Chỉ nhập phần trước @vinuni.edu.vn, " +
                "không nhập ký tự @."
            );
        }

        if (!/^[a-zA-Z0-9._%+-]+$/.test(value)) {
            return (
                "Tên tài khoản chỉ được chứa chữ, số " +
                "và các ký tự . _ % + -"
            );
        }

        if (
            value.startsWith(".") ||
            value.endsWith(".")
        ) {
            return (
                "Tên tài khoản không được bắt đầu " +
                "hoặc kết thúc bằng dấu chấm."
            );
        }

        if (value.includes("..")) {
            return (
                "Tên tài khoản không được chứa " +
                "hai dấu chấm liên tiếp."
            );
        }

        return "";
    }

    function handleEmailChange(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const value =
            event.target.value
                .trimStart()
                .toLowerCase()
                .replace(/\s/g, "");

        setForm(previous => ({
            ...previous,
            email: value,
        }));

        setEmailError(
            validateEmailLocalPart(value)
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

        const emailValidationError =
            validateEmailLocalPart(email);

        if (emailValidationError) {
            return emailValidationError;
        }

        if (form.password.length < 8) {
            return (
                "Mật khẩu phải có " +
                "ít nhất 8 ký tự."
            );
        }

        if (
            form.password !==
            form.confirmPassword
        ) {
            return (
                "Mật khẩu xác nhận " +
                "không khớp."
            );
        }

        return null;
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setError("");
        setSuccessMessage("");

        const validationError =
            validateForm();

        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setIsLoading(true);

            const response = await fetch(
                `${API_URL}/api/v1/auth/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        firstName:
                            form.firstName.trim(),
                        lastName:
                            form.lastName.trim(),
                        studentCode:
                            form.studentCode
                                .trim()
                                .toUpperCase(),
                        gender:
                            form.gender || null,
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

            localStorage.setItem(
                "internova_access_token",
                data.accessToken
            );

            localStorage.setItem(
                "internova_user",
                JSON.stringify(data.user)
            );

            setSuccessMessage(
                "Đăng ký thành công."
            );

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
            setIsLoading(false);
        }
    }

    return (
        <main className={styles.authPage}>
            <section
                className={styles.visualPanel}
                aria-label="Internova university registration experience"
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

                <div
                    className={styles.videoOverlay}
                    aria-hidden="true"
                />
                <div
                    className={styles.videoTexture}
                    aria-hidden="true"
                />
                <div
                    className={styles.motionLineOne}
                    aria-hidden="true"
                />
                <div
                    className={styles.motionLineTwo}
                    aria-hidden="true"
                />

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
                        <span>
                            AI Student Support Platform
                        </span>
                    </span>
                </header>

                <div
                    className={styles.visualStatus}
                    aria-hidden="true"
                >
                    <span className={styles.statusDot} />
                    <span>
                        CAMPUS ACCESS · READY
                    </span>
                </div>

                <div className={styles.visualContent}>
                    <p className={styles.eyebrow}>
                        CREATE YOUR INTERNOVA ACCOUNT
                    </p>

                    <h1>
                        Bắt đầu hành trình
                        <span>
                            sinh viên thông minh hơn.
                        </span>
                    </h1>

                    <p className={styles.visualDescription}>
                        Tạo tài khoản để kết nối hồ sơ,
                        thực tập, tiến độ và trợ lý AI trong
                        một không gian học tập thống nhất.
                    </p>

                    <div
                        className={styles.accessNote}
                        aria-hidden="true"
                    >
                        <span className={styles.accessIndex}>
                            01
                        </span>
                        <span className={styles.accessRule} />
                        <span>
                            Student registration portal
                        </span>
                    </div>
                </div>

                <div className={styles.visualMeta}>
                    <span>VINUNI · INTERNOVA</span>
                    <span>STUDENT ACCESS / 2026</span>
                </div>
            </section>

            <section className={styles.authPanel}>
                <div
                    className={styles.authAmbient}
                    aria-hidden="true"
                />

                <Link
                    href="/"
                    className={styles.backHome}
                >
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
                        <span>
                            AI Student Support Platform
                        </span>
                    </div>
                </div>

                <div className={styles.authInner}>
                    <div className={styles.portalTag}>
                        <span
                            className={styles.portalTagDot}
                        />
                        STUDENT REGISTRATION
                    </div>

                    <div className={styles.formHeader}>
                        <h2>Tạo tài khoản Internova.</h2>
                        <p>
                            Đăng ký bằng email VinUni để bắt đầu sử dụng
                            không gian hỗ trợ sinh viên của bạn.
                        </p>
                    </div>

                    <form
                        className={styles.loginForm}
                        onSubmit={handleSubmit}
                    >
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label htmlFor="firstName">
                                    Tên
                                </label>
                                <div className={styles.inputWrapper}>
                                    <UserRound size={18} aria-hidden="true" />
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        placeholder="Nhập tên"
                                        value={form.firstName}
                                        onChange={handleChange}
                                        autoComplete="given-name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="lastName">
                                    Họ
                                </label>
                                <div className={styles.inputWrapper}>
                                    <UserRound size={18} aria-hidden="true" />
                                    <input
                                        id="lastName"
                                        name="lastName"
                                        type="text"
                                        placeholder="Nhập họ"
                                        value={form.lastName}
                                        onChange={handleChange}
                                        autoComplete="family-name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="studentCode">
                                    Mã số sinh viên
                                </label>
                                <div className={styles.inputWrapper}>
                                    <GraduationCap size={18} aria-hidden="true" />
                                    <input
                                        id="studentCode"
                                        name="studentCode"
                                        type="text"
                                        placeholder="2A202601057"
                                        value={form.studentCode}
                                        onChange={handleChange}
                                        autoComplete="off"
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="gender">
                                    Giới tính
                                </label>
                                <div className={styles.inputWrapper}>
                                    <UserRound size={18} aria-hidden="true" />
                                    <select
                                        id="gender"
                                        name="gender"
                                        value={form.gender}
                                        onChange={handleChange}
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

                            <div
                                className={`${styles.formGroup} ${styles.formGroupFull}`}
                            >
                                <label htmlFor="email">
                                    Địa chỉ email VinUni
                                </label>
                                <div className={styles.inputWrapper}>
                                    <Mail size={18} aria-hidden="true" />
                                    <input
                                        id="email"
                                        name="email"
                                        type="text"
                                        inputMode="email"
                                        placeholder="ten.tai.khoan"
                                        value={form.email}
                                        onChange={handleEmailChange}
                                        autoComplete="email"
                                        maxLength={64}
                                        required
                                    />
                                    <span
                                        className={styles.emailDomain}
                                        aria-hidden="true"
                                    >
                                        @vinuni.edu.vn
                                    </span>
                                </div>

                                {emailError && (
                                    <p
                                        className={styles.fieldError}
                                        role="alert"
                                    >
                                        {emailError}
                                    </p>
                                )}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="password">
                                    Mật khẩu
                                </label>
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
                                        placeholder="Ít nhất 8 ký tự"
                                        value={form.password}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() =>
                                            setShowPassword(
                                                previous => !previous
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

                            <div className={styles.formGroup}>
                                <label htmlFor="confirmPassword">
                                    Xác nhận mật khẩu
                                </label>
                                <div className={styles.inputWrapper}>
                                    <LockKeyhole size={18} aria-hidden="true" />
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        placeholder="Nhập lại mật khẩu"
                                        value={form.confirmPassword}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() =>
                                            setShowConfirmPassword(
                                                previous => !previous
                                            )
                                        }
                                        aria-label={
                                            showConfirmPassword
                                                ? "Ẩn mật khẩu"
                                                : "Hiện mật khẩu"
                                        }
                                        aria-pressed={showConfirmPassword}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
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

                        {successMessage && (
                            <div
                                className={styles.successMessage}
                                role="status"
                                aria-live="polite"
                            >
                                {successMessage}
                            </div>
                        )}

                        <label className={styles.rememberRow}>
                            <input
                                type="checkbox"
                                required
                            />
                            <span>
                                Tôi đồng ý với Điều khoản sử dụng và
                                Chính sách bảo mật.
                            </span>
                        </label>

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
                                    Đang đăng ký...
                                </>
                            ) : (
                                <>
                                    Tạo tài khoản
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className={styles.authSwitch}>
                        <span>Đã có tài khoản?</span>
                        <Link href="/auth/login">
                            Đăng nhập ngay
                        </Link>
                    </div>

                    <div className={styles.securityNote}>
                        <span className={styles.securityIcon}>
                            <ShieldCheck size={17} />
                        </span>
                        <div>
                            <strong>
                                Student account only
                            </strong>
                            <p>
                                Trang đăng ký công khai chỉ tạo tài khoản
                                sinh viên. Giảng viên và quản trị viên do
                                hệ thống cấp quyền riêng.
                            </p>
                        </div>
                    </div>
                </div>

                <footer className={styles.authFooter}>
                    <span>© 2026 Internova</span>
                    <span>Protected registration</span>
                </footer>
            </section>
        </main>
    );
}
