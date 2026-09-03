"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  GraduationCap,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundX,
  UsersRound,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  adminStudentsApi,
  type AdminStudent,
  type AdminStudentGender,
  type AdminStudentType,
} from "@/services/admin-students.service";

import styles from "./page.module.css";

const PAGE_SIZE = 10;

interface StudentFormValues {
  fullName: string;
  email: string;
  phone: string;
  gender: AdminStudentGender | "";
  studentCode: string;
  faculty: string;
  major: string;
  cohort: string;
  gpa: string;
  studentType: AdminStudentType;
  password: string;
  isActive: boolean;
}

const emptyForm: StudentFormValues = {
  fullName: "",
  email: "",
  phone: "",
  gender: "",
  studentCode: "",
  faculty: "",
  major: "",
  cohort: "",
  gpa: "",
  studentType: "INTERNAL",
  password: "",
  isActive: true,
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "SV";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function AdminStudentsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminStudentsApi.list>> | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [studentType, setStudentType] = useState("");
  const [faculty, setFaculty] = useState("");
  const [cohort, setCohort] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<AdminStudent | null>(null);
  const [form, setForm] = useState<StudentFormValues>(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo(() => ({
    search: debouncedSearch,
    status: status || undefined,
    studentType: studentType || undefined,
    faculty: faculty || undefined,
    cohort: cohort || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [cohort, debouncedSearch, faculty, page, status, studentType]);

  const loadStudents = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      setData(await adminStudentsApi.list(query));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách sinh viên.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadStudents(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadStudents]);

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  }

  function openCreate(studentKind: AdminStudentType = "INTERNAL") {
    setFormMode("create");
    setSelected(null);
    setForm({ ...emptyForm, studentType: studentKind });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(student: AdminStudent) {
    setFormMode("edit");
    setSelected(student);
    setForm({
      fullName: student.fullName,
      email: student.email,
      phone: student.phone || "",
      gender: student.gender || "",
      studentCode: student.studentCode,
      faculty: student.faculty || "",
      major: student.major || "",
      cohort: student.cohort || "",
      gpa: student.gpa === null ? "" : String(student.gpa),
      studentType: student.studentType,
      password: "",
      isActive: student.isActive,
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (submitting) return;
    setFormOpen(false);
    setSelected(null);
    setFormError("");
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const gpa = form.gpa.trim() ? Number(form.gpa) : null;
    if (gpa !== null && (Number.isNaN(gpa) || gpa < 0 || gpa > 10)) {
      setFormError("GPA phải nằm trong khoảng từ 0 đến 10.");
      return;
    }

    const common = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      gender: form.gender || null,
      studentCode: form.studentCode.trim().toUpperCase(),
      faculty: form.faculty.trim() || null,
      major: form.major.trim() || null,
      cohort: form.cohort.trim() || null,
      gpa,
      studentType: form.studentType,
    };

    setSubmitting(true);
    try {
      const response = formMode === "create"
        ? await adminStudentsApi.create({ ...common, password: form.password })
        : await adminStudentsApi.update(selected!.id, {
            ...common,
            isActive: form.isActive,
            newPassword: form.password.trim() || null,
          });
      setFormOpen(false);
      setSelected(null);
      notify(response.message);
      await loadStudents(true);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Không thể lưu sinh viên.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivateStudent(student: AdminStudent) {
    if (!student.isActive) return;
    const confirmed = window.confirm(
      `Vô hiệu hóa tài khoản của ${student.fullName}? Dữ liệu học tập và báo cáo sẽ được giữ lại.`,
    );
    if (!confirmed) return;

    setDeletingId(student.id);
    try {
      const response = await adminStudentsApi.deactivate(student.id);
      notify(response.message);
      await loadStudents(true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể vô hiệu hóa sinh viên.");
    } finally {
      setDeletingId(null);
    }
  }

  const summary = data?.summary ?? { total: 0, active: 0, inactive: 0, external: 0 };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><GraduationCap size={15} /> QUẢN LÝ THỰC TẬP</span>
          <h1>Quản lý sinh viên</h1>
          <p>Quản lý tài khoản, hồ sơ học tập và sinh viên ngoài VinUni trong cùng một nơi.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={() => openCreate("EXTERNAL")} type="button">
            <CircleUserRound size={18} /> Thêm sinh viên ngoài
          </button>
          <button className={styles.primaryButton} onClick={() => openCreate()} type="button">
            <Plus size={18} /> Thêm sinh viên
          </button>
        </div>
      </header>

      {message && <div className={styles.successBanner}><CheckCircle2 size={18} />{message}</div>}
      {error && <div className={styles.errorBanner}><AlertCircle size={18} />{error}<button onClick={() => setError("")} type="button"><X size={16} /></button></div>}

      <section className={styles.statsGrid}>
        <StatCard icon={UsersRound} label="Tổng sinh viên" value={summary.total} tone="blue" />
        <StatCard icon={UserCheck} label="Đang hoạt động" value={summary.active} tone="green" />
        <StatCard icon={UserRoundX} label="Đã vô hiệu hóa" value={summary.inactive} tone="red" />
        <StatCard icon={GraduationCap} label="Sinh viên ngoài" value={summary.external} tone="purple" />
      </section>

      <section className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input aria-label="Tìm sinh viên" onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, email, mã sinh viên, khoa..." value={search} />
            {search && <button aria-label="Xóa từ khóa" onClick={() => setSearch("")} type="button"><X size={15} /></button>}
          </div>
          <select aria-label="Trạng thái" onChange={(event) => { setStatus(event.target.value); setPage(1); }} value={status}>
            <option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Đã vô hiệu hóa</option>
          </select>
          <select aria-label="Loại sinh viên" onChange={(event) => { setStudentType(event.target.value); setPage(1); }} value={studentType}>
            <option value="">Mọi loại sinh viên</option><option value="INTERNAL">Sinh viên VinUni</option><option value="EXTERNAL">Sinh viên ngoài</option>
          </select>
          <select aria-label="Khoa" onChange={(event) => { setFaculty(event.target.value); setPage(1); }} value={faculty}>
            <option value="">Tất cả khoa</option>{data?.filters.faculties.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select aria-label="Khóa" onChange={(event) => { setCohort(event.target.value); setPage(1); }} value={cohort}>
            <option value="">Tất cả khóa</option>{data?.filters.cohorts.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button aria-label="Làm mới" className={styles.refreshButton} disabled={refreshing} onClick={() => void loadStudents(true)} type="button"><RefreshCw className={refreshing ? styles.spin : ""} size={18} /></button>
        </div>

        <div className={styles.tableHeader}><div><h2>Danh sách sinh viên</h2><p>{data?.total ?? 0} kết quả phù hợp</p></div></div>

        {loading ? (
          <div className={styles.state}><Loader2 className={styles.spin} size={30} /><strong>Đang tải sinh viên...</strong></div>
        ) : data?.items.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Sinh viên</th><th>Mã SV</th><th>Học tập</th><th>Loại</th><th>Tài khoản</th><th>Ngày thêm</th><th>Thao tác</th></tr></thead>
              <tbody>{data.items.map((student) => (
                <tr key={student.id}>
                  <td><div className={styles.studentCell}><span>{initials(student.fullName)}</span><div><strong>{student.fullName}</strong><small><Mail size={12} />{student.email}</small></div></div></td>
                  <td><strong className={styles.code}>{student.studentCode}</strong><small className={styles.muted}>{student.cohort || "Chưa có khóa"}</small></td>
                  <td><strong>{student.major || "Chưa cập nhật"}</strong><small className={styles.muted}>{student.faculty || "Chưa cập nhật khoa"}</small></td>
                  <td><span className={`${styles.badge} ${student.studentType === "EXTERNAL" ? styles.externalBadge : styles.internalBadge}`}>{student.studentType === "EXTERNAL" ? "Ngoài trường" : "VinUni"}</span></td>
                  <td><span className={`${styles.status} ${student.isActive ? styles.activeStatus : styles.inactiveStatus}`}><i />{student.isActive ? "Hoạt động" : "Vô hiệu hóa"}</span><small className={styles.muted}>{student.accountStatus === "REGISTERED" ? "Đã có mật khẩu" : "Chờ kích hoạt"}</small></td>
                  <td>{formatDate(student.createdAt)}</td>
                  <td><div className={styles.rowActions}><button aria-label={`Sửa ${student.fullName}`} onClick={() => openEdit(student)} title="Chỉnh sửa" type="button"><Pencil size={16} /></button><button aria-label={`Xóa ${student.fullName}`} className={styles.deleteButton} disabled={!student.isActive || deletingId === student.id} onClick={() => void deactivateStudent(student)} title={student.isActive ? "Vô hiệu hóa" : "Đã vô hiệu hóa"} type="button">{deletingId === student.id ? <Loader2 className={styles.spin} size={16} /> : <Trash2 size={16} />}</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className={styles.state}><UsersRound size={38} /><strong>Không tìm thấy sinh viên</strong><p>Thử thay đổi từ khóa hoặc bộ lọc, hoặc thêm một sinh viên mới.</p></div>
        )}

        {data && data.totalPages > 1 && <footer className={styles.pagination}><span>Trang {data.page}/{data.totalPages}</span><div><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button"><ChevronLeft size={17} />Trước</button><button disabled={page >= data.totalPages} onClick={() => setPage((current) => current + 1)} type="button">Sau<ChevronRight size={17} /></button></div></footer>}
      </section>

      {formOpen && (
        <div className={styles.modalBackdrop} onMouseDown={closeForm}>
          <form className={styles.modal} onMouseDown={(event) => event.stopPropagation()} onSubmit={submitForm}>
            <header><div><span>{formMode === "create" ? "TẠO HỒ SƠ MỚI" : `CHỈNH SỬA · ${selected?.studentCode}`}</span><h2>{formMode === "create" ? "Thêm sinh viên" : "Cập nhật sinh viên"}</h2><p>Sinh viên ngoài trường có thể sử dụng email cá nhân hoặc email của trường khác.</p></div><button aria-label="Đóng" onClick={closeForm} type="button"><X size={19} /></button></header>
            <div className={styles.modalBody}>
              {formError && <div className={styles.formError}><AlertCircle size={17} />{formError}</div>}
              <div className={styles.sectionTitle}><CircleUserRound size={17} /><div><strong>Thông tin tài khoản</strong><span>Thông tin nhận diện và đăng nhập</span></div></div>
              <div className={styles.formGrid}>
                <label><span>Loại sinh viên *</span><select value={form.studentType} onChange={(event) => setForm({ ...form, studentType: event.target.value as AdminStudentType })}><option value="INTERNAL">Sinh viên VinUni</option><option value="EXTERNAL">Sinh viên ngoài trường</option></select></label>
                <label><span>Mã sinh viên *</span><input maxLength={50} required value={form.studentCode} onChange={(event) => setForm({ ...form, studentCode: event.target.value })} placeholder="Ví dụ: S2026001" /></label>
                <label className={styles.fullField}><span>Họ và tên *</span><input maxLength={150} required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nhập họ tên đầy đủ" /></label>
                <label><span>Email *</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={form.studentType === "INTERNAL" ? "name@vinuni.edu.vn" : "name@example.com"} /></label>
                <label><span>Số điện thoại</span><input maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Số điện thoại liên hệ" /></label>
                <label><span>Giới tính</span><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as AdminStudentGender | "" })}><option value="">Chưa cập nhật</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label>
                <label><span>{formMode === "create" ? "Mật khẩu tạm thời *" : "Đặt mật khẩu mới"}</span><input minLength={8} required={formMode === "create"} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={formMode === "create" ? "Tối thiểu 8 ký tự" : "Để trống nếu không đổi"} /></label>
              </div>
              <div className={styles.sectionTitle}><GraduationCap size={17} /><div><strong>Thông tin học tập</strong><span>Khoa, ngành, khóa học và GPA</span></div></div>
              <div className={styles.formGrid}>
                <label><span>Khoa / Viện</span><input maxLength={150} value={form.faculty} onChange={(event) => setForm({ ...form, faculty: event.target.value })} placeholder="Khoa Công nghệ thông tin" /></label>
                <label><span>Chuyên ngành</span><input maxLength={150} value={form.major} onChange={(event) => setForm({ ...form, major: event.target.value })} placeholder="Khoa học máy tính" /></label>
                <label><span>Khóa</span><input maxLength={50} value={form.cohort} onChange={(event) => setForm({ ...form, cohort: event.target.value })} placeholder="Ví dụ: 2024" /></label>
                <label><span>GPA (thang 10)</span><input max="10" min="0" step="0.01" type="number" value={form.gpa} onChange={(event) => setForm({ ...form, gpa: event.target.value })} placeholder="0.00" /></label>
                {formMode === "edit" && <label className={styles.statusToggle}><input checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} type="checkbox" /><span><strong>Tài khoản đang hoạt động</strong><small>Tắt để ngăn sinh viên đăng nhập nhưng vẫn giữ dữ liệu.</small></span></label>}
              </div>
            </div>
            <footer><span><ShieldCheck size={15} /> Chỉ Admin có quyền thực hiện thao tác này.</span><div><button disabled={submitting} onClick={closeForm} type="button">Hủy</button><button className={styles.primaryButton} disabled={submitting} type="submit">{submitting ? <Loader2 className={styles.spin} size={17} /> : formMode === "create" ? <Plus size={17} /> : <Pencil size={17} />}{formMode === "create" ? "Thêm sinh viên" : "Lưu thay đổi"}</button></div></footer>
          </form>
        </div>
      )}
    </main>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof UsersRound; label: string; value: number; tone: "blue" | "green" | "red" | "purple" }) {
  return <article className={styles.statCard}><span className={styles[tone]}><Icon size={21} /></span><div><strong>{value.toLocaleString("vi-VN")}</strong><small>{label}</small></div></article>;
}
