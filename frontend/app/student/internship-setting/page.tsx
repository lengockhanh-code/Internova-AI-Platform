"use client";

import {
    ChangeEvent,
    FormEvent,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";

import {
    Bell,
    Camera,
    CheckCircle2,
    GraduationCap,
    LoaderCircle,
    Lock,
    LogOut,
    Mail,
    Save,
    ShieldCheck,
    Trash2,
    UserRound,
    X,
} from "lucide-react";

import styles from "./page.module.css";


const CONFIGURED_API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


function getApiUrl() {
    if (typeof window === "undefined") {
        return CONFIGURED_API_URL;
    }

    try {
        const configured =
            new URL(CONFIGURED_API_URL);

        const pageHost =
            window.location.hostname;

        const configuredIsLocal =
            configured.hostname === "localhost" ||
            configured.hostname === "127.0.0.1";

        const pageIsLocal =
            pageHost === "localhost" ||
            pageHost === "127.0.0.1";

        if (configuredIsLocal && !pageIsLocal) {
            configured.hostname = pageHost;
        }

        return configured.origin;

    } catch {
        return CONFIGURED_API_URL;
    }
}


type ActiveTab =
    | "profile"
    | "account"
    | "notifications";


type ProfileSettings = {
    id: number;

    fullName: string;

    studentCode:
    string | null;

    email: string;

    phone:
    string | null;

    faculty:
    string | null;

    major:
    string | null;

    cohort:
    string | null;

    hasAvatar:
    boolean;
};


type AccountSettings = {
    email: string;

    emailVerified: boolean;

    authProvider: string;

    canChangePassword:
    boolean;
};


type NotificationSettings = {
    reportDeadline:
    boolean;

    lecturerFeedback:
    boolean;

    internshipStatus:
    boolean;

    emailNotifications:
    boolean;
};


type SettingsData = {
    profile:
    ProfileSettings;

    account:
    AccountSettings;

    notifications:
    NotificationSettings;
};


export default function SettingsPage() {
    const router =
        useRouter();


    const [
        activeTab,
        setActiveTab,
    ] =
        useState<ActiveTab>(
            "profile"
        );


    const [
        data,
        setData,
    ] =
        useState<
            SettingsData |
            null
        >(null);


    const [
        profileForm,
        setProfileForm,
    ] =
        useState({
            fullName: "",
            phone: "",
            faculty: "",
            major: "",
            cohort: "",
        });


    const [
        notifications,
        setNotifications,
    ] =
        useState<NotificationSettings>({
            reportDeadline: true,
            lecturerFeedback: true,
            internshipStatus: true,
            emailNotifications: false,
        });


    const [
        avatarUrl,
        setAvatarUrl,
    ] =
        useState<
            string | null
        >(null);


    const [
        loading,
        setLoading,
    ] =
        useState(true);


    const [
        saving,
        setSaving,
    ] =
        useState(false);


    const [
        savedMessage,
        setSavedMessage,
    ] =
        useState("");


    const [
        error,
        setError,
    ] =
        useState("");


    const [
        showPasswordModal,
        setShowPasswordModal,
    ] =
        useState(false);


    function getToken() {
        return localStorage.getItem(
            "internova_access_token"
        );
    }


    function redirectLogin() {
        localStorage.removeItem(
            "internova_access_token"
        );

        localStorage.removeItem(
            "internova_user"
        );

        window.alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");

        router.push(
            "/auth/login"
        );
    }


    function handleLogout() {
        const confirmed =
            window.confirm(
                "Bạn có chắc chắn muốn đăng xuất?"
            );

        if (!confirmed) {
            return;
        }

        redirectLogin();
    }


    function showSaved(
        message: string
    ) {
        setSavedMessage(
            message
        );


        window.setTimeout(
            () => {
                setSavedMessage(
                    ""
                );
            },
            2500
        );
    }


    async function loadAvatar(
        token: string
    ) {
        try {
            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/settings/avatar`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        cache:
                            "no-store",
                    }
                );


            if (
                response.status ===
                404
            ) {
                setAvatarUrl(
                    null
                );

                return;
            }


            if (!response.ok) {
                return;
            }


            const blob =
                await response.blob();


            const url =
                URL.createObjectURL(
                    blob
                );


            setAvatarUrl(
                (
                    previous
                ) => {
                    if (
                        previous
                    ) {
                        URL.revokeObjectURL(
                            previous
                        );
                    }

                    return url;
                }
            );


        } catch {
            setAvatarUrl(
                null
            );
        }
    }


    async function loadSettings() {
        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {
            setLoading(
                true
            );

            setError(
                ""
            );


            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/settings`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        cache:
                            "no-store",
                    }
                );


            const result =
                await response.json();


            if (
                response.status ===
                401
            ) {
                redirectLogin();

                return;
            }


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể tải cài đặt."
                );
            }


            const settings =
                result as SettingsData;


            setData(
                settings
            );


            setProfileForm({
                fullName:
                    settings.profile
                        .fullName,

                phone:
                    settings.profile
                        .phone ??
                    "",

                faculty:
                    settings.profile
                        .faculty ??
                    "",

                major:
                    settings.profile
                        .major ??
                    "",

                cohort:
                    settings.profile
                        .cohort ??
                    "",
            });


            setNotifications(
                settings.notifications
            );


            if (
                settings.profile
                    .hasAvatar
            ) {
                await loadAvatar(
                    token
                );

            } else {
                setAvatarUrl(
                    null
                );
            }


        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Có lỗi xảy ra."
            );

        } finally {
            setLoading(
                false
            );
        }
    }


    useEffect(() => {
        // Initial client-side API synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadSettings();
    }, []);


    useEffect(() => {
        return () => {
            if (avatarUrl) {
                URL.revokeObjectURL(avatarUrl);
            }
        };
    }, [avatarUrl]);


    /* ========================================================
       PROFILE
    ======================================================== */

    function handleProfileChange(
        event:
            ChangeEvent<HTMLInputElement>
    ) {
        const {
            name,
            value,
        } = event.target;


        setProfileForm(
            (
                previous
            ) => ({
                ...previous,

                [name]:
                    value,
            })
        );
    }


    async function saveProfile() {
        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        if (
            !profileForm
                .fullName
                .trim()
        ) {
            alert(
                "Họ và tên không được để trống."
            );

            return;
        }


        try {
            setSaving(
                true
            );


            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/settings/profile`,
                    {
                        method:
                            "PUT",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            JSON.stringify({
                                fullName:
                                    profileForm
                                        .fullName
                                        .trim(),

                                phone:
                                    profileForm.phone
                                        .trim() ||
                                    null,

                                faculty:
                                    profileForm.faculty
                                        .trim() ||
                                    null,

                                major:
                                    profileForm.major
                                        .trim() ||
                                    null,

                                cohort:
                                    profileForm.cohort
                                        .trim() ||
                                    null,
                            }),
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể lưu hồ sơ."
                );
            }


            setData(
                result
            );


            showSaved(
                "Đã lưu hồ sơ"
            );


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể lưu hồ sơ."
            );

        } finally {
            setSaving(
                false
            );
        }
    }


    /* ========================================================
       NOTIFICATIONS
    ======================================================== */

    function toggleNotification(
        key:
            keyof NotificationSettings
    ) {
        setNotifications(
            (
                previous
            ) => ({
                ...previous,

                [key]:
                    !previous[key],
            })
        );
    }


    async function saveNotifications() {
        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {
            setSaving(
                true
            );


            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/settings/notifications`,
                    {
                        method:
                            "PUT",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            JSON.stringify(
                                notifications
                            ),
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể lưu cài đặt thông báo."
                );
            }


            setNotifications(
                result.notifications
            );


            showSaved(
                "Đã lưu cài đặt thông báo"
            );


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể lưu thông báo."
            );

        } finally {
            setSaving(
                false
            );
        }
    }


    if (loading) {
        return (
            <div
                className={
                    styles.layout
                }
            >
                <Sidebar />

                <div
                    className={
                        styles.main
                    }
                >
                    <Header />

                    <main
                        className={
                            styles.statePage
                        }
                    >
                        <LoaderCircle
                            size={34}
                            className={
                                styles.spinner
                            }
                        />

                        <p>
                            Đang tải cài đặt...
                        </p>
                    </main>
                </div>
            </div>
        );
    }


    if (
        error ||
        !data
    ) {
        return (
            <div
                className={
                    styles.layout
                }
            >
                <Sidebar />

                <div
                    className={
                        styles.main
                    }
                >
                    <Header />

                    <main
                        className={
                            styles.statePage
                        }
                    >
                        <h2>
                            Không thể tải
                            cài đặt
                        </h2>

                        <p>
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                void loadSettings()
                            }
                        >
                            Thử lại
                        </button>
                    </main>
                </div>
            </div>
        );
    }


    return (
        <div
            className={
                styles.layout
            }
        >
            <Sidebar />


            <div
                className={
                    styles.main
                }
            >
                <Header />


                <main
                    className={
                        styles.page
                    }
                >
                    <section
                        className={
                            styles.pageHeader
                        }
                    >
                        <div>
                            <h1>
                                Cài đặt
                            </h1>

                            <p>
                                Quản lý hồ sơ cá
                                nhân, tài khoản và
                                tùy chọn thông báo
                                của bạn.
                            </p>
                        </div>


                        {savedMessage && (
                            <div
                                className={
                                    styles.savedBadge
                                }
                            >
                                <CheckCircle2
                                    size={17}
                                />

                                {
                                    savedMessage
                                }
                            </div>
                        )}
                    </section>


                    <section
                        className={
                            styles.settingsLayout
                        }
                    >
                        <aside
                            className={
                                styles.settingsMenu
                            }
                        >
                            <button
                                type="button"
                                className={`${styles.settingsMenuItem} ${activeTab ===
                                        "profile"
                                        ? styles.active
                                        : ""
                                    }`}
                                onClick={() =>
                                    setActiveTab(
                                        "profile"
                                    )
                                }
                            >
                                <UserRound
                                    size={18}
                                />

                                Hồ sơ cá nhân
                            </button>


                            <button
                                type="button"
                                className={`${styles.settingsMenuItem} ${activeTab ===
                                        "account"
                                        ? styles.active
                                        : ""
                                    }`}
                                onClick={() =>
                                    setActiveTab(
                                        "account"
                                    )
                                }
                            >
                                <ShieldCheck
                                    size={18}
                                />

                                Tài khoản &
                                Bảo mật
                            </button>


                            <button
                                type="button"
                                className={`${styles.settingsMenuItem} ${activeTab ===
                                        "notifications"
                                        ? styles.active
                                        : ""
                                    }`}
                                onClick={() =>
                                    setActiveTab(
                                        "notifications"
                                    )
                                }
                            >
                                <Bell
                                    size={18}
                                />

                                Thông báo
                            </button>
                        </aside>


                        <section
                            className={
                                styles.settingsContent
                            }
                        >
                            {activeTab ===
                                "profile" && (
                                    <ProfileSettingsView
                                        profile={
                                            data.profile
                                        }
                                        form={
                                            profileForm
                                        }
                                        avatarUrl={
                                            avatarUrl
                                        }
                                        saving={
                                            saving
                                        }
                                        onChange={
                                            handleProfileChange
                                        }
                                        onSave={
                                            saveProfile
                                        }
                                        onReload={
                                            loadSettings
                                        }
                                    />
                                )}


                            {activeTab ===
                                "account" && (
                                    <AccountSettingsView
                                        account={
                                            data.account
                                        }
                                        onOpenPassword={() =>
                                            setShowPasswordModal(
                                                true
                                            )
                                        }
                                        onLogout={
                                            handleLogout
                                        }
                                    />
                                )}


                            {activeTab ===
                                "notifications" && (
                                    <NotificationSettingsView
                                        settings={
                                            notifications
                                        }
                                        saving={
                                            saving
                                        }
                                        onToggle={
                                            toggleNotification
                                        }
                                        onSave={
                                            saveNotifications
                                        }
                                    />
                                )}
                        </section>
                    </section>
                </main>
            </div>


            {showPasswordModal && (
                <PasswordModal
                    onClose={() =>
                        setShowPasswordModal(
                            false
                        )
                    }
                    onSuccess={() => {
                        setShowPasswordModal(
                            false
                        );

                        showSaved(
                            "Đổi mật khẩu thành công"
                        );
                    }}
                />
            )}
        </div>
    );
}


