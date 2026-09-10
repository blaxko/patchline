import { describe, it, expect, vi } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ulid } from "ulid";
import { prisma } from "../../src/db.js";
import { startRepair, handleRepairTurn } from "../../src/reliability/repair/index.js";
import { audioBufferStore } from "../../src/realtime/audioBuffer.js";
import { msToByteOffset } from "../../src/reliability/regression/wav.js";

async function makeSession(): Promise<string> {
  const sessionId = ulid();
  const config = await prisma.config.findFirstOrThrow({ where: { status: "active" } });
  await prisma.session.create({
    data: { id: sessionId, status: "active", activeConfigId: config.id, callerLabel: "Test Caller", mode: "live_mic" },
  });
  return sessionId;
}

async function seedEntity(sessionId: string, entityType: string, normalizedValue: string, startMs: number, endMs: number) {
  const utteranceId = ulid();
  await prisma.utterance.create({
    data: {
      id: utteranceId,
      sessionId,
      speaker: "caller",
      text: `order ${normalizedValue}`,
      startMs,
      endMs,
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
      startMs,
      endMs,
    },
  });
  return entityId;
}

function fakeSocket() {
  return { readyState: 1, OPEN: 1, send: vi.fn() } as unknown as import("ws").WebSocket;
}

describe("Regression Engine — creation from a resolved repair (PRD.md §9 Step 7)", () => {
  it("creates a playable audio clip with correct range and truth_source", async () => {
    const sessionId = await makeSession();
    const entityId = await seedEntity(sessionId, "order_id", "BRK-7109", 2000, 2900);

    const paddedStart = msToByteOffset(500); // 2000 - 1500
    const paddedEnd = msToByteOffset(4400); // 2900 + 1500
    audioBufferStore.push(sessionId, Buffer.alloc(paddedEnd + 1000, 7));

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

    const executeTool = vi.fn(async () => ({ found: true }));
    await handleRepairTurn(sessionId, "seven one Q nine", ws, executeTool);

    const regression = await prisma.regression.findFirstOrThrow({ where: { entityId } });
    expect(regression.expectedValue).toBe("BRK-71Q9");
    expect(regression.observedValue).toBe("BRK-7109");
    expect(regression.audioStartMs).toBe(500);
    expect(regression.audioEndMs).toBe(4400);
    expect(regression.repairMethod).toBe("caller_confirmation");
    expect(regression.status).toBe("open");

    expect(existsSync(regression.audioAsset)).toBe(true);
    const fileBytes = await readFile(regression.audioAsset);
    expect(fileBytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(fileBytes.length).toBe(44 + (paddedEnd - paddedStart));

    await rm(regression.audioAsset);
    audioBufferStore.clear(sessionId);
    // Other test files (e.g. promotion.test.ts) scan every regression row in
    // the shared test DB — clean up so this one doesn't contaminate them.
    await prisma.regression.delete({ where: { id: regression.id } });
  });

  it("fails closed (no regression row) when the audio segment was already evicted from the buffer", async () => {
    const sessionId = await makeSession();
    const entityId = await seedEntity(sessionId, "order_id", "BRK-7109", 2000, 2900);

    // No audio pushed at all — simulates a buffer that no longer covers the range.
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

    const executeTool = vi.fn(async () => ({ found: true }));
    const result = await handleRepairTurn(sessionId, "seven one Q nine", ws, executeTool);

    // The repair itself still completes and the tool call still proceeds —
    // missing audio only blocks regression *capture*, never the live call.
    expect(result.toolResult?.allowed).toBe(true);

    const regression = await prisma.regression.findFirst({ where: { entityId } });
    expect(regression).toBeNull();
  });
});
