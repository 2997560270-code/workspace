import { SKILLS, type SkillId } from "./training-config";
import { isFormalRetryImprovement, type TrainingHistoryRecord } from "./training-history";

export type MasteryState = "尚未训练" | "已接触" | "在提示下完成" | "可独立完成" | "表现稳定";

export type AbilitySkill = {
  id: SkillId;
  name: string;
  state: MasteryState;
  evidenceCount: number;
  improvedCount: number;
  latestEvidence: string;
};

export type AbilityProfile = {
  completedCount: number;
  retryCount: number;
  improvedCount: number;
  weeklyTarget: number;
  skills: AbilitySkill[];
  primaryWeakness: string;
  nextTraining: string;
};

export function buildAbilityProfile(
  records: TrainingHistoryRecord[],
  options: { formalEvidenceOnly?: boolean } = {}
): AbilityProfile {
  const retryImproved = (record: TrainingHistoryRecord, targetSkill?: SkillId) => options.formalEvidenceOnly
    ? isFormalRetryImprovement(record.retry, targetSkill)
    : Boolean(record.retry?.improved && (!targetSkill || record.retry.targetSkill === targetSkill));

  const skills = SKILLS.map((skill): AbilitySkill => {
    const dimensions = records
      .map((record) => ({
        record,
        dimension: record.evaluation.dimensions.find((dimension) => dimension.id === skill.id)
      }))
      .filter((item) => item.dimension && item.dimension.score > 0);
    const evidenceCount = dimensions.length;
    const independentCount = dimensions.filter((item) => (item.dimension?.score ?? 0) >= 3).length;
    const improvedCount = records.filter((record) => retryImproved(record, skill.id)).length;

    let state: MasteryState = "尚未训练";
    if (evidenceCount >= 3 && independentCount >= 3) state = "表现稳定";
    else if (independentCount >= 1) state = "可独立完成";
    else if (evidenceCount >= 1) state = "在提示下完成";
    else if (records.length > 0) state = "已接触";

    return {
      id: skill.id,
      name: skill.name,
      state,
      evidenceCount,
      improvedCount,
      latestEvidence: dimensions[0]?.dimension?.evidence ?? "完成训练后生成可追溯证据"
    };
  });

  const weakest = [...skills].sort((a, b) => {
    if (a.evidenceCount !== b.evidenceCount) return a.evidenceCount - b.evidenceCount;
    return a.improvedCount - b.improvedCount;
  })[0];

  return {
    completedCount: records.length,
    retryCount: records.filter((record) => record.retry).length,
    improvedCount: records.filter((record) => retryImproved(record)).length,
    weeklyTarget: 5,
    skills,
    primaryWeakness: weakest?.name ?? "场景与当前流程",
    nextTraining: weakest
      ? `下一次优先训练“${weakest.name}”，并在独立模式下留下新的行为证据。`
      : "完成一次训练后生成下一步建议。"
  };
}
