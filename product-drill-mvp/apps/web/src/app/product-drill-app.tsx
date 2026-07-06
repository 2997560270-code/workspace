"use client";

import { useState } from "react";
import { createTrainingHistoryRecord, type TrainingHistoryRecord } from "../features/history/training-history";
import { generateEvaluation, type Evaluation } from "../features/training/evaluation";
import { addTrainingAnswer, createTrainingSession, sendTrainingMessage, type TrainingSession } from "../features/training/training-session";
import { analyzeProduct, type ProductAnalysis, type ProductProfile } from "../features/products/product-analysis";
import { loadFromLocalStorage, PRODUCT_DRILL_STORAGE_KEYS, saveToLocalStorage } from "../features/storage/local-persistence";
import { buildAbilityProfile } from "../features/ability-profile/ability-profile";

type PageId = "home" | "training" | "products" | "addProduct" | "history" | "ability";

type NavItem = {
  id: PageId;
  label: string;
  icon: string;
  testId: string;
};

const navItems: NavItem[] = [
  { id: "home", label: "首页", icon: "⌂", testId: "nav-home" },
  { id: "training", label: "训练", icon: "□", testId: "nav-training" },
  { id: "products", label: "产品", icon: "◇", testId: "nav-products" },
  { id: "history", label: "历史", icon: "≡", testId: "nav-history" },
  { id: "ability", label: "能力", icon: "∥", testId: "nav-ability" }
];

const pageCopy: Record<PageId, { title: string; subtitle: string }> = {
  home: { title: "首页", subtitle: "用 AI 训练需求判断、客户洞察与产品表达。" },
  training: { title: "训练", subtitle: "让 AI 以客户视角连续追问，训练需求判断与方案表达。" },
  products: { title: "产品", subtitle: "上传产品资料，让 AI 先理解产品，再追问真实用户、场景与价值。" },
  addProduct: { title: "添加产品", subtitle: "上传资料或手动填写，让 AI 先理解产品，再追问关键假设。" },
  history: { title: "历史", subtitle: "回看每一次训练记录，复盘关键判断与方案表达。" },
  ability: { title: "能力", subtitle: "从训练表现中定位高频短板，形成下一步训练路径。" }
};


type SavedProduct = ProductProfile & {
  id: string;
  analysis: ProductAnalysis;
  correction?: string;
};

const initialProducts: SavedProduct[] = [
  {
    id: "product-enterprise-ai-training",
    productName: "企业 AI 培训助手",
    productDescription: "面向企业培训场景，帮助员工把学习内容转化为业务动作。",
    targetUsers: "企业培训负责人、业务部门管理者",
    coreFeatures: "AI 追问、培训复盘、知识转化、效果追踪",
    productStage: "MVP 验证中",
    productUrl: "https://example.com/training-ai",
    analysis: analyzeProduct({
      productName: "企业 AI 培训助手",
      productDescription: "面向企业培训场景，帮助员工把学习内容转化为业务动作。",
      targetUsers: "企业培训负责人、业务部门管理者",
      coreFeatures: "AI 追问、培训复盘、知识转化、效果追踪",
      productStage: "MVP 验证中",
      productUrl: "https://example.com/training-ai"
    })
  }
];
function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function loadSavedProducts() {
  return loadFromLocalStorage<SavedProduct[]>(getBrowserStorage(), PRODUCT_DRILL_STORAGE_KEYS.products, initialProducts);
}

function persistProducts(products: SavedProduct[]) {
  saveToLocalStorage(getBrowserStorage(), PRODUCT_DRILL_STORAGE_KEYS.products, products);
}

function loadHistoryRecords() {
  return loadFromLocalStorage<TrainingHistoryRecord[]>(getBrowserStorage(), PRODUCT_DRILL_STORAGE_KEYS.historyRecords, []);
}

function persistHistoryRecords(records: TrainingHistoryRecord[]) {
  saveToLocalStorage(getBrowserStorage(), PRODUCT_DRILL_STORAGE_KEYS.historyRecords, records);
}

