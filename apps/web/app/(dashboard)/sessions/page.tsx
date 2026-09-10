"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../lib/api";
import { useDashboardLive } from "../../../lib/useDashboardLive";

interface SessionRow {
  id: string;
  status: string;
  callerLabel: string;
  mode: string;
  startedAt: string;
  activeConfig: { id: string; name: string };
}

const STATUS_COLOR: Record<string, string> = {
  active: "#8f8",
  connecting: "#fc8",
  reconnecting: "#fc8",
  degraded: "#f84",
  completed: "#999",
  failed: "#f44",
};

export default function LiveSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const refresh = useCallback(() => {
    apiGet<{ sessions: SessionRow[] }>("/api/sessions").then((d) => setSessions(d.sessions)).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  return (
    <div style={{ fontFamily: "monospace" }}>
      <h1>Live Sessions</h1>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
            <th style={{ padding: "4px 8px" }}>CALLER</th>
            <th style={{ padding: "4px 8px" }}>STATUS</th>
            <th style={{ padding: "4px 8px" }}>MODE</th>
            <th style={{ padding: "4px 8px" }}>CONFIG</th>
            <th style={{ padding: "4px 8px" }}>STARTED</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px" }}>
                <Link href={`/sessions/${s.id}`} style={{ color: "#8cf" }}>
                  {s.callerLabel}
                </Link>
              </td>
              <td style={{ padding: "4px 8px", color: STATUS_COLOR[s.status] ?? "inherit" }}>{s.status}</td>
              <td style={{ padding: "4px 8px" }}>{s.mode}</td>
              <td style={{ padding: "4px 8px" }}>{s.activeConfig.name}</td>
              <td style={{ padding: "4px 8px" }}>{new Date(s.startedAt).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && <p style={{ opacity: 0.5 }}>No sessions yet.</p>}
    </div>
  );
}
