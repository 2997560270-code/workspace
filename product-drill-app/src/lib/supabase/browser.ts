import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, runtimeEnv } from "../env";

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseAnonKey);
}
