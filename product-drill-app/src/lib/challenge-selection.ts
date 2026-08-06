import { PREMATURE_SOLUTION_COMMITMENT_CLAIM } from "./behavior-claims";
import {
  selectNextChallenge,
  type ChallengeSelectorResult,
  type HypothesisSummary,
} from "./challenge-selector";
import {
  getChallengeDecisionRecords,
  getJudgmentProfile,
} from "./repositories/challenge-repository";
import { DEMO_WORLDS, getDemoWorld } from "./world-seeds";

export type NextChallengeSelection = ChallengeSelectorResult & {
  world_title: string;
  world_version: string;
  domain: string;
  hypothesis_confidence: HypothesisSummary["confidence"];
  completed_world_ids: string[];
};

export async function selectNextChallengeForUser(
  userId: string,
  progressionConfidence?: HypothesisSummary["confidence"]
): Promise<NextChallengeSelection> {
  const [hypotheses, decisionRecords] = await Promise.all([
    getJudgmentProfile(userId),
    getChallengeDecisionRecords(userId),
  ]);
  const hypothesis = hypotheses.find(
    (item) => item.habit_name === PREMATURE_SOLUTION_COMMITMENT_CLAIM.id
  );
  const completedWorldSet = new Set(decisionRecords.map(({ run }) => run.world_id));
  const completedWorldIds = DEMO_WORLDS
    .filter((world) => completedWorldSet.has(world.world_id))
    .map((world) => world.world_id);
  const summary: HypothesisSummary = {
    habit_name: PREMATURE_SOLUTION_COMMITMENT_CLAIM.id,
    confidence: progressionConfidence ?? hypothesis?.confidence ?? "insufficient",
    supporting_evidence_count: hypothesis?.supporting_evidence_ids.length ?? 0,
    counter_evidence_count: hypothesis?.counter_evidence_ids.length ?? 0,
    completed_world_ids: completedWorldIds,
  };
  const selection = selectNextChallenge(
    DEMO_WORLDS.map((world) => ({
      world_id: world.world_id,
      transfer_role: world.transfer_role,
      domain: world.domain,
    })),
    summary
  );
  const world = getDemoWorld(selection.world_id);
  if (!world) throw new Error(`Selected governed world not found: ${selection.world_id}`);

  return {
    ...selection,
    world_title: world.title,
    world_version: world.version.version,
    domain: world.domain,
    hypothesis_confidence: summary.confidence,
    completed_world_ids: completedWorldIds,
  };
}
