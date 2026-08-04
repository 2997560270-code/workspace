import { afterEach, describe, expect, it, vi } from "vitest";
import type { CausalWorldVersion } from "../src/lib/causal-world";

const openaiMock = vi.hoisted(() => ({
  client: null as null | { responses: { parse: () => Promise<unknown> } },
}));

vi.mock("../src/lib/ai/client", () => ({
  getOpenAIClient: () => openaiMock.client,
}));

import { narrateWorldResponse } from "../src/lib/ai/causal-pipeline";

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
      reveal_conditions: [{ id: "condition-1", trigger: "inspect", reveals: ["fact-1"] }],
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

afterEach(() => {
  openaiMock.client = null;
});

describe("causal narrator failure boundaries", () => {
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

  it("does not expose model-supplied world rule overrides", async () => {
    const world = governedWorld();
    const originalRules = structuredClone(world.immutable_rules);
    openaiMock.client = {
      responses: {
        parse: async () => ({
          output_parsed: {
            narration: "Attempted override",
            revealed_fact_ids: ["fabricated-fact"],
            state_changed: true,
            state_change_summary: "Attempted override",
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
