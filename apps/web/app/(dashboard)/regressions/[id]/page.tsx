"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost, backendResourceUrl } from "../../../../lib/api";
import { useDashboardLive } from "../../../../lib/useDashboardLive";
import { RegressionCompare, type ReplayRunRow } from "../../../../components/dashboard/RegressionCompare";
import styles from "../../../../components/dashboard/Dashboard.module.css";

interface Config {
  id: string;
  name: string;
  status: string;
}

interface RegressionDetail {
  regression: {
    id: string;
    entityType: string;
    expectedValue: string;
    observedValue: string;
    repairMethod: string;
    status: string;
    contextBefore: string;
  };
  replay_runs: ReplayRunRow[];
}

export default function RegressionDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<RegressionDetail | null>(null);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<RegressionDetail>(`/api/regressions/${params.id}`).then(setDetail).catch(() => {});
    apiGet<{ configs: Config[] }>("/api/configs").then((d) => setConfigs(d.configs)).catch(() => {});
  }, [params.id]);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  const toggle = (configId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(configId)) next.delete(configId);
      else next.add(configId);
      return next;
    });
  };

  const runReplay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiPost(`/api/regressions/${params.id}/replay`, { config_ids: [...selected] });
      refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const promote = async (configId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await apiPost(`/api/configs/${configId}/promote`, { actor: "operator", target_regression_id: params.id });
      setMessage(`Promoted ${configId}.`);
      refresh();
    } catch (err) {
      const e = err as Error & { reason?: string };
      setMessage(`Promotion denied: ${e.reason ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return <p className={styles.muted}>Loading…</p>;

  return (
    <div>
      <h1 className={styles.h1}>Regression Detail</h1>
      <p className={styles.muted}>
        {detail.regression.entityType}: expected <strong style={{ color: "#fcfcfc" }}>{detail.regression.expectedValue}</strong>,
        originally heard <strong style={{ color: "#fcfcfc" }}>{detail.regression.observedValue}</strong> — truth source:{" "}
        {detail.regression.repairMethod}
      </p>
      <audio controls src={backendResourceUrl(`/api/regressions/${params.id}/audio`)} style={{ marginBottom: 16, width: "100%" }} />

      <h2 className={styles.h2}>Replay against candidate configs</h2>
      <div style={{ marginBottom: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {configs.map((c) => (
          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /> {c.name}
          </label>
        ))}
      </div>
      <button onClick={runReplay} disabled={busy || selected.size === 0} className={`${styles.button} ${styles.buttonPrimary}`}>
        Replay
      </button>
      {message && <p style={{ color: "#f3c772", fontSize: 13 }}>{message}</p>}

      <h2 className={styles.h2}>Results</h2>
      <RegressionCompare runs={detail.replay_runs} onPromote={promote} />
    </div>
  );
}
