"use client";

import Link from "next/link";
import { CircleDollarSign, Server } from "lucide-react";
import { useState } from "react";
import {
  ErrorBox, LineChart, Loading, MetricCard, PageShell, Panel,
  PipelineRows, QualityBar, icons, styles, useResource,
} from "@/components/observability/observability";
import { observabilityApi, scorePercent, formatMoney, formatMs, formatNumber } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

export default function AiMonitoringPage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const overviewState = useResource(
    `overview:${range}`,
    () => observabilityApi.overview(range),
  );
  const alertsState = useResource(
    `alerts:${range}`,
    () => observabilityApi.alerts(range),
  );
  const statusState = useResource(
    "observability:status",
    () => observabilityApi.status(),
  );

  const o = overviewState.data;
  const alerts = alertsState.data;
  const langfuseStatus = statusState.data;
  const auxiliaryError = alertsState.error ?? statusState.error;
  const refreshing = overviewState.refreshing || alertsState.refreshing || statusState.refreshing;
  const refresh = () => {
    void overviewState.refresh();
    void alertsState.refresh();
    void statusState.refresh();
  };
  const systemStatus: "healthy" | "warning" | "error" = !langfuseStatus?.configured
    ? "error"
    : (alerts?.critical ?? 0) > 0
      ? "error"
      : (alerts?.active ?? 0) > 0
        ? "warning"
        : "healthy";

  return (
    <PageShell
      title="AI Monitoring"
      description="Quan sát end-to-end chatbot RAG: traffic, latency, retrieval, generation, quality, token/cost, lỗi và cảnh báo."
      range={range}
      setRange={setRange}
      refreshing={refreshing}
      onRefresh={refresh}
      status={o ? systemStatus : undefined}
    >
      {overviewState.error && <ErrorBox error={overviewState.error}/>}
      {!overviewState.error && auxiliaryError && <ErrorBox error={auxiliaryError}/>}
      {overviewState.loading && !o ? <Loading/> : !o ? (
        <div className={styles.emptyBox}>Chưa có dữ liệu. Hệ thống sẽ tự động cập nhật khi có trace từ chatbot.</div>
      ) : (
        <>
          {o.data_truncated && <div className={styles.warningBox}>Dữ liệu bị giới hạn bởi OBSERVABILITY_MAX_OBSERVATIONS.</div>}

          <div className={styles.grid4}>
            <MetricCard label="Requests" value={formatNumber(o.requests?.total)} icon={icons.Activity}/>
            <MetricCard label="Error Rate" value={Number(o.requests?.error_rate_pct || 0).toFixed(2)} suffix="%" icon={icons.AlertTriangle}/>
            <MetricCard label="P50 Latency" value={formatMs(o.latency?.p50_ms)} icon={icons.Clock3}/>
            <MetricCard label="P95 Latency" value={formatMs(o.latency?.p95_ms)} icon={icons.Clock3}/>
            <MetricCard label="P99 Latency" value={formatMs(o.latency?.p99_ms)} icon={icons.Clock3}/>
            <MetricCard label="Active Users" value={formatNumber(o.requests?.active_users)} icon={icons.Users} note={`${formatNumber(o.requests?.active_sessions)} sessions`}/>
          </div>

          <div className={styles.grid2}>
            <Panel title="Request Traffic" subtitle={`Request buckets · ${range}`} right={<span className={styles.livePill}>● Live</span>}>
              <div className={styles.traceSummary}>
                <div><span>Total</span><strong>{formatNumber(o.requests?.total)}</strong></div>
                <div><span>Peak / bucket</span><strong>{formatNumber(o.traffic?.peak)}</strong></div>
                <div><span>P50</span><strong>{formatMs(o.latency?.p50_ms)}</strong></div>
                <div><span>P99</span><strong>{formatMs(o.latency?.p99_ms)}</strong></div>
              </div>
              <LineChart points={o.traffic?.points ?? []}/>
            </Panel>

            <Panel title="Active Alerts" subtitle="Cảnh báo vận hành" right={<span className={`${styles.badge} ${alerts?.critical ? styles.error : alerts?.active ? styles.warning : styles.success}`}>{alerts?.active ?? 0} active</span>}>
              {!alerts?.items?.length ? <div className={styles.emptyBox}>Không có alert đang kích hoạt.</div> : alerts.items.slice(0, 4).map(a => (
                <div key={a.id} className={`${styles.alertCard} ${a.severity === "critical" ? styles.critical : styles.warning}`}>
                  <div><h3>{a.title}</h3><p>{a.message}</p></div>
                  <Link className={styles.link} href={a.investigate_url}>Investigate</Link>
                </div>
              ))}
              <Link className={styles.link} href="/admin/ai-monitoring/alerts">Xem tất cả alerts →</Link>
            </Panel>
          </div>

          <div className={styles.grid2}>
            <Panel title="AI Quality" subtitle="Score thực tế theo từng trace">
              <QualityBar label="Groundedness pass" value={scorePercent(o.quality, "groundedness_pass")}/>
              <QualityBar label="Retrieval success" value={scorePercent(o.quality, "retrieval_success")}/>
              <QualityBar label="Answer rate" value={scorePercent(o.quality, "answer_rate")}/>
              <QualityBar label="RAG confidence" value={scorePercent(o.quality, "rag_confidence")}/>
              <QualityBar label="Faithfulness" value={scorePercent(o.quality, "faithfulness")}/>
              <QualityBar label="Answer relevance" value={scorePercent(o.quality, "answer_relevance")}/>
              <p className={styles.muted}>Faithfulness/answer relevance chỉ hiện khi bạn cấu hình evaluator.</p>
            </Panel>

            <Panel title="LLM Usage & Cost" subtitle="Generation + embedding observations" right={<CircleDollarSign size={18}/>}>
              <div className={styles.grid3}>
                <MetricCard label="Cost" value={formatMoney(o.llm?.total_cost_usd)}/>
                <MetricCard label="Tokens" value={formatNumber(o.llm?.total_tokens)}/>
                <MetricCard label="LLM Calls" value={formatNumber(o.llm?.calls)}/>
              </div>
              <div className={styles.list}>
                <div className={styles.listRow}><span>Avg cost/request</span><strong>{formatMoney(o.llm?.avg_cost_per_request_usd)}</strong></div>
                <div className={styles.listRow}><span>Langfuse</span><strong>{langfuseStatus?.health?.ok ? "Connected" : "Unavailable"}</strong></div>
                <div className={styles.listRow}><span>Capture raw content</span><strong>{langfuseStatus?.capture_content ? "ON" : "OFF / redacted"}</strong></div>
              </div>
              <Link className={styles.link} href="/admin/ai-monitoring/llm">Chi tiết model & cost →</Link>
            </Panel>
          </div>

          <div className={styles.grid2}>
            <Panel title="RAG Pipeline" subtitle="P95 latency theo stage">
              <PipelineRows rows={o.pipeline ?? []}/>
              <Link className={styles.link} href="/admin/ai-monitoring/rag">Mở RAG Analytics →</Link>
            </Panel>
            <Panel title="Runtime Health" subtitle="Sức khỏe suy ra từ telemetry gần đây">
              <div className={styles.list}>
                {!(o.service_health?.length) ? (
                  <div className={styles.emptyBox}>Chưa có dữ liệu service health.</div>
                ) : (o.service_health ?? []).map(service => (
                  <div className={styles.listRow} key={service.name}>
                    <span>{service.name}</span>
                    <span className={`${styles.badge} ${service.status === "healthy" ? styles.success : service.status === "error" ? styles.error : styles.warning}`}>{service.status}</span>
                    <strong>{formatMs(service.p95_ms)} · {Number(service.error_rate_pct || 0).toFixed(1)}% err</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel title="Observability Coverage" subtitle="Những phần đang được theo dõi trong chatbot production" right={<Server size={18}/>}>
            <div className={styles.grid4}>
              <MetricCard label="Tracing" value="RAG stages" note="Langfuse" icon={icons.Workflow}/>
              <MetricCard label="Quality" value="Trace scores" note="No fake metrics" icon={icons.Sparkles}/>
              <MetricCard label="Cost" value="Tokens + USD" note="per model" icon={CircleDollarSign}/>
              <MetricCard label="Errors" value="Stage-level" note="trace linked" icon={icons.AlertTriangle}/>
            </div>
          </Panel>
        </>
      )}
    </PageShell>
  );
}
