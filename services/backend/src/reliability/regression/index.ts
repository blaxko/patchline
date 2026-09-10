import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { writeAuditEvent } from "../../events.js";
import { audioBufferStore } from "../../realtime/audioBuffer.js";
import { msToByteOffset, pcm16ToWav } from "./wav.js";

const CONTEXT_PAD_MS = 1500;

export class AudioSegmentMissingError extends Error {
  constructor(sessionId: string) {
    super(`AUDIO_SEGMENT_MISSING: rolling buffer for session ${sessionId} no longer covers the requested range`);
  }
}

export interface RegressionSource {
  sessionId: string;
  entityId: string;
  entityType: string;
  utteranceText: string;
  expectedValue: string;
  observedValue: string;
  entityStartMs: number;
  entityEndMs: number;
  repairMethod: "caller_confirmation" | "deterministic_validation" | "human_review";
}

/**
 * Creates a regression case from a recovered failure (PRD.md §9 Step 7).
 * Fails closed (no row written) if the audio segment is no longer available
 * in the rolling buffer, per the step's own error-case spec — a regression
 * must never exist without its backing audio.
 */
export async function createRegressionFromRepair(source: RegressionSource): Promise<string> {
  const session = await prisma.session.findUniqueOrThrow({ where: { id: source.sessionId } });

  const paddedStartMs = Math.max(0, source.entityStartMs - CONTEXT_PAD_MS);
  const paddedEndMs = source.entityEndMs + CONTEXT_PAD_MS;

  const startByte = msToByteOffset(paddedStartMs);
  const endByte = msToByteOffset(paddedEndMs);

  const fullBuffer = audioBufferStore.getAll(source.sessionId);
  if (fullBuffer.length < endByte) {
    throw new AudioSegmentMissingError(source.sessionId);
  }

  const pcmSlice = fullBuffer.subarray(startByte, endByte);
  const wav = pcm16ToWav(pcmSlice);

  const regressionId = ulid();
  await mkdir(env.AUDIO_STORAGE_DIR, { recursive: true });
  const audioPath = join(env.AUDIO_STORAGE_DIR, `${regressionId}.wav`);
  await writeFile(audioPath, wav);

  await prisma.regression.create({
    data: {
      id: regressionId,
      sourceSessionId: source.sessionId,
      entityId: source.entityId,
      entityType: source.entityType,
      expectedValue: source.expectedValue,
      observedValue: source.observedValue,
      audioAsset: audioPath,
      audioStartMs: paddedStartMs,
      audioEndMs: paddedEndMs,
      contextBefore: source.utteranceText,
      contextAfter: "",
      baselineConfigId: session.activeConfigId,
      repairMethod: source.repairMethod,
      status: "open",
    },
  });

  await writeAuditEvent({
    eventType: "regression.created",
    actor: "system",
    resourceType: "regression",
    resourceId: regressionId,
    payload: {
      entity_type: source.entityType,
      expected_value: source.expectedValue,
      observed_value: source.observedValue,
      repair_method: source.repairMethod,
    },
    correlationId: regressionId,
  });

  return regressionId;
}
