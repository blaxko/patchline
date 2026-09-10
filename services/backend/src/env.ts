export const env = {
  ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY ?? "",
  MOCK_ASSEMBLYAI: process.env.MOCK_ASSEMBLYAI === "1",
  MOCK_ASSEMBLYAI_WS_URL: process.env.MOCK_ASSEMBLYAI_WS_URL ?? "ws://localhost:9099",
  // Railway/Render both assign a dynamic port via PORT and expect the app to
  // listen on it — BACKEND_PORT remains the local-dev override.
  BACKEND_PORT: Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 8080),
  RECONNECT_GRACE_MS: Number(process.env.RECONNECT_GRACE_MS ?? 10_000),
  AUDIO_BUFFER_RETENTION_MS: Number(process.env.AUDIO_BUFFER_RETENTION_MS ?? 120_000),
  AUDIO_STORAGE_DIR: process.env.AUDIO_STORAGE_DIR ?? "./data/audio",
  AUDIO_RETENTION_DAYS: Number(process.env.AUDIO_RETENTION_DAYS ?? 30),
  LATENCY_REGRESSION_THRESHOLD: Number(process.env.LATENCY_REGRESSION_THRESHOLD ?? 1.25),
};
