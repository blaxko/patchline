"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../lib/api";
import { useDashboardLive } from "../../../lib/useDashboardLive";
import styles from "../../../components/dashboard/Dashboard.module.css";

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

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: "rgba(163, 163, 179, 0.15)", color: "#a3a3b3" },
  tested: { bg: "rgba(255, 200, 100, 0.15)", color: "#f3c772" },
  eligible: { bg: "rgba(97, 153, 246, 0.15)", color: "#6199f6" },
  rejected: { bg: "rgba(243, 114, 114, 0.15)", color: "#f37272" },
  active: { bg: "rgba(97, 153, 246, 0.15)", color: "#6199f6" },
  superseded: { bg: "rgba(42, 42, 50, 0.6)", color: "#757580" },
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
    <div>
      <h1 className={styles.h1}>Configuration Registry</h1>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Speech model</th>
              <th>Context mode</th>
              <th>Status</th>
              <th>Promoted by</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>v{c.version}</td>
                <td>{c.speechModel}</td>
                <td>{c.contextMode}</td>
                <td>
                  <span className={styles.badge} style={STATUS_COLOR[c.status] ?? {}}>
                    {c.status}
                  </span>
                </td>
                <td>{c.promotedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={rollback} disabled={busy} className={`${styles.button} ${styles.buttonDanger}`} style={{ marginTop: 16 }}>
        Rollback active config
      </button>
      {message && <p style={{ color: "#f3c772", fontSize: 13 }}>{message}</p>}
      <p className={styles.muted} style={{ fontSize: 12, marginTop: 8 }}>
        Promote a candidate from its regression's detail page (Regression Lab) after a passing replay.
      </p>
    </div>
  );
}
