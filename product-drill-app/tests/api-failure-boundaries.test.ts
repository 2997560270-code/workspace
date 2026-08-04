import { describe, expect, it } from "vitest";
import { AppendActionBodySchema } from "../src/lib/api/challenge-schemas";
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
});
