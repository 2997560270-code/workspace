import { afterEach, describe, expect, it, vi } from "vitest";

const openaiMock = vi.hoisted(() => ({ client: null as { responses: { parse: (input: unknown) => Promise<unknown> } } | null }));
vi.mock("../src/lib/ai/client", () => ({ getOpenAIClient: () => openaiMock.client }));

import { generateRoleplayTurn, generateStructuredEvaluation } from "../src/lib/ai/pipeline";
import { applyRoleplayReply, createTrainingSession } from "../src/lib/training-session";

const skillIds = ["role", "workflow", "impact", "alternative", "metric"] as const;

afterEach(() => { openaiMock.client = null; });

describe("AI pipeline fallback and evidence validation", () => {
  it("uses the deterministic engine when OpenAI is unavailable", async () => {
    const session = createTrainingSession({ scenarioId: "dashboard-request", mode: "独立" });
    const next = await generateRoleplayTurn(session, "你们目前的流程是怎么完成的？");
    expect(next.engine).toBe("deterministic");
    expect(next.modelVersion).toBe("deterministic-v1");
    expect(next.messages.at(-1)?.content).toContain("三个系统导出 Excel");
  });

  it("accepts prefixed JSON from an OpenAI-compatible roleplay model", async () => {
    const session = createTrainingSession({ scenarioId: "dashboard-request", mode: "独立" });
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_text: `reply, revealedSkill, coveredSkills.\n${JSON.stringify({
            reply: "区域运营专员每天使用报表。",
            revealedSkill: "role",
            coveredSkills: ["role"],
          })}`,
        }),
      },
    };

    const next = await generateRoleplayTurn(session, "谁每天使用报表？");
    expect(next.engine).toBe("openai");
    expect(next.messages.at(-1)?.content).toBe("区域运营专员每天使用报表。");
  });

  it("discards model evidence that does not reference a real verbatim message span", async () => {
    const base = createTrainingSession({ scenarioId: "dashboard-request", mode: "独立" });
    const session = applyRoleplayReply(base, {
      userMessage: "谁是真正每天使用报表的用户？",
      reply: "区域运营专员每天使用。",
      coveredSkills: ["role"],
      revealedSkill: "role",
      modelVersion: "test-model:v1"
    });
    const userMessage = session.messages.find((message) => message.role === "user")!;
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            summary: "测试评估",
            confidence: "中",
            dimensions: skillIds.map((id) => ({
              id,
              level: id === "role" || id === "workflow" ? "独立体现" : "未体现",
              confidence: 0.9,
              evidenceMessageIds: id === "role" ? [userMessage.id] : id === "workflow" ? ["missing-message"] : [],
              evidenceQuotes: id === "role" ? ["谁是真正每天使用报表的用户"] : id === "workflow" ? ["不存在的引用"] : [],
              why: "测试",
              nextAction: "继续训练"
            })),
            strengths: ["角色识别清楚"],
            issues: []
          }
        })
      }
    };

    const evaluation = await generateStructuredEvaluation(session);
    expect(evaluation.engine).toBe("openai");
    expect(evaluation.dimensions.find((item) => item.id === "role")?.evidenceMessageIds).toEqual([userMessage.id]);
    expect(evaluation.dimensions.find((item) => item.id === "workflow")?.level).toBe("未体现");
    expect(evaluation.dimensions.find((item) => item.id === "workflow")?.confidence).toBeLessThanOrEqual(0.3);
  });
});
