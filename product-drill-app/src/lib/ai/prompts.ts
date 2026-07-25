import { SKILLS, getScenario } from "../training-config";
import type { TrainingSession } from "../training-session";

export function buildRoleplayPrompt(session: TrainingSession, userMessage: string): string {
  const scenario = getScenario(session.scenarioId);
  return `You are roleplaying one stable business stakeholder for product-discovery practice.\n\nSCENARIO FACTS (never contradict):\n${JSON.stringify({ role: scenario.role, context: scenario.context, opening: scenario.opening, hiddenFacts: scenario.hiddenFacts }, null, 2)}\n\nRULES:\n- Answer only what the learner's latest question reasonably reveals.\n- Do not volunteer every hidden fact.\n- Keep the role's perspective; never act as a coach unless mode is 练习.\n- Do not invent market evidence, budgets, metrics, or facts not supplied above.\n- coveredSkills contains only skills genuinely addressed by the latest question.\n- If no skill is addressed, revealedSkill is null and ask for a more specific question in character.\n- In 练习 mode, add at most one short coaching hint after the in-character answer.\n\nMODE: ${session.mode}\nALREADY COVERED: ${session.coveredSkills.join(", ") || "none"}\nLATEST LEARNER QUESTION: ${userMessage}`;
}

export function buildEvaluationPrompt(session: TrainingSession): string {
  const validIds = session.messages.map((message) => message.id);
  return `Evaluate observable product-discovery behavior, not writing style or message count.\n\nSKILLS:\n${JSON.stringify(SKILLS, null, 2)}\n\nSESSION:\n${JSON.stringify({ mode: session.mode, hintsUsed: session.hintsUsed, messages: session.messages, judgment: session.judgment }, null, 2)}\n\nCONTRACT:\n- Cite only these message ids: ${validIds.join(", ")}.\n- Evidence quotes must be verbatim substrings from the cited message.\n- Do not infer behavior from the judgment when no question evidence exists; use 在提示下体现 at most.\n- Practice-mode hints cannot produce 独立体现 unless the behavior occurred before any relevant hint.\n- Return exactly one dimension for each of: role, workflow, impact, alternative, metric.\n- Low evidence means 低 confidence and 未体现, not a precise high score.\n- Identify up to three actionable issues and one primary retry target.\n- Never add scenario facts that the learner did not ask about.`;
}

export function buildRetryPrompt(input: { targetSkill: string; originalIssue: string; retryPrompt: string; answer: string }): string {
  return `Evaluate only whether the new question improves the target product-discovery behavior.\nTARGET SKILL: ${input.targetSkill}\nORIGINAL ISSUE: ${input.originalIssue}\nTASK: ${input.retryPrompt}\nLEARNER RETRY: ${input.answer}\nDo not re-score the full session. improved is true only when the question directly and specifically targets the requested missing information.`;
}
