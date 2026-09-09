import { z } from "zod";
import { prisma } from "../db.js";
import { isValidTrackingIdFormat } from "../lib/format.js";
import { levenshtein } from "../lib/levenshtein.js";

export const checkTrackingInput = z.object({
  tracking_id: z.string().min(1),
});

export type CheckTrackingInput = z.infer<typeof checkTrackingInput>;

interface TrackingCloseMatch {
  tracking_id: string;
  distance: number;
}

export type CheckTrackingResult =
  | { found: true; tracking_id: string; status: string; order_id: string }
  | { found: false; reason: "INVALID_FORMAT" }
  | { found: false; reason: "NOT_FOUND"; close_matches: TrackingCloseMatch[] };

const CLOSE_MATCH_MAX_DISTANCE = 2;

export async function checkTracking(input: CheckTrackingInput): Promise<CheckTrackingResult> {
  const trackingId = input.tracking_id.toUpperCase();

  if (!isValidTrackingIdFormat(trackingId)) {
    return { found: false, reason: "INVALID_FORMAT" };
  }

  const order = await prisma.order.findFirst({ where: { trackingId } });

  if (order) {
    return { found: true, tracking_id: trackingId, status: order.status, order_id: order.orderId };
  }

  const allOrders = await prisma.order.findMany({
    where: { trackingId: { not: null } },
    select: { trackingId: true },
  });
  const closeMatches: TrackingCloseMatch[] = allOrders
    .map((o) => ({ tracking_id: o.trackingId as string, distance: levenshtein(trackingId, o.trackingId as string) }))
    .filter((m) => m.distance > 0 && m.distance <= CLOSE_MATCH_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance);

  return { found: false, reason: "NOT_FOUND", close_matches: closeMatches };
}
