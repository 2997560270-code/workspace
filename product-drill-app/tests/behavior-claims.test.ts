import { describe, expect, it } from "vitest";
import {
  PREMATURE_SOLUTION_COMMITMENT_CLAIM,
  REQUIRED_FORBIDDEN_INFERENCES,
  assessDiscoveryReadiness,
} from "../src/lib/behavior-claims";

describe("approved premature-solution-commitment claim", () => {
  it("requires all three discovery dimensions before solution exploration", () => {
    expect(assessDiscoveryReadiness([])).toBe("insufficient");
    expect(assessDiscoveryReadiness(["workflow"])).toBe("insufficient");
    expect(assessDiscoveryReadiness(["workflow", "alternative"])).toBe(
      "problem_hypothesis"
    );
    expect(assessDiscoveryReadiness(["workflow", "consequence"])).toBe(
      "opportunity_hypothesis"
    );
    expect(
      assessDiscoveryReadiness(["workflow", "consequence", "alternative"])
    ).toBe("solution_exploration");
  });

  it("separates same-world correction from unassisted transfer evidence", () => {
    expect(PREMATURE_SOLUTION_COMMITMENT_CLAIM.evidence.same_world_correction).toContain(
      "不构成能力迁移证据"
    );
    expect(PREMATURE_SOLUTION_COMMITMENT_CLAIM.evidence.transfer).toContain(
      "未经提示"
    );
  });

  it("records every approved forbidden inference boundary", () => {
    expect(REQUIRED_FORBIDDEN_INFERENCES).toEqual(
      expect.arrayContaining([
        "overall_PM_competency",
        "hiring_fit",
        "personality_trait",
        "permanent_trait",
        "message_count",
        "text_length",
        "keyword_usage",
        "same_world_correction_as_transfer",
      ])
    );
    expect(PREMATURE_SOLUTION_COMMITMENT_CLAIM.governance_status).toBe("approved");
  });
});

