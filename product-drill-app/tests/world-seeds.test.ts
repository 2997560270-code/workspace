import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CausalWorldVersionSchema } from "../src/lib/causal-world";
import {
  DEFAULT_WORLD_ID,
  DEMO_WORLDS,
  allowsPreDecisionHint,
  getNextDemoWorld,
  getNextIncompleteDemoWorld,
} from "../src/lib/world-seeds";

const EXPECTED_WORLD_IDS = [
  "world-1-ai-summary",
  "world-2-enterprise-renewal",
  "world-3-growth-decline",
];

describe("approved Phase 1 world seeds", () => {
  it("keeps the governed three-world progression deterministic", () => {
    expect(getNextDemoWorld(DEMO_WORLDS[0].world_id)?.world_id).toBe(DEMO_WORLDS[1].world_id);
    expect(getNextDemoWorld(DEMO_WORLDS[1].world_id)?.world_id).toBe(DEMO_WORLDS[2].world_id);
    expect(getNextDemoWorld(DEMO_WORLDS[2].world_id)).toBeUndefined();
    expect(getNextIncompleteDemoWorld([DEMO_WORLDS[0].world_id]).world_id).toBe(DEMO_WORLDS[1].world_id);
  });

  it("uses the three worlds approved in Issue #8", () => {
    expect(DEMO_WORLDS.map((world) => world.world_id)).toEqual(EXPECTED_WORLD_IDS);
    expect(DEFAULT_WORLD_ID).toBe("world-1-ai-summary");
    expect(DEMO_WORLDS.map((world) => world.transfer_role)).toEqual([
      "calibration",
      "intervention",
      "transfer_test",
    ]);
  });

  it("validates every immutable governed version", () => {
    for (const world of DEMO_WORLDS) {
      expect(CausalWorldVersionSchema.safeParse(world.version).success).toBe(true);
      expect(world.version.version).toBe("2.0.0");
      expect(world.version.target_habit).toBe("premature_solution_commitment");
      expect(world.version.governance_status).toBe("approved");
      expect(world.version.approved_by).toBe("product-owner");
      expect(world.version.immutable_rules.model_forbidden_to_modify).toBe(true);
      expect(world.version.immutable_rules.hidden_facts).toHaveLength(5);
      expect(world.version.immutable_rules.causal_rules).toHaveLength(2);
      expect(world.version.available_actions.some((action) => action.category === "commit")).toBe(true);
    }
  });

  it("only reveals fact ids that exist in the immutable world snapshot", () => {
    for (const world of DEMO_WORLDS) {
      const factIds = new Set(
        world.version.immutable_rules.hidden_facts.map((fact) => fact.id)
      );
      for (const condition of world.version.immutable_rules.reveal_conditions) {
        expect(condition.reveals.every((factId) => factIds.has(factId))).toBe(true);
      }
    }
  });

  it("accepts governed natural-language aliases for investigation intent", () => {
    const worldOneConditions = DEMO_WORLDS[0].version.immutable_rules.reveal_conditions;
    const goalCondition = worldOneConditions.find((condition) => condition.id === "RC-1-05");

    expect(goalCondition?.aliases).toContain("希望达到怎样的效果");
    for (const world of DEMO_WORLDS) {
      expect(
        world.version.immutable_rules.reveal_conditions.some(
          (condition) => (condition.aliases?.length ?? 0) > 0
        )
      ).toBe(true);
    }
  });

  it("keeps the transfer world unprompted and surface-different", () => {
    const transferWorld = DEMO_WORLDS.find(
      (world) => world.transfer_role === "transfer_test"
    );
    expect(transferWorld?.world_id).toBe("world-3-growth-decline");
    expect(transferWorld?.version.pressure_context).toContain("不得提供决策前提示");
    expect(transferWorld?.version.transfer_surface_differences.length).toBeGreaterThan(0);
    expect(transferWorld && allowsPreDecisionHint(transferWorld)).toBe(false);
    expect(allowsPreDecisionHint(DEMO_WORLDS[0])).toBe(true);
  });
});

describe("approved worlds database migration", () => {
  const migration = readFileSync(
    "supabase/migrations/202608030001_approved_behavior_and_worlds.sql",
    "utf8"
  );

  it("adds every governed world without deleting old versions", () => {
    for (const worldId of EXPECTED_WORLD_IDS) expect(migration).toContain(worldId);
    expect(migration).toContain("model_forbidden_to_modify");
    expect(migration).toContain("governance_status = excluded.governance_status");
    expect(migration).toContain("on conflict (world_id, version) do nothing");
    expect(migration).not.toMatch(/delete from|drop table/i);
  });

  it("contains valid JSON in every dollar-quoted JSON block", () => {
    const blocks = [...migration.matchAll(/\$json\$([\s\S]*?)\$json\$::jsonb/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(9);
    for (const block of blocks) expect(() => JSON.parse(block[1])).not.toThrow();
  });
});
