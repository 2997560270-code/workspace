import type { Evaluation } from "../training/evaluation";
import type { TrainingMessage, TrainingSession } from "../training/training-session";

let nextHistoryRecordId = 1;

function createHistoryRecordId(sessionId: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${nextHistoryRecordId++}`;
  return `history-${sessionId}-${randomId}`;
}

export type TrainingHistoryRecord = {
  id: string;
  title: string;
  scenario: string;
  mode: string;
  totalScore: number;
  messages: TrainingMessage[];
  evaluation: Evaluation;
};

export function createTrainingHistoryRecord(
  session: TrainingSession,
  evaluation: Evaluation
): TrainingHistoryRecord {
  return {
    id: createHistoryRecordId(session.id),
    title: `${session.scenario} / ${session.mode}`,
    scenario: session.scenario,
    mode: session.mode,
    totalScore: evaluation.totalScore,
    messages: session.messages,
    evaluation
  };
}
