import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const testDbPath = join(repoRoot, "prisma", "test-backend.db");
const testDbUrl = `file:${testDbPath}`;

export async function setup() {
  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath);
  }

  execSync("pnpm exec prisma db push --schema prisma/schema.prisma --skip-generate", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });

  execSync("pnpm exec tsx prisma/seed.ts", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });
}

export async function teardown() {
  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath);
  }
}
