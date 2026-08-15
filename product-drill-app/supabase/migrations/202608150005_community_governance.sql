-- Phase 4: reviewer quality, re-review routing, seasonal challenges and abuse controls.
create table if not exists public.review_quality_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.blind_reviews(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('helpful','unclear','harmful')),
  reason text not null check (length(trim(reason)) between 20 and 1000),
  created_at timestamptz not null default now(),
  unique (review_id, voter_id)
);

create table if not exists public.reviewer_reputation (
  cohort_id uuid not null references public.validation_cohorts(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  quality_score numeric not null default 0 check (quality_score between 0 and 1),
  review_count integer not null default 0 check (review_count >= 0),
  quality_vote_count integer not null default 0 check (quality_vote_count >= 0),
  status text not null default 'provisional' check (status in ('provisional','trusted','restricted','suspended')),
  updated_at timestamptz not null default now(),
  primary key (cohort_id, reviewer_id)
);

create table if not exists public.review_reroutes (
  id uuid primary key default gen_random_uuid(),
  pool_entry_id uuid not null references public.review_pool_entries(id) on delete cascade,
  aggregate_id uuid references public.blind_review_aggregates(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open','assigned','resolved','dismissed')),
  assigned_reviewer_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.seasonal_challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (length(trim(title)) between 2 and 160),
  description text not null check (length(trim(description)) between 10 and 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published','active','closed')),
  challenge_pool jsonb not null default '[]',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.seasonal_challenge_entries (
  challenge_id uuid not null references public.seasonal_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provisional_score numeric check (provisional_score between 0 and 1),
  status text not null default 'active' check (status in ('active','completed','flagged','withdrawn')),
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table if not exists public.training_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 20),
  reason text not null,
  source_review_id uuid unique references public.blind_reviews(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_anomaly_flags (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.validation_cohorts(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete cascade,
  challenge_id uuid references public.seasonal_challenges(id) on delete cascade,
  signal_type text not null check (signal_type in ('rate_limit','account_linkage','copy_pattern','conflict_bypass','quality_outlier')),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  evidence jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.review_quality_votes enable row level security;
alter table public.reviewer_reputation enable row level security;
alter table public.review_reroutes enable row level security;
alter table public.seasonal_challenges enable row level security;
alter table public.seasonal_challenge_entries enable row level security;
alter table public.training_credit_ledger enable row level security;
alter table public.review_anomaly_flags enable row level security;

create policy "reviewers submit quality votes" on public.review_quality_votes for insert with check (voter_id = auth.uid());
create policy "users read own quality votes" on public.review_quality_votes for select using (voter_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "admins manage reviewer reputation" on public.reviewer_reputation for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "reviewers read own reputation" on public.reviewer_reputation for select using (reviewer_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "admins manage reroutes" on public.review_reroutes for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "published challenges are readable" on public.seasonal_challenges for select using (status in ('published','active') or public.is_platform_admin(auth.uid()));
create policy "admins manage challenges" on public.seasonal_challenges for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "users read own challenge entries" on public.seasonal_challenge_entries for select using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "users enter challenges" on public.seasonal_challenge_entries for insert with check (user_id = auth.uid());
create policy "users read own credits" on public.training_credit_ledger for select using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "admins manage credits" on public.training_credit_ledger for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins manage anomaly flags" on public.review_anomaly_flags for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));

create index if not exists idx_quality_votes_review on public.review_quality_votes(review_id, created_at desc);
create index if not exists idx_reputation_score on public.reviewer_reputation(cohort_id, quality_score desc);
create index if not exists idx_reroutes_status on public.review_reroutes(status, created_at);
create index if not exists idx_challenges_window on public.seasonal_challenges(status, starts_at, ends_at);
create index if not exists idx_challenge_entries_score on public.seasonal_challenge_entries(challenge_id, provisional_score desc nulls last);
create index if not exists idx_anomaly_status on public.review_anomaly_flags(status, severity, created_at desc);
