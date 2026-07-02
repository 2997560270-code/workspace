import { SCORE_DIMENSIONS } from "../training/evaluation";
import type { TrainingHistoryRecord } from "../history/training-history";

export type AbilityProfile = {
  averageScore: number;
  completedCount: number;
  bestScore: number;
  progress: number;
  trend: { label: string; score: number }[];
  dimensions: { name: string; score: number }[];
  shortcomings: string[];
  nextTraining: string;
};

function toHundred(score: number): number {
  return Math.round(score * 20);
}

export function buildAbilityProfile(records: TrainingHistoryRecord[]): AbilityProfile {
  if (records.length === 0) {
    return {
      averageScore: 0,
      completedCount: 0,
      bestScore: 0,
      progress: 0,
      trend: [],
      dimensions: SCORE_DIMENSIONS.map((name) => ({ name, score: 0 })),
      shortcomings: ["完成一次训练后生成高频短板"],
      nextTraining: "完成一次训练后推荐下一步方向"
    };
  }

  const chronological = [...records].reverse();
  const averageScore = Math.round(
    records.reduce((sum, record) => sum + toHundred(record.totalScore), 0) / records.length
  );
  const bestScore = Math.max(...records.map((record) => toHundred(record.totalScore)));
  const progress = toHundred(chronological.at(-1)!.totalScore) - toHundred(chronological[0].totalScore);

  const dimensions = SCORE_DIMENSIONS.map((name) => {
    const scores = records
      .map((record) => record.evaluation.dimensions.find((item) => item.name === name)?.score)
      .filter((score): score is number => typeof score === "number");
    const score = scores.length ? Math.round(scores.reduce((sum, item) => sum + toHundred(item), 0) / scores.length) : 0;
    return { name, score };
  });

  const shortcomings = [...new Set(records.flatMap((record) => record.evaluation.issues))].slice(0, 3);
  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0]?.name ?? "问题澄清";

  return {
    averageScore,
    completedCount: records.length,
    bestScore,
    progress,
    trend: chronological.map((record, index) => ({ label: `第 ${index + 1} 次`, score: toHundred(record.totalScore) })),
    dimensions,
    shortcomings,
    nextTraining: `下一轮建议训练 ${weakest}：选择客户咨询 / 严格，集中补足追问、指标和价值论证。`
  };
}
