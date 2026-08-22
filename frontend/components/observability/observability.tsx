"use client";

import {
  Activity, AlertTriangle, CheckCircle2, Clock3, Database,
  Gauge, RefreshCw, ShieldCheck, Sparkles, Users, Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, formatMs } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";
import styles from "./observability.module.css";

export { styles };

export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = [], refreshMs = 30000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (e) {
      const isRateLimited = e instanceof ApiError && e.rateLimited;

      if (isRateLimited) {
        const retryAfter = Math.max(1, e.retryAfterSeconds ?? 30);
        window.setTimeout(() => void load(false), retryAfter * 1000);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(false);
    const timer = refreshMs > 0 ? window.setInterval(() => void load(false), refreshMs) : undefined;
    return () => { if (timer) window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refreshing, refresh: () => load(true) };
}

export function PageShell({
  title, description, range, setRange, refreshing, onRefresh, children, status,
}: {
  title: string; description: string; range: TimeRange; setRange: (v: TimeRange) => void;
  refreshing?: boolean; onRefresh?: () => void; children: ReactNode;
  status?: "healthy" | "warning" | "error";
}) {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.actions}>
          {status && (
            <span className={`${styles.statusPill} ${status === "healthy" ? styles.good : status === "error" ? styles.bad : ""}`}>
              {status === "healthy" ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>} {status === "healthy" ? "Healthy" : status === "error" ? "Error" : "Degraded"}
            </span>
          )}
          <select className={styles.rangeSelect} value={range} onChange={e => setRange(e.target.value as TimeRange)}>
            <option value="1h">1 giờ</option><option value="24h">24 giờ</option><option value="yesterday">Hôm qua</option><option value="2d">2 ngày</option><option value="3d">3 ngày</option><option value="7d">7 ngày</option><option value="14d">14 ngày</option><option value="30d">30 ngày</option>
          </select>
          {onRefresh && <button className={styles.button} onClick={onRefresh} disabled={refreshing} title="Refresh"><RefreshCw size={16} className={refreshing ? styles.spin : ""}/></button>}
        </div>
      </header>
      {children}
    </main>
  );
}

export function MetricCard({ label, value, suffix, icon: Icon = Gauge, note }: any) {
  return <div className={styles.metric}>
    <div className={styles.metricTop}><div className={styles.metricIcon}><Icon size={17}/></div>{note && <span className={styles.softPill}>{note}</span>}</div>
    <span className={styles.metricLabel}>{label}</span>
    <div className={styles.metricValue}><strong>{value}</strong>{suffix && <span>{suffix}</span>}</div>
  </div>;
}

export function Panel({ title, subtitle, right, children }: {title:string; subtitle?:string; right?:ReactNode; children:ReactNode}) {
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{right}</div>
    {children}
  </section>;
}

export function QualityBar({ label, value }: {label:string; value:number|null|undefined}) {
  if (value == null) return <div className={styles.progressRow}><div className={styles.progressLabel}><span>{label}</span><span className={styles.qualityMissing}>Chưa có score</span></div><div className={styles.track}/></div>;
  const safe = Math.max(0, Math.min(100, value));
  return <div className={styles.progressRow}>
    <div className={styles.progressLabel}><span>{label}</span><strong>{safe.toFixed(1)}%</strong></div>
    <div className={styles.track}><div className={styles.fill} style={{width:`${safe}%`}}/></div>
  </div>;
}

export function PipelineRows({ rows = [] }: {rows:any[]}) {
  const max = Math.max(1, ...rows.map(r => Number(r.p95_ms || 0)));
  return <div>{rows.length === 0 ? <Empty text="Chưa có RAG stage spans trong khoảng thời gian này."/> : rows.map(row => (
    <div className={styles.pipelineRow} key={row.name}>
      <span className={styles.pipelineName}>{String(row.name).replace(/^rag\./, "")}</span>
      <div className={styles.track}><div className={styles.fill} style={{width:`${Math.max(2, Number(row.p95_ms || 0) / max * 100)}%`}}/></div>
      <strong>{formatMs(row.p95_ms)}</strong>
      <span className={`${styles.badge} ${row.errors ? styles.error : styles.success}`}>{row.errors ?? 0} err</span>
    </div>
  ))}</div>;
}

export function LineChart({ points = [] }: {points:any[]}) {
  const polyline = useMemo(() => {
    if (!points.length) return "";
    const max = Math.max(...points.map(p => Number(p.value || 0)), 1);
    return points.map((p, i) => {
      const x = points.length === 1 ? 0 : i / (points.length - 1) * 100;
      const y = 94 - Number(p.value || 0) / max * 82;
      return `${x},${y}`;
    }).join(" ");
  }, [points]);
  return <div className={styles.chart}>
    <div className={styles.chartGrid}><span/><span/><span/><span/></div>
    {polyline ? <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg> : <Empty text="Chưa có traffic data"/>}
  </div>;
}

export function Empty({ text }: {text:string}) { return <div className={styles.emptyBox}>{text}</div>; }
export function ErrorBox({ error }: {error:string}) { return <div className={styles.errorBox}><strong>Không tải được dữ liệu.</strong> {error}</div>; }
export function Loading() { return <div className={styles.loadingBox}><span className={styles.loadingSpinner}/><span>Đang tải dữ liệu…</span></div>; }

export const icons = { Activity, AlertTriangle, Clock3, Database, ShieldCheck, Sparkles, Users, Workflow };
