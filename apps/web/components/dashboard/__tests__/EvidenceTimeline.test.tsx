import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidenceTimeline, type EvidenceEvent } from "../EvidenceTimeline";

// Fixture event sequence mirroring PRD.md §0's demo scenario / §11's
// Evidence Timeline example.
const sessionStartedAt = "2026-01-01T00:00:00.000Z";
const fixtureEvents: EvidenceEvent[] = [
  { id: "1", eventType: "session.started", payload: {}, createdAt: "2026-01-01T00:00:00.000Z" },
  {
    id: "2",
    eventType: "entity.detected",
    payload: { normalized_value: "BRK-7109", entity_type: "order_id" },
    createdAt: "2026-01-01T00:00:19.400Z",
  },
  { id: "3", eventType: "entity.rejected", payload: { entity_type: "order_id" }, createdAt: "2026-01-01T00:00:19.600Z" },
  {
    id: "4",
    eventType: "action.blocked",
    payload: { tool_name: "lookup_order", reason: "ENTITY_AMBIGUOUS" },
    createdAt: "2026-01-01T00:00:19.700Z",
  },
  {
    id: "5",
    eventType: "repair.started",
    payload: { question: "I heard B-R-K-7-1-0-9 — could you repeat the last four characters?" },
    createdAt: "2026-01-01T00:00:20.100Z",
  },
  {
    id: "6",
    eventType: "entity.verified",
    payload: { verified_value: "BRK-71Q9" },
    createdAt: "2026-01-01T00:00:23.500Z",
  },
  {
    id: "7",
    eventType: "action.allowed",
    payload: { tool_name: "lookup_order" },
    createdAt: "2026-01-01T00:00:23.700Z",
  },
  {
    id: "8",
    eventType: "regression.created",
    payload: { repair_method: "caller_confirmation" },
    createdAt: "2026-01-01T00:00:24.000Z",
  },
];

describe("EvidenceTimeline", () => {
  it("renders one row per event, in order, with a relative timestamp", () => {
    render(<EvidenceTimeline events={fixtureEvents} sessionStartedAt={sessionStartedAt} />);

    expect(screen.getByText(/Entity detected: BRK-7109/)).toBeTruthy();
    expect(screen.getByText(/lookup_order blocked \(reason: ENTITY_AMBIGUOUS\)/)).toBeTruthy();
    expect(screen.getByText(/Repair question spoken/)).toBeTruthy();
    expect(screen.getByText(/Entity verified: BRK-71Q9/)).toBeTruthy();
    expect(screen.getByText(/lookup_order allowed/)).toBeTruthy();
    expect(screen.getByText(/Regression created/)).toBeTruthy();

    // 19.4s after session start -> 00:19.4
    expect(screen.getByText("00:19.4")).toBeTruthy();
    // 24.0s after session start -> 00:24.0
    expect(screen.getByText("00:24.0")).toBeTruthy();
  });

  it("renders a placeholder for an empty event list rather than an empty table", () => {
    render(<EvidenceTimeline events={[]} sessionStartedAt={sessionStartedAt} />);
    expect(screen.getByText(/No events yet/)).toBeTruthy();
  });
});
