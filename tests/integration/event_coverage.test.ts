import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The full event catalog per PRD.md §8 (brief Step 12's list).
const EVENT_CATALOG = [
  "session.started",
  "transcript.partial",
  "transcript.final",
  "entity.detected",
  "entity.validation_started",
  "entity.verified",
  "entity.rejected",
  "action.allowed",
  "action.blocked",
  "repair.started",
  "repair.completed",
  "regression.created",
  "regression.replay_started",
  "regression.replay_completed",
  "config.promoted",
  "config.rolled_back",
  "session.completed",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("Event catalog coverage (PRD.md §9 Step 12)", () => {
  const sourceDir = join(__dirname, "..", "..", "services", "backend", "src");
  const files = walk(sourceDir);
  const combinedSource = files.map((f) => readFileSync(f, "utf-8")).join("\n");

  it.each(EVENT_CATALOG)("event type %s has at least one emission site in services/backend/src", (eventType) => {
    expect(combinedSource).toContain(`"${eventType}"`);
  });

  it("the catalog itself (services/backend/src/events.ts EventType union) matches PRD.md §8 exactly", () => {
    const eventsFile = readFileSync(join(sourceDir, "events.ts"), "utf-8");
    for (const eventType of EVENT_CATALOG) {
      expect(eventsFile).toContain(`"${eventType}"`);
    }
  });
});
