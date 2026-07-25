import { describe, expect, it } from "vitest";
import {
  classifyInterventionTiming,
  buildInterventionContent,
  isPreDecisionHint,
  type InterventionContext,
} from "../src/lib/intervention-generator";
import type { Intervention, DecisionEvent } from "../src/lib/causal-world";

// ── fixtures ──────────────────────────────────────────────────────
function makeDecision(override: Partial<DecisionEvent> = {}): DecisionEvent {
  return {
    id: "dec-001",
    run_id: "run-001",
    world_event_id: "evt-001",
    judgment: "用户未明确说明当前工作流，但我认为问题很明显",
    chosen_action: "直接推荐搭建大屏系统",
    expected_outcome: "提升效率",
    confidence: "high",
    rejected_alternatives: [],
    evidence_basis: [],
    consequences_revealed: false,
    created_at: new Date().toISOString(),
    ...override,
  };
}

function makeIntervention(
  type: Intervention["intervention_type"],
  runId = "run-001"
): Intervention {
  return {
    id: `int-${Math.random()}`,
    run_id: runId,
    decision_event_id: null,
    intervention_type: type,
    content: "some hint content",
    model_version: "gpt-4o",
    world_version: "1.0.0",
    triggered_at: new Date().toISOString(),
  };
}

// ── isPreDecisionHint ─────────────────────────────────────────────
describe("isPreDecisionHint", () => {
  it("returns true when hint was given before the decision was created", () => {
    const hintBefore = makeIntervention("hint");
    // Hint triggered before decision
    const decisionAfter = makeDecision({
      created_at: new Date(Date.now() + 5000).toISOString(),
    });
    expect(isPreDecisionHint(hintBefore, decisionAfter)).toBe(true);
  });

  it("returns false for non-hint intervention type", () => {
    const feedback = makeIntervention("feedback");
    const decision = makeDecision();
    expect(isPreDecisionHint(feedback, decision)).toBe(false);
  });

  it("returns false when hint was triggered after decision creation", () => {
    const decision = makeDecision({
      created_at: new Date(Date.now() - 5000).toISOString(),
    });
    const hintAfter = makeIntervention("hint");
    expect(isPreDecisionHint(hintAfter, decision)).toBe(false);
  });
});

// ── classifyInterventionTiming ────────────────────────────────────
describe("classifyInterventionTiming", () => {
  it("marks decision as assisted when a pre-decision hint exists in the same run", () => {
    const hintBefore: Intervention = {
      ...makeIntervention("hint"),
      triggered_at: new Date(Date.now() - 10000).toISOString(),
    };
    const decision = makeDecision({
      created_at: new Date().toISOString(),
    });
    const result = classifyInterventionTiming([hintBefore], decision);
    expect(result.was_assisted).toBe(true);
    expect(result.pre_decision_hint_ids).toContain(hintBefore.id);
  });

  it("marks decision as NOT assisted when no hints existed before the decision", () => {
    const feedbackAfter: Intervention = {
      ...makeIntervention("feedback"),
      triggered_at: new Date(Date.now() + 10000).toISOString(),
    };
    const decision = makeDecision({ created_at: new Date().toISOString() });
    const result = classifyInterventionTiming([feedbackAfter], decision);
    expect(result.was_assisted).toBe(false);
    expect(result.pre_decision_hint_ids).toHaveLength(0);
  });

  it("only counts hints from the same run", () => {
    const hintOtherRun: Intervention = {
      ...makeIntervention("hint", "other-run"),
      triggered_at: new Date(Date.now() - 10000).toISOString(),
    };
    const decision = makeDecision({ run_id: "run-001", created_at: new Date().toISOString() });
    const result = classifyInterventionTiming([hintOtherRun], decision);
    expect(result.was_assisted).toBe(false);
  });
});

// ── buildInterventionContent ──────────────────────────────────────
describe("buildInterventionContent", () => {
  const ctx: InterventionContext = {
    decision: makeDecision({
      judgment: "数据大屏可以解决所有问题",
      chosen_action: "立刻上马大屏",
      evidence_basis: [],
    }),
    missing_dimensions: ["workflow", "consequence", "alternative"],
    world_trigger: "数据大屏建设请求",
    intervention_type: "feedback",
  };

  it("returns a non-empty content string", () => {
    const content = buildInterventionContent(ctx);
    expect(content.length).toBeGreaterThan(20);
  });

  it("feedback content references the missing dimensions", () => {
    const content = buildInterventionContent({ ...ctx, intervention_type: "feedback" });
    // Should mention at least one of the dimensions
    const mentionsDimension =
      content.includes("workflow") ||
      content.includes("consequence") ||
      content.includes("alternative") ||
      content.includes("工作流") ||
      content.includes("影响") ||
      content.includes("替代");
    expect(mentionsDimension).toBe(true);
  });

  it("counterfactual content frames what would have happened differently", () => {
    const content = buildInterventionContent({
      ...ctx,
      intervention_type: "counterfactual",
    });
    expect(content.length).toBeGreaterThan(20);
  });

  it("does NOT include scores, ratings, or judgment labels", () => {
    const content = buildInterventionContent(ctx);
    const forbidden = ["score:", "rating:", "总分", "得分：", "评级"];
    for (const term of forbidden) {
      expect(content.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });
});
