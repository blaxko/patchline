import { rm } from "node:fs/promises";
import { prisma } from "../../db.js";
import { env } from "../../env.js";

/**
 * Deletes regression audio clips past AUDIO_RETENTION_DAYS (SECURITY.md /
 * PRD.md §9 Step 13). Only `closed` regressions are eligible — an open,
 * replaying, replayed, or reopened regression is still an active reliability
 * asset and is exempt regardless of age. The `regressions` row itself is
 * never deleted, only the backing `.wav` file.
 */
export async function cleanupExpiredAudio(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - env.AUDIO_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const expired = await prisma.regression.findMany({
    where: { status: "closed", createdAt: { lte: cutoff } },
  });

  let deleted = 0;
  for (const regression of expired) {
    try {
      await rm(regression.audioAsset, { force: true });
      deleted++;
    } catch {
      // best-effort cleanup; a missing file is not an error worth surfacing
    }
  }

  return deleted;
}
