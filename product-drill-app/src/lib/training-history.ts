import type { Evaluation } from "./evaluation";
import type { TrainingMessage, TrainingSession } from "./training-session";

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
    id: `history-${session.id}`,
    title: `${session.scenario} / ${session.mode}`,
    scenario: session.scenario,
    mode: session.mode,
    totalScore: evaluation.totalScore,
    messages: session.messages,
    evaluation
  };
}
