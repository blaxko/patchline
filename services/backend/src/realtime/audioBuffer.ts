import { env } from "../env.js";

interface Chunk {
  data: Buffer;
  receivedAtMs: number;
}

/**
 * Full raw call audio is held only transiently, in-memory, per session
 * (SECURITY.md "Audio retention" / PRD.md §9 Step 3). Only regression-relevant
 * ranges get persisted to disk, starting Step 7.
 */
class AudioBufferStore {
  private buffers = new Map<string, Chunk[]>();

  push(sessionId: string, data: Buffer): void {
    const now = Date.now();
    const chunks = this.buffers.get(sessionId) ?? [];
    chunks.push({ data, receivedAtMs: now });

    const cutoff = now - env.AUDIO_BUFFER_RETENTION_MS;
    while (chunks.length > 0 && chunks[0].receivedAtMs < cutoff) {
      chunks.shift();
    }

    this.buffers.set(sessionId, chunks);
  }

  getAll(sessionId: string): Buffer {
    const chunks = this.buffers.get(sessionId) ?? [];
    return Buffer.concat(chunks.map((c) => c.data));
  }

  clear(sessionId: string): void {
    this.buffers.delete(sessionId);
  }
}

export const audioBufferStore = new AudioBufferStore();
