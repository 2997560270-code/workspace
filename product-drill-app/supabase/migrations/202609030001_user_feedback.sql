-- User experience feedback ingestion API.
-- Depends on: 202608150002_content_billing.sql (public.is_platform_admin).

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('bug','experience','feature','other')),
  content text not null check (length(trim(content)) between 5 and 2000),
  contact text check (trim(contact) = '' or (length(trim(contact)) <= 100)),
  page text check (trim(page) = '' or (length(trim(page)) <= 200)),
  rating integer check (rating between 1 and 5),
  status text not null default 'open' check (status in ('open','processing','resolved','closed')),
  user_agent text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;

-- The API writes with the service_role key, so direct client writes are never needed;
-- keep an insert-permissive policy so anonymous feedback can land in a safe column set.
create policy "feedback insert allowed" on public.user_feedback
  for insert with check (true);

-- Admins read all feedback; users may read their own rows.
create policy "admins read all feedback" on public.user_feedback
  for select using (public.is_platform_admin(auth.uid()) or user_id = auth.uid());

create index if not exists idx_user_feedback_created
  on public.user_feedback(created_at desc);
create index if not exists idx_user_feedback_category_status
  on public.user_feedback(category, status, created_at desc);
