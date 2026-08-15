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

export function addRetryToHistory(record: TrainingHistoryRecord, retry: RetryResult): TrainingHistoryRecord {
  return { ...record, retry };
}
