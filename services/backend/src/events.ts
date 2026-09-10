import { ulid } from "ulid";
import { EventEmitter } from "node:events";
import { prisma } from "./db.js";

// Dashboard WS clients (Step 11) subscribe here to mirror the event catalog
// 1:1 as it's written, per PRD.md §8 — "a connected dashboard client never
// polls for state it should have received as a push."
export const auditEventBus = new EventEmitter();
auditEventBus.setMaxListeners(100);

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
  const id = ulid();
  await prisma.auditEvent.create({
    data: {
      id,
      eventType: params.eventType,
      actor: params.actor,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      payload: JSON.stringify(params.payload),
      correlationId: params.correlationId,
    },
  });

  auditEventBus.emit("event", {
    id,
    type: params.eventType,
    payload: params.payload,
    correlation_id: params.correlationId,
  });
}
