/**
 * challenge-client.ts — Challenge API 的 fetch 封装
 *
 * 所有请求均在 Server 端路由处理，客户端通过 /api/challenge-runs 调用。
 * demo 模式（无 Supabase）时 API 仍可响应，返回 unofficial=true 数据。
 */
import type {
  ChallengeRunResponse,
  DecisionEventResponse,
} from "./api/challenge-schemas";
import type { DecisionDraft } from "./workbench-state";

// ── 通用 fetch 工具 ───────────────────────────────────────────────
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Challenge Run ─────────────────────────────────────────────────

/** 创建新的 challenge run，返回 run 元数据 */
export async function createChallengeRun(
  worldId: string,
  worldVersion: string
): Promise<ChallengeRunResponse> {
  return apiPost<ChallengeRunResponse>("/api/challenge-runs", {
    world_id: worldId,
    world_version: worldVersion,
  });
}

// ── World Events ──────────────────────────────────────────────────

/** 追加用户动作事件，返回带 narratedResponse 的事件 id */
export async function appendAction(
  runId: string,
  params: {
    sequence_index: number;
    actor: "user" | "world" | "system";
    event_type: "user_action" | "world_response" | "reveal" | "intervention";
    payload: Record<string, string>;
  }
): Promise<{ event_id: string; narration?: string; unofficial: boolean }> {
  return apiPost(`/api/challenge-runs/${runId}/actions`, params);
}

// ── Decisions ─────────────────────────────────────────────────────

/** 提交决策事件（后果揭示前），返回 decision event id */
export async function submitDecision(
  runId: string,
  draft: DecisionDraft,
  worldEventId: string
): Promise<DecisionEventResponse> {
  return apiPost<DecisionEventResponse>(
    `/api/challenge-runs/${runId}/decisions`,
    {
      world_event_id: worldEventId,
      judgment: draft.judgment,
      chosen_action: draft.chosen_action,
      expected_outcome: draft.expected_outcome,
      confidence: draft.confidence,
      rejected_alternatives: draft.rejected_alternatives,
      evidence_basis: draft.evidence_basis,
    }
  );
}

// ── Reveal ────────────────────────────────────────────────────────

/** 揭示后果，返回更新后的 decision event */
export async function revealConsequences(
  runId: string,
  decisionEventId: string
): Promise<DecisionEventResponse> {
  return apiPost<DecisionEventResponse>(
    `/api/challenge-runs/${runId}/reveal`,
    { decision_event_id: decisionEventId }
  );
}

// ── Interventions ─────────────────────────────────────────────────

export type InterventionResponse = {
  id: string;
  intervention_type: string;
  content: string;
  triggered_at: string;
};

/** 记录干预（hint / feedback / counterfactual / reveal_consequence） */
export async function recordIntervention(
  runId: string,
  params: {
    decision_event_id: string | null;
    intervention_type: "hint" | "feedback" | "counterfactual" | "reveal_consequence";
    content: string;
  }
): Promise<InterventionResponse> {
  return apiPost<InterventionResponse>(
    `/api/challenge-runs/${runId}/interventions`,
    params
  );
}

// ── Judgment Profile ──────────────────────────────────────────────

import type { JudgmentProfile } from "./judgment-profile-builder";

export async function fetchJudgmentProfile(): Promise<JudgmentProfile> {
  return apiGet<JudgmentProfile>("/api/judgment-profile");
}
