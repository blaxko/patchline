"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../lib/api";
import { useDashboardLive } from "../../../lib/useDashboardLive";

interface Config {
  id: string;
  name: string;
  version: number;
  speechModel: string;
  contextMode: string;
  status: string;
  promotedBy: string | null;
  promotedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "#999",
  tested: "#fc8",
  eligible: "#8cf",
  rejected: "#f84",
  active: "#8f8",
  superseded: "#666",
};

export default function ConfigurationsPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    apiGet<{ configs: Config[] }>("/api/configs").then((d) => setConfigs(d.configs)).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  const rollback = async () => {
    const active = configs.find((c) => c.status === "active");
    if (!active) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiPost(`/api/configs/${active.id}/rollback`, { actor: "operator" });
      refresh();
    } catch (err) {
      const e = err as Error & { reason?: string };
      setMessage(`Rollback denied: ${e.reason ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: "monospace" }}>
      <h1>Configuration Registry</h1>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
            <th style={{ padding: "4px 8px" }}>NAME</th>
            <th style={{ padding: "4px 8px" }}>VERSION</th>
            <th style={{ padding: "4px 8px" }}>SPEECH MODEL</th>
            <th style={{ padding: "4px 8px" }}>CONTEXT MODE</th>
            <th style={{ padding: "4px 8px" }}>STATUS</th>
            <th style={{ padding: "4px 8px" }}>PROMOTED BY</th>
          </tr>
        </thead>
        <tbody>
          {configs.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px" }}>{c.name}</td>
              <td style={{ padding: "4px 8px" }}>v{c.version}</td>
              <td style={{ padding: "4px 8px" }}>{c.speechModel}</td>
              <td style={{ padding: "4px 8px" }}>{c.contextMode}</td>
              <td style={{ padding: "4px 8px", color: STATUS_COLOR[c.status] ?? "inherit" }}>{c.status}</td>
              <td style={{ padding: "4px 8px" }}>{c.promotedBy ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={rollback} disabled={busy} style={{ marginTop: 16 }}>
        Rollback active config
      </button>
      {message && <p style={{ color: "#fc8" }}>{message}</p>}
      <p style={{ opacity: 0.6, fontSize: 12, marginTop: 8 }}>
        Promote a candidate from its regression's detail page (Regression Lab) after a passing replay.
      </p>
    </div>
  );
}
