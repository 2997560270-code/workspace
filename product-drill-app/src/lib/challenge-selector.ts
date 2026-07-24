import type { TransferRole } from "./causal-world";

// ── 候选世界描述 ──────────────────────────────────────────────────
export type CandidateWorld = {
  world_id: string;
  transfer_role: TransferRole;
  domain: string;
};

// ── 用于选择决策的假设摘要 ────────────────────────────────────────
export type HypothesisSummary = {
  habit_name: string;
  confidence: "high" | "medium" | "low" | "insufficient";
  supporting_evidence_count: number;
  counter_evidence_count: number;
  /** 已完成（有决策事件）的 world_id 列表 */
  completed_world_ids: string[];
};

// ── 选择结果 ──────────────────────────────────────────────────────
export type ChallengeSelectorResult = {
  world_id: string;
  transfer_role: TransferRole;
  is_transfer_test: boolean;
  /** 同一世界修正轮次（理解性反馈，不产生迁移证据）*/
  is_remediation: boolean;
  reason: string;
};

// ── 内部常量 ──────────────────────────────────────────────────────
/**
 * 允许进入迁移测试的最低置信度。
 * "low" 和 "insufficient" 不足以进入 transfer_test 世界。
 */
const TRANSFER_ELIGIBLE_CONFIDENCE = new Set<HypothesisSummary["confidence"]>([
  "medium",
  "high",
]);

/**
 * 按 transfer_role 的自然学习顺序排列。
 * transfer_test 仅在最后且满足置信度条件后才可选择。
 */
const ROLE_ORDER: TransferRole[] = ["calibration", "intervention", "transfer_test"];

// ── 选择算法 ──────────────────────────────────────────────────────
/**
 * 根据当前假设状态，从三个候选世界中按确定性规则选择下一个挑战。
 *
 * 规则（优先级从高到低）：
 * 1. 若尚未完成任何世界，选择 calibration 世界（建立基线）。
 * 2. 若 transfer_test 世界未完成，但置信度不足（low/insufficient），
 *    且已完成所有 calibration/intervention 世界，触发修正轮次（is_remediation=true）：
 *    选择 counter_evidence 最多的已完成世界重新练习。
 * 3. 按 ROLE_ORDER 顺序，选择第一个未完成的世界；
 *    transfer_test 世界还需满足置信度条件。
 * 4. 若所有世界均已完成，重新从第一个开始（round-robin）。
 */
export function selectNextChallenge(
  candidates: CandidateWorld[],
  hypothesis: HypothesisSummary
): ChallengeSelectorResult {
  const completedSet = new Set(hypothesis.completed_world_ids);

  // 按 ROLE_ORDER 排列候选世界
  const ordered = ROLE_ORDER.flatMap((role) =>
    candidates.filter((w) => w.transfer_role === role)
  );

  const calibrationWorlds = ordered.filter((w) => w.transfer_role === "calibration");
  const interventionWorlds = ordered.filter((w) => w.transfer_role === "intervention");
  const transferWorlds = ordered.filter((w) => w.transfer_role === "transfer_test");

  // ── 规则 1：没有完成任何世界，从第一个 calibration 开始 ─────────
  if (completedSet.size === 0) {
    const first = calibrationWorlds[0] ?? ordered[0];
    return {
      world_id: first.world_id,
      transfer_role: first.transfer_role,
      is_transfer_test: false,
      is_remediation: false,
      reason: "尚未完成任何世界，从校准世界（calibration）开始建立行为基线。",
    };
  }

  const allPreTransferDone =
    [...calibrationWorlds, ...interventionWorlds].every((w) =>
      completedSet.has(w.world_id)
    );

  // ── 规则 2：所有前置世界已完成，但置信度不足 → 修正轮次 ─────────
  if (allPreTransferDone && !TRANSFER_ELIGIBLE_CONFIDENCE.has(hypothesis.confidence)) {
    // 选择 counter_evidence 最多的已完成世界（最需要强化的）
    // 简单策略：选 counter_evidence_count > 0 且已完成的世界，
    // 否则选第一个 calibration 世界
    const remediationTarget =
      calibrationWorlds.find((w) => completedSet.has(w.world_id)) ??
      interventionWorlds.find((w) => completedSet.has(w.world_id)) ??
      calibrationWorlds[0] ??
      ordered[0];

    return {
      world_id: remediationTarget.world_id,
      transfer_role: remediationTarget.transfer_role,
      is_transfer_test: false,
      is_remediation: true,
      reason:
        `假设置信度为 "${hypothesis.confidence}"，未达到迁移测试门槛。` +
        `返回 ${remediationTarget.world_id} 进行修正练习（同世界理解反馈，不产生迁移证据）。`,
    };
  }

  // ── 规则 3：按顺序选择第一个未完成的世界 ───────────────────────
  for (const world of ordered) {
    if (completedSet.has(world.world_id)) continue;

    if (world.transfer_role === "transfer_test") {
      if (!TRANSFER_ELIGIBLE_CONFIDENCE.has(hypothesis.confidence)) {
        // 跳过 transfer_test，继续找其他未完成世界
        continue;
      }
      return {
        world_id: world.world_id,
        transfer_role: world.transfer_role,
        is_transfer_test: true,
        is_remediation: false,
        reason:
          `已完成前置世界，假设置信度为 "${hypothesis.confidence}"，` +
          `满足迁移测试条件，进入陌生领域世界 ${world.world_id}。`,
      };
    }

    return {
      world_id: world.world_id,
      transfer_role: world.transfer_role,
      is_transfer_test: false,
      is_remediation: false,
      reason: `已完成 ${completedSet.size} 个世界，下一个按顺序进入 ${world.transfer_role} 世界 ${world.world_id}。`,
    };
  }

  // ── 规则 4：所有世界均已完成，round-robin 从第一个开始 ──────────
  const first = ordered[0];
  return {
    world_id: first.world_id,
    transfer_role: first.transfer_role,
    is_transfer_test: false,
    is_remediation: false,
    reason: "所有候选世界均已完成，重新从第一个世界开始（循环）。",
  };
}
