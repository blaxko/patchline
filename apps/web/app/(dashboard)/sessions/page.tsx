"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../lib/api";
import { useDashboardLive } from "../../../lib/useDashboardLive";
import styles from "../../../components/dashboard/Dashboard.module.css";

interface SessionRow {
  id: string;
  status: string;
  callerLabel: string;
  mode: string;
  startedAt: string;
  activeConfig: { id: string; name: string };
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  active: { bg: "rgba(97, 153, 246, 0.15)", color: "#6199f6" },
  connecting: { bg: "rgba(255, 200, 100, 0.15)", color: "#f3c772" },
  reconnecting: { bg: "rgba(255, 200, 100, 0.15)", color: "#f3c772" },
  degraded: { bg: "rgba(243, 114, 114, 0.15)", color: "#f37272" },
  completed: { bg: "rgba(163, 163, 179, 0.15)", color: "#a3a3b3" },
  failed: { bg: "rgba(243, 114, 114, 0.15)", color: "#f37272" },
};

export default function LiveSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const refresh = useCallback(() => {
    apiGet<{ sessions: SessionRow[] }>("/api/sessions").then((d) => setSessions(d.sessions)).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  return (
    <div>
      <h1 className={styles.h1}>Live Sessions</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Caller</th>
            <th>Status</th>
            <th>Mode</th>
            <th>Config</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/sessions/${s.id}`} className={styles.link}>
                  {s.callerLabel}
                </Link>
              </td>
              <td>
                <span className={styles.badge} style={STATUS_COLOR[s.status] ?? {}}>
                  {s.status}
                </span>
              </td>
              <td>{s.mode}</td>
              <td>{s.activeConfig.name}</td>
              <td>{new Date(s.startedAt).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <p className={styles.muted}>No sessions yet.</p>}
    </div>
  );
}
