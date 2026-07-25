import { PostHog } from "posthog-node";
import { runtimeEnv } from "../env";
import { sanitizeAnalyticsProperties, type AnalyticsEvent, type SafeAnalyticsProperties } from "./events";

let client: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (!runtimeEnv.posthogKey) return null;
  client ??= new PostHog(runtimeEnv.posthogKey, { host: runtimeEnv.posthogHost, flushAt: 1, flushInterval: 0 });
  return client;
}

export async function trackServerEvent(distinctId: string, event: AnalyticsEvent, properties: SafeAnalyticsProperties = {}) {
  const posthog = getPostHog();
  if (!posthog) return;
  posthog.capture({ distinctId, event, properties: sanitizeAnalyticsProperties(properties) });
  await posthog.flush();
}
