-- Phase 2/3: invitation-only validation and blind review foundations.
create table if not exists public.validation_cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{10}$'),
  status text not null default 'draft' check (status in ('draft','recruiting','active','closed')),
  created_by uuid not null references auth.users(id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.validation_participants (
  cohort_id uuid not null references public.validation_cohorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null check (participant_role in ('target_user','pm_reviewer','hiring_reviewer','researcher')),
  status text not null default 'invited' check (status in ('invited','active','completed','withdrawn')),
  consent_version text,
  consented_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

create table if not exists public.anchor_cases (
  id uuid primary key default gen_random_uuid(),
  world_id text not null references public.causal_worlds(id),
  world_version text not null,
  response_snapshot jsonb not null,
  expected_claims jsonb not null,
  governance_status text not null default 'draft' check (governance_status in ('draft','review','approved','retired')),
  hidden boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (world_id, world_version) references public.causal_world_versions(world_id, version)
);

create table if not exists public.blind_review_assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.validation_cohorts(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  decision_event_id text references public.decision_events(id) on delete cascade,
  anchor_case_id uuid references public.anchor_cases(id) on delete restrict,
  anonymized_subject_id text not null,
  status text not null default 'assigned' check (status in ('assigned','opened','submitted','expired')),
  conflict_declared boolean not null default false,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  check ((decision_event_id is not null)::integer + (anchor_case_id is not null)::integer = 1)
);

create table if not exists public.blind_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.blind_review_assignments(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rubric jsonb not null,
  evidence_ids jsonb not null default '[]',
  reason text not null check (length(trim(reason)) between 20 and 4000),
  confidence text not null check (confidence in ('high','medium','low')),
  submitted_at timestamptz not null default now()
);

create table if not exists public.validation_measurements (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.validation_cohorts(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  metric_type text not null check (metric_type in ('repeatability','user_understanding','provisional_transfer','reviewer_agreement')),
  value numeric not null,
  metadata jsonb not null default '{}',
  measured_at timestamptz not null default now()
);

alter table public.validation_cohorts enable row level security;
alter table public.validation_participants enable row level security;
alter table public.anchor_cases enable row level security;
alter table public.blind_review_assignments enable row level security;
alter table public.blind_reviews enable row level security;
alter table public.validation_measurements enable row level security;

create policy "admins manage validation cohorts" on public.validation_cohorts for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "participants read own cohorts" on public.validation_cohorts for select using (exists (select 1 from public.validation_participants p where p.cohort_id = id and p.user_id = auth.uid()));
create policy "participants read own membership" on public.validation_participants for select using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "admins manage participants" on public.validation_participants for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins manage hidden anchors" on public.anchor_cases for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "reviewers read own assignments" on public.blind_review_assignments for select using (reviewer_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "admins manage assignments" on public.blind_review_assignments for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "reviewers submit own review" on public.blind_reviews for insert with check (reviewer_id = auth.uid() and exists (select 1 from public.blind_review_assignments a where a.id = assignment_id and a.reviewer_id = auth.uid() and a.status in ('assigned','opened')));
create policy "reviewers read own review" on public.blind_reviews for select using (reviewer_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "participants read own measurements" on public.validation_measurements for select using (participant_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "admins record measurements" on public.validation_measurements for insert with check (public.is_platform_admin(auth.uid()));

create index if not exists idx_validation_participants_user on public.validation_participants(user_id, status);
create index if not exists idx_blind_assignments_reviewer on public.blind_review_assignments(reviewer_id, status, assigned_at);
create index if not exists idx_validation_measurements_cohort on public.validation_measurements(cohort_id, metric_type, measured_at);
