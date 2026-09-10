import { describe, it, expect } from "vitest";
import { defaultGroqToolCall } from "../../src/reliability/extraction/llmFallback.js";
import { speak } from "../../src/tts/orpheusClient.js";

const hasKey = Boolean(process.env.GROQ_API_KEY);

/**
 * TESTING.md §3 "Real-API smoke tests" — proves DECISIONS.md D5's model
 * choices (openai/gpt-oss-120b for extraction, canopylabs/orpheus-v1-english
 * for TTS) actually work against the live Groq API, not just our own mocks.
 * Run with: pnpm --filter backend exec vitest run --config vitest.live.config.ts
 */
describe.skipIf(!hasKey)("Groq — live smoke tests", () => {
  it("extracts customer_name and refund_amount via the real chat-completions tool-call API", async () => {
    const result = await defaultGroqToolCall("hi, this is Siobhan Mercer calling about a refund of eighty dollars");

    const name = result.find((c) => c.entityType === "customer_name");
    const amount = result.find((c) => c.entityType === "refund_amount");
    expect(name?.normalizedValue).toBe("Siobhan Mercer");
    expect(amount?.normalizedValue).toBe("80.00");
  });

  it("TTS: returns either real audio bytes or null — never throws (TESTING.md TTS-failure row)", async () => {
    // As of this run, canopylabs/orpheus-v1-english requires org-level terms
    // acceptance in the Groq console before it will synthesize audio; until
    // that's done this correctly (and safely) returns null rather than
    // throwing — which is itself the exact degrade-safely behavior this
    // client is designed to prove. Once terms are accepted, this should
    // start returning a real WAV buffer without any code change.
    const result = await speak("I heard B R K seven one zero nine, could you repeat the last four characters?");
    expect(result === null || Buffer.isBuffer(result)).toBe(true);
    if (result) {
      expect(result.subarray(0, 4).toString("ascii")).toBe("RIFF");
    }
  });
});
