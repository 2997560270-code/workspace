import { describe, expect, it } from "vitest";
import {
  selectNextChallenge,
  type CandidateWorld,
  type HypothesisSummary,
} from "../src/lib/challenge-selector";

// ── fixtures ──────────────────────────────────────────────────────
const worlds: CandidateWorld[] = [
  { world_id: "world-1", transfer_role: "calibration", domain: "product" },
  { world_id: "world-2", transfer_role: "intervention", domain: "product" },
  { world_id: "world-3", transfer_role: "transfer_test", domain: "ops" },
];

function makeHypothesis(
  override: Partial<HypothesisSummary> = {}
): HypothesisSummary {
  return {
    habit_name: "premature_solution_commitment",
    confidence: "insufficient",
    supporting_evidence_count: 0,
    counter_evidence_count: 0,
    completed_world_ids: [],
    ...override,
  };
}

// ── selectNextChallenge ───────────────────────────────────────────
describe("selectNextChallenge", () => {
  it("returns world-1 when no worlds have been completed", () => {
    const result = selectNextChallenge(worlds, makeHypothesis());
    expect(result.world_id).toBe("world-1");
    expect(result.reason).toBeTruthy();
  });

  it("returns world-2 when world-1 is completed and confidence is still insufficient", () => {
    const result = selectNextChallenge(
      worlds,
      makeHypothesis({ completed_world_ids: ["world-1"] })
    );
    expect(result.world_id).toBe("world-2");
  });

  it("returns world-3 only when hypothesis confidence is medium or higher", () => {
    const withLow = selectNextChallenge(
      worlds,
      makeHypothesis({
        completed_world_ids: ["world-1", "world-2"],
        confidence: "low",
      })
    );
    expect(withLow.world_id).not.toBe("world-3");

    const withMedium = selectNextChallenge(
      worlds,
      makeHypothesis({
        completed_world_ids: ["world-1", "world-2"],
        confidence: "medium",
      })
    );
    expect(withMedium.world_id).toBe("world-3");
  });

  it("does not repeat a completed world when alternatives exist", () => {
    const result = selectNextChallenge(
      worlds,
      makeHypothesis({ completed_world_ids: ["world-1"] })
    );
    expect(result.world_id).not.toBe("world-1");
  });

  it("returns the same-world remediation when all non-transfer worlds are done but confidence is low", () => {
    const result = selectNextChallenge(
      worlds,
      makeHypothesis({
        completed_world_ids: ["world-1", "world-2"],
        confidence: "low",
        supporting_evidence_count: 0,
        counter_evidence_count: 2,
      })
    );
    // Should not be world-3 (transfer), must be world-1 or world-2 (remediation)
    expect(["world-1", "world-2"]).toContain(result.world_id);
    expect(result.is_remediation).toBe(true);
  });

  it("returns world-3 when all calibration/intervention worlds done and confidence >= medium", () => {
    const result = selectNextChallenge(
      worlds,
      makeHypothesis({
        completed_world_ids: ["world-1", "world-2"],
        confidence: "high",
        supporting_evidence_count: 2,
        counter_evidence_count: 0,
      })
    );
    expect(result.world_id).toBe("world-3");
    expect(result.is_remediation).toBe(false);
  });

  it("returns a result with a non-empty reason string always", () => {
    for (const completed of [[], ["world-1"], ["world-1", "world-2"]]) {
      const result = selectNextChallenge(
        worlds,
        makeHypothesis({ completed_world_ids: completed })
      );
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("includes is_transfer_test flag correctly", () => {
    const notTransfer = selectNextChallenge(
      worlds,
      makeHypothesis({ completed_world_ids: [] })
    );
    expect(notTransfer.is_transfer_test).toBe(false);

    const transfer = selectNextChallenge(
      worlds,
      makeHypothesis({
        completed_world_ids: ["world-1", "world-2"],
        confidence: "medium",
      })
    );
    expect(transfer.is_transfer_test).toBe(true);
  });
});
