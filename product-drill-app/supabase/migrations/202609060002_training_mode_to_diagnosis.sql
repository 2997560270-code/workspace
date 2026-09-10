-- 训练模式更名（RT-002）：模式「训练」更名为「诊断」，与「练习」在语义上区分。
-- 旧行保留「训练」「独立」值，读取侧（TrainingModeSchema）归一化为「诊断」。

alter table public.training_sessions
  drop constraint if exists training_sessions_mode_check;

alter table public.training_sessions
  add constraint training_sessions_mode_check
  check (mode in ('诊断', '严格', '练习', '训练', '独立'));
