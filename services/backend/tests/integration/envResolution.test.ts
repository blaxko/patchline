import { describe, it, expect } from "vitest";
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const SERVER_ENTRY = join(__dirname, "..", "..", "src", "server.ts");
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx.cmd");

// child.kill() on Windows only signals the immediate process; when that
// process is itself a wrapper (pnpm/cmd) around the real tsx/node process,
// the actual server survives and keeps its port bound forever — observed
// directly while first writing this test (two servers were still listening
// on their test ports after the whole suite had already finished). Using
// taskkill's tree flag (/T) kills the whole process tree, not just the
// immediate child.
function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
  } catch {
    // already exited — fine
  }
}

/**
 * Proves the fix for the real bug found during the Step 14/15 audit: the
 * real server process used to silently resolve MOCK_ASSEMBLYAI=true just
 * because the repo's own .env (which genuinely exists at REPO_ROOT with
 * MOCK_ASSEMBLYAI=1, per .env.example's own documented local-dev default)
 * got auto-loaded by @prisma/client's bundled dotenv before this app's own
 * env.ts ever read the variable — regardless of what the shell explicitly
 * set. These tests spawn the REAL entrypoint as a child process (the only
 * way to genuinely exercise process-boundary env resolution) against the
 * REPO'S OWN REAL .env file, which is exactly the scenario that broke.
 */
function spawnServer(extraEnv: Record<string, string | undefined>, port: number) {
  const child = spawn(TSX_BIN, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      ...extraEnv,
      DATABASE_URL: `file:${join(REPO_ROOT, "prisma", "dev.db")}`,
      BACKEND_PORT: String(port),
    },
    // .cmd shims require shell interpretation on Windows (spawning them
    // directly throws EINVAL) — killTree() below handles the resulting
    // process tree via `taskkill /T` rather than relying on child.kill().
    shell: true,
  });

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (d) => (stdout += d.toString()));
  child.stderr?.on("data", (d) => (stderr += d.toString()));

  return {
    child,
    getStdout: () => stdout,
    getStderr: () => stderr,
    waitForOutput: (predicate: (out: string) => boolean, timeoutMs = 15000): Promise<void> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for output.\nstdout:\n${stdout}\nstderr:\n${stderr}`)), timeoutMs);
        const check = setInterval(() => {
          if (predicate(stdout) || predicate(stderr)) {
            clearInterval(check);
            clearTimeout(timer);
            resolve();
          }
        }, 100);
      }),
    waitForExit: (timeoutMs = 15000): Promise<number | null> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for exit.\nstdout:\n${stdout}\nstderr:\n${stderr}`)), timeoutMs);
        child.once("exit", (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      }),
  };
}

describe("Real-server env resolution (fixes the MOCK_ASSEMBLYAI silent-default bug)", () => {
  it("with MOCK_ASSEMBLYAI unset in the shell, resolves to MOCK (matching the repo's own real .env) and says so loudly", async () => {
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.MOCK_ASSEMBLYAI; // simulate a shell that never set it at all
    const server = spawnServer(env, 18080);

    try {
      await server.waitForOutput((out) => out.includes("AssemblyAI mode: MOCK"));
      expect(server.getStdout()).toContain("MOCK_ASSEMBLYAI=1");
    } finally {
      killTree(server.child.pid);
    }
  }, 20000);

  it("with MOCK_ASSEMBLYAI=0 and a real-looking key explicitly set, resolves to LIVE regardless of .env's own default", async () => {
    const server = spawnServer({ MOCK_ASSEMBLYAI: "0", ASSEMBLYAI_API_KEY: "test-key-for-this-assertion-only" }, 18081);

    try {
      await server.waitForOutput((out) => out.includes("AssemblyAI mode: LIVE"));
      expect(server.getStdout()).not.toContain("AssemblyAI mode: MOCK");
    } finally {
      killTree(server.child.pid);
    }
  }, 20000);

  it("with MOCK_ASSEMBLYAI=0 and no ASSEMBLYAI_API_KEY, refuses to boot loudly instead of silently running with an empty key", async () => {
    // Explicitly empty, not merely absent — loadEnvFileDefaults() only fills
    // in variables truly missing from process.env, and this repo's own real
    // .env does have a real key, so an absent (rather than explicitly
    // empty) var here would just get silently backfilled from it.
    const server = spawnServer({ MOCK_ASSEMBLYAI: "0", ASSEMBLYAI_API_KEY: "" }, 18082);

    try {
      const exitCode = await server.waitForExit();
      expect(exitCode).toBe(1);
      expect(server.getStderr()).toContain("Refusing to start");
      expect(server.getStderr()).toContain("ASSEMBLYAI_API_KEY");
    } finally {
      killTree(server.child.pid);
    }
  }, 20000);
});
