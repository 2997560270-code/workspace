import { describe, expect, it } from "vitest";
import {
  addTrainingAnswer,
  changeTrainingScenario,
  createTrainingSession,
  sendTrainingMessage
} from "../../src/features/training/training-session";

describe("training session migration", () => {
  it("starts only after settings are confirmed and asks for concrete business", () => {
    const session = createTrainingSession({ scenario: "AI+", mode: "客户咨询", difficulty: "标准" });

    expect(session.scenario).toBe("AI+");
    expect(session.mode).toBe("客户咨询");
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].content).toContain("您的具体业务是什么");
  });

  it("stores user messages and generates the first follow-up around users, scene and metrics", () => {
    const session = createTrainingSession({ scenario: "AI+", mode: "客户咨询", difficulty: "标准" });
    const updated = sendTrainingMessage(session, "我的业务是企业 AI 培训服务");

    expect(updated.messages.some((message) => message.role === "user" && message.content.includes("企业 AI 培训服务"))).toBe(true);
    expect(updated.messages.at(-1)?.content).toContain("目标用户");
    expect(updated.messages.at(-1)?.content).toContain("验证");
  });

  it("adds a final answer without another AI follow-up after submitting a solution", () => {
    const session = createTrainingSession({ scenario: "B2B", mode: "方案评估", difficulty: "严格" });
    const updated = addTrainingAnswer(session, "这是我的最终方案");

    expect(updated.messages.at(-1)).toMatchObject({ role: "user", content: "这是我的最终方案" });
  });

  it("resets follow-up counting after switching scenario", () => {
    const session = createTrainingSession({ scenario: "AI+", mode: "客户咨询", difficulty: "标准" });
    const first = sendTrainingMessage(session, "我的业务是 AI 服务");
    const switched = changeTrainingScenario(first, "B2B", "用户需求提出", "严格");
    const next = sendTrainingMessage(switched, "我的业务是采购管理系统");

    expect(switched.messages.at(-1)?.content).toContain("您的具体业务是什么");
    expect(next.messages.at(-1)?.content).toContain("你提到的具体业务");
    expect(next.messages.at(-1)?.content).not.toContain("第 2 轮");
  });
});