function createResumedTrainingSession(record: TrainingHistoryRecord): TrainingSession {
  const previousUserCount = record.messages.filter((message) => message.role === "user").length;
  return {
    id: `resume-${record.id}`,
    scenario: record.scenario,
    mode: record.mode,
    scenarioUserOffset: previousUserCount,
    messages: [
      ...record.messages,
      {
        id: `resume-notice-${record.id}`,
        role: "ai",
        content: "已载入历史训练记录，可以在原对话基础上继续训练。"
      }
    ]
  };
}
const trainingRows = [
  ["企业培训服务需求澄清", "AI+ / 客户咨询", "3.2 分", "已评估"],
  ["门店库存损耗方案", "B2B / 用户需求提出", "3.8 分", "已评估"],
  ["学习路径设计复盘", "企业培训 / 方案评估", "2.9 分", "待复盘"],
  ["销售知识库价值验证", "AI+ / 方案评估", "4.1 分", "已评估"],
  ["员工学习路径需求拆解", "企业培训 / 客户咨询", "3.6 分", "已评估"],
  ["自有产品定位澄清", "自有产品 / 产品深挖", "3.4 分", "待复盘"]
];

export function ProductDrillApp() {
  const [page, setPage] = useState<PageId>("home");
  const [historyRecords, setHistoryRecords] = useState<TrainingHistoryRecord[]>(loadHistoryRecords);
  const [products, setProducts] = useState<SavedProduct[]>(loadSavedProducts);
  const [selectedProductId, setSelectedProductId] = useState(() => loadSavedProducts()[0]?.id ?? "");
  const [resumeTrainingRecord, setResumeTrainingRecord] = useState<TrainingHistoryRecord | null>(null);
  const copy = pageCopy[page];

  function go(next: PageId) {
    if (next !== "training") {
      setResumeTrainingRecord(null);
    }
    setPage(next);
  }

  function resumeTraining(record: TrainingHistoryRecord) {
    setResumeTrainingRecord(record);
    setPage("training");
  }

  function addHistoryRecord(record: TrainingHistoryRecord) {
    setHistoryRecords((current) => {
      const nextRecords = [record, ...current.filter((item) => item.id !== record.id)];
      persistHistoryRecords(nextRecords);
      return nextRecords;
    });
  }

  function saveProduct(profile: ProductProfile) {
    const product: SavedProduct = {
      ...profile,
      id: `product-${Date.now()}`,
      analysis: analyzeProduct(profile)
    };
    setProducts((current) => {
      const nextProducts = [product, ...current];
      persistProducts(nextProducts);
      return nextProducts;
    });
    setSelectedProductId(product.id);
    setPage("products");
  }

  function updateProductCorrection(productId: string, correction: string) {
    const trimmed = correction.trim();
    if (!trimmed) return;
    setProducts((current) => {
      const nextProducts = current.map((product) => product.id === productId ? { ...product, correction: trimmed } : product);
      persistProducts(nextProducts);
      return nextProducts;
    });
  }

  return (
    <div className="pd-shell" data-testid="app-shell">
      <aside className="pd-sidebar" data-testid="side-nav" aria-label="Product Drill 主导航">
        <div className="pd-brand">
          <div className="pd-mark">PD</div>
          <div className="pd-brand-text">
            <strong>Product Drill</strong>
            <span>AI 产品思维训练平台</span>
          </div>
        </div>
        <nav className="pd-nav">
          {navItems.map((item) => (
            <button
              className={page === item.id ? "active" : ""}
              data-testid={item.testId}
              key={item.id}
              onClick={() => go(item.id)}
              type="button"
            >
              <span className="pd-nav-icon">{item.icon}</span>
              <span className="pd-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="pd-sidebar-footer">
          <button type="button"><span className="pd-nav-icon">?</span><span className="pd-nav-label">使用指南</span></button>
          <button type="button"><span className="pd-nav-icon">‹</span><span className="pd-nav-label">收起提示</span></button>
        </div>
      </aside>

      <main className="pd-main">
        <header className="pd-topbar">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="pd-top-actions" data-testid="top-actions">
            {page === "home" ? <span>已保存 14:32</span> : null}
            {page === "training" ? <><span>本轮 <b>04</b> / 07</span><button className="primary" type="button">结束并评估</button></> : null}
            {page === "history" ? <input aria-label="搜索历史" placeholder="搜索场景、产品或关键词" /> : null}
          </div>
        </header>

        <section className={`pd-content ${page === "training" ? "pd-content-training" : ""}`}>
          {page === "home" ? <HomePage onGo={go} /> : null}
          {page === "training" ? <TrainingPage onHistoryRecordCreated={addHistoryRecord} resumeRecord={resumeTrainingRecord} /> : null}
          {page === "products" ? <ProductsPage onGo={go} onCorrection={updateProductCorrection} products={products} selectedProductId={selectedProductId} setSelectedProductId={setSelectedProductId} /> : null}
          {page === "addProduct" ? <AddProductPage onGo={go} onSave={saveProduct} /> : null}
          {page === "history" ? <HistoryPage onGo={go} onResumeTraining={resumeTraining} records={historyRecords} /> : null}
          {page === "ability" ? <AbilityPage records={historyRecords} /> : null}
        </section>
      </main>
    </div>
  );
}

function HomePage({ onGo }: { onGo: (page: PageId) => void }) {
  return (
    <div className="home-page">
      <section className="panel home-hero" data-testid="home-product-intro">
        <div>
          <p className="eyebrow">产品介绍</p>
          <h2>用 AI 训练完整产品思维</h2>
          <p>Product Drill 通过行业客户模拟、自有产品分析和方案评估，帮助使用者快速理解客户痛点，训练清晰的需求判断与解决方案表达。</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => onGo("training")} type="button">开始训练</button>
            <button onClick={() => onGo("addProduct")} type="button">分析我的产品</button>
          </div>
        </div>
        <div className="hero-preview">
          <div className="preview-head"><span>AI 训练预览</span><i /></div>
          <div className="mini-chat"><span>先说清楚你的具体业务是什么。</span><b>我们在做企业 AI 培训服务。</b><span>谁每天会使用它？他们最难忍受的问题是什么？</span></div>
        </div>
      </section>

      <section className="panel" data-testid="home-core-functions">
        <h2>核心功能</h2>
        <div className="feature-stage">
          <div className="feature-visual">
            <div className="mock-window"><i /><i /><i /><strong>AI 客户模拟</strong><p>客户：你的产品到底解决哪个业务问题？</p><em>输入你的回答，Enter 发送</em></div>
          </div>
          <div className="feature-copy">
            <span>训练主流程</span>
            <h3>AI 客户模拟</h3>
            <p>选择行业、模式与难度，让 AI 以客户视角连续追问，帮助你沉淀真实需求。</p>
          </div>
        </div>
      </section>

      <section className="metric-strip" data-testid="home-metrics">
        <div><strong>3</strong><span>训练模式</span></div>
        <div><strong>5</strong><span>行业场景</span></div>
        <div><strong>5</strong><span>能力维度</span></div>
        <div><strong>24</strong><span>完成训练</span></div>
        <div><strong>78.6</strong><span>平均得分</span></div>
        <div><strong>92</strong><span>最高得分</span></div>
      </section>
    </div>
  );
}

function TrainingPage({ onHistoryRecordCreated, resumeRecord }: { onHistoryRecordCreated: (record: TrainingHistoryRecord) => void; resumeRecord: TrainingHistoryRecord | null }) {
  const [industry, setIndustry] = useState(resumeRecord?.scenario ?? "AI+");
  const [mode, setMode] = useState(resumeRecord?.mode ?? "客户咨询");
  const [level, setLevel] = useState("标准");
  const [role, setRole] = useState("企业培训负责人");
  const [scene, setScene] = useState("企业员工培训");
  const [dirty, setDirty] = useState(false);
  const [confirmedSettings, setConfirmedSettings] = useState<{
    industry: string;
    mode: string;
    level: string;
    role: string;
    scene: string;
  } | null>(resumeRecord ? { industry: resumeRecord.scenario, mode: resumeRecord.mode, level: "标准", role: "企业培训负责人", scene: "历史训练复盘" } : null);
  const [session, setSession] = useState<TrainingSession | null>(() => resumeRecord ? createResumedTrainingSession(resumeRecord) : null);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function markChanged() {
    if (confirmedSettings) {
      setDirty(true);
    }
  }

  function updateIndustry(value: string) { setIndustry(value); markChanged(); }
  function updateMode(value: string) { setMode(value); markChanged(); }
  function updateLevel(value: string) { setLevel(value); markChanged(); }
  function updateRole(value: string) { setRole(value); markChanged(); }
  function updateScene(value: string) { setScene(value); markChanged(); }

  function confirmSettings() {
    const nextSettings = { industry, mode, level, role, scene };
    const nextSession = createTrainingSession({ scenario: industry, mode, difficulty: level });
    setConfirmedSettings(nextSettings);
    setSession({
      ...nextSession,
      messages: nextSession.messages.map((message, index) => index === 0
        ? { ...message, content: `训练设置已确认：${industry} / ${mode} / ${level}。您的具体业务是什么？` }
        : message)
    });
    setDraftAnswer("");
    setEvaluation(null);
    setSubmitted(false);
    setDirty(false);
  }

  function sendAnswer() {
    if (!session || submitted) {
      return;
    }
    const trimmed = draftAnswer.trim();
    if (!trimmed) {
      return;
    }
    setSession(sendTrainingMessage(session, trimmed));
    setDraftAnswer("");
  }

  function submitSolution() {
    if (!session || submitted) {
      return;
    }
    const finalSession = draftAnswer.trim() ? addTrainingAnswer(session, draftAnswer) : session;
    const nextEvaluation = generateEvaluation(finalSession);
    setSession(finalSession);
    setEvaluation(nextEvaluation);
    setSubmitted(true);
    setDraftAnswer("");
    onHistoryRecordCreated(createTrainingHistoryRecord(finalSession, nextEvaluation));
  }

  const confirmed = confirmedSettings ?? { industry: "AI+", mode: "客户咨询", level: "标准", role: "企业培训负责人", scene: "企业员工培训" };
  const confirmText = confirmedSettings && dirty ? "确定修改" : "确定";
  const visibleMessages = session?.messages ?? [{ id: "initial-ai", role: "ai" as const, content: "请选择您的训练设置。" }];
  const totalScore = evaluation?.totalScore ?? 3.2;
  const scoreRows: ReadonlyArray<readonly [string, number]> = evaluation?.dimensions.slice(0, 3).map((dimension) => [dimension.name, dimension.score] as const) ?? [["需求理解", 3.5], ["问题澄清", 3.2], ["价值论证", 2.6]];

  return (
    <div className="workbench-grid">
      <aside className="panel training-settings" data-testid="training-settings">
        <h2>训练设置</h2>
        <label className="setting-row">
          <span>行业场景</span>
          <select className="scenario-select selected" data-testid="training-industry-select" onChange={(event) => updateIndustry(event.target.value)} value={industry}>
            <option>AI+</option><option>B2B</option><option>企业培训</option><option>中小餐饮</option><option>SaaS</option>
          </select>
        </label>

        <div className="field setting-row" data-testid="training-mode-field">
          <span>训练模式</span>
          <div className="chips">
            <button className={mode === "客户咨询" ? "active" : ""} data-testid="training-mode-customer" onClick={() => updateMode("客户咨询")} type="button">客户咨询</button>
            <button className={mode === "用户需求提出" ? "active" : ""} data-testid="training-mode-user-demand" onClick={() => updateMode("用户需求提出")} type="button">用户需求提出</button>
            <button className={mode === "方案评估" ? "active" : ""} data-testid="training-mode-evaluation" onClick={() => updateMode("方案评估")} type="button">方案评估</button>
          </div>
        </div>

        <div className="field setting-row" data-testid="training-level-field">
          <span>难度</span>
          <div className="chips">
            <button className={level === "基础" ? "active" : ""} data-testid="training-level-basic" onClick={() => updateLevel("基础")} type="button">基础</button>
            <button className={level === "标准" ? "active" : ""} data-testid="training-level-standard" onClick={() => updateLevel("标准")} type="button">标准</button>
            <button className={level === "严格" ? "active" : ""} data-testid="training-level-strict" onClick={() => updateLevel("严格")} type="button">严格</button>
          </div>
        </div>

        <div className="field setting-row">
          <span>训练角色</span>
          <select onChange={(event) => updateRole(event.target.value)} value={role}>
            <option>企业培训负责人</option><option>销售负责人</option><option>中小商家老板</option>
          </select>
        </div>

        <div className="settings-section-title">场景</div>
        <div className="scene-list" data-testid="training-scene-list">
          <button className={scene === "企业员工培训" ? "active" : ""} onClick={() => updateScene("企业员工培训")} type="button"><strong>企业员工培训</strong><span>培训完成率、转化率与业务落地</span></button>
          <button className={scene === "销售知识库" ? "active" : ""} onClick={() => updateScene("销售知识库")} type="button"><strong>销售知识库</strong><span>新人上手、话术复用与成交效率</span></button>
          <button className={scene === "门店库存管理" ? "active" : ""} onClick={() => updateScene("门店库存管理")} type="button"><strong>门店库存管理</strong><span>损耗、补货和经营数据闭环</span></button>
        </div>
        <button className="primary full training-confirm" data-testid="training-confirm" onClick={confirmSettings} type="button">{confirmText}</button>
      </aside>

      <section className="panel conversation" data-testid="training-chat">
        <div className="chat-head">
          <h2>AI 客户模拟</h2>
          <p>当前场景：{confirmed.industry} / {confirmed.mode} / {confirmed.level}</p>
        </div>
        <div className="chat-body">
          {visibleMessages.map((message) => (
            <div className={`message-row ${message.role === "user" ? "user-row" : ""}`} key={message.id}>
              {message.role === "ai" ? <span className="ai-avatar">AI</span> : null}
              <div className={`message ${message.role}`}><p>{message.content}</p></div>
            </div>
          ))}
          {evaluation ? <div className="evaluation-note">评估已生成，AI 已停止继续追问。</div> : null}
        </div>
        <div className="composer">
          <textarea onChange={(event) => setDraftAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendAnswer(); } }} placeholder="输入你的回答..." value={draftAnswer} />
          <div><button>总结已知</button><button onClick={submitSolution} type="button">提交方案</button><button className="primary" onClick={sendAnswer} type="button">发送</button></div>
        </div>
      </section>

      <aside className="panel judgement" data-testid="training-judgement">
        <h2>AI 判断</h2>
        <div className="fact"><strong>训练目标</strong><p>理解客户在企业培训场景下的核心需求，输出可验证方案。</p></div>
        <div className="fact"><strong>已知信息</strong><ul><li>业务方向：企业 AI 培训服务</li><li>关注点：培训转化与复盘</li><li>目标角色：培训负责人</li></ul></div>
        <div className="fact"><strong>待澄清问题</strong>{evaluation ? <ul>{evaluation.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <ul><li>具体使用者是谁？</li><li>失败成本如何衡量？</li><li>预算与采购路径是什么？</li></ul>}</div>
        <div className="score training-score"><span>{evaluation ? "评估已生成" : "当前评分"}</span><div><p>综合评分</p><strong>{totalScore} / 5</strong></div></div>
        <div className="score-bars">
          {scoreRows.map(([name, score]) => <div key={name}><span>{name}</span><i><b style={{ width: `${Math.min(100, score * 20)}%` }} /></i><em>{score}</em></div>)}
        </div>
        <button className="full" type="button">查看能力画像</button>
      </aside>
    </div>
  );
}
function ProductsPage({
  onCorrection,
  onGo,
  products,
  selectedProductId,
  setSelectedProductId
}: {
  onCorrection: (productId: string, correction: string) => void;
  onGo: (page: PageId) => void;
  products: SavedProduct[];
  selectedProductId: string;
  setSelectedProductId: (productId: string) => void;
}) {
  const [correctionDraft, setCorrectionDraft] = useState("");
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];

  function updateUnderstanding() {
    if (!selectedProduct) return;
    onCorrection(selectedProduct.id, correctionDraft);
    setCorrectionDraft("");
  }

  if (!selectedProduct) {
    return (
      <div className="product-layout">
        <aside className="panel product-archive" data-testid="product-archive"><h2>产品档案</h2><button className="primary full" onClick={() => onGo("addProduct")} type="button">添加产品</button></aside>
        <section className="panel product-reading" data-testid="product-reading"><h2>暂无产品</h2><p>请先添加一个产品档案。</p></section>
        <aside className="panel product-maturity" data-testid="product-maturity"><h2>成熟度评估</h2></aside>
      </div>
    );
  }

  return (
    <div className="product-layout">
      <aside className="panel product-archive" data-testid="product-archive">
        <h2>产品档案</h2>
        {products.map((product) => <button className={product.id === selectedProduct.id ? "active" : ""} key={product.id} onClick={() => setSelectedProductId(product.id)} type="button"><span /><strong>{product.productName}</strong><small>{product.productStage} · AI 解读</small></button>)}
        <button className="primary full" onClick={() => onGo("addProduct")} type="button">添加产品</button>
        <button className="danger full" type="button">删除产品</button>
      </aside>
      <section className="panel product-reading" data-testid="product-reading">
        <h2>{selectedProduct.productName}</h2>
        <p className="meta">阶段：{selectedProduct.productStage} | 目标用户：{selectedProduct.targetUsers} | 链接：{selectedProduct.productUrl || "未填写"}</p>
        <div className="section"><h3>AI 产品解读</h3><p>{selectedProduct.analysis.summary}</p>{selectedProduct.correction ? <p className="ai-correction">用户修正：{selectedProduct.correction}</p> : null}<div className="inline-chat"><input onChange={(event) => setCorrectionDraft(event.target.value)} placeholder="告诉 AI 哪里理解错了..." value={correctionDraft} /><button onClick={updateUnderstanding} type="button">更新理解</button></div></div>
        <div className="section"><h3>AI 追问</h3><ol>{selectedProduct.analysis.questions.slice(0, 3).map((question) => <li key={question}>{question}</li>)}</ol></div>
      </section>
      <aside className="panel product-maturity" data-testid="product-maturity">
        <h2>成熟度评估</h2><div className="score"><span>综合成熟度</span><strong>3.6 / 5</strong></div>
        {["目标用户", "痛点强度", "功能聚焦", "数据验证", "增长阻碍"].map((item, index) => <div className="bar-row" key={item}><span>{item}</span><i><b style={{ width: `${74 - index * 6}%` }} /></i><em>{74 - index * 6}</em></div>)}
        <div className="section"><h3>下一步优化</h3>{selectedProduct.analysis.suggestions.map((suggestion) => <p key={suggestion.stage}><strong>{suggestion.stage}</strong>：{suggestion.content}</p>)}</div>
      </aside>
    </div>
  );
}
function AddProductPage({ onGo, onSave }: { onGo: (page: PageId) => void; onSave: (profile: ProductProfile) => void }) {
  const [profile, setProfile] = useState<ProductProfile>({
    productName: "企业 AI 培训助手",
    productDescription: "面向企业培训场景，帮助员工把学习内容转化为业务动作。",
    targetUsers: "企业培训负责人、业务部门管理者",
    coreFeatures: "AI 追问、培训复盘、知识转化、效果追踪",
    productStage: "MVP 验证中",
    productUrl: ""
  });

  function updateProfile(field: keyof ProductProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function save() {
    onSave(profile);
  }

  return (
    <div className="add-layout">
      <section className="panel"><h2>产品资料</h2><div className="upload-grid"><div><strong>上传产品文档</strong><span>已读取 2 个文件，可继续补充 PRD、介绍文案或调研记录。</span></div><div><strong>上传源代码</strong><span>等待上传，AI 可辅助理解功能结构与当前实现范围。</span></div></div><div className="form-grid"><label>产品名称<input onChange={(event) => updateProfile("productName", event.target.value)} value={profile.productName} /></label><label>产品链接<input onChange={(event) => updateProfile("productUrl", event.target.value)} placeholder="https://..." value={profile.productUrl} /></label><label>目标用户<input onChange={(event) => updateProfile("targetUsers", event.target.value)} value={profile.targetUsers} /></label><label>当前阶段<select onChange={(event) => updateProfile("productStage", event.target.value)} value={profile.productStage}><option>MVP 验证中</option><option>资料收集中</option><option>需求验证</option><option>方案设计</option></select></label><label className="wide">核心功能<input onChange={(event) => updateProfile("coreFeatures", event.target.value)} value={profile.coreFeatures} /></label><label className="wide">产品介绍<textarea onChange={(event) => updateProfile("productDescription", event.target.value)} value={profile.productDescription} /></label></div></section>
      <aside className="panel"><h2>AI 追问与澄清</h2><div className="ai-card">我会先根据你填写的产品资料生成产品理解摘要，再追问真实用户、场景、价值和验证指标。</div><ol><li>最先服务的细分用户是谁？</li><li>用户现在为什么必须解决这个问题？</li><li>产品成功的衡量指标是什么？</li></ol><textarea placeholder="回答 AI 问题或修正理解..." /><button className="primary full" onClick={save} type="button">保存产品</button><button className="full" onClick={() => onGo("products")} type="button">取消</button></aside>
    </div>
  );
}
function HistoryPage({ onGo, onResumeTraining, records }: { onGo: (page: PageId) => void; onResumeTraining: (record: TrainingHistoryRecord) => void; records: TrainingHistoryRecord[] }) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "sample-0");
  const [reportRecordId, setReportRecordId] = useState<string | null>(null);
  const selectedRecord = records.find((record) => record.id === selectedId) ?? records[0];
  const selectedIssues = selectedRecord?.evaluation.issues ?? ["需求定义较清楚", "价值论证不足", "缺少可验证指标"];
  const selectedMessages = selectedRecord?.messages.filter((message) => message.role === "user") ?? [];
  const selectedTitle = selectedRecord?.title ?? "企业培训服务需求澄清";
  const selectedScenario = selectedRecord?.scenario ?? "AI+ 企业培训";
  const selectedMode = selectedRecord?.mode ?? "客户咨询";
  const selectedScore = selectedRecord?.totalScore ?? 3.2;
  const reviewedCount = records.length + trainingRows.filter((row) => row[3] === "已评估").length;
  const pendingCount = trainingRows.filter((row) => row[3] === "待复盘").length;

  function selectRecord(recordId: string) {
    setSelectedId(recordId);
    setReportRecordId(null);
  }

  function handleResumeTraining() {
    const recordToResume = records.find((record) => record.id === selectedId) ?? records[0];
    if (recordToResume) {
      onResumeTraining(recordToResume);
      return;
    }
    onGo("training");
  }

  return (
    <div className="history-layout">
      <section className="panel history-record-panel">
        <div className="history-record-top"><h2>训练记录</h2><div className="history-inline-summary" data-testid="history-inline-summary"><div><strong>24</strong><span>完成训练</span></div><div><strong>6</strong><span>待复盘</span></div><div><strong>+6.4</strong><span>平均提升</span></div></div></div>
        <div className="timeline-tools"><span className="active">全部</span><span>本周</span><span>已评估</span><span>待复盘</span><span>高价值记录</span></div>
        <div className="record-list" data-testid="history-record-list"><div className="table-head"><span>时间</span><span>行业 / 模式</span><span>评分</span><span>主题</span><span>状态</span></div>{records.map((record) => <button className={record.id === selectedId ? "active" : ""} key={record.id} onClick={() => selectRecord(record.id)} type="button"><span>刚刚</span><strong>{record.title}</strong><span>{record.totalScore} 分</span><span>{record.scenario} 训练评估</span><em>已评估</em></button>)}{trainingRows.map((row, index) => <button className={!selectedRecord && selectedId === `sample-${index}` ? "active" : ""} key={row[0]} onClick={() => selectRecord(`sample-${index}`)} type="button"><span>06-{16 - index} 14:32</span><strong>{row[1]}</strong><span>{row[2]}</span><span>{row[0]}</span><em>{row[3]}</em></button>)}</div>
      </section>
      <aside className="panel" data-testid="history-review-panel"><h2>记录复盘</h2><div className="fact"><strong>{selectedTitle}</strong><p>场景：{selectedScenario} | 模式：{selectedMode} | 提交方案：已提交</p></div><div className="score"><span>本次表现</span><strong>{selectedScore} / 5</strong></div><div className="fact"><strong>关键对话</strong>{selectedMessages.length ? selectedMessages.map((message) => <p key={message.id}>{message.content}</p>) : <p>AI 追问了真实使用者、业务损失和验证指标。</p>}</div><div className="fact"><strong>AI 点评</strong><ul>{selectedIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>{reportRecordId === selectedId ? <div className="notice">复盘报告已生成：建议围绕“{selectedIssues[0]}”重新训练，并补充可验证指标。</div> : null}<div className="review-actions"><button className="primary retrain-action" onClick={handleResumeTraining} type="button">重新训练此场景</button><button onClick={() => setReportRecordId(selectedId)} type="button">生成复盘报告</button></div></aside>
    </div>
  );
}

