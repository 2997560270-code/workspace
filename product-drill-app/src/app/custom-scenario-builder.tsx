"use client";

import { useState } from "react";
import { SKILLS, type SkillId, type TrainingScenario } from "../lib/training-config";
import { createCustomScenario, saveCustomScenario } from "../lib/custom-scenarios";

const EMPTY_FACTS: Record<SkillId, string> = { role: "", workflow: "", impact: "", alternative: "", metric: "" };

export function CustomScenarioBuilder({
  onCancel,
  onCreated
}: {
  onCancel: () => void;
  onCreated: (scenario: TrainingScenario) => void;
}) {
  const [title, setTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [context, setContext] = useState("");
  const [opening, setOpening] = useState("");
  const [skillId, setSkillId] = useState<SkillId>("workflow");
  const [hiddenFacts, setHiddenFacts] = useState(EMPTY_FACTS);
  const [error, setError] = useState("");

  const required = [title, industry, role, context, opening, ...Object.values(hiddenFacts)];
  const canCreate = required.every((value) => value.trim().length >= 4);

  function updateFact(id: SkillId, value: string) {
    setHiddenFacts((current) => ({ ...current, [id]: value }));
  }

  function create() {
    if (!canCreate) {
      setError("请完整填写场景背景、开场白和五项隐藏事实。");
      return;
    }
    const scenario = createCustomScenario({ title, industry, role, context, opening, skillId, hiddenFacts });
    saveCustomScenario(scenario);
    onCreated(scenario);
  }

  return (
    <section className="surface custom-scenario-builder" data-testid="custom-scenario-builder">
      <div className="section-heading">
        <div>
          <span className="section-kicker">本地场景编辑器</span>
          <h2>创建一个真实工作中的训练场景</h2>
        </div>
        <button className="back-button" onClick={onCancel} type="button">← 返回训练地图</button>
      </div>
      <p className="custom-scenario-note">自定义场景只保存在这台设备上，使用确定性本地引擎，不计入正式能力趋势。</p>
      <div className="custom-scenario-grid">
        <label><span>场景标题</span><input aria-label="场景标题" onChange={(event) => setTitle(event.target.value)} placeholder="例如：客户要求增加一个导出按钮" value={title} /></label>
        <label><span>行业或业务类型</span><input aria-label="行业或业务类型" onChange={(event) => setIndustry(event.target.value)} placeholder="例如：物流 SaaS" value={industry} /></label>
        <label><span>对话角色</span><input aria-label="对话角色" onChange={(event) => setRole(event.target.value)} placeholder="例如：仓储运营负责人" value={role} /></label>
        <label><span>主要训练能力</span><select aria-label="主要训练能力" onChange={(event) => setSkillId(event.target.value as SkillId)} value={skillId}>{SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
        <label className="wide"><span>场景背景</span><textarea aria-label="场景背景" onChange={(event) => setContext(event.target.value)} placeholder="说明业务环境、当前阶段和为什么发生这次对话。" rows={3} value={context} /></label>
        <label className="wide"><span>开场白</span><textarea aria-label="开场白" onChange={(event) => setOpening(event.target.value)} placeholder="对话角色会怎样提出问题或要求？" rows={3} value={opening} /></label>
      </div>
      <div className="custom-facts">
        <div className="section-heading"><div><span className="section-kicker">隐藏事实</span><h3>用户只有在被问到时才会透露</h3></div></div>
        <div className="custom-scenario-grid">
          {SKILLS.map((skill) => <label key={skill.id}><span>{skill.name}</span><textarea aria-label={`隐藏事实：${skill.name}`} onChange={(event) => updateFact(skill.id, event.target.value)} placeholder={`关于${skill.name}的可验证事实`} rows={3} value={hiddenFacts[skill.id]} /></label>)}
        </div>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="judgment-actions"><p>建议写入具体角色、流程、影响和数字，便于训练后复盘。</p><button className="button button-primary" disabled={!canCreate} onClick={create} type="button">保存并开始训练</button></div>
    </section>
  );
}
