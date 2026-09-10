export interface ReplayRunRow {
  id: string;
  configId: string;
  config_name: string;
  config_status: string | null;
  extractedValue: string | null;
  latencyMs: number | null;
  status: string;
}

export function RegressionCompare({
  runs,
  onPromote,
}: {
  runs: ReplayRunRow[];
  onPromote?: (configId: string) => void;
}) {
  if (runs.length === 0) {
    return <p style={{ opacity: 0.5, fontFamily: "monospace" }}>No replay runs yet — select candidate configs and click Replay.</p>;
  }

  return (
    <table style={{ fontFamily: "monospace", fontSize: 13, borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
          <th style={{ padding: "4px 8px" }}>CONFIG</th>
          <th style={{ padding: "4px 8px" }}>ENTITY</th>
          <th style={{ padding: "4px 8px" }}>LATENCY</th>
          <th style={{ padding: "4px 8px" }}>RESULT</th>
          <th style={{ padding: "4px 8px" }}></th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id} style={{ borderBottom: "1px solid #222" }}>
            <td style={{ padding: "4px 8px" }}>{run.config_name}</td>
            <td style={{ padding: "4px 8px" }}>{run.extractedValue ?? "—"}</td>
            <td style={{ padding: "4px 8px" }}>{run.latencyMs !== null ? `${run.latencyMs} ms` : "—"}</td>
            <td style={{ padding: "4px 8px", color: run.status === "pass" ? "#8f8" : "#f84" }}>
              {run.status.toUpperCase()}
            </td>
            <td style={{ padding: "4px 8px" }}>
              {run.status === "pass" && run.config_status !== "active" && onPromote && (
                <button onClick={() => onPromote(run.configId)}>Promote</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
