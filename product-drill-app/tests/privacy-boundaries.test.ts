import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsProperties } from "../src/lib/analytics/events";
import { scrubProperties } from "../src/lib/monitoring/server";

describe("telemetry privacy boundaries", () => {
  it("only allows approved product analytics dimensions", () => {
    const safe = sanitizeAnalyticsProperties({
      scenarioId: "dashboard-request",
      engine: "openai",
      improved: true,
      content: "用户对话原文",
      prompt: "hidden prompt",
      email: "user@example.com",
      token: "secret"
    });
    expect(safe).toEqual({ scenarioId: "dashboard-request", engine: "openai", improved: true });
  });

  it("scrubs sensitive Sentry context recursively", () => {
    const scrubbed = scrubProperties({
      area: "evaluation",
      message: "raw answer",
      nested: { email: "user@example.com", scenarioId: "activation-drop", answer: "secret" },
      list: [{ token: "secret", targetSkill: "metric" }]
    });
    expect(scrubbed).toEqual({
      area: "evaluation",
      nested: { scenarioId: "activation-drop" },
      list: [{ targetSkill: "metric" }]
    });
  });
});
