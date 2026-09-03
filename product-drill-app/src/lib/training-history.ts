import type { Evaluation } from "./evaluation";
import type { SkillId, TrainingScenario } from "./training-config";
import type { ProductJudgment, TrainingEngine, TrainingMessage, TrainingSession } from "./training-session";

export type RetryResult = {
  id?: string;
  issueId: string;
  targetSkill: SkillId;
  answer: string;
  improved: boolean;
  feedback: string;
  engine?: TrainingEngine;
  modelVersion?: string;
};

export type MentorNote = {
  author: string;
  content: string;
  createdAt: string;
};

// FB-014：服务端对评分相关字段的 HMAC 签名，用于检测本地篡改。
// 签名计算只在服务端进行（见 training-integrity.ts，依赖 node:crypto）。
export type RecordIntegrity = {
  version: number;
  algorithm: string;
  signedAt: string;
  signature: string;
};

export function hasServerIntegrity(record: { integrity?: RecordIntegrity }): boolean {
  return Boolean(record.integrity?.signature && record.integrity.algorithm === "hmac-sha256");
}

export function isFormalRetryImprovement(retry: RetryResult | undefined, targetSkill?: SkillId): boolean {
  return Boolean(
    retry?.engine === "openai"
    && retry.improved
    && (!targetSkill || retry.targetSkill === targetSkill)
  );
}

export type TrainingHistoryRecord = {
  id: string;
  sessionId: string;
  scenarioId: string;
  scenarioSnapshot?: TrainingScenario;
  scenarioVersion: number;
  rubricVersion: string;
  modelVersion: string;
  engine: TrainingEngine;
  mode: TrainingSession["mode"];
  completedAt: string;
  totalScore: number;
  messages: TrainingMessage[];
  judgment?: ProductJudgment;
  evaluation: Evaluation;
  retry?: RetryResult;
  mentorNote?: MentorNote;
  integrity?: RecordIntegrity;
};

export function createTrainingHistoryRecord(session: TrainingSession, evaluation: Evaluation): TrainingHistoryRecord {
  return {
    id: `history-${session.id}`,
    sessionId: session.id,
    scenarioId: session.scenarioId,
    scenarioSnapshot: session.scenarioSnapshot,
    scenarioVersion: session.scenarioVersion,
    rubricVersion: evaluation.rubricVersion,
    modelVersion: evaluation.modelVersion,
    engine: evaluation.engine,
    mode: session.mode,
    completedAt: new Date().toISOString(),
    totalScore: evaluation.totalScore,
    messages: session.messages,
    judgment: session.judgment,
    evaluation
  };
}

export type ScenarioTrainingStatus = "未训练" | "已覆盖" | "待复练";

type ScenarioMapStatus = {
  status: ScenarioTrainingStatus;
  attempts: number;
  latest?: TrainingHistoryRecord;
};

// 训练地图状态（FB-003）：records 需按 completedAt 倒序传入（mergeHistoryRecords 已保证）。
// 最新一次仍有待改进问题且未复练 → 待复练；否则视为已覆盖。
export function getScenarioTrainingStatus(
  scenarioId: string,
  records: TrainingHistoryRecord[]
): ScenarioMapStatus {
  const attempts = records.filter((record) => record.scenarioId === scenarioId);
  const latest = attempts[0];
  if (!latest) return { status: "未训练", attempts: 0 };
  if (latest.evaluation.issues.length > 0 && !latest.retry) {
    return { status: "待复练", attempts: attempts.length, latest };
  }
  return { status: "已覆盖", attempts: attempts.length, latest };
}

export function addRetryToHistory(record: TrainingHistoryRecord, retry: RetryResult): TrainingHistoryRecord {
  return { ...record, retry };
}
