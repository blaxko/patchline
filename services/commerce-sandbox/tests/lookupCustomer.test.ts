import { describe, it, expect } from "vitest";
import { lookupCustomer } from "../src/tools/lookupCustomer.js";

describe("lookupCustomer", () => {
  it("finds a customer by name, including the uncommon spelling", async () => {
    const result = await lookupCustomer({ name: "Siobhan Mercer" });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.order_ids).toContain("ZXA-4B8K");
    }
  });

  it("finds a customer by email", async () => {
    const result = await lookupCustomer({ email_or_phone: "marcus.ibe@example.com" });
    expect(result.found).toBe(true);
  });

  it("finds a customer by phone", async () => {
    const result = await lookupCustomer({ email_or_phone: "+1-555-0103" });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.name).toBe("Dana Whitfield");
    }
  });

  it("does not match a misstated digit in the email (renata's real email has a digit 1, not letter l)", async () => {
    const result = await lookupCustomer({ email_or_phone: "renata.kowalski@example.com" });
    expect(result.found).toBe(false);
  });

  it("returns NOT_FOUND for an unknown identifier", async () => {
    const result = await lookupCustomer({ email_or_phone: "nobody@nowhere.com" });
    expect(result).toEqual({ found: false, reason: "NOT_FOUND" });
  });
});
