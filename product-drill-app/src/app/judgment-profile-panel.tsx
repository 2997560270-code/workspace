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
import { useEffect, useState } from "react";
import { fetchJudgmentProfile } from "../lib/challenge-client";
import type { HypothesisDisplayItem, EvidenceDisplayItem } from "../lib/judgment-profile-builder";
import { trackClientEvent } from "../lib/analytics/client";
import { CAUSAL_EVENTS, buildProfileViewedProps } from "../lib/causal-analytics";

// ── 工具 ──────────────────────────────────────────────────────────

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
}: {
  item: EvidenceDisplayItem;
  type: "supporting" | "counter" | "assisted" | "transfer";
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
        <span className="detail-label">决策事件</span>
        <code className="ev-dec-id">{item.decision_event_id}</code>
      </div>
    </div>
  );
}

function HypothesisCard({ item }: { item: HypothesisDisplayItem }) {
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
        <button
          aria-expanded={expanded}
          className="text-button jp-expand-btn"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded ? "收起" : `查看证据 (${item.total_evidence_count})`}
        </button>
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

      {!hasAnyEvidence && (
        <p className="jp-no-evidence">尚无证据，完成世界工作台训练后自动更新。</p>
      )}

      {expanded && hasAnyEvidence && (
        <div className="jp-evidence-groups">
          {item.supporting_evidence.length > 0 && (
            <section>
              <span className="section-kicker">支持证据（独立）</span>
              {item.supporting_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} type="supporting" />
              ))}
            </section>
          )}

          {item.counter_evidence.length > 0 && (
            <section>
              <span className="section-kicker">反证（需进一步验证）</span>
              {item.counter_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} type="counter" />
              ))}
            </section>
          )}

          {item.transfer_evidence.length > 0 && (
            <section>
              <span className="section-kicker">迁移证据（陌生世界独立决策）</span>
              {item.transfer_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} type="transfer" />
              ))}
            </section>
          )}

          {item.assisted_evidence.length > 0 && (
            <section>
              <span className="section-kicker">辅助证据（含提示，不计入独立趋势）</span>
              {item.assisted_evidence.map((ev) => (
                <EvidenceCard item={ev} key={ev.id} type="assisted" />
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
        <h2>还没有判断习惯证据</h2>
        <p>
          进入世界工作台，完成一次调查与决策，系统会自动构建你的判断证据画像。
          画像里每一条结论都可以追溯到具体的决策事件，不是模糊总分。
        </p>
        <ul className="jp-empty-facts">
          <li>支持证据 — 独立决策中覆盖了三个调查维度</li>
          <li>反证 — 同世界中表现出早期承诺行为</li>
          <li>迁移证据 — 在陌生世界中无提示独立复现</li>
          <li>辅助证据 — 使用了提示，记录但不计入独立趋势</li>
        </ul>
      </section>
    );
  }

  return (
    <div className="jp-layout">
      <section className="jp-summary surface-dark">
        <div>
          <span className="section-kicker light">判断习惯画像</span>
          <h2>每条结论都可以追溯到具体决策事件</h2>
          <p>
            置信度不是分数，它反映了相同条件下行为的一致性。
            证据不足时不会显示伪精确结论。
          </p>
        </div>
        <div className="jp-summary-stats">
          <div>
            <strong>{items.length}</strong>
            <span>追踪的判断习惯</span>
          </div>
          <div>
            <strong>{items.reduce((n, i) => n + i.supporting_evidence.length, 0)}</strong>
            <span>独立支持证据</span>
          </div>
          <div>
            <strong>{items.reduce((n, i) => n + i.transfer_evidence.length, 0)}</strong>
            <span>迁移证据</span>
          </div>
        </div>
      </section>

      <div className="jp-hypothesis-list">
        {items.map((item) => (
          <HypothesisCard item={item} key={item.id} />
        ))}
      </div>
    </div>
  );
}
