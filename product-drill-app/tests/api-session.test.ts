import { describe, expect, it } from "vitest";
import { resolveSessionSnapshot } from "../src/lib/api/server";
import { createTrainingSession, moveToJudgment, sendTrainingMessage, useTrainingHint } from "../src/lib/training-session";

describe("API session snapshot reconciliation", () => {
  it("accepts a client hint or stage transition only when the stored transcript remains an exact prefix", () => {
    const stored = sendTrainingMessage(createTrainingSession({ scenarioId: "dashboard-request" }), "目前流程是怎么完成的？");
    const supplied = moveToJudgment(useTrainingHint(stored));
    const resolved = resolveSessionSnapshot({ stored, supplied, sessionId: stored.id, allowMissingStored: false });
    expect(resolved?.stage).toBe("judgment");
    expect(resolved?.hintsUsed).toBe(1);
  });

  it("rejects a supplied snapshot that rewrites persisted messages", () => {
    const stored = sendTrainingMessage(createTrainingSession({ scenarioId: "dashboard-request" }), "目前流程是怎么完成的？");
    const supplied = { ...stored, messages: stored.messages.map((message, index) => index === 1 ? { ...message, content: "伪造内容" } : message) };
    const resolved = resolveSessionSnapshot({ stored, supplied, sessionId: stored.id, allowMissingStored: false });
    expect(resolved?.messages[1].content).toBe("目前流程是怎么完成的？");
  });

  it("rejects appended client-authored user evidence", () => {
    const stored = sendTrainingMessage(createTrainingSession({ scenarioId: "dashboard-request" }), "目前流程是怎么完成的？");
    const supplied = {
      ...stored,
      messages: [...stored.messages, { id: "forged", role: "user" as const, content: "谁是真正的用户？", turnIndex: stored.messages.length }]
    };
    const resolved = resolveSessionSnapshot({ stored, supplied, sessionId: stored.id, allowMissingStored: false });
    expect(resolved?.messages.some((message) => message.id === "forged")).toBe(false);
  });});
