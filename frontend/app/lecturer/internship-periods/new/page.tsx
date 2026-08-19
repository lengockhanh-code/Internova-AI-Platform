"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Loader2,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import { createInternshipPeriod } from "@/lib/lecturerInternshipPeriods";
import styles from "../[periodId]/edit/page.module.css";

interface PeriodForm {
  name: string;
  semesterCode: string;
  academicYear: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: PeriodForm = {
  name: "",
  semesterCode: "",
  academicYear: "",
  startDate: "",
  endDate: "",
};

export default function NewLecturerInternshipPeriodPage() {
  const router = useRouter();
  const [form, setForm] = useState<PeriodForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof PeriodForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.endDate < form.startDate) {
      setError("Ngày kết thúc không được trước ngày bắt đầu.");
      return;
    }

    try {
      setSaving(true);
      const periodId = await createInternshipPeriod({
        name: form.name.trim(),
        semesterCode: form.semesterCode.trim(),
        academicYear: form.academicYear.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      router.push(`/lecturer/internship-periods/${periodId}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể tạo đợt thực tập.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <LecturerShell title="Tạo đợt thực tập">
      <main className={styles.page}>
        <button
          className={styles.backButton}
          onClick={() => router.push("/lecturer/internship-periods")}
          type="button"
        >
          <ArrowLeft size={17} />
          Quay lại danh sách
        </button>

        <form className={styles.form} onSubmit={handleSubmit}>
          <header>
            <div className={styles.headerIcon}><CalendarDays size={23} /></div>
            <div>
              <p>QUẢN LÝ THỰC TẬP</p>
              <h1>Tạo đợt thực tập</h1>
              <span>Thêm học kỳ và thời gian triển khai mới.</span>
            </div>
          </header>

          {error && (
            <div className={styles.errorMessage} role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.grid}>
            <label className={styles.fullWidth}>
              <span>Tên đợt thực tập</span>
              <input required maxLength={100} value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            </label>
            <label>
              <span>Mã học kỳ</span>
              <input required maxLength={50} placeholder="FA27" value={form.semesterCode} onChange={(e) => updateField("semesterCode", e.target.value)} />
            </label>
            <label>
              <span>Năm học</span>
              <input required maxLength={20} placeholder="2027-2028" value={form.academicYear} onChange={(e) => updateField("academicYear", e.target.value)} />
            </label>
            <label>
              <span>Ngày bắt đầu</span>
              <input required type="date" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} />
            </label>
            <label>
              <span>Ngày kết thúc</span>
              <input required min={form.startDate} type="date" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} />
            </label>
          </div>

          <footer>
            <button className={styles.cancelButton} disabled={saving} onClick={() => router.push("/lecturer/internship-periods")} type="button">Hủy</button>
            <button className={styles.saveButton} disabled={saving} type="submit">
              {saving ? <Loader2 className={styles.spin} size={17} /> : <Plus size={17} />}
              {saving ? "Đang tạo..." : "Tạo đợt thực tập"}
            </button>
          </footer>
        </form>
      </main>
    </LecturerShell>
  );
}
