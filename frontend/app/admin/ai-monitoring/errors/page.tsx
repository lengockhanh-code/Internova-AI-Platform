"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ErrorBox, Loading, MetricCard, PageShell, Panel, styles, useResource } from "@/components/observability/observability";
import { formatMs, formatNumber, observabilityApi } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

export default function ErrorsPage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const state = useResource(() => observabilityApi.errors(range, 500), [range]);
  const d = state.data;
  return <PageShell title="Errors" description="Các observation lỗi theo component, kèm Trace ID để điều tra nguyên nhân và fallback." range={range} setRange={setRange} refreshing={state.refreshing} onRefresh={state.refresh} status={d?.total > 0 ? "warning" : "healthy"}>
    {state.error && <ErrorBox error={state.error}/>} {state.loading && !d ? <Loading/> : d && <>
      <div className={styles.grid3}><MetricCard label="Errors" value={formatNumber(d.total)} icon={AlertTriangle}/>{d.by_component?.slice(0,2).map((x:any)=><MetricCard key={x.name} label={x.name} value={formatNumber(x.count)}/>)}</div>
      <Panel title="Error Events" subtitle="level=ERROR hoặc statusMessage/error metadata">
        {!d.items?.length ? <div className={styles.emptyBox}>Không có lỗi trong khoảng thời gian này.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Time</th><th>Component</th><th>Message</th><th>Model</th><th>Latency</th><th>Trace</th></tr></thead><tbody>{d.items.map((x:any)=><tr key={x.id}><td>{x.time ? new Date(x.time).toLocaleString() : "-"}</td><td><span className={`${styles.badge} ${styles.error}`}>{x.component}</span></td><td>{x.message}</td><td>{x.model || "-"}</td><td>{formatMs(x.latency_ms)}</td><td><Link className={`${styles.link} ${styles.mono}`} href={`/admin/ai-monitoring/traces/${x.trace_id}`}>{String(x.trace_id||"-").slice(0,16)}</Link></td></tr>)}</tbody></table></div>}
      </Panel>
    </>}
  </PageShell>;
}
