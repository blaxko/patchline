import { readFile } from "node:fs/promises";
import type { AssemblyAIAdapter } from "./assemblyaiAdapter.js";
import { SAMPLE_RATE, BYTES_PER_SAMPLE } from "../reliability/regression/wav.js";

const CHUNK_MS = 100;
const CHUNK_BYTES = (SAMPLE_RATE * BYTES_PER_SAMPLE * CHUNK_MS) / 1000;
const WAV_HEADER_BYTES = 44;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Streams a stored WAV file's PCM through an already-connected adapter at
 * real-time pace — the exact same pacing rule Step 8's replay uses
 * (DECISIONS.md D1), and per PRD.md §9 Step 15: "prerecorded_clip sessions
 * stream a WAV file through the same Adapter code path as live mic input,
 * byte-identical pipeline, only the audio source differs."
 */
export async function streamWavFile(
  adapter: AssemblyAIAdapter,
  filePath: string,
  onChunk?: (chunk: Buffer) => void,
): Promise<void> {
  const wavBuffer = await readFile(filePath);
  const pcm = wavBuffer.subarray(WAV_HEADER_BYTES);

  for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
    const chunk = pcm.subarray(offset, offset + CHUNK_BYTES);
    adapter.sendAudio(chunk);
    onChunk?.(chunk);
    await sleep(CHUNK_MS);
  }
}
