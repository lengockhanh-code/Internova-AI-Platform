"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ErrorBox, Loading, MetricCard, PageShell, Panel, styles, useResource } from "@/components/observability/observability";
import { formatMoney, formatMs, formatNumber, observabilityApi } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

export default function TracesPage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const [filter, setFilter] = useState("");
  const state = useResource(`traces:${range}:500`, () => observabilityApi.traces(range, 500));
  const rows = useMemo(() => (state.data?.items ?? []).filter((x:any) => JSON.stringify(x).toLowerCase().includes(filter.toLowerCase())), [state.data, filter]);
  const err = rows.filter((x:any)=>x.status==="error").length;
  return <PageShell title="Traces" description="Mỗi chatbot request là một trace; mở trace để xem waterfall routing → retrieval → rerank → evidence → generation → validation." range={range} setRange={setRange} refreshing={state.refreshing} onRefresh={state.refresh}>
    {state.error && <ErrorBox error={state.error}/>} {state.loading && !state.data ? <Loading/> : <>
      <div className={styles.grid3}><MetricCard label="Traces" value={formatNumber(rows.length)}/><MetricCard label="Error traces" value={formatNumber(err)}/><MetricCard label="Visible range" value={range}/></div>
      <Panel title="Chatbot Traces" subtitle="Grouped từ Observations API v2 theo traceId">
        <div className={styles.toolbar}><div className={styles.toolbarLeft}><Search size={16}/><input className={styles.searchInput} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter trace, user, session, intent…"/></div></div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Time</th><th>Trace ID</th><th>Status</th><th>Intent</th><th>User / Session</th><th>Latency</th><th>Obs</th><th>Tokens</th><th>Cost</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.trace_id}><td>{x.time ? new Date(x.time).toLocaleString() : "-"}</td><td><Link className={`${styles.link} ${styles.mono}`} href={`/admin/ai-monitoring/traces/${x.trace_id}`}>{String(x.trace_id).slice(0,18)}…</Link></td><td><span className={`${styles.badge} ${x.status==="error"?styles.error:x.status==="answered"||x.status==="ok"?styles.success:styles.warning}`}>{x.status}</span></td><td>{x.intent || "-"}</td><td><div className={styles.mono}>{x.user_id || "anonymous"}</div><div className={styles.muted}>{x.session_id || "-"}</div></td><td>{formatMs(x.latency_ms)}</td><td>{x.observations}</td><td>{formatNumber(x.tokens)}</td><td>{formatMoney(x.cost_usd)}</td></tr>)}</tbody></table></div>
      </Panel>
    </>}
  </PageShell>;
}