function AbilityPage({ records }: { records: TrainingHistoryRecord[] }) {
  const profile = buildAbilityProfile(records);
  const progressText = profile.progress > 0 ? `+${profile.progress}` : `${profile.progress}`;
  const trendScores = profile.trend.map((item) => item.score);
  const minTrendScore = trendScores.length ? Math.min(...trendScores) : 0;
  const maxTrendScore = trendScores.length ? Math.max(...trendScores) : 100;
  const middleTrendScore = Math.round((minTrendScore + maxTrendScore) / 2);
  const trendVariation = maxTrendScore - minTrendScore;
  const trendScoreRange = Math.max(1, trendVariation);
  const trendPoints = profile.trend.length > 1
    ? profile.trend
        .map((item, index) => {
          const x = Math.round((index / (profile.trend.length - 1)) * 600);
          const normalized = (item.score - minTrendScore) / trendScoreRange;
          const y = Math.round(170 - normalized * 120);
          return `${x},${y}`;
        })
        .join(" ")
    : "0,170 600,170";

  return (
    <div className="ability-layout" data-testid="ability-page">
      <section className="metric-strip">
        <div><strong>{profile.averageScore}</strong><span>平均分 · 真实记录</span></div>
        <div><strong>{profile.completedCount}</strong><span>完成训练 · 真实记录 {profile.completedCount}</span></div>
        <div><strong>{profile.bestScore}</strong><span>最高分</span></div>
        <div><strong>{progressText}</strong><span>综合进步 · 真实记录</span></div>
      </section>
      <div className="ability-main">
        <section className="panel" data-testid="ability-trend-panel">
          <div className="trend-panel-title"><h2>最近训练表现趋势</h2><span>变化幅度 {trendVariation} 分</span></div>
          <div className="trend-chart-shell">
            <div className="trend-y-axis"><strong>分数轴</strong><span>{maxTrendScore}</span><span>{middleTrendScore}</span><span>{minTrendScore}</span></div>
            <div className="chart"><svg viewBox="0 0 600 220" preserveAspectRatio="none"><line x1="0" y1="50" x2="600" y2="50" stroke="#e3e7e5" strokeWidth="1" /><line x1="0" y1="110" x2="600" y2="110" stroke="#e3e7e5" strokeWidth="1" /><line x1="0" y1="170" x2="600" y2="170" stroke="#e3e7e5" strokeWidth="1" /><polyline data-testid="ability-trend-line" points={trendPoints} fill="none" stroke="#101312" strokeWidth="4" /><polyline points="0,120 110,100 220,108 330,86 440,70 600,60" fill="none" stroke="#a5ada8" strokeWidth="3" strokeDasharray="6 8" /></svg></div>
          </div>
          <div className="trend-x-axis"><strong>训练轮次</strong>{profile.trend.length ? profile.trend.map((item) => <span key={item.label}>{item.label}</span>) : <span>暂无记录</span>}</div>
        </section>
        <section className="panel"><h2>能力维度表现</h2>{profile.dimensions.map((item) => <div className="dimension-row" key={item.name}><strong>{item.name}</strong><span>基于真实训练记录计算</span><i><b style={{ width: `${item.score}%` }} /></i><em>{item.score}</em></div>)}</section>
      </div>
      <div className="ability-bottom">
        <section className="panel"><h2>高频短板</h2><div className="short-list">{profile.shortcomings.map((item, index) => <div key={item}><span>{item}</span><b>{records.length ? `${index + 1}` : "0"} 次</b></div>)}</div></section>
        <section className="panel recommend"><h2>下一步推荐训练</h2><ol><li>{profile.nextTraining}</li></ol><button className="primary">开始推荐训练</button></section>
      </div>
    </div>
  );
}









