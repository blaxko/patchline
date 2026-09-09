import { describe, it, expect } from "vitest";
import { lookupProduct } from "../src/tools/lookupProduct.js";

describe("lookupProduct", () => {
  it("finds a seeded SKU", async () => {
    const result = await lookupProduct({ sku: "WBH-100" });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.name).toBe("Wireless Bluetooth Headphones");
    }
  });

  it("distinguishes the confusable trailing-character SKU pair (WBH-100 vs WBH-100X)", async () => {
    const base = await lookupProduct({ sku: "WBH-100" });
    const suffixed = await lookupProduct({ sku: "WBH-100X" });
    expect(base.found).toBe(true);
    expect(suffixed.found).toBe(true);
    if (base.found && suffixed.found) {
      expect(base.name).not.toBe(suffixed.name);
    }
  });

  it("returns NOT_FOUND with close matches for an unseeded near-miss SKU", async () => {
    const result = await lookupProduct({ sku: "WBH-101" });
    expect(result.found).toBe(false);
    if (!result.found && result.reason === "NOT_FOUND") {
      expect(result.close_matches.length).toBeGreaterThan(0);
    }
  });
});
