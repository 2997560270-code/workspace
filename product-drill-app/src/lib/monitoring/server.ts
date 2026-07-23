import * as Sentry from "@sentry/nextjs";

const SENSITIVE_KEYS = new Set(["content", "message", "messages", "prompt", "reply", "answer", "email", "authorization", "cookie", "token"]);
const MAX_SCRUB_DEPTH = 4;

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_SCRUB_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, nested]) => [key, scrubValue(nested, depth + 1)])
  );
}

export function scrubProperties(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  return scrubValue(input, 0) as Record<string, unknown>;
}

export function captureServerException(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: scrubProperties(context) });
}
