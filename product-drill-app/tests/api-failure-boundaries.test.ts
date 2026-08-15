import { describe, expect, it } from "vitest";
import {
  AppendActionBodySchema,
  prepareLearnerEventPayload,
} from "../src/lib/api/challenge-schemas";
import { parseJsonBody } from "../src/lib/api/server";

describe("API failure boundaries", () => {
  it("turns malformed JSON into a validation failure", async () => {
    const request = new Request("http://localhost/api/challenge-runs/run-1/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-valid-json",
    });

    const body = await parseJsonBody(request);

    expect(body).toBeNull();
    expect(AppendActionBodySchema.safeParse(body).success).toBe(false);
  });

  it("removes discovery dimensions from ambiguous learner input", () => {
    const payload = prepareLearnerEventPayload(
      { text: "1", discovery_dimension: "workflow" },
      true
    );

    expect(payload).toEqual({ text: "1", input_status: "ambiguous" });
    expect(payload).not.toHaveProperty("discovery_dimension");
  });

  it("preserves structured discovery input", () => {
    const payload = prepareLearnerEventPayload(
      { text: "调查当前工作流", discovery_dimension: "workflow" },
      false
    );

    expect(payload.discovery_dimension).toBe("workflow");
  });

  it("removes discovery dimensions when no new world fact was revealed", () => {
    const payload = prepareLearnerEventPayload(
      { text: "询问当前流程", discovery_dimension: "workflow" },
      true,
      "no_new_fact"
    );

    expect(payload).toEqual({ text: "询问当前流程", input_status: "no_new_fact" });
  });
});
