import type { HypothesisEvidence, Intervention } from "./causal-world";

// ── 迁移判定输入 ──────────────────────────────────────────────────
export type TransferJudgmentInput = {
  /** 已治理的训练世界 id 列表（world-1, world-2） */
  training_world_ids: string[];
  /** 本次决策所在世界的 id（应为陌生世界）*/
  transfer_world_id: string;
  /** 本次决策所属的 run id */
  decision_run_id: string;
  /** 待判定的假设证据 */
  evidence: HypothesisEvidence;
  /** 同一 run 内的所有干预记录 */
  interventions_in_run: Intervention[];
  /** 行为观察的置信度 */
  observation_confidence: "high" | "medium" | "low" | "insufficient";
};

// ── 迁移判定结果 ──────────────────────────────────────────────────
export type TransferJudgmentResult = {
  qualifies_as_transfer: boolean;
  /** 更新后的证据类型（transfer / assisted / supporting / counter） */
  evidence_type: HypothesisEvidence["evidence_type"];
  /** 更新后的证据对象（不变更原对象，遵循 immutability） */
  updated_evidence: HypothesisEvidence;
  reason: string;
};

// ── 最低置信度门槛 ────────────────────────────────────────────────
const TRANSFER_ELIGIBLE_CONFIDENCE = new Set<TransferJudgmentInput["observation_confidence"]>([
  "medium",
  "high",
]);

// ── isIndependentTransferDecision ─────────────────────────────────
/**
 * 判断给定 run 中是否不存在任何 hint 干预。
 * 只有没有 hint 的 run，其决策事件才能产生独立迁移证据。
 */
export function isIndependentTransferDecision(
  runId: string,
  interventionsInRun: Intervention[]
): boolean {
  const hintsInRun = interventionsInRun.filter(
    (i) => i.run_id === runId && i.intervention_type === "hint"
  );
  return hintsInRun.length === 0;
}

// ── judgeTransferEvidence ─────────────────────────────────────────
/**
 * 判断一个决策事件是否可作为迁移证据。
 *
 * 迁移证据的充要条件（来自 Issue #12 验收标准）：
 * 1. 决策所在世界是陌生世界（不在训练世界列表中）。
 * 2. run 内没有任何 hint 干预（决策独立性）。
 * 3. 行为观察置信度 >= medium（证据质量足够）。
 *
 * 若不满足以上全部条件：
 * - 有 hint → evidence_type = "assisted"
 * - 置信度不足 → 保持原 evidence_type，不升级为 transfer
 * - 世界不陌生 → 不构成迁移，保持原 evidence_type
 */
export function judgeTransferEvidence(
  input: TransferJudgmentInput
): TransferJudgmentResult {
  const {
    training_world_ids,
    transfer_world_id,
    decision_run_id,
    evidence,
    interventions_in_run,
    observation_confidence,
  } = input;

  // 条件 1：世界必须是陌生的（不在训练世界列表中）
  const isNovelWorld = !training_world_ids.includes(transfer_world_id);
  if (!isNovelWorld) {
    return {
      qualifies_as_transfer: false,
      evidence_type: evidence.evidence_type,
      updated_evidence: { ...evidence },
      reason:
        `世界 "${transfer_world_id}" 是训练世界之一，` +
        `同世界修正只表示理解反馈，不产生迁移证据。`,
    };
  }

  // 条件 2：决策必须是独立的（run 内无 hint）
  const isIndependent = isIndependentTransferDecision(
    decision_run_id,
    interventions_in_run
  );
  if (!isIndependent) {
    const updatedEvidence: HypothesisEvidence = {
      ...evidence,
      evidence_type: "assisted",
    };
    return {
      qualifies_as_transfer: false,
      evidence_type: "assisted",
      updated_evidence: updatedEvidence,
      reason:
        `run "${decision_run_id}" 中存在 hint 干预，` +
        `决策不具备独立性，证据标记为辅助证据（assisted），不升级为迁移证据。`,
    };
  }

  // 条件 3：观察置信度必须达到门槛
  if (!TRANSFER_ELIGIBLE_CONFIDENCE.has(observation_confidence)) {
    return {
      qualifies_as_transfer: false,
      evidence_type: evidence.evidence_type,
      updated_evidence: { ...evidence },
      reason:
        `行为观察置信度为 "${observation_confidence}"，` +
        `证据质量不足以作为迁移结论（需要 medium 或 high）。`,
    };
  }

  // 全部条件满足 → 升级为迁移证据
  const updatedEvidence: HypothesisEvidence = {
    ...evidence,
    evidence_type: "transfer",
    transfer_world_id,
  };

  return {
    qualifies_as_transfer: true,
    evidence_type: "transfer",
    updated_evidence: updatedEvidence,
    reason:
      `世界 "${transfer_world_id}" 是陌生领域，决策独立（无 hint），` +
      `观察置信度为 "${observation_confidence}"，` +
      `符合迁移证据的全部条件。迁移结论引用陌生世界中的独立 decision event。`,
  };
}
