export const SAMPLE_RATE = 16000;
export const BYTES_PER_SAMPLE = 2; // PCM16LE mono, matches the AssemblyAI Adapter's session config

export function msToByteOffset(ms: number): number {
  return Math.max(0, Math.floor((ms * SAMPLE_RATE * BYTES_PER_SAMPLE) / 1000));
}

/** Wraps raw PCM16LE mono samples in a minimal 44-byte canonical WAV header. */
export function pcm16ToWav(pcmData: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * BYTES_PER_SAMPLE;

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(BYTES_PER_SAMPLE, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}
