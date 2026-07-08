"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { generateEvaluation, type Evaluation } from "../lib/evaluation";
import {
  addTrainingAnswer,
  changeTrainingScenario,
  createTrainingSession,
  sendTrainingMessage,
  type TrainingSession
} from "../lib/training-session";
import { DEFAULT_SCENARIO, INDUSTRY_SCENARIOS, TRAINING_MODES } from "../lib/training-config";

type View = "workbench" | "product" | "history";

type ProductProfile = {
  id: string;
  name: string;
  stage: string;
  users: string;
  url: string;
  description: string;
  docs: string[];
  code: string[];
};

type HistoryRecord = {
  id: string;
  time: string;
  industryMode: string;
  score: string;
  title: string;
  status: string;
  summary: string;
  comments: string[];
};

const DIFFICULTIES = ["基础", "标准", "严格"];

const navItems: Array<{ id: View | "home" | "profile"; label: string; icon: string; testId?: string }> = [
  { id: "home", label: "首页", icon: "home" },
  { id: "workbench", label: "工作台", icon: "grid", testId: "v3live-nav-workbench" },
  { id: "product", label: "我的产品", icon: "box", testId: "v3live-nav-product" },
  { id: "history", label: "对话历史", icon: "chat", testId: "v3live-nav-history" },
  { id: "profile", label: "能力画像", icon: "bars" }
];

const sceneLibrary = [
  ["AI+ 服务落地", "验证用户场景、数据边界与价值表达"],
  ["B2B 采购咨询", "识别预算、决策链与落地阻力"],
  ["企业员工培训", "追问培训效果、业务转化与组织协同"]
];

const seedProduct: ProductProfile = {
  id: "training-ai",
  name: "AI 企业培训助手",
  stage: "MVP 验证",
  users: "企业培训负责人",
  url: "https://product.example",
  description: "帮助企业培训负责人提升完成率、知识转化和业务部门配合度。",
  docs: ["产品介绍.md"],
  code: ["frontend.zip"]
};

const initialProducts: ProductProfile[] = [
  seedProduct,
  {
    id: "store-inventory",
    name: "门店库存管理工具",
    stage: "需求验证",
    users: "中小餐饮门店店长",
    url: "https://inventory.example",
    description: "帮助门店减少库存损耗，追踪采购、消耗和临期风险。",
    docs: ["库存需求.md"],
    code: []
  },
  {
    id: "sales-agent",
    name: "销售知识库 Agent",
    stage: "方案设计",
    users: "销售负责人",
    url: "",
    description: "帮助销售团队快速回答客户问题并沉淀高频销售话术。",
    docs: [],
    code: []
  },
  {
    id: "learning-path",
    name: "员工学习路径系统",
    stage: "资料收集中",
    users: "企业培训团队",
    url: "",
    description: "根据岗位能力要求生成学习路径，并跟踪学习完成和业务转化。",
    docs: [],
    code: []
  }
];

const historyRecords: HistoryRecord[] = [
  {
    id: "training-need",
    time: "06-16 14:32",
    industryMode: "AI+ / 客户咨询",
    score: "3.2 / 5",
    title: "企业培训服务需求澄清",
    status: "已评估",
    summary: "AI 追问了真实使用者、业务损失和验证指标，用户已提交初步方案。",
    comments: ["需求定义较清楚", "价值论证不足", "缺少可验证指标"]
  },
  {
    id: "store",
    time: "06-15 10:18",
    industryMode: "B2B / 用户需求提出",
    score: "3.8 / 5",
    title: "门店库存损耗方案",
    status: "已评估",
    summary: "围绕门店库存损耗、补货频率和店长日常操作进行了多轮澄清。",
    comments: ["场景足够具体", "指标更接近真实业务", "仍需补充采购决策链"]
  },
  {
    id: "learning",
    time: "06-12 16:40",
    industryMode: "企业培训 / 方案评估",
    score: "2.9 / 5",
    title: "学习路径设计复盘",
    status: "待复盘",
    summary: "方案覆盖了学习路径，但对业务结果、使用频率和管理者价值解释不足。",
    comments: ["功能描述偏多", "业务价值偏弱", "缺少可落地验证方式"]
  },
  {
    id: "sales",
    time: "06-10 09:20",
    industryMode: "AI+ / 方案评估",
    score: "4.1 / 5",
    title: "销售知识库价值验证",
    status: "已评估",
    summary: "对销售新人上手、话术复用和成交效率的价值解释较完整。",
    comments: ["目标用户明确", "价值链条完整", "可继续补充竞品替代方案"]
  }
];

