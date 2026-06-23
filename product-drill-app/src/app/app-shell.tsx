"use client";

import { useState, type KeyboardEvent } from "react";
import { buildAbilityProfile } from "../lib/ability-profile";
import { generateEvaluation, type Evaluation } from "../lib/evaluation";
import { NAV_ITEMS, ViewId, getViewMeta } from "../lib/navigation";
import { analyzeProduct, type ProductAnalysis, type ProductProfile } from "../lib/product-analysis";
import {
  createTrainingHistoryRecord,
  type TrainingHistoryRecord
} from "../lib/training-history";
import { createTrainingSession, sendTrainingMessage, type TrainingSession } from "../lib/training-session";
import { DEFAULT_SCENARIO, INDUSTRY_SCENARIOS, TRAINING_MODES } from "../lib/training-config";

const modeDescription = TRAINING_MODES.map((mode) => `${mode.name}：${mode.description}`).join("");

type WorkbenchProps = {
  initialScenario: string;
  onHistoryRecord: (record: TrainingHistoryRecord) => void;
  onOpenHistory: () => void;
};

function Workbench({ initialScenario, onHistoryRecord, onOpenHistory }: WorkbenchProps) {
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [reply, setReply] = useState("");
  const [scenario, setScenario] = useState(initialScenario);

  function startTraining() {
    setSession(createTrainingSession({ scenario, mode: TRAINING_MODES[0].name }));
    setEvaluation(null);
    setReply("");
  }

  function sendReply(content = reply) {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const currentSession = session ?? createTrainingSession({ scenario, mode: TRAINING_MODES[0].name });
    setSession(sendTrainingMessage(currentSession, trimmed));
    setReply("");
  }

  function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendReply(event.currentTarget.value);
    }
  }

  function submitSolution() {
    const trimmed = reply.trim();
    if (session || trimmed) {
      const currentSession = session ?? createTrainingSession({ scenario, mode: TRAINING_MODES[0].name });
      const finalSession = trimmed ? sendTrainingMessage(currentSession, trimmed) : currentSession;
      const nextEvaluation = generateEvaluation(finalSession);
      setSession(finalSession);
      setEvaluation(nextEvaluation);
      setReply("");
      onHistoryRecord(createTrainingHistoryRecord(finalSession, nextEvaluation));
    }
  }

  return (
    <div className="workspace-grid">
      <section className="panel">
        <h2>场景设置</h2>
        <label>
          行业场景
          <select onChange={(event) => setScenario(event.target.value)} value={scenario}>
            {INDUSTRY_SCENARIOS.map((scenario) => (
              <option key={scenario.name}>{scenario.name}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>训练模式</span>
          <div className="segmented">
            {TRAINING_MODES.map((mode, index) => (
              <button className={index === 0 ? "selected" : ""} key={mode.name} type="button">
                {mode.name}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">{modeDescription}</p>
        <div className="field">
          <span>难度级别</span>
          <div className="segmented">
            <button type="button">基础</button>
            <button className="selected" type="button">标准</button>
            <button type="button">严格</button>
          </div>
        </div>
        <button className="primary" onClick={startTraining} type="button">开始训练</button>
      </section>

      <section className="panel conversation">
        <div className="panel-title">
          <h2>AI 对话</h2>
          <button onClick={onOpenHistory} type="button">查看对话记录</button>
        </div>
        <div className="message-list">
          {(session?.messages ?? [
            { id: "seed-ai", role: "ai", content: "点击开始训练后，我会根据当前场景进入追问。" }
          ]).map((message) => (
            <div className={`bubble ${message.role}`} key={message.id}>
              {message.role === "ai" ? (
                <>
                  <strong>AI</strong>
                  <span>{message.content}</span>
                </>
              ) : (
                message.content
              )}
            </div>
          ))}
        </div>
        <textarea
          onKeyDown={handleReplyKeyDown}
          onChange={(event) => setReply(event.target.value)}
          placeholder="输入你的回复，Enter 发送"
          value={reply}
        />
        <div className="actions">
          <button type="button">总结已知信息</button>
          <button disabled={!session && !reply.trim()} onClick={submitSolution} type="button">提交方案</button>
          <button type="button">生成评估</button>
          <button className="primary" disabled={!reply.trim()} onClick={() => sendReply()} type="button">发送</button>
        </div>
      </section>

      <section className="panel">
        <h2>训练目标</h2>
        <p>理解客户在企业培训场景下的核心需求与约束，输出有针对性的产品解决方案并验证价值。</p>
        {evaluation ? (
          <div className="evaluation">
            <h3>综合评分</h3>
            <div className="score">{evaluation.totalScore} / 5.0</div>
            <h3>维度评分</h3>
            {evaluation.dimensions.map((dimension) => (
              <div className="dimension-row" key={dimension.name}>
                <span>{dimension.name}</span>
                <strong>{dimension.score}</strong>
              </div>
            ))}
            <h3>具体问题</h3>
            {evaluation.issues.map((issue) => (
              <div className="issue-item" key={issue}>{issue}</div>
            ))}
          </div>
        ) : (
          <>
            <h3>当前评分预览</h3>
            <div className="score">3.0 / 5.0</div>
          </>
        )}
      </section>
    </div>
  );
}

function HistoryPanel({ records }: { records: TrainingHistoryRecord[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id ?? null);
  const selected = records.find((record) => record.id === selectedId) ?? records[0];

  return (
    <section className="panel">
      <h2>最近训练</h2>
      {records.length === 0 ? (
        <div className="notice">暂无训练记录。完成一次训练并提交方案后，会在这里看到历史复盘。</div>
      ) : (
        <div className="history-layout">
          <table>
            <tbody>
              {records.map((record) => (
                <tr className="history-record" key={record.id}>
                  <td>{record.title}</td>
                  <td>{record.scenario}</td>
                  <td>{record.mode}</td>
                  <td>{record.totalScore}</td>
                  <td>
                    <button onClick={() => setSelectedId(record.id)} type="button">查看详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected ? (
            <div className="history-detail">
              <h3>历史详情</h3>
              <div className="message-list history-messages">
                {selected.messages.map((message) => (
                  <div className={`bubble ${message.role}`} key={message.id}>
                    {message.role === "ai" ? (
                      <>
                        <strong>AI</strong>
                        <span>{message.content}</span>
                      </>
                    ) : (
                      message.content
                    )}
                  </div>
                ))}
              </div>
              <h3>综合评分</h3>
              <div className="score">{selected.totalScore} / 5.0</div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ProductPanel() {
  const [profile, setProfile] = useState<ProductProfile>({
    productName: "",
    productDescription: "",
    targetUsers: "",
    coreFeatures: "",
    productStage: "",
    productUrl: ""
  });
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);

  function update(field: keyof ProductProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    setAnalysis(analyzeProduct(profile));
  }

  return (
    <section className="panel">
      <h2>自有产品分析</h2>
      <div className="form-grid">
        <label>产品名称<input onChange={(event) => update("productName", event.target.value)} placeholder="例如：门店库存管理工具" value={profile.productName} /></label>
        <label>产品链接<input onChange={(event) => update("productUrl", event.target.value)} placeholder="https://example.com" value={profile.productUrl} /></label>
        <label>目标用户<input onChange={(event) => update("targetUsers", event.target.value)} placeholder="例如：中小餐饮门店老板和店长" value={profile.targetUsers} /></label>
        <label>当前阶段<input onChange={(event) => update("productStage", event.target.value)} placeholder="例如：MVP" value={profile.productStage} /></label>
        <label className="wide">核心功能<textarea onChange={(event) => update("coreFeatures", event.target.value)} placeholder="例如：库存记录、低库存提醒、损耗统计" value={profile.coreFeatures} /></label>
        <label className="wide">产品介绍<textarea onChange={(event) => update("productDescription", event.target.value)} placeholder="描述产品解决的问题和当前状态" value={profile.productDescription} /></label>
      </div>
      <button className="primary" onClick={submit} type="button">生成产品理解</button>

      {analysis ? (
        <div className="product-analysis">
          <h3>产品理解摘要</h3>
          <p>{analysis.summary}</p>
          <h3>产品追问</h3>
          {analysis.questions.map((question) => (
            <div className="product-question" key={question}>{question}</div>
          ))}
          <h3>优化建议</h3>
          {analysis.suggestions.map((suggestion) => (
            <div className="product-suggestion" key={suggestion.stage}>
              <strong>{suggestion.stage}</strong>
              <p>{suggestion.content}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProfilePanel({ records }: { records: TrainingHistoryRecord[] }) {
  const profile = buildAbilityProfile(records);
  const maxTrend = Math.max(...profile.trend.map((item) => item.score), 100);

  return (
    <section className="panel">
      <h2>能力画像</h2>
      <div className="metrics">
        <div><span>平均分</span><strong>{profile.averageScore}</strong></div>
        <div><span>完成训练</span><strong>{profile.completedCount} 次</strong></div>
        <div><span>最高分</span><strong>{profile.bestScore}</strong></div>
        <div><span>综合进步</span><strong>{profile.progress >= 0 ? "+" : ""}{profile.progress}</strong></div>
      </div>

      <div className="profile-grid">
        <section>
          <h3>最近训练表现趋势</h3>
          <div className="trend-chart">
            {profile.trend.length ? profile.trend.map((item) => (
              <div className="trend-point" key={item.label}>
                <span style={{ height: `${Math.max(8, (item.score / maxTrend) * 120)}px` }} />
                <small>{item.label}</small>
                <strong>{item.score}</strong>
              </div>
            )) : <div className="notice">完成训练后显示趋势</div>}
          </div>
        </section>

        <section>
          <h3>能力维度表现</h3>
          {profile.dimensions.map((dimension) => (
            <div className="ability-dimension" key={dimension.name}>
              <span>{dimension.name}</span>
              <div><i style={{ width: `${dimension.score}%` }} /></div>
              <strong>{dimension.score}</strong>
            </div>
          ))}
        </section>
      </div>

      <div className="profile-grid">
        <section>
          <h3>高频短板</h3>
          {profile.shortcomings.map((item) => (
            <div className="issue-item" key={item}>{item}</div>
          ))}
        </section>
        <section>
          <h3>下一步推荐训练</h3>
          <div className="notice">{profile.nextTraining}</div>
        </section>
      </div>
    </section>
  );
}

function ScenarioPanel({ onStartScenario }: { onStartScenario: (scenario: string) => void }) {
  return (
    <section className="panel">
      <h2>行业场景</h2>
      <div className="scenario-list">
        {INDUSTRY_SCENARIOS.map((scenario) => (
          <article key={scenario.name}>
            <h3>{scenario.name}</h3>
            <p>{scenario.description}</p>
            <button onClick={() => onStartScenario(scenario.name)} type="button">
              用 {scenario.name} 开始训练
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AppShell() {
  const [view, setView] = useState<ViewId>("workbench");
  const [initialScenario, setInitialScenario] = useState(DEFAULT_SCENARIO);
  const [historyRecords, setHistoryRecords] = useState<TrainingHistoryRecord[]>([]);
  const meta = getViewMeta(view);
  function addHistoryRecord(record: TrainingHistoryRecord) {
    setHistoryRecords((current) => [record, ...current]);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">PD</div>
          <div>
            <strong>Product Drill</strong>
            <span>AI 产品思维训练平台</span>
          </div>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              className={item.view === view ? "active" : ""}
              key={item.view}
              onClick={() => setView(item.view)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="main">
        <header className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <div className="user">张明</div>
        </header>
        <div className="content">
          {view === "workbench" ? (
            <Workbench
              initialScenario={initialScenario}
              onHistoryRecord={addHistoryRecord}
              onOpenHistory={() => setView("history")}
            />
          ) : view === "history" ? (
            <HistoryPanel records={historyRecords} />
          ) : view === "profile" ? (
            <ProfilePanel records={historyRecords} />
          ) : view === "product" ? (
            <ProductPanel />
          ) : (
            <ScenarioPanel onStartScenario={(scenario) => {
              setInitialScenario(scenario);
              setView("workbench");
            }} />
          )}
        </div>
      </section>
    </main>
  );
}
