-- Governed community content, searchable knowledge and subscription state.
alter table public.profiles add column if not exists account_role text not null default 'learner'
  check (account_role in ('learner','coach','admin'));

create or replace function public.is_platform_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists (select 1 from public.profiles where id = p_user_id and account_role = 'admin'); $$;

revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free','team','pro')),
  status text not null default 'active' check (status in ('active','trial','past_due','canceled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan_id = 'free') or (provider is not null and provider_subscription_id is not null))
);

create table if not exists public.community_cases (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 4 and 160),
  industry text not null check (length(trim(industry)) between 2 and 80),
  skill_id text not null references public.skills(id),
  summary text not null check (length(trim(summary)) between 4 and 4000),
  lesson text not null check (length(trim(lesson)) between 4 and 4000),
  status text not null default 'pending' check (status in ('pending','published','archived','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 200),
  industry text not null,
  tags text[] not null default '{}',
  content text not null check (length(trim(content)) between 10 and 20000),
  source text not null,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  entity_type text not null check (entity_type in ('community_case','knowledge_entry','subscription')),
  entity_id text not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;
alter table public.community_cases enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.content_audit_log enable row level security;

create policy "users read own subscription" on public.billing_subscriptions for select using (user_id = auth.uid());
create policy "published cases are readable" on public.community_cases for select using (status = 'published' or author_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "users submit pending cases" on public.community_cases for insert with check (author_id = auth.uid() and status = 'pending');
create policy "published knowledge is readable" on public.knowledge_entries for select using (status = 'published' or public.is_platform_admin(auth.uid()));
create policy "admins manage cases" on public.community_cases for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins manage knowledge" on public.knowledge_entries for all using (public.is_platform_admin(auth.uid())) with check (public.is_platform_admin(auth.uid()));
create policy "admins read audit log" on public.content_audit_log for select using (public.is_platform_admin(auth.uid()));
create policy "admins append audit log" on public.content_audit_log for insert with check (actor_id = auth.uid() and public.is_platform_admin(auth.uid()));

create index if not exists idx_community_cases_status_created on public.community_cases(status, created_at desc);
create index if not exists idx_knowledge_status_industry on public.knowledge_entries(status, industry);
create index if not exists idx_knowledge_tags on public.knowledge_entries using gin(tags);
create unique index if not exists idx_knowledge_industry_title on public.knowledge_entries(industry, title);
create index if not exists idx_content_audit_entity on public.content_audit_log(entity_type, entity_id, created_at desc);
