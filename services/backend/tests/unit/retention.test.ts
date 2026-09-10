import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ulid } from "ulid";
import { prisma } from "../../src/db.js";
import { cleanupExpiredAudio } from "../../src/reliability/regression/retention.js";

async function makeRegression(status: string, createdAt: Date, audioPath: string) {
  const id = ulid();
  await writeFile(audioPath, "fake wav bytes");
  await prisma.regression.create({
    data: {
      id,
      sourceSessionId: "n/a",
      entityId: "n/a",
      entityType: "order_id",
      expectedValue: "BRK-71Q9",
      observedValue: "BRK-7109",
      audioAsset: audioPath,
      audioStartMs: 0,
      audioEndMs: 1000,
      contextBefore: "",
      contextAfter: "",
      baselineConfigId: "cfg_baseline_v1",
      repairMethod: "caller_confirmation",
      status,
      createdAt,
    },
  });
  return id;
}

describe("cleanupExpiredAudio (SECURITY.md / PRD.md §9 Step 13)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "patchline-retention-"));
  });

  it("deletes the audio file for a closed regression past the retention window", async () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
    const path = join(dir, "old-closed.wav");
    const id = await makeRegression("closed", oldDate, path);

    const deletedCount = await cleanupExpiredAudio(new Date());

    expect(deletedCount).toBeGreaterThanOrEqual(1);
    expect(existsSync(path)).toBe(false);

    // The regression row itself is never deleted, only the clip.
    const row = await prisma.regression.findUniqueOrThrow({ where: { id } });
    expect(row).toBeTruthy();
  });

  it("exempts an open (un-closed) regression regardless of age", async () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // very old
    const path = join(dir, "old-open.wav");
    await makeRegression("open", oldDate, path);

    await cleanupExpiredAudio(new Date());

    expect(existsSync(path)).toBe(true);
    expect((await readFile(path, "utf-8")).length).toBeGreaterThan(0);
  });

  it("exempts a closed regression still within the retention window", async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const path = join(dir, "recent-closed.wav");
    await makeRegression("closed", recentDate, path);

    await cleanupExpiredAudio(new Date());

    expect(existsSync(path)).toBe(true);
  });
});
