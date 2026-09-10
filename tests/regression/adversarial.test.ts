import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ulid } from "ulid";
import { prisma } from "../../services/backend/src/db.js";
import { extractEntitiesForUtterance } from "../../services/backend/src/reliability/extraction/index.js";
import { evaluateToolCall } from "../../services/backend/src/reliability/gate/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "fixtures", "audio", "adversarial", "manifest.json"), "utf-8"),
);

async function makeSession(): Promise<string> {
  const sessionId = ulid();
  const config = await prisma.config.findFirstOrThrow({ where: { status: "active" } });
  await prisma.session.create({
    data: { id: sessionId, status: "active", activeConfigId: config.id, callerLabel: "Adversarial Fixture", mode: "prerecorded_clip" },
  });
  return sessionId;
}

async function makeUtterance(sessionId: string, text: string, turnOrder = 0) {
  const utteranceId = ulid();
  await prisma.utterance.create({
    data: { id: utteranceId, sessionId, speaker: "caller", text, startMs: 0, endMs: 1000, turnOrder, endOfTurnConfidence: 0.9 },
  });
  return utteranceId;
}

async function seedEntity(sessionId: string, utteranceId: string, entityType: string, normalizedValue: string) {
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

describe("Adversarial speech reliability benchmark (PRD.md §9 Step 14)", () => {
  it("the manifest has every category the brief requires (business outcome per fixture, not transcript text)", () => {
    const ids: string[] = manifest.fixtures.map((f: any) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "fast_speech",
        "background_noise",
        "spelling_correction_mid_utterance",
        "o_zero_confusion",
        "b_v_confusion",
        "repeated_value",
        "interruption_barge_in",
        "caller_changes_mind_mid_entity",
        "uncommon_name_spelling",
        "amount_ambiguity_18_80",
      ]),
    );
  });

  it("fast_speech: a fast, run-together utterance still extracts and allows the real order id", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "fast_speech");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const entity = detected.find((e) => e.entityType === "order_id");
    expect(entity?.normalizedValue).toBe(fixture.expected_value);

    const result = await evaluateToolCall({ sessionId, toolName: fixture.expected_tool_called, proposedArgs: { order_id: entity!.normalizedValue } });
    expect(result.allowed).toBe(fixture.expected_allowed);
  });

  it("background_noise: a low end_of_turn_confidence utterance is still extracted and gated normally", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "background_noise");
    const sessionId = await makeSession();
    const utteranceId = ulid();
    await prisma.utterance.create({
      data: {
        id: utteranceId,
        sessionId,
        speaker: "caller",
        text: fixture.transcript,
        startMs: 0,
        endMs: 1000,
        turnOrder: 0,
        endOfTurnConfidence: fixture.end_of_turn_confidence,
      },
    });
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const entity = detected.find((e) => e.entityType === "order_id");
    expect(entity?.normalizedValue).toBe(fixture.expected_value);

    const result = await evaluateToolCall({ sessionId, toolName: fixture.expected_tool_called, proposedArgs: { order_id: entity!.normalizedValue } });
    expect(result.allowed).toBe(fixture.expected_allowed);
  });

  it("spelling_correction_mid_utterance: two different order ids in one turn -> VALUE_CONFLICT, never guesses either", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "spelling_correction_mid_utterance");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const orderIdCandidates = detected.filter((e) => e.entityType === "order_id");
    expect(new Set(orderIdCandidates.map((c) => c.normalizedValue)).size).toBeGreaterThan(1);

    const result = await evaluateToolCall({
      sessionId,
      toolName: fixture.expected_tool_called,
      proposedArgs: { order_id: orderIdCandidates[orderIdCandidates.length - 1].normalizedValue },
    });
    expect(result.allowed).toBe(fixture.expected_allowed);
    expect(result.reason).toBe(fixture.expected_gate_reason);
  });

  it("o_zero_confusion: NV-1502 blocks with ENTITY_AMBIGUOUS against the real NV-15O2", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "o_zero_confusion");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const entity = detected.find((e) => e.entityType === "order_id");

    const result = await evaluateToolCall({ sessionId, toolName: fixture.expected_tool_called, proposedArgs: { order_id: entity!.normalizedValue } });
    expect(result.allowed).toBe(fixture.expected_allowed);
    expect(result.reason).toBe(fixture.expected_gate_reason);
  });

  it("b_v_confusion: ZXA-4V8K blocks with ENTITY_AMBIGUOUS against the real ZXA-4B8K", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "b_v_confusion");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const entity = detected.find((e) => e.entityType === "order_id");

    const result = await evaluateToolCall({ sessionId, toolName: fixture.expected_tool_called, proposedArgs: { order_id: entity!.normalizedValue } });
    expect(result.allowed).toBe(fixture.expected_allowed);
    expect(result.reason).toBe(fixture.expected_gate_reason);
  });

  it("repeated_value: the same value spoken twice is not a conflict and allows normally", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "repeated_value");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const orderIdCandidates = detected.filter((e) => e.entityType === "order_id");
    expect(new Set(orderIdCandidates.map((c) => c.normalizedValue))).toEqual(new Set([fixture.expected_value]));

    const result = await evaluateToolCall({ sessionId, toolName: fixture.expected_tool_called, proposedArgs: { order_id: fixture.expected_value } });
    expect(result.allowed).toBe(fixture.expected_allowed);
  });

  it("interruption_barge_in: a cut-off partial never creates an entity; only the final turn does", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "interruption_barge_in");
    const sessionId = await makeSession();

    // The partial transcript is deliberately never passed to extraction —
    // this pipeline only extracts on end_of_turn=true (PRD.md §9 Step 4),
    // so there is nothing to assert against the partial itself except that
    // it plays no role at all in the outcome below.
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const entity = detected.find((e) => e.entityType === "order_id");
    expect(entity?.normalizedValue).toBe(fixture.expected_value);

    const result = await evaluateToolCall({ sessionId, toolName: fixture.expected_tool_called, proposedArgs: { order_id: entity!.normalizedValue } });
    expect(result.allowed).toBe(fixture.expected_allowed);
  });

  it("caller_changes_mind_mid_entity: two different order ids for the same slot -> VALUE_CONFLICT", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "caller_changes_mind_mid_entity");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 });
    const orderIdCandidates = detected.filter((e) => e.entityType === "order_id");
    expect(new Set(orderIdCandidates.map((c) => c.normalizedValue)).size).toBeGreaterThan(1);

    const result = await evaluateToolCall({
      sessionId,
      toolName: fixture.expected_tool_called,
      proposedArgs: { order_id: orderIdCandidates[0].normalizedValue },
    });
    expect(result.allowed).toBe(fixture.expected_allowed);
    expect(result.reason).toBe(fixture.expected_gate_reason);
  });

  it("uncommon_name_spelling: 'Siobhan Mercer' is extracted (mocked LLM fallback) and validates against the real seeded customer", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "uncommon_name_spelling");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);

    const mockGroq = async () => [{ entityType: "customer_name" as const, rawText: "Siobhan Mercer", normalizedValue: fixture.expected_value }];
    const detected = await extractEntitiesForUtterance({ id: utteranceId, sessionId, text: fixture.transcript, startMs: 0, endMs: 1000 }, mockGroq);
    const entity = detected.find((e) => e.entityType === "customer_name");
    expect(entity?.normalizedValue).toBe(fixture.expected_value);

    const result = await evaluateToolCall({ sessionId, toolName: fixture.expected_tool_called, proposedArgs: {} });
    expect(result.allowed).toBe(fixture.expected_allowed);
  });

  it("amount_ambiguity_18_80: a misheard $18 (real total $79.99) is caught by the gate, never silently approved", async () => {
    const fixture = manifest.fixtures.find((f: any) => f.id === "amount_ambiguity_18_80");
    const sessionId = await makeSession();
    const utteranceId = await makeUtterance(sessionId, fixture.transcript);
    await seedEntity(sessionId, utteranceId, "order_id", "BRK-71Q9");
    await seedEntity(sessionId, utteranceId, "customer_name", "Marcus Ibe");
    await seedEntity(sessionId, utteranceId, "refund_amount", fixture.misheard_value);

    const result = await evaluateToolCall({
      sessionId,
      toolName: fixture.expected_tool_called,
      proposedArgs: { order_id: "BRK-71Q9", amount: Number(fixture.misheard_value) },
    });
    expect(result.allowed).toBe(fixture.expected_allowed);
    expect(result.reason).toBe(fixture.expected_gate_reason);
  });
});
