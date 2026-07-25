/**
 * judgment-profile-builder.ts — 判断证据画像的纯函数构建器
 *
 * Issue #6 约束：
 * - 不暴露 totalScore / 雷达图 / 技能次数推断
 * - 每条结论可追溯具体 decision_event_id
 * - 证据不足时不显示伪精确分数
 * - 辅助/迁移/同世界修正状态可区分
 */
import type { HypothesisConfidence, HypothesisEvidence, JudgmentHypothesis } from "./causal-world";

// ── 输入 ──────────────────────────────────────────────────────────
export type JudgmentProfileInput = {
  hypotheses: JudgmentHypothesis[];
  evidence: HypothesisEvidence[];
};

// ── 证据展示项 ────────────────────────────────────────────────────
export type EvidenceDisplayItem = {
  id: string;
  /** 可深链到具体决策事件 */
  decision_event_id: string;
  world_id: string;
  world_version: string;
  model_version: string;
  /** 是否来自陌生世界（迁移证据） */
  is_transfer: boolean;
  /** 迁移世界 id（is_transfer=true 时有值） */
  transfer_world_id: string | null;
  /**
   * 反证来自同一世界 = 同世界修正机会。
   * 支持证据来自同一世界不算修正（正常学习路径）。
   */
  is_same_world_correction: boolean;
  created_at: string;
};

// ── 假设展示项 ────────────────────────────────────────────────────
export type HypothesisDisplayItem = {
  id: string;
  habit_name: string;
  trigger_conditions: string[];
  /** 人类可读的置信度标签（不是数字） */
  confidence_label: string;
  /**
   * 永远为 false — 置信度不得作为数字分数展示。
   * 存在此字段让调用方无需猜测意图。
   */
  show_confidence_as_score: false;
  /** 支持证据（独立） */
  supporting_evidence: EvidenceDisplayItem[];
  /** 反证（独立） */
  counter_evidence: EvidenceDisplayItem[];
  /** 辅助证据（有提示辅助，独立性不成立） */
  assisted_evidence: EvidenceDisplayItem[];
  /** 迁移证据（来自陌生世界的独立决策） */
  transfer_evidence: EvidenceDisplayItem[];
  /** 所有证据总数（含辅助） */
  total_evidence_count: number;
  last_updated_at: string;
};

// ── 画像输出 ──────────────────────────────────────────────────────
export type JudgmentProfile = {
  items: HypothesisDisplayItem[];
};

// ── 置信度标签映射 ────────────────────────────────────────────────
const CONFIDENCE_LABELS: Record<HypothesisConfidence, string> = {
  high:         "高置信度（多世界独立证据一致）",
  medium:       "中置信度（有证据，仍需验证）",
  low:          "低置信度（证据有限）",
  insufficient: "证据不足",
};

export function getConfidenceLabel(confidence: HypothesisConfidence): string {
  return CONFIDENCE_LABELS[confidence];
}

// ── 核心构建函数 ──────────────────────────────────────────────────

/**
 * 将假设列表和证据列表整形为可直接渲染的展示结构。
 * 纯函数，无副作用。
 */
export function buildJudgmentProfile(
  input: JudgmentProfileInput
): JudgmentProfile {
  const { hypotheses, evidence } = input;

  const items: HypothesisDisplayItem[] = hypotheses.map((hyp) => {
    // 找出属于该假设的所有证据
    const hypEvidence = evidence.filter((ev) => ev.hypothesis_id === hyp.id);

    const supporting: EvidenceDisplayItem[] = [];
    const counter: EvidenceDisplayItem[] = [];
    const assisted: EvidenceDisplayItem[] = [];
    const transfer: EvidenceDisplayItem[] = [];

    for (const ev of hypEvidence) {
      const item = toEvidenceDisplayItem(ev);
      switch (ev.evidence_type) {
        case "supporting": supporting.push(item); break;
        case "counter":    counter.push(item);    break;
        case "assisted":   assisted.push(item);   break;
        case "transfer":   transfer.push(item);   break;
      }
    }

    return {
      id: hyp.id,
      habit_name: hyp.habit_name,
      trigger_conditions: hyp.trigger_conditions,
      confidence_label: getConfidenceLabel(hyp.confidence),
      show_confidence_as_score: false,
      supporting_evidence: supporting,
      counter_evidence: counter,
      assisted_evidence: assisted,
      transfer_evidence: transfer,
      total_evidence_count: hypEvidence.length,
      last_updated_at: hyp.last_updated_at,
    };
  });

  return { items };
}

// ── 私有工具 ──────────────────────────────────────────────────────

function toEvidenceDisplayItem(ev: HypothesisEvidence): EvidenceDisplayItem {
  const isTransfer = ev.evidence_type === "transfer";
  // 反证来自同一世界（没有 transfer_world_id）= 同世界修正机会
  const isSameWorldCorrection =
    ev.evidence_type === "counter" && ev.transfer_world_id === null;

  return {
    id: ev.id,
    decision_event_id: ev.decision_event_id,
    world_id: ev.world_id,
    world_version: ev.world_version,
    model_version: ev.model_version,
    is_transfer: isTransfer,
    transfer_world_id: ev.transfer_world_id,
    is_same_world_correction: isSameWorldCorrection,
    created_at: ev.created_at,
  };
}
