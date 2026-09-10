import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

/**
 * Deliberately dependency-free (no `dotenv` package) so this can be the
 * very first thing evaluated by the real server entrypoint, before any
 * other module — critically, before @prisma/client, which bundles its own
 * copy of `dotenv` and auto-loads `.env` the first time a PrismaClient is
 * constructed. That auto-load only fills in variables that are still unset
 * at that point, so whichever loader runs first determines the outcome for
 * any variable not explicitly set in the shell.
 *
 * Root cause this fixes: `server.ts` used to import `./env.js` and the
 * gateway/route modules (which transitively import `db.ts` / Prisma)
 * as ordinary static imports. Static imports are hoisted and evaluated in
 * whatever order the module graph happens to resolve them, which is an
 * implementation detail of the codebase's current shape, not something
 * `MOCK_ASSEMBLYAI`'s correctness should depend on — Prisma's auto-load
 * could easily run first, silently defaulting MOCK_ASSEMBLYAI to `.env`'s
 * own `1` even when the operator's intent (running the real server against
 * a real AssemblyAI account) was clearly the opposite. Calling this
 * function as literally the first statement in the real entrypoint,
 * before any dynamic `import()` of the rest of the app, makes env
 * resolution deterministic and independent of that unrelated ordering.
 *
 * Never overrides a variable already present in process.env (a shell-level
 * export or an orchestrator-injected value always wins over the `.env`
 * file), matching the standard dotenv convention.
 */
export function loadEnvFileDefaults(): void {
  const envPath = join(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) continue; // shell-set vars always win
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}
