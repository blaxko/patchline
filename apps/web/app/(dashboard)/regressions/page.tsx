"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../lib/api";
import { useDashboardLive } from "../../../lib/useDashboardLive";
import styles from "../../../components/dashboard/Dashboard.module.css";

interface RegressionRow {
  id: string;
  entityType: string;
  expectedValue: string;
  observedValue: string;
  repairMethod: string;
  status: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  open: { bg: "rgba(255, 200, 100, 0.15)", color: "#f3c772" },
  replaying: { bg: "rgba(97, 153, 246, 0.15)", color: "#6199f6" },
  replayed: { bg: "rgba(97, 153, 246, 0.15)", color: "#6199f6" },
  closed: { bg: "rgba(97, 153, 246, 0.15)", color: "#6199f6" },
  reopened: { bg: "rgba(243, 114, 114, 0.15)", color: "#f37272" },
};

export default function RegressionLabPage() {
  const [regressions, setRegressions] = useState<RegressionRow[]>([]);

  const refresh = useCallback(() => {
    apiGet<{ regressions: RegressionRow[] }>("/api/regressions").then((d) => setRegressions(d.regressions)).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  return (
    <div>
      <h1 className={styles.h1}>Regression Lab</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Entity</th>
            <th>Expected</th>
            <th>Observed (bad)</th>
            <th>Truth source</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {regressions.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/regressions/${r.id}`} className={styles.link}>
                  {r.entityType}
                </Link>
              </td>
              <td>{r.expectedValue}</td>
              <td>{r.observedValue}</td>
              <td>{r.repairMethod}</td>
              <td>
                <span className={styles.badge} style={STATUS_COLOR[r.status] ?? {}}>
                  {r.status}
                </span>
              </td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {regressions.length === 0 && <p className={styles.muted}>No regressions yet — a recovered repair creates one automatically.</p>}
    </div>
  );
}
