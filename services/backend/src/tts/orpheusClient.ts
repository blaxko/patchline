// Groq Orpheus TTS per DECISIONS.md D5: POST https://api.groq.com/openai/v1/audio/speech,
// model canopylabs/orpheus-v1-english, voice "autumn".
const GROQ_SPEECH_URL = "https://api.groq.com/openai/v1/audio/speech";
const TTS_TIMEOUT_MS = Number(process.env.GROQ_TTS_TIMEOUT_MS ?? 5000);

export type SpeakFn = (text: string) => Promise<Buffer | null>;

/**
 * Returns synthesized audio bytes, or null if TTS is unavailable (no key,
 * timeout, or a non-2xx response) — callers must degrade to text-only,
 * never hard-fail the call (TESTING.md "TTS failure" row).
 */
export const speak: SpeakFn = async (text: string): Promise<Buffer | null> => {
  if (!process.env.GROQ_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "canopylabs/orpheus-v1-english",
        voice: "autumn",
        input: text,
        response_format: "wav",
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
