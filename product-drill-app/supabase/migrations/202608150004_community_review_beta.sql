-- Phase 3: anonymous review pool, conflict-aware random assignment and preserved disagreement.
create table if not exists public.review_pool_entries (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.validation_cohorts(id) on delete cascade,
  subject_user_id uuid references auth.users(id) on delete set null,
  decision_event_id text references public.decision_events(id) on delete cascade,
  anchor_case_id uuid references public.anchor_cases(id) on delete restrict,
  anonymized_subject_id text not null unique check (anonymized_subject_id ~ '^subject-[A-Z0-9]{10}$'),
  conflict_group text,
  status text not null default 'ready' check (status in ('ready','exhausted','paused','retired')),
  created_at timestamptz not null default now(),
  check ((decision_event_id is not null)::integer + (anchor_case_id is not null)::integer = 1)
);

create table if not exists public.reviewer_conflicts (
  cohort_id uuid not null references public.validation_cohorts(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  conflict_group text not null,
  declared_at timestamptz not null default now(),
  primary key (cohort_id, reviewer_id, conflict_group)
);

create table if not exists public.blind_review_aggregates (
  id uuid primary key default gen_random_uuid(),
  pool_entry_id uuid not null references public.review_pool_entries(id) on delete cascade,
  engine text not null check (engine in ('ai','deterministic')),
  model_version text not null,
  rubric_summary jsonb not null,
  disagreement jsonb not null,
  raw_review_ids jsonb not null default '[]',
  status text not null default 'provisional' check (status in ('provisional','needs_re_review','approved','discarded')),
  created_at timestamptz not null default now(),
  unique (pool_entry_id, created_at)
);

alter table public.blind_review_assignments add column if not exists pool_entry_id uuid references public.review_pool_entries(id) on delete cascade;

alter table public.review_pool_entries enable row level security;
alter table public.reviewer_conflicts enable row level security;
alter table public.blind_review_aggregates enable row level security;

create policy "admins manage review pool" on public.review_pool_entries for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins manage reviewer conflicts" on public.reviewer_conflicts for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "reviewers declare own conflicts" on public.reviewer_conflicts for insert with check (reviewer_id = auth.uid());
create policy "admins manage review aggregates" on public.blind_review_aggregates for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));

create index if not exists idx_review_pool_cohort_status on public.review_pool_entries(cohort_id, status, created_at);
create index if not exists idx_reviewer_conflicts on public.reviewer_conflicts(cohort_id, reviewer_id);
create index if not exists idx_review_aggregates_pool on public.blind_review_aggregates(pool_entry_id, created_at desc);
create unique index if not exists idx_blind_assignment_reviewer_pool on public.blind_review_assignments(cohort_id, reviewer_id, pool_entry_id) where pool_entry_id is not null;
