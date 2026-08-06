"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { WorldWorkbench } from "./world-workbench";
import { JudgmentProfilePanel, WorldDecisionHistoryPanel } from "./judgment-profile-panel";
import {
  DEFAULT_WORLD_ID,
  getNextDemoWorld,
  getNextIncompleteDemoWorld,
} from "../lib/world-seeds";
import { ANALYTICS_EVENTS } from "../lib/analytics/events";
import { trackClientEvent } from "../lib/analytics/client";
import { StoredHistorySchema } from "../lib/api/schemas";
import { fetchNextChallenge } from "../lib/challenge-client";
import {
  createRemoteSession,
  fetchRemoteHistory,
  requestRemoteEvaluation,
  sendRemoteMessage,
  submitRemoteJudgment,
  submitRemoteRetry,
  syncDeterministicRecord
} from "../lib/api/training-client";
import type { NextChallengeSelection } from "../lib/challenge-selection";
import { buildAbilityProfile } from "../lib/ability-profile";
import {
  evaluateRetry,
  generateEvaluation,
  type Evaluation
} from "../lib/evaluation";
import { NAV_ITEMS, getViewMeta, type ViewId } from "../lib/navigation";
import {
  addRetryToHistory,
  createTrainingHistoryRecord,
  type RetryResult,
  type TrainingHistoryRecord
} from "../lib/training-history";
import {
  DEFAULT_SCENARIO_ID,
  SKILLS,
  TRAINING_SCENARIOS,
  getScenario,
  getSkill,
  type SkillId
} from "../lib/training-config";
import {
  createTrainingSession,
  getCoveragePercent,
  moveToJudgment,
  sendTrainingMessage,
  startRetry,
  submitJudgment,
  TRAINING_MODE_OPTIONS,
  useTrainingHint,
  type ProductJudgment,
  type TrainingSession
} from "../lib/training-session";

const STORAGE_KEY = "product-drill-direction-a-v1";
const WORLD_PROGRESS_STORAGE_KEY = "product-drill-world-progress-v1";
const EMPTY_JUDGMENT: ProductJudgment = {
  targetUser: "",
  currentWorkflow: "",
  coreProblem: "",
  problemImpact: "",
  alternative: "",
  recommendation: "",
  successMetric: "",
  biggestAssumption: ""
};

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

function CheckMark({ active = true }: { active?: boolean }) {
  return <span aria-hidden="true" className={active ? "check active" : "check"}>✓</span>;
}

function mergeHistoryRecords(primary: TrainingHistoryRecord[], secondary: TrainingHistoryRecord[]) {
  const records = new Map<string, TrainingHistoryRecord>();
  [...secondary, ...primary].forEach((record) => records.set(record.id, record));
  return [...records.values()].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}

function RuntimeNotice({
  status,
  error
}: {
  status: "connecting" | "online" | "fallback";
  error: string;
}) {
  const text = status === "connecting"
    ? "正在连接训练服务…"
    : status === "online"
      ? "已连接服务端；评分会记录模型、场景与 Rubric 版本。"
      : "当前使用离线演示引擎；结果不会计入正式能力趋势。";
  return (
    <div aria-live="polite" className={`runtime-notice runtime-${status}`}>
      <span>{text}</span>
      {error ? <strong>{error}</strong> : null}
    </div>
  );
}

