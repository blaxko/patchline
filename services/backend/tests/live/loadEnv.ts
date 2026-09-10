import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Minimal .env loader (no dotenv dependency) — live tests need the real
// ASSEMBLYAI_API_KEY/GROQ_API_KEY from the repo-root .env, which nothing
// else in this test run auto-loads (unlike Prisma Client, not used here).
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "..", "..", "..", ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

// The whole point of this suite is a REAL connection — force this off even
// though the repo's own .env sets MOCK_ASSEMBLYAI=1 for local dev/testing.
process.env.MOCK_ASSEMBLYAI = "0";
