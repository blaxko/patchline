import styles from "./Dashboard.module.css";

export interface EvidenceEvent {
  id: string;
  eventType: string;
  payload: any;
  createdAt: string;
}

function formatOffset(startedAt: string, createdAt: string): string {
  const ms = Math.max(0, new Date(createdAt).getTime() - new Date(startedAt).getTime());
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

// One human-readable line per event type, per PRD.md §11's Evidence Timeline example.
function describeEvent(e: EvidenceEvent): string {
  const p = e.payload ?? {};
  switch (e.eventType) {
    case "session.started":
      return "Session started";
    case "transcript.final":
      return `Caller: "${p.transcript}"`;
    case "entity.detected":
      return `Entity detected: ${p.normalized_value} (${p.entity_type})`;
    case "entity.validation_started":
      return `Validating ${p.entity_type}: ${p.value}`;
    case "entity.verified":
      return `Entity verified: ${p.verified_value}`;
    case "entity.rejected":
      return `Validation failed: ${p.entity_type}`;
    case "action.allowed":
      return `${p.tool_name} allowed`;
    case "action.blocked":
      return `${p.tool_name} blocked (reason: ${p.reason})`;
    case "repair.started":
      return `Repair question spoken: "${p.question}"`;
    case "repair.completed":
      return `Repair ${p.outcome}${p.resolved_value ? `: "${p.resolved_value}"` : ""}`;
    case "regression.created":
      return `Regression created (${p.repair_method})`;
    case "session.completed":
      return `Session completed (${p.status})`;
    default:
      return e.eventType;
  }
}

const EVENT_COLOR: Record<string, string> = {
  "action.blocked": "#f37272",
  "entity.rejected": "#f37272",
  "action.allowed": "#6199f6",
  "entity.verified": "#6199f6",
  "regression.created": "#6199f6",
  "repair.started": "#f3c772",
};

export function EvidenceTimeline({ events, sessionStartedAt }: { events: EvidenceEvent[]; sessionStartedAt: string }) {
  if (events.length === 0) {
    return <p style={{ opacity: 0.5 }}>No events yet.</p>;
  }

  return (
    <div className={styles.panel}>
      {events.map((e) => (
        <div key={e.id} className={styles.timelineRow}>
          <span className={styles.timelineTime}>{formatOffset(sessionStartedAt, e.createdAt)}</span>
          <span style={{ color: EVENT_COLOR[e.eventType] ?? "#a3a3b3" }}>{describeEvent(e)}</span>
        </div>
      ))}
    </div>
  );
}
