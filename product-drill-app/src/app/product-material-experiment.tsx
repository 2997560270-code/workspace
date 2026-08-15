"use client";

import { useState } from "react";
import { generateProductMaterial, type ProductMaterialDraft, type ProductMaterialInput } from "../lib/product-material";

const EMPTY_INPUT: ProductMaterialInput = {
  productName: "",
  targetUser: "",
  problem: "",
  currentWorkflow: "",
  evidence: "",
  stage: ""
};

export function ProductMaterialExperiment({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState<ProductMaterialInput>(EMPTY_INPUT);
  const [draft, setDraft] = useState<ProductMaterialDraft | null>(null);
  const canGenerate = input.productName.trim() && input.targetUser.trim() && input.problem.trim();

  function update(key: keyof ProductMaterialInput, value: string) {
    setInput((current) => ({ ...current, [key]: value }));
    setDraft(null);
  }

  return (
    <div className="stack-lg product-material-experiment">
      <section className="surface experiment-header">
        <button className="back-button" onClick={onClose} type="button">← 返回训练地图</button>
        <span className="section-kicker">实验场景 · 产品资料生成</span>
        <h2>把产品判断整理成一页可讨论的资料</h2>
        <p>这是实验性草稿工具，不计入能力评分，也不把输入当作真实市场证据。</p>
      </section>

      <section className="surface experiment-form">
        <div className="section-heading">
          <div>
            <span className="section-kicker">输入判断素材</span>
            <h2>先写清楚，再生成资料</h2>
          </div>
          <span className="quiet">必填 3 项</span>
        </div>
        <div className="experiment-grid">
          <label><span>产品名称</span><input value={input.productName} onChange={(event) => update("productName", event.target.value)} placeholder="例如：门店库存助手" /></label>
          <label><span>目标用户</span><input value={input.targetUser} onChange={(event) => update("targetUser", event.target.value)} placeholder="谁每天使用？" /></label>
          <label className="wide"><span>核心问题</span><textarea rows={2} value={input.problem} onChange={(event) => update("problem", event.target.value)} placeholder="用户遇到的具体问题是什么？" /></label>
          <label className="wide"><span>当前流程</span><textarea rows={2} value={input.currentWorkflow} onChange={(event) => update("currentWorkflow", event.target.value)} placeholder="问题现在如何发生或被处理？" /></label>
          <label><span>产品阶段</span><input value={input.stage} onChange={(event) => update("stage", event.target.value)} placeholder="例如：早期验证" /></label>
          <label><span>已有证据</span><input value={input.evidence} onChange={(event) => update("evidence", event.target.value)} placeholder="访谈、数据或观察" /></label>
        </div>
        <button className="button button-primary" disabled={!canGenerate} onClick={() => setDraft(generateProductMaterial(input))} type="button">生成实验草稿</button>
      </section>

      {draft ? (
        <section className="surface material-draft" data-testid="product-material-draft" role="status">
          <div className="section-heading">
            <div>
              <span className="section-kicker">实验输出 · 非正式资料</span>
              <h2>{draft.title}</h2>
            </div>
            <span className="status-tag">待真实验证</span>
          </div>
          <div className="material-block"><span>一句话说明</span><p>{draft.oneLiner}</p></div>
          <div className="material-block"><span>目标与问题</span><p>{draft.audience}。{draft.problem}</p></div>
          <div className="material-block"><span>证据边界</span><p>{draft.evidenceBoundary}</p></div>
          <div className="material-block"><span>建议验证</span><p>{draft.validationPlan}</p></div>
          <div className="material-block"><span>仍需回答</span><ul>{draft.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul></div>
        </section>
      ) : null}
    </div>
  );
}
