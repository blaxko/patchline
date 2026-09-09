import { describe, it, expect } from "vitest";
import { lookupOrder } from "../src/tools/lookupOrder.js";

describe("lookupOrder", () => {
  it("finds a seeded real order", async () => {
    const result = await lookupOrder({ order_id: "BRK-71Q9" });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.order_id).toBe("BRK-71Q9");
      expect(result.customer_name).toBe("Marcus Ibe");
    }
  });

  it("returns close matches for the BRK-7109 confusable (Q/1)", async () => {
    const result = await lookupOrder({ order_id: "BRK-7109" });
    expect(result.found).toBe(false);
    if (!result.found && result.reason === "NOT_FOUND") {
      expect(result.close_matches.some((m) => m.order_id === "BRK-71Q9")).toBe(true);
    } else {
      throw new Error("expected NOT_FOUND with close matches");
    }
  });

  it("returns close matches for the ZXA-4V8K confusable (B/V)", async () => {
    const result = await lookupOrder({ order_id: "ZXA-4V8K" });
    expect(result.found).toBe(false);
    if (!result.found && result.reason === "NOT_FOUND") {
      expect(result.close_matches.some((m) => m.order_id === "ZXA-4B8K")).toBe(true);
    } else {
      throw new Error("expected NOT_FOUND with close matches");
    }
  });

  it("returns close matches for the NV-1502 confusable (O/0)", async () => {
    const result = await lookupOrder({ order_id: "NV-1502" });
    expect(result.found).toBe(false);
    if (!result.found && result.reason === "NOT_FOUND") {
      expect(result.close_matches.some((m) => m.order_id === "NV-15O2")).toBe(true);
    } else {
      throw new Error("expected NOT_FOUND with close matches");
    }
  });

  it("rejects a malformed order id with INVALID_FORMAT, never a throw", async () => {
    const result = await lookupOrder({ order_id: "not-an-order-id!!" });
    expect(result).toEqual({ found: false, reason: "INVALID_FORMAT" });
  });

  it("returns NOT_FOUND with no close matches for a well-formed but unrelated id", async () => {
    const result = await lookupOrder({ order_id: "ZZZ-0000" });
    expect(result.found).toBe(false);
    if (!result.found && result.reason === "NOT_FOUND") {
      expect(result.close_matches.length).toBe(0);
    }
  });
});
