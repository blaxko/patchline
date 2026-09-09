import { describe, it, expect } from "vitest";
import { createSupportCase } from "../src/tools/createSupportCase.js";
import { escalateToHuman } from "../src/tools/escalateToHuman.js";

describe("createSupportCase", () => {
  it("creates an open case with a generated id", async () => {
    const result = await createSupportCase({ order_id: "BRK-71Q9", summary: "Caller reports delay" });
    expect(result.status).toBe("open");
    expect(result.order_id).toBe("BRK-71Q9");
    expect(result.case_id).toBeTruthy();
  });
});

describe("escalateToHuman", () => {
  it("always succeeds and returns an escalation id", async () => {
    const result = await escalateToHuman({ reason: "repair budget exhausted" });
    expect(result.status).toBe("escalated");
    expect(result.escalation_id).toBeTruthy();
  });
});
