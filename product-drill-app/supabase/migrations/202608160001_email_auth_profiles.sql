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
