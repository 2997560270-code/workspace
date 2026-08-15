"use client";

/**
 * world-workbench.tsx — 世界工作台主组件
 *
 * 阶段：investigate → commit → reveal → reflect
 *
 * 设计约束（Issue #4）：
 * - 不依赖固定 TrainingStage 控制新主链路
 * - 后果揭示前必须完成 decision event
 * - 提示状态（辅助）和独立状态对用户可辨认
 * - 复用 globals.css 设计系统，不引入无关 UI 重写
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  createWorkbenchState,
  commitToDecisionPhase,
  recordHintUsed,
  recordDecisionSubmitted,
  advanceToReveal,
  advanceToReflect,
  canRevealConsequences,
  buildDecisionPayload,
  type WorkbenchState,
  type DecisionDraft,
} from "../lib/workbench-state";
import {
  createChallengeRun,
  appendAction,
  fetchNextChallenge,
  submitDecision,
  revealConsequences,
  recordIntervention,
} from "../lib/challenge-client";
import { buildInterventionContent } from "../lib/intervention-generator";
import {
  isAmbiguousLearnerAction,
  type CausalFallbackReason,
} from "../lib/ai/causal-pipeline";
import {
  DEMO_WORLDS,
  allowsPreDecisionHint,
  getDemoWorld,
  getNextDemoWorld,
  type WorldSeed,
} from "../lib/world-seeds";
import { DISCOVERY_DIMENSIONS, type DiscoveryDimension } from "../lib/behavior-claims";
import type { NextChallengeSelection } from "../lib/challenge-selection";
import type { InterventionApiResponse } from "../lib/challenge-client";
import {
  getInvestigationSuggestion,
  getMatchedRevealFactIds,
  getRelevantInformationGapReply,
  isWorldRelevantAction,
} from "../lib/causal-world";
import { trackClientEvent } from "../lib/analytics/client";
import {
  CAUSAL_EVENTS,
  buildChallengeStartedProps,
  buildInvestigationActionProps,
  buildDecisionCommittedProps,
  buildConsequenceRevealedProps,
  buildInterventionReceivedProps,
  buildTransferEvidenceProps,
} from "../lib/causal-analytics";

// ── 类型 ──────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "user" | "world";
  content: string;
  event_id?: string;
};

type WorkbenchProps = {
  /** 初始世界 id，若不传则由工作台自行按选择规则决定 */
  initialWorldId?: string;
  onClose: () => void;
  /** run 完成后回调，用于更新父组件状态 */
  onRunComplete?: (worldId: string, nextChallenge?: NextChallengeSelection) => void;
};

// ── 工具函数 ──────────────────────────────────────────────────────

let _msgId = 0;
function nextMsgId() { return `msg-${++_msgId}`; }

function worldMessage(content: string, eventId?: string): Message {
  return { id: nextMsgId(), role: "world", content, event_id: eventId };
}

function userMessage(content: string, eventId?: string): Message {
  return { id: nextMsgId(), role: "user", content, event_id: eventId };
}

function getFallbackNotice(reason: CausalFallbackReason): string {
  const notices: Record<CausalFallbackReason, string> = {
    model_not_configured: "\u5f53\u524d\u672a\u914d\u7f6e\u6a21\u578b\uff0c\u672c\u6b21\u56de\u590d\u7531\u53d7\u6cbb\u7406\u7684\u672c\u5730\u89c4\u5219\u5b8c\u6210\u3002",
    request_failed: "\u6a21\u578b\u8bf7\u6c42\u5931\u8d25\uff0c\u672c\u6b21\u56de\u590d\u5df2\u5207\u6362\u4e3a\u53d7\u6cbb\u7406\u7684\u672c\u5730\u89c4\u5219\u3002",
    response_parse_failed: "\u6a21\u578b\u8fd4\u56de\u65e0\u6cd5\u89e3\u6790\uff0c\u672c\u6b21\u56de\u590d\u5df2\u5207\u6362\u4e3a\u53d7\u6cbb\u7406\u7684\u672c\u5730\u89c4\u5219\u3002",
    schema_validation_failed: "\u6a21\u578b\u8fd4\u56de\u672a\u901a\u8fc7\u7ed3\u6784\u6821\u9a8c\uff0c\u672c\u6b21\u56de\u590d\u5df2\u5207\u6362\u4e3a\u53d7\u6cbb\u7406\u7684\u672c\u5730\u89c4\u5219\u3002",
    grounding_validation_failed: "\u6a21\u578b\u56de\u590d\u672a\u901a\u8fc7\u4e16\u754c\u4e8b\u5b9e\u6821\u9a8c\uff0c\u672c\u6b21\u56de\u590d\u5df2\u5207\u6362\u4e3a\u53d7\u6cbb\u7406\u7684\u672c\u5730\u89c4\u5219\u3002",
  };
  return notices[reason];
}

