import { describe, it, expect } from "vitest";
import { updateShippingAddress } from "../src/tools/updateShippingAddress.js";
import { prisma } from "../src/db.js";

describe("updateShippingAddress", () => {
  it("simulates the address change without committing it to the orders table", async () => {
    const before = await prisma.order.findUnique({ where: { orderId: "BRK-71Q9" } });
    const result = await updateShippingAddress({
      order_id: "BRK-71Q9",
      address: "999 New Address Ln, Springfield, IL 62701",
    });
    expect(result).toMatchObject({
      simulated: true,
      order_id: "BRK-71Q9",
      previous_address: before?.shippingAddress,
      new_address: "999 New Address Ln, Springfield, IL 62701",
    });

    const after = await prisma.order.findUnique({ where: { orderId: "BRK-71Q9" } });
    expect(after?.shippingAddress).toBe(before?.shippingAddress);
  });

  it("returns NOT_FOUND for a nonexistent order", async () => {
    const result = await updateShippingAddress({ order_id: "ZXA-4V8K", address: "1 Fake St, Nowhere" });
    expect(result).toEqual({ simulated: false, found: false, reason: "NOT_FOUND" });
  });

  it("rejects a malformed order id with INVALID_FORMAT", async () => {
    const result = await updateShippingAddress({ order_id: "bad", address: "1 Fake St, Nowhere" });
    expect(result).toEqual({ simulated: false, found: false, reason: "INVALID_FORMAT" });
  });
});
