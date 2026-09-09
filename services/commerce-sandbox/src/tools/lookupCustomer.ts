import { z } from "zod";
import { prisma } from "../db.js";

export const lookupCustomerInput = z
  .object({
    name: z.string().min(1).optional(),
    email_or_phone: z.string().min(1).optional(),
  })
  .refine((v) => v.name || v.email_or_phone, {
    message: "name or email_or_phone required",
  });

export type LookupCustomerInput = z.infer<typeof lookupCustomerInput>;

export type LookupCustomerResult =
  | {
      found: true;
      customer_id: string;
      name: string;
      email: string;
      phone: string;
      order_ids: string[];
    }
  | { found: false; reason: "NOT_FOUND" };

export async function lookupCustomer(input: LookupCustomerInput): Promise<LookupCustomerResult> {
  const orConditions = [];
  if (input.name) {
    orConditions.push({ name: { equals: input.name } });
  }
  if (input.email_or_phone) {
    orConditions.push({ email: { equals: input.email_or_phone } });
    orConditions.push({ phone: { equals: input.email_or_phone } });
  }

  const customer = await prisma.customer.findFirst({
    where: { OR: orConditions },
    include: { orders: true },
  });

  if (!customer) {
    return { found: false, reason: "NOT_FOUND" };
  }

  return {
    found: true,
    customer_id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    order_ids: customer.orders.map((o) => o.orderId),
  };
}
