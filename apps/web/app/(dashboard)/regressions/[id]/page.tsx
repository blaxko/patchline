"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost, backendAuthedResourceUrl } from "../../../../lib/api";
import { useDashboardLive } from "../../../../lib/useDashboardLive";
import { RegressionCompare, type ReplayRunRow } from "../../../../components/dashboard/RegressionCompare";

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

  if (!detail) return <p style={{ fontFamily: "monospace" }}>Loading…</p>;

  return (
    <div style={{ fontFamily: "monospace" }}>
      <h1>Regression Detail</h1>
      <p>
        {detail.regression.entityType}: expected <strong>{detail.regression.expectedValue}</strong>, originally heard{" "}
        <strong>{detail.regression.observedValue}</strong> — truth source: {detail.regression.repairMethod}
      </p>
      <audio controls src={backendAuthedResourceUrl(`/api/regressions/${params.id}/audio`)} style={{ marginBottom: 16 }} />

      <h2 style={{ fontSize: 15 }}>Replay against candidate configs</h2>
      <div style={{ marginBottom: 12 }}>
        {configs.map((c) => (
          <label key={c.id} style={{ marginRight: 16 }}>
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /> {c.name}
          </label>
        ))}
      </div>
      <button onClick={runReplay} disabled={busy || selected.size === 0}>
        Replay
      </button>
      {message && <p style={{ color: "#fc8" }}>{message}</p>}

      <h2 style={{ fontSize: 15, marginTop: 20 }}>Results</h2>
      <RegressionCompare runs={detail.replay_runs} onPromote={promote} />
    </div>
  );
}
