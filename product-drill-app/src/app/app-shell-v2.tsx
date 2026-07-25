"use client";

import { useState, type KeyboardEvent } from "react";
import { submitDemoJudgment } from "../lib/demo-training";
import { generateEvaluation, type Evaluation } from "../lib/evaluation";
import {
  createTrainingSession,
  sendTrainingMessage,
  TRAINING_MODE_OPTIONS,
  type TrainingSession
} from "../lib/training-session";
import { DEFAULT_SCENARIO_ID, TRAINING_SCENARIOS } from "../lib/training-config";

type View = "home" | "workbench" | "product" | "history" | "profile";

const modeDescription = "练习：提供轻提示。 独立：只回答问题。 严格：只回答问题。";

const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: "home", label: "首页", icon: "首" },
  { id: "workbench", label: "工作台", icon: "工" },
  { id: "product", label: "我的产品", icon: "产" },
  { id: "history", label: "对话历史", icon: "史" },
  { id: "profile", label: "能力画像", icon: "像" }
];

const viewCopy: Record<View, { title: string; desc: string }> = {
  home: { title: "首页", desc: "用 AI 训练需求判断、客户洞察与产品表达。" },
  workbench: { title: "训练工作台", desc: "选择行业场景、训练模式与难度，通过 AI 对话训练需求判断和方案表达。" },
  product: { title: "我的产品", desc: "提交产品资料，让 AI 追问真实用户、场景与价值。" },
  history: { title: "对话历史", desc: "回看训练记录、客户问题与方案评估。" },
  profile: { title: "能力画像", desc: "用得分、短板和建议定位下一轮训练方向。" }
};

const features = [
  {
    title: "行业客户模拟",
    desc: "选择行业、角色与难度，让 AI 以客户视角连续追问，帮助你沉淀真实需求。",
    tag: "训练主流程",
    visualTitle: "AI 客户 · 企业培训行业",
    aiLine: "客户：你的产品到底解决哪个业务问题？",
    userLine: "我想先梳理企业培训转化率低的问题。",
    footer: "输入你的回答，Enter 发送"
  },
  {
    title: "自有产品分析",
    desc: "输入产品介绍和链接，AI 先复述理解，再围绕用户、场景、价值与风险追问。",
    tag: "MVP 核心能力",
    visualTitle: "产品资料 · Product Profile",
    aiLine: "AI：我理解这是面向中小企业的 AI 服务产品。",
    userLine: "目标用户是需要提升员工培训效果的企业负责人。",
    footer: "生成产品理解摘要"
  },
  {
    title: "方案评估与能力画像",
    desc: "提交方案后直接生成评估，并把表现沉淀到能力画像和下一步推荐训练。",
    tag: "复盘闭环",
    visualTitle: "评估结果 · 能力画像",
    aiLine: "综合评分 70 / 100，需求理解较好，价值论证不足。",
    userLine: "下一步重点训练：真实指标、预算约束、落地路径。",
    footer: "查看能力画像"
  }
];

