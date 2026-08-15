import type { TrainingHistoryRecord } from "./training-history";

export type WeeklyTrainingSummary = {
  totalSessions: number;
  improvedCount: number;
  averageScore: number | null;
  focusSkill: string | null;
};

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysFromMonday);
  return date;
}

export function buildWeeklyTrainingSummary(
  records: TrainingHistoryRecord[],
  now: Date = new Date()
): WeeklyTrainingSummary {
  const weekStart = startOfWeek(now).getTime();
  const weekEnd = now.getTime();
  const weeklyRecords = records.filter((record) => {
    const completedAt = Date.parse(record.completedAt);
    return completedAt >= weekStart && completedAt <= weekEnd;
  });

  if (!weeklyRecords.length) {
    return { totalSessions: 0, improvedCount: 0, averageScore: null, focusSkill: null };
  }

  const skillScores = new Map<string, { name: string; total: number; count: number }>();
  weeklyRecords.forEach((record) => {
    record.evaluation.dimensions.forEach((dimension) => {
      const current = skillScores.get(dimension.id) ?? { name: dimension.name, total: 0, count: 0 };
      current.total += dimension.score;
      current.count += 1;
      skillScores.set(dimension.id, current);
    });
  });
  const focusSkill = [...skillScores.values()]
    .sort((a, b) => a.total / a.count - b.total / b.count)[0]?.name ?? null;
  const scoreTotal = weeklyRecords.reduce((sum, record) => sum + record.totalScore, 0);

  return {
    totalSessions: weeklyRecords.length,
    improvedCount: weeklyRecords.filter((record) => record.retry?.improved).length,
    averageScore: Math.round(scoreTotal / weeklyRecords.length),
    focusSkill
  };
}
