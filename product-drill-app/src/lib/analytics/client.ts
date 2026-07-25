"use client";

import posthog from "posthog-js";
import { sanitizeAnalyticsProperties, type AnalyticsEvent, type SafeAnalyticsProperties } from "./events";

export function initClientAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || posthog.__loaded) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
    loaded: (client) => {
      if (process.env.NODE_ENV !== "production") client.debug(false);
    }
  });
}

export function trackClientEvent(event: AnalyticsEvent, properties: SafeAnalyticsProperties = {}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, sanitizeAnalyticsProperties(properties));
}
