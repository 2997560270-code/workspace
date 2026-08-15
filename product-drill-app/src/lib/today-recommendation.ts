import { buildAbilityProfile } from "./ability-profile";
import { TRAINING_SCENARIOS, type TrainingScenario } from "./training-config";
import type { TrainingHistoryRecord } from "./training-history";

const FIRST_DIAGNOSIS_SCENARIO_ID = "export-slow";

/** Pick a focused scenario for today without repeating the latest practice. */
export function selectTodayScenario(records: TrainingHistoryRecord[] = []): TrainingScenario {
  if (records.length === 0) {
    return TRAINING_SCENARIOS.find((scenario) => scenario.id === FIRST_DIAGNOSIS_SCENARIO_ID)
      ?? TRAINING_SCENARIOS[0];
  }

  const profile = buildAbilityProfile(records);
  const weakest = profile.skills.find((skill) => skill.name === profile.primaryWeakness) ?? profile.skills[0];
  const recentScenarioIds = new Set(records.slice(0, 3).map((record) => record.scenarioId));
  const matching = TRAINING_SCENARIOS.filter((scenario) => scenario.skillId === weakest?.id);
  const freshMatch = matching.find((scenario) => !recentScenarioIds.has(scenario.id));
  if (freshMatch) return freshMatch;

  return TRAINING_SCENARIOS.find((scenario) => !recentScenarioIds.has(scenario.id))
    ?? matching[0]
    ?? TRAINING_SCENARIOS[0];
}
