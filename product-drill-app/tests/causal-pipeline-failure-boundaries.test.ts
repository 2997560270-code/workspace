import { afterEach, describe, expect, it, vi } from "vitest";
import type { CausalWorldVersion, DecisionEvent, WorldEvent } from "../src/lib/causal-world";

const openaiMock = vi.hoisted(() => ({
  client: null as null | {
    responses: {
      create?: (request?: { input?: string }) => Promise<unknown>;
      parse?: (request?: { input?: string }) => Promise<unknown>;
    };
  },
}));

vi.mock("../src/lib/ai/client", () => ({
  getOpenAIClient: () => openaiMock.client,
}));

import {
  isAmbiguousLearnerAction,
  narrateWorldResponse,
  observeBehavior,
  updateHypothesis,
} from "../src/lib/ai/causal-pipeline";

function governedWorld(): CausalWorldVersion {
  return {
    world_id: "world-test",
    version: "1.0.0",
    target_habit: "premature_solution_commitment",
    domain: "test",
    governance_status: "approved",
    transfer_role: "calibration",
    trigger_statement: "A governed test world",
    visible_facts: [],
    relevance_terms: ["inspect", "scope", "summary"],
    available_actions: [],
    pressure_context: "test",
    immutable_rules: {
      model_forbidden_to_modify: true,
      hidden_facts: [{
        id: "fact-1",
        content: "Governed fact",
        reveal_condition_id: "condition-1",
        causal_significance: "test",
      }],
      causal_rules: [],
      role_interests: [],
      reveal_conditions: [{
        id: "condition-1",
        trigger: "inspect",
        aliases: ["what should this achieve"],
        reveals: ["fact-1"],
      }],
    },
    behavior_anchors: {
      premature_commitment: { level: 1, description: "test", observable_indicators: [], anti_examples: [] },
      adequate_investigation: { level: 3, description: "test", observable_indicators: [], anti_examples: [] },
      model_behavior: { level: 5, description: "test", observable_indicators: [], anti_examples: [] },
    },
    transfer_surface_differences: [],
    approved_by: null,
    source_references: [],
    created_at: "2026-08-04T00:00:00.000Z",
  };
}

function governedEvent(
  id: string,
  dimension: "workflow" | "consequence" | "alternative",
  text: string
): WorldEvent {
  return {
    id,
    run_id: "run-1",
    event_type: "user_action",
    sequence_index: 0,
    actor: "user",
    payload: { discovery_dimension: dimension, text },
    created_at: "2026-08-04T00:00:00.000Z",
  };
}

function governedDecision(evidenceBasis: string[]): DecisionEvent {
  return {
    id: "decision-1",
    run_id: "run-1",
    world_event_id: evidenceBasis[0] ?? "event-0",
    judgment: "先验证问题",
    chosen_action: "继续调查",
    expected_outcome: "降低不确定性",
    confidence: "medium",
    rejected_alternatives: ["立即开发"],
    evidence_basis: evidenceBasis,
    consequences_revealed: false,
    created_at: "2026-08-04T00:00:00.000Z",
  };
}

afterEach(() => {
  openaiMock.client = null;
});

