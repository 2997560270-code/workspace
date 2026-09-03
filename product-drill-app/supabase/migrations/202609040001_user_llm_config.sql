-- 用户自定义「标准大模型 API」配置（OpenAI 兼容 chat/completions）。
-- 每个用户可保存多个提供方；API Key 只存服务端加密后的密文，绝不返回明文。

create table if not exists public.user_llm_configs (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (length(trim(provider)) between 1 and 80),
  label text,
  base_url text not null check (length(trim(base_url)) between 8 and 500),
  api_key_encrypted text not null check (length(trim(api_key_encrypted)) > 0),
  model text not null check (length(trim(model)) between 1 and 200),
  temperature numeric not null default 0.7 check (temperature between 0 and 2),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_llm_configs enable row level security;

-- 用户只管理自己的模型配置。
create policy "users manage own llm config" on public.user_llm_configs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_user_llm_configs_updated
  on public.user_llm_configs(updated_at desc);