/**
 * Issue #3 — causal analytics 测试
 *
 * 验收：
 * - 事件字段有定义、可计算三类指标
 * - 不发送对话原文、决策正文、API key 或隐藏世界事实
 * - 迁移率指标明确标记为 experimental
 * - sanitizeCausalProperties 过滤一切未允许的字段
 */
import { describe, expect, it } from "vitest";
import {
  sanitizeCausalProperties,
  buildChallengeStartedProps,
  buildDecisionCommittedProps,
  buildInterventionReceivedProps,
  buildTransferEvidenceProps,
  buildInvestigationActionProps,
  buildProfileViewedProps,
  CAUSAL_EVENTS,
  type CausalAnalyticsProperties,
} from "../src/lib/causal-analytics";

// ── CAUSAL_EVENTS 键存在性 ────────────────────────────────────────
describe("CAUSAL_EVENTS", () => {
  it("defines all 8 required events", () => {
    const required = [
      "challengeStarted",
      "investigationActionCommitted",
      "decisionCommitted",
      "consequenceRevealed",
      "interventionReceived",
      "transferChallengeStarted",
      "transferEvidenceRecorded",
      "judgmentProfileViewed",
    ] as const;
    for (const key of required) {
      expect(CAUSAL_EVENTS).toHaveProperty(key);
      expect(typeof CAUSAL_EVENTS[key]).toBe("string");
    }
  });

  it("event name strings are non-empty and snake_case", () => {
    for (const value of Object.values(CAUSAL_EVENTS)) {
      expect(value.length).toBeGreaterThan(0);
      expect(value).toMatch(/^[a-z][a-z_]+[a-z]$/);
    }
  });
});

// ── sanitizeCausalProperties ──────────────────────────────────────
describe("sanitizeCausalProperties", () => {
  it("passes allowed fields through", () => {
    const props: CausalAnalyticsProperties = {
      worldId: "world-1",
      worldVersion: "1.0.0",
      transferRole: "calibration",
      runId: "run-abc",
      wasAssisted: false,
      evidenceBasisCount: 3,
      confidence: "medium",
      actionCount: 2,
      interventionType: "hint",
      isExperimentalMetric: false,
    };
    const result = sanitizeCausalProperties(props);
    expect(result).toEqual(props);
  });

  it("strips any field not in the allowed list", () => {
    const malicious = {
      worldId: "world-1",
      judgment: "建议立刻上马",          // decision text — FORBIDDEN
      chosen_action: "直接建大屏",        // decision text — FORBIDDEN
      apiKey: "sk-secret",               // API key — FORBIDDEN
      hiddenFact: "真实用户只有两人",     // hidden fact — FORBIDDEN
      conversationText: "你好，请问...", // PII / conversation — FORBIDDEN
    } as Record<string, unknown>;

    const result = sanitizeCausalProperties(malicious as CausalAnalyticsProperties);

    expect(result).not.toHaveProperty("judgment");
    expect(result).not.toHaveProperty("chosen_action");
    expect(result).not.toHaveProperty("apiKey");
    expect(result).not.toHaveProperty("hiddenFact");
    expect(result).not.toHaveProperty("conversationText");
    expect(result.worldId).toBe("world-1");
  });

  it("returns empty object when input is empty", () => {
    expect(sanitizeCausalProperties({})).toEqual({});
  });

  it("strips non-string/number/boolean values", () => {
    const input = {
      worldId: "world-1",
      runId: { nested: "object" } as unknown as string,
    };
    const result = sanitizeCausalProperties(input as CausalAnalyticsProperties);
    expect(result.worldId).toBe("world-1");
    expect(result).not.toHaveProperty("runId");
  });
});

