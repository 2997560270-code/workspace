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

  it("classifies provider request failures", async () => {
    const client = {
      chat: { completions: { create: async () => { throw new Error("timeout"); } } },
      responses: {},
    } as never;

    await expect(requestStructuredResponse({
      client,
      model: "test-model",
      input: "Return the probe result.",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "probe",
    })).rejects.toMatchObject({
      name: "StructuredResponseError",
      reason: "request_failed",
    });
  });

  it("classifies malformed JSON and schema failures separately", async () => {
    const malformedClient = {
      chat: { completions: { create: async () => ({ choices: [{ message: { content: "not json" } }] }) } },
      responses: {},
    } as never;
    await expect(requestStructuredResponse({
      client: malformedClient,
      model: "test-model",
      input: "Return the probe result.",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "probe",
    })).rejects.toMatchObject({ reason: "response_parse_failed" });

    const invalidSchemaClient = {
      chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ ok: "yes" }) } }] }) } },
      responses: {},
    } as never;
    await expect(requestStructuredResponse({
      client: invalidSchemaClient,
      model: "test-model",
      input: "Return the probe result.",
      schema: z.object({ ok: z.boolean() }),
      schemaName: "probe",
    })).rejects.toMatchObject({ reason: "schema_validation_failed" });
  });
});
