import { ulid } from "ulid";
import { prisma } from "./db.js";

// Event catalog per PRD.md §8. correlation_id = session_id for live events,
// = regression_id for replay/promotion events (added in later steps).
export type EventType =
  | "session.started"
  | "transcript.partial"
  | "transcript.final"
  | "entity.detected"
  | "entity.validation_started"
  | "entity.verified"
  | "entity.rejected"
  | "action.allowed"
  | "action.blocked"
  | "repair.started"
  | "repair.completed"
  | "regression.created"
  | "regression.replay_started"
  | "regression.replay_completed"
  | "config.promoted"
  | "config.rolled_back"
  | "session.completed";

export async function writeAuditEvent(params: {
  eventType: EventType;
  actor: string;
  resourceType: string;
  resourceId: string;
  payload: unknown;
  correlationId: string;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      id: ulid(),
      eventType: params.eventType,
      actor: params.actor,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      payload: JSON.stringify(params.payload),
      correlationId: params.correlationId,
    },
  });
}