/* ============================================================
   PROFILE
============================================================ */

function ProfileSettingsView({
    profile,
    form,
    avatarUrl,
    saving,
    onChange,
    onSave,
    onReload,
}: {
    profile:
    ProfileSettings;

    form: {
        fullName: string;
        phone: string;
        faculty: string;
        major: string;
        cohort: string;
    };

    avatarUrl:
    string | null;

    saving:
    boolean;

    onChange:
    (
        event:
            ChangeEvent<HTMLInputElement>
    ) => void;

    onSave:
    () => Promise<void>;

    onReload:
    () => Promise<void>;
}) {
    const inputRef =
        useRef<HTMLInputElement>(
            null
        );


    async function uploadAvatar(
        event:
            ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0];


        if (!file) {
            return;
        }


        if (
            ![
                "image/jpeg",
                "image/png",
                "image/webp",
            ].includes(
                file.type
            )
        ) {
            alert(
                "Chỉ hỗ trợ JPG, PNG hoặc WEBP."
            );

            return;
        }


        if (
            file.size >
            5 *
            1024 *
            1024
        ) {
            alert(
                "Ảnh không được vượt quá 5MB."
            );

            return;
        }


        const token =
            localStorage.getItem(
                "internova_access_token"
            );


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        const response =
            await fetch(
                `${getApiUrl()}/api/v1/student/settings/avatar`,
                {
                    method:
                        "POST",

                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                    },

                    body:
                        formData,
                }
            );


        const result =
            await response.json();


        if (!response.ok) {
            alert(
                result.detail ??
                "Không thể tải ảnh."
            );

            return;
        }


        await onReload();
    }


    async function removeAvatar() {
        if (
            !window.confirm(
                "Xóa ảnh đại diện hiện tại?"
            )
        ) {
            return;
        }


        const token =
            localStorage.getItem(
                "internova_access_token"
            );


        const response =
            await fetch(
                `${getApiUrl()}/api/v1/student/settings/avatar`,
                {
                    method:
                        "DELETE",

                    headers: {
                        Authorization:
                            `Bearer ${token}`,
                    },
                }
            );


        const result =
            await response.json();


        if (!response.ok) {
            alert(
                result.detail ??
                "Không thể xóa ảnh."
            );

            return;
        }


        await onReload();
    }


    return (
        <div
            className={
                styles.settingsCard
            }
        >
            <div
                className={
                    styles.cardHeader
                }
            >
                <div>
                    <h2>
                        Hồ sơ cá nhân
                    </h2>

                    <p>
                        Thông tin được sử dụng
                        trong hồ sơ thực tập và
                        giao tiếp với giảng viên.
                    </p>
                </div>
            </div>


            <div
                className={
                    styles.avatarSection
                }
            >
                <div
                    className={
                        styles.avatar
                    }
                >
                    {avatarUrl ? (
                        <img
                            src={
                                avatarUrl
                            }
                            alt="Ảnh đại diện"
                        />
                    ) : (
                        <UserRound
                            size={34}
                        />
                    )}
                </div>


                <div>
                    <h3>
                        Ảnh đại diện
                    </h3>

                    <p>
                        JPG, PNG hoặc WEBP,
                        tối đa 5 MB.
                    </p>


                    <div
                        className={
                            styles.avatarActions
                        }
                    >
                        <input
                            ref={
                                inputRef
                            }
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden
                            onChange={
                                uploadAvatar
                            }
                        />


                        <button
                            type="button"
                            onClick={() =>
                                inputRef.current?.click()
                            }
                        >
                            <Camera
                                size={16}
                            />

                            {avatarUrl
                                ? "Thay ảnh"
                                : "Tải ảnh"}
                        </button>


                        {avatarUrl && (
                            <button
                                type="button"
                                className={
                                    styles.removeAvatarButton
                                }
                                onClick={() =>
                                    void removeAvatar()
                                }
                            >
                                <Trash2
                                    size={16}
                                />

                                Xóa ảnh
                            </button>
                        )}
                    </div>
                </div>
            </div>


            <div
                className={
                    styles.formGrid
                }
            >
                <Field
                    label="Họ và tên"
                    name="fullName"
                    value={
                        form.fullName
                    }
                    onChange={
                        onChange
                    }
                />


                <Field
                    label="Mã sinh viên"
                    name="studentCode"
                    value={
                        profile.studentCode ??
                        ""
                    }
                    disabled
                />


                <Field
                    label="Email VinUni"
                    name="email"
                    value={
                        profile.email
                    }
                    icon={
                        Mail
                    }
                    disabled
                />


                <Field
                    label="Số điện thoại"
                    name="phone"
                    value={
                        form.phone
                    }
                    onChange={
                        onChange
                    }
                />


                <Field
                    label="Khoa"
                    name="faculty"
                    value={
                        form.faculty
                    }
                    icon={
                        GraduationCap
                    }
                    onChange={
                        onChange
                    }
                />


                <Field
                    label="Ngành"
                    name="major"
                    value={
                        form.major
                    }
                    onChange={
                        onChange
                    }
                />


                <Field
                    label="Khóa"
                    name="cohort"
                    value={
                        form.cohort
                    }
                    onChange={
                        onChange
                    }
                />
            </div>


            <div
                className={
                    styles.formFooter
                }
            >
                <button
                    type="button"
                    className={
                        styles.saveButton
                    }
                    disabled={
                        saving
                    }
                    onClick={() =>
                        void onSave()
                    }
                >
                    {saving ? (
                        <LoaderCircle
                            size={17}
                            className={
                                styles.spinner
                            }
                        />
                    ) : (
                        <Save
                            size={17}
                        />
                    )}

                    {saving
                        ? "Đang lưu..."
                        : "Lưu thay đổi"}
                </button>
            </div>
        </div>
    );
}