function TodayPanel({
  records,
  onStart,
  onOpenReview,
  onStartWorkbench,
  onOpenAbility,
  nextWorldTitle,
  nextWorldReason,
  workbenchComplete,
}: {
  records: TrainingHistoryRecord[];
  onStart: (scenarioId: string, mode?: TrainingSession["mode"]) => void;
  onOpenReview: () => void;
  onStartWorkbench: (worldId?: string) => void;
  onOpenAbility: () => void;
  nextWorldTitle: string;
  nextWorldReason: string;
  workbenchComplete: boolean;
}) {
  const profile = buildAbilityProfile(records);
  const recommended = records.length ? TRAINING_SCENARIOS[0] : TRAINING_SCENARIOS[2];
  const weeklyDone = Math.min(records.length, profile.weeklyTarget);
  const latestIssue = records[0]?.evaluation.issues[0];

  return (
    <div className="today-layout">
      <section className="hero-training surface-dark">
        <div className="hero-copy">
          <div className="meta-line">
            <span>{records.length ? "今日推荐" : "首次能力诊断"}</span>
            <span>{recommended.duration} 分钟</span>
            <span>{recommended.difficulty}</span>
          </div>
          <p className="skill-label">{getSkill(recommended.skillId).name}</p>
          <h2>{recommended.title}</h2>
          <p>{recommended.context}</p>
          <div className="hero-actions">
            <button className="button button-light" onClick={() => onStart(recommended.id)} type="button">
              {records.length ? "开始今日训练" : "开始 3 分钟诊断"} <ArrowIcon />
            </button>
            <button
              className="button button-secondary"
              onClick={() => workbenchComplete ? onOpenAbility() : onStartWorkbench()}
              type="button"
            >
              {workbenchComplete ? "查看判断画像" : "进入世界工作台"} <ArrowIcon />
            </button>
            <span title={nextWorldReason}>
              {workbenchComplete ? "世界闭环已完成" : `下一挑战：${nextWorldTitle}`}
            </span>
          </div>
        </div>
        <div className="hero-proof">
          <span>本轮重点</span>
          <strong>{getSkill(recommended.skillId).name}</strong>
          <p>{getSkill(recommended.skillId).practiceTip}</p>
        </div>
      </section>

      <aside className="weekly surface">
        <div className="section-heading compact">
          <div>
            <span className="section-kicker">本周节奏</span>
            <h2>{weeklyDone} / {profile.weeklyTarget}</h2>
          </div>
          <span className="quiet">次训练</span>
        </div>
        <div className="week-bars" aria-label={`本周已完成 ${weeklyDone} 次训练`}>
          {Array.from({ length: profile.weeklyTarget }, (_, index) => (
            <span className={index < weeklyDone ? "done" : ""} key={index} />
          ))}
        </div>
        <p>{weeklyDone ? "保持节奏，比一次练很久更重要。" : "完成第一轮训练，建立你的能力基线。"}</p>
      </aside>

      <section className="focus-card surface">
        <div className="section-heading">
          <div>
            <span className="section-kicker">你的当前训练重点</span>
            <h2>{latestIssue?.title ?? "先建立一条真实能力证据"}</h2>
          </div>
          <span className="status-tag">{records.length ? "待复练" : "未诊断"}</span>
        </div>
        <div className="focus-grid">
          <div>
            <span className="detail-label">训练证据</span>
            <p>{latestIssue?.evidence ?? "完成首次诊断后，这里会展示你在对话中的真实提问证据。"}</p>
          </div>
          <div>
            <span className="detail-label">下一步动作</span>
            <p>{latestIssue?.nextAction ?? "先完成一个短场景，不需要准备，也没有标准答案。"}</p>
          </div>
          <button
            className="button button-secondary"
            disabled={!records.length}
            onClick={onOpenReview}
            type="button"
          >
            开始 2 分钟复练
          </button>
        </div>
      </section>

      <section className="map-preview surface">
        <div className="section-heading">
          <div>
            <span className="section-kicker">产品发现能力地图</span>
            <h2>不是刷题，而是留下可验证的行为证据</h2>
          </div>
        </div>
        <div className="skill-rows">
          {profile.skills.map((skill, index) => (
            <div className="skill-row" key={skill.id}>
              <span className="skill-index">0{index + 1}</span>
              <div>
                <strong>{skill.name}</strong>
                <p>{SKILLS.find((item) => item.id === skill.id)?.description}</p>
              </div>
              <span className={`mastery mastery-${skill.state}`}>{skill.state}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrainingMap({ onStart }: { onStart: (scenarioId: string, mode?: TrainingSession["mode"]) => void }) {
  return (
    <div className="stack-lg">
      <section className="surface map-intro">
        <div>
          <span className="section-kicker">五个核心能力</span>
          <h2>从会问问题，到能做出产品判断</h2>
        </div>
        <p>每个任务只突出一个主要能力；完成后，你会得到可追溯的证据，而不是一个模糊总分。</p>
      </section>
      <div className="scenario-grid">
        {TRAINING_SCENARIOS.map((scenario) => {
          const skill = getSkill(scenario.skillId);
          return (
            <article className="scenario-card surface" key={scenario.id}>
              <div className="scenario-topline">
                <span>{scenario.industry}</span>
                <span>{scenario.duration} 分钟 · {scenario.difficulty}</span>
              </div>
              <h2>{scenario.shortTitle}</h2>
              <p>{scenario.title}</p>
              <div className="scenario-skill">
                <span>训练</span>
                <strong>{skill.name}</strong>
              </div>
              <button className="text-button" onClick={() => onStart(scenario.id)} type="button">
                开始训练 <ArrowIcon />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function JudgmentForm({
  value,
  onChange,
  onSubmit
}: {
  value: ProductJudgment;
  onChange: (next: ProductJudgment) => void;
  onSubmit: () => void;
}) {
  const fields: Array<{ key: keyof ProductJudgment; label: string; placeholder: string; wide?: boolean }> = [
    { key: "targetUser", label: "核心用户", placeholder: "谁真正经历这个问题？" },
    { key: "currentWorkflow", label: "当前流程", placeholder: "现在如何完成这件事？" },
    { key: "coreProblem", label: "核心问题", placeholder: "表面需求背后的问题是什么？", wide: true },
    { key: "problemImpact", label: "问题影响", placeholder: "频率、损失或业务后果" },
    { key: "alternative", label: "现有替代方案", placeholder: "用户现在如何绕过问题？" },
    { key: "recommendation", label: "建议行动", placeholder: "建议做什么，或为什么暂不做？", wide: true },
    { key: "successMetric", label: "成功指标", placeholder: "什么变化能证明有效？" },
    { key: "biggestAssumption", label: "最大假设", placeholder: "下一步最需要验证什么？" }
  ];
  const completeEnough = value.coreProblem.trim() && value.recommendation.trim();

  return (
    <section className="judgment surface">
      <div className="section-heading">
        <div>
          <span className="section-kicker">产品判断画布</span>
          <h2>把对话信息转成一个可以验证的判断</h2>
        </div>
        <span className="quiet">至少填写核心问题与建议行动</span>
      </div>
      <div className="judgment-grid">
        {fields.map((field) => (
          <label className={field.wide ? "wide" : ""} key={field.key}>
            <span>{field.label}</span>
            <textarea
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
              placeholder={field.placeholder}
              rows={field.wide ? 3 : 2}
              value={value[field.key]}
            />
          </label>
        ))}
      </div>
      <div className="judgment-actions">
        <p>“信息不足，暂不做决定”也是合理判断，只要说明还缺少什么证据。</p>
        <button className="button button-primary" disabled={!completeEnough} onClick={onSubmit} type="button">
          提交判断并查看反馈
        </button>
      </div>
    </section>
  );
}

function FeedbackPanel({
  evaluation,
  retryAnswer,
  retryResult,
  retrying,
  onStartRetry,
  onRetryAnswer,
  onSubmitRetry,
  onFinish
}: {
  evaluation: Evaluation;
  retryAnswer: string;
  retryResult: RetryResult | null;
  retrying: boolean;
  onStartRetry: () => void;
  onRetryAnswer: (value: string) => void;
  onSubmitRetry: () => void;
  onFinish: () => void;
}) {
  const primaryIssue = evaluation.issues[0];

  return (
    <div className="feedback-layout">
      <section className="feedback-summary surface-dark">
        <div>
          <span className="section-kicker light">本次训练结果</span>
          <h2>{evaluation.summary}</h2>
          <p>评分置信度：{evaluation.confidence}。数字只作为辅助，下面的行为证据更重要。</p>
        </div>
        <div className="score-orbit">
          <strong>{evaluation.totalScore}</strong>
          <span>/ 100</span>
        </div>
      </section>

      <section className="surface evidence-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">逐句证据反馈</span>
            <h2>系统为什么做出这个判断</h2>
          </div>
        </div>
        <div className="evidence-list">
          {evaluation.dimensions.map((dimension) => (
            <article className="evidence-row" key={dimension.id}>
              <div>
                <span className="evidence-level">{dimension.level}</span>
                <h3>{dimension.name}</h3>
              </div>
              <blockquote>{dimension.evidence}</blockquote>
              <p>{dimension.nextAction}</p>
            </article>
          ))}
        </div>
      </section>

      {primaryIssue ? (
        <section className="retry-card surface">
          <div className="retry-copy">
            <span className="section-kicker">最值得马上重练</span>
            <h2>{primaryIssue.title}</h2>
            <p>{primaryIssue.description}</p>
            <div className="evidence-quote">{primaryIssue.evidence}</div>
            <strong>{primaryIssue.nextAction}</strong>
          </div>
          {!retrying ? (
            <button className="button button-coral" onClick={onStartRetry} type="button">
              开始 2 分钟复练 <ArrowIcon />
            </button>
          ) : (
            <div className="retry-form">
              <span>{primaryIssue.retryPrompt}</span>
              <textarea
                onChange={(event) => onRetryAnswer(event.target.value)}
                placeholder="只提出一个更好的问题"
                rows={3}
                value={retryAnswer}
              />
              {retryResult ? (
                <div className={retryResult.improved ? "retry-result success" : "retry-result"}>
                  <strong>{retryResult.improved ? "已观察到改善" : "还可以更具体"}</strong>
                  <p>{retryResult.feedback}</p>
                </div>
              ) : null}
              <button
                className="button button-primary"
                disabled={retryAnswer.trim().length < 4 || Boolean(retryResult?.improved)}
                onClick={onSubmitRetry}
                type="button"
              >
                提交复练
              </button>
            </div>
          )}
        </section>
      ) : null}

      <div className="finish-row">
        <button className="button button-primary" onClick={onFinish} type="button">
          完成并返回今日训练
        </button>
      </div>
    </div>
  );
}

function TrainingWorkspace({
  scenarioId,
  initialMode,
  onClose,
  onRecord,
  onRetry
}: {
  scenarioId: string;
  initialMode: TrainingSession["mode"];
  onClose: () => void;
  onRecord: (record: TrainingHistoryRecord) => void;
  onRetry: (recordId: string, retry: RetryResult) => void;
}) {
  const [session, setSession] = useState(() => createTrainingSession({ scenarioId, mode: initialMode }));
  const [reply, setReply] = useState("");
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [judgment, setJudgment] = useState<ProductJudgment>(EMPTY_JUDGMENT);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [record, setRecord] = useState<TrainingHistoryRecord | null>(null);
  const [retryAnswer, setRetryAnswer] = useState("");
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [runtimeStatus, setRuntimeStatus] = useState<"connecting" | "online" | "fallback">("connecting");
  const [actionError, setActionError] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const scenario = getScenario(session.scenarioId);
  const coverage = getCoveragePercent(session);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [session.messages, pendingReply]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setRuntimeStatus("connecting");
    setActionError("");
    createRemoteSession(scenarioId, initialMode)
      .then((remoteSession) => {
        if (cancelled) return;
        setSession(remoteSession);
        setRuntimeStatus("online");
      })
      .catch(() => {
        if (cancelled) return;
        setSession(createTrainingSession({ scenarioId, mode: initialMode }));
        setRuntimeStatus("fallback");
        setActionError("训练服务暂时不可用，已保留本地练习能力。");
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [scenarioId, initialMode]);

  async function resetMode(mode: TrainingSession["mode"]) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setEvaluation(null);
    setRecord(null);
    setPendingReply(null);
    setJudgment(EMPTY_JUDGMENT);
    try {
      const remoteSession = await createRemoteSession(scenarioId, mode);
      setSession(remoteSession);
      setRuntimeStatus("online");
    } catch {
      setSession(createTrainingSession({ scenarioId, mode }));
      setRuntimeStatus("fallback");
      setActionError("模式已在本地切换，当前结果不会计入正式能力趋势。");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    const content = reply.trim();
    if (!content || busy) return;
    setReply("");
    setPendingReply(content);
    setBusy(true);
    setActionError("");
    try {
      const result = await sendRemoteMessage(session, content);
      setSession(result.session);
      setRuntimeStatus(result.fallback ? "fallback" : "online");
    } catch {
      setSession((current) => sendTrainingMessage(current, content));
      setRuntimeStatus("fallback");
      setActionError("本次追问由离线演示引擎回应，不会写入正式能力证据。");
    } finally {
      setPendingReply(null);
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendReply();
    }
  }

  async function submitCurrentJudgment() {
    if (busy) return;
    setBusy(true);
    setActionError("");
    let nextSession = submitJudgment(session, judgment);
    try {
      const judgmentResult = await submitRemoteJudgment(session, judgment);
      nextSession = judgmentResult.session;
      const result = await requestRemoteEvaluation(nextSession);
      setSession(nextSession);
      setEvaluation(result.evaluation);
      setRecord(result.record);
      setRuntimeStatus(result.fallback ? "fallback" : "online");
      onRecord(result.record);
    } catch {
      const nextEvaluation = generateEvaluation(nextSession);
      const nextRecord = createTrainingHistoryRecord(nextSession, nextEvaluation);
      setSession(nextSession);
      setEvaluation(nextEvaluation);
      setRecord(nextRecord);
      setRuntimeStatus("fallback");
      setActionError("服务端评估不可用，已生成本地练习反馈；该结果不会进入正式能力趋势。");
      onRecord(nextRecord);
    } finally {
      setBusy(false);
    }
  }

  function beginRetry() {
    if (busy) return;
    setSession((current) => startRetry(current));
    setRetryAnswer("");
    setRetryResult(null);
    const issue = evaluation?.issues[0];
    if (issue) {
      trackClientEvent(ANALYTICS_EVENTS.retryStarted, {
        scenarioId: session.scenarioId,
        scenarioVersion: session.scenarioVersion,
        rubricVersion: session.rubricVersion,
        engine: evaluation?.engine,
        mode: session.mode,
        targetSkill: issue.targetSkill
      });
    }
  }

  async function submitRetryAnswer() {
    const issue = evaluation?.issues[0];
    if (!issue || !record || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const result = await submitRemoteRetry(record, issue.id, retryAnswer);
      setRetryResult(result.retry);
      setRecord(result.record);
      setRuntimeStatus(result.fallback ? "fallback" : "online");
      onRetry(record.id, result.retry);
    } catch {
      const result = evaluateRetry(retryAnswer, issue.targetSkill);
      const retry: RetryResult = {
        issueId: issue.id,
        targetSkill: issue.targetSkill,
        answer: retryAnswer,
        improved: result.improved,
        feedback: result.feedback,
        engine: "deterministic",
        modelVersion: "deterministic-v1"
      };
      setRetryResult(retry);
      setRecord(addRetryToHistory(record, retry));
      setRuntimeStatus("fallback");
      setActionError("复练由离线规则评估，仅作为练习反馈保存。");
      onRetry(record.id, retry);
    } finally {
      setBusy(false);
    }
  }

  const notice = <RuntimeNotice error={actionError} status={runtimeStatus} />;

  if (evaluation) {
    return (
      <>
        {notice}
        <FeedbackPanel
          evaluation={evaluation}
          onFinish={onClose}
          onRetryAnswer={setRetryAnswer}
          onStartRetry={beginRetry}
          onSubmitRetry={() => { void submitRetryAnswer(); }}
          retryAnswer={retryAnswer}
          retryResult={retryResult}
          retrying={session.stage === "retry"}
        />
      </>
    );
  }

  if (session.stage === "judgment") {
    return (
      <>
        {notice}
        <JudgmentForm onChange={setJudgment} onSubmit={() => { void submitCurrentJudgment(); }} value={judgment} />
      </>
    );
  }

  return (
    <>
      {notice}
      <div className="training-shell">
        <section className="briefing surface">
          <button className="back-button" onClick={onClose} type="button">← 返回</button>
          <span className="section-kicker">场景简报</span>
          <h2>{scenario.title}</h2>
          <p>{scenario.context}</p>
          <div className="briefing-list">
            {scenario.briefing.map((item) => <div key={item}><CheckMark /> {item}</div>)}
          </div>
          <div className="mode-switch" aria-label="训练模式">
            {TRAINING_MODE_OPTIONS.map((mode) => (
              <button
                aria-pressed={session.mode === mode}
                className={session.mode === mode ? "active" : ""}
                disabled={busy}
                key={mode}
                onClick={() => { void resetMode(mode); }}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        <section className="conversation surface">
          <div className="conversation-head">
            <div>
              <span className="section-kicker">AI 角色</span>
              <h2>{scenario.role}</h2>
            </div>
            <span className="quiet">{busy ? "处理中…" : `${session.mode}模式`}</span>
          </div>
          <div className="message-list" data-testid="message-list" ref={messageListRef}>
            {session.messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <span>{message.role === "ai" ? "AI 用户" : "你"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {pendingReply ? (
              <>
                <article className="message user message-pending" data-testid="pending-user-message">
                  <span>你</span>
                  <p>{pendingReply}</p>
                </article>
                <div aria-live="polite" className="message-thinking" data-testid="thinking-indicator" role="status">
                  <span>AI 用户</span>
                  <p>正在思考…</p>
                </div>
              </>
            ) : null}
          </div>
          <div className="composer">
            <textarea
              aria-label="你的追问"
              disabled={busy}
              onChange={(event) => setReply(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="提出一个具体问题，Enter 发送，Shift + Enter 换行"
              rows={3}
              value={reply}
            />
            <div className="composer-actions">
              <button
                className="text-button"
                disabled={busy || session.mode !== "练习"}
                onClick={() => setSession((current) => useTrainingHint(current))}
                type="button"
              >
                给我一个轻提示
              </button>
              <button className="button button-primary" disabled={busy || !reply.trim()} onClick={() => { void sendReply(); }} type="button">{busy ? "等待回应" : "发送追问"}</button>
            </div>
          </div>
        </section>

        <aside className="training-progress surface">
          <span className="section-kicker">信息覆盖</span>
          <div className="coverage-number"><strong>{coverage}%</strong><span>不是最终分数</span></div>
          <div className="coverage-bar"><i style={{ width: `${coverage}%` }} /></div>
          <div className="coverage-list">
            {SKILLS.map((skill) => (
              <div key={skill.id}>
                <CheckMark active={session.coveredSkills.includes(skill.id)} />
                <span>{skill.name}</span>
              </div>
            ))}
          </div>
          <p>覆盖度只表示你是否问到了相关信息，不代表问题质量。</p>
          <button
            className="button button-secondary"
            disabled={busy || session.messages.filter((message) => message.role === "user").length < 1}
            onClick={() => setSession((current) => moveToJudgment(current))}
            type="button"
          >
            结束访谈，整理判断
          </button>
        </aside>
      </div>
    </>
  );
}
function ReviewPanel({
  records,
  onStart
}: {
  records: TrainingHistoryRecord[];
  onStart: (scenarioId: string, mode?: TrainingSession["mode"]) => void;
}) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  if (!records.length) {
    return (
      <section className="empty-state surface">
        <span className="empty-number">01</span>
        <h2>还没有可以复盘的训练</h2>
        <p>先完成一次能力诊断，系统会把具体失误时刻带到这里。</p>
        <button className="button button-primary" onClick={() => onStart(DEFAULT_SCENARIO_ID)} type="button">开始首次训练</button>
      </section>
    );
  }

  return (
    <div className="review-layout">
      <aside className="review-list surface">
        <span className="section-kicker">训练记录</span>
        {records.map((record) => {
          const scenario = getScenario(record.scenarioId);
          return (
            <button
              className={selected?.id === record.id ? "active" : ""}
              key={record.id}
              onClick={() => setSelectedId(record.id)}
              type="button"
            >
              <span>{scenario.shortTitle}</span>
              <small>{record.evaluation.issues[0]?.title ?? "主要行为已覆盖"}</small>
              <i>{record.retry?.improved ? "已改善" : "待复练"}</i>
            </button>
          );
        })}
      </aside>
      {selected ? (
        <section className="review-detail surface">
          <div className="section-heading">
            <div>
              <span className="section-kicker">{getScenario(selected.scenarioId).industry}</span>
              <h2>{getScenario(selected.scenarioId).title}</h2>
            </div>
            <span className="status-tag">{selected.retry?.improved ? "已改善" : "待复练"}</span>
          </div>
          <div className="review-metrics">
            <div><span>行为证据分</span><strong>{selected.totalScore}</strong></div>
            <div><span>训练模式</span><strong>{selected.mode}</strong></div>
            <div><span>复练结果</span><strong>{selected.retry?.improved ? "改善" : selected.retry ? "未达标" : "未复练"}</strong></div>
          </div>
          <div className="review-evidence">
            {selected.evaluation.issues.map((issue) => (
              <article key={issue.id}>
                <span>关键短板</span>
                <h3>{issue.title}</h3>
                <blockquote>{issue.evidence}</blockquote>
                <p>{issue.nextAction}</p>
              </article>
            ))}
          </div>
          {selected.retry ? (
            <div className={selected.retry.improved ? "retry-comparison success" : "retry-comparison"}>
              <span>你的复练问题</span>
              <strong>“{selected.retry.answer}”</strong>
              <p>{selected.retry.feedback}</p>
            </div>
          ) : (
            <button className="button button-coral" onClick={() => onStart(selected.scenarioId, "练习")} type="button">
              用同一场景重新训练
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function AbilityPanel({
  records,
  onOpenReview,
}: {
  records: TrainingHistoryRecord[];
  onOpenReview: () => void;
}) {
  const formalProfile = buildAbilityProfile(records.filter((record) => record.engine === "openai"), { formalEvidenceOnly: true });
  const practiceProfile = buildAbilityProfile(records);
  return (
    <div className="ability-layout">
      <section className="ability-summary surface-dark">
        <div>
          <span className="section-kicker light">专项训练证据</span>
          <h2>{practiceProfile.completedCount ? `专项训练已留下 ${practiceProfile.completedCount} 条记录，其中 ${formalProfile.completedCount} 条进入正式能力趋势` : "完成首次专项训练，建立能力基线"}</h2>
          <p>{formalProfile.completedCount ? formalProfile.nextTraining : "这里仅统计今日训练和训练地图中的专项练习，不包含上方的世界工作台判断证据。离线或降级结果只作为练习反馈。"}</p>
          <button className="button button-light" onClick={onOpenReview} type="button">
            查看全部训练记录
          </button>
        </div>
        <div className="summary-stats">
          <div><strong>{practiceProfile.completedCount}</strong><span>专项练习记录</span></div>
          <div><strong>{formalProfile.completedCount}</strong><span>进入正式趋势</span></div>
          <div><strong>{formalProfile.improvedCount}</strong><span>专项练习改善</span></div>
        </div>
      </section>
      <section className="surface ability-table">
        <div className="section-heading">
          <div>
            <span className="section-kicker">五项产品发现能力</span>
            <h2>每个正式状态都能回到具体训练证据</h2>
          </div>
        </div>
        {formalProfile.skills.map((skill, index) => (
          <article key={skill.id}>
            <span className="skill-index">0{index + 1}</span>
            <div>
              <h3>{skill.name}</h3>
              <p>{skill.latestEvidence}</p>
            </div>
            <div className="ability-counts">
              <span>{skill.evidenceCount} 条正式证据</span>
              <span>{skill.improvedCount} 次正式改善</span>
            </div>
            <span className={`mastery mastery-${skill.state}`}>{skill.state}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
export function AppShell({
  userId,
  userName = "张明",
  userSource = "demo"
}: {
  userId: string;
  userName?: string;
  userSource?: "supabase" | "demo";
}) {
  const [view, setView] = useState<ViewId>("today");
  const [activeTraining, setActiveTraining] = useState<{ scenarioId: string; mode: TrainingSession["mode"] } | null>(null);
  // #4 世界工作台：null = 未激活，string = 目标 world_id
  const [activeWorkbenchWorldId, setActiveWorkbenchWorldId] = useState<string | null>(null);
  const [completedWorldIds, setCompletedWorldIds] = useState<string[]>([]);
  const [nextChallengeSelection, setNextChallengeSelection] = useState<NextChallengeSelection | null>(null);
  const [worldProgressReady, setWorldProgressReady] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<TrainingHistoryRecord[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<"loading" | "server" | "local">("loading");
  const topbarRef = useRef<HTMLElement>(null);
  const meta = getViewMeta(view);
  const storageKey = `${STORAGE_KEY}:${userId}`;
  const worldProgressKey = `${WORLD_PROGRESS_STORAGE_KEY}:${userId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(worldProgressKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      setCompletedWorldIds(
        Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : []
      );
    } catch {
      setCompletedWorldIds([]);
    } finally {
      setWorldProgressReady(true);
    }
  }, [worldProgressKey]);

  useEffect(() => {
    let cancelled = false;
    fetchNextChallenge()
      .then((selection) => {
        if (!cancelled) setNextChallengeSelection(selection);
      })
      .catch(() => {
        // The local progression fallback remains available when the API is offline.
      });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!worldProgressReady) return;
    window.localStorage.setItem(worldProgressKey, JSON.stringify(completedWorldIds));
  }, [completedWorldIds, worldProgressKey, worldProgressReady]);

  useEffect(() => {
    let cancelled = false;
    let cachedRecords: TrainingHistoryRecord[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = StoredHistorySchema.safeParse(JSON.parse(raw));
        if (parsed.success) cachedRecords = parsed.data.records;
      }
    } catch {
      cachedRecords = [];
    }

    if (userSource === "demo" && cachedRecords.length) {
      setHistoryRecords(cachedRecords);
      setHistoryStatus("local");
    }

    fetchRemoteHistory()
      .then((remoteRecords) => {
        if (cancelled) return;
        setHistoryRecords(userSource === "supabase" ? remoteRecords : mergeHistoryRecords(remoteRecords, cachedRecords));
        setHistoryStatus("server");
      })
      .catch(() => {
        if (cancelled) return;
        setHistoryRecords(userSource === "supabase" ? [] : cachedRecords);
        setHistoryStatus("local");
      })
      .finally(() => { if (!cancelled) setStorageReady(true); });

    return () => { cancelled = true; };
  }, [storageKey, userSource]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, records: historyRecords }));
  }, [historyRecords, storageKey, storageReady]);

  useEffect(() => {
    topbarRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => window.scrollTo(0, 0), 100);
    return () => window.clearTimeout(timer);
  }, [activeTraining, activeWorkbenchWorldId, view]);

  function startTraining(scenarioId: string, mode: TrainingSession["mode"] = "练习") {
    setActiveTraining({ scenarioId, mode });
  }

  function addRecord(record: TrainingHistoryRecord) {
    setHistoryRecords((current) => mergeHistoryRecords([record], current));
    if (record.engine === "deterministic") {
      void syncDeterministicRecord(record).catch(() => setHistoryStatus("local"));
    }
  }

  function updateRetry(recordId: string, retry: RetryResult) {
    const currentRecord = historyRecords.find((record) => record.id === recordId);
    if (!currentRecord) return;
    const nextRecord = addRetryToHistory(currentRecord, retry);
    setHistoryRecords((current) => current.map((record) => record.id === recordId ? nextRecord : record));
    if (nextRecord.engine === "deterministic") {
      void syncDeterministicRecord(nextRecord).catch(() => setHistoryStatus("local"));
    }
  }

  function completeWorkbenchWorld(worldId: string, nextChallenge?: NextChallengeSelection) {
    setCompletedWorldIds((current) => current.includes(worldId) ? current : [...current, worldId]);
    setNextChallengeSelection(nextChallenge ?? null);
    if (nextChallenge?.loop_complete) {
      setActiveWorkbenchWorldId(null);
      setView("ability");
      return;
    }
    const nextWorld = nextChallenge
      ? getNextDemoWorld(nextChallenge.world_id) ?? getNextDemoWorld(worldId)
      : getNextDemoWorld(worldId);
    if (nextChallenge?.world_id) {
      setActiveWorkbenchWorldId(nextChallenge.world_id);
      return;
    }
    if (nextWorld) {
      setActiveWorkbenchWorldId(nextWorld.world_id);
      return;
    }
    setActiveWorkbenchWorldId(null);
    setView("ability");
  }

  const pageTitle = activeWorkbenchWorldId
    ? "世界工作台"
    : activeTraining
    ? getScenario(activeTraining.scenarioId).shortTitle
    : meta.title;
  const pageDescription = activeWorkbenchWorldId
    ? "调查、承诺、揭示后果，围绕世界规则工作。"
    : activeTraining
    ? "一次只训练一个主要能力，先理解问题，再做判断。"
    : meta.description;
  const completedThisWeek = useMemo(() => historyRecords.length, [historyRecords.length]);
  const sourceLabel = historyStatus === "loading" ? "正在同步" : historyStatus === "server" ? "服务端记录" : "本地缓存";
  const nextWorkbenchWorld = useMemo(
    () => getNextIncompleteDemoWorld(completedWorldIds),
    [completedWorldIds]
  );
  const displayedNextChallenge = nextChallengeSelection ?? {
    world_title: nextWorkbenchWorld.title,
    reason: "按本地世界进度继续挑战。",
    world_id: nextWorkbenchWorld.world_id,
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">PD</div>
          <div>
            <strong>Product Drill</strong>
            <span>产品发现训练场</span>
          </div>
        </div>
        <nav aria-label="主导航">
          {NAV_ITEMS.map((item, index) => (
            <button
              aria-current={!activeTraining && item.view === view ? "page" : undefined}
              className={!activeTraining && item.view === view ? "active" : ""}
              key={item.view}
              onClick={() => {
                setActiveTraining(null);
                setActiveWorkbenchWorldId(null);
                setView(item.view);
              }}
              type="button"
            >
              <span>0{index + 1}</span>
              <div><strong>{item.label}</strong><small>{item.hint}</small></div>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>本周训练</span>
          <strong>{completedThisWeek} / 5</strong>
          <div><i style={{ width: `${Math.min(100, completedThisWeek * 20)}%` }} /></div>
        </div>
      </aside>

      <section className="main">
        <header className="topbar" ref={topbarRef} tabIndex={-1}>
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
          <div className="user" aria-label="当前用户">
            <span>产品练习生 · {sourceLabel}</span>
            <strong>{userName}</strong>
          </div>
        </header>
        <div className="content">
          {activeWorkbenchWorldId !== null ? (
            <WorldWorkbench
              key={activeWorkbenchWorldId}
              initialWorldId={activeWorkbenchWorldId}
              onClose={() => {
                setActiveWorkbenchWorldId(null);
                setView("today");
              }}
              onRunComplete={completeWorkbenchWorld}
            />
          ) : activeTraining ? (
            <TrainingWorkspace
              initialMode={activeTraining.mode}
              onClose={() => {
                setActiveTraining(null);
                setView(historyRecords.length ? "review" : "today");
              }}
              onRecord={addRecord}
              onRetry={updateRetry}
              scenarioId={activeTraining.scenarioId}
            />
          ) : view === "today" ? (
            <TodayPanel
              onOpenReview={() => setView("review")}
              onStart={startTraining}
              onStartWorkbench={(worldId) => setActiveWorkbenchWorldId(worldId ?? displayedNextChallenge.world_id ?? DEFAULT_WORLD_ID)}
              onOpenAbility={() => setView("ability")}
              nextWorldTitle={displayedNextChallenge.world_title}
              nextWorldReason={displayedNextChallenge.reason}
              workbenchComplete={nextChallengeSelection?.loop_complete ?? false}
              records={historyRecords}
            />
          ) : view === "map" ? (
            <TrainingMap onStart={startTraining} />
          ) : view === "review" ? (
            <div className="stack-lg">
              <WorldDecisionHistoryPanel />
              <ReviewPanel onStart={startTraining} records={historyRecords} />
            </div>
          ) : view === "ability" ? (
            // #6 新链路：判断证据画像（替换旧 totalScore / 雷达图）
            // 旧 AbilityPanel 保留供旧训练链路使用
            <div className="ability-layout">
              <JudgmentProfilePanel />
              <AbilityPanel onOpenReview={() => setView("review")} records={historyRecords} />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
