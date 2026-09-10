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
  "action.blocked": "#f84",
  "entity.rejected": "#f84",
  "action.allowed": "#8f8",
  "entity.verified": "#8f8",
  "regression.created": "#8cf",
  "repair.started": "#fc8",
};

export function EvidenceTimeline({ events, sessionStartedAt }: { events: EvidenceEvent[]; sessionStartedAt: string }) {
  if (events.length === 0) {
    return <p style={{ opacity: 0.5, fontFamily: "monospace" }}>No events yet.</p>;
  }

  return (
    <div style={{ fontFamily: "monospace", fontSize: 13 }}>
      {events.map((e) => (
        <div key={e.id} style={{ display: "flex", gap: 12, padding: "3px 0", borderBottom: "1px solid #222" }}>
          <span style={{ opacity: 0.6, minWidth: 60 }}>{formatOffset(sessionStartedAt, e.createdAt)}</span>
          <span style={{ color: EVENT_COLOR[e.eventType] ?? "inherit" }}>{describeEvent(e)}</span>
        </div>
      ))}
    </div>
  );
}
