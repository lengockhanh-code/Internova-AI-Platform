"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Pencil,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import LecturerShell from "@/components/lecturer/LecturerShell";
import {
  fetchInternshipPeriod,
  type InternshipPeriod,
  type PeriodStatus,
} from "@/lib/lecturerInternshipPeriods";
import styles from "./page.module.css";

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Chưa cập nhật"
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

function statusLabel(status: PeriodStatus): string {
  if (status === "ACTIVE") return "Đang diễn ra";
  if (status === "COMPLETED") return "Đã kết thúc";
  return "Sắp diễn ra";
}

export default function LecturerInternshipPeriodDetailPage() {
  const router = useRouter();
  const params = useParams<{ periodId: string }>();
  const periodId = Number(params.periodId);
  const [period, setPeriod] = useState<InternshipPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPeriod = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!Number.isInteger(periodId) || periodId <= 0) {
        throw new Error("Mã đợt thực tập trên đường dẫn không hợp lệ.");
      }

      setPeriod(await fetchInternshipPeriod(periodId));
    } catch (loadError) {
      setPeriod(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải thông tin đợt thực tập.",
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

  const progress = Math.min(
    100,
    Math.max(0, period?.progressPercentage ?? 0),
  );

  return (
    <LecturerShell title="Chi tiết đợt thực tập">
      <main className={styles.page}>
        <div className={styles.topActions}>
          <button
            className={styles.backButton}
            onClick={() => router.push("/lecturer/internship-periods")}
            type="button"
          >
            <ArrowLeft size={17} />
            Quay lại danh sách
          </button>

          {period && (
            <button
              className={styles.editButton}
              onClick={() =>
                router.push(`/lecturer/internship-periods/${period.id}/edit`)
              }
              type="button"
            >
              <Pencil size={16} />
              Sửa đợt thực tập
            </button>
          )}
        </div>

        {loading && (
          <section className={styles.statePanel}>
            <Loader2 className={styles.spin} size={30} />
            <p>Đang tải thông tin đợt thực tập...</p>
          </section>
        )}

        {!loading && error && (
          <section className={`${styles.statePanel} ${styles.errorPanel}`}>
            <AlertTriangle size={32} />
            <h2>Không thể hiển thị đợt thực tập</h2>
            <p>{error}</p>
            <button onClick={loadPeriod} type="button">Thử lại</button>
          </section>
        )}

        {!loading && !error && period && (
          <>
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>QUẢN LÝ THỰC TẬP</p>
                <div className={styles.titleRow}>
                  <h1>{period.name}</h1>
                  <span className={styles[`status${period.status}`]}>
                    {statusLabel(period.status)}
                  </span>
                </div>
                <p className={styles.meta}>
                  {period.semesterCode || "Chưa có mã học kỳ"} · {period.academicYear || "Chưa có năm học"}
                </p>
              </div>
            </header>

            <section className={styles.dateBand}>
              <div>
                <CalendarDays size={20} />
                <span>Bắt đầu<strong>{formatDate(period.startDate)}</strong></span>
              </div>
              <div className={styles.dateDivider} />
              <div>
                <Clock3 size={20} />
                <span>Kết thúc<strong>{formatDate(period.endDate)}</strong></span>
              </div>
            </section>

            <section className={styles.metrics}>
              <article><Users size={21} /><span>Sinh viên<strong>{period.totalStudents}</strong></span></article>
              <article><FileText size={21} /><span>Báo cáo phải nộp<strong>{period.requiredReports}</strong></span></article>
              <article><AlertTriangle size={21} /><span>Cần chú ý<strong>{period.needAttention}</strong></span></article>
              <article><CheckCircle2 size={21} /><span>Tiến độ chung<strong>{progress.toFixed(0)}%</strong></span></article>
            </section>

            <section className={styles.progressPanel}>
              <div><h2>Tiến độ đợt thực tập</h2><strong>{progress.toFixed(0)}%</strong></div>
              <div className={styles.progressTrack}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>{period.description || "Chưa có mô tả cho đợt thực tập này."}</p>
            </section>
          </>
        )}
      </main>
    </LecturerShell>
  );
}
