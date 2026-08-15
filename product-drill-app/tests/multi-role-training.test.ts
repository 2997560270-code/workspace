import { describe, expect, it } from "vitest";
import { answerMultiRoleQuestion, MULTI_ROLE_SCENARIOS } from "../src/lib/multi-role-training";

describe("multi-role training", () => {
  it("provides distinct role objectives and facts", () => {
    const roles = MULTI_ROLE_SCENARIOS[0].roles;
    expect(new Set(roles.map((role) => role.objective)).size).toBe(roles.length);
    expect(new Set(roles.map((role) => role.facts.workflow)).size).toBe(roles.length);
  });

  it("answers from the selected role's facts", () => {
    const role = MULTI_ROLE_SCENARIOS[0].roles.find((item) => item.id === "finance")!;
    expect(answerMultiRoleQuestion(role, "现在的流程是什么？")).toContain("结账");
    expect(answerMultiRoleQuestion(role, "你希望证明什么指标？")).toContain("高价值差异");
  });
});
