import { ulid } from "ulid";
import type { WebSocket as WsSocket } from "ws";
import { extractRulePassEntities, RULE_PASS_ENTITY_TYPES, mapTokensToChars, type CriticalEntityType } from "schemas";
import { prisma } from "../../db.js";
import { writeAuditEvent } from "../../events.js";
import { evaluateToolCall, type GateReason } from "../gate/index.js";
import { validateOrderId, validateTrackingId, validateSku } from "../validators/index.js";
import { extractLlmFallbackEntities } from "../extraction/llmFallback.js";
import { buildRepairQuestion } from "./questionTemplates.js";
import { speak } from "../../tts/orpheusClient.js";
import { createRegressionFromRepair, AudioSegmentMissingError } from "../regression/index.js";

const REPAIR_BUDGET = 2; // max attempts before escalating, PRD.md §2.4

interface PendingRepair {
  entityId: string;
  entityType: CriticalEntityType;
  gateReason: GateReason;
  observedValue: string;
  attemptNumber: number;
  askedAtMs: number;
  turnCount: number;
  toolName: string;
  proposedArgs: Record<string, unknown>;
}

// One backend process (DECISIONS.md D6), module-level map keyed by session is
// an acceptable simplification for this build's single-process scope.
const pendingRepairs = new Map<string, PendingRepair>();

export function hasPendingRepair(sessionId: string): boolean {
  return pendingRepairs.has(sessionId);
}

export function clearPendingRepair(sessionId: string): void {
  pendingRepairs.delete(sessionId);
}

const RE_VALIDATORS: Partial<Record<CriticalEntityType, (v: string) => Promise<{ result: string; matchedValue?: string }>>> = {
  order_id: validateOrderId,
  tracking_id: validateTrackingId,
  product_sku: validateSku,
};

