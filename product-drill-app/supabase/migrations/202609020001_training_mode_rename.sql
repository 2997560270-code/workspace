-- 训练模式更名（FB-004）：需求文档 4.1 定义为「训练模式、严格模式和练习模式」，
-- 产品中旧名「独立」更名为「训练」。旧行保留「独立」值，读取侧归一化为「训练」。

alter table public.training_sessions
  drop constraint if exists training_sessions_mode_check;

alter table public.training_sessions
  add constraint training_sessions_mode_check
  check (mode in ('训练', '严格', '练习', '独立'));