describe("causal narrator failure boundaries", () => {
  it("treats a bare numeric input as clarification without calling the model", async () => {
    let requestCount = 0;
    openaiMock.client = {
      responses: {
        parse: async () => {
          requestCount += 1;
          return { output_parsed: null };
        },
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "1",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(isAmbiguousLearnerAction("1")).toBe(true);
    expect(requestCount).toBe(0);
    expect(result.response_type).toBe("clarification");
    expect(result.narration).toContain("不够明确");
  });

  it("passes server-approved reveals into the prompt and excludes hidden governance data", async () => {
    let capturedPrompt = "";
    const world = governedWorld();
    world.immutable_rules.hidden_facts.push({
      id: "secret-fact",
      content: "Hidden secret that must stay unavailable",
      reveal_condition_id: "never",
      causal_significance: "private",
    });
    openaiMock.client = {
      responses: {
        parse: async (request?: { input?: string }) => {
          capturedPrompt = request?.input ?? "";
          return {
            output_parsed: {
              response_type: "role_reply",
              narration: "报表使用频率低。",
              cited_fact_ids: ["fact-1"],
            },
          };
        },
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: world,
      userAction: "inspect",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(false);
    expect(capturedPrompt).toContain('"id": "fact-1"');
    expect(capturedPrompt).toContain("Governed fact");
    expect(capturedPrompt).not.toContain("Hidden secret that must stay unavailable");
    expect(capturedPrompt).not.toContain("reveal_conditions");
    expect(capturedPrompt).not.toContain("target_habit");
    expect(capturedPrompt).not.toContain("400 words");
  });

  it("falls back when the model cites a fact outside the allowed set", async () => {
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            response_type: "role_reply",
            narration: "角色回应了你的问题。",
            cited_fact_ids: ["fabricated-fact"],
          },
        }),
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "unrelated",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(true);
    expect(result.model_version).toBe("deterministic-v1");
    expect(result.revealed_fact_ids).toEqual([]);
  });

  it("falls back when the model returns an overlong narration", async () => {
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            response_type: "role_reply",
            narration: "长".repeat(221),
            cited_fact_ids: ["scenario-trigger"],
          },
        }),
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "调查当前情况",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(true);
    expect(result.model_version).toBe("deterministic-v1");
  });

  it("falls back deterministically when the model times out", async () => {
    openaiMock.client = {
      responses: {
        parse: async () => {
          const error = new Error("model request timed out");
          error.name = "AbortError";
          throw error;
        },
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "inspect",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(true);
    expect(result.model_version).toBe("deterministic-v1");
  });

  it("falls back deterministically when the model refuses or returns no parsed output", async () => {
    openaiMock.client = {
      responses: { parse: async () => ({ output_parsed: null, refusal: "cannot comply" }) },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "inspect",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(true);
    expect(result.model_version).toBe("deterministic-v1");
  });

  it("returns a governed fact for an alias when model parsing fails", async () => {
    openaiMock.client = {
      responses: { parse: async () => ({ output_parsed: null }) },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "Can you explain what should this achieve?",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(true);
    expect(result.response_type).toBe("role_reply");
    expect(result.revealed_fact_ids).toEqual(["fact-1"]);
    expect(result.narration).toBe("Governed fact");
  });

  it("accepts prefixed JSON from an OpenAI-compatible provider", async () => {
    openaiMock.client = {
      responses: {
        create: async () => ({
          output_text: `_type="role_reply", narration, cited_fact_ids.\n${JSON.stringify({
            response_type: "role_reply",
            narration: "The current scope is not defined yet.",
            cited_fact_ids: ["scenario-trigger"],
          })}`,
        }),
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "What scope should the summary cover?",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(false);
    expect(result.response_type).toBe("role_reply");
    expect(result.narration).toContain("scope");
  });

  it("keeps a relevant information-gap answer even if the provider labels it clarification", async () => {
    openaiMock.client = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            response_type: "clarification",
            narration: "目前还没有明确范围。你希望先确认展示目标还是使用场景？",
            cited_fact_ids: [],
          }),
        }),
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "What scope should the summary cover?",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(false);
    expect(result.response_type).toBe("role_reply");
    expect(result.cited_fact_ids).toEqual(["scenario-trigger"]);
    expect(result.narration).toContain("还没有明确范围");
  });

  it("gives a targeted information-gap reply for a relevant unmatched question", async () => {
    openaiMock.client = null;
    const world = governedWorld();
    world.available_actions = [
      { id: "goal", label: "澄清最终目标", category: "investigate" },
      { id: "data", label: "查看使用数据", category: "request_data" },
    ];

    const result = await narrateWorldResponse({
      worldVersion: world,
      userAction: "summary scope should include how much information?",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.response_type).toBe("role_reply");
    expect(result.narration).not.toContain("你可以继续调查");
    expect(result.narration).toContain("现有信息还不足");
  });

  it("accepts a concise clarification only for an unrelated question", async () => {
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            response_type: "clarification",
            narration: "这个问题与当前产品场景无关，请回到当前需求。",
            cited_fact_ids: [],
          },
        }),
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: governedWorld(),
      userAction: "今天天气怎么样",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(result.unofficial).toBe(false);
    expect(result.response_type).toBe("clarification");
    expect(result.revealed_fact_ids).toEqual([]);
    expect(result.state_changed).toBe(false);
  });

  it("does not expose model-supplied world rule overrides", async () => {
    const world = governedWorld();
    const originalRules = structuredClone(world.immutable_rules);
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            response_type: "role_reply",
            narration: "Attempted override",
            cited_fact_ids: ["fabricated-fact"],
            immutable_rules: { model_forbidden_to_modify: false },
          },
        }),
      },
    };

    const result = await narrateWorldResponse({
      worldVersion: world,
      userAction: "unrelated",
      eventHistory: [],
      revealedFactIds: [],
    });

    expect(world.immutable_rules).toEqual(originalRules);
    expect(result.revealed_fact_ids).toEqual([]);
    expect(result.state_changed).toBe(false);
    expect(result).not.toHaveProperty("immutable_rules");
  });
});

