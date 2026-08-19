"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Loader2,
  Save,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import {
  fetchInternshipPeriod,
  updateInternshipPeriod,
} from "@/lib/lecturerInternshipPeriods";
import styles from "./page.module.css";

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

export default function EditLecturerInternshipPeriodPage() {
  const router = useRouter();
  const params = useParams<{ periodId: string }>();
  const periodId = Number(params.periodId);
  const [form, setForm] = useState<PeriodForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPeriod = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!Number.isInteger(periodId) || periodId <= 0) {
        throw new Error("Mã đợt thực tập trên đường dẫn không hợp lệ.");
      }

      const period = await fetchInternshipPeriod(periodId);
      setForm({
        name: period.name,
        semesterCode: period.semesterCode,
        academicYear: period.academicYear,
        startDate: period.startDate,
        endDate: period.endDate,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải đợt thực tập.",
      );
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPeriod();
  }, [loadPeriod]);

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
      await updateInternshipPeriod(periodId, {
        name: form.name.trim(),
        semesterCode: form.semesterCode.trim(),
        academicYear: form.academicYear.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      router.push(`/lecturer/internship-periods/${periodId}`);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu thay đổi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <LecturerShell title="Sửa đợt thực tập">
      <main className={styles.page}>
        <button
          className={styles.backButton}
          onClick={() => router.push(`/lecturer/internship-periods/${periodId}`)}
          type="button"
        >
          <ArrowLeft size={17} />
          Quay lại chi tiết
        </button>

        {loading ? (
          <section className={styles.statePanel}>
            <Loader2 className={styles.spin} size={30} />
            <p>Đang tải dữ liệu...</p>
          </section>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <header>
              <div className={styles.headerIcon}><CalendarDays size={23} /></div>
              <div>
                <p>QUẢN LÝ THỰC TẬP</p>
                <h1>Sửa đợt thực tập</h1>
                <span>Cập nhật thông tin học kỳ và thời gian triển khai.</span>
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
                <input required maxLength={50} value={form.semesterCode} onChange={(e) => updateField("semesterCode", e.target.value)} />
              </label>
              <label>
                <span>Năm học</span>
                <input required maxLength={20} placeholder="2026-2027" value={form.academicYear} onChange={(e) => updateField("academicYear", e.target.value)} />
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
              <button className={styles.cancelButton} disabled={saving} onClick={() => router.push(`/lecturer/internship-periods/${periodId}`)} type="button">Hủy</button>
              <button className={styles.saveButton} disabled={saving} type="submit">
                {saving ? <Loader2 className={styles.spin} size={17} /> : <Save size={17} />}
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </footer>
          </form>
        )}
      </main>
    </LecturerShell>
  );
}
