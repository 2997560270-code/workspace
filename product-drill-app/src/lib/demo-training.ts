import {
  moveToJudgment,
  submitJudgment,
  type ProductJudgment,
  type TrainingSession
} from "./training-session";

const EMPTY_JUDGMENT: ProductJudgment = {
  targetUser: "",
  currentWorkflow: "",
  coreProblem: "",
  problemImpact: "",
  alternative: "",
  recommendation: "",
  successMetric: "",
  biggestAssumption: ""
};

export function submitDemoJudgment(session: TrainingSession, recommendation: string): TrainingSession {
  return submitJudgment(moveToJudgment(session), {
    ...EMPTY_JUDGMENT,
    recommendation: recommendation.trim()
  });
}
