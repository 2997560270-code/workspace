import type { ProductDrillUser } from "../auth";
import { isOpenAIConfigured } from "../env";
import { createSupabaseAdminClient } from "../supabase/admin";

export type ModelRateLimitOperation = "roleplay" | "evaluation" | "retry";

export type ModelRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type OperationLimit = {
  minute: number;
  day: number;
};

const WINDOW_SECONDS = {
  minute: 60,
  day: 86_400
} as const;

const OPERATION_LIMITS: Record<ModelRateLimitOperation, OperationLimit> = {
  roleplay: { minute: 30, day: 300 },
  evaluation: { minute: 10, day: 100 },
  retry: { minute: 20, day: 200 }
};

function secondsUntilReset(windowSeconds: number, now = Date.now()): number {
  const elapsed = Math.floor(now / 1000) % windowSeconds;
  return elapsed === 0 ? windowSeconds : windowSeconds - elapsed;
}

export async function consumeModelRateLimit(
  user: ProductDrillUser,
  operation: ModelRateLimitOperation
): Promise<ModelRateLimitResult> {
  if (user.source === "demo" || !isOpenAIConfigured()) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Model rate limit backend is unavailable");

  const limits = OPERATION_LIMITS[operation];
  const minuteResult = await admin.rpc("consume_rate_limit", {
    p_user_id: user.id,
    p_bucket: `model:${operation}:minute`,
    p_window_seconds: WINDOW_SECONDS.minute,
    p_max_requests: limits.minute
  });
  if (minuteResult.error) throw new Error("Model rate limit backend failed");
  if (typeof minuteResult.data !== "boolean") throw new Error("Model rate limit backend returned an invalid response");
  if (!minuteResult.data) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilReset(WINDOW_SECONDS.minute)
    };
  }

  const dailyResult = await admin.rpc("consume_rate_limit", {
    p_user_id: user.id,
    p_bucket: `model:${operation}:day`,
    p_window_seconds: WINDOW_SECONDS.day,
    p_max_requests: limits.day
  });
  if (dailyResult.error) throw new Error("Model rate limit backend failed");
  if (typeof dailyResult.data !== "boolean") throw new Error("Model rate limit backend returned an invalid response");
  if (!dailyResult.data) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilReset(WINDOW_SECONDS.day)
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
