import { cookies } from "next/headers";
import { DEV_USER, isDemoAuthAllowed, isLoggedIn, SESSION_COOKIE, type ProductDrillUser } from "./auth";
import { isSupabaseConfigured } from "./env";
import { createSupabaseServerClient } from "./supabase/server";

export async function getCurrentUser(): Promise<ProductDrillUser | null> {
  // E2E isolated mode (set only by the Playwright test server): let the
  // isolated demo/e2e cookie enter the app even when Supabase is configured,
  // so login/app-shell specs run deterministically without a real account.
  // This flag is never set in production, so real users always use Supabase.
  if (process.env.E2E_ISOLATED_USERS === "true") {
    if (!isDemoAuthAllowed(process.env.NODE_ENV, process.env.ALLOW_DEMO_AUTH)) return null;
    const cookieStore = await cookies();
    const isolatedUserId = cookieStore.get("product_drill_e2e_user")?.value;
    const session = cookieStore.get(SESSION_COOKIE)?.value;
    const e2eOk = Boolean(isolatedUserId && /^e2e-[a-z0-9-]{8,80}$/i.test(isolatedUserId));
    if (!e2eOk && !isLoggedIn(session)) return null;
    return { ...DEV_USER, id: e2eOk ? isolatedUserId! : DEV_USER.id, source: "demo" };
  }

  if (isSupabaseConfigured()) {
    const client = await createSupabaseServerClient();
    const { data, error } = await client!.auth.getUser();
    if (error || !data.user?.email) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      name: String(data.user.user_metadata?.display_name ?? data.user.email.split("@")[0]),
      source: "supabase"
    };
  }

  if (!isDemoAuthAllowed(process.env.NODE_ENV, process.env.ALLOW_DEMO_AUTH)) return null;
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!isLoggedIn(session)) return null;
  const isolatedUserId = process.env.E2E_ISOLATED_USERS === "true"
    ? cookieStore.get("product_drill_e2e_user")?.value
    : undefined;
  const userId = isolatedUserId && /^e2e-[a-z0-9-]{8,80}$/i.test(isolatedUserId)
    ? isolatedUserId
    : DEV_USER.id;
  return { ...DEV_USER, id: userId, source: "demo" };
}
