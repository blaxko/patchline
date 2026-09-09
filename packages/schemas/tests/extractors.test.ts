import { describe, it, expect } from "vitest";
import {
  extractOrderIds,
  extractTrackingIds,
  extractProductSkus,
  extractCouponCodes,
  extractEmails,
  extractPhoneNumbers,
  extractRulePassEntities,
} from "../src/extractors.js";

describe("extractOrderIds", () => {
  it("extracts a directly-formatted order id", () => {
    const result = extractOrderIds("I need the status of order BRK-71Q9 please");
    expect(result.some((c) => c.normalizedValue === "BRK-71Q9")).toBe(true);
  });

  it("extracts each of the PRD §4 confusable pairs when read directly", () => {
    for (const id of ["BRK-7109", "ZXA-4V8K", "NV-1502"]) {
      const result = extractOrderIds(`My order id is ${id}`);
      expect(result.some((c) => c.normalizedValue === id)).toBe(true);
    }
  });

  it("normalizes a spelled-out order id (PRD §0 demo scenario: 'seven one Q nine' repair context)", () => {
    // Full ID spelled letter-by-letter/digit-by-digit, as AssemblyAI would
    // transcribe a caller spelling it out.
    const result = extractOrderIds("bravo romeo kilo seven one Q nine");
    expect(result.some((c) => c.normalizedValue === "BRK-71Q9")).toBe(true);
  });

  it("normalizes a 2-letter-prefix spelled-out order id", () => {
    const result = extractOrderIds("november victor one five oscar two");
    expect(result.some((c) => c.normalizedValue === "NV-15O2")).toBe(true);
  });

  it("does not fabricate an order id from unrelated speech", () => {
    const result = extractOrderIds("hello there how are you doing today");
    expect(result.length).toBe(0);
  });

  it("does not treat a plain 6-7 letter name as an order id (regression: 'Siobhan'/'Mercer' false positive)", () => {
    const result = extractOrderIds("my name is Siobhan Mercer and I live at 4 Cedar Court");
    expect(result.length).toBe(0);
  });
});

describe("extractTrackingIds", () => {
  it("extracts a directly-formatted tracking id", () => {
    const result = extractTrackingIds("the tracking number is TRK-88213");
    expect(result.some((c) => c.normalizedValue === "TRK-88213")).toBe(true);
  });

  it("extracts a tracking id without the dash", () => {
    const result = extractTrackingIds("tracking TRK88213 confirmed");
    expect(result.some((c) => c.normalizedValue === "TRK-88213")).toBe(true);
  });
});

describe("extractProductSkus", () => {
  it("extracts a formatted SKU", () => {
    const result = extractProductSkus("the item is WBH-100");
    expect(result.some((c) => c.normalizedValue === "WBH-100")).toBe(true);
  });

  it("distinguishes the confusable trailing-character SKU pair", () => {
    const base = extractProductSkus("SKU WBH-100");
    const suffixed = extractProductSkus("SKU WBH-100X");
    expect(base[0]?.normalizedValue).toBe("WBH-100");
    expect(suffixed[0]?.normalizedValue).toBe("WBH-100X");
  });
});

describe("extractCouponCodes", () => {
  it("extracts an alphanumeric coupon code", () => {
    const result = extractCouponCodes("use code SAVE20NOW at checkout");
    expect(result.some((c) => c.normalizedValue === "SAVE20NOW")).toBe(true);
  });

  it("does not treat a plain word as a coupon code", () => {
    const result = extractCouponCodes("thanks so much for your help");
    expect(result.length).toBe(0);
  });
});

describe("extractEmails", () => {
  it("extracts a literally-formatted email", () => {
    const result = extractEmails("my email is siobhan.mercer@example.com");
    expect(result.some((c) => c.normalizedValue === "siobhan.mercer@example.com")).toBe(true);
  });

  it("extracts a spoken-out email ('at' / 'dot')", () => {
    const result = extractEmails("it's marcus dot ibe at example dot com");
    expect(result.some((c) => c.normalizedValue === "marcus.ibe@example.com")).toBe(true);
  });
});

describe("extractPhoneNumbers", () => {
  it("extracts a directly-formatted phone number", () => {
    const result = extractPhoneNumbers("you can reach me at +1-555-0101");
    expect(result.some((c) => c.normalizedValue === "15550101")).toBe(true);
  });

  it("extracts a spoken digit-word phone number", () => {
    const result = extractPhoneNumbers("five five five zero one zero one");
    expect(result.some((c) => c.normalizedValue === "5550101")).toBe(true);
  });
});

describe("extractRulePassEntities", () => {
  it("never marks anything beyond unverified — extraction has no verification_state field at all", () => {
    const result = extractRulePassEntities("order BRK-71Q9 tracking TRK-88213");
    expect(result.every((c) => c.source === "rule")).toBe(true);
    expect(result.every((c) => !("verification_state" in c))).toBe(true);
  });
});
