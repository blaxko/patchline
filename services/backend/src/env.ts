export const env = {
  ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY ?? "",
  MOCK_ASSEMBLYAI: process.env.MOCK_ASSEMBLYAI === "1",
  MOCK_ASSEMBLYAI_WS_URL: process.env.MOCK_ASSEMBLYAI_WS_URL ?? "ws://localhost:9099",
  BACKEND_PORT: Number(process.env.BACKEND_PORT ?? 8080),
  RECONNECT_GRACE_MS: Number(process.env.RECONNECT_GRACE_MS ?? 10_000),
  AUDIO_BUFFER_RETENTION_MS: Number(process.env.AUDIO_BUFFER_RETENTION_MS ?? 120_000),
};
