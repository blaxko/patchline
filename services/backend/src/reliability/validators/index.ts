import { lookupOrder, checkTracking, lookupProduct, lookupCustomer } from "commerce-sandbox";

export type ValidationOutcome =
  | { result: "match"; matchedValue: string; detail?: Record<string, unknown> }
  | { result: "no_match" }
  | { result: "ambiguous_candidates"; candidates: { order_id?: string; tracking_id?: string; sku?: string; distance: number }[] }
  | { result: "unavailable" };

// Deterministic checks against the Commerce Sandbox — never an LLM (PRD.md §1
// ownership table: Independent Validators own existence/format/similarity
// checks, never repair-question wording).

export async function validateOrderId(orderId: string): Promise<ValidationOutcome> {
  try {
    const res = await lookupOrder({ order_id: orderId });
    if (res.found) return { result: "match", matchedValue: res.order_id, detail: res };
    if (res.reason === "NOT_FOUND" && res.close_matches.length > 0) {
      return { result: "ambiguous_candidates", candidates: res.close_matches };
    }
    return { result: "no_match" };
  } catch {
    return { result: "unavailable" };
  }
}

export async function validateTrackingId(trackingId: string): Promise<ValidationOutcome> {
  try {
    const res = await checkTracking({ tracking_id: trackingId });
    if (res.found) return { result: "match", matchedValue: res.tracking_id, detail: res };
    if (res.reason === "NOT_FOUND" && res.close_matches.length > 0) {
      return {
        result: "ambiguous_candidates",
        candidates: res.close_matches.map((c) => ({ tracking_id: c.tracking_id, distance: c.distance })),
      };
    }
    return { result: "no_match" };
  } catch {
    return { result: "unavailable" };
  }
}

export async function validateSku(sku: string): Promise<ValidationOutcome> {
  try {
    const res = await lookupProduct({ sku });
    if (res.found) return { result: "match", matchedValue: res.sku, detail: res };
    if (res.reason === "NOT_FOUND" && res.close_matches.length > 0) {
      return {
        result: "ambiguous_candidates",
        candidates: res.close_matches.map((c) => ({ sku: c.sku, distance: c.distance })),
      };
    }
    return { result: "no_match" };
  } catch {
    return { result: "unavailable" };
  }
}

export async function validateCustomerIdentity(
  nameOrEmailOrPhone: { name?: string; email_or_phone?: string },
): Promise<ValidationOutcome> {
  try {
    const res = await lookupCustomer(nameOrEmailOrPhone);
    if (res.found) return { result: "match", matchedValue: res.customer_id, detail: res };
    return { result: "no_match" };
  } catch {
    return { result: "unavailable" };
  }
}
