# Release checklist

- Direction A core loop remains intact.
- Unit tests, TypeScript, build, and Playwright pass.
- Keyboard flow and accessible names cover changed interactions.
- Supabase migration is forward-safe and has rollback SQL or a documented restore plan.
- RLS isolates users and service credentials never reach the client.
- OpenAI failure, timeout, invalid output, and fallback behavior are tested.
- Golden evaluation regression meets thresholds.
- Changed funnel steps emit approved PostHog event names without message content.
- Sentry scrubbing removes prompts, message content, email, tokens, and auth headers.
- High-severity Codex Security findings are resolved.
- Preview environment is manually verified before production.
