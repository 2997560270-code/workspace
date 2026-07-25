export const runtimeEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  roleplayModel: process.env.OPENAI_ROLEPLAY_MODEL ?? "gpt-5.6-luna",
  evaluationModel: process.env.OPENAI_EVALUATION_MODEL ?? "gpt-5.6-terra",
  modelVersion: process.env.OPENAI_MODEL_VERSION ?? "unconfigured",
  rubricVersion: process.env.RUBRIC_VERSION ?? "direction-a-v1",
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development"
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(runtimeEnv.supabaseUrl && runtimeEnv.supabaseAnonKey);
}

export function isOpenAIConfigured(): boolean {
  return Boolean(runtimeEnv.openaiApiKey);
}

export function isPostHogConfigured(): boolean {
  return Boolean(runtimeEnv.posthogKey);
}

export function isSentryConfigured(): boolean {
  return Boolean(runtimeEnv.sentryDsn);
}
