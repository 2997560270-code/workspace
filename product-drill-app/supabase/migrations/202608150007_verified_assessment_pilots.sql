-- Phase 6: partner-only verified assessment pilots with human review boundaries.
create table if not exists public.verified_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 200),
  status text not null default 'pending' check (status in ('pending','approved','suspended','closed')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.verified_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.verified_organizations(id) on delete restrict,
  assessment_run_id uuid not null references public.assessment_runs(id) on delete restrict,
  participant_id uuid not null references auth.users(id) on delete cascade,
  identity_status text not null default 'pending_manual' check (identity_status in ('pending_manual','verified','failed','waived')),
  environment_status text not null default 'pending' check (environment_status in ('pending','recorded','exception')),
  process_status text not null default 'in_progress' check (process_status in ('in_progress','completed','exception')),
  human_review_status text not null default 'not_started' check (human_review_status in ('not_started','queued','reviewing','cleared','flagged')),
  consent_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.verified_process_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.verified_assessment_sessions(id) on delete cascade,
  event_type text not null check (event_type in ('identity_check','environment_recorded','item_started','item_submitted','pause','resume','exception','human_review')),
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table if not exists public.verified_assessment_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.verified_assessment_sessions(id) on delete cascade,
  judgment_level text not null check (judgment_level in ('insufficient_evidence','emerging','consistent','strong')),
  confidence_interval jsonb not null,
  limitations jsonb not null default '[]',
  usage_status text not null default 'pilot_only' check (usage_status in ('pilot_only','internal_review','approved_limited','withdrawn')),
  created_at timestamptz not null default now()
);

create table if not exists public.verified_human_review_cases (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.verified_assessment_sessions(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  reason text not null,
  decision text not null default 'open' check (decision in ('open','cleared','flagged','withdrawn')),
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.verified_organizations enable row level security;
alter table public.verified_assessment_sessions enable row level security;
alter table public.verified_process_events enable row level security;
alter table public.verified_assessment_reports enable row level security;
alter table public.verified_human_review_cases enable row level security;

create policy "approved organizations readable" on public.verified_organizations for select using (status = 'approved' or public.is_platform_admin(auth.uid()));
create policy "admins manage organizations" on public.verified_organizations for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "participants read own verified sessions" on public.verified_assessment_sessions for select using (participant_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "admins manage verified sessions" on public.verified_assessment_sessions for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "participants append own process events" on public.verified_process_events for insert with check (exists (select 1 from public.verified_assessment_sessions s where s.id = session_id and s.participant_id = auth.uid()));
create policy "participants read own process events" on public.verified_process_events for select using (exists (select 1 from public.verified_assessment_sessions s where s.id = session_id and s.participant_id = auth.uid()) or public.is_platform_admin(auth.uid()));
create policy "participants read own verified reports" on public.verified_assessment_reports for select using (exists (select 1 from public.verified_assessment_sessions s where s.id = session_id and s.participant_id = auth.uid()) or public.is_platform_admin(auth.uid()));
create policy "admins manage verified reports" on public.verified_assessment_reports for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins manage human review cases" on public.verified_human_review_cases for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));

create index if not exists idx_verified_org_status on public.verified_organizations(status, created_at desc);
create index if not exists idx_verified_sessions_participant on public.verified_assessment_sessions(participant_id, process_status, started_at desc);
create index if not exists idx_verified_events_session on public.verified_process_events(session_id, occurred_at);
create index if not exists idx_verified_review_cases_status on public.verified_human_review_cases(decision, created_at desc);
