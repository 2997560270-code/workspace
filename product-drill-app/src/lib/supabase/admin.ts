import { createClient } from "@supabase/supabase-js";
import { runtimeEnv } from "../env";

export function createSupabaseAdminClient() {
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseServiceRoleKey) return null;
  return createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
