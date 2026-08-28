"use client";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";
import { useSettings } from "@/context/settings-provider";

import {
    AlertTriangle,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    CheckCircle2,
    FileText,
    LoaderCircle,
    Mail,
    MapPin,
    Phone,
    Trash2,
    Upload,
    UserRound,
} from "lucide-react";

import {
    ChangeEvent,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

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


type ProfileDocument = {
    id: number | null;

    key: string;

    title: string;

    status: string;

    completed: boolean;

    uploaded: boolean;

    originalFileName:
    string | null;

    fileSize:
    number | null;

    mimeType:
    string | null;

    uploadedAt:
    string | null;
};


type UploadDocumentResponse = {
    status: string;

    message: string;

    document: {
        id: number;

        documentType: string;

        originalFileName: string;

        fileSize: number;

        status: string;
    };
};


type InternshipProfileData = {
    student: {
        id: number;

        fullName: string;

        studentCode:
        string | null;

        email: string;

        phone:
        string | null;

        address:
        string | null;

        avatarUrl:
        string | null;
    };


    internship: {
        id: number;

        status: string;

        companyName:
        string | null;

        positionTitle:
        string | null;

        startDate:
        string | null;

        endDate:
        string | null;

        location:
        string | null;
    } | null;


    mentor: {
        fullName: string;

        position:
        string | null;

        email:
        string | null;

        phone:
        string | null;
    } | null;


    documents:
    ProfileDocument[];


    completionPercentage:
    number;


    missingDocuments:
    number;
};


function formatDate(
    value: string | null,
    locale: "vi" | "en",
) {
    if (!value) {
        return locale === "en"
            ? "Not updated"
            : "Chưa cập nhật";
    }


    return new Intl.DateTimeFormat(
        locale === "en"
            ? "en-US"
            : "vi-VN",
        {
            day: "2-digit",

            month: "2-digit",

            year: "numeric",
        }
    ).format(
        new Date(value)
    );
}


function formatFileSize(
    size: number | null
) {
    if (!size) {
        return "";
    }


    if (
        size <
        1024
    ) {
        return `${size} B`;
    }


    if (
        size <
        1024 * 1024
    ) {
        return `${(
            size /
            1024
        ).toFixed(1)} KB`;
    }


    return `${(
        size /
        (
            1024 *
            1024
        )
    ).toFixed(1)} MB`;
}


function getInternshipStatusLabel(
    status: string
) {
    switch (status) {

        case "IN_PROGRESS":
            return "Đang thực tập";

        case "NOT_STARTED":
            return "Chưa bắt đầu";

        case "PAUSED":
            return "Tạm dừng";

        case "COMPLETED":
            return "Đã hoàn thành";

        default:
            return status;
    }
}


function getInitials(
    fullName: string
) {
    const parts = fullName
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return "SV";
    }

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`
        .toUpperCase();
}


function recalculateDocumentProgress(
    documents: ProfileDocument[]
) {
    const completedDocuments =
        documents.filter(
            (
                document
            ) =>
                document.completed
        ).length;


    const totalDocuments =
        documents.length;


    return {
        completionPercentage:
            totalDocuments > 0
                ? Math.round(
                    completedDocuments /
                    totalDocuments *
                    100
                )
                : 0,

        missingDocuments:
            totalDocuments -
            completedDocuments,
    };
}


export default function InternshipProfilePage() {
    const { locale } = useSettings();
    const router =
        useRouter();


    const fileInputRef =
        useRef<HTMLInputElement>(
            null
        );


    const [
        data,
        setData,
    ] =
        useState<
            InternshipProfileData |
            null
        >(null);


    const [
        loading,
        setLoading,
    ] =
        useState(true);


    const [
        error,
        setError,
    ] =
        useState("");


    const [
        avatarObjectUrl,
        setAvatarObjectUrl,
    ] =
        useState<
            string | null
        >(null);


    const [
        selectedDocument,
        setSelectedDocument,
    ] =
        useState<
            ProfileDocument |
            null
        >(null);


    const [
        uploadingKey,
        setUploadingKey,
    ] =
        useState<
            string | null
        >(null);


    const [
        deletingId,
        setDeletingId,
    ] =
        useState<
            number | null
        >(null);


    function updateProfileDocument(
        updater: (
            document:
                ProfileDocument
        ) => ProfileDocument
    ) {
        setData(
            (
                currentData
            ) => {
                if (!currentData) {
                    return currentData;
                }


                const documents =
                    currentData.documents.map(
                        (
                            document
                        ) =>
                            updater(
                                document
                            )
                    );


                return {
                    ...currentData,
                    documents,
                    ...recalculateDocumentProgress(
                        documents
                    ),
                };
            }
        );
    }


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


    async function loadAvatar(
        avatarUrl: string | null,
        token: string
    ) {
        if (!avatarUrl) {
            setAvatarObjectUrl(
                null
            );

            return;
        }


        if (
            !avatarUrl.startsWith(
                "/api/"
            )
        ) {
            setAvatarObjectUrl(
                avatarUrl
            );

            return;
        }


        try {
            const response =
                await fetch(
                    `${getApiUrl()}${avatarUrl}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        cache:
                            "no-store",
                    }
                );


            if (!response.ok) {
                setAvatarObjectUrl(
                    null
                );

                return;
            }


            const blob =
                await response.blob();


            const objectUrl =
                URL.createObjectURL(
                    blob
                );


            setAvatarObjectUrl(
                (
                    previous
                ) => {
                    if (
                        previous &&
                        previous.startsWith(
                            "blob:"
                        )
                    ) {
                        URL.revokeObjectURL(
                            previous
                        );
                    }

                    return objectUrl;
                }
            );

        } catch {
            setAvatarObjectUrl(
                null
            );
        }
    }


    async function loadProfile() {
        try {

            setLoading(true);

            setError("");


            const token =
                getToken();


            if (!token) {
                redirectLogin();

                return;
            }


            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/internship-profile`,
                    {
                        method:
                            "GET",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },

                        cache:
                            "no-store",
                    }
                );


            const result:
                InternshipProfileData & {
                    detail?: string;
                } =
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
                    "Không thể tải hồ sơ thực tập."
                );
            }


            setData(
                result
            );


            await loadAvatar(
                result.student.avatarUrl,
                token
            );


        } catch (err) {

            setError(
                err instanceof Error
                    ? err.message
                    : "Có lỗi xảy ra."
            );


        } finally {

            setLoading(false);
        }
    }


    useEffect(() => {

        // Initial client-side API synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadProfile();

    }, []);


    useEffect(() => {
        return () => {
            if (
                avatarObjectUrl &&
                avatarObjectUrl.startsWith(
                    "blob:"
                )
            ) {
                URL.revokeObjectURL(
                    avatarObjectUrl
                );
            }
        };
    }, [avatarObjectUrl]);


    /* ========================================================
       OPEN FILE PICKER
    ======================================================== */

    function chooseDocument(
        document:
            ProfileDocument
    ) {
        setSelectedDocument(
            document
        );


        if (
            fileInputRef.current
        ) {
            fileInputRef.current.value =
                "";

            fileInputRef.current.click();
        }
    }


    /* ========================================================
       UPLOAD
    ======================================================== */

    async function handleFileSelected(
        event:
            ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0];


        if (
            !file ||
            !selectedDocument
        ) {
            return;
        }


        const allowedExtensions =
            [
                ".pdf",
                ".doc",
                ".docx",
            ];


        const lowerName =
            file.name.toLowerCase();


        const extensionValid =
            allowedExtensions.some(
                (
                    extension
                ) =>
                    lowerName.endsWith(
                        extension
                    )
            );


        if (!extensionValid) {

            alert(
                "Chỉ được tải PDF, DOC hoặc DOCX."
            );

            return;
        }


        const maxSize =
            10 *
            1024 *
            1024;


        if (
            file.size >
            maxSize
        ) {
            alert(
                "File không được vượt quá 10MB."
            );

            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        try {

            setUploadingKey(
                selectedDocument.key
            );


            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/internship-profile/documents/${selectedDocument.key}`,
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


            const result:
                UploadDocumentResponse & {
                    detail?: string;
                } =
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
                    "Không thể tải tài liệu."
                );
            }


            updateProfileDocument(
                (
                    document
                ) => {
                    if (
                        document.key !==
                        selectedDocument.key
                    ) {
                        return document;
                    }


                    return {
                        ...document,
                        id: result.document.id,
                        status:
                            result.document.status,
                        completed: true,
                        uploaded: true,
                        originalFileName:
                            result.document.originalFileName,
                        fileSize:
                            result.document.fileSize,
                        mimeType:
                            file.type,
                        uploadedAt:
                            new Date().toISOString(),
                    };
                }
            );


        } catch (err) {

            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể tải tài liệu."
            );


        } finally {

            setUploadingKey(
                null
            );

            setSelectedDocument(
                null
            );
        }
    }


    /* ========================================================
       VIEW FILE
    ======================================================== */

    async function viewDocument(
        document:
            ProfileDocument
    ) {
        if (!document.id) {
            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {

            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/internship-profile/documents/${document.id}/file`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`,
                        },
                    }
                );


            if (!response.ok) {

                const result =
                    await response.json();


                throw new Error(
                    result.detail ??
                    "Không thể tải file."
                );
            }


            const blob =
                await response.blob();


            const fileUrl =
                URL.createObjectURL(
                    blob
                );


            window.open(
                fileUrl,
                "_blank"
            );


            window.setTimeout(
                () => {
                    URL.revokeObjectURL(
                        fileUrl
                    );
                },
                60000
            );


        } catch (err) {

            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể mở file."
            );
        }
    }


    /* ========================================================
       DELETE
    ======================================================== */

    async function removeDocument(
        document:
            ProfileDocument
    ) {
        if (!document.id) {
            return;
        }


        const confirmed =
            window.confirm(
                `Bạn có chắc muốn xóa "${document.title}"?`
            );


        if (!confirmed) {
            return;
        }


        const token =
            getToken();


        if (!token) {
            redirectLogin();

            return;
        }


        try {

            setDeletingId(
                document.id
            );


            const response =
                await fetch(
                    `${getApiUrl()}/api/v1/student/internship-profile/documents/${document.id}`,
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
                throw new Error(
                    result.detail ??
                    "Không thể xóa tài liệu."
                );
            }


            updateProfileDocument(
                (
                    currentDocument
                ) => {
                    if (
                        currentDocument.id !==
                        document.id
                    ) {
                        return currentDocument;
                    }


                    return {
                        ...currentDocument,
                        id: null,
                        status:
                            "Chưa tải lên",
                        completed: false,
                        uploaded: false,
                        originalFileName:
                            null,
                        fileSize:
                            null,
                        mimeType:
                            null,
                        uploadedAt:
                            null,
                    };
                }
            );


        } catch (err) {

            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể xóa tài liệu."
            );


        } finally {

            setDeletingId(
                null
            );
        }
    }


    /* ========================================================
       LOADING
    ======================================================== */

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
                            Đang tải hồ sơ
                            thực tập...
                        </p>
                    </main>
                </div>
            </div>
        );
    }


    /* ========================================================
       ERROR
    ======================================================== */

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
                        <AlertTriangle
                            size={36}
                        />

                        <h2>
                            Không thể tải
                            hồ sơ
                        </h2>

                        <p>
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                void loadProfile()
                            }
                        >
                            Thử lại
                        </button>
                    </main>
                </div>
            </div>
        );
    }


    const internship =
        data.internship;


    const displayAvatarUrl =
        avatarObjectUrl ??
        (
            data.student.avatarUrl?.startsWith(
                "/api/"
            )
                ? null
                : data.student.avatarUrl
        );


    const studentInitials =
        getInitials(
            data.student.fullName
        );


    const internshipInfo =
        internship
            ? [
                {
                    label:
                        "Công ty",

                    value:
                        internship.companyName ??
                        "Chưa cập nhật",

                    icon:
                        Building2,
                },

                {
                    label:
                        "Vị trí thực tập",

                    value:
                        internship.positionTitle ??
                        "Chưa cập nhật",

                    icon:
                        BriefcaseBusiness,
                },

                {
                    label:
                        "Thời gian",

                    value:
                        `${formatDate(
                            internship.startDate,
                            locale,
                        )} - ${formatDate(
                            internship.endDate,
                            locale,
                        )}`,

                    icon:
                        CalendarDays,
                },

                {
                    label:
                        "Địa điểm",

                    value:
                        internship.location ??
                        "Chưa cập nhật",

                    icon:
                        MapPin,
                },
            ]
            : [];


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


                {/* HIDDEN FILE INPUT */}

                <input
                    ref={
                        fileInputRef
                    }
                    type="file"
                    accept=".pdf,.doc,.docx"
                    hidden
                    onChange={
                        handleFileSelected
                    }
                />


                <main
                    className={
                        styles.profilePage
                    }
                >

                    <section
                        className={
                            styles.pageHeader
                        }
                    >
                        <div>
                            <h1>
                                Hồ sơ thực tập
                            </h1>

                            <p>
                                Quản lý thông tin cá nhân, đơn vị thực tập
                                và các tài liệu liên quan.
                            </p>
                        </div>

                    </section>


                    <section
                        className={
                            styles.profileGrid
                        }
                    >

                        {/* STUDENT */}

                        <article
                            className={
                                styles.studentCard
                            }
                        >
                            <div
                                className={
                                    styles.avatar
                                }
                            >
                                {displayAvatarUrl ? (
                                    <img
                                        src={
                                            displayAvatarUrl
                                        }
                                        alt={
                                            data.student
                                                .fullName
                                        }
                                    />
                                ) : (
                                    <span
                                        aria-hidden="true"
                                    >
                                        {
                                            studentInitials
                                        }
                                    </span>
                                )}
                            </div>


                            <h2>
                                {
                                    data.student
                                        .fullName
                                }
                            </h2>


                            <p
                                className={
                                    styles.studentCode
                                }
                            >
                                MSSV:{" "}

                                {data.student
                                    .studentCode ??
                                    "Chưa cập nhật"}
                            </p>


                            <span
                                className={
                                    styles.statusPill
                                }
                            >
                                {internship
                                    ? getInternshipStatusLabel(
                                        internship.status
                                    )
                                    : "Chưa thực tập"}
                            </span>


                            <div
                                className={
                                    styles.contactList
                                }
                            >
                                <div>
                                    <Mail
                                        size={17}
                                    />

                                    <span>
                                        {
                                            data.student
                                                .email
                                        }
                                    </span>
                                </div>


                                <div>
                                    <Phone
                                        size={17}
                                    />

                                    <span>
                                        {data.student
                                            .phone ??
                                            "Chưa cập nhật"}
                                    </span>
                                </div>


                                <div>
                                    <MapPin
                                        size={17}
                                    />

                                    <span>
                                        {data.student
                                            .address ??
                                            internship
                                                ?.location ??
                                            "Chưa cập nhật"}
                                    </span>
                                </div>
                            </div>
                        </article>


                        {/* INTERNSHIP */}

                        <article
                            className={
                                styles.infoCard
                            }
                        >
                            <div
                                className={
                                    styles.cardHeader
                                }
                            >
                                <BriefcaseBusiness
                                    size={22}
                                />

                                <h2>
                                    Thông tin
                                    thực tập
                                </h2>
                            </div>


                            <div
                                className={
                                    styles.infoGrid
                                }
                            >
                                {internshipInfo.map(
                                    ({
                                        label,
                                        value,
                                        icon:
                                        Icon,
                                    }) => (
                                        <div
                                            key={
                                                label
                                            }
                                            className={
                                                styles.infoItem
                                            }
                                        >
                                            <span
                                                className={
                                                    styles.infoIcon
                                                }
                                            >
                                                <Icon
                                                    size={
                                                        20
                                                    }
                                                />
                                            </span>

                                            <div>
                                                <p>
                                                    {
                                                        label
                                                    }
                                                </p>

                                                <strong>
                                                    {
                                                        value
                                                    }
                                                </strong>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>


                            {data.mentor && (
                                <div
                                    className={
                                        styles.mentorBox
                                    }
                                >
                                    <div
                                        className={
                                            styles.mentorAvatar
                                        }
                                    >
                                        <UserRound
                                            size={
                                                28
                                            }
                                        />
                                    </div>


                                    <div>
                                        <p>
                                            Mentor
                                            doanh
                                            nghiệp
                                        </p>

                                        <strong>
                                            {
                                                data.mentor
                                                    .fullName
                                            }
                                        </strong>

                                        <span>
                                            {data.mentor
                                                .position ??
                                                "Chưa cập nhật"}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </article>
                    </section>


                    <section
                        className={
                            styles.bottomGrid
                        }
                    >

                        {/* DOCUMENTS */}

                        <article
                            className={
                                styles.documentCard
                            }
                        >
                            <div
                                className={
                                    styles.cardHeader
                                }
                            >
                                <FileText
                                    size={22}
                                />

                                <h2>
                                    Tài liệu hồ sơ
                                </h2>
                            </div>


                            <p
                                className={
                                    styles.uploadHint
                                }
                            >
                                Hỗ trợ PDF, DOC,
                                DOCX. Tối đa 10MB
                                mỗi file.
                            </p>


                            <div
                                className={
                                    styles.documentList
                                }
                            >
                                {data.documents.map(
                                    (
                                        document
                                    ) => (
                                        <div
                                            key={
                                                document.key
                                            }
                                            className={
                                                styles.documentItem
                                            }
                                        >

                                            <div
                                                className={
                                                    styles.documentTitle
                                                }
                                            >

                                                {document.uploaded ? (
                                                    <CheckCircle2
                                                        size={
                                                            20
                                                        }
                                                        className={
                                                            styles.documentDone
                                                        }
                                                    />
                                                ) : (
                                                    <FileText
                                                        size={
                                                            20
                                                        }
                                                        className={
                                                            styles.documentPending
                                                        }
                                                    />
                                                )}


                                                <div>
                                                    <p>
                                                        {
                                                            document.title
                                                        }
                                                    </p>

                                                    <span>
                                                        {
                                                            document.status
                                                        }
                                                    </span>


                                                    {document.originalFileName && (
                                                        <small>
                                                            {
                                                                document.originalFileName
                                                            }

                                                            {document.fileSize
                                                                ? ` • ${formatFileSize(
                                                                    document.fileSize
                                                                )}`
                                                                : ""}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>


                                            <div
                                                className={
                                                    styles.documentActions
                                                }
                                            >

                                                {document.id && (
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.viewButton
                                                        }
                                                        onClick={() =>
                                                            void viewDocument(
                                                                document
                                                            )
                                                        }
                                                    >
                                                        Xem
                                                    </button>
                                                )}


                                                <button
                                                    type="button"
                                                    className={
                                                        styles.uploadButton
                                                    }
                                                    disabled={
                                                        uploadingKey ===
                                                        document.key
                                                    }
                                                    onClick={() =>
                                                        chooseDocument(
                                                            document
                                                        )
                                                    }
                                                >

                                                    {uploadingKey ===
                                                        document.key ? (
                                                        <>
                                                            <LoaderCircle
                                                                size={
                                                                    15
                                                                }
                                                                className={
                                                                    styles.smallSpinner
                                                                }
                                                            />

                                                            Đang tải...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload
                                                                size={
                                                                    15
                                                                }
                                                            />

                                                            {document.uploaded
                                                                ? "Thay tệp"
                                                                : "Tải lên"}
                                                        </>
                                                    )}
                                                </button>


                                                {document.id && (
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.deleteButton
                                                        }
                                                        disabled={
                                                            deletingId ===
                                                            document.id
                                                        }
                                                        onClick={() =>
                                                            void removeDocument(
                                                                document
                                                            )
                                                        }
                                                    >
                                                        <Trash2
                                                            size={
                                                                15
                                                            }
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </article>


                        {/* PROGRESS */}

                        <article
                            className={
                                styles.progressCard
                            }
                        >
                            <div
                                className={
                                    styles.cardHeader
                                }
                            >
                                <CheckCircle2
                                    size={22}
                                />

                                <h2>
                                    Mức độ hoàn
                                    thiện
                                </h2>
                            </div>


                            <div
                                className={
                                    styles.progressCircle
                                }
                                style={{
                                    background:
                                        `conic-gradient(
                                            #0b3559 0% ${data.completionPercentage * 0.58}%,
                                            #178d8a ${data.completionPercentage * 0.58}% ${data.completionPercentage}%,
                                            #e2e8f0 ${data.completionPercentage}% 100%
                                        )`,
                                }}
                            >
                                <div>
                                    <strong>
                                        {
                                            data.completionPercentage
                                        }
                                        %
                                    </strong>

                                    <span>
                                        Hoàn thiện
                                    </span>

                                    <small>
                                        {data.documents.length - data.missingDocuments}/
                                        {data.documents.length}
                                    </small>
                                </div>
                            </div>


                            <p
                                className={
                                    styles.progressText
                                }
                            >
                                {data.missingDocuments ===
                                    0
                                    ? "Hồ sơ thực tập của bạn đã hoàn thiện."
                                    : `Bạn còn thiếu ${data.missingDocuments} tài liệu để hoàn tất hồ sơ thực tập.`}
                            </p>


                            <div
                                className={
                                    styles.progressBar
                                }
                            >
                                <div
                                    className={
                                        styles.progressFill
                                    }
                                    style={{
                                        width:
                                            `${data.completionPercentage}%`,
                                    }}
                                />
                            </div>

                            <p
                                className={
                                    styles.progressNudge
                                }
                            >
                                {data.missingDocuments === 0
                                    ? "Hồ sơ đã sẵn sàng để tiếp tục."
                                    : data.missingDocuments === 1
                                        ? "Tuyệt vời, bạn chỉ còn 1 bước nữa!"
                                        : `Hoàn thành thêm ${data.missingDocuments} tài liệu để hoàn thiện hồ sơ.`}
                            </p>

                            <button
                                type="button"
                                className={
                                    styles.checklistButton
                                }
                                onClick={() =>
                                    router.push(
                                        "/student/checklist"
                                    )
                                }
                            >
                                Xem checklist
                                <span
                                    aria-hidden="true"
                                >
                                    →
                                </span>
                            </button>
                        </article>
                    </section>
                </main>
            </div>
        </div>
    );
}
