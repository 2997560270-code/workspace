-- RT-005：团队成员自定义称谓（展示名），与权限角色解耦。
-- role 仍收敛在 owner / coach / learner 三级，title 只影响展示（成员卡、点评署名）。
alter table public.team_members
  add column if not exists title text;

alter table public.team_members
  drop constraint if exists team_members_title_check;

alter table public.team_members
  add constraint team_members_title_check
  check (title is null or length(trim(title)) between 1 and 20);
