import { z } from "zod";
import { prisma } from "../db.js";
import { isValidOrderIdFormat } from "../lib/format.js";
import { writeToolCallAudit } from "../lib/audit.js";

export const updateShippingAddressInput = z.object({
  order_id: z.string().min(1),
  address: z.string().min(5),
});

export type UpdateShippingAddressInput = z.infer<typeof updateShippingAddressInput>;

export type UpdateShippingAddressResult =
  | { simulated: true; order_id: string; previous_address: string; new_address: string }
  | { simulated: false; found: false; reason: "INVALID_FORMAT" | "NOT_FOUND" };

export async function updateShippingAddress(
  input: UpdateShippingAddressInput,
): Promise<UpdateShippingAddressResult> {
  const orderId = input.order_id.toUpperCase();

  if (!isValidOrderIdFormat(orderId)) {
    const result: UpdateShippingAddressResult = { simulated: false, found: false, reason: "INVALID_FORMAT" };
    await writeToolCallAudit("update_shipping_address", input, result, false);
    return result;
  }

  const order = await prisma.order.findUnique({ where: { orderId } });

  if (!order) {
    const result: UpdateShippingAddressResult = { simulated: false, found: false, reason: "NOT_FOUND" };
    await writeToolCallAudit("update_shipping_address", input, result, false);
    return result;
  }

  // Dry-run: compute the mutation but never commit it to the orders table (PRD.md §0).
  const result: UpdateShippingAddressResult = {
    simulated: true,
    order_id: orderId,
    previous_address: order.shippingAddress,
    new_address: input.address,
  };
  await writeToolCallAudit("update_shipping_address", input, result, true);
  return result;
}
