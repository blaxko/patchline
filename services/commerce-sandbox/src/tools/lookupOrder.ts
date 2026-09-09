import { z } from "zod";
import { prisma } from "../db.js";
import { isValidOrderIdFormat } from "../lib/format.js";
import { levenshtein } from "../lib/levenshtein.js";
import type { CloseMatch } from "./types.js";

export const lookupOrderInput = z.object({
  order_id: z.string().min(1),
});

export type LookupOrderInput = z.infer<typeof lookupOrderInput>;

export type LookupOrderResult =
  | {
      found: true;
      order_id: string;
      status: string;
      tracking_id: string | null;
      total: number;
      refund_eligible: string;
      shipping_address: string;
      customer_name: string;
      placed_at: string;
    }
  | { found: false; reason: "INVALID_FORMAT" }
  | { found: false; reason: "NOT_FOUND"; close_matches: CloseMatch[] };

const CLOSE_MATCH_MAX_DISTANCE = 2;

export async function lookupOrder(input: LookupOrderInput): Promise<LookupOrderResult> {
  const orderId = input.order_id.toUpperCase();

  if (!isValidOrderIdFormat(orderId)) {
    return { found: false, reason: "INVALID_FORMAT" };
  }

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { customer: true },
  });

  if (order) {
    return {
      found: true,
      order_id: order.orderId,
      status: order.status,
      tracking_id: order.trackingId,
      total: order.total,
      refund_eligible: order.refundEligible,
      shipping_address: order.shippingAddress,
      customer_name: order.customer.name,
      placed_at: order.placedAt.toISOString(),
    };
  }

  const allOrders = await prisma.order.findMany({ select: { orderId: true } });
  const closeMatches: CloseMatch[] = allOrders
    .map((o) => ({ order_id: o.orderId, distance: levenshtein(orderId, o.orderId) }))
    .filter((m) => m.distance > 0 && m.distance <= CLOSE_MATCH_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance);

  return { found: false, reason: "NOT_FOUND", close_matches: closeMatches };
}
