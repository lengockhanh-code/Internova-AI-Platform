"use client";

import Header from "@/components/header/header";
import Sidebar from "@/components/sidebar/sidebar";

import {
    AlertTriangle,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    ClipboardCheck,
    Clock3,
    Filter,
    Flag,
    ListChecks,
    LoaderCircle,
    Pencil,
    Plus,
    Target,
    Trash2,
    X,
} from "lucide-react";

import {
    FormEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { useRouter } from "next/navigation";
import { useSettings } from "@/context/settings-provider";

import styles from "./page.module.css";


/* ============================================================
   CONFIG
============================================================ */

const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";


/* ============================================================
   TYPES
============================================================ */

type ApiTaskStatus =
    | "COMPLETED"
    | "IN_PROGRESS"
    | "PENDING";


type ApiTaskPriority =
    | "HIGH"
    | "MEDIUM"
    | "LOW";


type ApiTaskCategory =
    | "PROFILE"
    | "WEEKLY"
    | "FINAL";


type FilterStatus =
    | "ALL"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "PENDING";


type Task = {
    id: number;

    title: string;

    description: string | null;

    category: ApiTaskCategory;

    status: ApiTaskStatus;

    priority: ApiTaskPriority;

    dueAt: string | null;

    completedAt: string | null;
};


type TaskDraft = {
    id: number;

    title: string;
};


type TaskGroup = {
    id: string;

    groupId: number | null;

    title: string;

    subtitle: string;

    progress: number;

    tasks: Task[];
};


type ChecklistData = {
    stats: {
        total: number;
        completed: number;
        inProgress: number;
        pending: number;
        progressPercentage: number;
    };

    groups: TaskGroup[];

    nearestDeadline: {
        id: number;
        title: string;
        dueAt: string;
    } | null;
};


/* ============================================================
   HELPERS
============================================================ */

function getStatusLabel(
    status: ApiTaskStatus
) {
    if (status === "COMPLETED") {
        return "Đã hoàn thành";
    }

    if (status === "IN_PROGRESS") {
        return "Đang thực hiện";
    }

    return "Chưa bắt đầu";
}


function getPriorityLabel(
    priority: ApiTaskPriority
) {
    if (priority === "HIGH") {
        return "Ưu tiên cao";
    }

    if (priority === "MEDIUM") {
        return "Ưu tiên vừa";
    }

    return "Ưu tiên thấp";
}


function getStatusClass(
    status: ApiTaskStatus
) {
    if (status === "COMPLETED") {
        return styles.completed;
    }

    if (status === "IN_PROGRESS") {
        return styles.inProgress;
    }

    return styles.pending;
}


function getPriorityClass(
    priority: ApiTaskPriority
) {
    if (priority === "HIGH") {
        return styles.high;
    }

    if (priority === "MEDIUM") {
        return styles.medium;
    }

    return styles.low;
}


function getCompletedTaskCount(
    tasks: Task[]
) {
    return tasks.filter(
        task =>
            task.status === "COMPLETED"
    ).length;
}


function formatDate(
    value: string | null,
    locale: "vi" | "en",
) {
    if (!value) {
        return "Chưa có deadline";
    }

    const date = new Date(value);

    return new Intl.DateTimeFormat(
        locale === "en"
            ? "en-US"
            : "vi-VN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }
    ).format(date);
}


function getRemainingDays(
    dueAt: string
) {
    const now = new Date();

    const dueDate =
        new Date(dueAt);

    now.setHours(
        0,
        0,
        0,
        0
    );

    dueDate.setHours(
        0,
        0,
        0,
        0
    );

    const difference =
        dueDate.getTime() -
        now.getTime();

    return Math.ceil(
        difference /
        (
            1000 *
            60 *
            60 *
            24
        )
    );
}


/* ============================================================
   PAGE
============================================================ */

export default function ChecklistPage() {
    const { locale } = useSettings();
    const router = useRouter();


    const [data, setData] =
        useState<ChecklistData | null>(
            null
        );


    const [loading, setLoading] =
        useState(true);


    const [error, setError] =
        useState("");


    const [filter, setFilter] =
        useState<FilterStatus>(
            "ALL"
        );


    const [
        sortByDeadline,
        setSortByDeadline,
    ] = useState(false);


    const [
        showAddModal,
        setShowAddModal,
    ] = useState(false);


    const [
        submitting,
        setSubmitting,
    ] = useState(false);


    const nextTaskDraftId =
        useRef(2);


    const [
        taskDrafts,
        setTaskDrafts,
    ] = useState<TaskDraft[]>([
        {
            id: 1,
            title: "",
        },
    ]);


    const [
        targetGroup,
        setTargetGroup,
    ] = useState<TaskGroup | null>(
        null
    );


    const [
        updatingGroupId,
        setUpdatingGroupId,
    ] = useState<number | null>(
        null
    );


    const [
        updatingTaskId,
        setUpdatingTaskId,
    ] = useState<
        number | null
    >(null);


    /* ========================================================
       TOKEN
    ======================================================== */

    function getToken() {
        if (
            typeof window ===
            "undefined"
        ) {
            return null;
        }

        return localStorage.getItem(
            "internova_access_token"
        );
    }


    /* ========================================================
       HANDLE UNAUTHORIZED
    ======================================================== */

    function handleUnauthorized() {
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


    /* ========================================================
       LOAD CHECKLIST
    ======================================================== */

    async function loadChecklist(
        showPageLoader = true
    ) {
        try {
            if (showPageLoader) {
                setLoading(true);
            }
            setError("");


            const token =
                getToken();


            if (!token) {
                handleUnauthorized();

                return;
            }


            const response =
                await fetch(
                    `${API_URL}/api/v1/checklist`,
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


            const result =
                await response.json();


            if (
                response.status ===
                401
            ) {
                handleUnauthorized();

                return;
            }


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể tải checklist."
                );
            }


            setData(
                result as ChecklistData
            );

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Có lỗi xảy ra."
            );

        } finally {
            if (showPageLoader) {
                setLoading(false);
            }
        }
    }


    useEffect(() => {
        // Initial client-side API synchronization.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadChecklist();
    }, []);


    /* ========================================================
       FILTER + SORT
    ======================================================== */

    const visibleGroups =
        useMemo(() => {
            if (!data) {
                return [];
            }


            return data.groups
                .map(
                    (
                        group
                    ) => {
                        let tasks =
                            [
                                ...group.tasks,
                            ];


                        if (
                            filter !==
                            "ALL"
                        ) {
                            tasks =
                                tasks.filter(
                                    (
                                        task
                                    ) =>
                                        task.status ===
                                        filter
                                );
                        }


                        if (
                            sortByDeadline
                        ) {
                            tasks.sort(
                                (
                                    a,
                                    b
                                ) => {
                                    if (
                                        !a.dueAt &&
                                        !b.dueAt
                                    ) {
                                        return 0;
                                    }

                                    if (
                                        !a.dueAt
                                    ) {
                                        return 1;
                                    }

                                    if (
                                        !b.dueAt
                                    ) {
                                        return -1;
                                    }

                                    return (
                                        new Date(
                                            a.dueAt
                                        ).getTime() -
                                        new Date(
                                            b.dueAt
                                        ).getTime()
                                    );
                                }
                            );
                        }


                        return {
                            ...group,
                            tasks,
                        };
                    }
                )
                .filter(
                    (
                        group
                    ) =>
                        group.tasks
                            .length >
                        0 ||
                        (
                            filter === "ALL" &&
                            group.groupId !== null
                        )
                );
        }, [
            data,
            filter,
            sortByDeadline,
        ]);


    /* ========================================================
       TOGGLE TASK
    ======================================================== */

    async function toggleTask(
        task: Task
    ) {
        const token =
            getToken();


        if (!token) {
            handleUnauthorized();

            return;
        }


        const nextStatus:
            ApiTaskStatus =
            task.status ===
                "COMPLETED"
                ? "IN_PROGRESS"
                : "COMPLETED";


        try {
            setUpdatingTaskId(
                task.id
            );


            const response =
                await fetch(
                    `${API_URL}/api/v1/checklist/${task.id}/status`,
                    {
                        method:
                            "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            JSON.stringify(
                                {
                                    status:
                                        nextStatus,
                                }
                            ),
                    }
                );


            const result =
                await response.json();


            if (
                response.status ===
                401
            ) {
                handleUnauthorized();

                return;
            }


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể cập nhật công việc."
                );
            }


            await loadChecklist(false);

        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể cập nhật công việc."
            );

        } finally {
            setUpdatingTaskId(
                null
            );
        }
    }


    /* ========================================================
       CREATE TASK
    ======================================================== */

    function openAddTaskModal() {
        setTargetGroup(null);
        setTaskDrafts([
            {
                id: nextTaskDraftId.current++,
                title: "",
            },
        ]);
        setShowAddModal(true);
    }


    function closeAddTaskModal() {
        if (!submitting) {
            setShowAddModal(false);
            setTargetGroup(null);
        }
    }


    function openAddGroupTasks(
        group: TaskGroup,
    ) {
        if (group.groupId === null) {
            return;
        }

        setTargetGroup(group);
        setTaskDrafts([
            {
                id: nextTaskDraftId.current++,
                title: "",
            },
        ]);
        setShowAddModal(true);
    }


    function addTaskDraft() {
        setTaskDrafts(
            current => [
                ...current,
                {
                    id: nextTaskDraftId.current++,
                    title: "",
                },
            ]
        );
    }


    function updateTaskDraft(
        id: number,
        title: string,
    ) {
        setTaskDrafts(
            current =>
                current.map(
                    task =>
                        task.id === id
                            ? {
                                ...task,
                                title,
                            }
                            : task
                )
        );
    }


    function removeTaskDraft(
        id: number,
    ) {
        setTaskDrafts(
            current =>
                current.length === 1
                    ? current
                    : current.filter(
                        task =>
                            task.id !== id
                    )
        );
    }

    async function createTask(
        event:
            FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();


        const token =
            getToken();


        if (!token) {
            handleUnauthorized();

            return;
        }


        const formData =
            new FormData(
                event.currentTarget
            );


        const taskTitles =
            taskDrafts.map(
                task =>
                    task.title.trim()
            );


        const groupTitle =
            String(
                formData.get(
                    "groupTitle"
                ) ?? ""
            ).trim();


        const category =
            String(
                formData.get(
                    "category"
                ) ?? ""
            );


        const priority =
            String(
                formData.get(
                    "priority"
                ) ?? ""
            );


        const dueAtValue =
            String(
                formData.get(
                    "dueAt"
                ) ?? ""
            );


        if (
            taskTitles.length === 0 ||
            taskTitles.some(
                title => !title
            )
        ) {
            alert(
                "Vui lòng nhập đầy đủ hoặc xóa các ô công việc còn trống."
            );
            return;
        }


        if (
            targetGroup === null &&
            !groupTitle
        ) {
            alert(
                "Vui lòng nhập tiêu đề cho nhóm công việc."
            );
            return;
        }


        try {
            setSubmitting(
                true
            );


            const response =
                await fetch(
                    targetGroup?.groupId
                        ? `${API_URL}/api/v1/checklist/groups/${targetGroup.groupId}/tasks`
                        : `${API_URL}/api/v1/checklist/batch`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            JSON.stringify(
                                {
                                    tasks:
                                        taskTitles.map(
                                            title => ({
                                                title,
                                            })
                                        ),

                                    ...(targetGroup
                                        ? {}
                                        : {
                                            title:
                                                groupTitle,

                                            category,

                                            priority,

                                            dueAt:
                                                dueAtValue
                                                    ? new Date(
                                                        dueAtValue
                                                    ).toISOString()
                                                    : null,
                                        }),
                                }
                            ),
                    }
                );


            const result =
                await response.json();


            if (
                response.status ===
                401
            ) {
                handleUnauthorized();

                return;
            }


            if (!response.ok) {
                throw new Error(
                    result.detail ??
                    "Không thể thêm công việc."
                );
            }


            setShowAddModal(false);
            setTargetGroup(null);


            await loadChecklist(false);

        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể thêm công việc."
            );

        } finally {
            setSubmitting(
                false
            );
        }
    }


    async function runChecklistMutation(
        path: string,
        method: "PATCH" | "DELETE",
        body?: Record<string, unknown>,
    ) {
        const token = getToken();
        if (!token) {
            handleUnauthorized();
            return false;
        }

        const response = await fetch(
            `${API_URL}${path}`,
            {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(body
                        ? {
                            "Content-Type": "application/json",
                        }
                        : {}),
                },
                body: body
                    ? JSON.stringify(body)
                    : undefined,
            }
        );
        const result = await response
            .json()
            .catch(() => null);

        if (response.status === 401) {
            handleUnauthorized();
            return false;
        }

        if (!response.ok) {
            throw new Error(
                result?.detail ??
                "Không thể cập nhật checklist."
            );
        }

        return true;
    }


    async function editGroup(
        group: TaskGroup,
    ) {
        if (group.groupId === null) {
            return;
        }

        const title = window.prompt(
            "Tiêu đề mới cho nhóm công việc:",
            group.title,
        )?.trim();
        if (!title || title === group.title) {
            return;
        }

        try {
            setUpdatingGroupId(group.groupId);
            if (await runChecklistMutation(
                `/api/v1/checklist/groups/${group.groupId}`,
                "PATCH",
                { title },
            )) {
                await loadChecklist(false);
            }
        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể sửa nhóm công việc."
            );
        } finally {
            setUpdatingGroupId(null);
        }
    }


    async function removeGroup(
        group: TaskGroup,
    ) {
        if (
            group.groupId === null ||
            !window.confirm(
                `Xóa nhóm “${group.title}” và toàn bộ ${group.tasks.length} công việc bên trong?`
            )
        ) {
            return;
        }

        try {
            setUpdatingGroupId(group.groupId);
            if (await runChecklistMutation(
                `/api/v1/checklist/groups/${group.groupId}`,
                "DELETE",
            )) {
                await loadChecklist(false);
            }
        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể xóa nhóm công việc."
            );
        } finally {
            setUpdatingGroupId(null);
        }
    }


    async function editTask(
        task: Task,
    ) {
        const title = window.prompt(
            "Tên mới cho công việc:",
            task.title,
        )?.trim();
        if (!title || title === task.title) {
            return;
        }

        try {
            setUpdatingTaskId(task.id);
            if (await runChecklistMutation(
                `/api/v1/checklist/${task.id}`,
                "PATCH",
                { title },
            )) {
                await loadChecklist(false);
            }
        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể sửa công việc."
            );
        } finally {
            setUpdatingTaskId(null);
        }
    }


    async function removeTask(
        task: Task,
    ) {
        if (!window.confirm(
            `Xóa công việc “${task.title}”?`
        )) {
            return;
        }

        try {
            setUpdatingTaskId(task.id);
            if (await runChecklistMutation(
                `/api/v1/checklist/${task.id}`,
                "DELETE",
            )) {
                await loadChecklist(false);
            }
        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Không thể xóa công việc."
            );
        } finally {
            setUpdatingTaskId(null);
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
                            Đang tải
                            checklist...
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
                            size={38}
                        />

                        <h2>
                            Không thể tải
                            checklist
                        </h2>

                        <p>
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                void loadChecklist()
                            }
                        >
                            Thử lại
                        </button>
                    </main>
                </div>
            </div>
        );
    }


    /* ========================================================
       STAT CARDS
    ======================================================== */

    const stats = [
        {
            label:
                "Tổng công việc",

            value:
                String(
                    data.stats
                        .total
                ),

            description:
                "Trong toàn bộ kỳ thực tập",

            icon:
                ListChecks,
        },

        {
            label:
                "Đã hoàn thành",

            value:
                String(
                    data.stats
                        .completed
                ),

            description:
                "Công việc đã hoàn tất",

            icon:
                CheckCircle2,
        },

        {
            label:
                "Đang thực hiện",

            value:
                String(
                    data.stats
                        .inProgress
                ),

            description:
                "Cần tiếp tục xử lý",

            icon:
                Clock3,
        },

        {
            label:
                "Tiến độ chung",

            value:
                `${data.stats.progressPercentage}%`,

            description:
                "Mức độ hoàn thành",

            icon:
                Target,
        },
    ];


    const nearestDeadline =
        data.nearestDeadline;


    const remainingDays =
        nearestDeadline
            ? getRemainingDays(
                nearestDeadline
                    .dueAt
            )
            : null;


    /* ========================================================
       UI
    ======================================================== */

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
                        styles.checklistPage
                    }
                >

                    {/* =======================================
                        HEADER
                    ======================================= */}

                    <section
                        className={
                            styles.pageHeader
                        }
                    >
                        <div>
                            <div
                                className={
                                    styles.titleRow
                                }
                            >
                                <span
                                    className={
                                        styles.titleIcon
                                    }
                                >
                                    <ClipboardCheck
                                        size={28}
                                    />
                                </span>


                                <div>
                                    <h1>
                                        Checklist
                                        thực tập
                                    </h1>

                                    <p>
                                        Theo dõi các
                                        nhiệm vụ,
                                        deadline và
                                        tiến độ trong
                                        suốt kỳ thực
                                        tập.
                                    </p>
                                </div>
                            </div>
                        </div>


                        <button
                            type="button"
                            className={
                                styles.addButton
                            }
                            onClick={
                                openAddTaskModal
                            }
                        >
                            <Plus
                                size={18}
                            />

                            Thêm công việc
                        </button>
                    </section>


                    {/* =======================================
                        STATS
                    ======================================= */}

                    <section
                        className={
                            styles.statGrid
                        }
                    >
                        {stats.map(
                            ({
                                label,
                                value,
                                description,
                                icon:
                                Icon,
                            }) => (
                                <article
                                    key={
                                        label
                                    }
                                    className={
                                        styles.statCard
                                    }
                                >
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

                                        <span>
                                            {
                                                description
                                            }
                                        </span>
                                    </div>


                                    <span
                                        className={
                                            styles.statIcon
                                        }
                                    >
                                        <Icon
                                            size={
                                                24
                                            }
                                        />
                                    </span>
                                </article>
                            )
                        )}
                    </section>


                    {/* =======================================
                        FILTER
                    ======================================= */}

                    <section
                        className={
                            styles.toolbar
                        }
                    >
                        <div
                            className={
                                styles.toolbarLeft
                            }
                        >
                            <div
                                className={
                                    styles.filterLabel
                                }
                            >
                                <Filter
                                    size={17}
                                />

                                Bộ lọc
                            </div>


                            <button
                                type="button"
                                className={
                                    filter ===
                                        "ALL"
                                        ? styles.filterButtonActive
                                        : styles.filterButton
                                }
                                onClick={() =>
                                    setFilter(
                                        "ALL"
                                    )
                                }
                            >
                                Tất cả
                            </button>


                            <button
                                type="button"
                                className={
                                    filter ===
                                        "IN_PROGRESS"
                                        ? styles.filterButtonActive
                                        : styles.filterButton
                                }
                                onClick={() =>
                                    setFilter(
                                        "IN_PROGRESS"
                                    )
                                }
                            >
                                Đang thực hiện
                            </button>


                            <button
                                type="button"
                                className={
                                    filter ===
                                        "COMPLETED"
                                        ? styles.filterButtonActive
                                        : styles.filterButton
                                }
                                onClick={() =>
                                    setFilter(
                                        "COMPLETED"
                                    )
                                }
                            >
                                Đã hoàn thành
                            </button>


                            <button
                                type="button"
                                className={
                                    filter ===
                                        "PENDING"
                                        ? styles.filterButtonActive
                                        : styles.filterButton
                                }
                                onClick={() =>
                                    setFilter(
                                        "PENDING"
                                    )
                                }
                            >
                                Chưa bắt đầu
                            </button>
                        </div>


                        <button
                            type="button"
                            className={
                                sortByDeadline
                                    ? styles.sortButtonActive
                                    : styles.sortButton
                            }
                            onClick={() =>
                                setSortByDeadline(
                                    (
                                        current
                                    ) =>
                                        !current
                                )
                            }
                        >
                            Sắp xếp theo
                            deadline

                            <ChevronDown
                                size={16}
                            />
                        </button>
                    </section>


                    {/* =======================================
                        CONTENT
                    ======================================= */}

                    <section
                        className={
                            styles.contentGrid
                        }
                    >

                        {/* ===================================
                            TASK COLUMN
                        =================================== */}

                        <div
                            className={
                                styles.taskColumn
                            }
                        >

                            {visibleGroups.length ===
                                0 ? (
                                <div
                                    className={
                                        styles.emptyState
                                    }
                                >
                                    <ListChecks
                                        size={
                                            38
                                        }
                                    />

                                    <h3>
                                        Chưa có
                                        công việc
                                    </h3>

                                    <p>
                                        Không có
                                        công việc
                                        phù hợp với
                                        bộ lọc hiện
                                        tại.
                                    </p>
                                </div>
                            ) : (
                                visibleGroups.map(
                                    (
                                        group
                                    ) => (
                                        <article
                                            key={
                                                group.id
                                            }
                                            className={
                                                styles.groupCard
                                            }
                                        >

                                            {/* GROUP HEADER */}

                                            <div
                                                className={
                                                    styles.groupHeader
                                                }
                                            >
                                                <div>
                                                    <h2>
                                                        {
                                                            group.title
                                                        }
                                                    </h2>

                                                    <p>
                                                        {
                                                            group.subtitle
                                                        }
                                                    </p>
                                                </div>


                                                <div
                                                    className={
                                                        styles.groupHeaderRight
                                                    }
                                                >
                                                    {group.groupId !== null && (
                                                        <div
                                                            className={
                                                                styles.groupActions
                                                            }
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openAddGroupTasks(
                                                                        group
                                                                    )
                                                                }
                                                                disabled={
                                                                    updatingGroupId === group.groupId
                                                                }
                                                                title="Thêm công việc"
                                                                aria-label={`Thêm công việc vào ${group.title}`}
                                                            >
                                                                <Plus size={16} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void editGroup(
                                                                        group
                                                                    )
                                                                }
                                                                disabled={
                                                                    updatingGroupId === group.groupId
                                                                }
                                                                title="Sửa tiêu đề"
                                                                aria-label={`Sửa ${group.title}`}
                                                            >
                                                                <Pencil size={15} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void removeGroup(
                                                                        group
                                                                    )
                                                                }
                                                                disabled={
                                                                    updatingGroupId === group.groupId
                                                                }
                                                                title="Xóa nhóm"
                                                                aria-label={`Xóa ${group.title}`}
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div
                                                        className={
                                                            styles.groupCompletionSummary
                                                        }
                                                    >
                                                        <span
                                                            className={`${styles.groupCompletionCheck} ${group.progress === 100
                                                                ? styles.groupCompletionCheckDone
                                                                : ""
                                                                }`}
                                                            aria-hidden="true"
                                                        >
                                                            {group.progress === 100 && (
                                                                <Check
                                                                    size={15}
                                                                />
                                                            )}
                                                        </span>

                                                        <div
                                                            className={
                                                                styles.groupProgressInfo
                                                            }
                                                        >
                                                            <strong>
                                                                {
                                                                    group.progress
                                                                }
                                                                %
                                                            </strong>

                                                            <span>
                                                                {group.progress === 100
                                                                    ? "Đã hoàn thành tất cả"
                                                                    : `${getCompletedTaskCount(
                                                                        group.tasks
                                                                    )}/${group.tasks.length} công việc`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>


                                            {/* GROUP PROGRESS */}

                                            <div
                                                className={
                                                    styles.groupProgressBar
                                                }
                                            >
                                                <div
                                                    className={
                                                        styles.groupProgressFill
                                                    }
                                                    style={{
                                                        width:
                                                            `${group.progress}%`,
                                                    }}
                                                />
                                            </div>


                                            {/* TASK LIST */}

                                            <div
                                                className={
                                                    styles.taskList
                                                }
                                            >
                                                {group.tasks.map(
                                                    (
                                                        task
                                                    ) => (
                                                        <div
                                                            key={
                                                                task.id
                                                            }
                                                            className={`${styles.taskItem} ${task.status ===
                                                                    "COMPLETED"
                                                                    ? styles.taskCompleted
                                                                    : ""
                                                                }`}
                                                        >

                                                            {/* CHECK */}

                                                            <button
                                                                type="button"
                                                                className={`${styles.checkButton} ${task.status === "COMPLETED"
                                                                    ? styles.checkButtonChecked
                                                                    : ""
                                                                    }`}
                                                                disabled={
                                                                    updatingTaskId ===
                                                                    task.id
                                                                }
                                                                onClick={() =>
                                                                    void toggleTask(
                                                                        task
                                                                    )
                                                                }
                                                                aria-label={
                                                                    task.status === "COMPLETED"
                                                                        ? `Bỏ đánh dấu hoàn thành ${task.title}`
                                                                        : `Đánh dấu hoàn thành ${task.title}`
                                                                }
                                                                role="checkbox"
                                                                aria-checked={
                                                                    task.status ===
                                                                    "COMPLETED"
                                                                }
                                                            >
                                                                {updatingTaskId ===
                                                                    task.id ? (
                                                                    <LoaderCircle
                                                                        size={
                                                                            21
                                                                        }
                                                                        className={
                                                                            styles.smallSpinner
                                                                        }
                                                                    />
                                                                ) : task.status ===
                                                                    "COMPLETED" ? (
                                                                    <Check
                                                                        size={
                                                                            15
                                                                        }
                                                                    />
                                                                ) : null}
                                                            </button>


                                                            {/* CONTENT */}

                                                            <div
                                                                className={
                                                                    styles.taskContent
                                                                }
                                                            >
                                                                <div
                                                                    className={
                                                                        styles.taskTitleRow
                                                                    }
                                                                >
                                                                    <h3>
                                                                        {
                                                                            task.title
                                                                        }
                                                                    </h3>


                                                                    <span
                                                                        className={`${styles.priorityBadge} ${getPriorityClass(
                                                                            task.priority
                                                                        )}`}
                                                                    >
                                                                        <Flag
                                                                            size={
                                                                                12
                                                                            }
                                                                        />

                                                                        {getPriorityLabel(
                                                                            task.priority
                                                                        )}
                                                                    </span>
                                                                </div>


                                                                {task.description && (
                                                                    <p>
                                                                        {task.description}
                                                                    </p>
                                                                )}


                                                                <div
                                                                    className={
                                                                        styles.taskMeta
                                                                    }
                                                                >
                                                                    <span>
                                                                        <CalendarDays
                                                                            size={
                                                                                14
                                                                            }
                                                                        />

                                                                        {formatDate(
                                                                            task.dueAt,
                                                                            locale,
                                                                        )}
                                                                    </span>


                                                                    <span
                                                                        className={`${styles.statusBadge} ${getStatusClass(
                                                                            task.status
                                                                        )}`}
                                                                    >
                                                                        {getStatusLabel(
                                                                            task.status
                                                                        )}
                                                                    </span>
                                                                </div>


                                                            </div>


                                                            <div
                                                                className={
                                                                    styles.taskActions
                                                                }
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void editTask(
                                                                            task
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        updatingTaskId === task.id
                                                                    }
                                                                    title="Sửa công việc"
                                                                    aria-label={`Sửa ${task.title}`}
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void removeTask(
                                                                            task
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        updatingTaskId === task.id
                                                                    }
                                                                    title="Xóa công việc"
                                                                    aria-label={`Xóa ${task.title}`}
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </article>
                                    )
                                )
                            )}
                        </div>


                        {/* ===================================
                            SIDE COLUMN
                        =================================== */}

                        <aside
                            className={
                                styles.sideColumn
                            }
                        >

                            {/* PROGRESS */}

                            <article
                                className={
                                    styles.overviewCard
                                }
                            >
                                <div
                                    className={
                                        styles.sideHeader
                                    }
                                >
                                    <Target
                                        size={21}
                                    />

                                    <h2>
                                        Tổng quan
                                        tiến độ
                                    </h2>
                                </div>


                                <div
                                    className={
                                        styles.progressCircle
                                    }
                                    style={{
                                        background:
                                            `conic-gradient(
                                                #2f6f9f 0% ${data.stats.progressPercentage}%,
                                                #e4e9ef ${data.stats.progressPercentage}% 100%
                                            )`,
                                    }}
                                >
                                    <div>
                                        <strong>
                                            {
                                                data.stats
                                                    .progressPercentage
                                            }
                                            %
                                        </strong>

                                        <span>
                                            Hoàn thành
                                        </span>
                                    </div>
                                </div>


                                <div
                                    className={
                                        styles.overviewStats
                                    }
                                >
                                    <div>
                                        <span
                                            className={
                                                styles.overviewDotDone
                                            }
                                        />

                                        <p>
                                            Đã hoàn
                                            thành

                                            <strong>
                                                {
                                                    data.stats
                                                        .completed
                                                }{" "}
                                                công việc
                                            </strong>
                                        </p>
                                    </div>


                                    <div>
                                        <span
                                            className={
                                                styles.overviewDotProgress
                                            }
                                        />

                                        <p>
                                            Đang thực
                                            hiện

                                            <strong>
                                                {
                                                    data.stats
                                                        .inProgress
                                                }{" "}
                                                công việc
                                            </strong>
                                        </p>
                                    </div>


                                    <div>
                                        <span
                                            className={
                                                styles.overviewDotPending
                                            }
                                        />

                                        <p>
                                            Chưa bắt
                                            đầu

                                            <strong>
                                                {
                                                    data.stats
                                                        .pending
                                                }{" "}
                                                công việc
                                            </strong>
                                        </p>
                                    </div>
                                </div>
                            </article>


                            {/* DEADLINE */}

                            <article
                                className={
                                    styles.deadlineCard
                                }
                            >
                                <div
                                    className={
                                        styles.sideHeader
                                    }
                                >
                                    <Clock3
                                        size={21}
                                    />

                                    <h2>
                                        Deadline gần
                                        nhất
                                    </h2>
                                </div>


                                {nearestDeadline ? (
                                    <>
                                        <div
                                            className={
                                                styles.deadlineMain
                                            }
                                        >
                                            <span>
                                                {new Date(
                                                    nearestDeadline.dueAt
                                                ).getDate()}
                                            </span>


                                            <div>
                                                <p>
                                                    {new Intl.DateTimeFormat(
                                                        locale === "en"
                                                            ? "en-US"
                                                            : "vi-VN",
                                                        {
                                                            month:
                                                                "long",

                                                            year:
                                                                "numeric",
                                                        }
                                                    ).format(
                                                        new Date(
                                                            nearestDeadline.dueAt
                                                        )
                                                    )}
                                                </p>


                                                <strong>
                                                    {
                                                        nearestDeadline.title
                                                    }
                                                </strong>


                                                <small>
                                                    {remainingDays ===
                                                        null
                                                        ? ""
                                                        : remainingDays >
                                                            0
                                                            ? `Còn ${remainingDays} ngày`
                                                            : remainingDays ===
                                                                0
                                                                ? "Hôm nay"
                                                                : `Đã quá hạn ${Math.abs(
                                                                    remainingDays
                                                                )} ngày`}
                                                </small>
                                            </div>
                                        </div>


                                        <button
                                            type="button"
                                            className={
                                                styles.deadlineButton
                                            }
                                        >
                                            Xem chi
                                            tiết
                                        </button>
                                    </>
                                ) : (
                                    <div
                                        className={
                                            styles.noDeadline
                                        }
                                    >
                                        <CheckCircle2
                                            size={
                                                30
                                            }
                                        />

                                        <p>
                                            Không có
                                            deadline
                                            sắp tới.
                                        </p>
                                    </div>
                                )}
                            </article>
                        </aside>
                    </section>
                </main>
            </div>


            {/* ===============================================
                ADD TASK MODAL
            =============================================== */}

            {showAddModal && (
                <div
                    className={
                        styles.modalOverlay
                    }
                    onMouseDown={
                        closeAddTaskModal
                    }
                >
                    <div
                        className={
                            styles.modal
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
                                    {targetGroup
                                        ? `Thêm việc vào ${targetGroup.title}`
                                        : "Tạo nhóm công việc"}
                                </h2>

                                <p>
                                    {targetGroup
                                        ? "Các việc mới sẽ nằm chung trong nhóm này."
                                        : "Đặt tiêu đề rõ ràng rồi thêm các công việc bên trong."}
                                </p>
                            </div>


                            <button
                                type="button"
                                onClick={
                                    closeAddTaskModal
                                }
                            >
                                <X
                                    size={20}
                                />
                            </button>
                        </div>


                        <form
                            className={
                                styles.addTaskForm
                            }
                            onSubmit={
                                createTask
                            }
                        >

                            {targetGroup === null && (
                                <div
                                    className={
                                        styles.formGroup
                                    }
                                >
                                    <label
                                        htmlFor="groupTitle"
                                    >
                                        Tiêu đề nhóm công việc
                                    </label>

                                    <input
                                        id="groupTitle"
                                        name="groupTitle"
                                        placeholder="Ví dụ: Công việc tuần 5"
                                        maxLength={255}
                                        required
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div
                                className={
                                    styles.taskDraftSection
                                }
                            >
                                <div
                                    className={
                                        styles.taskDraftHeader
                                    }
                                >
                                    <label>
                                        Các công việc
                                    </label>

                                    <span>
                                        {taskDrafts.length} ô
                                    </span>
                                </div>


                                <div
                                    className={
                                        styles.taskDraftList
                                    }
                                >
                                    {taskDrafts.map(
                                        (
                                            task,
                                            index,
                                        ) => (
                                            <div
                                                key={
                                                    task.id
                                                }
                                                className={
                                                    styles.taskDraftRow
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.taskDraftNumber
                                                    }
                                                >
                                                    {index + 1}
                                                </span>

                                                <input
                                                    value={
                                                        task.title
                                                    }
                                                    onChange={event =>
                                                        updateTaskDraft(
                                                            task.id,
                                                            event.target.value,
                                                        )
                                                    }
                                                    maxLength={255}
                                                    placeholder={`Công việc ${index + 1}`}
                                                    aria-label={`Công việc ${index + 1}`}
                                                    required
                                                    autoFocus={
                                                        targetGroup !== null &&
                                                        index === 0
                                                    }
                                                />

                                                <button
                                                    type="button"
                                                    className={
                                                        styles.removeTaskDraftButton
                                                    }
                                                    onClick={() =>
                                                        removeTaskDraft(
                                                            task.id
                                                        )
                                                    }
                                                    disabled={
                                                        taskDrafts.length === 1
                                                    }
                                                    aria-label={`Xóa ô công việc ${index + 1}`}
                                                >
                                                    <X
                                                        size={16}
                                                    />
                                                </button>
                                            </div>
                                        )
                                    )}
                                </div>


                                <button
                                    type="button"
                                    className={
                                        styles.addTaskDraftButton
                                    }
                                    onClick={
                                        addTaskDraft
                                    }
                                    disabled={
                                        taskDrafts.length >= 50
                                    }
                                >
                                    <Plus
                                        size={16}
                                    />

                                    Thêm một ô công việc
                                </button>
                            </div>


                            {targetGroup === null && (
                                <>
                                    <div
                                        className={
                                            styles.formRow
                                        }
                                    >
                                <div
                                    className={
                                        styles.formGroup
                                    }
                                >
                                    <label
                                        htmlFor="category"
                                    >
                                        Nhóm
                                    </label>

                                    <select
                                        id="category"
                                        name="category"
                                        defaultValue="WEEKLY"
                                    >
                                        <option value="PROFILE">
                                            Chuẩn bị
                                            hồ sơ
                                        </option>

                                        <option value="WEEKLY">
                                            Công việc
                                            trong tuần
                                        </option>

                                        <option value="FINAL">
                                            Hoàn tất
                                            kỳ thực
                                            tập
                                        </option>
                                    </select>
                                </div>


                                <div
                                    className={
                                        styles.formGroup
                                    }
                                >
                                    <label
                                        htmlFor="priority"
                                    >
                                        Ưu tiên
                                    </label>

                                    <select
                                        id="priority"
                                        name="priority"
                                        defaultValue="MEDIUM"
                                    >
                                        <option value="HIGH">
                                            Cao
                                        </option>

                                        <option value="MEDIUM">
                                            Vừa
                                        </option>

                                        <option value="LOW">
                                            Thấp
                                        </option>
                                    </select>
                                </div>
                                    </div>


                                    <div
                                        className={
                                            styles.formGroup
                                        }
                                    >
                                <label
                                    htmlFor="dueAt"
                                >
                                    Deadline
                                </label>

                                <input
                                    id="dueAt"
                                    name="dueAt"
                                    type="datetime-local"
                                />
                                    </div>
                                </>
                            )}


                            <div
                                className={
                                    styles.modalActions
                                }
                            >
                                <button
                                    type="button"
                                    className={
                                        styles.cancelButton
                                    }
                                    onClick={
                                        closeAddTaskModal
                                    }
                                >
                                    Hủy
                                </button>


                                <button
                                    type="submit"
                                    className={
                                        styles.submitButton
                                    }
                                    disabled={
                                        submitting
                                    }
                                >
                                    {submitting ? (
                                        <>
                                            <LoaderCircle
                                                size={
                                                    17
                                                }
                                                className={
                                                    styles.smallSpinner
                                                }
                                            />

                                            Đang tạo...
                                        </>
                                    ) : (
                                        <>
                                            <Plus
                                                size={
                                                    17
                                                }
                                            />

                                            {targetGroup
                                                ? `Thêm ${taskDrafts.length} công việc`
                                                : `Tạo nhóm với ${taskDrafts.length} công việc`}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
