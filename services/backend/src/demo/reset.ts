import { rm } from "node:fs/promises";
import { prisma } from "../db.js";

/**
 * PRD.md §9 Step 15: restores the seeded DB state + seeded baseline config,
 * clearing any regressions/promotions/live-session state from a prior demo
 * run. Force-completes any still-active session first (the step's own error
 * case: "reset called mid-active-session -> active sessions are force-
 * completed first").
 */
export async function resetDemo(): Promise<void> {
  await prisma.session.updateMany({
    where: { status: { in: ["connecting", "active", "reconnecting", "degraded"] } },
    data: { status: "completed", endedAt: new Date() },
  });

  const regressions = await prisma.regression.findMany({ select: { audioAsset: true } });
  for (const r of regressions) {
    await rm(r.audioAsset, { force: true });
  }

  // Children before parents (SQLite FK constraints) — same order as prisma/seed.ts.
  await prisma.promotion.deleteMany();
  await prisma.replayRun.deleteMany();
  await prisma.regression.deleteMany();
  await prisma.repairEvent.deleteMany();
  await prisma.toolCall.deleteMany();
  await prisma.validationResult.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.utterance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditEvent.deleteMany();

  await prisma.config.updateMany({
    where: { id: "cfg_baseline_v1" },
    data: { status: "active", promotedBy: null, promotedAt: null },
  });
  await prisma.config.updateMany({
    where: { id: { not: "cfg_baseline_v1" } },
    data: { status: "draft", promotedBy: null, promotedAt: null },
  });
}
