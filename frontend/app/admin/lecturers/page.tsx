"use client";

import {
  AlertCircle,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Eye,
  GraduationCap,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundCog,
  UsersRound,
  UserX,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  adminLecturersApi,
  type AdminLecturer,
  type AdminLecturerGender,
  type AdminLecturerWorkload,
} from "@/services/admin-lecturers.service";

import styles from "./page.module.css";

const PAGE_SIZE = 12;

const workloadLabels: Record<AdminLecturerWorkload, string> = {
  AVAILABLE: "Sẵn sàng phân công",
  ASSIGNED: "Đang hướng dẫn",
  HIGH: "Tải hướng dẫn cao",
};

interface LecturerForm {
  fullName: string;
  email: string;
  phone: string;
  gender: AdminLecturerGender | "";
  lecturerCode: string;
  academicTitle: string;
  faculty: string;
  specialization: string;
  password: string;
  isActive: boolean;
}

const emptyForm: LecturerForm = {
  fullName: "",
  email: "",
  phone: "",
  gender: "",
  lecturerCode: "",
  academicTitle: "",
  faculty: "",
  specialization: "",
  password: "",
  isActive: true,
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "GV";
}

function formatDate(value: string | null): string {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default function AdminLecturersPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminLecturersApi.list>> | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [faculty, setFaculty] = useState("");
  const [academicTitle, setAcademicTitle] = useState("");
  const [workload, setWorkload] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<AdminLecturer | null>(null);
  const [detail, setDetail] = useState<AdminLecturer | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminLecturer | null>(null);
  const [form, setForm] = useState<LecturerForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => ({
    search: debouncedSearch,
    status: status || undefined,
    faculty: faculty || undefined,
    academicTitle: academicTitle || undefined,
    workload: workload || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [academicTitle, debouncedSearch, faculty, page, status, workload]);

  const loadLecturers = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      setData(await adminLecturersApi.list(query));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách giảng viên.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLecturers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLecturers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!submitting) setFormOpen(false);
      if (!statusBusy) setStatusTarget(null);
      setDetail(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [statusBusy, submitting]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  };

  const openCreate = () => {
    setFormMode("create");
    setSelected(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (lecturer: AdminLecturer) => {
    setDetail(null);
    setFormMode("edit");
    setSelected(lecturer);
    setForm({
      fullName: lecturer.fullName,
      email: lecturer.email,
      phone: lecturer.phone || "",
      gender: lecturer.gender || "",
      lecturerCode: lecturer.lecturerCode,
      academicTitle: lecturer.academicTitle || "",
      faculty: lecturer.faculty || "",
      specialization: lecturer.specialization || "",
      password: "",
      isActive: lecturer.isActive,
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
    const common = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      gender: form.gender || null,
      lecturerCode: form.lecturerCode.trim().toUpperCase(),
      academicTitle: form.academicTitle.trim() || null,
      faculty: form.faculty.trim() || null,
      specialization: form.specialization.trim() || null,
    };
    setSubmitting(true);
    try {
      const response = formMode === "create"
        ? await adminLecturersApi.create({ ...common, password: form.password, isActive: form.isActive })
        : await adminLecturersApi.update(selected!.id, {
            ...common,
            isActive: form.isActive,
            newPassword: form.password.trim() || null,
          });
      setFormOpen(false);
      setSelected(null);
      notify(response.message);
      await loadLecturers(true);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Không thể lưu giảng viên.");
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    setStatusBusy(true);
    try {
      const response = statusTarget.isActive
        ? await adminLecturersApi.deactivate(statusTarget.id)
        : await adminLecturersApi.setStatus(statusTarget.id, true);
      setStatusTarget(null);
      setDetail(null);
      notify(response.message);
      await loadLecturers(true);
    } catch (statusError) {
      setStatusTarget(null);
      setError(statusError instanceof Error ? statusError.message : "Không thể thay đổi trạng thái giảng viên.");
    } finally {
      setStatusBusy(false);
    }
  };

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const summary = data?.summary ?? {
    total: 0, active: 0, inactive: 0, assignedStudents: 0,
    pendingReviews: 0, available: 0, assigned: 0, highWorkload: 0, averageLoad: 0,
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}><GraduationCap size={15} /> QUẢN LÝ NHÂN SỰ</span><h1>Quản lý giảng viên</h1><p>Quản lý hồ sơ chuyên môn, tài khoản và tải hướng dẫn thực tập của giảng viên.</p></div>
        <div className={styles.headerActions}><button className={styles.iconButton} disabled={refreshing} onClick={() => void loadLecturers(true)} title="Làm mới" type="button"><RefreshCw className={refreshing ? styles.spin : ""} size={17} /></button><button className={styles.primaryButton} onClick={openCreate} type="button"><Plus size={17} />Thêm giảng viên</button></div>
      </header>

      {message && <div className={styles.successBanner}><CheckCircle2 size={17} />{message}</div>}
      {error && <div className={styles.errorBanner} role="alert"><AlertCircle size={17} /><span>{error}</span><button aria-label="Đóng" onClick={() => setError("")} title="Đóng" type="button"><X size={16} /></button></div>}

      <section className={styles.statsGrid}>
        <article><span><UsersRound size={20} /></span><div><small>TỔNG GIẢNG VIÊN</small><strong>{summary.total}</strong><em>{summary.active} tài khoản hoạt động</em></div></article>
        <article><span><BookOpenCheck size={20} /></span><div><small>SINH VIÊN ĐANG HƯỚNG DẪN</small><strong>{summary.assignedStudents}</strong><em>Trung bình {summary.averageLoad}/giảng viên</em></div></article>
        <article><span><BriefcaseBusiness size={20} /></span><div><small>HỒ SƠ CHỜ XỬ LÝ</small><strong>{summary.pendingReviews}</strong><em>Cần xét duyệt hoặc theo dõi</em></div></article>
        <article><span><UserCheck size={20} /></span><div><small>SẴN SÀNG PHÂN CÔNG</small><strong>{summary.available}</strong><em>{summary.highWorkload} giảng viên tải cao</em></div></article>
      </section>

      <section className={styles.workloadBand}>
        <button className={workload === "AVAILABLE" ? styles.bandActive : ""} onClick={() => setFilter(setWorkload, workload === "AVAILABLE" ? "" : "AVAILABLE")} type="button"><span className={styles.availableIcon}><UserCheck size={17} /></span><span><strong>Sẵn sàng</strong><small>Chưa có sinh viên được phân công</small></span><em>{summary.available}</em></button>
        <button className={workload === "ASSIGNED" ? styles.bandActive : ""} onClick={() => setFilter(setWorkload, workload === "ASSIGNED" ? "" : "ASSIGNED")} type="button"><span className={styles.assignedIcon}><GraduationCap size={17} /></span><span><strong>Đang hướng dẫn</strong><small>Có tải hướng dẫn trong ngưỡng</small></span><em>{summary.assigned}</em></button>
        <button className={workload === "HIGH" ? styles.bandActive : ""} onClick={() => setFilter(setWorkload, workload === "HIGH" ? "" : "HIGH")} type="button"><span className={styles.highIcon}><AlertCircle size={17} /></span><span><strong>Tải cao</strong><small>Từ 12 sinh viên hoặc 8 kỳ đang chạy</small></span><em>{summary.highWorkload}</em></button>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.searchBox}><Search size={16} /><input aria-label="Tìm giảng viên" onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, email, mã GV, khoa hoặc chuyên môn..." value={search} />{search && <button aria-label="Xóa từ khóa" onClick={() => setSearch("")} title="Xóa" type="button"><X size={14} /></button>}</label>
          <select aria-label="Trạng thái" onChange={(event) => setFilter(setStatus, event.target.value)} value={status}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Đã vô hiệu hóa</option></select>
          <select aria-label="Khoa viện" onChange={(event) => setFilter(setFaculty, event.target.value)} value={faculty}><option value="">Tất cả khoa / viện</option>{data?.filters.faculties.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Học hàm học vị" onChange={(event) => setFilter(setAcademicTitle, event.target.value)} value={academicTitle}><option value="">Mọi học hàm / học vị</option>{data?.filters.academicTitles.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Tải hướng dẫn" onChange={(event) => setFilter(setWorkload, event.target.value)} value={workload}><option value="">Mọi tải hướng dẫn</option><option value="AVAILABLE">Sẵn sàng phân công</option><option value="ASSIGNED">Đang hướng dẫn</option><option value="HIGH">Tải cao</option></select>
        </div>
        <div className={styles.tableTitle}><div><h2>Danh sách giảng viên</h2><p>{data?.total ?? 0} kết quả phù hợp</p></div><span>{summary.inactive} tài khoản đã vô hiệu hóa</span></div>

        {loading ? <div className={styles.state}><Loader2 className={styles.spin} size={28} /><strong>Đang tải giảng viên...</strong></div> : data?.items.length ? <div className={styles.tableWrap}><table><thead><tr><th>GIẢNG VIÊN</th><th>HỌC HÀM / KHOA</th><th>CHUYÊN MÔN</th><th>TẢI HƯỚNG DẪN</th><th>TÀI KHOẢN</th><th>CẬP NHẬT</th><th>THAO TÁC</th></tr></thead><tbody>{data.items.map((lecturer) => <tr key={lecturer.id} onClick={() => setDetail(lecturer)}><td><div className={styles.lecturerCell}><i>{initials(lecturer.fullName)}</i><span><strong>{lecturer.fullName}</strong><small><Mail size={11} />{lecturer.email}</small><em>{lecturer.lecturerCode}</em></span></div></td><td><strong>{lecturer.academicTitle || "Chưa cập nhật"}</strong><small className={styles.muted}>{lecturer.faculty || "Chưa cập nhật khoa / viện"}</small></td><td><p className={styles.specialization}>{lecturer.specialization || "Chưa cập nhật chuyên môn"}</p></td><td><div className={styles.loadCell}><span className={`${styles.workloadBadge} ${styles[`workload${lecturer.workload}`]}`}>{workloadLabels[lecturer.workload]}</span><small><b>{lecturer.assignedStudents}</b> sinh viên · <b>{lecturer.pendingReviews}</b> chờ duyệt</small></div></td><td><span className={`${styles.statusBadge} ${lecturer.isActive ? styles.active : styles.inactive}`}><i />{lecturer.isActive ? "Hoạt động" : "Vô hiệu hóa"}</span><small className={styles.muted}>{lecturer.accountStatus === "REGISTERED" ? lecturer.authProvider : "Chờ kích hoạt"}</small></td><td><strong className={styles.date}>{formatDate(lecturer.updatedAt)}</strong><small className={styles.muted}>Thêm {formatDate(lecturer.createdAt)}</small></td><td><div className={styles.rowActions}><button onClick={(event) => { event.stopPropagation(); setDetail(lecturer); }} title="Xem chi tiết" type="button"><Eye size={15} /></button><button onClick={(event) => { event.stopPropagation(); openEdit(lecturer); }} title="Chỉnh sửa" type="button"><Pencil size={15} /></button><button className={lecturer.isActive ? styles.deleteButton : styles.activateButton} onClick={(event) => { event.stopPropagation(); setStatusTarget(lecturer); }} title={lecturer.isActive ? "Vô hiệu hóa" : "Kích hoạt lại"} type="button">{lecturer.isActive ? <Trash2 size={15} /> : <UserCheck size={15} />}</button></div></td></tr>)}</tbody></table></div> : <div className={styles.state}><UserRoundCog size={34} /><strong>Không tìm thấy giảng viên</strong><p>Thay đổi từ khóa, bộ lọc hoặc thêm hồ sơ giảng viên mới.</p></div>}

        {data && data.totalPages > 1 && <footer className={styles.pagination}><span>Trang {data.page}/{data.totalPages} · {data.total} giảng viên</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} title="Trang trước" type="button"><ChevronLeft size={16} /></button><button disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)} title="Trang sau" type="button"><ChevronRight size={16} /></button></div></footer>}
      </section>

      {formOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}><form className={styles.modal} onSubmit={submitForm}><header><div><span>{formMode === "create" ? "HỒ SƠ GIẢNG VIÊN MỚI" : `CHỈNH SỬA · ${selected?.lecturerCode}`}</span><h2>{formMode === "create" ? "Thêm giảng viên" : "Cập nhật giảng viên"}</h2><p>Thông tin tài khoản và hồ sơ chuyên môn trong hệ thống thực tập.</p></div><button aria-label="Đóng" onClick={closeForm} title="Đóng" type="button"><X size={18} /></button></header><div className={styles.modalBody}>{formError && <div className={styles.formError}><AlertCircle size={16} />{formError}</div>}<div className={styles.sectionTitle}><CircleUserRound size={16} /><div><strong>Thông tin tài khoản</strong><span>Nhận diện và thông tin đăng nhập</span></div></div><div className={styles.formGrid}><label className={styles.fullField}><span>Họ và tên *</span><input maxLength={150} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nhập họ tên đầy đủ" required value={form.fullName} /></label><label><span>Email *</span><input onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="lecturer@vinuni.edu.vn" required type="email" value={form.email} /></label><label><span>Số điện thoại</span><input maxLength={30} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Số điện thoại liên hệ" value={form.phone} /></label><label><span>Giới tính</span><select onChange={(event) => setForm({ ...form, gender: event.target.value as AdminLecturerGender | "" })} value={form.gender}><option value="">Chưa cập nhật</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label><label><span>{formMode === "create" ? "Mật khẩu tạm thời *" : "Đặt mật khẩu mới"}</span><div className={styles.passwordField}><KeyRound size={14} /><input minLength={8} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={formMode === "create" ? "Tối thiểu 8 ký tự" : "Để trống nếu không đổi"} required={formMode === "create"} type="password" value={form.password} /></div></label></div><div className={styles.sectionTitle}><GraduationCap size={16} /><div><strong>Hồ sơ chuyên môn</strong><span>Thông tin dùng khi phân công hướng dẫn</span></div></div><div className={styles.formGrid}><label><span>Mã giảng viên *</span><input maxLength={50} onChange={(event) => setForm({ ...form, lecturerCode: event.target.value })} placeholder="Ví dụ: GV2026001" required value={form.lecturerCode} /></label><label><span>Học hàm / Học vị</span><input list="academic-title-options" maxLength={100} onChange={(event) => setForm({ ...form, academicTitle: event.target.value })} placeholder="Ví dụ: Tiến sĩ" value={form.academicTitle} /><datalist id="academic-title-options"><option value="Giáo sư" /><option value="Phó Giáo sư" /><option value="Tiến sĩ" /><option value="Thạc sĩ" /></datalist></label><label className={styles.fullField}><span>Khoa / Viện</span><input maxLength={150} onChange={(event) => setForm({ ...form, faculty: event.target.value })} placeholder="Khoa Công nghệ thông tin" value={form.faculty} /></label><label className={styles.fullField}><span>Chuyên môn</span><textarea maxLength={2000} onChange={(event) => setForm({ ...form, specialization: event.target.value })} placeholder="Các lĩnh vực nghiên cứu, kỹ năng và chuyên môn chính" rows={4} value={form.specialization} /></label>{formMode === "edit" && <label className={styles.statusToggle}><input checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} type="checkbox" /><span><strong>Tài khoản đang hoạt động</strong><small>Giảng viên có thể đăng nhập và xử lý sinh viên được phân công.</small></span></label>}</div></div><footer><span><ShieldCheck size={14} />Thao tác được ghi vào Audit Logs.</span><div><button disabled={submitting} onClick={closeForm} type="button">Hủy</button><button className={styles.primaryButton} disabled={submitting} type="submit">{submitting ? <Loader2 className={styles.spin} size={16} /> : formMode === "create" ? <Plus size={16} /> : <Pencil size={16} />}{formMode === "create" ? "Thêm giảng viên" : "Lưu thay đổi"}</button></div></footer></form></div>}

      {detail && <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><aside className={styles.drawer}><header><div><span>HỒ SƠ GIẢNG VIÊN</span><h2>{detail.fullName}</h2><p>{detail.lecturerCode} · {detail.academicTitle || "Chưa cập nhật học vị"}</p></div><button aria-label="Đóng" onClick={() => setDetail(null)} title="Đóng" type="button"><X size={18} /></button></header><div className={styles.drawerBody}><div className={styles.profileHero}><i>{initials(detail.fullName)}</i><div><strong>{detail.fullName}</strong><span>{detail.email}</span><small>{detail.faculty || "Chưa cập nhật khoa / viện"}</small></div></div><section className={styles.detailStats}><article><strong>{detail.assignedStudents}</strong><span>Sinh viên</span></article><article><strong>{detail.activeInternships}</strong><span>Đang thực tập</span></article><article><strong>{detail.pendingReviews}</strong><span>Chờ duyệt</span></article><article><strong>{detail.completedInternships}</strong><span>Hoàn thành</span></article></section><section className={styles.detailSection}><h3>Thông tin chuyên môn</h3><dl><div><dt>Học hàm / Học vị</dt><dd>{detail.academicTitle || "Chưa cập nhật"}</dd></div><div><dt>Khoa / Viện</dt><dd>{detail.faculty || "Chưa cập nhật"}</dd></div><div className={styles.wideDetail}><dt>Chuyên môn</dt><dd>{detail.specialization || "Chưa cập nhật chuyên môn"}</dd></div></dl></section><section className={styles.detailSection}><h3>Tài khoản</h3><dl><div><dt>Trạng thái</dt><dd>{detail.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}</dd></div><div><dt>Xác thực</dt><dd>{detail.accountStatus === "REGISTERED" ? detail.authProvider : "Chờ kích hoạt"}</dd></div><div><dt>Số điện thoại</dt><dd>{detail.phone || "Chưa cập nhật"}</dd></div><div><dt>Phân công gần nhất</dt><dd>{formatDate(detail.lastAssignmentAt)}</dd></div></dl></section></div><footer><button onClick={() => setStatusTarget(detail)} type="button">{detail.isActive ? <UserX size={16} /> : <UserCheck size={16} />}{detail.isActive ? "Vô hiệu hóa" : "Kích hoạt lại"}</button><button className={styles.primaryButton} onClick={() => openEdit(detail)} type="button"><Pencil size={16} />Chỉnh sửa hồ sơ</button></footer></aside></div>}

      {statusTarget && <div className={styles.modalBackdrop}><section className={styles.confirmModal}><span className={statusTarget.isActive ? styles.dangerIcon : styles.successIcon}>{statusTarget.isActive ? <UserX size={22} /> : <UserCheck size={22} />}</span><h2>{statusTarget.isActive ? "Vô hiệu hóa giảng viên?" : "Kích hoạt lại giảng viên?"}</h2><p>{statusTarget.fullName} · {statusTarget.lecturerCode}</p><small>{statusTarget.isActive ? `Tài khoản sẽ không thể đăng nhập. ${statusTarget.assignedStudents} sinh viên và toàn bộ dữ liệu hướng dẫn vẫn được giữ nguyên.` : "Giảng viên sẽ có thể đăng nhập và tiếp tục xử lý công việc được phân công."}</small><footer><button disabled={statusBusy} onClick={() => setStatusTarget(null)} type="button">Hủy</button><button className={statusTarget.isActive ? styles.dangerConfirm : styles.successConfirm} disabled={statusBusy} onClick={() => void changeStatus()} type="button">{statusBusy && <Loader2 className={styles.spin} size={15} />}{statusTarget.isActive ? "Xác nhận vô hiệu hóa" : "Kích hoạt tài khoản"}</button></footer></section></div>}
    </main>
  );
}
