import { describe, it, expect, beforeAll } from "vitest";
import { ulid } from "ulid";
import { prisma } from "../../src/db.js";
import { evaluateToolCall } from "../../src/reliability/gate/index.js";

async function makeSession(): Promise<string> {
  const sessionId = ulid();
  const config = await prisma.config.findFirstOrThrow({ where: { status: "active" } });
  await prisma.session.create({
    data: { id: sessionId, status: "active", activeConfigId: config.id, callerLabel: "Test Caller", mode: "live_mic" },
  });
  return sessionId;
}

async function seedEntity(sessionId: string, entityType: string, normalizedValue: string) {
  const utteranceId = ulid();
  await prisma.utterance.create({
    data: {
      id: utteranceId,
      sessionId,
      speaker: "caller",
      text: normalizedValue,
      startMs: 0,
      endMs: 1000,
      turnOrder: 0,
      endOfTurnConfidence: 0.9,
    },
  });
  const entityId = ulid();
  await prisma.entity.create({
    data: {
      id: entityId,
      sessionId,
      utteranceId,
      entityType,
      rawText: normalizedValue,
      normalizedValue,
      verificationState: "unverified",
      startMs: 0,
      endMs: 1000,
    },
  });
  return entityId;
}

describe("Action Gate — evaluateToolCall", () => {
  describe("lookup_order", () => {
    it("allows a verified real order id", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-71Q9");
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_order", proposedArgs: { order_id: "BRK-71Q9" } });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.finalArgs).toEqual({ order_id: "BRK-71Q9" });
    });

    it("blocks with ENTITY_AMBIGUOUS for a confusable id with close matches", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-7109");
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_order", proposedArgs: { order_id: "BRK-7109" } });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ENTITY_AMBIGUOUS");
    });

    it("blocks with ENTITY_NOT_FOUND for an id with no close matches", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "ZZZ-0000");
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_order", proposedArgs: { order_id: "ZZZ-0000" } });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ENTITY_NOT_FOUND");
    });

    it("blocks with LOW_EVIDENCE when no order_id entity was ever extracted", async () => {
      const sessionId = await makeSession();
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_order", proposedArgs: { order_id: "BRK-71Q9" } });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("LOW_EVIDENCE");
    });

    it("never executes the tool for a blocked call — final_args is null on the stored row", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-7109");
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_order", proposedArgs: { order_id: "BRK-7109" } });
      const row = await prisma.toolCall.findUniqueOrThrow({ where: { id: result.toolCallId } });
      expect(row.gateResult).toBe("blocked");
      expect(row.finalArgs).toBeNull();
    });
  });

  describe("check_tracking", () => {
    it("allows a real tracking id", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "tracking_id", "TRK-88213");
      const result = await evaluateToolCall({ sessionId, toolName: "check_tracking", proposedArgs: { tracking_id: "TRK-88213" } });
      expect(result.allowed).toBe(true);
    });

    it("blocks a near-miss tracking id with ENTITY_AMBIGUOUS", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "tracking_id", "TRK-88214");
      const result = await evaluateToolCall({ sessionId, toolName: "check_tracking", proposedArgs: { tracking_id: "TRK-88214" } });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ENTITY_AMBIGUOUS");
    });
  });

  describe("lookup_product", () => {
    it("allows a real sku", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "product_sku", "WBH-100");
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_product", proposedArgs: { sku: "WBH-100" } });
      expect(result.allowed).toBe(true);
    });

    it("blocks an unknown sku with no close match as ENTITY_NOT_FOUND", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "product_sku", "ZZZ-999");
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_product", proposedArgs: { sku: "ZZZ-999" } });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ENTITY_NOT_FOUND");
    });
  });

  describe("lookup_customer", () => {
    it("allows a verified customer by email", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "email", "marcus.ibe@example.com");
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_customer", proposedArgs: {} });
      expect(result.allowed).toBe(true);
    });

    it("blocks LOW_EVIDENCE when no identity entity exists", async () => {
      const sessionId = await makeSession();
      const result = await evaluateToolCall({ sessionId, toolName: "lookup_customer", proposedArgs: {} });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("LOW_EVIDENCE");
    });
  });

  describe("create_support_case", () => {
    it("allows an ambiguous order id (low-risk per PRD.md §0)", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-7109");
      const result = await evaluateToolCall({ sessionId, toolName: "create_support_case", proposedArgs: { order_id: "BRK-7109", summary: "test" } });
      expect(result.allowed).toBe(true);
    });

    it("blocks ENTITY_NOT_FOUND for a completely unrelated order id", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "ZZZ-0000");
      const result = await evaluateToolCall({ sessionId, toolName: "create_support_case", proposedArgs: { order_id: "ZZZ-0000", summary: "test" } });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ENTITY_NOT_FOUND");
    });
  });

  describe("escalate_to_human", () => {
    it("is always allowed, no critical evidence required", async () => {
      const sessionId = await makeSession();
      const result = await evaluateToolCall({ sessionId, toolName: "escalate_to_human", proposedArgs: { reason: "test" } });
      expect(result.allowed).toBe(true);
    });
  });

  describe("request_refund", () => {
    it("allows a full flow: verified order + matching identity + matching amount", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-71Q9");
      await seedEntity(sessionId, "customer_name", "Marcus Ibe");
      await seedEntity(sessionId, "refund_amount", "79.99");
      const result = await evaluateToolCall({
        sessionId,
        toolName: "request_refund",
        proposedArgs: { order_id: "BRK-71Q9", amount: 79.99 },
      });
      expect(result.allowed).toBe(true);
      expect(result.finalArgs).toEqual({ order_id: "BRK-71Q9", amount: 79.99 });
    });

    it("blocks POLICY_DENIED when identity doesn't match the order's customer", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-71Q9");
      await seedEntity(sessionId, "customer_name", "Someone Else");
      await seedEntity(sessionId, "refund_amount", "79.99");
      const result = await evaluateToolCall({
        sessionId,
        toolName: "request_refund",
        proposedArgs: { order_id: "BRK-71Q9", amount: 79.99 },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("POLICY_DENIED");
    });

    it("blocks MISSING_CONFIRMATION when the stated amount doesn't match the order total", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-71Q9");
      await seedEntity(sessionId, "customer_name", "Marcus Ibe");
      await seedEntity(sessionId, "refund_amount", "999.00");
      const result = await evaluateToolCall({
        sessionId,
        toolName: "request_refund",
        proposedArgs: { order_id: "BRK-71Q9", amount: 999.0 },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("MISSING_CONFIRMATION");
    });

    it("stores simulated:true and never mutates real data even when allowed", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-71Q9");
      await seedEntity(sessionId, "customer_name", "Marcus Ibe");
      await seedEntity(sessionId, "refund_amount", "79.99");
      const result = await evaluateToolCall({
        sessionId,
        toolName: "request_refund",
        proposedArgs: { order_id: "BRK-71Q9", amount: 79.99 },
      });
      const row = await prisma.toolCall.findUniqueOrThrow({ where: { id: result.toolCallId } });
      expect(row.simulated).toBe(true);
    });
  });

  describe("update_shipping_address", () => {
    it("blocks MISSING_CONFIRMATION — no repair mechanism exists yet to reach confirmed_by_caller", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-71Q9");
      await seedEntity(sessionId, "shipping_address", "1 New St, Springfield, IL");
      const result = await evaluateToolCall({
        sessionId,
        toolName: "update_shipping_address",
        proposedArgs: { order_id: "BRK-71Q9", address: "1 New St, Springfield, IL" },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("MISSING_CONFIRMATION");
    });

    it("blocks LOW_EVIDENCE when no address was ever stated", async () => {
      const sessionId = await makeSession();
      await seedEntity(sessionId, "order_id", "BRK-71Q9");
      const result = await evaluateToolCall({
        sessionId,
        toolName: "update_shipping_address",
        proposedArgs: { order_id: "BRK-71Q9", address: "1 New St" },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("LOW_EVIDENCE");
    });
  });
});
