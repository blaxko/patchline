import type { GateReason } from "../gate/index.js";

export function spellOut(value: string): string {
  return value
    .split("")
    .filter((c) => /[A-Za-z0-9]/.test(c))
    .join("-");
}

export interface RepairContext {
  entityType: string;
  gateReason: GateReason;
  observedValue: string;
  attemptNumber: number; // 1-based
}

const TEMPLATES: Partial<Record<string, (ctx: RepairContext) => string>> = {
  "order_id:ENTITY_AMBIGUOUS": (ctx) =>
    `I heard ${spellOut(ctx.observedValue)} — could you repeat the last four characters of your order ID?`,
  "order_id:ENTITY_NOT_FOUND": (ctx) =>
    `I couldn't find an order matching ${spellOut(ctx.observedValue)} — could you repeat the full order ID?`,
  "tracking_id:ENTITY_AMBIGUOUS": (ctx) =>
    `I heard ${spellOut(ctx.observedValue)} — could you repeat your tracking number?`,
  "tracking_id:ENTITY_NOT_FOUND": (ctx) =>
    `I couldn't find a tracking number matching ${spellOut(ctx.observedValue)} — could you repeat it?`,
  "product_sku:ENTITY_AMBIGUOUS": (ctx) =>
    `I heard ${spellOut(ctx.observedValue)} — could you repeat the product code?`,
  "product_sku:ENTITY_NOT_FOUND": (ctx) =>
    `I couldn't find a product matching ${spellOut(ctx.observedValue)} — could you repeat the product code?`,
  "order_id:NO_ENTITY_EXTRACTED": () =>
    `I didn't catch your order number — could you repeat it?`,
  "tracking_id:NO_ENTITY_EXTRACTED": () =>
    `I didn't catch your tracking number — could you repeat it?`,
  "product_sku:NO_ENTITY_EXTRACTED": () =>
    `I didn't catch that product code — could you repeat it?`,
  "refund_amount:MISSING_CONFIRMATION": (ctx) =>
    `Just to confirm, you'd like a refund of $${ctx.observedValue} — is that correct?`,
  "shipping_address:MISSING_CONFIRMATION": () =>
    `Let me read that back to make sure I have it right — could you repeat your full shipping address?`,
  "customer_name:POLICY_DENIED": () =>
    `I'm sorry, I couldn't confirm your identity on this account — could you confirm the name or email on the order?`,
};

const RETRY_PREFIX = "Let's try that again, one character at a time: ";

export function buildRepairQuestion(ctx: RepairContext): string {
  const key = `${ctx.entityType}:${ctx.gateReason}`;
  const template = TEMPLATES[key];
  const base = template
    ? template(ctx)
    : `I need to double check something you said — could you repeat that?`;

  return ctx.attemptNumber > 1 ? RETRY_PREFIX + base : base;
}
