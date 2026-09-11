"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../../lib/api";
import { useDashboardLive } from "../../../lib/useDashboardLive";
import styles from "../../../components/dashboard/Dashboard.module.css";

interface MetricsOverview {
  critical_entity_accuracy: number | null;
  first_pass_entity_success_rate: number | null;
  repair_rate: number | null;
  repair_success_rate: number | null;
  mean_repair_turns: number | null;
  unsafe_action_prevention_count: number;
  regression_closure_rate: number | null;
  active_config_regression_score: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
}

const LABELS: Record<keyof MetricsOverview, string> = {
  critical_entity_accuracy: "Critical entity accuracy",
  first_pass_entity_success_rate: "First-pass entity success rate",
  repair_rate: "Repair rate",
  repair_success_rate: "Repair success rate",
  mean_repair_turns: "Mean repair turns",
  unsafe_action_prevention_count: "Unsafe actions prevented",
  regression_closure_rate: "Regression closure rate",
  active_config_regression_score: "Active config regression score",
  p50_latency_ms: "p50 latency",
  p95_latency_ms: "p95 latency",
};

function formatValue(key: keyof MetricsOverview, value: number | null): string {
  if (value === null) return "—";
  if (key === "unsafe_action_prevention_count") return String(value);
  if (key === "mean_repair_turns") return value.toFixed(2);
  if (key.endsWith("_latency_ms")) return `${Math.round(value)} ms`;
  return `${(value * 100).toFixed(1)}%`;
}

export default function ReliabilityOverviewPage() {
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null);

  const refresh = useCallback(() => {
    apiGet<MetricsOverview>("/api/metrics/overview").then(setMetrics).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  return (
    <div>
      <h1 className={styles.h1}>Reliability Overview</h1>
      {!metrics && <p className={styles.muted}>Loading…</p>}
      {metrics && (
        <div className={styles.grid}>
          {(Object.keys(LABELS) as (keyof MetricsOverview)[]).map((key) => (
            <div key={key} className={styles.card}>
              <div className={styles.cardLabel}>{LABELS[key]}</div>
              <div className={styles.cardValue}>{formatValue(key, metrics[key])}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
