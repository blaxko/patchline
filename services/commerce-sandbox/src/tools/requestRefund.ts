import { z } from "zod";
import { prisma } from "../db.js";
import { isValidOrderIdFormat } from "../lib/format.js";
import { writeToolCallAudit } from "../lib/audit.js";

export const requestRefundInput = z.object({
  order_id: z.string().min(1),
  amount: z.number().positive(),
});

export type RequestRefundInput = z.infer<typeof requestRefundInput>;

export type RequestRefundResult =
  | {
      simulated: true;
      order_id: string;
      approved_amount: number;
      reason: "FULL" | "PARTIAL";
    }
  | { simulated: false; found: false; reason: "INVALID_FORMAT" | "NOT_FOUND" }
  | { simulated: false; approved: false; order_id: string; reason: "INELIGIBLE" | "AMOUNT_EXCEEDS_ELIGIBLE" };

export async function requestRefund(input: RequestRefundInput): Promise<RequestRefundResult> {
  const orderId = input.order_id.toUpperCase();

  if (!isValidOrderIdFormat(orderId)) {
    const result: RequestRefundResult = { simulated: false, found: false, reason: "INVALID_FORMAT" };
    await writeToolCallAudit("request_refund", input, result, false);
    return result;
  }

  const order = await prisma.order.findUnique({ where: { orderId } });

  if (!order) {
    const result: RequestRefundResult = { simulated: false, found: false, reason: "NOT_FOUND" };
    await writeToolCallAudit("request_refund", input, result, false);
    return result;
  }

  if (order.refundEligible === "ineligible") {
    const result: RequestRefundResult = {
      simulated: false,
      approved: false,
      order_id: orderId,
      reason: "INELIGIBLE",
    };
    await writeToolCallAudit("request_refund", input, result, false);
    return result;
  }

  const maxEligible = order.refundEligible === "partial" ? order.total / 2 : order.total;

  if (input.amount > maxEligible + 0.01) {
    const result: RequestRefundResult = {
      simulated: false,
      approved: false,
      order_id: orderId,
      reason: "AMOUNT_EXCEEDS_ELIGIBLE",
    };
    await writeToolCallAudit("request_refund", input, result, false);
    return result;
  }

  const result: RequestRefundResult = {
    simulated: true,
    order_id: orderId,
    approved_amount: input.amount,
    reason: order.refundEligible === "partial" ? "PARTIAL" : "FULL",
  };
  await writeToolCallAudit("request_refund", input, result, true);
  return result;
}
