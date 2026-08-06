import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { requestStructuredResponse } from "../src/lib/ai/structured-response";

describe("structured response compatibility", () => {
  it("prefers Chat Completions JSON mode and validates prefixed JSON", async () => {
    const createChat = vi.fn(async () => ({
      choices: [{
        message: {
          content: `Here is the requested object:\n${JSON.stringify({ ok: true, value: "ready" })}`,
        },
      }],
    }));
    const createResponses = vi.fn();
    const client = {
      chat: { completions: { create: createChat } },
      responses: { create: createResponses },
    } as never;

    const result = await requestStructuredResponse({
      client,
      model: "deepseek-v4-flash",
      input: "Return the probe result.",
      schema: z.object({ ok: z.boolean(), value: z.string() }),
      schemaName: "probe",
    });

    expect(result).toEqual({ ok: true, value: "ready" });
    expect(createChat).toHaveBeenCalledOnce();
    expect(createResponses).not.toHaveBeenCalled();
  });
});
