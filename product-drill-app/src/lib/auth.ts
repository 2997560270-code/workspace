export const SESSION_COOKIE = "product_drill_user";

export const DEV_USER = {
  id: "demo-user",
  name: "张明",
  email: "demo@productdrill.local"
};

export function isLoggedIn(sessionValue: string | undefined): boolean {
  return sessionValue === DEV_USER.id;
}