function getEvidenceNotice(reason: "ambiguous_input" | "irrelevant_input" | "no_new_fact"): string {
  const notices = {
    ambiguous_input: "\u8fd9\u6b21\u8f93\u5165\u8fd8\u4e0d\u8db3\u4ee5\u5f62\u6210\u8c03\u67e5\u8bc1\u636e\uff0c\u8bf7\u8865\u5145\u5177\u4f53\u95ee\u9898\u6216\u884c\u52a8\u3002",
    irrelevant_input: "\u8fd9\u6b21\u8f93\u5165\u4e0e\u5f53\u524d\u4e16\u754c\u5173\u8054\u4e0d\u8db3\uff0c\u672a\u8ba1\u5165\u6b63\u5f0f\u8bc1\u636e\u3002",
    no_new_fact: "\u8fd9\u6b21\u8c03\u67e5\u6ca1\u6709\u63ed\u793a\u65b0\u7684\u4e16\u754c\u4e8b\u5b9e\uff0c\u6682\u4e0d\u8ba1\u5165\u6b63\u5f0f\u8bc1\u636e\u3002\u53ef\u6362\u4e00\u4e2a\u80fd\u786e\u8ba4\u6d41\u7a0b\u3001\u5f71\u54cd\u6216\u66ff\u4ee3\u65b9\u6848\u7684\u95ee\u9898\u3002",
  } as const;
  return notices[reason];
}

// ── 子组件：阶段标签 ──────────────────────────────────────────────

function PhaseTag({
  phase,
  wasAssisted,
}: {
  phase: WorkbenchState["phase"];
  wasAssisted: boolean;
}) {
  const labels: Record<WorkbenchState["phase"], string> = {
    investigate: "调查中",
    commit:      "决策承诺",
    reveal:      "后果揭示",
    reflect:     "反思",
  };
  return (
    <span className="wb-phase-tag">
      {labels[phase]}
      {wasAssisted ? (
        <span className="wb-assisted-badge" title="本次决策前使用了提示，证据将标记为辅助">
          提示辅助
        </span>
      ) : (
        <span className="wb-independent-badge" title="本次决策前尚未使用提示">
          独立进行
        </span>
      )}
    </span>
  );
}

// ── 子组件：决策表单 ──────────────────────────────────────────────

