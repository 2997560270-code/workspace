import { SKILLS, resolveSessionScenario } from "../training-config";
import type { TrainingSession } from "../training-session";

/** 汇总场景事实（含业务背景），供提示词注入。内置场景以服务端配置为准，防止客户端快照注入。 */
export function scenarioFacts(session: TrainingSession) {
  const scenario = resolveSessionScenario(session);
  return {
    role: scenario.role,
    context: scenario.context,
    background: scenario.background ?? [],
    opening: scenario.opening,
    hiddenFacts: scenario.hiddenFacts
  };
}

export function buildRoleplayPrompt(session: TrainingSession, userMessage: string): string {
  return `You are roleplaying one stable business stakeholder for product-discovery practice.\n\nSCENARIO FACTS (never contradict):\n${JSON.stringify(scenarioFacts(session), null, 2)}\n\nBUSINESS BACKGROUND RULES:\n- You live inside this specific business context: the company, scale, current workflow, numbers and constraints in the background are your reality. Answer from them, not from generic knowledge.\n- Every answer must stay consistent with the background above; never change the company, scale, numbers, tools or stakeholders mid-conversation.\n- When the learner's question relates to something described in the background, ground the answer in that specific situation (use its concrete details) instead of answering in abstractions.\n- If the learner asks about something the background cannot answer, answer in character as the stakeholder plausibly would, but do not invent new market data or budgets.\n\nROLEPLAY RULES:\n- Answer only what the learner's latest question reasonably reveals.\n- Do not volunteer every hidden fact.\n- Keep the role's perspective; never act as a coach unless mode is 练习.\n- Do not invent market evidence, budgets, metrics, or facts not supplied above.\n- coveredSkills contains only skills genuinely addressed by the latest question.\n- If no skill is addressed, revealedSkill is null and ask for a more specific question in character.\n- In 练习 mode, add at most one short coaching hint after the in-character answer.\n\nMODE: ${session.mode}\nALREADY COVERED: ${session.coveredSkills.join(", ") || "none"}\nLATEST LEARNER QUESTION: ${userMessage}`;
}

export function buildEvaluationPrompt(session: TrainingSession): string {
  const validIds = session.messages.map((message) => message.id);
  const scenario = resolveSessionScenario(session);
  return `Evaluate observable product-discovery behavior, not writing style or message count.\n\nSKILLS:\n${JSON.stringify(SKILLS, null, 2)}\n\nSCENARIO BACKGROUND (reference only, do not quote in evidence):\n${JSON.stringify({ industry: scenario.industry, role: scenario.role, context: scenario.context, background: scenario.background ?? [] }, null, 2)}\n\nSESSION:\n${JSON.stringify({ mode: session.mode, hintsUsed: session.hintsUsed, messages: session.messages, judgment: session.judgment }, null, 2)}\n\nCONTRACT:\n- Cite only these message ids: ${validIds.join(", ")}.\n- Evidence quotes must be verbatim substrings from the cited message.\n- Do not infer behavior from the judgment when no question evidence exists; use 在提示下体现 at most.\n- Practice-mode hints cannot produce 独立体现 unless the behavior occurred before any relevant hint.\n- Return exactly one dimension for each of: role, workflow, impact, alternative, metric.\n- Low evidence means 低 confidence and 未体现, not a precise high score.\n- Identify up to three actionable issues and one primary retry target.\n- Judge whether the learner's questions targeted THIS business context (its stakeholders, workflow, numbers and constraints) rather than generic questions any scenario could answer; generic-but-valid questions earn lower 稳定且深入 ratings, never invented evidence.\n- In why/nextAction, you may reference the scenario background to explain what specific information was missed.\n- Never add scenario facts that the learner did not ask about to evidence, level ratings or confidence; background references belong only in why/nextAction.`;
}

export function buildRetryPrompt(input: { targetSkill: string; originalIssue: string; retryPrompt: string; answer: string }): string {
  return `Evaluate only whether the new question improves the target product-discovery behavior.\nTARGET SKILL: ${input.targetSkill}\nORIGINAL ISSUE: ${input.originalIssue}\nTASK: ${input.retryPrompt}\nLEARNER RETRY: ${input.answer}\nDo not re-score the full session. improved is true only when the question directly and specifically targets the requested missing information.`;
}
