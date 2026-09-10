import { ulid } from "ulid";
import { prisma } from "../../db.js";
import { writeAuditEvent } from "../../events.js";
import {
  validateOrderId,
  validateTrackingId,
  validateSku,
  validateCustomerIdentity,
  type ValidationOutcome,
} from "../validators/index.js";

export type GateReason =
  | "ENTITY_NOT_FOUND"
  | "ENTITY_AMBIGUOUS"
  | "MISSING_CONFIRMATION"
  | "VALUE_CONFLICT"
  | "LOW_EVIDENCE"
  | "POLICY_DENIED"
  | "NO_ENTITY_EXTRACTED";

export interface ProposedToolCall {
  sessionId: string;
  toolName: string;
  proposedArgs: Record<string, unknown>;
}

export interface GateResult {
  toolCallId: string;
  allowed: boolean;
  reason: GateReason | null;
  finalArgs: Record<string, unknown> | null;
}

interface Decision {
  allowed: boolean;
  reason: GateReason | null;
  finalArgs?: Record<string, unknown>;
}

async function resolveLatestEntity(sessionId: string, entityType: string) {
  return prisma.entity.findFirst({
    where: { sessionId, entityType },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Same as resolveLatestEntity, but first checks whether the caller stated two
 * different values for this slot in the *same utterance* (e.g. "order BRK-7109,
 * no wait, BRK-71Q9" both extracted from one turn) — PRD.md §7's VALUE_CONFLICT
 * reason code, for an adversarial case no other path in this gate produced.
 */
async function resolveEntityOrConflict(
  sessionId: string,
  entityType: string,
): Promise<{ conflict: true } | { conflict: false; entity: Awaited<ReturnType<typeof resolveLatestEntity>> }> {
  const latest = await resolveLatestEntity(sessionId, entityType);
  if (!latest) return { conflict: false, entity: null };

  const sameUtterance = await prisma.entity.findMany({
    where: { sessionId, entityType, utteranceId: latest.utteranceId },
  });
  const distinctValues = new Set(sameUtterance.map((e) => e.normalizedValue));
  if (distinctValues.size > 1) return { conflict: true };

  return { conflict: false, entity: latest };
}

// Once an entity has been through repair (confirmed_by_caller), the value to
// re-validate is the caller-confirmed one, not the original — possibly
// mistranscribed — normalized_value, which PRD.md §3 keeps immutable.
function entityValue(entity: { normalizedValue: string; verifiedValue: string | null }): string {
  return entity.verifiedValue ?? entity.normalizedValue;
}

async function markEntity(
  entityId: string,
  state: string,
  verifiedValue?: string,
  verifiedBy?: "deterministic_validation" | "caller_confirmation",
) {
  await prisma.entity.update({
    where: { id: entityId },
    data: { verificationState: state, verifiedValue: verifiedValue ?? null, verifiedBy: verifiedBy ?? null },
  });
}

async function writeValidationResult(
  entityId: string,
  validatorName: string,
  outcome: ValidationOutcome,
) {
  await prisma.validationResult.create({
    data: {
      id: ulid(),
      entityId,
      validatorName,
      result: outcome.result === "unavailable" ? "no_match" : outcome.result,
      candidates: outcome.result === "ambiguous_candidates" ? JSON.stringify(outcome.candidates) : null,
    },
  });
}

/**
 * Resolves + validates one critical entity (order_id / tracking_id /
 * product_sku), running it through the shared unverified -> validating ->
 * verified|ambiguous|rejected flow (PRD.md §2.2, §7).
 */
async function evaluateSingleEntity(
  sessionId: string,
  entityType: string,
  validatorName: string,
  validator: (value: string) => Promise<ValidationOutcome>,
  argName: string,
): Promise<Decision> {
  const resolved = await resolveEntityOrConflict(sessionId, entityType);
  if (resolved.conflict) return { allowed: false, reason: "VALUE_CONFLICT" };
  const entity = resolved.entity;
  if (!entity) return { allowed: false, reason: "LOW_EVIDENCE" };

  await writeAuditEvent({
    eventType: "entity.validation_started",
    actor: "system",
    resourceType: "entity",
    resourceId: entity.id,
    payload: { entity_type: entityType, value: entityValue(entity) },
    correlationId: sessionId,
  });

  const outcome = await validator(entityValue(entity));
  await writeValidationResult(entity.id, validatorName, outcome);

  if (outcome.result === "unavailable") {
    // Fail closed: validator/DB dependency unavailable never fails open (PRD.md §9 Step 5).
    return { allowed: false, reason: "POLICY_DENIED" };
  }

  if (outcome.result === "no_match") {
    await markEntity(entity.id, "rejected");
    await writeAuditEvent({
      eventType: "entity.rejected",
      actor: "system",
      resourceType: "entity",
      resourceId: entity.id,
      payload: { entity_type: entityType },
      correlationId: sessionId,
    });
    return { allowed: false, reason: "ENTITY_NOT_FOUND" };
  }

  if (outcome.result === "ambiguous_candidates") {
    await markEntity(entity.id, "ambiguous");
    return { allowed: false, reason: "ENTITY_AMBIGUOUS" };
  }

  await markEntity(entity.id, "verified", outcome.matchedValue, "deterministic_validation");
  await writeAuditEvent({
    eventType: "entity.verified",
    actor: "system",
    resourceType: "entity",
    resourceId: entity.id,
    payload: { entity_type: entityType, verified_value: outcome.matchedValue },
    correlationId: sessionId,
  });

  return { allowed: true, reason: null, finalArgs: { [argName]: outcome.matchedValue } };
}

async function evaluateCreateSupportCase(sessionId: string): Promise<Decision> {
  const entity = await resolveLatestEntity(sessionId, "order_id");
  if (!entity) return { allowed: false, reason: "LOW_EVIDENCE" };

  const outcome = await validateOrderId(entityValue(entity));
  await writeValidationResult(entity.id, "order_id_existence", outcome);

  if (outcome.result === "unavailable") return { allowed: false, reason: "POLICY_DENIED" };

  if (outcome.result === "no_match") {
    await markEntity(entity.id, "rejected");
    return { allowed: false, reason: "ENTITY_NOT_FOUND" };
  }

  if (outcome.result === "ambiguous_candidates") {
    // create_support_case is low-risk: ambiguous is allowed, per PRD.md §0 evidence policy.
    await markEntity(entity.id, "ambiguous");
    return { allowed: true, reason: null, finalArgs: { order_id: entityValue(entity), ambiguous: true } };
  }

  await markEntity(entity.id, "verified", outcome.matchedValue, "deterministic_validation");
  return { allowed: true, reason: null, finalArgs: { order_id: outcome.matchedValue } };
}

async function evaluateLookupCustomer(sessionId: string): Promise<Decision> {
  const nameEntity = await resolveLatestEntity(sessionId, "customer_name");
  const emailEntity = await resolveLatestEntity(sessionId, "email");
  const phoneEntity = await resolveLatestEntity(sessionId, "phone_number");
  const identifier = emailEntity ?? phoneEntity;

  if (!nameEntity && !identifier) return { allowed: false, reason: "LOW_EVIDENCE" };

  const outcome = await validateCustomerIdentity({
    name: nameEntity?.normalizedValue,
    email_or_phone: identifier?.normalizedValue,
  });

  const evidenceEntity = identifier ?? nameEntity!;
  await writeValidationResult(evidenceEntity.id, "customer_identity", outcome);

  if (outcome.result === "unavailable") return { allowed: false, reason: "POLICY_DENIED" };
  if (outcome.result !== "match") {
    await markEntity(evidenceEntity.id, "rejected");
    return { allowed: false, reason: "ENTITY_NOT_FOUND" };
  }

  await markEntity(evidenceEntity.id, "verified", outcome.matchedValue, "deterministic_validation");
  return {
    allowed: true,
    reason: null,
    finalArgs: { name: nameEntity?.normalizedValue, email_or_phone: identifier?.normalizedValue },
  };
}

async function evaluateRequestRefund(sessionId: string): Promise<Decision> {
  const orderDecision = await evaluateSingleEntity(
    sessionId,
    "order_id",
    "order_id_existence",
    validateOrderId,
    "order_id",
  );
  if (!orderDecision.allowed) return orderDecision;

  const orderId = orderDecision.finalArgs!.order_id as string;
  const orderOutcome = await validateOrderId(orderId); // re-fetch order detail for eligibility/identity check
  const orderDetail = orderOutcome.result === "match" ? orderOutcome.detail : undefined;

  const identityEntity =
    (await resolveLatestEntity(sessionId, "email")) ?? (await resolveLatestEntity(sessionId, "customer_name"));
  if (!identityEntity) return { allowed: false, reason: "POLICY_DENIED" };

  const identityOutcome = await validateCustomerIdentity({
    email_or_phone: identityEntity.entityType === "email" ? identityEntity.normalizedValue : undefined,
    name: identityEntity.entityType === "customer_name" ? identityEntity.normalizedValue : undefined,
  });
  const identityMatchesOrder =
    identityOutcome.result === "match" &&
    orderDetail !== undefined &&
    (identityOutcome.detail as { name?: string })?.name === (orderDetail as { customer_name?: string })?.customer_name;

  if (!identityMatchesOrder) return { allowed: false, reason: "POLICY_DENIED" };

  const amountEntity = await resolveLatestEntity(sessionId, "refund_amount");
  if (!amountEntity) return { allowed: false, reason: "MISSING_CONFIRMATION" };

  const orderTotal = (orderDetail as { total?: number } | undefined)?.total;
  const statedAmount = Number(amountEntity.normalizedValue);
  const amountVerified = orderTotal !== undefined && Math.abs(statedAmount - orderTotal) < 0.01;

  if (!amountVerified) return { allowed: false, reason: "MISSING_CONFIRMATION" };

  await markEntity(amountEntity.id, "verified", amountEntity.normalizedValue, "deterministic_validation");
  return { allowed: true, reason: null, finalArgs: { order_id: orderId, amount: statedAmount } };
}

async function evaluateUpdateShippingAddress(sessionId: string): Promise<Decision> {
  const orderDecision = await evaluateSingleEntity(
    sessionId,
    "order_id",
    "order_id_existence",
    validateOrderId,
    "order_id",
  );
  if (!orderDecision.allowed) return orderDecision;

  const addressEntity = await resolveLatestEntity(sessionId, "shipping_address");
  if (!addressEntity) return { allowed: false, reason: "LOW_EVIDENCE" };

  // An address can only become usable once confirmed_by_caller (PRD.md §0
  // evidence policy) — that transition is the Repair Engine's job (Step 6),
  // not yet built, so this correctly blocks every address until then.
  if (addressEntity.verificationState !== "confirmed_by_caller") {
    return { allowed: false, reason: "MISSING_CONFIRMATION" };
  }

  return {
    allowed: true,
    reason: null,
    finalArgs: { order_id: orderDecision.finalArgs!.order_id, address: addressEntity.verifiedValue },
  };
}

const MUTATING_TOOLS = new Set(["request_refund", "update_shipping_address"]);

export async function evaluateToolCall(call: ProposedToolCall): Promise<GateResult> {
  const { sessionId, toolName, proposedArgs } = call;
  const toolCallId = ulid();

  let decision: Decision;
  switch (toolName) {
    case "lookup_order":
      decision = await evaluateSingleEntity(sessionId, "order_id", "order_id_existence", validateOrderId, "order_id");
      break;
    case "check_tracking":
      decision = await evaluateSingleEntity(
        sessionId,
        "tracking_id",
        "tracking_id_existence",
        validateTrackingId,
        "tracking_id",
      );
      break;
    case "lookup_product":
      decision = await evaluateSingleEntity(sessionId, "product_sku", "sku_existence", validateSku, "sku");
      break;
    case "lookup_customer":
      decision = await evaluateLookupCustomer(sessionId);
      break;
    case "create_support_case":
      decision = await evaluateCreateSupportCase(sessionId);
      break;
    case "escalate_to_human":
      decision = { allowed: true, reason: null, finalArgs: proposedArgs };
      break;
    case "request_refund":
      decision = await evaluateRequestRefund(sessionId);
      break;
    case "update_shipping_address":
      decision = await evaluateUpdateShippingAddress(sessionId);
      break;
    default:
      decision = { allowed: false, reason: "POLICY_DENIED" };
  }

  await prisma.toolCall.create({
    data: {
      id: toolCallId,
      sessionId,
      toolName,
      proposedArgs: JSON.stringify(proposedArgs),
      finalArgs: decision.allowed ? JSON.stringify(decision.finalArgs ?? proposedArgs) : null,
      gateResult: decision.allowed ? "allowed" : "blocked",
      gateReason: decision.reason,
      simulated: MUTATING_TOOLS.has(toolName),
      executedAt: decision.allowed ? new Date() : null,
    },
  });

  await writeAuditEvent({
    eventType: decision.allowed ? "action.allowed" : "action.blocked",
    actor: "system",
    resourceType: "tool_call",
    resourceId: toolCallId,
    payload: { tool_name: toolName, proposed_args: proposedArgs, reason: decision.reason },
    correlationId: sessionId,
  });

  return {
    toolCallId,
    allowed: decision.allowed,
    reason: decision.reason,
    finalArgs: decision.allowed ? (decision.finalArgs ?? proposedArgs) : null,
  };
}
