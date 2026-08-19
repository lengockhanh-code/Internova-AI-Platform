"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ErrorBox, Loading, PageShell, Panel, styles, useResource } from "@/components/observability/observability";
import { formatMs, observabilityApi } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

export default function ObservabilityLogsPage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const [filter, setFilter] = useState("");
  const state = useResource(() => observabilityApi.logs(range, 500), [range]);
  const items = useMemo(() => (state.data?.items ?? []).filter((x:any) => JSON.stringify(x).toLowerCase().includes(filter.toLowerCase())), [state.data, filter]);
  return <PageShell title="Logs / Events" description="Event stream từ Langfuse observations. Dùng Trace ID để đi từ event đến toàn bộ request RAG." range={range} setRange={setRange} refreshing={state.refreshing} onRefresh={state.refresh}>
    {state.error && <ErrorBox error={state.error}/>} {state.loading && !state.data ? <Loading/> : <Panel title="Observation Events" subtitle={`${items.length} rows`}>
      <div className={styles.toolbar}><div className={styles.toolbarLeft}><Search size={16}/><input className={styles.searchInput} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter name, level, trace, model…"/></div></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Time</th><th>Level</th><th>Name</th><th>Type</th><th>Latency</th><th>Model</th><th>Trace</th><th>Status</th></tr></thead><tbody>{items.map((x:any)=><tr key={x.id}><td>{x.time ? new Date(x.time).toLocaleString() : "-"}</td><td><span className={`${styles.badge} ${String(x.level).toUpperCase()==="ERROR"?styles.error:String(x.level).toUpperCase()==="WARNING"?styles.warning:styles.success}`}>{x.level}</span></td><td><strong>{x.name}</strong></td><td>{x.type}</td><td>{formatMs(x.latency_ms)}</td><td>{x.model || "-"}</td><td><Link className={`${styles.link} ${styles.mono}`} href={`/admin/ai-monitoring/traces/${x.trace_id}`}>{String(x.trace_id || "-").slice(0,14)}</Link></td><td className={styles.truncate}>{x.status_message || "-"}</td></tr>)}</tbody></table></div>
    </Panel>}
  </PageShell>;
}