describe("behavior observer evidence governance", () => {
  it("rejects model confidence inflation and model-supplied dimensions", async () => {
    const workflow = governedEvent("event-workflow", "workflow", "先梳理当前工作流");
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            observations: [{
              behavior_code: "MODEL-CLAIM",
              description: "模型声称覆盖了全部维度",
              evidence_event_ids: [workflow.id],
              evidence_quotes: ["先梳理当前工作流"],
              dimension_covered: "alternative",
            }],
            missing_dimensions: [],
            assisted: false,
            confidence: "high",
            insufficient_reason: null,
          },
        }),
      },
    };

    const result = await observeBehavior({
      worldVersion: governedWorld(),
      decisionEvent: governedDecision([workflow.id]),
      eventHistory: [workflow],
      wasAssisted: false,
    });

    expect(result.confidence).toBe("low");
    expect(result.insufficient_reason).toContain("证据不足");
    expect(result.missing_dimensions).toEqual(["consequence", "alternative"]);
    expect(result.observations).toEqual([]);
  });

  it("rejects model-fabricated quotes while preserving structured event coverage", async () => {
    const workflow = governedEvent("event-workflow", "workflow", "先梳理当前工作流");
    const consequence = governedEvent("event-consequence", "consequence", "再确认业务后果");
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            observations: [
              {
                behavior_code: "WORKFLOW",
                description: "引用了未选择的事件",
                evidence_event_ids: [workflow.id],
                evidence_quotes: ["先梳理当前工作流"],
                dimension_covered: "workflow",
              },
              {
                behavior_code: "CONSEQUENCE",
                description: "补写了用户没有表达的证据",
                evidence_event_ids: [consequence.id],
                evidence_quotes: ["虚构的业务损失"],
                dimension_covered: "consequence",
              },
            ],
            missing_dimensions: [],
            assisted: false,
            confidence: "high",
            insufficient_reason: null,
          },
        }),
      },
    };

    const result = await observeBehavior({
      worldVersion: governedWorld(),
      decisionEvent: governedDecision([consequence.id]),
      eventHistory: [workflow, consequence],
      wasAssisted: false,
    });

    expect(result.confidence).toBe("low");
    expect(result.observations).toEqual([]);
    expect(result.missing_dimensions).toEqual(["workflow", "alternative"]);
  });
});

describe("hypothesis updater evidence governance", () => {
  it("cannot reverse the evidence-derived conclusion", async () => {
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            habit_name: "model-invented-habit",
            update_direction: "supports",
            updated_confidence: "high",
            rationale: "模型给出了相反结论",
            referenced_evidence_ids: ["event-workflow", "event-consequence", "event-alternative"],
            applicable_trigger_conditions: [],
            forbidden_inferences_confirmed: [],
          },
        }),
      },
    };

    const update = await updateHypothesis({
      habitName: "premature_solution_commitment",
      currentConfidence: "medium",
      currentTriggerConditions: [],
      behaviorObservation: {
        observations: [
          {
            behavior_code: "WORKFLOW",
            description: "调查工作流",
            evidence_event_ids: ["event-workflow"],
            evidence_quotes: ["工作流"],
            dimension_covered: "workflow",
          },
          {
            behavior_code: "CONSEQUENCE",
            description: "调查后果",
            evidence_event_ids: ["event-consequence"],
            evidence_quotes: ["后果"],
            dimension_covered: "consequence",
          },
          {
            behavior_code: "ALTERNATIVE",
            description: "调查替代方案",
            evidence_event_ids: ["event-alternative"],
            evidence_quotes: ["替代方案"],
            dimension_covered: "alternative",
          },
        ],
        missing_dimensions: [],
        assisted: false,
        confidence: "medium",
        insufficient_reason: null,
        model_version: "test-model",
      },
      worldId: "world-test",
      worldVersion: "1.0.0",
      isTransferWorld: false,
    });

    expect(update.habit_name).toBe("premature_solution_commitment");
    expect(update.update_direction).toBe("contradicts");
    expect(update.updated_confidence).toBe("low");
    expect(update.rationale).toContain("反驳");
  });
});
