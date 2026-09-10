import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// services/backend/src/demo -> repo root is 4 levels up.
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const MANIFEST_PATH = join(REPO_ROOT, "fixtures", "audio", "demo", "manifest.json");

interface DemoClip {
  id: string;
  file: string;
  label: string;
  script: string;
}

let cachedManifest: { clips: DemoClip[] } | null = null;

function loadManifest(): { clips: DemoClip[] } {
  cachedManifest ??= JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  return cachedManifest!;
}

export function listDemoClips(): DemoClip[] {
  return loadManifest().clips;
}

export function resolveDemoClipPath(clipId: string): string | null {
  const clip = loadManifest().clips.find((c) => c.id === clipId);
  if (!clip) return null;
  return join(REPO_ROOT, "fixtures", "audio", "demo", clip.file);
}