function Icon({ name }: { name: string }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5v8.5a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 4.5 7.2v9.2L12 21l7.5-4.6V7.2z" />
        <path d="m4.8 7.4 7.2 4.2 7.2-4.2M12 11.6v9" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h14v10H8l-3 4z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    );
  }
  if (name === "bars") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V9M12 19V5M19 19v-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" />
    </svg>
  );
}

function scenarioDescription(scenario: string) {
  return INDUSTRY_SCENARIOS.find((item) => item.name === scenario)?.description ?? "围绕该行业客户持续追问真实问题。";
}

export function AppShellV3Workbench() {
  const [view, setView] = useState<View>("workbench");
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [mode, setMode] = useState(TRAINING_MODES[0].name);
  const [difficulty, setDifficulty] = useState("标准");
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [reply, setReply] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [notice, setNotice] = useState("");
  const [products, setProducts] = useState<ProductProfile[]>(initialProducts);
  const [productScreen, setProductScreen] = useState<"list" | "detail" | "edit">("list");
  const [selectedProductId, setSelectedProductId] = useState(seedProduct.id);
  const [draft, setDraft] = useState<ProductProfile>(seedProduct);
  const [docNames, setDocNames] = useState(seedProduct.docs);
  const [codeNames, setCodeNames] = useState(seedProduct.code);
  const [selectedHistoryId, setSelectedHistoryId] = useState(historyRecords[0].id);
  const [productDeleteMode, setProductDeleteMode] = useState(false);

  const selectedProduct = products.find((item) => item.id === selectedProductId) ?? products[0];
  const selectedHistory = historyRecords.find((item) => item.id === selectedHistoryId) ?? historyRecords[0];

  const knownFacts = useMemo(() => {
    const userMessages = session?.messages.filter((message) => message.role === "user").map((message) => message.content) ?? [];
    return userMessages.length ? userMessages.slice(-3) : ["等待用户开始训练并说明具体业务"];
  }, [session]);

  const header = view === "product"
    ? { title: "我的产品", desc: "上传产品资料，让 AI 先理解产品，再追问真实用户、场景与价值。" }
    : view === "history"
      ? { title: "对话历史", desc: "回看每一次训练记录，复盘关键判断与方案表达。" }
    : { title: "训练工作台", desc: "Demo V3 交互重构测试入口：沿用已写过的训练功能代码，只重构当前模块界面。" };

  function openNav(nextView: View | "home" | "profile") {
    if (nextView === "product" || nextView === "workbench" || nextView === "history") {
      setView(nextView);
    }
  }

  function updateScenario(nextScenario: string) {
    setScenario(nextScenario);
    setEvaluation(null);
    setNotice(`当前行业场景已经切换到 ${nextScenario}，模式 ${mode}，难度 ${difficulty}。`);
    setSession((current) => current ? changeTrainingScenario(current, nextScenario, mode, difficulty) : current);
  }

  function startTraining() {
    setView("workbench");
    setSession(createTrainingSession({ scenario, mode, difficulty }));
    setEvaluation(null);
    setReply("");
    setNotice(`训练已开始：${scenario} / ${mode} / ${difficulty}`);
  }

  function sendReply(content = reply) {
    const trimmed = content.trim();
    if (!trimmed || !session || evaluation) {
      return;
    }
    setSession(sendTrainingMessage(session, trimmed));
    setReply("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendReply(event.currentTarget.value);
    }
  }

  function submitSolution() {
    if (!session) {
      return;
    }
    const finalSession = reply.trim() ? addTrainingAnswer(session, reply) : session;
    setSession(finalSession);
    setEvaluation(generateEvaluation(finalSession));
    setReply("");
  }

  function openProductDetail(productId: string) {
    const product = products.find((item) => item.id === productId) ?? products[0];
    setSelectedProductId(product.id);
    setDraft(product);
    setDocNames(product.docs);
    setCodeNames(product.code);
    setProductScreen("detail");
  }

  function openProductAdd() {
    setProductDeleteMode(false);
    const emptyProduct: ProductProfile = {
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
    setProductScreen("edit");
    setView("product");
  }

  function openProductEdit() {
    setProductDeleteMode(false);
    setDraft(selectedProduct);
    setDocNames(selectedProduct.docs);
    setCodeNames(selectedProduct.code);
    setProductScreen("edit");
  }

  function deleteSelectedProduct() {
    if (!productDeleteMode) {
      setProductDeleteMode(true);
      return;
    }
    if (products.length <= 1) {
      return;
    }

    const selectedIndex = products.findIndex((item) => item.id === selectedProductId);
    const remainingProducts = products.filter((item) => item.id !== selectedProductId);
    const fallbackProduct = remainingProducts[Math.max(0, selectedIndex - 1)] ?? remainingProducts[0];

    setProducts(remainingProducts);
    setSelectedProductId(fallbackProduct.id);
    setDraft(fallbackProduct);
    setDocNames(fallbackProduct.docs);
    setCodeNames(fallbackProduct.code);
    setProductDeleteMode(false);
    setProductScreen("list");
  }

  function saveProduct() {
    const savedProduct = {
      ...draft,
      name: draft.name.trim() || "未命名产品",
      docs: docNames,
      code: codeNames
    };
    setProducts((current) => {
      const exists = current.some((item) => item.id === savedProduct.id);
      return exists ? current.map((item) => item.id === savedProduct.id ? savedProduct : item) : [savedProduct, ...current];
    });
    setSelectedProductId(savedProduct.id);
    setDraft(savedProduct);
    setProductDeleteMode(false);
    setProductScreen("list");
  }

  return (
    <main className="v3live-shell">
      <aside className="v3live-sidebar" aria-label="Demo V3 导航">
        <div className="v3live-brand">
          <div className="v3live-mark">PD</div>
          <div>
            <strong>Product Drill</strong>
            <span>AI 产品思维训练平台</span>
          </div>
        </div>
        <nav className="v3live-nav">
          {navItems.map((item) => (
            <button
              className={item.id === view ? "active" : ""}
              data-testid={item.testId}
              key={item.label}
              onClick={() => openNav(item.id)}
              type="button"
            >
              <span className="v3live-ico"><Icon name={item.icon} /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="v3live-sidebar-footer">
          <button type="button"><span className="v3live-ico"><Icon name="chat" /></span><span>使用指南</span></button>
          <button type="button"><span className="v3live-ico"><Icon name="grid" /></span><span>设置</span></button>
        </div>
      </aside>

      <section className="v3live-main">
        <header className="v3live-topbar">
          <div>
            <h1>{header.title}</h1>
            <p>{header.desc}</p>
          </div>
          <span className="v3live-entry-note">本入口不影响总验收</span>
        </header>

        {view === "product" ? (
          <ProductModule
            codeNames={codeNames}
            deleteMode={productDeleteMode}
            docNames={docNames}
            draft={draft}
            onAdd={openProductAdd}
            onBack={() => setProductScreen("list")}
            onCodeNames={setCodeNames}
            onDelete={deleteSelectedProduct}
            onDetail={openProductDetail}
            onDocNames={setDocNames}
            onDraft={setDraft}
            onEdit={openProductEdit}
            onSave={saveProduct}
            products={products}
            screen={productScreen}
            selectedProduct={selectedProduct}
          />
        ) : view === "history" ? (
          <HistoryModule
            onSelect={setSelectedHistoryId}
            records={historyRecords}
            selectedRecord={selectedHistory}
          />
        ) : (
          <div className="v3live-workbench">
            <section className="v3live-panel v3live-settings">
              <h2>场景设置</h2>
              <label className="v3live-field">
                <span>行业场景</span>
                <select onChange={(event) => updateScenario(event.target.value)} value={scenario}>
                  {INDUSTRY_SCENARIOS.map((item) => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
              <div className="v3live-scene-list">
                {sceneLibrary.map(([title, desc]) => (
                  <button
                    className={title.includes(scenario) || scenario.includes(title.split(" ")[0]) ? "active" : ""}
                    key={title}
                    onClick={() => updateScenario(title.startsWith("B2B") ? "B2B" : title.startsWith("企业") ? "企业员工培训" : "AI+")}
                    type="button"
                  >
                    <strong>{title}</strong>
                    <span>{desc}</span>
                  </button>
                ))}
              </div>
              <div className="v3live-field">
                <span>训练模式</span>
                <div className="v3live-chips">
                  {TRAINING_MODES.map((item) => (
                    <button className={item.name === mode ? "active" : ""} key={item.name} onClick={() => setMode(item.name)} type="button">
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="v3live-field">
                <span>难度级别</span>
                <div className="v3live-chips">
                  {DIFFICULTIES.map((item) => (
                    <button className={item === difficulty ? "active" : ""} key={item} onClick={() => setDifficulty(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="v3live-settings-actions">
                <button className="v3live-primary" data-testid="v3live-start" onClick={startTraining} type="button">开始训练</button>
                <button data-testid="v3live-product-add-top" onClick={openProductAdd} type="button">添加产品</button>
              </div>
              <p className="v3live-muted">{scenarioDescription(scenario)}</p>
              {notice ? <div className="v3live-notice">{notice}</div> : null}
            </section>

            <section className="v3live-panel v3live-conversation">
              <div className="v3live-panel-head">
                <div>
                  <h2>AI 对话</h2>
                  <p>{session ? `当前：${scenario} / ${mode} / ${difficulty}` : "选择场景后点击开始训练，对话区才会输出内容。"}</p>
                </div>
                <button type="button">查看对话历史</button>
              </div>
              <div className="v3live-chat" aria-label="AI 对话记录">
                {(session?.messages ?? []).map((message) => (
                  <div className={`v3live-message ${message.role}`} key={message.id}>
                    {message.role === "ai" ? <span className="v3live-name">AI</span> : null}
                    <div className="v3live-text">{message.content}</div>
                  </div>
                ))}
              </div>
              <div className="v3live-composer">
                <textarea
                  disabled={!session || Boolean(evaluation)}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={evaluation ? "本轮已提交方案，AI 不再继续追问" : "输入你的回答，Enter 发送"}
                  value={reply}
                />
                <div className="v3live-composer-actions">
                  <button data-testid="v3live-submit" disabled={!session || Boolean(evaluation)} onClick={submitSolution} type="button">提交方案</button>
                  <button className="v3live-primary" data-testid="v3live-send" disabled={!session || !reply.trim() || Boolean(evaluation)} onClick={() => sendReply()} type="button">发送</button>
                </div>
              </div>
            </section>

            <aside className="v3live-panel v3live-review">
              <h2>训练目标</h2>
              <p>理解客户在当前行业场景下的核心需求与约束，输出有针对性的产品解决方案并验证价值。</p>
              <div className="v3live-fact">
                <strong>已知信息</strong>
                <ul>{knownFacts.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="v3live-fact">
                <strong>待澄清问题</strong>
                <ol>
                  <li>真实使用者是谁？</li>
                  <li>当前问题造成了什么业务损失？</li>
                  <li>方案成功后用什么指标衡量？</li>
                </ol>
              </div>
              {evaluation ? (
                <div className="v3live-fact">
                  <h3>综合评分</h3>
                  <div className="v3live-score">{evaluation.totalScore} / 5.0</div>
                  {evaluation.dimensions.slice(0, 4).map((item) => (
                    <div className="v3live-score-row" key={item.name}>
                      <span>{item.name}</span>
                      <i><b style={{ width: `${item.score * 20}%` }} /></i>
                      <strong>{item.score}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="v3live-fact">
                  <strong>评分预览</strong>
                  <div className="v3live-score">3.0 / 5.0</div>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function ProductModule({
  codeNames,
  deleteMode,
  docNames,
  draft,
  onAdd,
  onBack,
  onCodeNames,
  onDelete,
  onDetail,
  onDocNames,
  onDraft,
  onEdit,
  onSave,
  products,
  screen,
  selectedProduct
}: {
  codeNames: string[];
  deleteMode: boolean;
  docNames: string[];
  draft: ProductProfile;
  onAdd: () => void;
  onBack: () => void;
  onCodeNames: (names: string[]) => void;
  onDelete: () => void;
  onDetail: (id: string) => void;
  onDocNames: (names: string[]) => void;
  onDraft: (product: ProductProfile) => void;
  onEdit: () => void;
  onSave: () => void;
  products: ProductProfile[];
  screen: "list" | "detail" | "edit";
  selectedProduct: ProductProfile;
}) {
  if (screen === "edit") {
    return (
      <div className="v3live-product-edit">
        <section className="v3live-open-panel" data-testid="v3live-product-form">
          <div className="v3live-product-head">
            <div>
              <button onClick={onBack} type="button">返回产品文件</button>
              <h2>填写产品资料</h2>
              <p>支持上传产品文档和源代码，也可以手动补充资料，保存前由 AI 先复述理解并继续追问。</p>
            </div>
          </div>
          <div className="v3live-upload-grid">
            <label className="v3live-upload-lane">
              <strong>上传产品文档</strong>
              <span>{docNames.join("、") || "等待上传后 AI 预填写"}</span>
              <input
                data-testid="v3live-upload-doc"
                onChange={(event) => onDocNames(Array.from(event.target.files ?? []).map((file) => file.name))}
                type="file"
              />
            </label>
            <label className="v3live-upload-lane">
              <strong>上传源代码</strong>
              <span>{codeNames.join("、") || "等待上传后 AI 解读"}</span>
              <input
                data-testid="v3live-upload-code"
                onChange={(event) => onCodeNames(Array.from(event.target.files ?? []).map((file) => file.name))}
                type="file"
              />
            </label>
          </div>
          <div className="v3live-form-grid">
            <label className="v3live-field">
              <span>产品名称</span>
              <input data-testid="v3live-product-name" onChange={(event) => onDraft({ ...draft, name: event.target.value })} value={draft.name} />
            </label>
            <label className="v3live-field">
              <span>产品链接</span>
              <input onChange={(event) => onDraft({ ...draft, url: event.target.value })} placeholder="https://..." value={draft.url} />
            </label>
            <label className="v3live-field">
              <span>目标用户</span>
              <input data-testid="v3live-product-users" onChange={(event) => onDraft({ ...draft, users: event.target.value })} value={draft.users} />
            </label>
            <label className="v3live-field">
              <span>当前阶段</span>
              <select onChange={(event) => onDraft({ ...draft, stage: event.target.value })} value={draft.stage}>
                <option>资料收集中</option>
                <option>MVP 验证</option>
                <option>正式运营</option>
              </select>
            </label>
            <label className="v3live-field wide">
              <span>产品介绍</span>
              <textarea data-testid="v3live-product-description" onChange={(event) => onDraft({ ...draft, description: event.target.value })} value={draft.description} />
            </label>
          </div>
        </section>

        <aside className="v3live-panel v3live-product-ai">
          <h2>AI 追问与澄清</h2>
          <div className="v3live-ai-card">
            <strong>AI 对产品的初步理解</strong>
            <p>我理解这是面向{draft.users || "目标用户"}的产品，当前重点是确认它解决的真实问题、使用场景和可衡量价值。</p>
          </div>
          <div className="v3live-fact">
            <strong>待确认问题</strong>
            <ol>
              <li>最先服务的细分用户是谁？</li>
              <li>用户为什么现在必须解决这个问题？</li>
              <li>产品成功的衡量指标是什么？</li>
            </ol>
          </div>
          <textarea placeholder="回答 AI 问题或修正理解..." />
          <button className="v3live-primary" data-testid="v3live-product-save" onClick={onSave} type="button">保存产品</button>
        </aside>
      </div>
    );
  }

  return (
    <div className="v3live-product-workspace" data-testid="v3live-product-detail">
      <aside className="v3live-panel v3live-product-archive" data-testid="v3live-product-list">
        <h2>产品档案</h2>
        <div className="v3live-product-list compact">
          {products.map((product) => (
            <button
              className={product.id === selectedProduct.id ? "active" : ""}
              data-testid={`v3live-product-row-${product.id}`}
              key={product.id}
              onClick={() => onDetail(product.id)}
              type="button"
            >
              <span className="v3live-file-dot" />
              <span>
                <strong>{product.name}</strong>
                <small>{product.stage} · {product.docs.length + product.code.length ? `${product.docs.length + product.code.length} 个资料文件` : "今日分析"}</small>
              </span>
              <b>&gt;</b>
            </button>
          ))}
        </div>
        <button className="v3live-primary v3live-archive-add" data-testid="v3live-product-add" onClick={onAdd} type="button">添加产品</button>
        <button
          className={`v3live-archive-delete${deleteMode ? " active" : ""}`}
          data-delete-mode={deleteMode ? "true" : "false"}
          data-testid="v3live-product-delete"
          disabled={products.length <= 1}
          onClick={onDelete}
          type="button"
        >
          {deleteMode ? "删除" : "删除产品"}
        </button>
        {deleteMode ? <p className="v3live-delete-hint">选择左侧产品后，再点击删除完成操作。</p> : null}
      </aside>

      <section className="v3live-panel v3live-product-center" data-testid="v3live-product-center">
        <div className="v3live-product-titlebar">
          <div>
            <h2>{selectedProduct.name}</h2>
            <p>阶段：{selectedProduct.stage} | 目标用户：{selectedProduct.users || "待补充"} | 最近更新：06-16</p>
          </div>
          <button onClick={onEdit} type="button">修改资料</button>
        </div>
        <section className="v3live-product-reading">
          <h3>AI 产品解读</h3>
          <p>AI 理解这是一个面向{selectedProduct.users || "目标用户"}的产品。当前价值集中在{selectedProduct.description || "帮助用户完成关键业务任务"}。</p>
          <div className="v3live-inline-update">
            <input placeholder="告诉 AI 哪里理解错了..." />
            <button type="button">更新理解</button>
          </div>
        </section>
        <section className="v3live-product-reading">
          <h3>AI 追问</h3>
          <ol className="v3live-question-list">
            <li><b>1</b><span>最先服务的细分用户是谁？</span></li>
            <li><b>2</b><span>用户为什么现在必须解决这个问题？</span></li>
            <li><b>3</b><span>产品成功的衡量指标是什么？</span></li>
          </ol>
        </section>
      </section>

      <aside className="v3live-panel v3live-product-maturity" data-testid="v3live-product-maturity">
        <h2>成熟度评估</h2>
        <div className="v3live-maturity-score"><span>综合成熟度</span><strong>3.6 / 5</strong></div>
        {[
          ["目标用户", 74],
          ["痛点强度", 69],
          ["功能聚焦", 72],
          ["数据验证", 48],
          ["增长阻碍", 55]
        ].map(([label, score]) => (
          <div className="v3live-score-row" key={label}>
            <span>{label}</span>
            <i><b style={{ width: `${score}%` }} /></i>
            <strong>{score}</strong>
          </div>
        ))}
        <div className="v3live-fact">
          <strong>下一步优化</strong>
          <div className="v3live-optimization-list">
            <div><span>补充真实使用场景</span><b>短期</b></div>
            <div><span>验证培训效果指标</span><b>中期</b></div>
            <div><span>明确采购触发因素</span><b>长期</b></div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function HistoryModule({
  onSelect,
  records,
  selectedRecord
}: {
  onSelect: (id: string) => void;
  records: HistoryRecord[];
  selectedRecord: HistoryRecord;
}) {
  return (
    <div className="v3live-history-layout">
      <section className="v3live-panel v3live-history-table" data-testid="v3live-history-list">
        <div className="v3live-history-head">
          <h2>训练记录</h2>
          <div className="v3live-history-filters">
            <span className="active">全部</span>
            <span>本周</span>
            <span>已评估</span>
            <span>待复盘</span>
            <span>高价值记录</span>
          </div>
        </div>
        <div className="v3live-history-list">
          <div className="v3live-history-row header">
            <span>时间</span>
            <span>行业 / 模式</span>
            <span>评分</span>
            <span>主题</span>
            <span>状态</span>
          </div>
          {records.map((record) => (
            <button
              className={record.id === selectedRecord.id ? "active" : ""}
              data-testid={`v3live-history-record-${record.id}`}
              key={record.id}
              onClick={() => onSelect(record.id)}
              type="button"
            >
              <span>{record.time}</span>
              <strong>{record.industryMode}</strong>
              <span>{record.score}</span>
              <span>{record.title}</span>
              <em>{record.status}</em>
            </button>
          ))}
        </div>
      </section>

      <aside className="v3live-panel v3live-history-review" data-testid="v3live-history-review">
        <h2>记录复盘</h2>
        <div className="v3live-fact">
          <strong>{selectedRecord.title}</strong>
          <p>{selectedRecord.industryMode} | 提交方案：已提交</p>
        </div>
        <div className="v3live-fact">
          <strong>综合评分</strong>
          <div className="v3live-score" data-testid="v3live-history-score">{selectedRecord.score}</div>
        </div>
        <div className="v3live-fact">
          <strong>关键对话</strong>
          <p>{selectedRecord.summary}</p>
        </div>
        <div className="v3live-fact">
          <strong>AI 点评</strong>
          <ul>{selectedRecord.comments.map((comment) => <li key={comment}>{comment}</li>)}</ul>
        </div>
        <div className="v3live-history-actions">
          <button className="v3live-primary" type="button">重新训练此场景</button>
          <button type="button">生成复盘报告</button>
        </div>
      </aside>

      <div className="v3live-history-summary">
        <div><strong>24</strong><span>完成训练</span></div>
        <div><strong>6</strong><span>待复盘</span></div>
        <div><strong>+6.4</strong><span>平均提升</span></div>
      </div>
    </div>
  );
}
