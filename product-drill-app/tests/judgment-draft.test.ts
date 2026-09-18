import { describe, expect, it } from "vitest";
import { draftJudgmentFromTranscript, mergeJudgmentDraft, type JudgmentFieldKey } from "../src/lib/judgment-draft";
import type { ProductJudgment, TrainingMessage } from "../src/lib/training-session";

const EMPTY: ProductJudgment = {
  targetUser: "",
  currentWorkflow: "",
  coreProblem: "",
  problemImpact: "",
  alternative: "",
  recommendation: "",
  successMetric: "",
  biggestAssumption: "",
};

function message(partial: Partial<TrainingMessage> & Pick<TrainingMessage, "id" | "role" | "content">): TrainingMessage {
  return { turnIndex: 0, ...partial };
}

describe("draftJudgmentFromTranscript", () => {
  it("returns everything missing for an empty transcript", () => {
    const draft = draftJudgmentFromTranscript([], []);
    expect(draft.values).toEqual({});
    expect(draft.missing).toHaveLength(8);
  });

  it("prefills the user's own question that revealed a dimension", () => {
    const messages = [
      message({ id: "u1", role: "user", content: "谁每天在用这个导出功能？", turnIndex: 0 }),
      message({ id: "a1", role: "ai", content: "财务分析师每天用。", revealedSkill: "role", turnIndex: 1 }),
    ];
    const draft = draftJudgmentFromTranscript(messages, ["role"]);
    expect(draft.values.targetUser).toBe("谁每天在用这个导出功能？");
    expect(draft.provenance.targetUser?.messageIds).toEqual(["u1", "a1"]);
    expect(draft.missing).not.toContain("targetUser");
  });

  it("never makes recommendation or biggestAssumption extractable", () => {
    const messages = [
      message({ id: "u1", role: "user", content: "建议直接重写导出服务。", turnIndex: 0 }),
      message({ id: "a1", role: "ai", content: "ok", revealedSkill: "role", turnIndex: 1 }),
    ];
    const draft = draftJudgmentFromTranscript(messages, ["role"]);
    expect(draft.values.recommendation).toBeUndefined();
    expect(draft.values.biggestAssumption).toBeUndefined();
    expect(draft.missing).toContain("recommendation");
    expect(draft.missing).toContain("biggestAssumption");
  });

  it("is idempotent", () => {
    const messages = [
      message({ id: "u1", role: "user", content: "现在流程怎么走？", turnIndex: 0 }),
      message({ id: "a1", role: "ai", content: "月底手工合并。", revealedSkill: "workflow", turnIndex: 1 }),
    ];
    const first = draftJudgmentFromTranscript(messages, ["workflow"]);
    const second = draftJudgmentFromTranscript(messages, ["workflow"]);
    expect(second).toEqual(first);
  });
});

describe("mergeJudgmentDraft", () => {
  it("fills only empty and untouched fields", () => {
    const draft = draftJudgmentFromTranscript([
      message({ id: "u1", role: "user", content: "谁每天在用？", turnIndex: 0 }),
      message({ id: "a1", role: "ai", content: "财务分析师。", revealedSkill: "role", turnIndex: 1 }),
    ], ["role"]);
    const touched = new Set<JudgmentFieldKey>(["currentWorkflow"]);
    const current: ProductJudgment = { ...EMPTY, currentWorkflow: "我自己写的流程" };
    const merged = mergeJudgmentDraft(current, draft, touched);
    expect(merged.targetUser).toBe("谁每天在用？");
    expect(merged.currentWorkflow).toBe("我自己写的流程");
  });

  it("does not overwrite content the user already typed", () => {
    const draft = draftJudgmentFromTranscript([
      message({ id: "u1", role: "user", content: "谁每天在用？", turnIndex: 0 }),
      message({ id: "a1", role: "ai", content: "财务分析师。", revealedSkill: "role", turnIndex: 1 }),
    ], ["role"]);
    const merged = mergeJudgmentDraft({ ...EMPTY, targetUser: "我的答案" }, draft, new Set());
    expect(merged.targetUser).toBe("我的答案");
  });
});
