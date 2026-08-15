-- Phase 5: controlled standardized assessment research, isolated from training and community pools.
create table if not exists public.assessment_blueprints (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  version text not null,
  rubric_version text not null,
  competency_matrix jsonb not null,
  stage_order jsonb not null,
  status text not null default 'draft' check (status in ('draft','pilot','retired')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (role_key, version)
);

create table if not exists public.assessment_item_pools (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid references public.assessment_blueprints(id) on delete cascade,
  pool_kind text not null check (pool_kind in ('training','experiment','assessment','anchor')),
  item_key text not null,
  prompt_snapshot jsonb not null,
  rubric_snapshot jsonb not null,
  governance_status text not null default 'draft' check (governance_status in ('draft','approved','retired')),
  created_at timestamptz not null default now(),
  unique (pool_kind, item_key)
);

create table if not exists public.assessment_runs (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.assessment_blueprints(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'pilot' check (mode in ('pilot','verified')),
  item_order jsonb not null,
  current_index integer not null default 0 check (current_index >= 0),
  status text not null default 'in_progress' check (status in ('in_progress','submitted','reviewing','reported','withdrawn')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.assessment_runs(id) on delete cascade,
  item_key text not null,
  response jsonb not null,
  stage text not null check (stage in ('independent_judgment','ai_work_sample','anchor_check')),
  submitted_at timestamptz not null default now(),
  unique (run_id, item_key)
);

create table if not exists public.assessment_evaluations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.assessment_runs(id) on delete cascade,
  item_key text not null,
  evaluator_type text not null check (evaluator_type in ('human','ai','deterministic')),
  score numeric not null check (score between 0 and 1),
  evidence jsonb not null default '{}',
  confidence numeric not null default 0 check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.assessment_runs(id) on delete cascade,
  independent_score numeric not null check (independent_score between 0 and 1),
  work_sample_score numeric check (work_sample_score between 0 and 1),
  confidence_interval jsonb not null,
  limitations jsonb not null default '[]',
  report_status text not null default 'diagnostic_only' check (report_status in ('diagnostic_only','pilot_review','withdrawn')),
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_fairness_metrics (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.assessment_blueprints(id) on delete cascade,
  cohort_label text not null,
  sample_size integer not null check (sample_size >= 0),
  mean_score numeric,
  completion_rate numeric check (completion_rate between 0 and 1),
  adverse_difference numeric,
  metadata jsonb not null default '{}',
  measured_at timestamptz not null default now()
);

alter table public.assessment_blueprints enable row level security;
alter table public.assessment_item_pools enable row level security;
alter table public.assessment_runs enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_evaluations enable row level security;
alter table public.assessment_reports enable row level security;
alter table public.assessment_fairness_metrics enable row level security;

create policy "approved blueprints readable" on public.assessment_blueprints for select using (status in ('pilot') or public.is_platform_admin(auth.uid()));
create policy "admins manage blueprints" on public.assessment_blueprints for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins manage assessment pools" on public.assessment_item_pools for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "users read own assessment runs" on public.assessment_runs for select using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "users start own assessment runs" on public.assessment_runs for insert with check (user_id = auth.uid());
create policy "users read own assessment responses" on public.assessment_responses for select using (exists (select 1 from public.assessment_runs r where r.id = run_id and r.user_id = auth.uid()) or public.is_platform_admin(auth.uid()));
create policy "users submit own assessment responses" on public.assessment_responses for insert with check (exists (select 1 from public.assessment_runs r where r.id = run_id and r.user_id = auth.uid()));
create policy "admins manage assessment evaluations" on public.assessment_evaluations for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "users read own reports" on public.assessment_reports for select using (exists (select 1 from public.assessment_runs r where r.id = run_id and r.user_id = auth.uid()) or public.is_platform_admin(auth.uid()));
create policy "admins manage reports" on public.assessment_reports for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins manage fairness metrics" on public.assessment_fairness_metrics for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));

create index if not exists idx_assessment_pools_blueprint_kind on public.assessment_item_pools(blueprint_id, pool_kind, governance_status);
create index if not exists idx_assessment_runs_user_status on public.assessment_runs(user_id, status, started_at desc);
create index if not exists idx_assessment_responses_run on public.assessment_responses(run_id, submitted_at);
create index if not exists idx_assessment_fairness_blueprint on public.assessment_fairness_metrics(blueprint_id, measured_at desc);
