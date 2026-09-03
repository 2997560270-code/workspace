"use client";

/**
 * judgment-profile-panel.tsx — 判断证据画像展示组件
 *
 * Issue #6 验收：
 * - 移除 totalScore / 雷达图 / 技能次数推断
 * - 每条结论可跳回具体 decision event
 * - Rubric、世界和模型版本可追溯
 * - 证据不足时不显示伪精确分数
 * - 分析事件不包含对话原文或决策正文
 */
import { useEffect, useRef, useState } from "react";
import {
  fetchChallengeHistory,
  fetchDecisionTimeline,
  fetchJudgmentProfile,
} from "../lib/challenge-client";
import type { HypothesisDisplayItem, EvidenceDisplayItem } from "../lib/judgment-profile-builder";
import type {
  ChallengeDecisionSummary,
  ChallengeDecisionTimeline,
} from "../lib/challenge-history";
import { trackClientEvent } from "../lib/analytics/client";
import { CAUSAL_EVENTS, buildProfileViewedProps } from "../lib/causal-analytics";
import { getDemoWorld } from "../lib/world-seeds";

// ── 工具 ──────────────────────────────────────────────────────────

const CONFIDENCE_LABELS: Record<ChallengeDecisionSummary["confidence"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const EVENT_LABELS: Record<ChallengeDecisionTimeline["events"][number]["event_type"], string> = {
  user_action: "调查动作",
  world_response: "世界回应",
  reveal: "后果揭示",
  intervention: "系统干预",
};

const INTERVENTION_LABELS: Record<ChallengeDecisionTimeline["interventions"][number]["intervention_type"], string> = {
  hint: "提示",
  feedback: "证据反馈",
  counterfactual: "反事实路径",
  reveal_consequence: "后果揭示",
};

function formatDateTime(value: string | null): string {
  if (!value) return "尚未完成";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventDescription(payload: Record<string, unknown>): string {
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text;
  if (typeof payload.content === "string" && payload.content.trim()) return payload.content;
  return "已记录结构化世界事件";
}

export function DecisionTimelinePanel({
  decisionEventId,
  focusRequestKey,
  onClose,
}: {
  decisionEventId: string;
  focusRequestKey: number;
  onClose: () => void;
}) {
  const [timeline, setTimeline] = useState<ChallengeDecisionTimeline | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      panelRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [decisionEventId, focusRequestKey]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setTimeline(null);
    fetchDecisionTimeline(decisionEventId)
      .then((result) => {
        if (cancelled) return;
        setTimeline(result);
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [decisionEventId]);

  return (
    <section
      aria-label="决策与后果时间线"
      className="decision-timeline surface"
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="decision-timeline-header">
        <div>
          <span className="section-kicker">决策与后果时间线</span>
          <h2>{timeline?.world_title ?? "正在读取决策记录"}</h2>
        </div>
        <button
          aria-label="关闭决策时间线"
          className="decision-timeline-close"
          onClick={onClose}
          title="关闭"
          type="button"
        >
          ×
        </button>
      </div>

      {status === "loading" ? <p className="quiet">正在加载可追溯记录…</p> : null}
      {status === "error" ? (
        <div className="decision-timeline-error" role="alert">
          <p>无法加载这条决策记录，请稍后重试。</p>
          <button className="text-button" onClick={onClose} type="button">返回记录列表</button>
        </div>
      ) : null}

      {status === "loaded" && timeline ? (
        <>
          <dl className="decision-provenance" aria-label="版本追溯">
            <div><dt>World</dt><dd>{timeline.world_id} · {timeline.world_version}</dd></div>
            <div><dt>Rubric</dt><dd>{timeline.rubric_version}</dd></div>
            <div><dt>Model</dt><dd>{timeline.model_version}</dd></div>
            <div><dt>完成时间</dt><dd>{formatDateTime(timeline.completed_at)}</dd></div>
          </dl>

          <ol className="decision-timeline-list">
            {timeline.events.map((event) => (
              <li key={event.id}>
                <div className="decision-timeline-marker" aria-hidden="true" />
                <div className="decision-timeline-content">
                  <div className="decision-timeline-meta">
                    <strong>{EVENT_LABELS[event.event_type]}</strong>
                    <span>{formatDateTime(event.created_at)}</span>
                  </div>
                  <p>{getEventDescription(event.payload)}</p>
                  <code>{event.id}</code>
                </div>
              </li>
            ))}

            <li>
              <div className="decision-timeline-marker decision-marker-primary" aria-hidden="true" />
              <div className="decision-timeline-content decision-record">
                <div className="decision-timeline-meta">
                  <strong>提交决策</strong>
                  <span>{formatDateTime(timeline.decision_created_at)}</span>
                </div>
                <dl className="decision-detail-list">
                  <div><dt>判断</dt><dd>{timeline.judgment}</dd></div>
                  <div><dt>行动</dt><dd>{timeline.chosen_action}</dd></div>
                  <div><dt>预期结果</dt><dd>{timeline.expected_outcome}</dd></div>
                  <div><dt>信心</dt><dd>{CONFIDENCE_LABELS[timeline.confidence]}</dd></div>
                  <div><dt>证据依据</dt><dd>{timeline.evidence_basis.length ? timeline.evidence_basis.join("、") : "未选择事件证据"}</dd></div>
                  <div><dt>放弃方案</dt><dd>{timeline.rejected_alternatives.length ? timeline.rejected_alternatives.join("、") : "未记录"}</dd></div>
                </dl>
                <code>{timeline.decision_event_id}</code>
              </div>
            </li>

            {timeline.interventions.map((intervention) => (
              <li key={intervention.id}>
                <div className="decision-timeline-marker" aria-hidden="true" />
                <div className="decision-timeline-content">
                  <div className="decision-timeline-meta">
                    <strong>{INTERVENTION_LABELS[intervention.intervention_type]}</strong>
                    <span>{formatDateTime(intervention.triggered_at)}</span>
                  </div>
                  <p>{intervention.content}</p>
                  <code>{intervention.id}</code>
                </div>
              </li>
            ))}
          </ol>

          <div className={`decision-reveal-state ${timeline.consequences_revealed ? "revealed" : "pending"}`}>
            <strong>{timeline.consequences_revealed ? "后果已揭示" : "后果尚未揭示"}</strong>
            <span>此状态来自不可变决策事件，而非画像推断。</span>
          </div>
        </>
      ) : null}
    </section>
  );
}

function EvidenceTypeBadge({
  type,
}: {
  type: "supporting" | "counter" | "assisted" | "transfer";
}) {
  const labels = {
    supporting: { text: "支持", cls: "ev-badge-supporting" },
    counter:    { text: "反证", cls: "ev-badge-counter" },
    assisted:   { text: "辅助", cls: "ev-badge-assisted" },
    transfer:   { text: "迁移", cls: "ev-badge-transfer" },
  };
  const { text, cls } = labels[type];
  return <span className={`ev-badge ${cls}`}>{text}</span>;
}

function EvidenceCard({
  item,
  type,
  onOpenDecision,
}: {
  item: EvidenceDisplayItem;
  type: "supporting" | "counter" | "assisted" | "transfer";
  onOpenDecision: (decisionEventId: string) => void;
}) {
  return (
    <div className="ev-card">
      <div className="ev-card-header">
        <EvidenceTypeBadge type={type} />
        {item.is_transfer && (
          <span className="ev-tag ev-tag-transfer">迁移世界 {item.transfer_world_id}</span>
        )}
        {item.is_same_world_correction && (
          <span className="ev-tag ev-tag-correction">同世界修正机会</span>
        )}
      </div>
      <div className="ev-card-meta">
        <span title="世界版本">世界 {item.world_id} · v{item.world_version}</span>
        <span title="模型版本">模型 {item.model_version}</span>
      </div>
      <div className="ev-card-link">
        <code className="ev-dec-id" title={item.decision_event_id}>{item.decision_event_id}</code>
        <button
          className="text-button ev-open-decision"
          onClick={() => onOpenDecision(item.decision_event_id)}
          type="button"
        >
          查看决策与后果
        </button>
      </div>
    </div>
  );
}

function HypothesisCard({
  item,
  onOpenDecision,
}: {
  item: HypothesisDisplayItem;
  onOpenDecision: (decisionEventId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAnyEvidence = item.total_evidence_count > 0;

  return (
    <article className="jp-hypothesis surface">
      <div className="jp-hypothesis-header">
        <div className="jp-hypothesis-meta">
          <h3>{item.habit_name}</h3>
          <span className={`jp-confidence jp-confidence-${item.habit_name.replace(/[^a-z]/gi, "")}`}>
            {item.confidence_label}
          </span>
        </div>
        {hasAnyEvidence ? (
          <button
            aria-expanded={expanded}
            className="text-button jp-expand-btn"
            onClick={() => setExpanded((v) => !v)}
            type="button"
          >
            {expanded ? "收起" : `查看证据 (${item.total_evidence_count})`}
          </button>
        ) : null}
      </div>

      {item.trigger_conditions.length > 0 && (
        <div className="jp-triggers">
          <span className="detail-label">触发条件</span>
          <div className="jp-trigger-list">
            {item.trigger_conditions.map((t) => (
              <span className="jp-trigger-tag" key={t}>{t}</span>
            ))}
          </div>
        </div>
      )}

      <div className="jp-rubric provenance">Rubric {item.rubric_version}</div>

      {!hasAnyEvidence && (
        <p className="jp-no-evidence">尚无证据，完成世界工作台训练后自动更新。</p>
      )}

      {expanded && hasAnyEvidence && (
        <div className="jp-evidence-groups">
          {item.supporting_evidence.length > 0 && (
            <section>
              <span className="section-kicker">支持证据（独立）</span>
              {item.supporting_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} onOpenDecision={onOpenDecision} type="supporting" />
              ))}
            </section>
          )}

          {item.counter_evidence.length > 0 && (
            <section>
              <span className="section-kicker">反证（需进一步验证）</span>
              {item.counter_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} onOpenDecision={onOpenDecision} type="counter" />
              ))}
            </section>
          )}

          {item.transfer_evidence.length > 0 && (
            <section>
              <span className="section-kicker">迁移证据（陌生世界独立决策）</span>
              {item.transfer_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} onOpenDecision={onOpenDecision} type="transfer" />
              ))}
            </section>
          )}

          {item.assisted_evidence.length > 0 && (
            <section>
              <span className="section-kicker">辅助证据（含提示，不计入独立趋势）</span>
              {item.assisted_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} onOpenDecision={onOpenDecision} type="assisted" />
              ))}
            </section>
          )}
        </div>
      )}

      <div className="jp-updated">
        最后更新：{new Date(item.last_updated_at).toLocaleDateString("zh-CN")}
      </div>
    </article>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────

