-- Product Drill 全量数据库初始化脚本
-- 用法：Supabase Dashboard → SQL Editor → 新建查询 → 粘贴本文件全部内容 → Run


-- ══════════ 202607150001_direction_a.sql ══════════

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


-- ══════════ 202607230002_causal_world_phase1.sql ══════════

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


-- ══════════ 202608030001_approved_behavior_and_worlds.sql ══════════

-- Approved Phase 1 behavior claim (#15) and governed worlds (#8).
-- Existing world versions remain immutable and are not deleted or overwritten.

alter table public.causal_world_versions
  add column if not exists available_actions jsonb not null default '[]'::jsonb;

alter table public.causal_world_versions
  add column if not exists pressure_context text not null default '';

insert into public.causal_worlds (
  id, target_habit, current_version, domain, governance_status
) values
  ('world-1-ai-summary', 'premature_solution_commitment', '2.0.0', 'B2C / AI 工具产品', 'approved'),
  ('world-2-enterprise-renewal', 'premature_solution_commitment', '2.0.0', 'B2B SaaS / 协作工具', 'approved'),
  ('world-3-growth-decline', 'premature_solution_commitment', '2.0.0', 'B2C / 设计工具', 'approved')
on conflict (id) do update set
  target_habit = excluded.target_habit,
  current_version = excluded.current_version,
  domain = excluded.domain,
  governance_status = excluded.governance_status,
  updated_at = now();

insert into public.causal_world_versions (
  world_id,
  version,
  transfer_role,
  trigger_statement,
  visible_facts,
  available_actions,
  pressure_context,
  immutable_rules,
  behavior_anchors,
  transfer_surface_differences,
  approved_by,
  source_references,
  created_at
) values
(
  'world-1-ai-summary',
  '2.0.0',
  'calibration',
  'CEO 刚从投资人路演回来，直接找到你说：我承诺过投资人，我们下个季度会上线 AI 摘要功能。你们能做吗？',
  $json$[
    "CEO 刚完成一轮融资路演，情绪高涨",
    "当前产品有一个基础摘要功能，入口在设置页深处",
    "本季度工程团队还有两个正在进行的项目"
  ]$json$::jsonb,
  $json$[
    {"id":"w1-ask-audience","label":"询问演示对象和反馈来源","category":"investigate"},
    {"id":"w1-request-usage","label":"请求现有摘要功能使用数据","category":"request_data"},
    {"id":"w1-check-projects","label":"核查工程、法务和在建项目","category":"investigate"},
    {"id":"w1-clarify-goal","label":"澄清 CEO 最终要解决的问题","category":"investigate"},
    {"id":"w1-commit","label":"提交是否承诺及下一步行动","category":"commit"}
  ]$json$::jsonb,
  '内部权威与融资叙事压力',
  $json${
    "model_forbidden_to_modify": true,
    "hidden_facts": [
      {"id":"HF-1-01","content":"CEO 演示的对象是技术极客天使投资人，不代表核心用户群","reveal_condition_id":"RC-1-01","causal_significance":"投资人反馈不能替代核心用户证据"},
      {"id":"HF-1-02","content":"现有摘要功能使用率仅 12%，根本问题是功能入口路径，而非摘要能力","reveal_condition_id":"RC-1-02","causal_significance":"使用数据指向入口问题而非新能力缺口"},
      {"id":"HF-1-03","content":"基础设施团队已在做 LLM 接入层，贸然承诺会产生双轨冲突","reveal_condition_id":"RC-1-03","causal_significance":"在建工程形成交付依赖和重复建设风险"},
      {"id":"HF-1-04","content":"该功能涉及数据隐私合规审查，法务周期至少 6 周","reveal_condition_id":"RC-1-04","causal_significance":"合规周期使直接排期承诺不可信"},
      {"id":"HF-1-05","content":"CEO 的真实诉求是能向投资人讲可信的 AI 故事，不是某个固定功能形态","reveal_condition_id":"RC-1-05","causal_significance":"真实目标允许更小的解决路径"}
    ],
    "causal_rules": [
      {"id":"CR-1-A","trigger_action":"未调查任何隐藏事实就承诺下季度上线 AI 摘要","consequence_path":"premature","short_term":"CEO 满意，会议快速结束","medium_term":"工程发现双轨和合规问题，法务叫停，季度目标落空","long_term":"功能延期且 PM 公信力受损","counterfactual":"先核查使用数据和真实目标，再提出分层路径"},
      {"id":"CR-1-B","trigger_action":"调查使用数据和 CEO 真实目标后再做承诺","consequence_path":"investigated","short_term":"CEO 对延迟承诺产生轻微摩擦","medium_term":"团队形成入口优化与 AI 摘要 MVP 的分层方案","long_term":"季度内交付更小且合规的 MVP","counterfactual":"直接承诺会在执行期暴露双轨和合规约束"}
    ],
    "role_interests": [
      {"role":"CEO","stated_position":"下季度上线 AI 摘要功能","true_interest":"让投资叙事可信","information_boundary":"不知道现有摘要使用率和工程双轨风险"},
      {"role":"工程团队","stated_position":"需要评估可行性","true_interest":"避免重复建设和计划冲突","information_boundary":"不知道 CEO 的真实叙事目标"},
      {"role":"核心用户","stated_position":"尚未参与本次讨论","true_interest":"更容易发现和使用已有摘要能力","information_boundary":"不知道团队正在做本次承诺"}
    ],
    "reveal_conditions": [
      {"id":"RC-1-01","trigger":"向谁演示","reveals":["HF-1-01"]},
      {"id":"RC-1-02","trigger":"现有摘要","reveals":["HF-1-02"]},
      {"id":"RC-1-03","trigger":"在建项目","reveals":["HF-1-03"]},
      {"id":"RC-1-04","trigger":"合规","reveals":["HF-1-04"]},
      {"id":"RC-1-05","trigger":"最终要解决","reveals":["HF-1-05"]}
    ]
  }$json$::jsonb,
  $json${
    "premature_commitment":{"level":1,"description":"未调查背景，在前两轮内承诺功能或时间节点","observable_indicators":["未核查使用数据","未澄清真实目标","直接给出上线排期"],"anti_examples":["先核查现有摘要使用数据"]},
    "adequate_investigation":{"level":3,"description":"承诺前调查当前数据和真实目标","observable_indicators":["覆盖当前工作流","确认问题后果","了解现有替代路径"],"anti_examples":["只询问功能如何实现"]},
    "model_behavior":{"level":5,"description":"覆盖三个发现维度并提出有前提的分层方案","observable_indicators":["识别入口根因","核查双轨依赖","说明方案前提"],"anti_examples":["把投资人偏好当作核心用户需求"]}
  }$json$::jsonb,
  '[]'::jsonb,
  'product-owner',
  '["GitHub Issue #15 v0.3","GitHub Issue #8 v1.0"]'::jsonb,
  '2026-08-03T00:00:00Z'
),
(
  'world-2-enterprise-renewal',
  '2.0.0',
  'intervention',
  'CSM 在 Slack 发消息：TechCorp 合同下月到期，他们说除非我们做 SSO 和权限管理，否则不续签。这是我们 ARR 最大的单一客户，年费 120 万。',
  '["TechCorp 是 500 人规模企业，年费 120 万，是最大单一客户","CSM 已和对方沟通过两轮，并称 IT 部门把 SSO 视为合规要求","竞品 A 已支持 SSO，竞品 B 不支持"]'::jsonb,
  $json$[
    {"id":"w2-check-segments","label":"查看客户与用户分布","category":"request_data"},
    {"id":"w2-check-usage","label":"查看 TechCorp 实际使用数据","category":"request_data"},
    {"id":"w2-read-source","label":"查看客户原始反馈记录","category":"investigate"},
    {"id":"w2-check-alternative","label":"询问客户不续签时的替代方案","category":"investigate"},
    {"id":"w2-commit","label":"提交续约与产品行动决策","category":"commit"}
  ]$json$::jsonb,
  '最大客户续约与 ARR 压力',
  $json${
    "model_forbidden_to_modify": true,
    "hidden_facts": [
      {"id":"HF-2-01","content":"产品 80% 用户来自 20-100 人团队，SSO 对核心用户群几乎没有感知价值","reveal_condition_id":"RC-2-01","causal_significance":"单一大客户需求与核心市场价值存在冲突"},
      {"id":"HF-2-02","content":"竞品 B 不支持 SSO，TechCorp 真正的替代方案是内部自建工具，而非迁移竞品","reveal_condition_id":"RC-2-02","causal_significance":"真实替代方案改变续约风险和谈判空间"},
      {"id":"HF-2-03","content":"TechCorp 活跃用户数过去 6 个月下降 40%，根本问题是 onboarding 失败","reveal_condition_id":"RC-2-03","causal_significance":"续约风险主要来自激活问题"},
      {"id":"HF-2-04","content":"CSM 转述经过情绪放大，客户原话是 IT 部门建议有 SSO 会更好，并非硬性条件","reveal_condition_id":"RC-2-04","causal_significance":"二手转述夸大了方案紧迫性"},
      {"id":"HF-2-05","content":"为该客户定制会触发连锁效应，另外 3 个大客户也在观望","reveal_condition_id":"RC-2-05","causal_significance":"一次定制承诺会改变后续客户预期"}
    ],
    "causal_rules": [
      {"id":"CR-2-A","trigger_action":"未核查使用数据和原始反馈就承诺开发 SSO","consequence_path":"premature","short_term":"CSM 压力缓解","medium_term":"工程资源被占用，中小客户功能延期","long_term":"TechCorp 仍因激活率问题流失","counterfactual":"先核查客户使用数据和原始反馈"},
      {"id":"CR-2-B","trigger_action":"调查使用数据和信息来源后再承诺","consequence_path":"investigated","short_term":"CSM 担心决策被拖延","medium_term":"团队先改善 onboarding 并给出 SSO 路线图","long_term":"激活率回升并支持续约","counterfactual":"只交付 SSO 无法解决客户活跃度根因"}
    ],
    "role_interests": [
      {"role":"CSM","stated_position":"必须尽快承诺 SSO","true_interest":"规避个人续约 KPI 风险","information_boundary":"没有核查客户真实使用数据"},
      {"role":"TechCorp IT","stated_position":"需要 SSO 满足合规","true_interest":"让合规诉求得到回应","information_boundary":"不知道内部自建工具的完整成本"},
      {"role":"TechCorp 业务方","stated_position":"尚未直接参与讨论","true_interest":"解决 onboarding 问题","information_boundary":"不知道 IT 与 CSM 的谈判内容"}
    ],
    "reveal_conditions": [
      {"id":"RC-2-01","trigger":"用户分布","reveals":["HF-2-01"]},
      {"id":"RC-2-02","trigger":"不续签","reveals":["HF-2-02"]},
      {"id":"RC-2-03","trigger":"使用数据","reveals":["HF-2-03"]},
      {"id":"RC-2-04","trigger":"原始反馈","reveals":["HF-2-04"]},
      {"id":"RC-2-05","trigger":"其他客户","reveals":["HF-2-05"]}
    ]
  }$json$::jsonb,
  $json${
    "premature_commitment":{"level":1,"description":"未核查信息就在前两轮承诺 SSO","observable_indicators":["只依据二手转述","未调查客户活跃度","直接给出排期"],"anti_examples":["查看客户原始反馈"]},
    "adequate_investigation":{"level":3,"description":"调查客户使用数据和信息来源","observable_indicators":["识别 onboarding 问题","核对客户原话","了解真实替代方案"],"anti_examples":["只讨论 SSO 功能细节"]},
    "model_behavior":{"level":5,"description":"识别连锁效应并提出分层方案","observable_indicators":["识别核心市场影响","说明定制连锁效应","承诺附带条件"],"anti_examples":["把单一客户等同于全体市场"]}
  }$json$::jsonb,
  '["外部客户压力","B2B 续约场景","金额与合规谈判"]'::jsonb,
  'product-owner',
  '["GitHub Issue #15 v0.3","GitHub Issue #8 v1.0"]'::jsonb,
  '2026-08-03T00:00:00Z'
),
(
  'world-3-growth-decline',
  '2.0.0',
  'transfer_test',
  '增长团队周会上，数据负责人展示本月 DAU 下降 8%，立刻有人说：Figma 刚上线了 AI 设计建议，我们必须跟上，不然用户会流失。',
  '["本月 DAU 环比下降 8%，为过去一年最大单月跌幅","Figma 上周发布 AI 设计建议功能，Product Hunt 评分 4.2/5","增长团队已在 Slack 形成必须跟进的共识"]'::jsonb,
  $json$[
    {"id":"w3-check-cohort","label":"查看 DAU 下降的用户群分布","category":"request_data"},
    {"id":"w3-check-competitor","label":"核查竞品功能真实使用数据","category":"request_data"},
    {"id":"w3-check-effort","label":"评估工程改造范围","category":"investigate"},
    {"id":"w3-interview","label":"核查流失访谈和现有替代方案","category":"investigate"},
    {"id":"w3-commit","label":"提交增长问题行动决策","category":"commit"}
  ]$json$::jsonb,
  '增长指标下跌与团队竞品焦虑；本世界不得提供决策前提示',
  $json${
    "model_forbidden_to_modify": true,
    "hidden_facts": [
      {"id":"HF-3-01","content":"Cohort 分析显示 DAU 下降来自 30 天内新注册用户，30 日留存从 45% 降至 28%，是 onboarding 问题","reveal_condition_id":"RC-3-01","causal_significance":"指标分群后指向新用户激活"},
      {"id":"HF-3-02","content":"Figma AI 功能 7 日使用率不足 15%，用户反馈其建议不准确","reveal_condition_id":"RC-3-02","causal_significance":"竞品发布热度不能证明稳定用户价值"},
      {"id":"HF-3-03","content":"实现同类 AI 建议需要重构核心编辑器架构，预计占用两个季度","reveal_condition_id":"RC-3-03","causal_significance":"复制竞品的机会成本高"},
      {"id":"HF-3-04","content":"团队要求复制竞品背后是对是否落后的焦虑，不是基于用户研究的决策","reveal_condition_id":"RC-3-04","causal_significance":"内部共识属于压力信号而非用户证据"},
      {"id":"HF-3-05","content":"团队没有联系过流失用户，当前所有原因判断都来自内部推断","reveal_condition_id":"RC-3-05","causal_significance":"缺少真实问题叙述"}
    ],
    "causal_rules": [
      {"id":"CR-3-A","trigger_action":"未诊断 DAU 下降原因就承诺复制竞品 AI 功能","consequence_path":"premature","short_term":"团队焦虑暂时缓解","medium_term":"工程启动重构，既有路线图延期，DAU 继续下降","long_term":"功能上线后使用率仍低","counterfactual":"先完成一周 DAU 下降诊断"},
      {"id":"CR-3-B","trigger_action":"先完成 DAU 下降诊断再决定是否跟进竞品","consequence_path":"investigated","short_term":"增长团队对延后决策不满","medium_term":"团队发现 onboarding 漏斗问题并修复激活节点","long_term":"DAU 在 6 周内回升","counterfactual":"立即复制竞品会掩盖真正的激活问题"}
    ],
    "role_interests": [
      {"role":"数据负责人","stated_position":"需要解释 DAU 下降","true_interest":"建立可信的数据驱动原因","information_boundary":"尚未完成 cohort 细分"},
      {"role":"增长团队","stated_position":"必须追上竞品","true_interest":"缓解产品落后的焦虑","information_boundary":"不知道竞品真实使用率"},
      {"role":"流失用户","stated_position":"尚未被访谈","true_interest":"解决实际激活障碍","information_boundary":"不知道团队把流失归因于竞品功能"}
    ],
    "reveal_conditions": [
      {"id":"RC-3-01","trigger":"用户群分布","reveals":["HF-3-01"]},
      {"id":"RC-3-02","trigger":"竞品数据","reveals":["HF-3-02"]},
      {"id":"RC-3-03","trigger":"工程量","reveals":["HF-3-03"]},
      {"id":"RC-3-04","trigger":"为什么跟进","reveals":["HF-3-04"]},
      {"id":"RC-3-05","trigger":"流失访谈","reveals":["HF-3-05"]}
    ]
  }$json$::jsonb,
  $json${
    "premature_commitment":{"level":1,"description":"未调查指标结构就在前两轮承诺跟进","observable_indicators":["未拆分 DAU cohort","未核查竞品使用率","直接进入路线图"],"anti_examples":["先诊断 DAU 下降来源"]},
    "adequate_investigation":{"level":3,"description":"调查 DAU 用户结构和竞品实际数据","observable_indicators":["识别 onboarding 根因","区分热度与价值","评估机会成本"],"anti_examples":["只比较竞品功能清单"]},
    "model_behavior":{"level":5,"description":"主动识别缺少流失访谈并提出有期限的诊断 sprint","observable_indicators":["指出内部推断边界","给出一周诊断计划","说明重评条件"],"anti_examples":["把同期下降直接归因于竞品"]}
  }$json$::jsonb,
  '["内部团队共识压力","B2C 增长场景","无提示迁移测试"]'::jsonb,
  'product-owner',
  '["GitHub Issue #15 v0.3","GitHub Issue #8 v1.0"]'::jsonb,
  '2026-08-03T00:00:00Z'
)
on conflict (world_id, version) do nothing;



-- ══════════ 202608040001_challenge_api_concurrency.sql ══════════

-- Issue #13: enforce the same single-decision invariant at the database layer.
-- The repository maps this constraint violation to DuplicateDecisionError.

create unique index if not exists decision_events_run_world_event_unique
  on public.decision_events (run_id, world_event_id);


-- ══════════ 202608150001_enterprise_teams.sql ══════════

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


-- ══════════ 202608150002_content_billing.sql ══════════

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


-- ══════════ 202608150003_validation_beta.sql ══════════

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


-- ══════════ 202608150004_community_review_beta.sql ══════════

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


-- ══════════ 202608150005_community_governance.sql ══════════

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


-- ══════════ 202608150006_standardized_assessment.sql ══════════

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


-- ══════════ 202608150007_verified_assessment_pilots.sql ══════════

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


-- ══════════ 202608150008_multi_role_sessions.sql ══════════

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


-- ══════════ 202608160001_email_auth_profiles.sql ══════════

-- Email/password account profiles.
-- Supabase Auth already stores email + password hash in auth.users on sign-up.
-- This migration stores the app-level login metadata (email, display name,
-- last sign-in time) in public.profiles and auto-creates a row for every new
-- user so registration always writes login information to the database.
-- Depends on: 202607150001_direction_a.sql (public.profiles exists),
--             202608150002_content_billing.sql (account_role column).

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists last_sign_in_at timestamptz;

-- Auto-create a profile row whenever a user signs up. Runs as the function
-- owner (postgres), so it bypasses row-level security and cannot be called by
-- clients directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '产品练习生')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Backfill email for profile rows created before this migration existed.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Keep updated_at fresh whenever the profile row changes (e.g. last sign-in).
create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

create index if not exists idx_profiles_email on public.profiles(email);


-- 202609020001_training_mode_rename.sql
-- ѵ��ģʽ������FB-004��������������������Ϊ��ѵ���������б������ɶ�ȡ���һ����
alter table public.training_sessions
  drop constraint if exists training_sessions_mode_check;
alter table public.training_sessions
  add constraint training_sessions_mode_check
  check (mode in ('ѵ��', '�ϸ�', '��ϰ', '����'));
