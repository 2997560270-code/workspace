import { z } from "zod";

// ── World Narrator 输出 ───────────────────────────────────────────
// 仅叙述角色和事件，严格在版本化世界规则内
export const WorldNarratorOutputSchema = z.object({
  response_type: z.enum(["role_reply", "clarification"]),
  // 即时角色回复，不得写成场景续写或训练复盘
  narration: z.string().min(1).max(160),
  // 每个事实性回答必须引用本轮允许使用的事实 id
  cited_fact_ids: z.array(z.string().min(1)).max(8),
});

// ── Behavior Observer 输出 ────────────────────────────────────────
// 提取可观察行为，不给总分，不补写用户未表达的判断
export const BehaviorObservationSchema = z.object({
  // 可观察行为列表（每条必须引用真实 event/message id）
  observations: z.array(
    z.object({
      behavior_code: z.string().min(1).max(100), // 如 "TB-01", "TB-04"
      description: z.string().min(1).max(1000),  // 观察到的具体行为
      evidence_event_ids: z.array(z.string().min(1)).min(1), // 必须引用真实 id
      evidence_quotes: z.array(z.string()).max(3), // 原文摘录
      dimension_covered: z.enum(["workflow", "consequence", "alternative", "none"]),
    })
  ).max(20),
  // 未观察到的维度（不得推断为存在）
  missing_dimensions: z.array(z.enum(["workflow", "consequence", "alternative"])),
  // 本轮是否有提示存在（影响独立性判定）
  assisted: z.boolean(),
  // 置信度（low = 证据不足，不得下结论）
  confidence: z.enum(["high", "medium", "low"]),
  // confidence=low 时输出原因，不得输出能力结论
  insufficient_reason: z.string().max(500).nullable(),
});

// ── Hypothesis Updater 输出 ───────────────────────────────────────
// 更新判断习惯假设，不得凭空创造证据
export const HypothesisUpdateSchema = z.object({
  habit_name: z.string().min(1).max(200),
  // 本次观察对假设的影响方向
  update_direction: z.enum(["supports", "contradicts", "insufficient", "neutral"]),
  // 更新后的置信度
  updated_confidence: z.enum(["high", "medium", "low", "insufficient"]),
  // 更新理由（必须引用 BehaviorObservation 中的 evidence_event_ids）
  rationale: z.string().min(1).max(2000),
  referenced_evidence_ids: z.array(z.string()),
  // 适用条件（哪些触发条件下此假设成立）
  applicable_trigger_conditions: z.array(z.string()).max(5),
  // 明确不推断的结论（对应禁止推断项）
  forbidden_inferences_confirmed: z.array(z.string()).max(10),
});

// ── 确定性降级输出（不调用 OpenAI 时）────────────────────────────
export const DeterministicNarrationSchema = z.object({
  narration: z.string(),
  revealed_fact_ids: z.array(z.string()),
  state_changed: z.literal(false),
  state_change_summary: z.null(),
  unofficial: z.literal(true),
});
