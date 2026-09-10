import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegressionCompare, type ReplayRunRow } from "../RegressionCompare";

// Fixture matching PRD.md §11's Regression Compare example table shape.
const fixtureRuns: ReplayRunRow[] = [
  {
    id: "r1",
    configId: "cfg_baseline_v1",
    config_name: "Baseline",
    config_status: "draft",
    extractedValue: "BRK-7109",
    latencyMs: 412,
    status: "fail",
  },
  {
    id: "r2",
    configId: "cfg_keyterms_v3",
    config_name: "Keyterms v3",
    config_status: "tested",
    extractedValue: "BRK-71Q9",
    latencyMs: 421,
    status: "pass",
  },
];

describe("RegressionCompare", () => {
  it("renders one row per config with entity, latency, and result", () => {
    render(<RegressionCompare runs={fixtureRuns} />);

    expect(screen.getByText("Baseline")).toBeTruthy();
    expect(screen.getByText("BRK-7109")).toBeTruthy();
    expect(screen.getByText("412 ms")).toBeTruthy();
    expect(screen.getByText("FAIL")).toBeTruthy();

    expect(screen.getByText("Keyterms v3")).toBeTruthy();
    expect(screen.getByText("BRK-71Q9")).toBeTruthy();
    expect(screen.getByText("421 ms")).toBeTruthy();
    expect(screen.getByText("PASS")).toBeTruthy();
  });

  it("shows a Promote button only next to a PASS row, and calls back with its config id", () => {
    const onPromote = vi.fn();
    render(<RegressionCompare runs={fixtureRuns} onPromote={onPromote} />);

    const buttons = screen.getAllByRole("button", { name: "Promote" });
    expect(buttons).toHaveLength(1);

    fireEvent.click(buttons[0]);
    expect(onPromote).toHaveBeenCalledWith("cfg_keyterms_v3");
  });

  it("renders a placeholder when no replay runs exist yet", () => {
    render(<RegressionCompare runs={[]} />);
    expect(screen.getByText(/No replay runs yet/)).toBeTruthy();
  });
});
