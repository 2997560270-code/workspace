import { describe, expect, it } from "vitest";
import {
  addTrainingAnswer,
  changeTrainingScenario,
  createTrainingSession,
  sendTrainingMessage
} from "../src/lib/training-session";

describe("training session", () => {
  it("creates a session with an AI opening message", () => {
    const session = createTrainingSession({ scenario: "AI+", mode: "用户需求提出" });

    expect(session.id.length).toBeGreaterThan(0);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toMatchObject({ role: "ai" });
    expect(session.messages[0].content).toContain("AI+");
    expect(session.messages[0].content).toContain("您的具体业务是什么");
    expect(session.messages[0].content).not.toContain("最需要澄清的问题");
  });

  it("stores user messages and returns the next AI follow-up", () => {
    const session = createTrainingSession({ scenario: "企业员工培训", mode: "客户咨询" });
    const updated = sendTrainingMessage(session, "我们先解决培训完成率低的问题。");

    expect(updated.messages.map((message) => message.role)).toEqual(["ai", "user", "ai"]);
    expect(updated.messages[1].content).toContain("培训完成率低");
    expect(updated.messages[2].content).toContain("围绕 企业员工培训 方向");
    expect(updated.messages[2].content).toContain("培训完成率低");
  });

  it("adds a final answer without another AI follow-up", () => {
    const session = createTrainingSession({ scenario: "AI+", mode: "用户需求提出" });
    const updated = addTrainingAnswer(session, "这是最终方案。");

    expect(updated.messages.map((message) => message.role)).toEqual(["ai", "user"]);
    expect(updated.messages[1].content).toContain("最终方案");
  });

  it("adds a scenario switch message to an active session", () => {
    const session = createTrainingSession({ scenario: "AI+", mode: "客户咨询", difficulty: "严格" });
    const updated = changeTrainingScenario(session, "B2B", "客户咨询", "严格");

    expect(updated.scenario).toBe("B2B");
    expect(updated.mode).toBe("客户咨询");
    expect(updated.messages.at(-1)?.content).toContain("当前行业场景已经切换到B2B，模式客户咨询，难度严格");
  });
});
