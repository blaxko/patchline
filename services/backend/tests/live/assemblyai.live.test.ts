import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AssemblyAIAdapter } from "../../src/realtime/assemblyaiAdapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * TESTING.md §3 "Real-API smoke tests" — opt-in, never part of the normal
 * mocked suite. Proves the real wire protocol (query params, token minting,
 * Begin/Turn/Termination lifecycle) actually works against AssemblyAI's
 * live Universal-Streaming endpoint, not just our own mock server.
 * Run with: pnpm --filter backend exec vitest run --config vitest.live.config.ts
 */
// TESTING.md §3's "opt-in, manual/nightly only" is satisfied by this file
// living under tests/live/, which vitest.config.ts excludes entirely from
// the normal `pnpm test` run — only `pnpm test:live` (a separate command,
// a separate config) ever executes it. Additionally skipped if no key is
// present, so a bare `pnpm test:live` degrades to "skipped" rather than
// throwing on missing credentials.
const hasKey = Boolean(process.env.ASSEMBLYAI_API_KEY);

describe.skipIf(!hasKey)("AssemblyAI Universal-Streaming — live smoke test", () => {
  it("connects, receives Begin, streams audio, and terminates cleanly", async () => {
    const adapter = new AssemblyAIAdapter();
    const events: string[] = [];
    adapter.on("begin", () => events.push("begin"));
    adapter.on("turn", () => events.push("turn"));
    adapter.on("termination", () => events.push("termination"));
    adapter.on("error", (err) => events.push(`error:${(err as Error).message}`));

    await adapter.connect({
      speechModel: "universal-streaming-english",
      contextMode: "none",
      prompt: null,
      keytermsPrompt: null,
      formatTurns: false,
      endOfTurnConfidenceThreshold: 0.4,
    });

    // connect() resolves on the WS "open" handshake; the AssemblyAI-level
    // "Begin" message arrives a moment later over a separate message event.
    await new Promise<void>((resolve, reject) => {
      if (events.includes("begin")) return resolve();
      const timer = setTimeout(() => reject(new Error("timeout waiting for Begin")), 5000);
      adapter.on("begin", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    expect(events).toContain("begin");

    // Stream the demo clip's silent PCM at real-time pace — proves the
    // binary audio path works; no transcript is expected since it's silence.
    const wav = readFileSync(join(__dirname, "..", "..", "..", "..", "fixtures", "audio", "demo", "brk_known_failure.wav"));
    const pcm = wav.subarray(44);
    const chunkBytes = 3200;
    for (let offset = 0; offset < pcm.length; offset += chunkBytes * 4) {
      // Send a handful of chunks quickly — a full real-time-paced clip
      // isn't needed to prove the connection accepts binary audio.
      adapter.sendAudio(pcm.subarray(offset, offset + chunkBytes));
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout waiting for Termination")), 15000);
      adapter.on("termination", () => {
        clearTimeout(timer);
        resolve();
      });
      adapter.terminate();
    });

    expect(events).toContain("termination");
    expect(events.some((e) => e.startsWith("error"))).toBe(false);
    adapter.close();
  });
});
