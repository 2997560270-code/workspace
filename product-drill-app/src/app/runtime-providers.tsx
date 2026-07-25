"use client";

import { useEffect, type ReactNode } from "react";
import { initClientAnalytics } from "../lib/analytics/client";

export function RuntimeProviders({ children }: { children: ReactNode }) {
  useEffect(() => { initClientAnalytics(); }, []);
  return children;
}
