-- Persisted multi-role practice sessions. These sessions remain separate from formal ability evidence.
create table if not exists public.multi_role_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null check (length(trim(scenario_id)) between 1 and 120),
  role_id text not null check (length(trim(role_id)) between 1 and 120),
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.multi_role_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.multi_role_sessions(id) on delete cascade,
  author text not null check (author in ('user','role')),
  content text not null check (length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.multi_role_sessions enable row level security;
alter table public.multi_role_messages enable row level security;

create policy "users manage own multi role sessions" on public.multi_role_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own multi role messages" on public.multi_role_messages for select
  using (exists (select 1 from public.multi_role_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "users write own multi role messages" on public.multi_role_messages for insert
  with check (exists (select 1 from public.multi_role_sessions s where s.id = session_id and s.user_id = auth.uid()));

create index if not exists idx_multi_role_sessions_user_role
  on public.multi_role_sessions(user_id, scenario_id, role_id, updated_at desc);
create index if not exists idx_multi_role_messages_session
  on public.multi_role_messages(session_id, created_at);
