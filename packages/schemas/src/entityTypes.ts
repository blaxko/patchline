// Critical entity types per PRD.md §0.
export const CRITICAL_ENTITY_TYPES = [
  "order_id",
  "tracking_id",
  "customer_name",
  "email",
  "phone_number",
  "shipping_address",
  "product_sku",
  "refund_amount",
  "quantity",
  "coupon_code",
] as const;

export type CriticalEntityType = (typeof CRITICAL_ENTITY_TYPES)[number];

// Entity types the deterministic rule pass can reliably regex (structured
// formats). The rest fall through to the Groq LLM fallback pass per PRD §5.
export const RULE_PASS_ENTITY_TYPES: CriticalEntityType[] = [
  "order_id",
  "tracking_id",
  "product_sku",
  "coupon_code",
  "email",
  "phone_number",
];

export const LLM_FALLBACK_ENTITY_TYPES: CriticalEntityType[] = [
  "customer_name",
  "shipping_address",
  "refund_amount",
];

export interface ExtractedCandidate {
  entityType: CriticalEntityType;
  rawText: string;
  normalizedValue: string;
  source: "rule" | "llm_fallback";
}
