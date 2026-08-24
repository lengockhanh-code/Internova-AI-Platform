"use client";

import { useState } from "react";
import { Bot, CircleDollarSign, Coins, Zap } from "lucide-react";
import { ErrorBox, Loading, MetricCard, PageShell, Panel, styles, useResource } from "@/components/observability/observability";
import { formatMoney, formatMs, formatNumber, observabilityApi } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

export default function LlmUsagePage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const state = useResource(`llm:${range}`, () => observabilityApi.llm(range));
  const d = state.data;
  return <PageShell title="LLM Usage & Cost" description="Theo dõi generation/embedding calls, token, USD cost, model mix, P95 và lỗi provider." range={range} setRange={setRange} refreshing={state.refreshing} onRefresh={state.refresh}>
    {state.error && <ErrorBox error={state.error}/>} {state.loading && !d ? <Loading/> : !d ? <div className={styles.emptyBox}>Chưa có dữ liệu LLM trong khoảng thời gian này.</div> : <>
      <div className={styles.grid4}>
        <MetricCard label="LLM Calls" value={formatNumber(d.calls)} icon={Bot}/>
        <MetricCard label="Total Tokens" value={formatNumber(d.tokens)} icon={Coins}/>
        <MetricCard label="Total Cost" value={formatMoney(d.cost_usd)} icon={CircleDollarSign}/>
        <MetricCard label="Avg Cost / Call" value={formatMoney(d.avg_cost_per_call_usd)} icon={Zap}/>
      </div>
      <Panel title="Model Breakdown" subtitle="Dữ liệu usage/cost lấy từ Langfuse generation & embedding observations">
        {!d.models?.length ? <div className={styles.emptyBox}>Chưa có generation/embedding usage. Hãy kiểm tra LangChain CallbackHandler trong các LLM calls.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Model</th><th>Calls</th><th>Tokens</th><th>Cost</th><th>P95</th><th>Error rate</th></tr></thead><tbody>{d.models.map((m:any)=><tr key={m.model}><td><strong>{m.model}</strong></td><td>{formatNumber(m.calls)}</td><td>{formatNumber(m.tokens)}</td><td>{formatMoney(m.cost_usd)}</td><td>{formatMs(m.p95_ms)}</td><td><span className={`${styles.badge} ${m.error_rate_pct > 0 ? styles.error : styles.success}`}>{Number(m.error_rate_pct).toFixed(2)}%</span></td></tr>)}</tbody></table></div>}
      </Panel>
    </>}
  </PageShell>;
}
