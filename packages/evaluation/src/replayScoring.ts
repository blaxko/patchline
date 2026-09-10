import { computeTranscriptDelta, type DeltaEntry } from "./transcriptDelta.js";

export interface ReplayScoreInput {
  expectedValue: string;
  extractedValue: string | null;
  contextBefore: string;
  replayedTranscript: string;
  latencyMs: number;
}

export interface ReplayScore {
  exactMatch: boolean;
  normalizedMatch: boolean;
  transcriptDelta: DeltaEntry[];
  status: "pass" | "fail";
  latencyMs: number;
}

function normalize(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/**
 * Pure, DB-free replay scoring (PRD.md §9 Step 8) — deliberately has no
 * network/Prisma dependency so it's unit-testable on its own, per
 * ARCHITECTURE.md's packages/evaluation design goal.
 */
export function scoreReplay(input: ReplayScoreInput): ReplayScore {
  const exactMatch = input.extractedValue === input.expectedValue;
  const normalizedMatch = input.extractedValue !== null && normalize(input.extractedValue) === normalize(input.expectedValue);

  return {
    exactMatch,
    normalizedMatch,
    transcriptDelta: computeTranscriptDelta(input.contextBefore, input.replayedTranscript),
    status: normalizedMatch ? "pass" : "fail",
    latencyMs: input.latencyMs,
  };
}