function DecisionForm({
  draft,
  onChange,
  onSubmit,
  busy,
  eventIds,
}: {
  draft: DecisionDraft;
  onChange: (d: DecisionDraft) => void;
  onSubmit: () => void;
  busy: boolean;
  eventIds: string[];
}) {
  const isValid = buildDecisionPayload(draft) !== null;

  function field(
    label: string,
    key: keyof DecisionDraft,
    placeholder: string,
    rows = 2
  ) {
    const value = draft[key];
    return (
      <div className="wb-field">
        <label htmlFor={`wb-${key}`}>{label}</label>
        <textarea
          disabled={busy}
          id={`wb-${key}`}
          onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
          placeholder={placeholder}
          rows={rows}
          value={typeof value === "string" ? value : ""}
        />
      </div>
    );
  }

  return (
    <div className="wb-decision-form surface">
      <span className="section-kicker">决策承诺（后果揭示前必须完成）</span>
      <p className="wb-form-notice">
        在这里写下你的判断和行动方案。提交后才会揭示世界的实际后果，不可撤回。
      </p>

      {field("你的判断（问题是什么）", "judgment", "例如：真正的问题是数据编码不一致，而不是缺少展示工具", 3)}
      {field("你的行动方案", "chosen_action", "例如：建议先统一数据编码，再评估大屏必要性", 2)}
      {field("预期结果", "expected_outcome", "例如：数据整理时间从每周6小时缩短到1小时以内", 2)}

      <div className="wb-field">
        <label htmlFor="wb-confidence">置信度</label>
        <select
          disabled={busy}
          id="wb-confidence"
          onChange={(e) =>
            onChange({ ...draft, confidence: e.target.value as DecisionDraft["confidence"] })
          }
          value={draft.confidence}
        >
          <option value="high">高 — 证据充分，我很确定</option>
          <option value="medium">中 — 有一定证据但仍有不确定性</option>
          <option value="low">低 — 信息不足，这是我的最优猜测</option>
        </select>
      </div>

      <div className="wb-field">
        <label htmlFor="wb-rejected">放弃的方案（可选，多行分隔）</label>
        <textarea
          disabled={busy}
          id="wb-rejected"
          onChange={(e) =>
            onChange({
              ...draft,
              rejected_alternatives: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="例如：直接建大屏&#10;全面重构系统"
          rows={2}
          value={draft.rejected_alternatives.join("\n")}
        />
      </div>

      <div className="wb-field">
        <label>引用的调查事件（{eventIds.length} 个可用）</label>
        <div className="wb-evidence-checkboxes">
          {eventIds.length === 0 ? (
            <span className="wb-no-evidence">尚无调查事件可引用</span>
          ) : (
            eventIds.map((eid) => (
              <label className="wb-evidence-check" key={eid}>
                <input
                  checked={draft.evidence_basis.includes(eid)}
                  disabled={busy}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      evidence_basis: e.target.checked
                        ? [...draft.evidence_basis, eid]
                        : draft.evidence_basis.filter((id) => id !== eid),
                    })
                  }
                  type="checkbox"
                />
                <span>{eid.slice(0, 16)}…</span>
              </label>
            ))
          )}
        </div>
      </div>

      <button
        className="button button-primary"
        disabled={busy || !isValid}
        onClick={onSubmit}
        type="button"
      >
        {busy ? "提交中…" : "提交决策（不可撤回）"}
      </button>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────

const EMPTY_DRAFT: DecisionDraft = {
  judgment: "",
  chosen_action: "",
  expected_outcome: "",
  confidence: "medium",
  rejected_alternatives: [],
  evidence_basis: [],
};

export function WorldWorkbench({ initialWorldId, onClose, onRunComplete }: WorkbenchProps) {
  const [world, setWorld] = useState<WorldSeed | null>(null);
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [discoveryDimension, setDiscoveryDimension] = useState<DiscoveryDimension>("workflow");
  const [draft, setDraft] = useState<DecisionDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [revealContent, setRevealContent] = useState("");
  const [reflectContent, setReflectContent] = useState("");
  const [nextChallenge, setNextChallenge] = useState<NextChallengeSelection | null>(null);
  const [evaluation, setEvaluation] = useState<InterventionApiResponse["evaluation"]>(null);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [userEventIds, setUserEventIds] = useState<string[]>([]);
  const [eligibleEvidenceEventIds, setEligibleEvidenceEventIds] = useState<string[]>([]);
  const [evidenceDimensions, setEvidenceDimensions] = useState<Record<string, DiscoveryDimension>>({});
  const [seqIndex, setSeqIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 选择起始世界
  useEffect(() => {
    const seed = initialWorldId
      ? getDemoWorld(initialWorldId)
      : DEMO_WORLDS.find((w) => w.transfer_role === "calibration");
    if (!seed) return;
    setWorld(seed);

    const initial = createWorkbenchState(seed.world_id, seed.version.version);
    setState(initial);
    setMessages([
      worldMessage(seed.version.trigger_statement),
    ]);
  }, [initialWorldId]);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── 初始化 run ──────────────────────────────────────────────────
  useEffect(() => {
    if (!world || !state || state.run_id) return;
    let cancelled = false;
    setBusy(true);
    createChallengeRun(world.world_id, world.version.version)
      .then((run) => {
        if (cancelled) return;
        setState((prev) => prev ? { ...prev, run_id: run.id } : prev);
        // #3 analytics: challenge_started
        trackClientEvent(
          world.version.transfer_role === "transfer_test"
            ? CAUSAL_EVENTS.transferChallengeStarted
            : CAUSAL_EVENTS.challengeStarted,
          buildChallengeStartedProps({
            worldId: world.world_id,
            worldVersion: world.version.version,
            transferRole: world.version.transfer_role,
            runId: run.id,
          })
        );
      })
      .catch(() => {
        if (cancelled) return;
        // demo mode: use a fake run id
        setState((prev) => prev ? { ...prev, run_id: `demo-run-${Date.now()}` } : prev);
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world?.world_id]);

  // ── 发送调查动作 ────────────────────────────────────────────────
  async function sendAction() {
    const content = input.trim();
    if (!content || busy || !state?.run_id || !world) return;
    setInput("");
    setBusy(true);
    setError("");
    setActionNotice("");

    const userIdx = seqIndex;
    // Fix (MEDIUM): increment by 1 per event — the world-response slot is
    // submitted by the server, not reserved client-side.
    setSeqIndex((n) => n + 1);

    // 乐观更新：先加用户消息
    const tmpUserId = nextMsgId();
    setMessages((prev) => [...prev, { id: tmpUserId, role: "user", content }]);

    try {
      const result = await appendAction(state.run_id, {
        sequence_index: userIdx,
        actor: "user",
        event_type: "user_action",
        payload: { text: content, discovery_dimension: discoveryDimension },
      });

      // 记录 user event id（供决策引用）
      setUserEventIds((prev) => {
        const next = [...prev, result.event_id];
        // #3 analytics: investigation_action_committed
        if (world && state) {
          trackClientEvent(CAUSAL_EVENTS.investigationActionCommitted,
            buildInvestigationActionProps({
              worldId: world.world_id,
              worldVersion: world.version.version,
              runId: state.run_id ?? result.event_id,
              actionCount: next.length,
            })
          );
        }
        return next;
      });
      if (result.evidence_eligible && result.discovery_dimension) {
        setEligibleEvidenceEventIds((prev) => [...prev, result.event_id]);
        setEvidenceDimensions((prev) => ({
          ...prev,
          [result.event_id]: result.discovery_dimension!,
        }));
        setDraft((current) => current.evidence_basis.includes(result.event_id)
          ? current
          : { ...current, evidence_basis: [...current.evidence_basis, result.event_id] });
      }

      // 更新消息（含 narration）
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tmpUserId
            ? { ...m, event_id: result.event_id }
            : m
        )
      );

      const fallbackNotice = result.fallback_reason
        ? getFallbackNotice(result.fallback_reason)
        : "";
      const evidenceNotice = result.evidence_reason !== "eligible"
        ? getEvidenceNotice(result.evidence_reason)
        : "";
      setActionNotice([fallbackNotice, evidenceNotice].filter(Boolean).join("\n"));

      if (result.narration) {
        setMessages((prev) => [...prev, worldMessage(result.narration!, result.event_id)]);
      }
    } catch {
      // 离线降级：生成本地 event id，确保决策表单可引用
      const localEventId = `local-evt-${Date.now()}-${userIdx}`;
      const seed = world.version;
      const matchedFactIds = getMatchedRevealFactIds(seed, content);
      setUserEventIds((prev) => [...prev, localEventId]);
      const localEvidenceEligible =
        !isAmbiguousLearnerAction(content) &&
        isWorldRelevantAction(seed, content) &&
        matchedFactIds.length > 0;
      if (localEvidenceEligible) {
        setEligibleEvidenceEventIds((prev) => [...prev, localEventId]);
        setEvidenceDimensions((prev) => ({ ...prev, [localEventId]: discoveryDimension }));
        setDraft((current) => current.evidence_basis.includes(localEventId)
          ? current
          : { ...current, evidence_basis: [...current.evidence_basis, localEventId] });
      }
      setMessages((prev) =>
        prev.map((m) => m.id === tmpUserId ? { ...m, event_id: localEventId } : m)
      );

      const matchedFacts = seed.immutable_rules.hidden_facts.filter((fact) =>
        matchedFactIds.includes(fact.id)
      );
      const narration = matchedFacts.length > 0
        ? matchedFacts.map((fact) => fact.content).join("；")
        : isWorldRelevantAction(seed, content)
          ? getRelevantInformationGapReply(seed, content)
          : getInvestigationSuggestion(seed);

      setMessages((prev) => [...prev, worldMessage(narration)]);
      setActionNotice(getFallbackNotice("request_failed"));
      setError("离线演示模式：动作已记录，叙述由本地规则生成。");
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendAction();
    }
  }

  // ── 使用提示 ────────────────────────────────────────────────────
  async function useHint() {
    if (!state?.run_id || busy || !world || !allowsPreDecisionHint(world)) return;
    setBusy(true);
    setError("");

    // 构造提示内容（本地生成，决策前触发）
    const hintContent = buildInterventionContent({
      decision: {
        id: "pending",
        run_id: state.run_id,
        world_event_id: "pending",
        judgment: "",
        chosen_action: "",
        expected_outcome: "",
        confidence: "low",
        rejected_alternatives: [],
        evidence_basis: [],
        consequences_revealed: false,
        created_at: new Date().toISOString(),
      },
      missing_dimensions: ["workflow", "consequence", "alternative"],
      world_trigger: world.version.trigger_statement,
      intervention_type: "hint",
    });

    try {
      const result = await recordIntervention(state.run_id, {
        decision_event_id: null,
        intervention_type: "hint",
        content: hintContent,
      });
      setState((prev) => prev ? recordHintUsed(prev, result.intervention.id) : prev);
      setMessages((prev) => [...prev, worldMessage(`💡 提示：${hintContent}`)]);
      // #3 analytics: intervention_received
      trackClientEvent(CAUSAL_EVENTS.interventionReceived,
        buildInterventionReceivedProps({
          worldId: world.world_id,
          worldVersion: world.version.version,
          runId: state.run_id,
          interventionType: "hint",
        })
      );
    } catch {
      // offline: still mark assisted
      setState((prev) => prev ? recordHintUsed(prev, `local-hint-${Date.now()}`) : prev);
      setMessages((prev) => [...prev, worldMessage(`💡 提示：${hintContent}`)]);
    } finally {
      setBusy(false);
    }
  }

  // ── 进入决策阶段 ────────────────────────────────────────────────
  function enterCommitPhase() {
    setState((prev) => prev ? commitToDecisionPhase(prev) : prev);
  }

  // ── 提交决策 ────────────────────────────────────────────────────
  async function handleSubmitDecision() {
    if (!state?.run_id || busy) return;
    const payload = buildDecisionPayload(draft);
    if (!payload) return;

    setBusy(true);
    setError("");

    // world_event_id: 使用最后一个用户调查事件，若无则用 run_id 作占位
    const worldEventId = userEventIds.at(-1) ?? state.run_id;

    try {
      const result = await submitDecision(state.run_id, draft, worldEventId);
      setState((prev) =>
        prev ? recordDecisionSubmitted(prev, result.id) : prev
      );
      // #3 analytics: decision_committed
      if (world) {
        trackClientEvent(CAUSAL_EVENTS.decisionCommitted,
          buildDecisionCommittedProps({
            worldId: world.world_id,
            worldVersion: world.version.version,
            runId: state.run_id,
            wasAssisted: state.was_assisted,
            evidenceBasisCount: draft.evidence_basis.length,
            confidence: draft.confidence,
          })
        );
      }
      setMessages((prev) => [
        ...prev,
        worldMessage("✅ 决策已提交。点击「揭示后果」查看世界的实际反应。"),
      ]);
    } catch (err) {
      // offline fallback: generate a local decision id
      const localDecId = `local-dec-${Date.now()}`;
      setState((prev) =>
        prev ? recordDecisionSubmitted(prev, localDecId) : prev
      );
      setMessages((prev) => [
        ...prev,
        worldMessage("[演示模式] 决策已在本地记录，后果将由规则生成。"),
      ]);
      setError("离线演示模式：决策记录在本地。");
    } finally {
      setBusy(false);
    }
  }

  // ── 揭示后果 ────────────────────────────────────────────────────
  async function handleReveal() {
    if (!state?.run_id || !state.decision_event_id || busy) return;
    setBusy(true);
    setError("");

    const rules = world?.version.immutable_rules.causal_rules ?? [];
    const isPrematurePath = eligibleEvidenceEventIds.length === 0;
    const rule =
      rules.find((r) => r.consequence_path === (isPrematurePath ? "premature" : "investigated"))
      ?? rules[0];

    const buildContent = (prefix: string) =>
      rule
        ? `${prefix}后果揭示：${rule.short_term}\n\n反事实路径：${rule.counterfactual}`
        : `${prefix}后果已揭示。`;

    try {
      await revealConsequences(state.run_id, state.decision_event_id);
      const content = buildContent("");
      try {
        await recordIntervention(state.run_id, {
          decision_event_id: state.decision_event_id,
          intervention_type: "reveal_consequence",
          content,
        });
      } catch {
        // Revealing the governed consequence remains successful even if its
        // timeline annotation cannot be persisted.
      }
      setState((prev) => prev ? advanceToReveal(prev) : prev);
      setRevealContent(content);
      setMessages((prev) => [...prev, worldMessage(`🔍 ${content}`)]);
      // #3 analytics: consequence_revealed
      if (world) {
        trackClientEvent(CAUSAL_EVENTS.consequenceRevealed,
          buildConsequenceRevealedProps({
            worldId: world.world_id,
            worldVersion: world.version.version,
            runId: state.run_id,
          })
        );
      }
    } catch {
      const content = buildContent("[演示模式] ");
      setState((prev) => prev ? advanceToReveal(prev) : prev);
      setRevealContent(content);
      setMessages((prev) => [...prev, worldMessage(`🔍 ${content}`)]);
    } finally {
      setBusy(false);
    }
  }

  // ── 进入反思阶段 ────────────────────────────────────────────────
  async function handleAdvanceToReflect() {
    if (!state?.run_id || busy || !world) return;
    setBusy(true);
    setError("");
    setFeedbackStatus("正在核对调查证据…");
    const profileTimer = window.setTimeout(
      () => setFeedbackStatus("正在更新判断画像…"),
      4_000
    );
    const selectionTimer = window.setTimeout(
      () => setFeedbackStatus("正在确定闭环状态…"),
      9_000
    );

    const coveredDimensions = new Set(
      draft.evidence_basis.flatMap((eventId) => {
        const dimension = evidenceDimensions[eventId];
        return dimension ? [dimension] : [];
      })
    );
    const missingDims = DISCOVERY_DIMENSIONS.filter(
      (dimension) => !coveredDimensions.has(dimension)
    );

    const feedbackContent = buildInterventionContent({
      decision: {
        id: state.decision_event_id ?? "unknown",
        run_id: state.run_id,
        world_event_id: userEventIds.at(-1) ?? state.run_id,
        judgment: draft.judgment,
        chosen_action: draft.chosen_action,
        expected_outcome: draft.expected_outcome,
        confidence: draft.confidence,
        rejected_alternatives: draft.rejected_alternatives,
        evidence_basis: draft.evidence_basis,
        consequences_revealed: true,
        created_at: new Date().toISOString(),
      },
      missing_dimensions: missingDims,
      world_trigger: world.version.trigger_statement,
      intervention_type: "feedback",
    });

    let response: InterventionApiResponse | null = null;
    try {
      if (state.run_id && state.decision_event_id) {
        response = await recordIntervention(state.run_id, {
          decision_event_id: state.decision_event_id,
          intervention_type: "feedback",
          content: feedbackContent,
        });
      }
    } catch {
      if (!state.run_id.startsWith("demo-run-")) {
        window.clearTimeout(profileTimer);
        window.clearTimeout(selectionTimer);
        setFeedbackStatus("");
        setError("证据反馈生成失败，请点击“查看证据反馈”重试。");
        setBusy(false);
        return;
      }
    }

    setEvaluation(response?.evaluation ?? null);
    setNextChallenge(response?.next_challenge ?? null);
    if (response && !response.next_challenge && state.run_id) {
      try {
        setNextChallenge(await fetchNextChallenge());
      } catch {
        // Keep the deterministic local fallback when the selection endpoint is unavailable.
      }
    }
    setReflectContent(response?.intervention.content ?? feedbackContent);
    setState((prev) => prev ? advanceToReflect(prev) : prev);
    window.clearTimeout(profileTimer);
    window.clearTimeout(selectionTimer);
    setFeedbackStatus("");
    setBusy(false);
  }

  // ── 完成本轮 ────────────────────────────────────────────────────
  function handleFinish() {
    // #3 analytics: transfer_evidence_recorded (只对 transfer_test 世界触发)
    if (
      world?.version.transfer_role === "transfer_test" &&
      state?.run_id &&
      evaluation?.evidence_type
    ) {
      trackClientEvent(CAUSAL_EVENTS.transferEvidenceRecorded,
        buildTransferEvidenceProps({
          worldId: world.world_id,
          worldVersion: world.version.version,
          runId: state.run_id,
          evidenceType: evaluation.evidence_type,
        })
      );
    }
    if (world && onRunComplete) {
      onRunComplete(world.world_id, nextChallenge ?? undefined);
      return;
    }
    onClose();
  }

  if (!world || !state) {
    return (
      <div className="wb-loading surface">
        <p>加载世界中…</p>
      </div>
    );
  }

  const worldNumber = DEMO_WORLDS.findIndex((item) => item.world_id === world.world_id) + 1;
  const fallbackNextWorld = getNextDemoWorld(world.world_id);
  const nextWorld = nextChallenge ? getDemoWorld(nextChallenge.world_id) : fallbackNextWorld;
  const loopComplete = nextChallenge?.loop_complete ?? false;

  return (
    <div className="world-workbench">
      {/* 顶栏 */}
      <header className="wb-header surface">
        <div className="wb-header-left">
          <button className="back-button" onClick={onClose} type="button">← 返回</button>
          <div>
            <span className="section-kicker">世界 {worldNumber} / {DEMO_WORLDS.length} · {world.domain} · {world.transfer_role}</span>
            <h2>{world.title}</h2>
          </div>
        </div>
        <PhaseTag phase={state.phase} wasAssisted={state.was_assisted} />
      </header>

      {error && (
        <div className="wb-error-banner" role="alert">{error}</div>
      )}
      {actionNotice && (
        <div aria-live="polite" className="wb-notice-banner" role="status">
          {actionNotice.split("\n").map((line) => <span key={line}>{line}</span>)}
        </div>
      )}

      {/* 主体：对话 + 工具栏 */}
      <div className="wb-body">
        {/* 左：对话时间线 */}
        <section className="wb-timeline surface">
          <div className="wb-messages" aria-live="polite">
            {messages.map((m) => (
              <article className={`wb-message wb-message-${m.role}`} key={m.id}>
                <span className="wb-message-role">
                  {m.role === "world" ? "世界" : "你"}
                </span>
                <p>{m.content}</p>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 输入区（仅 investigate 阶段） */}
          {state.phase === "investigate" && (
            <div className="wb-composer">
              <div className="wb-dimension-picker" aria-label="本次调查维度">
                <span className="detail-label">本次调查维度</span>
                <div className="wb-dimension-options">
                  {DISCOVERY_DIMENSIONS.map((dimension) => (
                    <button
                      aria-pressed={discoveryDimension === dimension}
                      className={discoveryDimension === dimension ? "active" : ""}
                      disabled={busy}
                      key={dimension}
                      onClick={() => setDiscoveryDimension(dimension)}
                      type="button"
                    >
                      {dimension === "workflow" ? "当前流程" : dimension === "consequence" ? "问题影响" : "替代方案"}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                aria-label="调查动作"
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="提出调查问题或采取行动，Enter 发送，Shift+Enter 换行"
                rows={3}
                value={input}
              />
              <div className="wb-composer-actions">
                {allowsPreDecisionHint(world) && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => { void useHint(); }}
                    type="button"
                  >
                    提示（标记辅助证据）
                  </button>
                )}
                <button
                  className="button button-secondary"
                  disabled={busy || messages.filter((m) => m.role === "user").length < 1}
                  onClick={enterCommitPhase}
                  type="button"
                >
                  完成调查，提交决策
                </button>
                <button
                  className="button button-primary"
                  disabled={busy || !input.trim()}
                  onClick={() => { void sendAction(); }}
                  type="button"
                >
                  {busy ? "等待中…" : "发送"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 右：阶段面板 */}
        <aside className="wb-panel">
          {/* 世界已知事实 */}
          <div className="wb-facts surface">
            <span className="section-kicker">已知信息</span>
            <ul>
              {world.version.visible_facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>

          {/* commit 阶段：决策表单 */}
          {state.phase === "commit" && (
            <DecisionForm
              busy={busy}
              draft={draft}
              eventIds={eligibleEvidenceEventIds}
              onChange={setDraft}
              onSubmit={() => { void handleSubmitDecision(); }}
            />
          )}

          {/* commit 阶段：揭示后果按钮 */}
          {canRevealConsequences(state) && (
            <button
              className="button button-coral wb-full-width"
              disabled={busy}
              onClick={() => { void handleReveal(); }}
              type="button"
            >
              {busy ? "揭示中…" : "揭示后果"}
            </button>
          )}

          {/* reveal 阶段：后果内容 + 进入反思 */}
          {state.phase === "reveal" && (
            <div className="wb-reveal surface">
              <span className="section-kicker">后果回放</span>
              <p>{revealContent}</p>
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => { void handleAdvanceToReflect(); }}
                type="button"
              >
                {busy ? "生成反馈…" : "查看证据反馈"}
              </button>
              {feedbackStatus && (
                <p className="wb-feedback-status" role="status">{feedbackStatus}</p>
              )}
            </div>
          )}

          {/* reflect 阶段：反馈内容 + 结束 */}
          {state.phase === "reflect" && (
            <div className="wb-reflect surface">
              <span className="section-kicker">证据反馈</span>
              <p>{reflectContent}</p>
              {nextChallenge && !loopComplete && (
                <div className="wb-next-challenge">
                  <span className="detail-label">下一挑战</span>
                  <strong>{nextChallenge.world_title}</strong>
                  <p>{nextChallenge.reason}</p>
                </div>
              )}
              {loopComplete && (
                <div className="wb-next-challenge" role="status">
                  <span className="detail-label">世界闭环已完成</span>
                  <strong>三个世界的判断证据已保存</strong>
                  <p>{nextChallenge?.reason}</p>
                </div>
              )}
              {state.was_assisted && (
                <p className="wb-assisted-notice">
                  ⚠ 本轮使用了提示，决策证据标记为辅助，不计入独立能力趋势。
                </p>
              )}
              {evaluation?.degraded && (
                <p className="wb-assisted-notice" role="status">
                  {evaluation.degraded_reason
                    ? getFallbackNotice(evaluation.degraded_reason)
                    : "本次反馈已由受治理的本地规则完成。"}
                </p>
              )}
              <button
                className="button button-primary"
                onClick={handleFinish}
                type="button"
              >
                {loopComplete
                  ? "完成闭环，查看判断画像"
                  : nextChallenge?.is_remediation
                  ? "进入修正练习"
                  : nextWorld
                    ? "进入下一个世界"
                    : "完成闭环，查看判断画像"}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
