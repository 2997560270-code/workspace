import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateEvaluation } from "../src/lib/evaluation";
import { createTrainingSession, sendTrainingMessage } from "../src/lib/training-session";
import type { SkillId } from "../src/lib/training-config";

type GoldenCase = {
  id: string;
  scenarioId: string;
  mode: "练习" | "独立" | "严格";
  messages: Array<{ role: "user"; content: string }>;
  expected: {
    primarySkill: SkillId;
    level: "未体现" | "在提示下体现" | "独立体现" | "稳定且深入";
    minScore: number;
    evidenceMustBeVerbatim: boolean;
    repeatable: boolean;
  };
};

const cases = readFileSync("evals/golden-sessions.jsonl", "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as GoldenCase);

describe("direction A golden evaluation regression", () => {
  it("contains 30 reviewed calibration cases", () => {
    expect(cases).toHaveLength(30);
    expect(new Set(cases.map((item) => item.scenarioId)).size).toBe(6);
    expect(new Set(cases.map((item) => item.expected.primarySkill)).size).toBe(5);
  });

  for (const golden of cases) {
    it(`${golden.id} keeps evidence traceable and repeatable`, () => {
      let session = createTrainingSession({ scenarioId: golden.scenarioId, mode: golden.mode });
      for (const message of golden.messages) session = sendTrainingMessage(session, message.content);
      const first = generateEvaluation(session);
      const second = generateEvaluation(session);
      const dimension = first.dimensions.find((item) => item.id === golden.expected.primarySkill)!;
      expect(dimension.score).toBeGreaterThanOrEqual(golden.expected.minScore);
      expect(dimension.level).toBe(golden.expected.level);
      for (let index = 0; index < dimension.evidenceMessageIds.length; index += 1) {
        const source = session.messages.find((message) => message.id === dimension.evidenceMessageIds[index]);
        expect(source).toBeDefined();
        expect(source?.content).toContain(dimension.evidenceQuotes[index]);
      }
      expect(second.dimensions).toEqual(first.dimensions);
      expect(second.totalScore).toBe(first.totalScore);
    });
  }
});
