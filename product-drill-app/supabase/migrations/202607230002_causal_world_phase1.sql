-- Phase 1: causal world domain model (parallel tables, no existing tables dropped)
-- Depends on: 202607150001_direction_a.sql (auth.users, public.training_sessions exist)

-- ── causal_worlds（世界身份）──────────────────────────────────────
create table if not exists public.causal_worlds (
  id text primary key,
  target_habit text not null,
  current_version text not null,
  domain text not null,
  governance_status text not null default 'draft'
    check (governance_status in ('draft','review','approved','deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── causal_world_versions（不可变版本快照）───────────────────────
create table if not exists public.causal_world_versions (
  world_id text not null references public.causal_worlds(id) on delete cascade,
  version text not null,
  transfer_role text not null
    check (transfer_role in ('calibration','intervention','transfer_test')),
  trigger_statement text not null,
  visible_facts jsonb not null default '[]',
  -- immutable_rules 存为 jsonb，model 只能读，不能改
  immutable_rules jsonb not null,
  behavior_anchors jsonb not null,
  transfer_surface_differences jsonb not null default '[]',
  approved_by text,
  source_references jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (world_id, version)
);

-- ── challenge_runs（一次世界运行）────────────────────────────────
create table if not exists public.challenge_runs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  world_id text not null references public.causal_worlds(id),
  world_version text not null,
  model_version text not null,
  status text not null default 'active'
    check (status in ('active','completed','abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (world_id, world_version)
    references public.causal_world_versions(world_id, version)
);

-- ── world_events（追加式事件时间线，禁止 UPDATE/DELETE）──────────
create table if not exists public.world_events (
  id text primary key,
  run_id text not null references public.challenge_runs(id) on delete cascade,
  event_type text not null
    check (event_type in ('user_action','world_response','reveal','intervention')),
  sequence_index integer not null,
  actor text not null check (actor in ('user','world','system')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (run_id, sequence_index)
);

-- ── decision_events（后果揭示前持久化）───────────────────────────
create table if not exists public.decision_events (
  id text primary key,
  run_id text not null references public.challenge_runs(id) on delete cascade,
  world_event_id text not null references public.world_events(id),
  judgment text not null,
  chosen_action text not null,
  expected_outcome text not null,
  confidence text not null check (confidence in ('high','medium','low')),
  rejected_alternatives jsonb not null default '[]',
  -- evidence_basis 引用 world_event id 列表，保证可追溯
  evidence_basis jsonb not null default '[]',
  -- consequences_revealed 默认 false，揭示后才可改为 true
  consequences_revealed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── interventions（提示/反馈/反事实）────────────────────────────
create table if not exists public.interventions (
  id text primary key,
  run_id text not null references public.challenge_runs(id) on delete cascade,
  decision_event_id text references public.decision_events(id),
  intervention_type text not null
    check (intervention_type in ('hint','feedback','counterfactual','reveal_consequence')),
  content text not null,
  model_version text not null,
  world_version text not null,
  triggered_at timestamptz not null default now()
);

-- ── judgment_hypotheses（可证伪的判断习惯假设）───────────────────
create table if not exists public.judgment_hypotheses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_name text not null,
  trigger_conditions jsonb not null default '[]',
  confidence text not null default 'insufficient'
    check (confidence in ('high','medium','low','insufficient')),
  supporting_evidence_ids jsonb not null default '[]',
  counter_evidence_ids jsonb not null default '[]',
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, habit_name)
);

-- ── hypothesis_evidence（证据关系，可追溯到事件/世界/模型版本）──
create table if not exists public.hypothesis_evidence (
  id text primary key,
  hypothesis_id text not null references public.judgment_hypotheses(id) on delete cascade,
  decision_event_id text not null references public.decision_events(id),
  evidence_type text not null
    check (evidence_type in ('supporting','counter','assisted','transfer')),
  world_id text not null,
  world_version text not null,
  model_version text not null,
  -- transfer_world_id: evidence_type = 'transfer' 时填入原始世界
  transfer_world_id text,
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────
alter table public.causal_worlds enable row level security;
alter table public.causal_world_versions enable row level security;
alter table public.challenge_runs enable row level security;
alter table public.world_events enable row level security;
alter table public.decision_events enable row level security;
alter table public.interventions enable row level security;
alter table public.judgment_hypotheses enable row level security;
alter table public.hypothesis_evidence enable row level security;

-- 世界元数据：approved 状态公开可读
create policy "approved worlds readable"
  on public.causal_worlds for select
  using (governance_status = 'approved');

create policy "approved world versions readable"
  on public.causal_world_versions for select
  using (
    exists (
      select 1 from public.causal_worlds w
      where w.id = world_id and w.governance_status = 'approved'
    )
  );

-- challenge_runs：用户只能操作自己的 run
create policy "runs own row"
  on public.challenge_runs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- world_events：通过所属 run 的 user_id 隔离
create policy "events through own run"
  on public.world_events for all
  using (
    exists (
      select 1 from public.challenge_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challenge_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  );

-- decision_events：通过所属 run 隔离
create policy "decisions through own run"
  on public.decision_events for all
  using (
    exists (
      select 1 from public.challenge_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challenge_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  );

-- interventions：通过所属 run 隔离
create policy "interventions through own run"
  on public.interventions for all
  using (
    exists (
      select 1 from public.challenge_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challenge_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  );

-- judgment_hypotheses：用户只能操作自己的假设
create policy "hypotheses own row"
  on public.judgment_hypotheses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- hypothesis_evidence：通过假设的 user_id 隔离
create policy "evidence through own hypothesis"
  on public.hypothesis_evidence for all
  using (
    exists (
      select 1 from public.judgment_hypotheses h
      where h.id = hypothesis_id and h.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.judgment_hypotheses h
      where h.id = hypothesis_id and h.user_id = auth.uid()
    )
  );

-- ── 索引 ──────────────────────────────────────────────────────────
create index if not exists idx_runs_user_started
  on public.challenge_runs(user_id, started_at desc);

create index if not exists idx_runs_world
  on public.challenge_runs(world_id, world_version);

create index if not exists idx_events_run_seq
  on public.world_events(run_id, sequence_index);

create index if not exists idx_decisions_run
  on public.decision_events(run_id, created_at);

create index if not exists idx_interventions_run
  on public.interventions(run_id, triggered_at);

create index if not exists idx_hypotheses_user_habit
  on public.judgment_hypotheses(user_id, habit_name);

create index if not exists idx_hyp_evidence_hypothesis
  on public.hypothesis_evidence(hypothesis_id, created_at);

create index if not exists idx_hyp_evidence_decision
  on public.hypothesis_evidence(decision_event_id);
