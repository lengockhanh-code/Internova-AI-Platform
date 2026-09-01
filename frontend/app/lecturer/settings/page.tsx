"use client";

import {
  BellRing,
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import {
  API_BASE_URL,
  getStoredUser,
  lecturerFetch,
  signOutLecturer,
  USER_STORAGE_KEY,
} from "@/lib/lecturerAuth";

import styles from "./page.module.css";

type Tab = "profile" | "security" | "notifications";

interface Profile {
  id: number;
  fullName: string;
  lecturerCode: string | null;
  email: string;
  phone: string | null;
  academicTitle: string | null;
  faculty: string | null;
  specialization: string | null;
  hasAvatar: boolean;
}

interface Account {
  email: string;
  authProvider: string;
  canChangePassword: boolean;
}

interface Notifications {
  reportDeadline: boolean;
  studentMessages: boolean;
  internshipStatus: boolean;
  emailNotifications: boolean;
}

interface SettingsResponse {
  profile: Profile;
  account: Account;
  notifications: Notifications;
}

async function apiError(response: Response): Promise<Error> {
  const body = await response.text();
  try {
    const value = JSON.parse(body) as { detail?: string };
    return new Error(value.detail || `Yêu cầu thất bại (${response.status}).`);
  } catch {
    return new Error(body || `Yêu cầu thất bại (${response.status}).`);
  }
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "GV";
}

export default function LecturerSettingsPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    lecturerCode: "",
    academicTitle: "",
    faculty: "",
    specialization: "",
  });
  const [notifications, setNotifications] = useState<Notifications>({
    reportDeadline: true,
    studentMessages: true,
    internshipStatus: true,
    emailNotifications: false,
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);

  function applyData(value: SettingsResponse) {
    setData(value);
    setForm({
      fullName: value.profile.fullName,
      phone: value.profile.phone || "",
      lecturerCode: value.profile.lecturerCode || "",
      academicTitle: value.profile.academicTitle || "",
      faculty: value.profile.faculty || "",
      specialization: value.profile.specialization || "",
    });
    setNotifications(value.notifications);
  }

  async function loadAvatar() {
    const response = await lecturerFetch(`${API_BASE_URL}/api/v1/lecturers/settings/avatar`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      setAvatarUrl(null);
      return;
    }
    if (!response.ok) return;
    const objectUrl = URL.createObjectURL(await response.blob());
    setAvatarUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await lecturerFetch(`${API_BASE_URL}/api/v1/lecturers/settings`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw await apiError(response);
        const value = (await response.json()) as SettingsResponse;
        applyData(value);
        if (value.profile.hasAvatar) await loadAvatar();
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Không thể tải cài đặt.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    };
    // avatarUrl is intentionally managed through the state updater in loadAvatar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await lecturerFetch(`${API_BASE_URL}/api/v1/lecturers/settings/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw await apiError(response);
      const value = (await response.json()) as SettingsResponse;
      applyData(value);

      const storedUser = getStoredUser();
      if (storedUser) {
        window.localStorage.setItem(
          USER_STORAGE_KEY,
          JSON.stringify({ ...storedUser, fullName: value.profile.fullName }),
        );
      }
      notify("Đã lưu thông tin cá nhân.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh không được vượt quá 5MB.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await lecturerFetch(`${API_BASE_URL}/api/v1/lecturers/settings/avatar`, {
        method: "POST",
        body,
      });
      if (!response.ok) throw await apiError(response);
      await loadAvatar();
      setData((current) => current ? { ...current, profile: { ...current.profile, hasAvatar: true } } : current);
      notify("Đã cập nhật ảnh đại diện.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Không thể tải ảnh lên.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAvatar() {
    if (!window.confirm("Bạn muốn xóa ảnh đại diện hiện tại?")) return;
    setSaving(true);
    try {
      const response = await lecturerFetch(`${API_BASE_URL}/api/v1/lecturers/settings/avatar`, {
        method: "DELETE",
      });
      if (!response.ok) throw await apiError(response);
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      setAvatarUrl(null);
      setData((current) => current ? { ...current, profile: { ...current.profile, hasAvatar: false } } : current);
      notify("Đã xóa ảnh đại diện.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Không thể xóa ảnh.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications() {
    setSaving(true);
    setError("");
    try {
      const response = await lecturerFetch(`${API_BASE_URL}/api/v1/lecturers/settings/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      });
      if (!response.ok) throw await apiError(response);
      notify("Đã lưu tùy chọn thông báo.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu thông báo.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    if (!window.confirm("Bạn có chắc chắn muốn đăng xuất?")) return;
    signOutLecturer();
  }

  if (loading) {
    return <LecturerShell title="Cài đặt cá nhân"><div className={styles.state}><Loader2 className={styles.spin} /><p>Đang tải cài đặt…</p></div></LecturerShell>;
  }

  if (!data) {
    return <LecturerShell title="Cài đặt cá nhân"><div className={styles.state}><ShieldCheck size={38} /><h2>Không thể tải cài đặt</h2><p>{error}</p></div></LecturerShell>;
  }

  return (
    <LecturerShell title="Cài đặt cá nhân">
      <main className={styles.page}>
        <header className={styles.hero}>
          <div><span>HỒ SƠ GIẢNG VIÊN</span><h1>Cài đặt cá nhân</h1><p>Quản lý hồ sơ, bảo mật tài khoản và cách bạn nhận thông báo.</p></div>
          {message && <div className={styles.success}><CheckCircle2 size={17} />{message}</div>}
        </header>

        {error && <div className={styles.error}><ShieldCheck size={17} />{error}<button onClick={() => setError("")}><X size={16} /></button></div>}

        <section className={styles.settingsLayout}>
          <aside className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>
                {avatarUrl ? (
                  <Image
                    alt={data.profile.fullName}
                    height={100}
                    src={avatarUrl}
                    unoptimized
                    width={100}
                  />
                ) : initials(data.profile.fullName)}
              </div>
              <button aria-label="Đổi ảnh đại diện" disabled={saving} onClick={() => fileInput.current?.click()} type="button"><Camera size={17} /></button>
              <input ref={fileInput} accept="image/jpeg,image/png,image/webp" hidden onChange={uploadAvatar} type="file" />
            </div>
            <h2>{data.profile.academicTitle ? `${data.profile.academicTitle}. ` : ""}{data.profile.fullName}</h2>
            <p>{data.profile.lecturerCode || "Chưa có mã giảng viên"}</p>
            <span>{data.profile.faculty || "Chưa cập nhật khoa"}</span>
            <div className={styles.avatarActions}>
              <button disabled={saving} onClick={() => fileInput.current?.click()} type="button"><Camera size={15} />Đổi ảnh</button>
              {data.profile.hasAvatar && <button className={styles.dangerText} disabled={saving} onClick={() => void removeAvatar()} type="button"><Trash2 size={15} />Xóa</button>}
            </div>
            <small>JPG, PNG hoặc WEBP · Tối đa 5MB</small>
          </aside>

          <div className={styles.settingsCard}>
            <nav className={styles.tabs}>
              <button className={tab === "profile" ? styles.activeTab : ""} onClick={() => setTab("profile")}><UserRound size={17} />Thông tin cá nhân</button>
              <button className={tab === "security" ? styles.activeTab : ""} onClick={() => setTab("security")}><LockKeyhole size={17} />Tài khoản & bảo mật</button>
              <button className={tab === "notifications" ? styles.activeTab : ""} onClick={() => setTab("notifications")}><BellRing size={17} />Thông báo</button>
            </nav>

            {tab === "profile" && (
              <form className={styles.form} onSubmit={saveProfile}>
                <div className={styles.sectionTitle}><div><h2>Thông tin giảng viên</h2><p>Thông tin này được hiển thị trong khu vực quản lý sinh viên.</p></div></div>
                <div className={styles.formGrid}>
                  <label><span>Họ và tên *</span><input required maxLength={150} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
                  <label><span>Mã giảng viên</span><input maxLength={50} placeholder="Ví dụ: GV001" value={form.lecturerCode} onChange={(e) => setForm({ ...form, lecturerCode: e.target.value })} /></label>
                  <label><span>Email</span><input disabled value={data.profile.email} /></label>
                  <label><span>Số điện thoại</span><input maxLength={30} placeholder="Nhập số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                  <label><span>Học hàm / học vị</span><input maxLength={100} placeholder="TS, PGS.TS…" value={form.academicTitle} onChange={(e) => setForm({ ...form, academicTitle: e.target.value })} /></label>
                  <label><span>Khoa / Viện</span><input maxLength={150} placeholder="Khoa Công nghệ thông tin" value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} /></label>
                  <label className={styles.fullField}><span>Chuyên môn</span><textarea maxLength={2000} rows={5} placeholder="Mô tả lĩnh vực chuyên môn và hướng nghiên cứu…" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></label>
                </div>
                <div className={styles.formFooter}><span>* Thông tin bắt buộc</span><button disabled={saving} type="submit">{saving ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />}Lưu thay đổi</button></div>
              </form>
            )}

            {tab === "security" && (
              <div className={styles.securityContent}>
                <div className={styles.sectionTitle}><div><h2>Tài khoản & bảo mật</h2><p>Kiểm tra phương thức đăng nhập và bảo vệ tài khoản.</p></div></div>
                <div className={styles.accountRow}><div className={styles.rowIcon}><Mail size={19} /></div><div><strong>Địa chỉ email</strong><span>{data.account.email}</span></div><b>Đã xác minh</b></div>
                <div className={styles.accountRow}><div className={styles.rowIcon}><ShieldCheck size={19} /></div><div><strong>Phương thức đăng nhập</strong><span>{data.account.authProvider === "GOOGLE" ? "Tài khoản Google" : "Email và mật khẩu"}</span></div><b>An toàn</b></div>
                <div className={styles.accountRow}><div className={styles.rowIcon}><KeyRound size={19} /></div><div><strong>Mật khẩu</strong><span>Nên đổi mật khẩu định kỳ và không dùng chung với dịch vụ khác.</span></div><button disabled={!data.account.canChangePassword} onClick={() => setPasswordOpen(true)} type="button">Đổi mật khẩu</button></div>
                <div className={styles.logoutBox}><div><strong>Đăng xuất khỏi tài khoản</strong><span>Xóa phiên đăng nhập trên trình duyệt hiện tại.</span></div><button onClick={logout} type="button"><LogOut size={16} />Đăng xuất</button></div>
              </div>
            )}

            {tab === "notifications" && (
              <div className={styles.notificationContent}>
                <div className={styles.sectionTitle}><div><h2>Tùy chọn thông báo</h2><p>Chọn các hoạt động bạn muốn được hệ thống nhắc nhở.</p></div></div>
                <Preference title="Hạn nộp báo cáo" description="Nhận cảnh báo khi sinh viên sắp đến hạn hoặc quá hạn báo cáo." checked={notifications.reportDeadline} onChange={(value) => setNotifications({ ...notifications, reportDeadline: value })} />
                <Preference title="Trao đổi với sinh viên" description="Nhận thông báo khi có tin nhắn hoặc phản hồi mới từ sinh viên." checked={notifications.studentMessages} onChange={(value) => setNotifications({ ...notifications, studentMessages: value })} />
                <Preference title="Trạng thái thực tập" description="Theo dõi thay đổi hồ sơ, phân công và trạng thái kỳ thực tập." checked={notifications.internshipStatus} onChange={(value) => setNotifications({ ...notifications, internshipStatus: value })} />
                <Preference title="Thông báo qua email" description="Gửi thêm bản sao các thông báo quan trọng tới email của bạn." checked={notifications.emailNotifications} onChange={(value) => setNotifications({ ...notifications, emailNotifications: value })} />
                <div className={styles.formFooter}><span>Có thể thay đổi bất cứ lúc nào.</span><button disabled={saving} onClick={() => void saveNotifications()} type="button">{saving ? <Loader2 className={styles.spin} size={16} /> : <Save size={16} />}Lưu tùy chọn</button></div>
              </div>
            )}
          </div>
        </section>
      </main>

      {passwordOpen && <PasswordModal saving={saving} onClose={() => setPasswordOpen(false)} onError={setError} onSaved={() => { setPasswordOpen(false); notify("Đã đổi mật khẩu thành công."); }} setSaving={setSaving} />}
    </LecturerShell>
  );
}

function Preference({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className={styles.preference}><div><strong>{title}</strong><span>{description}</span></div><button aria-checked={checked} className={checked ? styles.switchOn : styles.switch} onClick={() => onChange(!checked)} role="switch" type="button"><span /></button></div>;
}

function PasswordModal({ saving, onClose, onError, onSaved, setSaving }: { saving: boolean; onClose: () => void; onError: (value: string) => void; onSaved: () => void; setSaving: (value: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { onError("Mật khẩu xác nhận không khớp."); return; }
    setSaving(true);
    onError("");
    try {
      const response = await lecturerFetch(`${API_BASE_URL}/api/v1/lecturers/settings/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword: confirmation }),
      });
      if (!response.ok) throw await apiError(response);
      onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Không thể đổi mật khẩu.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.modalBackdrop} onMouseDown={onClose}><form className={styles.modal} onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}><header><div><h2>Đổi mật khẩu</h2><p>Mật khẩu mới cần có ít nhất 8 ký tự.</p></div><button aria-label="Đóng" onClick={onClose} type="button"><X size={19} /></button></header><label><span>Mật khẩu hiện tại</span><input minLength={6} required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label><label><span>Mật khẩu mới</span><input minLength={8} required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label><label><span>Xác nhận mật khẩu mới</span><input minLength={8} required type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label><footer><button onClick={onClose} type="button">Hủy</button><button disabled={saving} type="submit">{saving && <Loader2 className={styles.spin} size={15} />}Đổi mật khẩu</button></footer></form></div>;
}
