import { describe, expect, it } from "vitest";
import { DEV_USER, SESSION_COOKIE, isDemoAuthAllowed, isLoggedIn, translateAuthError } from "../src/lib/auth";

describe("auth foundation", () => {
  it("uses one named session cookie for the demo user", () => {
    expect(SESSION_COOKIE).toBe("product_drill_user");
    expect(DEV_USER).toEqual({
      id: "demo-user",
      name: "张明",
      email: "demo@productdrill.local"
    });
  });

  it("accepts only the demo user id as a logged-in session", () => {
    expect(isLoggedIn("demo-user")).toBe(true);
    expect(isLoggedIn("")).toBe(false);
    expect(isLoggedIn("someone-else")).toBe(false);
  });

  it("keeps demo auth disabled in production unless explicitly enabled for E2E", () => {
    expect(isDemoAuthAllowed("production", undefined)).toBe(false);
    expect(isDemoAuthAllowed("production", "true")).toBe(true);
    expect(isDemoAuthAllowed("development", undefined)).toBe(true);
  });

  it("translates common Supabase auth errors to Chinese", () => {
    expect(translateAuthError("Invalid login credentials")).toBe("邮箱或密码不正确，请重试。");
    expect(translateAuthError("User already registered")).toBe("该邮箱已注册，请直接登录。");
    expect(translateAuthError("Email not confirmed")).toBe("邮箱尚未验证，请先查收验证邮件。");
    expect(translateAuthError("Password should be at least 8 characters")).toBe("密码长度不足，请至少使用 8 位。");
    expect(translateAuthError("Email rate limit exceeded")).toBe("操作过于频繁，请稍后再试。");
  });

  it("returns the original message when no friendly mapping exists", () => {
    expect(translateAuthError("Some unknown error")).toBe("Some unknown error");
  });
});
