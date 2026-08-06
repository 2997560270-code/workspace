import { cookies } from "next/headers";
import { DEV_USER, isDemoAuthAllowed, isLoggedIn, SESSION_COOKIE, type ProductDrillUser } from "./auth";
import { isSupabaseConfigured } from "./env";
import { createSupabaseServerClient } from "./supabase/server";

export async function getCurrentUser(): Promise<ProductDrillUser | null> {
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
