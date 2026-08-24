"use client";

import {
  Activity, AlertTriangle, CheckCircle2, Clock3, Database,
  Gauge, RefreshCw, ShieldCheck, Sparkles, Users, Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, formatMs } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";
import styles from "./observability.module.css";

export { styles };

type ResourceCacheEntry = {
  data?: unknown;
  error: string | null;
  promise: Promise<unknown> | null;
};

const resourceCache = new Map<string, ResourceCacheEntry>();

function cachedData<T>(key: string): T | null {
  const entry = resourceCache.get(key);
  return entry && "data" in entry ? entry.data as T : null;
}

async function loadCachedResource<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const current = resourceCache.get(key);
  if (current?.promise) return current.promise as Promise<T>;

  const entry = current ?? { error: null, promise: null };
  const promise = loader().then(data => {
    resourceCache.set(key, { data, error: null, promise: null });
    return data;
  }).catch(error => {
    entry.error = error instanceof Error ? error.message : String(error);
    entry.promise = null;
    resourceCache.set(key, entry);
    throw error;
  });

  entry.promise = promise;
  resourceCache.set(key, entry);
  return promise;
}

export function useResource<T>(key: string, loader: () => Promise<T>, refreshMs = 30000) {
  const initialData = cachedData<T>(key);
  const [snapshot, setSnapshot] = useState<{key: string; data: T | null; error: string | null}>({
    key,
    data: initialData,
    error: resourceCache.get(key)?.error ?? null,
  });
  const [loading, setLoading] = useState(initialData === null);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  const mountedRef = useRef(false);
  const keyRef = useRef(key);
  const retryTimerRef = useRef<number | undefined>(undefined);
  loaderRef.current = loader;
  keyRef.current = key;

  const load = useCallback(async (manual = false) => {
    const hasCachedData = cachedData<T>(key) !== null;
    if (manual) setRefreshing(true);
    else if (!hasCachedData) setLoading(true);
    try {
      const data = await loadCachedResource(key, loaderRef.current);
      if (mountedRef.current && keyRef.current === key) setSnapshot({ key, data, error: null });
    } catch (e) {
      const isRateLimited = e instanceof ApiError && e.rateLimited;

      if (isRateLimited) {
        const retryAfter = Math.max(1, e.retryAfterSeconds ?? 30);
        const entry = resourceCache.get(key);
        if (entry) entry.error = null;
        if (mountedRef.current && keyRef.current === key) {
          if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(() => void load(false), retryAfter * 1000);
          setSnapshot(current => ({ ...current, error: null }));
        }
      } else if (mountedRef.current && keyRef.current === key) {
        setSnapshot(current => ({ ...current, error: e instanceof Error ? e.message : String(e) }));
      }
    } finally {
      if (mountedRef.current && keyRef.current === key) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [key]);

  useEffect(() => {
    mountedRef.current = true;
    const data = cachedData<T>(key);
    setSnapshot({ key, data, error: resourceCache.get(key)?.error ?? null });
    setLoading(data === null);
    void load(false);
    const timer = refreshMs > 0 ? window.setInterval(() => void load(false), refreshMs) : undefined;
    return () => {
      mountedRef.current = false;
      if (timer) window.clearInterval(timer);
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, [key, load, refreshMs]);

  const currentData = snapshot.key === key ? snapshot.data : cachedData<T>(key);
  const currentError = snapshot.key === key ? snapshot.error : resourceCache.get(key)?.error ?? null;
  const currentLoading = currentData === null && (snapshot.key !== key || loading);
  return { data: currentData, error: currentError, loading: currentLoading, refreshing, refresh: () => load(true) };
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
