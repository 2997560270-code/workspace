import { describe, expect, it } from "vitest";
import { createTrainingSession, sendTrainingMessage } from "../src/lib/training-session";

describe("training session", () => {
  it("creates a session with an AI opening message", () => {
    const session = createTrainingSession({ scenario: "AI+", mode: "用户需求提出" });

    expect(session.id.length).toBeGreaterThan(0);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toMatchObject({ role: "ai" });
    expect(session.messages[0].content).toContain("AI+");
  });

  it("stores user messages and returns the next AI follow-up", () => {
    const session = createTrainingSession({ scenario: "企业员工培训", mode: "客户咨询" });
    const updated = sendTrainingMessage(session, "我们先解决培训完成率低的问题。");

    expect(updated.messages.map((message) => message.role)).toEqual(["ai", "user", "ai"]);
    expect(updated.messages[1].content).toContain("培训完成率低");
    expect(updated.messages[2].content).toContain("继续追问");
  });
});
