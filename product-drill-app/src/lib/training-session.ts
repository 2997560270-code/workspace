import { getScenario, type SkillId } from "./training-config";

import type { TrainingScenario } from "./training-config";

export const DETERMINISTIC_ENGINE_VERSION = "deterministic-v1";
export const DEFAULT_RUBRIC_VERSION = "direction-a-v1";
// 命名与需求文档 4.1 对齐：训练模式、严格模式和练习模式（旧名「独立」已废弃）。
export const TRAINING_MODE_OPTIONS = ["训练", "严格", "练习"] as const;

export type TrainingRole = "ai" | "user";
export type TrainingStage = "interview" | "judgment" | "feedback" | "retry" | "complete";
export type TrainingEngine = "openai" | "deterministic";

export type TrainingMessage = {
  id: string;
  role: TrainingRole;
  content: string;
  turnIndex: number;
  revealedSkill?: SkillId;
};

export type ProductJudgment = {
  targetUser: string;
  currentWorkflow: string;
  coreProblem: string;
  problemImpact: string;
  alternative: string;
  recommendation: string;
  successMetric: string;
  biggestAssumption: string;
};

export type TrainingSession = {
  id: string;
  scenarioId: string;
  /** Custom scenarios travel with the session for deterministic local training. */
  scenarioSnapshot?: TrainingScenario;
  scenarioVersion: number;
  rubricVersion: string;
  modelVersion: string;
  engine: TrainingEngine;
  mode: (typeof TRAINING_MODE_OPTIONS)[number];
  stage: TrainingStage;
  messages: TrainingMessage[];
  coveredSkills: SkillId[];
  hintsUsed: number;
  judgment?: ProductJudgment;
};

const KEYWORDS: Record<SkillId, string[]> = {
  role: ["谁", "用户", "使用者", "负责人", "决策", "采购", "付费", "承担"],
  workflow: ["现在", "目前", "流程", "怎么", "如何", "步骤", "之前"],
  impact: ["影响", "损失", "频率", "多久", "多少", "严重", "后果", "成本", "为什么"],
  alternative: ["替代", "现在用", "目前用", "Excel", "表格", "手工", "绕过", "其他方法"],
  metric: ["指标", "成功", "效果", "提升", "下降", "目标", "验证", "证明"]
};

const SKILL_ORDER: SkillId[] = ["role", "workflow", "impact", "alternative", "metric"];
function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function makeMessage(role: TrainingRole, content: string, turnIndex: number, revealedSkill?: SkillId): TrainingMessage {
  return { id: id("msg"), role, content, turnIndex, revealedSkill };
}

export function detectSkills(content: string): SkillId[] {
  return SKILL_ORDER.filter((skill) => KEYWORDS[skill].some((keyword) => content.includes(keyword)));
}

function coachResponse(coveredSkills: SkillId[], mode: TrainingSession["mode"]): string {
  if (mode === "严格") return "时间有限。请优先确认仍未覆盖的关键信息，再整理你的判断。";
  if (mode !== "练习") return "我已经回答了你的问题。你可以继续追问，也可以在信息足够时整理产品判断。";
  const missing = SKILL_ORDER.find((skill) => !coveredSkills.includes(skill));
  const prompts: Record<SkillId, string> = {
    role: "轻提示：需求是谁提出的，不一定等于谁每天使用。",
    workflow: "轻提示：试着让对方带你走一遍现在的完整流程。",
    impact: "轻提示：还可以确认问题频率、后果和业务影响。",
    alternative: "轻提示：用户通常已经在用某种方式解决，不妨问问。",
    metric: "轻提示：什么变化能证明问题真的解决了？"
  };
  return missing ? prompts[missing] : "你已经覆盖了主要信息维度，可以结束访谈并整理产品判断。";
}

export function createTrainingSession(input: {
  scenarioId: string;
  scenario?: TrainingScenario;
  mode?: TrainingSession["mode"];
  scenarioVersion?: number;
  rubricVersion?: string;
}): TrainingSession {
  const scenario = input.scenario ?? getScenario(input.scenarioId);
  return {
    id: id("session"),
    scenarioId: scenario.id,
    scenarioSnapshot: input.scenario,
    scenarioVersion: input.scenarioVersion ?? 1,
    rubricVersion: input.rubricVersion ?? DEFAULT_RUBRIC_VERSION,
    modelVersion: DETERMINISTIC_ENGINE_VERSION,
    engine: "deterministic",
    mode: input.mode ?? "练习",
    stage: "interview",
    coveredSkills: [],
    hintsUsed: 0,
    messages: [makeMessage("ai", scenario.opening, 0)]
  };
}

export function sendTrainingMessage(session: TrainingSession, content: string): TrainingSession {
  const trimmed = content.trim();
  if (!trimmed || session.stage !== "interview") return session;
  const scenario = session.scenarioSnapshot ?? getScenario(session.scenarioId);
  const detected = detectSkills(trimmed);
  const newlyCovered = detected.filter((skill) => !session.coveredSkills.includes(skill));
  const revealedSkill = newlyCovered[0] ?? detected[0];
  const coveredSkills = [...new Set([...session.coveredSkills, ...detected])];
  const answer = revealedSkill
    ? scenario.hiddenFacts[revealedSkill]
    : "这个问题有点宽。你可以结合具体角色、当前流程或问题影响再问得更明确一些。";
  const userTurn = session.messages.length;
  return {
    ...session,
    coveredSkills,
    messages: [
      ...session.messages,
      makeMessage("user", trimmed, userTurn),
      makeMessage("ai", `${answer}\n\n${coachResponse(coveredSkills, session.mode)}`, userTurn + 1, revealedSkill)
    ]
  };
}

export function applyRoleplayReply(session: TrainingSession, input: {
  userMessage: string;
  reply: string;
  coveredSkills: SkillId[];
  revealedSkill?: SkillId;
  modelVersion: string;
}): TrainingSession {
  const turn = session.messages.length;
  return {
    ...session,
    engine: "openai",
    modelVersion: input.modelVersion,
    coveredSkills: [...new Set([...session.coveredSkills, ...input.coveredSkills])],
    messages: [
      ...session.messages,
      makeMessage("user", input.userMessage.trim(), turn),
      makeMessage("ai", input.reply, turn + 1, input.revealedSkill)
    ]
  };
}

export function useTrainingHint(session: TrainingSession): TrainingSession {
  if (session.stage !== "interview" || session.mode !== "练习") return session;
  return {
    ...session,
    hintsUsed: session.hintsUsed + 1,
    messages: [...session.messages, makeMessage("ai", coachResponse(session.coveredSkills, session.mode), session.messages.length)]
  };
}

export function moveToJudgment(session: TrainingSession): TrainingSession {
  return session.stage === "interview" ? { ...session, stage: "judgment" } : session;
}

export function submitJudgment(session: TrainingSession, judgment: ProductJudgment): TrainingSession {
  return { ...session, judgment, stage: "feedback" };
}

export function startRetry(session: TrainingSession): TrainingSession {
  return { ...session, stage: "retry" };
}

export function completeSession(session: TrainingSession): TrainingSession {
  return { ...session, stage: "complete" };
}

export function getCoveragePercent(session: TrainingSession): number {
  return Math.round((session.coveredSkills.length / SKILL_ORDER.length) * 100);
}
