import { describe, it, expect } from "vitest";
import { requestRefund } from "../src/tools/requestRefund.js";

describe("requestRefund", () => {
  it("simulates a full refund for a fully-eligible order", async () => {
    const result = await requestRefund({ order_id: "BRK-71Q9", amount: 79.99 });
    expect(result).toMatchObject({ simulated: true, order_id: "BRK-71Q9", reason: "FULL" });
  });

  it("simulates a partial refund within the eligible half-amount", async () => {
    const result = await requestRefund({ order_id: "ZXA-4B8K", amount: 19.5 });
    expect(result).toMatchObject({ simulated: true, order_id: "ZXA-4B8K", reason: "PARTIAL" });
  });

  it("rejects a partial-eligible order when the requested amount exceeds the eligible half", async () => {
    const result = await requestRefund({ order_id: "ZXA-4B8K", amount: 39.0 });
    expect(result).toEqual({
      simulated: false,
      approved: false,
      order_id: "ZXA-4B8K",
      reason: "AMOUNT_EXCEEDS_ELIGIBLE",
    });
  });

  it("rejects a refund for an ineligible order", async () => {
    const result = await requestRefund({ order_id: "SMC-2201", amount: 149.0 });
    expect(result).toEqual({
      simulated: false,
      approved: false,
      order_id: "SMC-2201",
      reason: "INELIGIBLE",
    });
  });

  it("never commits a mutation — the refund is always marked simulated: true when approved", async () => {
    const result = await requestRefund({ order_id: "NV-15O2", amount: 29.99 });
    expect(result).toMatchObject({ simulated: true });
  });

  it("returns NOT_FOUND for a nonexistent order", async () => {
    const result = await requestRefund({ order_id: "BRK-7109", amount: 10 });
    expect(result).toEqual({ simulated: false, found: false, reason: "NOT_FOUND" });
  });
});
