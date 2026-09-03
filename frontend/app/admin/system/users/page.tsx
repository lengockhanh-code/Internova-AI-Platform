"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  GraduationCap,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserCog,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  adminUsersApi,
  type AdminUser,
  type AdminUserRole,
  type AdminUsersResponse,
} from "@/services/admin-users.service";

import styles from "./page.module.css";

const PAGE_SIZE = 12;

const ROLE_META: Record<AdminUserRole, { label: string; scope: string }> = {
  ADMIN: { label: "Quản trị viên", scope: "Toàn bộ Admin Console" },
  LECTURER: { label: "Giảng viên", scope: "Sinh viên và kỳ thực tập được phân công" },
  STUDENT: { label: "Sinh viên", scope: "Hồ sơ và quy trình thực tập cá nhân" },
};

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  identityCode: string;
  faculty: string;
  password: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  phone: "",
  role: "STUDENT",
  identityCode: "",
  faculty: "",
  password: "",
  isActive: true,
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map(part => part[0] || "").join("").toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default function AdminUsersPage() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [authProvider, setAuthProvider] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => ({
    search: debouncedSearch || undefined,
    role: role || undefined,
    status: status || undefined,
    authProvider: authProvider || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [authProvider, debouncedSearch, page, role, status]);

  const loadUsers = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await adminUsersApi.list(query);
      setData(response);
      if (response.page !== page) setPage(response.page);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách tài khoản.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    if (!formOpen && !statusTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (formOpen && !submitting) {
        setFormOpen(false);
        setSelected(null);
        setFormError("");
      }
      if (statusTarget && !statusBusy) setStatusTarget(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [formOpen, statusBusy, statusTarget, submitting]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  };

  const openCreate = () => {
    setFormMode("create");
    setSelected(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setFormMode("edit");
    setSelected(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      identityCode: user.identityCode || "",
      faculty: user.faculty || "",
      password: "",
      isActive: user.isActive,
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setSelected(null);
    setFormError("");
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (form.role !== "ADMIN" && !form.identityCode.trim()) {
      setFormError("Mã định danh là bắt buộc cho sinh viên và giảng viên.");
      return;
    }

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      role: form.role,
      isActive: form.isActive,
      identityCode: form.role === "ADMIN" ? null : form.identityCode.trim().toUpperCase(),
      faculty: form.role === "ADMIN" ? null : form.faculty.trim() || null,
    };

    setSubmitting(true);
    try {
      const response = formMode === "create"
        ? await adminUsersApi.create({ ...payload, password: form.password })
        : await adminUsersApi.update(selected!.id, payload);
      setFormOpen(false);
      setSelected(null);
      setFormError("");
      notify(response.message);
      await loadUsers(true);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Không thể lưu tài khoản.");
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    setStatusBusy(true);
    try {
      const response = await adminUsersApi.setStatus(statusTarget.id, !statusTarget.isActive);
      setStatusTarget(null);
      notify(response.message);
      await loadUsers(true);
    } catch (statusError) {
      setStatusTarget(null);
      setError(statusError instanceof Error ? statusError.message : "Không thể thay đổi trạng thái tài khoản.");
    } finally {
      setStatusBusy(false);
    }
  };

  const summary = data?.summary ?? { total: 0, active: 0, inactive: 0, students: 0, lecturers: 0, admins: 0, pending: 0 };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><ShieldCheck size={15} /> HỆ THỐNG</span>
          <h1>Users & Roles</h1>
          <p>Quản lý tài khoản, trạng thái truy cập và vai trò hệ thống.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} disabled={refreshing} onClick={() => void loadUsers(true)} title="Làm mới" type="button"><RefreshCw className={refreshing ? styles.spin : ""} size={17} /></button>
          <button className={styles.primaryButton} onClick={openCreate} type="button"><Plus size={17} />Tạo tài khoản</button>
        </div>
      </header>

      {message && <div className={styles.successBanner}><CheckCircle2 size={17} />{message}</div>}
      {error && <div className={styles.errorBanner} role="alert"><AlertCircle size={17} /><span>{error}</span><button aria-label="Đóng" onClick={() => setError("")} title="Đóng" type="button"><X size={16} /></button></div>}

      <section className={styles.statsGrid}>
        <article><Users /><span>Tổng tài khoản<strong>{summary.total}</strong><small>{summary.pending} chờ kích hoạt</small></span></article>
        <article><UserCheck /><span>Đang hoạt động<strong>{summary.active}</strong><small>{summary.total ? Math.round(summary.active * 100 / summary.total) : 0}% tổng tài khoản</small></span></article>
        <article><UserRoundX /><span>Đã vô hiệu hóa<strong>{summary.inactive}</strong><small>Không thể đăng nhập</small></span></article>
        <article><ShieldCheck /><span>Quản trị viên<strong>{summary.admins}</strong><small>Quyền hệ thống cao nhất</small></span></article>
      </section>

      <section className={styles.rolesBand} aria-label="Tổng quan vai trò">
        {(["ADMIN", "LECTURER", "STUDENT"] as AdminUserRole[]).map(itemRole => {
          const count = itemRole === "ADMIN" ? summary.admins : itemRole === "LECTURER" ? summary.lecturers : summary.students;
          const Icon = itemRole === "ADMIN" ? ShieldCheck : itemRole === "LECTURER" ? UserCog : GraduationCap;
          return (
            <button className={role === itemRole ? styles.roleSelected : ""} key={itemRole} onClick={() => { setRole(role === itemRole ? "" : itemRole); setPage(1); }} type="button">
              <span className={`${styles.roleIcon} ${styles[`role${itemRole}`]}`}><Icon size={18} /></span>
              <span><strong>{ROLE_META[itemRole].label}</strong><small>{ROLE_META[itemRole].scope}</small></span>
              <em>{count}</em>
            </button>
          );
        })}
      </section>

      <section className={styles.userPanel}>
        <div className={styles.toolbar}>
          <label className={styles.searchBox}><Search size={16} /><input aria-label="Tìm tài khoản" onChange={event => setSearch(event.target.value)} placeholder="Tên, email, mã định danh, khoa..." value={search} />{search && <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")} title="Xóa tìm kiếm" type="button"><X size={14} /></button>}</label>
          <select aria-label="Vai trò" onChange={event => { setRole(event.target.value); setPage(1); }} value={role}><option value="">Tất cả vai trò</option><option value="ADMIN">Quản trị viên</option><option value="LECTURER">Giảng viên</option><option value="STUDENT">Sinh viên</option></select>
          <select aria-label="Trạng thái" onChange={event => { setStatus(event.target.value); setPage(1); }} value={status}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Đã vô hiệu hóa</option></select>
          <select aria-label="Phương thức đăng nhập" onChange={event => { setAuthProvider(event.target.value); setPage(1); }} value={authProvider}><option value="">Mọi phương thức</option><option value="LOCAL">Mật khẩu</option><option value="GOOGLE">Google</option></select>
        </div>
        <header className={styles.tableTitle}><div><h2>Danh sách tài khoản</h2><p>{data?.total ?? 0} kết quả phù hợp</p></div><span>Trang {data?.page ?? 1}/{data?.totalPages ?? 1}</span></header>

        {loading ? (
          <div className={styles.state}><Loader2 className={styles.spin} /><strong>Đang tải tài khoản...</strong></div>
        ) : data?.items.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Hồ sơ</th><th>Đăng nhập</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
              <tbody>{data.items.map(user => {
                const isSelf = user.id === data.currentUserId;
                return (
                  <tr key={user.id}>
                    <td><div className={styles.userCell}><span>{initials(user.fullName)}</span><div><strong>{user.fullName}{isSelf && <em>Bạn</em>}</strong><small><Mail size={11} />{user.email}</small></div></div></td>
                    <td><span className={`${styles.roleBadge} ${styles[`role${user.role}`]}`}>{ROLE_META[user.role].label}</span></td>
                    <td><strong className={styles.profileCode}>{user.identityCode || "Không áp dụng"}</strong><small className={styles.muted}>{user.faculty || ROLE_META[user.role].scope}</small></td>
                    <td><span className={styles.authMethod}>{user.authProvider === "GOOGLE" ? "Google" : "Mật khẩu"}</span><small className={styles.muted}>{user.accountStatus === "REGISTERED" ? "Đã đăng ký" : "Chờ kích hoạt"}</small></td>
                    <td><span className={`${styles.accountStatus} ${user.isActive ? styles.active : styles.inactive}`}><i />{user.isActive ? "Hoạt động" : "Vô hiệu hóa"}</span></td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td><div className={styles.rowActions}><button aria-label={`Chỉnh sửa ${user.fullName}`} onClick={() => openEdit(user)} title="Chỉnh sửa" type="button"><Pencil size={15} /></button><button aria-label={`${user.isActive ? "Vô hiệu hóa" : "Kích hoạt"} ${user.fullName}`} className={user.isActive ? styles.deactivateButton : styles.activateButton} disabled={isSelf} onClick={() => setStatusTarget(user)} title={isSelf ? "Không thể thay đổi trạng thái của chính bạn" : user.isActive ? "Vô hiệu hóa" : "Kích hoạt"} type="button">{user.isActive ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}</button></div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className={styles.state}><CircleUserRound size={34} /><strong>Không tìm thấy tài khoản</strong><p>Không có người dùng phù hợp với từ khóa và bộ lọc hiện tại.</p></div>
        )}

        {data && data.totalPages > 1 && <footer className={styles.pagination}><span>Hiển thị trang {data.page} trên {data.totalPages}</span><div><button aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} title="Trang trước" type="button"><ChevronLeft size={17} /></button><button aria-label="Trang sau" disabled={page >= data.totalPages} onClick={() => setPage(current => current + 1)} title="Trang sau" type="button"><ChevronRight size={17} /></button></div></footer>}
      </section>

      {formOpen && (
        <div className={styles.modalBackdrop} onMouseDown={closeForm}>
          <form className={styles.modal} onMouseDown={event => event.stopPropagation()} onSubmit={submitForm}>
            <header><div><span>{formMode === "create" ? "NEW ACCOUNT" : `USER #${selected?.id}`}</span><h2>{formMode === "create" ? "Tạo tài khoản" : "Cập nhật người dùng"}</h2><p>Thông tin đăng nhập và phạm vi truy cập hệ thống.</p></div><button aria-label="Đóng" onClick={closeForm} title="Đóng" type="button"><X size={18} /></button></header>
            <div className={styles.modalBody}>
              {formError && <div className={styles.formError}><AlertCircle size={16} />{formError}</div>}
              <div className={styles.formSection}><CircleUserRound size={17} /><div><strong>Thông tin tài khoản</strong><span>Nhận diện và liên hệ người dùng</span></div></div>
              <div className={styles.formGrid}>
                <label className={styles.fullField}><span>Họ và tên *</span><input maxLength={150} onChange={event => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} /></label>
                <label><span>Email *</span><input onChange={event => setForm({ ...form, email: event.target.value })} required type="email" value={form.email} /></label>
                <label><span>Số điện thoại</span><input maxLength={30} onChange={event => setForm({ ...form, phone: event.target.value })} value={form.phone} /></label>
                {formMode === "create" && <label className={styles.fullField}><span>Mật khẩu tạm thời *</span><div className={styles.passwordField}><KeyRound size={15} /><input minLength={8} onChange={event => setForm({ ...form, password: event.target.value })} required type="password" value={form.password} /></div><small>Tối thiểu 8 ký tự.</small></label>}
              </div>
              <div className={styles.formSection}><ShieldCheck size={17} /><div><strong>Vai trò và quyền truy cập</strong><span>Role được kiểm tra lại ở mọi API bảo vệ</span></div></div>
              <div className={styles.formGrid}>
                <label><span>Vai trò *</span><select disabled={selected?.id === data?.currentUserId} onChange={event => setForm({ ...form, role: event.target.value as AdminUserRole, identityCode: event.target.value === "ADMIN" ? "" : form.identityCode, faculty: event.target.value === "ADMIN" ? "" : form.faculty })} value={form.role}><option value="STUDENT">Sinh viên</option><option value="LECTURER">Giảng viên</option><option value="ADMIN">Quản trị viên</option></select></label>
                <label><span>Trạng thái *</span><select disabled={selected?.id === data?.currentUserId} onChange={event => setForm({ ...form, isActive: event.target.value === "ACTIVE" })} value={form.isActive ? "ACTIVE" : "INACTIVE"}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Vô hiệu hóa</option></select></label>
                {form.role !== "ADMIN" && <><label><span>{form.role === "STUDENT" ? "Mã sinh viên" : "Mã giảng viên"} *</span><input maxLength={50} onChange={event => setForm({ ...form, identityCode: event.target.value })} required value={form.identityCode} /></label><label><span>Khoa / Viện</span><input maxLength={150} onChange={event => setForm({ ...form, faculty: event.target.value })} value={form.faculty} /></label></>}
              </div>
              <div className={styles.roleScope}><span className={`${styles.roleIcon} ${styles[`role${form.role}`]}`}><ShieldCheck size={17} /></span><div><strong>{ROLE_META[form.role].label}</strong><p>{ROLE_META[form.role].scope}</p></div></div>
            </div>
            <footer><span><ShieldCheck size={14} />Thao tác được bảo vệ bởi quyền ADMIN.</span><div><button disabled={submitting} onClick={closeForm} type="button">Hủy</button><button className={styles.primaryButton} disabled={submitting} type="submit">{submitting ? <Loader2 className={styles.spin} size={16} /> : formMode === "create" ? <Plus size={16} /> : <Pencil size={16} />}{formMode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}</button></div></footer>
          </form>
        </div>
      )}

      {statusTarget && (
        <div className={styles.modalBackdrop} onMouseDown={() => !statusBusy && setStatusTarget(null)}>
          <section aria-labelledby="status-title" aria-modal="true" className={styles.confirmModal} onMouseDown={event => event.stopPropagation()} role="dialog">
            <div className={statusTarget.isActive ? styles.confirmDangerIcon : styles.confirmSuccessIcon}>{statusTarget.isActive ? <UserRoundX size={21} /> : <UserCheck size={21} />}</div>
            <h2 id="status-title">{statusTarget.isActive ? "Vô hiệu hóa tài khoản?" : "Kích hoạt lại tài khoản?"}</h2>
            <p><strong>{statusTarget.fullName}</strong> · {statusTarget.email}</p>
            <span>{statusTarget.isActive ? "Người dùng sẽ không thể đăng nhập nhưng toàn bộ dữ liệu vẫn được giữ lại." : "Người dùng có thể đăng nhập lại ngay sau khi được kích hoạt."}</span>
            <footer><button disabled={statusBusy} onClick={() => setStatusTarget(null)} type="button">Hủy</button><button className={statusTarget.isActive ? styles.dangerConfirm : styles.successConfirm} disabled={statusBusy} onClick={() => void changeStatus()} type="button">{statusBusy ? <Loader2 className={styles.spin} size={16} /> : statusTarget.isActive ? <UserRoundX size={16} /> : <UserCheck size={16} />}{statusTarget.isActive ? "Vô hiệu hóa" : "Kích hoạt"}</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