export function AppShellV2() {
  const [view, setView] = useState<View>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [featureIndex, setFeatureIndex] = useState(0);
  const meta = viewCopy[view];
  const activeFeature = features[featureIndex];

  function open(viewId: View) {
    setView(viewId);
  }

  return (
    <main className="v2-shell">
      <aside className={`v2-sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="v2-brand-row">
          {!collapsed ? (
            <div className="v2-brand">
              <div className="v2-logo">PD</div>
              <div>
                <strong>Product Drill</strong>
                <span>AI 产品思维训练平台</span>
              </div>
            </div>
          ) : null}
          <button
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            className="v2-collapse"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? ">" : "<"}
          </button>
        </div>

        <nav className="v2-nav" aria-label="Demo v2 navigation">
          {navItems.map((item) => (
            <button
              aria-label={item.label}
              className={`${view === item.id ? "active" : ""} ${collapsed ? "icon-only" : ""}`}
              key={item.id}
              onClick={() => open(item.id)}
              type="button"
            >
              {collapsed ? <span className="v2-nav-icon" aria-hidden="true">{item.icon}</span> : null}
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          ))}
        </nav>

        {!collapsed ? (
          <div className="v2-sidebar-footer">
            <button type="button">使用指南</button>
            <button type="button">设置</button>
          </div>
        ) : null}
      </aside>

      <section className="v2-main">
        <header className="v2-topbar">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.desc}</p>
          </div>
          <div className="v2-top-actions">
            <button className="v2-primary" onClick={() => open("workbench")} type="button">开始训练</button>
            <button onClick={() => open("product")} type="button">分析我的产品</button>
          </div>
        </header>

        <div className="v2-content">
          {view === "home" ? (
            <HomeView
              activeFeature={activeFeature}
              featureIndex={featureIndex}
              onFeatureChange={setFeatureIndex}
            />
          ) : view === "workbench" ? (
            <WorkbenchView />
          ) : view === "product" ? (
            <ProductView />
          ) : view === "history" ? (
            <HistoryView />
          ) : (
            <ProfileView />
          )}
        </div>
      </section>
    </main>
  );
}

function HomeView({
  activeFeature,
  featureIndex,
  onFeatureChange
}: {
  activeFeature: (typeof features)[number];
  featureIndex: number;
  onFeatureChange: (index: number) => void;
}) {
  function turnFeature(step: number) {
    onFeatureChange((featureIndex + step + features.length) % features.length);
  }

  return (
    <div className="v2-home">
      <section className="v2-home-section v2-intro">
        <div>
          <h2>1. 产品介绍</h2>
          <h3>用 AI 训练完整产品思维</h3>
          <p>
            Product Drill 通过行业客户模拟、自有产品分析和方案评估，帮助使用者快速理解客户痛点，
            训练清晰的需求判断与解决方案表达。
          </p>
        </div>
        <div className="v2-metric-grid" aria-label="平台能力数据">
          {[
            ["训练模式", "3", "种"],
            ["行业场景", "5", "类"],
            ["产品分析", "1", "套流程"],
            ["评估维度", "4", "项"]
          ].map(([label, value, unit]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{unit}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="v2-home-section">
        <h2>2. 核心功能</h2>
        <div className="v2-feature-stage v2-home-feature-stage">
          <button
            aria-label="向左翻页"
            className="v2-slide-arrow prev"
            onClick={() => turnFeature(-1)}
            type="button"
          >
            ‹
          </button>
          <div className="v2-feature-main-card">
            <div className="v2-feature-visual">
              <FeaturePreview feature={activeFeature} />
            </div>
            <div className="v2-feature-copy">
              <span>{activeFeature.tag}</span>
              <h3>{activeFeature.title}</h3>
              <p>{activeFeature.desc}</p>
            </div>
            <div className="v2-dots">
              {features.map((item, index) => (
                <button
                  aria-label={`切换到${item.title}`}
                  className={index === featureIndex ? "active" : ""}
                  key={item.title}
                  onClick={() => onFeatureChange(index)}
                  type="button"
                />
              ))}
            </div>
          </div>
          <div className="v2-feature-side-cards">
            {features.slice(1).map((item, index) => (
              <button key={item.title} onClick={() => onFeatureChange(index + 1)} type="button">
                <FeatureCardPreview feature={item} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{index === 0 ? "梳理产品定位与价值点，识别关键优势与优化方向。" : "从多维度评估方案表现，生成能力画像与改进建议。"}</small>
                </span>
                <b>›</b>
              </button>
            ))}
          </div>
          <button
            aria-label="向右翻页"
            className="v2-slide-arrow next"
            onClick={() => turnFeature(1)}
            type="button"
          >
            ›
          </button>
        </div>
      </section>

      <div className="v2-data-row">
        <MetricPanel
          title="用户训练数据"
          items={[
            ["完成训练", "24", "次"],
            ["平均得分", "78.6", ""],
            ["最高得分", "92", ""],
            ["连续训练", "6", "天"]
          ]}
        />
        <MetricPanel
          title="训练增长"
          items={[
            ["近 7 天", "+4", "次"],
            ["近 30 天", "+12", "次"],
            ["平均分提升", "+6.4", "分"],
            ["连续天数", "+3", "天"]
          ]}
        />
      </div>
    </div>
  );
}

function FeaturePreview({ feature }: { feature: (typeof features)[number] }) {
  if (feature.title === "方案评估与能力画像") {
    return (
      <div className="v2-mini-window v2-ability-preview">
        <strong className="v2-mini-title">能力维度表现</strong>
        {[
          ["需求理解", 82],
          ["方案设计", 77],
          ["异议应对", 72],
          ["商业价值论证", 67],
          ["表达与沟通", 62]
        ].map(([label, score]) => (
          <div className="v2-preview-bar" key={label}>
            <span>{label}</span>
            <i><b style={{ width: `${score}%` }} /></i>
            <strong>{score}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (feature.title === "自有产品分析") {
    return (
      <div className="v2-mini-window v2-product-preview">
        <div className="v2-mini-head"><span /><span /><span /></div>
        <strong className="v2-mini-title">产品资料 · Product Profile</strong>
        <div className="v2-preview-fields">
          <span>产品名称：AI 企业培训助手</span>
          <span>目标用户：企业培训负责人</span>
          <span>产品链接：https://product.example</span>
          <span>当前阶段：MVP 验证</span>
        </div>
        <div className="v2-mini-input">生成产品理解摘要</div>
      </div>
    );
  }

  return (
    <div className="v2-mini-window">
      <div className="v2-mini-head"><span /><span /><span /></div>
      <strong className="v2-mini-title">{feature.visualTitle}</strong>
      <div className="v2-mini-chat ai">{feature.aiLine}</div>
      <div className="v2-mini-chat user">{feature.userLine}</div>
      <div className="v2-mini-input">{feature.footer}</div>
    </div>
  );
}

function FeatureCardPreview({ feature }: { feature: (typeof features)[number] }) {
  if (feature.title === "方案评估与能力画像") {
    return (
      <div className="v2-card-score-preview">
        <span>综合评分</span>
        <strong>70 / 100</strong>
      </div>
    );
  }

  return (
    <div className="v2-card-doc-preview">
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function MetricPanel({ title, items }: { title: string; items: string[][] }) {
  return (
    <section className="v2-section v2-metric-panel">
      <h2>{title}</h2>
      <div className="v2-number-line">
        {items.map(([label, value, unit]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{unit}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkbenchView() {
  const [demoSession, setDemoSession] = useState<TrainingSession | null>(null);
  const [demoEvaluation, setDemoEvaluation] = useState<Evaluation | null>(null);
  const [demoReply, setDemoReply] = useState("");
  const [demoScenarioId, setDemoScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [demoNotice, setDemoNotice] = useState("");
  const [demoMode, setDemoMode] = useState<TrainingSession["mode"]>("练习");

  function changeDemoScenario(nextScenarioId: string) {
    const nextScenario = TRAINING_SCENARIOS.find((scenario) => scenario.id === nextScenarioId) ?? TRAINING_SCENARIOS[0];
    setDemoScenarioId(nextScenario.id);
    setDemoNotice(`行业场景已切换为 ${nextScenario.shortTitle}，请重新开始训练。`);
    setDemoSession(null);
    setDemoEvaluation(null);
  }

  function startDemoTraining() {
    setDemoSession(createTrainingSession({ scenarioId: demoScenarioId, mode: demoMode }));
    setDemoEvaluation(null);
    setDemoReply("");
  }

  function changeDemoMode(nextMode: TrainingSession["mode"]) {
    setDemoMode(nextMode);
    setDemoSession(null);
    setDemoEvaluation(null);
    setDemoReply("");
  }

  function sendDemoReply(content = demoReply) {
    const trimmed = content.trim();
    if (!trimmed || !demoSession) {
      return;
    }

    setDemoSession(sendTrainingMessage(demoSession, trimmed));
    setDemoReply("");
  }

  function handleDemoReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendDemoReply(event.currentTarget.value);
    }
  }

  function submitDemoSolution() {
    if (!demoSession) {
      return;
    }

    const finalSession = submitDemoJudgment(demoSession, demoReply);
    const nextEvaluation = generateEvaluation(finalSession);
    setDemoSession(finalSession);
    setDemoEvaluation(nextEvaluation);
    setDemoReply("");
  }

  return (
    <div className="v2-workbench-grid">
      <section className="v2-section v2-settings-panel">
        <h2>场景设置</h2>
        <label>行业场景
          <select onChange={(event) => changeDemoScenario(event.target.value)} value={demoScenarioId}>
            {TRAINING_SCENARIOS.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>{scenario.shortTitle}</option>
            ))}
          </select>
        </label>
        {demoNotice ? <div className="v2-notice">{demoNotice}</div> : null}
        <div className="v2-field">
          <span>训练模式</span>
          <div className="v2-segmented">
            {TRAINING_MODE_OPTIONS.map((item) => (
              <button
                aria-pressed={item === demoMode}
                className={item === demoMode ? "selected" : ""}
                key={item}
                onClick={() => changeDemoMode(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <p className="v2-muted">{modeDescription}</p>
        <p className="v2-muted">难度级别：{TRAINING_SCENARIOS.find((scenario) => scenario.id === demoScenarioId)?.difficulty}</p>
        <button className="v2-primary" onClick={startDemoTraining} type="button">开始训练</button>
      </section>

      <section className="v2-section v2-conversation-panel">
        <div className="v2-panel-title">
          <h2>AI 对话</h2>
          <button type="button">查看对话记录</button>
        </div>
        <div className="v2-chat-list">
          {(demoSession?.messages ?? []).map((message) => (
            <div className={`v2-bubble ${message.role}`} key={message.id}>
              <strong>{message.role === "ai" ? "AI" : "你"}</strong>
              <span>{message.content}</span>
            </div>
          ))}
        </div>
        <textarea
          onKeyDown={handleDemoReplyKeyDown}
          onChange={(event) => setDemoReply(event.target.value)}
          placeholder="输入你的回复，Enter 发送"
          value={demoReply}
        />
        <div className="v2-chat-actions">
          <button type="button">总结已知信息</button>
          <button disabled={!demoSession} onClick={submitDemoSolution} type="button">提交方案</button>
          <button disabled={!demoSession} onClick={submitDemoSolution} type="button">生成评估</button>
          <button className="v2-primary" disabled={!demoSession || !demoReply.trim()} onClick={() => sendDemoReply()} type="button">发送</button>
        </div>
      </section>

      <section className="v2-section v2-side-panel">
        <h2>训练目标</h2>
        <p>理解客户在当前行业场景下的核心需求与约束，输出有针对性的产品解决方案并验证价值。</p>
        {demoEvaluation ? (
          <div>
            <h3>综合评分</h3>
            <div className="v2-score compact">{demoEvaluation.totalScore} / 100</div>
            <h3>维度评分</h3>
            {demoEvaluation.dimensions.map((dimension) => (
              <div className="v2-score-row" key={dimension.name}>
                <span>{dimension.name}</span>
                <strong>{dimension.score}</strong>
              </div>
            ))}
            <h3>具体问题</h3>
            <ul>{demoEvaluation.issues.map((issue) => <li key={issue.id}>{issue.title}</li>)}</ul>
          </div>
        ) : (
          <>
            <h3>当前评分预览</h3>
            <div className="v2-score compact">60 / 100</div>
          </>
        )}
      </section>
    </div>
  );

}

function ProductView() {
  const seedProduct = {
    id: "training-ai",
    name: "AI 企业培训助手",
    stage: "MVP 验证",
    users: "企业培训负责人",
    url: "https://product.example",
    description: "帮助企业培训负责人提升完成率、知识转化和业务部门配合度。",
    docs: ["产品介绍.md"],
    code: ["frontend.zip"]
  };
  const [products, setProducts] = useState([seedProduct]);
  const [screen, setScreen] = useState<"list" | "detail" | "edit">("list");
  const [selectedId, setSelectedId] = useState(seedProduct.id);
  const selectedProduct = products.find((item) => item.id === selectedId) ?? products[0];
  const [draft, setDraft] = useState(seedProduct);
  const [docNames, setDocNames] = useState(seedProduct.docs);
  const [codeNames, setCodeNames] = useState(seedProduct.code);

  function openDetail(productId: string) {
    const product = products.find((item) => item.id === productId) ?? products[0];
    setSelectedId(product.id);
    setDraft(product);
    setDocNames(product.docs);
    setCodeNames(product.code);
    setScreen("detail");
  }

  function openAdd() {
    const emptyProduct = {
      id: `product-${products.length + 1}`,
      name: "",
      stage: "资料收集中",
      users: "",
      url: "",
      description: "",
      docs: [],
      code: []
    };
    setDraft(emptyProduct);
    setDocNames([]);
    setCodeNames([]);
    setScreen("edit");
  }

  function openEdit() {
    setDraft(selectedProduct);
    setDocNames(selectedProduct.docs);
    setCodeNames(selectedProduct.code);
    setScreen("edit");
  }

  function saveProduct() {
    const savedProduct = {
      ...draft,
      id: draft.id || `product-${products.length + 1}`,
      name: draft.name.trim() || "未命名产品",
      docs: docNames,
      code: codeNames
    };
    setProducts((current) => {
      const exists = current.some((item) => item.id === savedProduct.id);
      return exists ? current.map((item) => item.id === savedProduct.id ? savedProduct : item) : [savedProduct, ...current];
    });
    setSelectedId(savedProduct.id);
    setScreen("list");
  }

  if (screen === "detail") {
    return (
      <section className="v2-section v2-product-detail">
        <div className="v2-product-head">
          <div>
            <button onClick={() => setScreen("list")} type="button">返回产品文件</button>
            <h2>{selectedProduct.name}</h2>
            <p>{selectedProduct.stage} · {selectedProduct.users}</p>
          </div>
          <div>
            <button onClick={openAdd} type="button">添加产品</button>
            <button className="v2-primary" onClick={openEdit} type="button">修改资料</button>
          </div>
        </div>

        <div className="v2-product-detail-grid">
          <section>
            <h2>AI 解读</h2>
            <p>我理解这是面向{selectedProduct.users || "目标用户"}的产品，核心价值是{selectedProduct.description || "帮助用户完成关键业务任务"}。</p>
            <textarea placeholder="向 AI 说明并修改" />
          </section>
          <section>
            <h2>AI 产品成熟度评估</h2>
            <div className="v2-product-score">3.8 / 5.0</div>
            {["定位清晰度", "需求匹配", "功能聚焦", "验证证据"].map((item, index) => (
              <div className="v2-score-row" key={item}>
                <span>{item}</span>
                <strong>{(4.2 - index * 0.2).toFixed(1)}</strong>
              </div>
            ))}
          </section>
        </div>
      </section>
    );
  }

  if (screen === "edit") {
    return (
      <div className="v2-product-edit-grid">
        <section className="v2-section">
          <div className="v2-product-head">
            <h2>填写产品资料</h2>
            <button onClick={() => setScreen("list")} type="button">取消</button>
          </div>
          <div className="v2-upload-row">
            <label>上传产品文档
              <input
                type="file"
                onChange={(event) => setDocNames(Array.from(event.target.files ?? []).map((file) => file.name))}
              />
            </label>
            <label>上传源代码
              <input
                type="file"
                multiple
                onChange={(event) => setCodeNames(Array.from(event.target.files ?? []).map((file) => file.name))}
              />
            </label>
          </div>
          <div className="v2-form-grid">
            <label>产品名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>产品链接<input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></label>
            <label>目标用户<input value={draft.users} onChange={(event) => setDraft({ ...draft, users: event.target.value })} /></label>
            <label>当前阶段<input value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })} /></label>
            <label className="wide">产品介绍<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          </div>
          <div className="v2-product-files">
            <span>文档：{docNames.join("、") || "等待上传后 AI 预填写"}</span>
            <span>源代码：{codeNames.join("、") || "等待上传后 AI 解读"}</span>
          </div>
          <button className="v2-primary" onClick={saveProduct} type="button">保存产品</button>
        </section>

        <aside className="v2-section v2-product-ai-side">
          <h2>AI 追问与澄清</h2>
          <div className="v2-review-summary">
            <strong>AI 对产品的初步理解</strong>
            <p>你正在补充一个面向{draft.users || "待明确用户"}的产品。上传文档和源代码后，AI 会先预填写产品定位、核心功能与风险点。</p>
          </div>
          <ol>
            <li>最先服务的细分用户是谁？</li>
            <li>用户为什么现在必须解决这个问题？</li>
            <li>产品成功的衡量指标是什么？</li>
          </ol>
          <textarea placeholder="回答 AI 追问或修正理解" />
        </aside>
      </div>
    );
  }

  return (
    <section className="v2-section v2-product-list">
      <div className="v2-product-head">
        <h2>产品文件</h2>
        <button className="v2-primary" onClick={openAdd} type="button">添加产品</button>
      </div>
      <div className="v2-product-file-list">
        {products.map((product) => (
          <button key={product.id} onClick={() => openDetail(product.id)} type="button">
            <strong>{product.name}</strong>
            <span>{product.stage}</span>
            <small>{product.docs.length + product.code.length} 个资料文件</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function HistoryView() {
  return (
    <section className="v2-section">
      <h2>对话历史</h2>
      <div className="v2-table">
        {[
          ["AI+ 服务训练", "用户需求提出", "70 / 100"],
          ["企业培训方案", "客户咨询", "80 / 100"],
          ["自有产品分析", "产品深挖", "76 / 100"]
        ].map(([title, mode, score]) => (
          <div key={title}>
            <strong>{title}</strong>
            <span>{mode}</span>
            <span>{score}</span>
            <button type="button">查看</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileView() {
  return (
    <section className="v2-section">
      <h2>能力画像</h2>
      <div className="v2-data-row">
        <MetricPanel title="综合进步" items={[["平均分", "78.6", ""], ["完成训练", "24", "次"], ["最高分", "92", ""], ["进步", "+12.3", "分"]]} />
        <section className="v2-section v2-metric-panel">
          <h2>能力维度表现</h2>
          {["需求理解", "方案设计", "异议应对", "商业价值论证", "表达与沟通"].map((item, index) => (
            <div className="v2-bar-row" key={item}>
              <span>{item}</span>
              <i><b style={{ width: `${82 - index * 5}%` }} /></i>
              <strong>{82 - index * 5}</strong>
            </div>
          ))}
        </section>
      </div>
      <div className="v2-result-block">
        <h3>下一步推荐训练</h3>
        <p>优先训练“真实用户与指标澄清”，要求每轮回答都给出可验证场景和衡量指标。</p>
      </div>
    </section>
  );
}
