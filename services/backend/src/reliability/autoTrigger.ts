import { ulid } from "ulid";
import type { WebSocket as WsSocket } from "ws";
import { lookupOrder, checkTracking, lookupProduct } from "commerce-sandbox";
import type { CriticalEntityType } from "schemas";
import { prisma } from "../db.js";
import { writeAuditEvent } from "../events.js";
import { evaluateToolCall } from "./gate/index.js";
import type { DetectedEntity } from "./extraction/index.js";
import { startRepair, hasPendingRepair } from "./repair/index.js";

// PRD.md §9 Step 5 assumes a Support Agent already proposes tool calls; that
// module isn't built until a later step (no PRD step explicitly constructs
// it). Until then, a detected read-only-lookup entity deterministically
// proposes the corresponding lookup tool call, which is enough to exercise
// and demonstrate the Action Gate end to end (see TASKS.md Step 5 notes).
const ENTITY_TO_TOOL: Record<string, { toolName: string; argName: string }> = {
  order_id: { toolName: "lookup_order", argName: "order_id" },
  tracking_id: { toolName: "check_tracking", argName: "tracking_id" },
  product_sku: { toolName: "lookup_product", argName: "sku" },
};

export interface AutoTriggerResult {
  toolName: string;
  allowed: boolean;
  reason: string | null;
  result?: unknown;
}

export async function executeTool(toolName: string, finalArgs: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case "lookup_order":
      return lookupOrder({ order_id: finalArgs.order_id as string });
    case "check_tracking":
      return checkTracking({ tracking_id: finalArgs.tracking_id as string });
    case "lookup_product":
      return lookupProduct({ sku: finalArgs.sku as string });
    default:
      return null;
  }
}

// A caller trying to state a critical-entity value whom the pipeline could
// not extract anything usable from (no rule-pass match, no LLM fallback
// match) reproduces live — e.g. "checking on order nv dash" or "status of
// order zxa-4 v8" (TASKS.md adversarial table, o_zero_confusion/
// b_v_confusion). Without this, the turn is silently dropped: no entity, no
// gate call, no repair. Detected via a cue-word heuristic (the same
// simplification basis as the LLM-fallback trigger in extraction/index.ts,
// since the intent classifier that would properly signal "an order id was
// expected here" isn't built until the Support Agent step) — only fires when
// no repair is already outstanding, so it can't double up with the
// gate-blocked repair flow above.
const ENTITY_CUE_WORDS: Array<{ pattern: RegExp; entityType: CriticalEntityType; toolName: string; argName: string }> = [
  { pattern: /\border(?:\s|$)/i, entityType: "order_id", toolName: "lookup_order", argName: "order_id" },
  { pattern: /\btracking\b/i, entityType: "tracking_id", toolName: "check_tracking", argName: "tracking_id" },
  { pattern: /\bsku\b/i, entityType: "product_sku", toolName: "lookup_product", argName: "sku" },
];

export async function maybeStartNoEntityRepair(
  sessionId: string,
  utteranceId: string,
  transcript: string,
  browserWs: WsSocket,
): Promise<boolean> {
  if (hasPendingRepair(sessionId)) return false;

  // Requiring a digit or the literal word "dash" alongside the cue word is
  // what separates a caller actually attempting to state an ID — live
  // transcripts: "order nv dash" (o_zero_confusion, no digit but the caller's
  // spoken dash survived as a word), "status of order zxa-4 v8"
  // (b_v_confusion, digits present) — from simply mentioning the topic ("I
  // need help with an order", neither a digit nor "dash", which must NOT
  // trigger a repair question — regression: an earlier, looser version of
  // this heuristic false-triggered on exactly that phrasing, breaking the
  // mocked realtime multi-turn test).
  if (!/\d/.test(transcript) && !/\bdash\b/i.test(transcript)) return false;

  const cue = ENTITY_CUE_WORDS.find((c) => c.pattern.test(transcript));
  if (!cue) return false;

  const entityId = ulid();
  await prisma.entity.create({
    data: {
      id: entityId,
      sessionId,
      utteranceId,
      entityType: cue.entityType,
      rawText: transcript,
      normalizedValue: "",
      verificationState: "unverified",
      startMs: 0,
      endMs: 0,
    },
  });

  await writeAuditEvent({
    eventType: "entity.detected",
    actor: "system",
    resourceType: "entity",
    resourceId: entityId,
    payload: { entity_type: cue.entityType, transcript, no_entity_extracted: true },
    correlationId: sessionId,
  });

  await startRepair({
    sessionId,
    entityId,
    entityType: cue.entityType,
    gateReason: "NO_ENTITY_EXTRACTED",
    observedValue: "",
    toolName: cue.toolName,
    proposedArgs: { [cue.argName]: "" },
    browserWs,
  });

  return true;
}

export async function maybeAutoProposeToolCalls(
  sessionId: string,
  detectedEntities: DetectedEntity[],
  browserWs: WsSocket,
): Promise<AutoTriggerResult[]> {
  const results: AutoTriggerResult[] = [];

  for (const entity of detectedEntities) {
    const mapping = ENTITY_TO_TOOL[entity.entityType];
    if (!mapping) continue;

    const proposedArgs = { [mapping.argName]: entity.normalizedValue };
    const gateResult = await evaluateToolCall({ sessionId, toolName: mapping.toolName, proposedArgs });

    let toolResult: unknown;
    if (gateResult.allowed && gateResult.finalArgs) {
      toolResult = await executeTool(mapping.toolName, gateResult.finalArgs);
    } else if (gateResult.reason && gateResult.reason !== "LOW_EVIDENCE" && !hasPendingRepair(sessionId)) {
      // Only one repair question can be outstanding per session at a time —
      // if multiple entities blocked in the same turn, the first claims the
      // repair slot; the rest simply stay blocked until the caller's next turn.
      await startRepair({
        sessionId,
        entityId: entity.id,
        entityType: entity.entityType,
        gateReason: gateResult.reason,
        observedValue: entity.normalizedValue,
        toolName: mapping.toolName,
        proposedArgs,
        browserWs,
      });
    }

    results.push({ toolName: mapping.toolName, allowed: gateResult.allowed, reason: gateResult.reason, result: toolResult });
  }

  return results;
}
