import type {
  ChallengeRun,
  DecisionEvent,
  Intervention,
  WorldEvent,
} from "./causal-world";

export type ChallengeDecisionSummary = {
  run_id: string;
  decision_event_id: string;
  world_id: string;
  world_version: string;
  world_title: string;
  status: ChallengeRun["status"];
  started_at: string;
  completed_at: string | null;
  chosen_action: string;
  confidence: DecisionEvent["confidence"];
  consequences_revealed: boolean;
  /** FB-006：本地演示模式下完成的世界没有服务端记录，合并时标记来源 */
  source?: "server" | "local_demo";
};

export type ChallengeDecisionTimeline = ChallengeDecisionSummary & {
  model_version: string;
  rubric_version: string;
  judgment: string;
  expected_outcome: string;
  rejected_alternatives: string[];
  evidence_basis: string[];
  decision_created_at: string;
  events: WorldEvent[];
  interventions: Intervention[];
};