export function JudgmentProfilePanel() {
  const [items, setItems] = useState<HypothesisDisplayItem[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "empty" | "error">("loading");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [timelineFocusRequest, setTimelineFocusRequest] = useState(0);

  function openDecisionTimeline(decisionEventId: string) {
    setSelectedDecisionId(decisionEventId);
    setTimelineFocusRequest((request) => request + 1);
  }

  useEffect(() => {
    let cancelled = false;
    fetchJudgmentProfile()
      .then((profile) => {
        if (cancelled) return;
        setItems(profile.items);
        setStatus(profile.items.length ? "loaded" : "empty");
        // #3 analytics: judgment_profile_viewed
        trackClientEvent(
          CAUSAL_EVENTS.judgmentProfileViewed,
          buildProfileViewedProps({ itemCount: profile.items.length })
        );
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return (
      <div className="jp-loading surface">
        <p>正在加载判断证据画像…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="jp-error surface">
        <p>无法加载画像，请刷新重试。</p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <section className="jp-empty surface">
        <span className="empty-number">01</span>
        <h2>还没有世界判断证据</h2>
        <p>
          这里仅统计世界工作台中的结构化调查与决策，不包含专项训练记录。
          完成一次世界调查与决策后，系统会自动构建你的判断证据画像。
          画像里每一条结论都可以追溯到具体的决策事件，不是模糊总分。
        </p>
        <ul className="jp-empty-facts">
          <li>支持证据 — 独立决策中仍缺少关键调查维度</li>
          <li>反证 — 独立决策中覆盖了三个调查维度</li>
          <li>迁移证据 — 在陌生世界中无提示独立复现</li>
          <li>辅助证据 — 使用了提示，记录但不计入独立趋势</li>
        </ul>
      </section>
    );
  }

  return (
    <div className="jp-layout">
      {selectedDecisionId ? (
        <DecisionTimelinePanel
          decisionEventId={selectedDecisionId}
          focusRequestKey={timelineFocusRequest}
          onClose={() => setSelectedDecisionId(null)}
        />
      ) : null}

      <section className="jp-summary surface-dark">
        <div>
          <span className="section-kicker light">世界判断证据</span>
          <h2>世界工作台的每条结论都可追溯到具体决策</h2>
          <p>
            本区域只统计世界工作台中的结构化调查与决策，不包含下方的专项训练记录。
            置信度反映相同条件下行为的一致性，证据不足时不会显示伪精确结论。
          </p>
        </div>
        <div className="jp-summary-stats">
          <div>
            <strong>{items.length}</strong>
            <span>世界判断习惯</span>
          </div>
          <div>
            <strong>{items.reduce((n, i) => n + i.independent_evidence_count, 0)}</strong>
            <span>世界独立证据</span>
          </div>
          <div>
            <strong>{items.reduce((n, i) => n + i.transfer_evidence.length, 0)}</strong>
            <span>迁移证据</span>
          </div>
        </div>
      </section>

      <div className="jp-hypothesis-list">
        {items.map((item) => (
          <HypothesisCard item={item} key={item.id} onOpenDecision={openDecisionTimeline} />
        ))}
      </div>
    </div>
  );
}

export function WorldDecisionHistoryPanel({
  localCompletedWorldIds = [],
}: {
  /** FB-006：本地（离线演示模式）已完成的世界 id，服务端无记录时合并展示 */
  localCompletedWorldIds?: string[];
}) {
  const [records, setRecords] = useState<ChallengeDecisionSummary[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);
  const [timelineFocusRequest, setTimelineFocusRequest] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  function openDecisionTimeline(decisionEventId: string) {
    setSelectedLocalId(null);
    setSelectedDecisionId(decisionEventId);
    setTimelineFocusRequest((request) => request + 1);
  }

  useEffect(() => {
    let cancelled = false;
    fetchChallengeHistory()
      .then((result) => {
        if (cancelled) return;
        setRecords(result);
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  // FB-006：离线演示模式下完成的世界不会写入服务端数据库，
  // 这里把本地完成但服务端缺失的世界合并为本地演示记录，避免历史永远为空。
  // 必须等服务端请求有结果（loaded/error）后再合并，
  // 否则加载中的空列表会先渲染出本地记录，与服务端记录形成瞬时重复。
  const localRecords: ChallengeDecisionSummary[] = status === "loading"
    ? []
    : localCompletedWorldIds
    .filter((worldId) => !records.some((record) => record.world_id === worldId))
    .flatMap((worldId) => {
      const seed = getDemoWorld(worldId);
      if (!seed) return [];
      return [{
        run_id: `local-demo-run-${worldId}`,
        decision_event_id: `local-demo-decision-${worldId}`,
        world_id: worldId,
        world_version: seed.version.version,
        world_title: seed.title,
        status: "completed",
        started_at: "",
        completed_at: null,
        chosen_action: "在离线演示模式下完成了该世界的调查与决策。",
        confidence: "medium",
        consequences_revealed: true,
        source: "local_demo",
      }];
    });
  const mergedRecords = [...records, ...localRecords];

  return (
    <section className="world-history" aria-labelledby="world-history-title">
      <div className="world-history-heading">
        <div>
          <span className="section-kicker">世界工作台</span>
          <h2 id="world-history-title">世界决策记录</h2>
        </div>
        <p>选择一条记录，查看调查、决策、后果和版本来源。</p>
      </div>

      {status === "loading" ? <div className="world-history-status surface">正在加载世界决策记录…</div> : null}
      {status === "error" && mergedRecords.length ? (
        <div className="world-history-status surface" role="alert">服务端记录加载失败，以下为本地演示模式下的完成记录。</div>
      ) : null}
      {status === "error" && !mergedRecords.length ? (
        <div className="world-history-status surface" role="alert">世界决策记录加载失败，请刷新重试。</div>
      ) : null}
      {status === "loaded" && !mergedRecords.length ? (
        <div className="world-history-status surface">
          <h3>还没有已完成的世界决策</h3>
          <p>完成一个世界工作台挑战后，调查、决策和后果会显示在这里。</p>
        </div>
      ) : null}

      {mergedRecords.length ? (
        <div className="world-history-list">
          {mergedRecords.map((record, index) => (
            <button
              aria-pressed={selectedDecisionId === record.decision_event_id || selectedLocalId === record.world_id}
              className={selectedDecisionId === record.decision_event_id || selectedLocalId === record.world_id ? "surface active" : "surface"}
              key={record.decision_event_id}
              onClick={() => {
                if (record.source === "local_demo") {
                  setSelectedDecisionId(null);
                  setSelectedLocalId(record.world_id);
                } else {
                  openDecisionTimeline(record.decision_event_id);
                }
              }}
              type="button"
            >
              <span className="world-history-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="world-history-copy">
                <strong>{record.world_title}</strong>
                <small>{record.chosen_action}</small>
              </span>
              <span className="world-history-meta">
                <small>World {record.world_version}</small>
                {record.source === "local_demo" ? (
                  <small className="world-history-local" data-testid="world-history-local">本地演示记录</small>
                ) : (
                  <small>{formatDateTime(record.completed_at)}</small>
                )}
              </span>
              <span aria-hidden="true" className="world-history-arrow">→</span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedLocalId ? (
        <div className="world-history-status surface" data-testid="world-history-local-note" role="note">
          <h3>这是一条本地演示记录</h3>
          <p>该世界在离线演示模式下完成，详细时间线未同步到服务端；连接服务端后完成的决策才会生成完整记录。</p>
          <button className="button button-secondary" onClick={() => setSelectedLocalId(null)} type="button">关闭</button>
        </div>
      ) : null}

      {selectedDecisionId ? (
        <DecisionTimelinePanel
          decisionEventId={selectedDecisionId}
          focusRequestKey={timelineFocusRequest}
          onClose={() => setSelectedDecisionId(null)}
        />
      ) : null}
    </section>
  );
}
