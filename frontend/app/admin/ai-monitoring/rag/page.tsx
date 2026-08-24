"use client";

import { useState } from "react";
import { BarChart3, Search, Workflow } from "lucide-react";
import {
  ErrorBox, Loading, MetricCard, PageShell, Panel, PipelineRows,
  QualityBar, styles, useResource,
} from "@/components/observability/observability";
import { formatNumber, observabilityApi, scorePercent } from "@/lib/adminObservability";
import type { TimeRange } from "@/lib/adminObservability";

export default function RagAnalyticsPage() {
  const [range, setRange] = useState<TimeRange>("24h");
  const state = useResource(`rag:${range}`, () => observabilityApi.rag(range));
  const d = state.data;

  return (
    <PageShell
      title="RAG Analytics"
      description="Phân tích retrieval, BM25/vector/RRF, rerank fallback, evidence, groundedness và latency từng stage."
      range={range}
      setRange={setRange}
      refreshing={state.refreshing}
      onRefresh={state.refresh}
    >
      {state.error && <ErrorBox error={state.error}/>} 
      {state.loading && !d ? <Loading/> : !d ? <div className={styles.emptyBox}>Chưa có dữ liệu RAG trong khoảng thời gian này.</div> : <>
        {d.data_truncated && <div className={styles.warningBox}>Một phần dữ liệu bị giới hạn bởi OBSERVABILITY_MAX_OBSERVATIONS.</div>}

        <div className={styles.grid4}>
          <MetricCard label="RAG Queries" value={formatNumber(d.queries)} icon={Search}/>
          <MetricCard label="Retrieval Calls" value={formatNumber(d.retrieval_calls)} icon={Workflow}/>
          <MetricCard label="Rerank Calls" value={formatNumber(d.rerank_calls)} icon={BarChart3}/>
          <MetricCard label="No-answer Rate" value={Number(d.no_answer_rate_pct || 0).toFixed(2)} suffix="%"/>
        </div>

        <div className={styles.grid4}>
          <MetricCard label="Avg Vector Hits" value={Number(d.retrieval?.avg_vector_hits || 0).toFixed(1)}/>
          <MetricCard label="Avg BM25 Hits" value={Number(d.retrieval?.avg_bm25_hits || 0).toFixed(1)}/>
          <MetricCard label="Avg Fused Hits" value={Number(d.retrieval?.avg_fused_hits || 0).toFixed(1)}/>
          <MetricCard label="Zero-result Rate" value={Number(d.retrieval?.zero_result_rate_pct || 0).toFixed(2)} suffix="%"/>
        </div>

        <div className={styles.grid2}>
          <Panel title="RAG Quality" subtitle="Scores thật từ pipeline/evaluator">
            <QualityBar label="Retrieval success" value={scorePercent(d.quality, "retrieval_success")}/>
            <QualityBar label="Groundedness pass" value={scorePercent(d.quality, "groundedness_pass")}/>
            <QualityBar label="Answer rate" value={scorePercent(d.quality, "answer_rate")}/>
            <QualityBar label="RAG confidence" value={scorePercent(d.quality, "rag_confidence")}/>
            <QualityBar label="Faithfulness" value={scorePercent(d.quality, "faithfulness")}/>
            <QualityBar label="Answer relevance" value={scorePercent(d.quality, "answer_relevance")}/>
            <p className={styles.muted}>Faithfulness/answer relevance hiển thị khi Langfuse evaluator ghi score; không dùng số mock.</p>
          </Panel>
          <Panel title="Pipeline Latency" subtitle="P95 từng stage + số stage errors">
            <PipelineRows rows={d.pipeline}/>
          </Panel>
        </div>

        <div className={styles.grid2}>
          <Panel title="Reranker Reliability" subtitle="Dedicated reranker và fallback về RRF">
            <div className={styles.list}>
              <div className={styles.listRow}><span>Dedicated reranker used</span><strong>{formatNumber(d.rerank?.used_reranker_calls)}</strong></div>
              <div className={styles.listRow}><span>Fallback calls</span><strong>{formatNumber(d.rerank?.fallback_calls)}</strong></div>
              <div className={styles.listRow}><span>Fallback rate</span><strong>{Number(d.rerank?.fallback_rate_pct || 0).toFixed(2)}%</strong></div>
              {(d.rerank?.fallback_reasons ?? []).map(item => (
                <div className={styles.listRow} key={item.reason}>
                  <span>{item.reason.replace(/^reranker_error:.*/, "reranker_error")}</span>
                  <strong>{formatNumber(item.count)}</strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Source Scope" subtitle="Miền tài liệu được phép retrieval">
            {!d.scopes?.length ? <div className={styles.emptyBox}>Chưa có dữ liệu.</div> : (
              <div className={styles.list}>{d.scopes.map((x:any) => (
                <div className={styles.listRow} key={x.name}><span>{x.name}</span><strong>{formatNumber(x.count)}</strong></div>
              ))}</div>
            )}
          </Panel>
        </div>

        <Panel title="Intent Distribution" subtitle="Semantic router / rule fallback">
          {!d.intents?.length ? <div className={styles.emptyBox}>Chưa có dữ liệu.</div> : (
            <div className={styles.list}>{d.intents.map((x:any) => (
              <div className={styles.listRow} key={x.name}><span>{x.name}</span><strong>{formatNumber(x.count)}</strong></div>
            ))}</div>
          )}
        </Panel>
      </>}
    </PageShell>
  );
}
