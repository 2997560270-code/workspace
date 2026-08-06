import { zodTextFormat } from "openai/helpers/zod";
import { captureServerException } from "../monitoring/server";
import { getScenario, getSkill, type SkillId } from "../training-config";
import { applyRoleplayReply, DETERMINISTIC_ENGINE_VERSION, sendTrainingMessage, type TrainingSession } from "../training-session";
import { evaluateRetry, generateEvaluation, type Evaluation, type EvidenceDimension } from "../evaluation";
import { runtimeEnv } from "../env";
import { getOpenAIClient } from "./client";
import { buildEvaluationPrompt, buildRetryPrompt, buildRoleplayPrompt } from "./prompts";
import { EvaluationOutputSchema, RetryOutputSchema, RoleplayOutputSchema } from "./schemas";
import { requestStructuredResponse } from "./structured-response";

const SCORE_BY_LEVEL = { "未体现": 0, "在提示下体现": 2, "独立体现": 3, "稳定且深入": 4 } as const;

export async function generateRoleplayTurn(session: TrainingSession, content: string): Promise<TrainingSession> {
  const client = getOpenAIClient();
  if (!client) return { ...sendTrainingMessage(session, content), engine: "deterministic", modelVersion: DETERMINISTIC_ENGINE_VERSION };
  try {
    const parsed = await requestStructuredResponse({
      client,
      model: runtimeEnv.roleplayModel,
      input: buildRoleplayPrompt(session, content),
      schema: RoleplayOutputSchema,
      schemaName: "product_drill_roleplay",
    });
    return applyRoleplayReply(session, {
      userMessage: content,
      reply: parsed.reply,
      coveredSkills: parsed.coveredSkills,
      revealedSkill: parsed.revealedSkill ?? undefined,
      modelVersion: `${runtimeEnv.roleplayModel}:${runtimeEnv.modelVersion}`
    });
  } catch (error) {
    captureServerException(error, { area: "roleplay", sessionId: session.id });
    return { ...sendTrainingMessage(session, content), engine: "deterministic", modelVersion: DETERMINISTIC_ENGINE_VERSION };
  }
}

export async function generateStructuredEvaluation(session: TrainingSession): Promise<Evaluation> {
  const client = getOpenAIClient();
  if (!client || session.engine !== "openai") return generateEvaluation(session);
  try {
    const parsed = await requestStructuredResponse({
      client,
      model: runtimeEnv.evaluationModel,
      input: buildEvaluationPrompt(session),
      schema: EvaluationOutputSchema,
      schemaName: "product_drill_evaluation",
    });
    const messageMap = new Map(session.messages.map((message) => [message.id, message.content]));
    const dimensions: EvidenceDimension[] = parsed.dimensions.map((item) => {
      const validEvidence = item.evidenceMessageIds
        .map((id, index) => ({ id, quote: item.evidenceQuotes[index] ?? "" }))
        .filter(({ id, quote }) => messageMap.has(id) && quote && messageMap.get(id)!.includes(quote));
      const level = validEvidence.length || item.level === "未体现" ? item.level : "未体现";
      return {
        id: item.id,
        name: getSkill(item.id).name,
        score: SCORE_BY_LEVEL[level],
        level,
        evidence: validEvidence.length ? `“${validEvidence.map((evidence) => evidence.quote).join("” / “")}”` : "本次对话中没有找到可验证的直接证据。",
        evidenceMessageIds: validEvidence.map((evidence) => evidence.id),
        evidenceQuotes: validEvidence.map((evidence) => evidence.quote),
        confidence: validEvidence.length ? item.confidence : Math.min(item.confidence, 0.3),
        why: item.why,
        nextAction: item.nextAction
      };
    });
    const dimensionMap = new Map(dimensions.map((item) => [item.id, item]));
    const orderedDimensions = (["role", "workflow", "impact", "alternative", "metric"] as SkillId[]).map((id) => dimensionMap.get(id) ?? {
      id,
      name: getSkill(id).name,
      score: 0,
      level: "未体现" as const,
      evidence: "模型未返回该能力维度。",
      evidenceMessageIds: [],
      evidenceQuotes: [],
      confidence: 0,
      why: getSkill(id).description,
      nextAction: getSkill(id).practiceTip
    });
    const totalScore = Math.round((orderedDimensions.reduce((sum, item) => sum + item.score, 0) / 20) * 100);
    return {
      id: `evaluation-${session.id}`,
      totalScore,
      summary: parsed.summary,
      confidence: parsed.confidence,
      dimensions: orderedDimensions,
      strengths: parsed.strengths,
      issues: parsed.issues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        description: issue.description,
        evidence: issue.evidenceQuote ? `“${issue.evidenceQuote}”` : "需要更多证据。",
        nextAction: issue.nextAction,
        retryPrompt: issue.retryPrompt,
        targetSkill: issue.targetSkill
      })),
      engine: "openai",
      modelVersion: `${runtimeEnv.evaluationModel}:${runtimeEnv.modelVersion}`,
      rubricVersion: session.rubricVersion,
      scenarioVersion: session.scenarioVersion
    };
  } catch (error) {
    captureServerException(error, { area: "evaluation", sessionId: session.id });
    return generateEvaluation(session);
  }
}

export async function evaluateRetryTurn(input: { targetSkill: SkillId; originalIssue: string; retryPrompt: string; answer: string }) {
  const client = getOpenAIClient();
  if (!client) return { ...evaluateRetry(input.answer, input.targetSkill), engine: "deterministic" as const, modelVersion: "deterministic-v1" };
  try {
    const parsed = await requestStructuredResponse({
      client,
      model: runtimeEnv.evaluationModel,
      input: buildRetryPrompt(input),
      schema: RetryOutputSchema,
      schemaName: "product_drill_retry",
    });
    return { improved: parsed.improved, feedback: parsed.feedback, engine: "openai" as const, modelVersion: `${runtimeEnv.evaluationModel}:${runtimeEnv.modelVersion}` };
  } catch (error) {
    captureServerException(error, { area: "retry" });
    return { ...evaluateRetry(input.answer, input.targetSkill), engine: "deterministic" as const, modelVersion: "deterministic-v1" };
  }
}