// ── buildChallengeStartedProps ────────────────────────────────────
describe("buildChallengeStartedProps", () => {
  it("includes worldId, worldVersion, transferRole, runId", () => {
    const props = buildChallengeStartedProps({
      worldId: "world-1",
      worldVersion: "1.0.0",
      transferRole: "calibration",
      runId: "run-001",
    });
    expect(props.worldId).toBe("world-1");
    expect(props.worldVersion).toBe("1.0.0");
    expect(props.transferRole).toBe("calibration");
    expect(props.runId).toBe("run-001");
    expect(props.isExperimentalMetric).toBe(false);
  });

  it("marks transfer_challenge_started as experimental", () => {
    const props = buildChallengeStartedProps({
      worldId: "world-3",
      worldVersion: "1.0.0",
      transferRole: "transfer_test",
      runId: "run-003",
    });
    expect(props.isExperimentalMetric).toBe(true);
  });
});

// ── buildDecisionCommittedProps ───────────────────────────────────
describe("buildDecisionCommittedProps", () => {
  it("includes counts and flags but NO text content", () => {
    const props = buildDecisionCommittedProps({
      worldId: "world-1",
      worldVersion: "1.0.0",
      runId: "run-001",
      wasAssisted: true,
      evidenceBasisCount: 3,
      confidence: "high",
    });

    expect(props.wasAssisted).toBe(true);
    expect(props.evidenceBasisCount).toBe(3);
    expect(props.confidence).toBe("high");

    // Must NOT contain any text field
    expect(props).not.toHaveProperty("judgment");
    expect(props).not.toHaveProperty("chosen_action");
    expect(props).not.toHaveProperty("expected_outcome");
  });
});

// ── buildInterventionReceivedProps ────────────────────────────────
describe("buildInterventionReceivedProps", () => {
  it("includes interventionType but NO content text", () => {
    const props = buildInterventionReceivedProps({
      worldId: "world-1",
      worldVersion: "1.0.0",
      runId: "run-001",
      interventionType: "feedback",
    });
    expect(props.interventionType).toBe("feedback");
    expect(props).not.toHaveProperty("content");
    expect(props).not.toHaveProperty("interventionContent");
  });
});

// ── buildTransferEvidenceProps ────────────────────────────────────
describe("buildTransferEvidenceProps", () => {
  it("marks transfer evidence as experimental metric", () => {
    const props = buildTransferEvidenceProps({
      worldId: "world-3",
      worldVersion: "1.0.0",
      runId: "run-003",
      evidenceType: "transfer",
    });
    expect(props.isExperimentalMetric).toBe(true);
    expect(props.evidenceType).toBe("transfer");
  });
});

// ── buildInvestigationActionProps ─────────────────────────────────
describe("buildInvestigationActionProps", () => {
  it("includes actionCount and no text fields", () => {
    const props = buildInvestigationActionProps({
      worldId: "world-1",
      worldVersion: "1.0.0",
      runId: "run-001",
      actionCount: 3,
    });
    expect(props.actionCount).toBe(3);
    expect(props.worldId).toBe("world-1");
    expect(props).not.toHaveProperty("judgment");
    expect(props).not.toHaveProperty("content");
  });

  it("actionCount increments correctly per call", () => {
    const first = buildInvestigationActionProps({ worldId: "w", worldVersion: "1", runId: "r", actionCount: 1 });
    const third = buildInvestigationActionProps({ worldId: "w", worldVersion: "1", runId: "r", actionCount: 3 });
    expect(first.actionCount).toBe(1);
    expect(third.actionCount).toBe(3);
  });
});

// ── buildProfileViewedProps ───────────────────────────────────────
describe("buildProfileViewedProps", () => {
  it("uses hypothesisCount, not actionCount", () => {
    const props = buildProfileViewedProps({ itemCount: 5 });
    expect(props.hypothesisCount).toBe(5);
    expect(props).not.toHaveProperty("actionCount");
  });

  it("is not experimental", () => {
    const props = buildProfileViewedProps({ itemCount: 0 });
    expect(props.isExperimentalMetric).toBe(false);
  });
});
