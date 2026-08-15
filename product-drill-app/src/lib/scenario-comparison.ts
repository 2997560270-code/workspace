import type { TrainingHistoryRecord } from "./training-history";

export type ScenarioComparison = {
  baseline: TrainingHistoryRecord;
  current: TrainingHistoryRecord;
  scoreDelta: number;
  improvedSkills: string[];
  regressedSkills: string[];
};

/** Compare only adjacent records that share scenario, version, and mode. */
export function compareScenarioRecords(
  records: TrainingHistoryRecord[],
  selected: TrainingHistoryRecord
): ScenarioComparison | null {
  const comparable = records
    .filter((record) => (
      record.scenarioId === selected.scenarioId
      && record.scenarioVersion === selected.scenarioVersion
      && record.mode === selected.mode
    ))
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  const currentIndex = comparable.findIndex((record) => record.id === selected.id);
  if (currentIndex <= 0) return null;

  const baseline = comparable[currentIndex - 1];
  const currentScores = new Map(selected.evaluation.dimensions.map((dimension) => [dimension.id, dimension]));
  const improvedSkills: string[] = [];
  const regressedSkills: string[] = [];
  baseline.evaluation.dimensions.forEach((dimension) => {
    const current = currentScores.get(dimension.id);
    if (!current) return;
    if (current.score > dimension.score) improvedSkills.push(current.name);
    if (current.score < dimension.score) regressedSkills.push(current.name);
  });

  return {
    baseline,
    current: selected,
    scoreDelta: selected.totalScore - baseline.totalScore,
    improvedSkills,
    regressedSkills
  };
}
