export const SESSION_COOKIE = "product_drill_user";

export const DEV_USER = {
  id: "demo-user",
  name: "张明",
  email: "demo@productdrill.local"
};

export function isLoggedIn(sessionValue: string | undefined): boolean {
  return sessionValue === DEV_USER.id;
}

export function isDemoAuthAllowed(nodeEnv: string | undefined, allowDemoAuth: string | undefined): boolean {
  return nodeEnv !== "production" || allowDemoAuth === "true";
}

export type ProductDrillUser = {
  id: string;
  name: string;
  email: string;
  source: "supabase" | "demo";
};

/** Map common Supabase Auth error messages to user-friendly Chinese copy. */
export function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "邮箱或密码不正确，请重试。";
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("user already registered")
  ) {
    return "该邮箱已注册，请直接登录。";
  }
  if (normalized.includes("email not confirmed") || normalized.includes("confirm your email")) {
    return "邮箱尚未验证，请先查收验证邮件。";
  }
  if (normalized.includes("password") && normalized.includes("at least")) {
    return "密码长度不足，请至少使用 8 位。";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "操作过于频繁，请稍后再试。";
  }
  return message;
}
