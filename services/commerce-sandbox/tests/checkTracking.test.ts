import { describe, it, expect } from "vitest";
import { checkTracking } from "../src/tools/checkTracking.js";

describe("checkTracking", () => {
  it("finds a seeded tracking id", async () => {
    const result = await checkTracking({ tracking_id: "TRK-88213" });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.order_id).toBe("BRK-71Q9");
      expect(result.status).toBe("delayed");
    }
  });

  it("rejects a malformed tracking id with INVALID_FORMAT", async () => {
    const result = await checkTracking({ tracking_id: "bogus" });
    expect(result).toEqual({ found: false, reason: "INVALID_FORMAT" });
  });

  it("returns NOT_FOUND with close matches for a near-miss tracking id", async () => {
    const result = await checkTracking({ tracking_id: "TRK-88214" });
    expect(result.found).toBe(false);
    if (!result.found && result.reason === "NOT_FOUND") {
      expect(result.close_matches.some((m) => m.tracking_id === "TRK-88213")).toBe(true);
    }
  });
});
