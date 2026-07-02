import { describe, expect, it } from "vitest";
import { DEV_USER, isLoggedIn, SESSION_COOKIE } from "../../src/features/auth/auth";

describe("auth migration", () => {
  it("keeps the demo session foundation for MVP development", () => {
    expect(SESSION_COOKIE).toBe("product_drill_user");
    expect(isLoggedIn(DEV_USER.id)).toBe(true);
    expect(isLoggedIn("other-user")).toBe(false);
  });
});
