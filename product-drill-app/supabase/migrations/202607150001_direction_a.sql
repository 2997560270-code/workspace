-- Product Drill direction A production schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '产品练习生',
  experience_level text,
  goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skills (
  id text primary key,
  name text not null,
  description text not null,
  practice_tip text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scenarios (
  id text primary key,
  title text not null,
  industry text not null,
  active_version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scenario_versions (
  scenario_id text not null references public.scenarios(id) on delete cascade,
  version integer not null,
  primary_skill_id text not null references public.skills(id),
  rubric_version text not null,
  payload jsonb not null,
  source_notes text,
  review_status text not null default 'draft' check (review_status in ('draft','product_reviewed','expert_reviewed','published')),
  created_at timestamptz not null default now(),
  primary key (scenario_id, version)
);

create table if not exists public.training_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null references public.scenarios(id),
  scenario_version integer not null,
  mode text not null check (mode in ('练习','独立','严格')),
  stage text not null check (stage in ('interview','judgment','feedback','retry','complete')),
  engine text not null default 'deterministic' check (engine in ('openai','deterministic')),
  model_version text not null,
  rubric_version text not null,
  hints_used integer not null default 0,
  covered_skills text[] not null default '{}',
  snapshot jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (scenario_id, scenario_version) references public.scenario_versions(scenario_id, version)
);

create table if not exists public.messages (
  id text primary key,
  session_id text not null references public.training_sessions(id) on delete cascade,
  role text not null check (role in ('ai','user')),
  content text not null,
  turn_index integer not null,
  revealed_skill text references public.skills(id),
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

create table if not exists public.product_judgments (
  session_id text primary key references public.training_sessions(id) on delete cascade,
  target_user text not null,
  current_workflow text not null,
  core_problem text not null,
  problem_impact text not null,
  alternative text not null,
  recommendation text not null,
  success_metric text not null,
  biggest_assumption text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluations (
  id text primary key,
  session_id text not null unique references public.training_sessions(id) on delete cascade,
  total_score integer not null check (total_score between 0 and 100),
  summary text not null,
  confidence text not null check (confidence in ('高','中','低')),
  engine text not null check (engine in ('openai','deterministic')),
  model_version text not null,
  rubric_version text not null,
  scenario_version integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  evaluation_id text not null references public.evaluations(id) on delete cascade,
  skill_id text not null references public.skills(id),
  level text not null check (level in ('未体现','在提示下体现','独立体现','稳定且深入')),
  confidence numeric(4,3),
  evidence_message_ids text[] not null default '{}',
  evidence_quotes text[] not null default '{}',
  why text not null,
  next_action text not null,
  unique (evaluation_id, skill_id)
);

create table if not exists public.retry_attempts (
  id text primary key,
  session_id text not null references public.training_sessions(id) on delete cascade,
  evaluation_id text not null references public.evaluations(id) on delete cascade,
  issue_id text not null,
  target_skill_id text not null references public.skills(id),
  answer text not null,
  improved boolean not null,
  feedback text not null,
  engine text not null check (engine in ('openai','deterministic')),
  model_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ability_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null references public.training_sessions(id) on delete cascade,
  skill_id text not null references public.skills(id),
  level text not null,
  independent boolean not null,
  improved boolean not null default false,
  scenario_version integer not null,
  rubric_version text not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  unique (user_id, session_id, skill_id)
);

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, bucket, window_start)
);

create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_request_count integer;
begin
  if p_window_seconds < 1 or p_max_requests < 1 or length(p_bucket) > 80 then
    raise exception 'invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (user_id, bucket, window_start, request_count, updated_at)
  values (p_user_id, p_bucket, v_window_start, 1, now())
  on conflict (user_id, bucket, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_request_count;

  return v_request_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to service_role;

create index if not exists idx_rate_limits_updated on public.api_rate_limits(updated_at);

create index if not exists idx_sessions_user_started on public.training_sessions(user_id, started_at desc);
create index if not exists idx_messages_session_turn on public.messages(session_id, turn_index);
create index if not exists idx_ability_user_skill on public.ability_evidence(user_id, skill_id, created_at desc);
create index if not exists idx_retries_session on public.retry_attempts(session_id, created_at desc);

insert into public.skills (id, name, description, practice_tip) values
('role','用户与角色识别','区分使用者、决策者、付费者与问题承担者。','先问谁每天使用、谁做决定、谁承担结果。'),
('workflow','场景与当前流程','还原问题发生前后的真实步骤。','请用户带你走一遍现在的完整流程。'),
('impact','问题影响与根因','确认频率、严重程度、业务影响和根因。','追问多久发生一次、不解决会造成什么后果。'),
('alternative','现有替代方案','理解用户当前如何绕过问题。','先问现在用什么方法解决。'),
('metric','成功指标','把模糊的更好转成可验证结果。','问什么变化能证明问题真的被解决。')
on conflict (id) do update set name=excluded.name, description=excluded.description, practice_tip=excluded.practice_tip;

alter table public.skills enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_versions enable row level security;
alter table public.profiles enable row level security;
alter table public.training_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.product_judgments enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_evidence enable row level security;
alter table public.retry_attempts enable row level security;
alter table public.ability_evidence enable row level security;
alter table public.api_rate_limits enable row level security;

create policy "profiles own row" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "sessions own row" on public.training_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages through own session" on public.messages for all using (exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid())) with check (exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "judgments through own session" on public.product_judgments for all using (exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid())) with check (exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "evaluations through own session" on public.evaluations for all using (exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid())) with check (exists (select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "evidence through own evaluation" on public.evaluation_evidence for all using (exists (select 1 from public.evaluations e join public.training_sessions s on s.id=e.session_id where e.id=evaluation_id and s.user_id=auth.uid())) with check (exists (select 1 from public.evaluations e join public.training_sessions s on s.id=e.session_id where e.id=evaluation_id and s.user_id=auth.uid()));
create policy "retries through own session" on public.retry_attempts for all using (exists (select 1 from public.training_sessions s where s.id=session_id and s.user_id=auth.uid())) with check (exists (select 1 from public.training_sessions s where s.id=session_id and s.user_id=auth.uid()));
create policy "ability own row" on public.ability_evidence for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "published skills readable" on public.skills for select using (true);
create policy "published scenarios readable" on public.scenarios for select using (status = 'published');
create policy "published scenario versions readable" on public.scenario_versions for select using (review_status = 'published');
