import { readFile } from "node:fs/promises";
import { ulid } from "ulid";
import { scoreReplay } from "evaluation";
import { extractRulePassEntities } from "schemas";
import { prisma } from "../../db.js";
import { writeAuditEvent } from "../../events.js";
import { getConfigById } from "../../realtime/configMapping.js";
import { AssemblyAIAdapter, type AaiTurnMessage } from "../../realtime/assemblyaiAdapter.js";
import { BYTES_PER_SAMPLE, SAMPLE_RATE } from "../regression/wav.js";

const CHUNK_MS = 100;
const CHUNK_BYTES = (SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_MS) / 1000;
const REPLAY_TIMEOUT_MS = Number(process.env.REPLAY_TIMEOUT_MS ?? 8000);
const WAV_HEADER_BYTES = 44;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Streams a regression's stored WAV through a fresh AssemblyAI session
 * configured per one candidate config, at real-time pace (per AssemblyAI's
 * documented pacing requirement — DECISIONS.md D1), and scores the result
 * (PRD.md §9 Step 8).
 */
export async function runReplay(regressionId: string, configId: string): Promise<string> {
  const regression = await prisma.regression.findUniqueOrThrow({ where: { id: regressionId } });
  const config = await getConfigById(configId);

  await writeAuditEvent({
    eventType: "regression.replay_started",
    actor: "system",
    resourceType: "replay_run",
    resourceId: regressionId,
    payload: { regression_id: regressionId, config_id: configId },
    correlationId: regressionId,
  });

  const wavBuffer = await readFile(regression.audioAsset);
  const pcm = wavBuffer.subarray(WAV_HEADER_BYTES);

  const adapter = new AssemblyAIAdapter();
  adapter.on("error", () => {});

  let bestTurn: AaiTurnMessage | null = null;
  const startedAt = Date.now();
  let firstRelevantFinalAtMs: number | null = null;

  adapter.on("turn", (msg: AaiTurnMessage) => {
    if (!msg.end_of_turn) return;
    bestTurn = msg;
    if (firstRelevantFinalAtMs === null) {
      const found = extractRulePassEntities(msg.transcript).some((c) => c.entityType === regression.entityType);
      if (found) firstRelevantFinalAtMs = Date.now();
    }
  });

  let terminated = false;
  adapter.on("termination", () => {
    terminated = true;
  });

  let connectFailed = false;
  try {
    await adapter.connect(config);
  } catch {
    connectFailed = true;
  }

  if (!connectFailed) {
    for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
      adapter.sendAudio(pcm.subarray(offset, offset + CHUNK_BYTES));
      await sleep(CHUNK_MS);
    }
    adapter.terminate();

    const deadline = Date.now() + REPLAY_TIMEOUT_MS;
    while (!terminated && Date.now() < deadline) {
      await sleep(50);
    }
  }
  adapter.close();

  const transcript = bestTurn ? (bestTurn as AaiTurnMessage).transcript : "";
  const extractedCandidates = extractRulePassEntities(transcript).filter((c) => c.entityType === regression.entityType);
  const extractedValue = extractedCandidates[0]?.normalizedValue ?? null;
  const latencyMs = firstRelevantFinalAtMs ? firstRelevantFinalAtMs - startedAt : null;

  const score = scoreReplay({
    expectedValue: regression.expectedValue,
    extractedValue,
    contextBefore: regression.contextBefore,
    replayedTranscript: transcript,
    latencyMs: latencyMs ?? 0,
  });

  const replayRunId = ulid();
  await prisma.replayRun.create({
    data: {
      id: replayRunId,
      regressionId,
      configId,
      transcript,
      extractedValue,
      exactMatch: score.exactMatch,
      normalizedMatch: score.normalizedMatch,
      latencyMs,
      transcriptDelta: JSON.stringify(score.transcriptDelta),
      status: connectFailed ? "fail" : score.status,
    },
  });

  // PRD.md §2.6: draft -> tested once replayed against >=1 regression.
  await prisma.config.updateMany({ where: { id: configId, status: "draft" }, data: { status: "tested" } });

  await writeAuditEvent({
    eventType: "regression.replay_completed",
    actor: "system",
    resourceType: "replay_run",
    resourceId: replayRunId,
    payload: { regression_id: regressionId, config_id: configId, status: connectFailed ? "fail" : score.status, reason: connectFailed ? "CONNECT_FAILED" : null },
    correlationId: regressionId,
  });

  return replayRunId;
}
