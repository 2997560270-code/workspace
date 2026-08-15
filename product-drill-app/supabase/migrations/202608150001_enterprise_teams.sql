-- Enterprise teams, invitations and human review notes.
-- The local UI can run without Supabase; this migration is the governed server path.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'learner' check (role in ('owner','coach','learner')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  role text not null default 'learner' check (role in ('coach','learner')),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  session_id text not null references public.training_sessions(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content text not null check (length(trim(content)) between 4 and 4000),
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.mentor_notes enable row level security;

create or replace function public.is_active_team_member(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'active'
  );
$$;

revoke all on function public.is_active_team_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_team_member(uuid, uuid) to authenticated, service_role;

create or replace function public.is_active_team_manager(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'active' and role in ('owner','coach')
  );
$$;

revoke all on function public.is_active_team_manager(uuid, uuid) from public, anon;
grant execute on function public.is_active_team_manager(uuid, uuid) to authenticated, service_role;

create policy "team members can read teams" on public.teams for select
  using (public.is_active_team_member(id, auth.uid()));
create policy "owners can create teams" on public.teams for insert
  with check (owner_id = auth.uid());
create policy "owners can update teams" on public.teams for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "members can read memberships" on public.team_members for select
  using (public.is_active_team_member(team_id, auth.uid()));
create policy "owners and coaches can manage memberships" on public.team_members for all
  using (public.is_active_team_manager(team_id, auth.uid()))
  with check (public.is_active_team_manager(team_id, auth.uid()));

create policy "members can read invitations" on public.team_invitations for select
  using (public.is_active_team_member(team_id, auth.uid()));
create policy "owners and coaches can create invitations" on public.team_invitations for insert
  with check (public.is_active_team_manager(team_id, auth.uid()) and created_by = auth.uid());

create policy "team members can read notes" on public.mentor_notes for select
  using (public.is_active_team_member(team_id, auth.uid()));
create policy "coaches can write notes" on public.mentor_notes for insert
  with check (public.is_active_team_manager(team_id, auth.uid()) and author_id = auth.uid());

create index if not exists idx_team_members_user on public.team_members(user_id, status);
create index if not exists idx_team_invitations_team_expiry on public.team_invitations(team_id, expires_at);
create index if not exists idx_mentor_notes_session on public.mentor_notes(session_id, created_at desc);
