import styles from "./Dashboard.module.css";

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
    return <p style={{ opacity: 0.5 }}>No replay runs yet — select candidate configs and click Replay.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Config</th>
          <th>Entity</th>
          <th>Latency</th>
          <th>Result</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td>{run.config_name}</td>
            <td>{run.extractedValue ?? "—"}</td>
            <td>{run.latencyMs !== null ? `${run.latencyMs} ms` : "—"}</td>
            <td>
              <span
                className={styles.badge}
                style={
                  run.status === "pass"
                    ? { background: "rgba(97, 153, 246, 0.15)", color: "#6199f6" }
                    : { background: "rgba(243, 114, 114, 0.15)", color: "#f37272" }
                }
              >
                {run.status.toUpperCase()}
              </span>
            </td>
            <td>
              {run.status === "pass" && run.config_status !== "active" && onPromote && (
                <button className={styles.button} onClick={() => onPromote(run.configId)}>
                  Promote
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
