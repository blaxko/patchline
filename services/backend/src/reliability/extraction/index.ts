import { ulid } from "ulid";
import { extractRulePassEntities, type CriticalEntityType } from "schemas";
import { prisma } from "../../db.js";
import { writeAuditEvent } from "../../events.js";
import { extractLlmFallbackEntities, type GroqToolCallFn } from "./llmFallback.js";

export interface UtteranceForExtraction {
  id: string;
  sessionId: string;
  text: string;
  startMs: number;
  endMs: number;
}

// A turn is only considered for the (comparatively expensive) LLM fallback
// pass when the deterministic rule pass found nothing at all. PRD.md §5 also
// gates this on "the Support Agent's intent classifier expects one of these
// types" — that classifier does not exist yet at this build step (the
// Support Agent itself isn't built until Step 5), so this uses a simpler
// "non-trivial turn" heuristic in the meantime. Documented in TASKS.md.
const MIN_WORDS_FOR_LLM_FALLBACK = 3;

export interface DetectedEntity {
  id: string;
  entityType: CriticalEntityType;
  rawText: string;
  normalizedValue: string;
  source: "rule" | "llm_fallback";
}

export async function extractEntitiesForUtterance(
  utterance: UtteranceForExtraction,
  callGroq?: GroqToolCallFn,
): Promise<DetectedEntity[]> {
  const ruleCandidates = extractRulePassEntities(utterance.text);

  const shouldTryFallback =
    ruleCandidates.length === 0 && utterance.text.trim().split(/\s+/).length >= MIN_WORDS_FOR_LLM_FALLBACK;

  const llmCandidates = shouldTryFallback ? await extractLlmFallbackEntities(utterance.text, callGroq) : [];

  const allCandidates = [
    ...ruleCandidates.map((c) => ({ ...c, source: "rule" as const })),
    ...llmCandidates.map((c) => ({ ...c, source: "llm_fallback" as const })),
  ];

  const created: DetectedEntity[] = [];

  for (const candidate of allCandidates) {
    const entityId = ulid();

    await prisma.entity.create({
      data: {
        id: entityId,
        sessionId: utterance.sessionId,
        utteranceId: utterance.id,
        entityType: candidate.entityType,
        rawText: candidate.rawText,
        normalizedValue: candidate.normalizedValue,
        verificationState: "unverified",
        startMs: utterance.startMs,
        endMs: utterance.endMs,
      },
    });

    await writeAuditEvent({
      eventType: "entity.detected",
      actor: "system",
      resourceType: "entity",
      resourceId: entityId,
      payload: {
        entity_type: candidate.entityType,
        raw_text: candidate.rawText,
        normalized_value: candidate.normalizedValue,
        source: candidate.source,
      },
      correlationId: utterance.sessionId,
    });

    created.push({
      id: entityId,
      entityType: candidate.entityType,
      rawText: candidate.rawText,
      normalizedValue: candidate.normalizedValue,
      source: candidate.source,
    });
  }

  return created;
}

export type { CriticalEntityType };
