import { describe, expect, it } from "vitest";
import { DEV_USER, SESSION_COOKIE, isDemoAuthAllowed, isLoggedIn } from "../src/lib/auth";

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
});
