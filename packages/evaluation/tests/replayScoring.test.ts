import { describe, it, expect } from "vitest";
import { scoreReplay } from "../src/replayScoring.js";
import { computeTranscriptDelta } from "../src/transcriptDelta.js";

describe("scoreReplay", () => {
  it("passes on an exact match", () => {
    const result = scoreReplay({
      expectedValue: "BRK-71Q9",
      extractedValue: "BRK-71Q9",
      contextBefore: "order BRK-7109",
      replayedTranscript: "order BRK-71Q9",
      latencyMs: 400,
    });
    expect(result.exactMatch).toBe(true);
    expect(result.normalizedMatch).toBe(true);
    expect(result.status).toBe("pass");
  });

  it("passes on a normalized match (case/whitespace-insensitive) even if not byte-identical", () => {
    const result = scoreReplay({
      expectedValue: "BRK-71Q9",
      extractedValue: "brk 71q9",
      contextBefore: "order BRK-7109",
      replayedTranscript: "order brk 71q9",
      latencyMs: 400,
    });
    expect(result.exactMatch).toBe(false);
    expect(result.normalizedMatch).toBe(true);
    expect(result.status).toBe("pass");
  });

  it("fails when the extracted value doesn't match at all (baseline config on the confusable id)", () => {
    const result = scoreReplay({
      expectedValue: "BRK-71Q9",
      extractedValue: "BRK-7109",
      contextBefore: "order BRK-7109",
      replayedTranscript: "order BRK-7109",
      latencyMs: 400,
    });
    expect(result.status).toBe("fail");
  });

  it("fails when nothing was extracted at all", () => {
    const result = scoreReplay({
      expectedValue: "BRK-71Q9",
      extractedValue: null,
      contextBefore: "order BRK-7109",
      replayedTranscript: "",
      latencyMs: 0,
    });
    expect(result.status).toBe("fail");
  });
});

describe("computeTranscriptDelta", () => {
  it("reports no changes for identical transcripts", () => {
    const delta = computeTranscriptDelta("order BRK-71Q9 please", "order BRK-71Q9 please");
    expect(delta.every((d) => d.type === "equal")).toBe(true);
  });

  it("catches a collateral change to a nearby word", () => {
    const delta = computeTranscriptDelta("order BRK-7109 please", "order BRK-71Q9 thanks");
    expect(delta.some((d) => d.type === "removed" && d.word === "BRK-7109")).toBe(true);
    expect(delta.some((d) => d.type === "added" && d.word === "BRK-71Q9")).toBe(true);
    expect(delta.some((d) => d.type === "removed" && d.word === "please")).toBe(true);
    expect(delta.some((d) => d.type === "added" && d.word === "thanks")).toBe(true);
  });
});
