import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminMock, isOpenAIConfiguredMock, rpcMock } = vi.hoisted(() => ({
  createAdminMock: vi.fn(),
  isOpenAIConfiguredMock: vi.fn(),
  rpcMock: vi.fn()
}));

vi.mock("../src/lib/env", () => ({
  isOpenAIConfigured: isOpenAIConfiguredMock
}));

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createAdminMock
}));

import { consumeModelRateLimit } from "../src/lib/security/rate-limit";

const supabaseUser = {
  id: "53b7b7cb-1a6f-45d2-8f3f-07118d399b4e",
  name: "Test User",
  email: "test@example.com",
  source: "supabase" as const
};

const demoUser = {
  id: "demo-user",
  name: "Demo User",
  email: "demo@productdrill.local",
  source: "demo" as const
};

describe("model rate limits", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createAdminMock.mockReset();
    isOpenAIConfiguredMock.mockReset();
    isOpenAIConfiguredMock.mockReturnValue(true);
    createAdminMock.mockReturnValue({ rpc: rpcMock });
  });

  it("bypasses database quota consumption for the controlled demo identity", async () => {
    await expect(consumeModelRateLimit(demoUser, "roleplay")).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0
    });
    expect(createAdminMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does not consume paid-model quota when OpenAI is not configured", async () => {
    isOpenAIConfiguredMock.mockReturnValue(false);
    await expect(consumeModelRateLimit(supabaseUser, "evaluation")).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0
    });
    expect(createAdminMock).not.toHaveBeenCalled();
  });

  it("atomically consumes minute and daily windows for a Supabase user", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    await expect(consumeModelRateLimit(supabaseUser, "evaluation")).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0
    });
    expect(rpcMock).toHaveBeenNthCalledWith(1, "consume_rate_limit", {
      p_user_id: supabaseUser.id,
      p_bucket: "model:evaluation:minute",
      p_window_seconds: 60,
      p_max_requests: 10
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "consume_rate_limit", {
      p_user_id: supabaseUser.id,
      p_bucket: "model:evaluation:day",
      p_window_seconds: 86_400,
      p_max_requests: 100
    });
  });

  it("denies an exhausted minute window without consuming the daily window", async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null });

    const result = await consumeModelRateLimit(supabaseUser, "roleplay");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("denies an exhausted daily window", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    const result = await consumeModelRateLimit(supabaseUser, "retry");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(86_400);
  });

  it("fails closed when the shared limiter backend errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } });

    await expect(consumeModelRateLimit(supabaseUser, "roleplay")).rejects.toThrow(/rate limit backend failed/i);
  });

  it("fails closed when the service-role client is unavailable", async () => {
    createAdminMock.mockReturnValue(null);

    await expect(consumeModelRateLimit(supabaseUser, "roleplay")).rejects.toThrow(/rate limit backend is unavailable/i);
  });
});
