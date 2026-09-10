import { describe, it, expect, vi } from "vitest";
import { ulid } from "ulid";
import { prisma } from "../../src/db.js";
import { evaluateToolCall } from "../../src/reliability/gate/index.js";
import { startRepair, handleRepairTurn, hasPendingRepair } from "../../src/reliability/repair/index.js";

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

function fakeSocket() {
  return { readyState: 1, OPEN: 1, send: vi.fn() } as unknown as import("ws").WebSocket;
}

describe("Repair Engine — full round trip (PRD.md §0 demo scenario)", () => {
  it("blocked order id -> repair question -> caller confirms -> entity verified -> gate now allows", async () => {
    const sessionId = await makeSession();
    const entityId = await seedEntity(sessionId, "order_id", "BRK-7109");

    const gateResult = await evaluateToolCall({ sessionId, toolName: "lookup_order", proposedArgs: { order_id: "BRK-7109" } });
    expect(gateResult.allowed).toBe(false);
    expect(gateResult.reason).toBe("ENTITY_AMBIGUOUS");

    const ws = fakeSocket();
    await startRepair({
      sessionId,
      entityId,
      entityType: "order_id",
      gateReason: "ENTITY_AMBIGUOUS",
      observedValue: "BRK-7109",
      toolName: "lookup_order",
      proposedArgs: { order_id: "BRK-7109" },
      browserWs: ws,
    });

    expect(hasPendingRepair(sessionId)).toBe(true);
    const questionMsg = JSON.parse((ws.send as any).mock.calls[0][0]);
    expect(questionMsg.type).toBe("repair_question");
    expect(questionMsg.text).toContain("B-R-K-7-1-0-9");

    const executeTool = vi.fn(async () => ({ found: true, order_id: "BRK-71Q9" }));
    const result = await handleRepairTurn(sessionId, "seven one Q nine", ws, executeTool);

    expect(result.handled).toBe(true);
    expect(hasPendingRepair(sessionId)).toBe(false);
    expect(result.toolResult?.allowed).toBe(true);
    expect(executeTool).toHaveBeenCalledWith("lookup_order", { order_id: "BRK-71Q9" });

    const entity = await prisma.entity.findUniqueOrThrow({ where: { id: entityId } });
    expect(entity.verificationState).toBe("verified");
    expect(entity.verifiedValue).toBe("BRK-71Q9");

    const repairEvent = await prisma.repairEvent.findFirstOrThrow({ where: { entityId } });
    expect(repairEvent.outcome).toBe("resolved");
    expect(repairEvent.resolvedValue).toBe("BRK-71Q9");
  });

  it("escalates after the repair budget (2 attempts) is exhausted with unparseable responses", async () => {
    const sessionId = await makeSession();
    const entityId = await seedEntity(sessionId, "order_id", "BRK-7109");
    const ws = fakeSocket();

    await startRepair({
      sessionId,
      entityId,
      entityType: "order_id",
      gateReason: "ENTITY_AMBIGUOUS",
      observedValue: "BRK-7109",
      toolName: "lookup_order",
      proposedArgs: { order_id: "BRK-7109" },
      browserWs: ws,
    });

    const executeTool = vi.fn(async () => null);

    const first = await handleRepairTurn(sessionId, "sorry what did you ask", ws, executeTool);
    expect(first.handled).toBe(true);
    expect(hasPendingRepair(sessionId)).toBe(true); // attempt 2 still pending

    const second = await handleRepairTurn(sessionId, "I don't understand", ws, executeTool);
    expect(second.handled).toBe(true);
    expect(hasPendingRepair(sessionId)).toBe(false);

    const events = await prisma.repairEvent.findMany({ where: { entityId }, orderBy: { attemptNumber: "asc" } });
    expect(events.map((e) => e.outcome)).toEqual(["unresolved", "escalated"]);

    const escalation = await prisma.toolCall.findFirst({ where: { sessionId, toolName: "escalate_to_human" } });
    expect(escalation?.gateResult).toBe("allowed");
  });
});
