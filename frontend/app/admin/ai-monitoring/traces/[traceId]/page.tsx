"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Loading, PageShell, Panel, styles, useResource } from "@/components/observability/observability";
import { formatMoney, formatMs, observabilityApi } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

function pretty(value:any) {
  if (value == null || value === "") return "-";
  if (typeof value === "string") { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }
  return JSON.stringify(value, null, 2);
}

export default function TraceDetailPage() {
  const params = useParams<{traceId:string}>();
  const traceId = decodeURIComponent(params.traceId);
  const [range, setRange] = useState<TimeRange>("30d");
  const state = useResource(() => observabilityApi.trace(traceId, range), [traceId, range], 0);
  const d = state.data;
  const maxEnd = Math.max(1, ...(d?.observations ?? []).map((o:any)=>Number(o.offset_ms||0)+Number(o.latency_ms||0)));
  return <PageShell title="Trace Detail" description={`Trace ${traceId}`} range={range} setRange={setRange} refreshing={state.refreshing} onRefresh={state.refresh}>
    {state.error && <ErrorBox error={state.error}/>} {state.loading && !d ? <Loading/> : d && <>
      <div className={styles.traceSummary}>
        <div><span>Trace ID</span><strong className={styles.mono}>{traceId}</strong></div>
        <div><span>User</span><strong>{d.user_id || "anonymous"}</strong></div>
        <div><span>Session</span><strong>{d.session_id || "-"}</strong></div>
        <div><span>Observations</span><strong>{d.observations.length}</strong></div>
      </div>
      <Panel title="Waterfall" subtitle="Nested RAG/LLM observations sorted by start time">
        <div className={styles.tableWrap}><div className={styles.waterfall}>{d.observations.map((o:any)=><details key={o.id} className={styles.details}><summary className={styles.waterRow}><span><strong>{o.name}</strong><br/><span className={styles.muted}>{o.type} · {o.model || ""}</span></span><span>{formatMs(o.latency_ms)}</span><span className={styles.waterTrack}><span className={styles.waterBar} style={{left:`${Number(o.offset_ms||0)/maxEnd*100}%`,width:`${Math.max(.5,Number(o.latency_ms||0)/maxEnd*100)}%`}}/></span><span className={`${styles.badge} ${String(o.level).toUpperCase()==="ERROR"?styles.error:styles.success}`}>{o.level || "OK"}</span></summary><div className={styles.grid2}><div><strong>Metadata</strong><pre className={styles.codeBlock}>{pretty(o.metadata)}</pre></div><div><strong>Usage</strong><pre className={styles.codeBlock}>{pretty({input:o.input_usage,output:o.output_usage,total:o.total_usage,cost:formatMoney(o.cost_usd),status:o.status_message})}</pre></div><div><strong>Input</strong><pre className={styles.codeBlock}>{pretty(o.input)}</pre></div><div><strong>Output</strong><pre className={styles.codeBlock}>{pretty(o.output)}</pre></div></div></details>)}</div></div>
      </Panel>
    </>}
  </PageShell>;
}
