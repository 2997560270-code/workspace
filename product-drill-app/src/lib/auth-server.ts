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
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return isLoggedIn(session) ? { ...DEV_USER, source: "demo" } : null;
}