function send(ws: WsSocket, payload: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

export async function startRepair(params: {
  sessionId: string;
  entityId: string;
  entityType: CriticalEntityType;
  gateReason: GateReason;
  observedValue: string;
  toolName: string;
  proposedArgs: Record<string, unknown>;
  browserWs: WsSocket;
}): Promise<void> {
  const attemptNumber = 1;
  const question = buildRepairQuestion({
    entityType: params.entityType,
    gateReason: params.gateReason,
    observedValue: params.observedValue,
    attemptNumber,
  });

  pendingRepairs.set(params.sessionId, {
    entityId: params.entityId,
    entityType: params.entityType,
    gateReason: params.gateReason,
    observedValue: params.observedValue,
    attemptNumber,
    askedAtMs: Date.now(),
    turnCount: 0,
    toolName: params.toolName,
    proposedArgs: params.proposedArgs,
  });

  await writeAuditEvent({
    eventType: "repair.started",
    actor: "system",
    resourceType: "entity",
    resourceId: params.entityId,
    payload: { question, attempt_number: attemptNumber, gate_reason: params.gateReason },
    correlationId: params.sessionId,
  });

  await speakQuestion(question, params.browserWs);
}

async function speakQuestion(question: string, browserWs: WsSocket): Promise<void> {
  send(browserWs, { type: "repair_question", text: question });

  const audio = await speak(question);
  if (audio) {
    send(browserWs, { type: "repair_audio", audio_base64: audio.toString("base64"), format: "wav" });
  }
  // No audio available (no key / timeout / error): the question text above is
  // already shown — the call degrades to text-only rather than hard-failing
  // (TESTING.md "TTS failure" row).
}

/**
 * A repair reply often restates only the *disputed portion* of an ID, not
 * the whole thing (PRD.md §0 demo scenario: caller repeats just "seven, one,
 * Q, nine", the last four characters — the prefix, already heard correctly,
 * is not re-spoken). Splices that portion onto the known-good prefix from
 * the originally observed (rejected/ambiguous) value.
 */
function reconstructFromSuffix(entityType: CriticalEntityType, observedValue: string, responseText: string): string | null {
  const tokens = responseText.split(/\s+/).filter(Boolean);
  const mapped = mapTokensToChars(tokens);
  if (!mapped) return null;

  if (entityType === "order_id") {
    const match = observedValue.match(/^([A-Z]{2,3})-/);
    if (!match || mapped.length !== 4 || !/^[A-Z0-9]{4}$/.test(mapped)) return null;
    return `${match[1]}-${mapped}`;
  }

  if (entityType === "tracking_id") {
    if (!/^\d{4,6}$/.test(mapped)) return null;
    return `TRK-${mapped}`;
  }

  return null;
}

async function parseCandidateForType(
  entityType: CriticalEntityType,
  text: string,
  observedValue: string,
): Promise<string | null> {
  if (RULE_PASS_ENTITY_TYPES.includes(entityType)) {
    const candidates = extractRulePassEntities(text).filter((c) => c.entityType === entityType);
    if (candidates[0]) return candidates[0].normalizedValue;
    return reconstructFromSuffix(entityType, observedValue, text);
  }
  const llmCandidates = await extractLlmFallbackEntities(text);
  return llmCandidates.find((c) => c.entityType === entityType)?.normalizedValue ?? null;
}

export interface RepairTurnResult {
  handled: boolean;
  toolResult?: { toolName: string; allowed: boolean; reason: GateReason | null; result?: unknown };
}

/**
 * Consumes a caller's finalized turn as the answer to a pending repair
 * question, per PRD.md §2.4. Returns handled:false if there was no pending
 * repair for this session (the turn should go through normal processing).
 */
export async function handleRepairTurn(
  sessionId: string,
  responseText: string,
  browserWs: WsSocket,
  executeTool: (toolName: string, finalArgs: Record<string, unknown>) => Promise<unknown>,
): Promise<RepairTurnResult> {
  const pending = pendingRepairs.get(sessionId);
  if (!pending) return { handled: false };

  pending.turnCount += 1;
  const candidate = await parseCandidateForType(pending.entityType, responseText, pending.observedValue);
  const latencyMs = Date.now() - pending.askedAtMs;

  if (!candidate) {
    if (pending.attemptNumber >= REPAIR_BUDGET) {
      await writeRepairEventRow(sessionId, pending, { response: responseText, resolvedValue: null, latencyMs, outcome: "escalated" });
      pendingRepairs.delete(sessionId);
      await escalate(sessionId, browserWs, executeTool);
      return { handled: true };
    }

    await writeRepairEventRow(sessionId, pending, { response: responseText, resolvedValue: null, latencyMs, outcome: "unresolved" });

    pending.attemptNumber += 1;
    pending.askedAtMs = Date.now();
    const question = buildRepairQuestion({
      entityType: pending.entityType,
      gateReason: pending.gateReason,
      observedValue: pending.observedValue,
      attemptNumber: pending.attemptNumber,
    });
    await speakQuestion(question, browserWs);
    return { handled: true };
  }

  // Candidate parsed: mark confirmed_by_caller, then re-validate once (PRD.md §2.2 —
  // confirmed_by_caller values are always re-validated before use).
  await prisma.entity.update({
    where: { id: pending.entityId },
    data: { verificationState: "confirmed_by_caller", verifiedValue: candidate, verifiedBy: "caller_confirmation" },
  });

  const revalidate = RE_VALIDATORS[pending.entityType];
  const revalidated = revalidate ? await revalidate(candidate) : { result: "match", matchedValue: candidate };

  if (revalidated.result !== "match") {
    await prisma.entity.update({ where: { id: pending.entityId }, data: { verificationState: "escalated" } });
    await writeRepairEventRow(sessionId, pending, { response: responseText, resolvedValue: candidate, latencyMs, outcome: "escalated" });
    pendingRepairs.delete(sessionId);
    await escalate(sessionId, browserWs, executeTool);
    return { handled: true };
  }

  await prisma.entity.update({
    where: { id: pending.entityId },
    data: { verificationState: "verified", verifiedValue: revalidated.matchedValue ?? candidate },
  });

  await writeRepairEventRow(sessionId, pending, { response: responseText, resolvedValue: candidate, latencyMs, outcome: "resolved" });
  pendingRepairs.delete(sessionId);

  await createRegressionCase(sessionId, pending, candidate);

  const argName = Object.keys(pending.proposedArgs)[0];
  const gateResult = await evaluateToolCall({
    sessionId,
    toolName: pending.toolName,
    proposedArgs: { ...pending.proposedArgs, [argName]: candidate },
  });

  let toolExecutionResult: unknown;
  if (gateResult.allowed && gateResult.finalArgs) {
    toolExecutionResult = await executeTool(pending.toolName, gateResult.finalArgs);
  }

  return {
    handled: true,
    toolResult: { toolName: pending.toolName, allowed: gateResult.allowed, reason: gateResult.reason, result: toolExecutionResult },
  };
}

async function writeRepairEventRow(
  sessionId: string,
  pending: PendingRepair,
  outcome: { response: string; resolvedValue: string | null; latencyMs: number; outcome: "resolved" | "unresolved" | "escalated" },
): Promise<void> {
  await prisma.repairEvent.create({
    data: {
      id: ulid(),
      sessionId,
      entityId: pending.entityId,
      question: buildRepairQuestion({
        entityType: pending.entityType,
        gateReason: pending.gateReason,
        observedValue: pending.observedValue,
        attemptNumber: pending.attemptNumber,
      }),
      response: outcome.response,
      resolvedValue: outcome.resolvedValue,
      attemptNumber: pending.attemptNumber,
      turnCount: pending.turnCount,
      latencyMs: outcome.latencyMs,
      outcome: outcome.outcome,
    },
  });

  await writeAuditEvent({
    eventType: "repair.completed",
    actor: "system",
    resourceType: "entity",
    resourceId: pending.entityId,
    payload: { outcome: outcome.outcome, resolved_value: outcome.resolvedValue, attempt_number: pending.attemptNumber },
    correlationId: sessionId,
  });
}

async function createRegressionCase(sessionId: string, pending: PendingRepair, resolvedValue: string): Promise<void> {
  try {
    const entity = await prisma.entity.findUniqueOrThrow({ where: { id: pending.entityId } });
    const utterance = await prisma.utterance.findUniqueOrThrow({ where: { id: entity.utteranceId } });

    await createRegressionFromRepair({
      sessionId,
      entityId: pending.entityId,
      entityType: pending.entityType,
      utteranceText: utterance.text,
      expectedValue: resolvedValue,
      observedValue: pending.observedValue,
      entityStartMs: entity.startMs,
      entityEndMs: entity.endMs,
      repairMethod: "caller_confirmation",
    });
  } catch (err) {
    if (err instanceof AudioSegmentMissingError) {
      // Fail closed per PRD.md §9 Step 7 — no regression row without its audio.
      return;
    }
    throw err;
  }
}

async function escalate(
  sessionId: string,
  browserWs: WsSocket,
  executeTool: (toolName: string, finalArgs: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  const gateResult = await evaluateToolCall({
    sessionId,
    toolName: "escalate_to_human",
    proposedArgs: { reason: "repair budget exhausted or re-validation failed" },
  });
  if (gateResult.allowed && gateResult.finalArgs) {
    await executeTool("escalate_to_human", gateResult.finalArgs);
  }
  send(browserWs, { type: "escalated" });
}
