"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import LecturerShell from "@/components/lecturer/LecturerShell";
import { fetchInternshipPeriods } from "@/lib/lecturerInternshipPeriods";
import styles from "./page.module.css";

type PeriodStatus =
  | "UPCOMING"
  | "ACTIVE"
  | "COMPLETED";

interface InternshipPeriod {
  id: number;
  name: string;
  semesterCode: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  totalStudents: number;
  requiredReports: number;
  progressPercentage: number;
  needAttention: number;
  description: string | null;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: PeriodStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Đang diễn ra";
    case "UPCOMING":
      return "Sắp diễn ra";
    case "COMPLETED":
      return "Đã kết thúc";
    default:
      return "Không xác định";
  }
}

function statusClass(status: PeriodStatus): string {
  switch (status) {
    case "ACTIVE":
      return styles.statusActive;
    case "UPCOMING":
      return styles.statusUpcoming;
    case "COMPLETED":
      return styles.statusCompleted;
    default:
      return "";
  }
}

function progressClass(progress: number): string {
  if (progress >= 100) return styles.progressCompleted;
  if (progress >= 60) return styles.progressGood;
  if (progress >= 30) return styles.progressWarning;
  return styles.progressLow;
}

export default function LecturerInternshipPeriodsPage() {
  const router = useRouter();

  const [periods, setPeriods] =
    useState<InternshipPeriod[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState<"ALL" | PeriodStatus>("ALL");

  const filteredPeriods = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return periods.filter((period) => {
      const matchesSearch =
        !keyword ||
        period.name.toLowerCase().includes(keyword) ||
        period.semesterCode.toLowerCase().includes(keyword) ||
        period.academicYear.toLowerCase().includes(keyword);

      const matchesStatus =
        status === "ALL" ||
        period.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [periods, search, status]);

  const activeCount = periods.filter(
    (period) => period.status === "ACTIVE",
  ).length;

  const upcomingCount = periods.filter(
    (period) => period.status === "UPCOMING",
  ).length;

  const completedCount = periods.filter(
    (period) => period.status === "COMPLETED",
  ).length;

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setPeriods(await fetchInternshipPeriods());
    } catch (loadError) {
      setPeriods([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Khong the tai danh sach dot thuc tap.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial client-side API synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshData();
  }, [refreshData]);

  return (
    <LecturerShell title="Đợt thực tập">
      <main className={styles.page}>
        <section className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>
              QUẢN LÝ THỰC TẬP
            </p>

            <h1>Đợt thực tập</h1>

            <p>
              Theo dõi các đợt thực tập, thời gian triển khai,
              số lượng sinh viên, tiến độ và các trường hợp
              cần chú ý.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.primaryButton}
              onClick={() => router.push("/lecturer/internship-periods/new")}
              type="button"
            >
              <Plus size={17} />
              Tạo đợt thực tập
            </button>

            <button
              className={styles.refreshButton}
              disabled={loading}
              onClick={refreshData}
              type="button"
            >
              {loading ? (
                <Loader2 className={styles.spin} size={17} />
              ) : (
                <RefreshCw size={17} />
              )}
              Làm mới
            </button>
          </div>
        </section>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <CalendarDays size={21} />
            </div>
            <div>
              <span>Tổng số đợt</span>
              <strong>{periods.length}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <Clock3 size={21} />
            </div>
            <div>
              <span>Đang diễn ra</span>
              <strong>{activeCount}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <AlertTriangle size={21} />
            </div>
            <div>
              <span>Sắp diễn ra</span>
              <strong>{upcomingCount}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <CheckCircle2 size={21} />
            </div>
            <div>
              <span>Đã kết thúc</span>
              <strong>{completedCount}</strong>
            </div>
          </article>
        </section>

        <section className={styles.contentCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Danh sách đợt thực tập</h2>
              <p>{filteredPeriods.length} đợt thực tập</p>
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} />
              <input
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Tìm theo tên đợt, mã học kỳ hoặc năm học..."
                value={search}
              />
            </div>

            <div className={styles.filterBox}>
              <Filter size={16} />

              <select
                onChange={(event) =>
                  setStatus(
                    event.target.value as
                      | "ALL"
                      | PeriodStatus,
                  )
                }
                value={status}
              >
                <option value="ALL">
                  Tất cả trạng thái
                </option>

                <option value="ACTIVE">
                  Đang diễn ra
                </option>

                <option value="UPCOMING">
                  Sắp diễn ra
                </option>

                <option value="COMPLETED">
                  Đã kết thúc
                </option>
              </select>
            </div>
          </div>

          <div className={styles.periodList}>
            {loading && (
              <div className={styles.feedbackState}>
                <Loader2 className={styles.spin} size={28} />
                <p>Dang tai danh sach dot thuc tap...</p>
              </div>
            )}

            {!loading && error && (
              <div className={`${styles.feedbackState} ${styles.errorState}`}>
                <AlertTriangle size={28} />
                <h3>Khong the tai du lieu</h3>
                <p>{error}</p>
                <button onClick={refreshData} type="button">
                  Thu lai
                </button>
              </div>
            )}

            {!loading && !error && filteredPeriods.map((period) => {
              const progress = Math.min(
                100,
                Math.max(
                  0,
                  period.progressPercentage,
                ),
              );

              return (
                <article
                  className={styles.periodCard}
                  key={period.id}
                >
                  <div className={styles.periodTop}>
                    <div>
                      <div className={styles.titleRow}>
                        <h3>{period.name}</h3>

                        <span
                          className={`${styles.statusBadge} ${statusClass(
                            period.status,
                          )}`}
                        >
                          {statusLabel(period.status)}
                        </span>
                      </div>

                      <div className={styles.periodMeta}>
                        <span>
                          {period.semesterCode}
                        </span>

                        <i />

                        <span>
                          {period.academicYear}
                        </span>
                      </div>

                      {period.description && (
                        <p className={styles.description}>
                          {period.description}
                        </p>
                      )}
                    </div>

                    <div className={styles.periodActions}>
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          router.push(
                            `/lecturer/internship-periods/${period.id}/edit`,
                          )
                        }
                        type="button"
                      >
                        <Pencil size={15} />
                        Sửa
                      </button>

                      <button
                        className={styles.detailButton}
                        onClick={() =>
                          router.push(
                            `/lecturer/internship-periods/${period.id}`,
                          )
                        }
                        type="button"
                      >
                        Xem chi tiết
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.dateRange}>
                    <div>
                      <CalendarDays size={17} />

                      <div>
                        <span>Bắt đầu</span>
                        <strong>
                          {formatDate(
                            period.startDate,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.dateLine}>
                      <span />
                    </div>

                    <div>
                      <CalendarDays size={17} />

                      <div>
                        <span>Kết thúc</span>
                        <strong>
                          {formatDate(
                            period.endDate,
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.metricsGrid}>
                    <div className={styles.metricItem}>
                      <Users size={18} />

                      <div>
                        <span>Sinh viên</span>
                        <strong>
                          {period.totalStudents}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.metricItem}>
                      <GraduationCap size={18} />

                      <div>
                        <span>Báo cáo phải nộp</span>
                        <strong>
                          {period.requiredReports}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.metricItem}>
                      <AlertTriangle size={18} />

                      <div>
                        <span>Cần chú ý</span>
                        <strong>
                          {period.needAttention}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.metricItem}>
                      <Clock3 size={18} />

                      <div>
                        <span>Tiến độ chung</span>
                        <strong>
                          {progress.toFixed(0)}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.progressSection}>
                    <div className={styles.progressHeader}>
                      <span>
                        Tiến độ đợt thực tập
                      </span>

                      <strong>
                        {progress.toFixed(0)}%
                      </strong>
                    </div>

                    <div className={styles.progressTrack}>
                      <span
                        className={
                          progressClass(progress)
                        }
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!loading && !error && filteredPeriods.length === 0 && (
            <div className={styles.emptyState}>
              <CalendarDays size={34} />
              <h3>
                Không tìm thấy đợt thực tập
              </h3>
              <p>
                Hãy thử thay đổi từ khóa tìm kiếm
                hoặc bộ lọc trạng thái.
              </p>
            </div>
          )}
        </section>
      </main>
    </LecturerShell>
  );
}