/* ============================================================
   ACCOUNT
============================================================ */

function AccountSettingsView({
    account,
    onOpenPassword,
    onLogout,
}: {
    account:
    AccountSettings;

    onOpenPassword:
    () => void;

    onLogout:
    () => void;
}) {
    return (
        <div
            className={
                styles.settingsCard
            }
        >
            <div
                className={
                    styles.cardHeader
                }
            >
                <div>
                    <h2>
                        Tài khoản &
                        Bảo mật
                    </h2>

                    <p>
                        Quản lý thông tin đăng
                        nhập và bảo mật tài khoản.
                    </p>
                </div>
            </div>


            <div
                className={
                    styles.accountBlock
                }
            >
                <div
                    className={
                        styles.accountIcon
                    }
                >
                    <Mail
                        size={20}
                    />
                </div>


                <div>
                    <h3>
                        Email đăng nhập
                    </h3>

                    <p>
                        {
                            account.email
                        }
                    </p>
                </div>


                {account.emailVerified && (
                    <span
                        className={
                            styles.verifiedBadge
                        }
                    >
                        Đã xác minh
                    </span>
                )}
            </div>


            <div
                className={
                    styles.accountBlock
                }
            >
                <div
                    className={
                        styles.accountIcon
                    }
                >
                    <Lock
                        size={20}
                    />
                </div>


                <div
                    className={
                        styles.accountInfo
                    }
                >
                    <h3>
                        Mật khẩu
                    </h3>

                    <p>
                        {account.canChangePassword
                            ? "Cập nhật mật khẩu định kỳ để bảo vệ tài khoản."
                            : `Tài khoản đăng nhập qua ${account.authProvider}.`}
                    </p>
                </div>


                <button
                    type="button"
                    className={
                        styles.secondaryButton
                    }
                    disabled={
                        !account.canChangePassword
                    }
                    onClick={
                        onOpenPassword
                    }
                >
                    Đổi mật khẩu
                </button>
            </div>


            <div
                className={
                    styles.accountBlock
                }
            >
                <div
                    className={
                        styles.accountIcon
                    }
                >
                    <LogOut
                        size={20}
                    />
                </div>


                <div
                    className={
                        styles.accountInfo
                    }
                >
                    <h3>
                        Đăng xuất
                    </h3>

                    <p>
                        Đăng xuất khỏi tài khoản Internova
                        trên thiết bị này.
                    </p>
                </div>


                <button
                    type="button"
                    className={
                        styles.secondaryButton
                    }
                    onClick={
                        onLogout
                    }
                >
                    <LogOut
                        size={17}
                    />

                    Đăng xuất
                </button>
            </div>


            <div
                className={
                    styles.securityNotice
                }
            >
                <ShieldCheck
                    size={20}
                />

                <div>
                    <strong>
                        Tài khoản được bảo vệ
                    </strong>

                    <p>
                        Không chia sẻ mật khẩu
                        hoặc thông tin đăng nhập
                        với người khác.
                    </p>
                </div>
            </div>
        </div>
    );
}


