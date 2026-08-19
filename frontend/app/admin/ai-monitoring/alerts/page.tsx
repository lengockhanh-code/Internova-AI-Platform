"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { ErrorBox, Loading, MetricCard, PageShell, Panel, styles, useResource } from "@/components/observability/observability";
import { formatNumber, observabilityApi } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

export default function AlertsPage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const state = useResource(() => observabilityApi.alerts(range), [range]);
  const d = state.data;
  const mutate = async (id:string, action:"ack"|"resolve") => { action === "ack" ? await observabilityApi.acknowledgeAlert(id) : await observabilityApi.resolveAlert(id); await state.refresh(); };
  return <PageShell title="Alerts" description="Cảnh báo tính từ SLO/threshold: P95, error rate, retrieval/answer/groundedness quality, Langfuse health và LLM cost." range={range} setRange={setRange} refreshing={state.refreshing} onRefresh={state.refresh} status={d?.critical ? "error" : d?.active ? "warning" : "healthy"}>
    {state.error && <ErrorBox error={state.error}/>} {state.loading && !d ? <Loading/> : d && <>
      <div className={styles.grid3}><MetricCard label="Active" value={formatNumber(d.active)} icon={BellRing}/><MetricCard label="Critical" value={formatNumber(d.critical)} icon={BellRing}/><MetricCard label="Rules healthy" value={d.active ? "Needs attention" : "All clear"} icon={CheckCircle2}/></div>
      <Panel title="Alert Rules" subtitle="Alert đã resolve chỉ kích hoạt lại sau khi điều kiện hết rồi tái diễn">
        {!d.items?.length ? <div className={styles.emptyBox}>Không có điều kiện nào vượt threshold.</div> : d.items.map((a:any)=><div key={a.id} className={`${styles.alertCard} ${a.severity === "critical" ? styles.critical : styles.warning}`}><div><div className={styles.toolbarLeft}><span className={`${styles.badge} ${a.severity === "critical" ? styles.error : styles.warning}`}>{a.severity}</span><span className={styles.badge}>{a.status}</span></div><h3>{a.title}</h3><p>{a.message} · threshold: {String(a.threshold)}</p></div><div className={styles.alertActions}><Link className={styles.button} href={a.investigate_url}>Investigate</Link><button className={styles.button} onClick={()=>mutate(a.id,"ack")}>Acknowledge</button><button className={styles.button} onClick={()=>mutate(a.id,"resolve")}>Resolve</button></div></div>)}
      </Panel>
    </>}
  </PageShell>;
}
