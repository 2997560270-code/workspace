import { describe, expect, it } from "vitest";
import { buildAbilityProfile } from "../src/lib/ability-profile";
import { generateEvaluation } from "../src/lib/evaluation";
import { addRetryToHistory, createTrainingHistoryRecord } from "../src/lib/training-history";
import { createTrainingSession, moveToJudgment, sendTrainingMessage, submitJudgment, type TrainingEngine } from "../src/lib/training-session";

function recordWithRetry(retryEngine: TrainingEngine = "deterministic") {
  let session = createTrainingSession({ scenarioId: "dashboard-request", mode: "训练" });
  session = sendTrainingMessage(session, "你们目前的完整流程是怎么完成的？");
  session = moveToJudgment(session);
  session = submitJudgment(session, {
    targetUser: "区域运营",
    currentWorkflow: "每周汇总数据并核对",
    coreProblem: "数据编码不一致",
    problemImpact: "需要六小时",
    alternative: "Excel",
    recommendation: "先统一编码",
    successMetric: "缩短到一小时",
    biggestAssumption: "编码是主要问题"
  });
  const evaluation = generateEvaluation(session);
  const deterministicRecord = createTrainingHistoryRecord(session, evaluation);
  const record = {
    ...deterministicRecord,
    engine: "openai" as const,
    modelVersion: "test-evaluation-model",
    evaluation: {
      ...deterministicRecord.evaluation,
      engine: "openai" as const,
      modelVersion: "test-evaluation-model"
    }
  };
  return addRetryToHistory(record, {
    issueId: evaluation.issues[0].id,
    targetSkill: evaluation.issues[0].targetSkill,
    answer: "谁每天使用，谁负责最终决策？",
    improved: true,
    feedback: "已观察到改善",
    engine: retryEngine,
    modelVersion: retryEngine === "openai" ? "test-retry-model" : "deterministic-v1"
  });
}

describe("ability evidence profile", () => {
  it("aggregates training, retry, and skill evidence for the practice profile", () => {
    const profile = buildAbilityProfile([recordWithRetry()]);
    expect(profile.completedCount).toBe(1);
    expect(profile.retryCount).toBe(1);
    expect(profile.improvedCount).toBe(1);
    expect(profile.skills).toHaveLength(5);
    expect(profile.skills.some((skill) => skill.evidenceCount > 0)).toBe(true);
  });

  it("excludes deterministic retry improvement from formal ability evidence", () => {
    const record = recordWithRetry("deterministic");
    expect(buildAbilityProfile([record]).improvedCount).toBe(1);
    expect(buildAbilityProfile([record], { formalEvidenceOnly: true }).improvedCount).toBe(0);
  });

  it("counts OpenAI retry improvement in formal ability evidence", () => {
    const record = recordWithRetry("openai");
    const profile = buildAbilityProfile([record], { formalEvidenceOnly: true });
    expect(profile.improvedCount).toBe(1);
    expect(profile.skills.find((skill) => skill.id === record.retry?.targetSkill)?.improvedCount).toBe(1);
  });
});
