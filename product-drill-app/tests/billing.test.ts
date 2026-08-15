import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSubscription, PLANS, selectPlan } from "../src/lib/billing";

describe("billing preview", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  });

  it("provides explicit free, team and professional plans", () => {
    expect(PLANS.map((plan) => plan.id)).toEqual(["free", "team", "pro"]);
    expect(PLANS.every((plan) => plan.features.length > 0)).toBe(true);
  });

  it("stores a trial state for non-free plans without charging", () => {
    const subscription = selectPlan("user-1", "team");
    expect(subscription.status).toBe("trial");
    expect(loadSubscription("user-1")).toEqual(subscription);
  });
});
