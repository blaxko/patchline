import { env } from "../env.js";

// GET https://streaming.assemblyai.com/v3/token — see DECISIONS.md D9.
export async function mintAssemblyAIToken(expiresInSeconds = 60): Promise<string> {
  if (env.MOCK_ASSEMBLYAI) {
    return "mock-token";
  }

  const url = new URL("https://streaming.assemblyai.com/v3/token");
  url.searchParams.set("expires_in_seconds", String(expiresInSeconds));

  const res = await fetch(url, {
    headers: { Authorization: env.ASSEMBLYAI_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`AssemblyAI token mint failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { token: string; expires_in_seconds: number };
  return body.token;
}
