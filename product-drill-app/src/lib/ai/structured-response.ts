import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

type StructuredResponse = {
  output_parsed?: unknown;
  output_text?: string;
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // OpenAI-compatible providers may prepend a short schema explanation.
    }
  }

  for (let start = trimmed.indexOf("{"); start >= 0; start = trimmed.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < trimmed.length; index += 1) {
      const char = trimmed[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Structured response did not contain valid JSON");
}

function validateStructuredOutput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("Structured response failed schema validation");
  return parsed.data;
}

export async function requestStructuredResponse<T>(params: {
  client: OpenAI;
  model: string;
  input: string;
  schema: z.ZodType<T>;
  schemaName: string;
  signal?: AbortSignal;
}): Promise<T> {
  const format = zodTextFormat(params.schema, params.schemaName);
  const options = params.signal ? { signal: params.signal } : undefined;
  const chat = params.client.chat?.completions as unknown as {
    create?: (input: unknown, options?: { signal?: AbortSignal }) => Promise<ChatResponse>;
  } | undefined;

  // DeepSeek's OpenAI-compatible Chat Completions JSON mode is materially
  // faster than its Responses structured-output path for the long evidence
  // prompts used here. Keep the Responses fallback for test doubles and
  // compatible clients that do not expose chat completions.
  if (typeof chat?.create === "function") {
    const response = await chat.create({
      model: params.model,
      messages: [
        {
          role: "system",
          content: "Return exactly one valid JSON object. Do not use Markdown or explanatory text.",
        },
        {
          role: "user",
          content: `${params.input}\n\nReturn JSON conforming to this schema:\n${JSON.stringify(format.schema)}`,
        },
      ],
      response_format: { type: "json_object" },
    }, options);
    const outputText = response.choices?.[0]?.message?.content?.trim();
    if (!outputText) throw new Error("Structured chat response was empty");
    return validateStructuredOutput(params.schema, extractJsonObject(outputText));
  }

  const request = {
    model: params.model,
    input: params.input,
    text: { format },
  };
  const responses = params.client.responses as unknown as {
    create?: (input: unknown, options?: { signal?: AbortSignal }) => Promise<StructuredResponse>;
    parse?: (input: unknown, options?: { signal?: AbortSignal }) => Promise<StructuredResponse>;
  };
  const response = typeof responses.create === "function"
    ? await responses.create(request, options)
    : typeof responses.parse === "function"
      ? await responses.parse(request, options)
      : null;

  if (!response) throw new Error("Structured response API is unavailable");
  if (response.output_parsed !== undefined) {
    return validateStructuredOutput(params.schema, response.output_parsed);
  }
  if (response.output_text) {
    return validateStructuredOutput(params.schema, extractJsonObject(response.output_text));
  }
  throw new Error("Structured response was empty");
}
