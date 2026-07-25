import { getScenario, SKILLS, type SkillId } from "./training-config";
import type { TrainingEngine, TrainingMessage, TrainingSession } from "./training-session";

export type EvidenceLevel = "未体现" | "在提示下体现" | "独立体现" | "稳定且深入";

export type EvidenceDimension = {
  id: SkillId;
  name: string;
  score: number;
  level: EvidenceLevel;
  evidence: string;
  evidenceMessageIds: string[];
  evidenceQuotes: string[];
  confidence: number;
  why: string;
  nextAction: string;
};

export type EvaluationIssue = {
  id: string;
  title: string;
  description: string;
  evidence: string;
  nextAction: string;
  retryPrompt: string;
  targetSkill: SkillId;
};

export type Evaluation = {
  id: string;
  totalScore: number;
  summary: string;
  dimensions: EvidenceDimension[];
  issues: EvaluationIssue[];
  strengths: string[];
  confidence: "高" | "中" | "低";
  engine: TrainingEngine;
  modelVersion: string;
  rubricVersion: string;
  scenarioVersion: number;
};

const KEYWORDS: Record<SkillId, string[]> = {
  role: ["谁", "用户", "使用者", "负责人", "决策", "采购", "付费", "承担"],
  workflow: ["现在", "目前", "流程", "怎么", "如何", "步骤", "之前"],
  impact: ["影响", "损失", "频率", "多久", "多少", "严重", "后果", "成本", "为什么"],
  alternative: ["替代", "现在用", "目前用", "Excel", "表格", "手工", "其他方法"],
  metric: ["指标", "成功", "效果", "提升", "下降", "目标", "验证", "证明"]
};

function findEvidence(session: TrainingSession, skillId: SkillId): TrainingMessage | undefined {
  return session.messages
    .filter((message) => message.role === "user")
    .find((message) => KEYWORDS[skillId].some((keyword) => message.content.includes(keyword)));
}

function judgmentMentions(session: TrainingSession, skillId: SkillId): boolean {
  const judgment = session.judgment;
  if (!judgment) return false;
  const fields: Record<SkillId, string> = {
    role: judgment.targetUser,
    workflow: judgment.currentWorkflow,
    impact: `${judgment.coreProblem}${judgment.problemImpact}`,
    alternative: judgment.alternative,
    metric: judgment.successMetric
  };
  return fields[skillId].trim().length >= 8;
}

export function generateEvaluation(session: TrainingSession): Evaluation {
  const scenario = getScenario(session.scenarioId);
  const userTurnCount = session.messages.filter((message) => message.role === "user").length;
  const dimensions: EvidenceDimension[] = SKILLS.map((skill) => {
    const message = findEvidence(session, skill.id);
    const reflected = judgmentMentions(session, skill.id);
    let score = 0;
    let level: EvidenceLevel = "未体现";
    if (message) {
      score = session.mode === "练习" && session.hintsUsed > 0 ? 2 : 3;
      level = session.mode === "练习" && session.hintsUsed > 0 ? "在提示下体现" : "独立体现";
      if (reflected && message.content.length >= 18) { score = 4; level = "稳定且深入"; }
    } else if (reflected) { score = 1; level = "在提示下体现"; }
    return {
      id: skill.id,
      name: skill.name,
      score,
      level,
      evidence: message ? `“${message.content}”` : "本次对话中没有找到直接证据。",
      evidenceMessageIds: message ? [message.id] : [],
      evidenceQuotes: message ? [message.content] : [],
      confidence: message ? 0.9 : reflected ? 0.45 : 0.2,
      why: skill.description,
      nextAction: skill.practiceTip
    };
  });
  const missing = dimensions.filter((dimension) => dimension.score < 2);
  const issues: EvaluationIssue[] = missing.slice(0, 2).map((dimension) => ({
    id: `missing-${dimension.id}`,
    title: `没有充分确认${dimension.name}`,
    description: dimension.why,
    evidence: dimension.evidence,
    nextAction: dimension.nextAction,
    retryPrompt: `回到“${scenario.opening}”这个时刻，只提出一个问题来确认${dimension.name}。`,
    targetSkill: dimension.id
  }));
  if (session.judgment?.recommendation.trim() && (!session.coveredSkills.includes("workflow") || !session.coveredSkills.includes("impact"))) {
    issues.unshift({
      id: "premature-solution",
      title: "过早进入解决方案",
      description: "你已经提出方案，但当前流程或问题影响仍缺少证据，方案可能只回应了表面需求。",
      evidence: `你的建议是：“${session.judgment.recommendation}”`,
      nextAction: "提出方案前，至少确认当前流程和问题造成的具体影响。",
      retryPrompt: `重新面对“${scenario.opening}”，先不要给方案，只问一个能还原当前流程的问题。`,
      targetSkill: "workflow"
    });
  }
  const strengths = dimensions.filter((dimension) => dimension.score >= 3).slice(0, 2).map((dimension) => `你在${dimension.name}上给出了可追溯的提问证据。`);
  const totalScore = Math.round((dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / (dimensions.length * 4)) * 100);
  const confidence = userTurnCount >= 4 ? "高" : userTurnCount >= 2 ? "中" : "低";
  return {
    id: `evaluation-${session.id}`,
    totalScore,
    summary: issues.length ? `你已经完成产品判断，但仍有 ${issues.length} 个关键行为需要复练。` : "你覆盖了主要产品发现行为，可以进入更高难度场景。",
    dimensions,
    issues: issues.slice(0, 3),
    strengths: strengths.length ? strengths : ["你完成了从对话到产品判断的完整训练闭环。"],
    confidence,
    engine: "deterministic",
    modelVersion: session.modelVersion,
    rubricVersion: session.rubricVersion,
    scenarioVersion: session.scenarioVersion
  };
}

export function evaluateRetry(content: string, targetSkill: SkillId): { improved: boolean; feedback: string } {
  const trimmed = content.trim();
  const matched = KEYWORDS[targetSkill].some((keyword) => trimmed.includes(keyword));
  const improved = matched && trimmed.length >= 8;
  return {
    improved,
    feedback: improved ? "这次问题更聚焦，也直接对应了需要补足的信息。改善已记录到能力证据。" : "这次仍然比较宽泛。试着只问一个角色、流程、影响、替代方案或指标相关的具体问题。"
  };
}
