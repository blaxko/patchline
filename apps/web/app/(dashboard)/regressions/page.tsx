"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../lib/api";
import { useDashboardLive } from "../../../lib/useDashboardLive";

interface RegressionRow {
  id: string;
  entityType: string;
  expectedValue: string;
  observedValue: string;
  repairMethod: string;
  status: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  open: "#fc8",
  replaying: "#8cf",
  replayed: "#8cf",
  closed: "#8f8",
  reopened: "#f84",
};

export default function RegressionLabPage() {
  const [regressions, setRegressions] = useState<RegressionRow[]>([]);

  const refresh = useCallback(() => {
    apiGet<{ regressions: RegressionRow[] }>("/api/regressions").then((d) => setRegressions(d.regressions)).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useDashboardLive(refresh);

  return (
    <div style={{ fontFamily: "monospace" }}>
      <h1>Regression Lab</h1>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
            <th style={{ padding: "4px 8px" }}>ENTITY</th>
            <th style={{ padding: "4px 8px" }}>EXPECTED</th>
            <th style={{ padding: "4px 8px" }}>OBSERVED (BAD)</th>
            <th style={{ padding: "4px 8px" }}>TRUTH SOURCE</th>
            <th style={{ padding: "4px 8px" }}>STATUS</th>
            <th style={{ padding: "4px 8px" }}>CREATED</th>
          </tr>
        </thead>
        <tbody>
          {regressions.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "4px 8px" }}>
                <Link href={`/regressions/${r.id}`} style={{ color: "#8cf" }}>
                  {r.entityType}
                </Link>
              </td>
              <td style={{ padding: "4px 8px" }}>{r.expectedValue}</td>
              <td style={{ padding: "4px 8px" }}>{r.observedValue}</td>
              <td style={{ padding: "4px 8px" }}>{r.repairMethod}</td>
              <td style={{ padding: "4px 8px", color: STATUS_COLOR[r.status] ?? "inherit" }}>{r.status}</td>
              <td style={{ padding: "4px 8px" }}>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {regressions.length === 0 && <p style={{ opacity: 0.5 }}>No regressions yet — a recovered repair creates one automatically.</p>}
    </div>
  );
}
