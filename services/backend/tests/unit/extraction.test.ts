import { describe, it, expect } from "vitest";
import { extractEntitiesForUtterance } from "../../src/reliability/extraction/index.js";
import { prisma } from "../../src/db.js";
import { ulid } from "ulid";

describe("extractEntitiesForUtterance", () => {
  it("writes entities with verification_state=unverified — extraction never verifies", async () => {
    const sessionId = ulid();
    const utteranceId = ulid();

    await prisma.session.create({
      data: {
        id: sessionId,
        status: "active",
        activeConfigId: (await prisma.config.findFirstOrThrow({ where: { status: "active" } })).id,
        callerLabel: "Test Caller",
        mode: "live_mic",
      },
    });
    await prisma.utterance.create({
      data: {
        id: utteranceId,
        sessionId,
        speaker: "caller",
        text: "my order id is BRK-71Q9",
        startMs: 0,
        endMs: 1000,
        turnOrder: 0,
        endOfTurnConfidence: 0.9,
      },
    });

    await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: "my order id is BRK-71Q9", startMs: 0, endMs: 1000 });

    const entities = await prisma.entity.findMany({ where: { utteranceId } });
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.every((e) => e.verificationState === "unverified")).toBe(true);
    expect(entities.some((e) => e.entityType === "order_id" && e.normalizedValue === "BRK-71Q9")).toBe(true);
  });

  it("skips the LLM fallback pass when GROQ_API_KEY is not configured (no crash, no candidates)", async () => {
    const sessionId = ulid();
    const utteranceId = ulid();
    await prisma.session.create({
      data: {
        id: sessionId,
        status: "active",
        activeConfigId: (await prisma.config.findFirstOrThrow({ where: { status: "active" } })).id,
        callerLabel: "Test Caller",
        mode: "live_mic",
      },
    });
    await prisma.utterance.create({
      data: {
        id: utteranceId,
        sessionId,
        speaker: "caller",
        text: "my name is Siobhan Mercer and I live at 4 Cedar Court",
        startMs: 0,
        endMs: 1000,
        turnOrder: 0,
        endOfTurnConfidence: 0.9,
      },
    });

    await expect(
      extractEntitiesForUtterance({
        id: utteranceId,
        sessionId,
        text: "my name is Siobhan Mercer and I live at 4 Cedar Court",
        startMs: 0,
        endMs: 1000,
      }),
    ).resolves.not.toThrow();
  });

  it("uses an injected Groq client for the LLM fallback pass when the rule pass finds nothing", async () => {
    const sessionId = ulid();
    const utteranceId = ulid();
    await prisma.session.create({
      data: {
        id: sessionId,
        status: "active",
        activeConfigId: (await prisma.config.findFirstOrThrow({ where: { status: "active" } })).id,
        callerLabel: "Test Caller",
        mode: "live_mic",
      },
    });
    const text = "my name is Siobhan Mercer";
    await prisma.utterance.create({
      data: {
        id: utteranceId,
        sessionId,
        speaker: "caller",
        text,
        startMs: 0,
        endMs: 1000,
        turnOrder: 0,
        endOfTurnConfidence: 0.9,
      },
    });

    const mockGroq = async () => [
      { entityType: "customer_name" as const, rawText: "Siobhan Mercer", normalizedValue: "Siobhan Mercer" },
    ];

    await extractEntitiesForUtterance({ id: utteranceId, sessionId, text, startMs: 0, endMs: 1000 }, mockGroq);

    const entities = await prisma.entity.findMany({ where: { utteranceId } });
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ entityType: "customer_name", normalizedValue: "Siobhan Mercer", verificationState: "unverified" });
  });
});
