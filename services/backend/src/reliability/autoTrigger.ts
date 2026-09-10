import type { WebSocket as WsSocket } from "ws";
import { lookupOrder, checkTracking, lookupProduct } from "commerce-sandbox";
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