/* ============================================================
   NOTIFICATIONS
============================================================ */

function NotificationSettingsView({
    settings,
    saving,
    onToggle,
    onSave,
}: {
    settings:
    NotificationSettings;

    saving:
    boolean;

    onToggle:
    (
        key:
            keyof NotificationSettings
    ) => void;

    onSave:
    () => Promise<void>;
}) {
    return (
        <div
            className={
                styles.settingsCard
            }
        >
            <div
                className={
                    styles.cardHeader
                }
            >
                <div>
                    <h2>
                        Cài đặt thông báo
                    </h2>

                    <p>
                        Chọn loại cập nhật mà
                        bạn muốn nhận từ Internova.
                    </p>
                </div>
            </div>


            <div
                className={
                    styles.preferenceList
                }
            >
                <PreferenceRow
                    title="Deadline báo cáo"
                    description="Nhận nhắc nhở trước hạn nộp báo cáo."
                    checked={
                        settings.reportDeadline
                    }
                    onClick={() =>
                        onToggle(
                            "reportDeadline"
                        )
                    }
                />


                <PreferenceRow
                    title="Phản hồi từ giảng viên"
                    description="Nhận thông báo khi giảng viên nhận xét hoặc yêu cầu chỉnh sửa."
                    checked={
                        settings.lecturerFeedback
                    }
                    onClick={() =>
                        onToggle(
                            "lecturerFeedback"
                        )
                    }
                />


                <PreferenceRow
                    title="Trạng thái hồ sơ thực tập"
                    description="Thông báo khi hồ sơ được duyệt hoặc cần cập nhật."
                    checked={
                        settings.internshipStatus
                    }
                    onClick={() =>
                        onToggle(
                            "internshipStatus"
                        )
                    }
                />


                <PreferenceRow
                    title="Thông báo qua Email"
                    description="Gửi các thông báo quan trọng đến email VinUni."
                    checked={
                        settings.emailNotifications
                    }
                    onClick={() =>
                        onToggle(
                            "emailNotifications"
                        )
                    }
                />
            </div>


            <div
                className={
                    styles.formFooter
                }
            >
                <button
                    type="button"
                    className={
                        styles.saveButton
                    }
                    disabled={
                        saving
                    }
                    onClick={() =>
                        void onSave()
                    }
                >
                    {saving ? (
                        <LoaderCircle
                            size={17}
                            className={
                                styles.spinner
                            }
                        />
                    ) : (
                        <Save
                            size={17}
                        />
                    )}

                    {saving
                        ? "Đang lưu..."
                        : "Lưu cài đặt"}
                </button>
            </div>
        </div>
    );
}


/* ============================================================
   PASSWORD MODAL
============================================================ */

function PasswordModal({
    onClose,
    onSuccess,
}: {
    onClose:
    () => void;

    onSuccess:
    () => void;
}) {
    const [
        currentPassword,
        setCurrentPassword,
    ] =
        useState("");


    const [
        newPassword,
        setNewPassword,
    ] =
        useState("");


    const [
        confirmPassword,
        setConfirmPassword,
    ] =
        useState("");


    const [
        submitting,
        setSubmitting,
    ] =
        useState(false);


    async function submit(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();


        if (
            newPassword !==
            confirmPassword
        ) {
            alert(
                "Xác nhận mật khẩu mới không khớp."
            );

            return;
        }


        if (
            newPassword.length <
            8
        ) {
            alert(
                "Mật khẩu mới phải có ít nhất 8 ký tự."
            );

            return;
        }


        const token =
            localStorage.getItem(
                "internova_access_token"
            );


        try {
            setSubmitting(
                true
            );


            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/settings/password`,
                    {
                        method:
                            "PUT",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            JSON.stringify({
                                currentPassword,
                                newPassword,
                            }),
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể đổi mật khẩu."
                );
            }


            onSuccess();


        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể đổi mật khẩu."
            );

        } finally {
            setSubmitting(
                false
            );
        }
    }


    return (
        <div
            className={
                styles.modalOverlay
            }
            onMouseDown={
                onClose
            }
        >
            <form
                className={
                    styles.passwordModal
                }
                onSubmit={
                    submit
                }
                onMouseDown={(
                    event
                ) =>
                    event.stopPropagation()
                }
            >
                <div
                    className={
                        styles.modalHeader
                    }
                >
                    <div>
                        <h2>
                            Đổi mật khẩu
                        </h2>

                        <p>
                            Nhập mật khẩu hiện
                            tại và mật khẩu mới.
                        </p>
                    </div>


                    <button
                        type="button"
                        onClick={
                            onClose
                        }
                    >
                        <X
                            size={20}
                        />
                    </button>
                </div>


                <div
                    className={
                        styles.passwordFields
                    }
                >
                    <label>
                        Mật khẩu hiện tại

                        <input
                            type="password"
                            value={
                                currentPassword
                            }
                            onChange={(
                                event
                            ) =>
                                setCurrentPassword(
                                    event.target
                                        .value
                                )
                            }
                            required
                        />
                    </label>


                    <label>
                        Mật khẩu mới

                        <input
                            type="password"
                            value={
                                newPassword
                            }
                            onChange={(
                                event
                            ) =>
                                setNewPassword(
                                    event.target
                                        .value
                                )
                            }
                            minLength={
                                8
                            }
                            required
                        />
                    </label>


                    <label>
                        Xác nhận mật khẩu mới

                        <input
                            type="password"
                            value={
                                confirmPassword
                            }
                            onChange={(
                                event
                            ) =>
                                setConfirmPassword(
                                    event.target
                                        .value
                                )
                            }
                            minLength={
                                8
                            }
                            required
                        />
                    </label>
                </div>


                <div
                    className={
                        styles.modalActions
                    }
                >
                    <button
                        type="button"
                        className={
                            styles.secondaryButton
                        }
                        onClick={
                            onClose
                        }
                    >
                        Hủy
                    </button>


                    <button
                        type="submit"
                        className={
                            styles.saveButton
                        }
                        disabled={
                            submitting
                        }
                    >
                        {submitting ? (
                            <LoaderCircle
                                size={17}
                                className={
                                    styles.spinner
                                }
                            />
                        ) : (
                            <Lock
                                size={17}
                            />
                        )}

                        {submitting
                            ? "Đang cập nhật..."
                            : "Đổi mật khẩu"}
                    </button>
                </div>
            </form>
        </div>
    );
}


/* ============================================================
   FIELD
============================================================ */

function Field({
    label,
    name,
    value,
    icon: Icon,
    disabled = false,
    onChange,
}: {
    label: string;

    name: string;

    value: string;

    icon?:
    React.ElementType;

    disabled?:
    boolean;

    onChange?:
    (
        event:
            ChangeEvent<HTMLInputElement>
    ) => void;
}) {
    return (
        <div
            className={
                styles.fieldGroup
            }
        >
            <label
                htmlFor={
                    name
                }
            >
                {label}
            </label>


            <div
                className={
                    styles.inputWrapper
                }
            >
                {Icon && (
                    <Icon
                        size={16}
                    />
                )}


                <input
                    id={
                        name
                    }
                    name={
                        name
                    }
                    value={
                        value
                    }
                    disabled={
                        disabled
                    }
                    onChange={
                        onChange
                    }
                />
            </div>
        </div>
    );
}


/* ============================================================
   PREFERENCE
============================================================ */

function PreferenceRow({
    title,
    description,
    checked,
    onClick,
}: {
    title: string;

    description: string;

    checked: boolean;

    onClick:
    () => void;
}) {
    return (
        <div
            className={
                styles.preferenceRow
            }
        >
            <div>
                <h3>
                    {title}
                </h3>

                <p>
                    {description}
                </p>
            </div>


            <button
                type="button"
                className={`${styles.switch} ${checked
                        ? styles.switchActive
                        : ""
                    }`}
                onClick={
                    onClick
                }
                aria-pressed={
                    checked
                }
            >
                <span />
            </button>
        </div>
    );
}
