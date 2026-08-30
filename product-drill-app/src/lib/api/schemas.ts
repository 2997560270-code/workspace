import { z } from "zod";
import { EvidenceLevelSchema, SkillIdSchema } from "../ai/schemas";

export const TrainingModeSchema = z.enum(["练习", "独立", "严格"]);
export const TrainingEngineSchema = z.enum(["openai", "deterministic"]);
export const TrainingStageSchema = z.enum(["interview", "judgment", "feedback", "retry", "complete"]);

export const TrainingMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["ai", "user"]),
  content: z.string(),
  turnIndex: z.number().int().nonnegative(),
  revealedSkill: SkillIdSchema.optional()
});

export const TrainingScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  industry: z.string().min(1),
  skillId: SkillIdSchema,
  difficulty: z.enum(["基础", "标准", "严格"]),
  duration: z.number().positive(),
  role: z.string(),
  context: z.string(),
  background: z.array(z.string().max(600)).max(8).optional(),
  backgroundSource: z.string().max(400).optional(),
  opening: z.string(),
  hiddenFacts: z.object({
    role: z.string(), workflow: z.string(), impact: z.string(), alternative: z.string(), metric: z.string()
  }),
  briefing: z.array(z.string())
});

export const ProductJudgmentSchema = z.object({
  targetUser: z.string().max(4000),
  currentWorkflow: z.string().max(4000),
  coreProblem: z.string().max(4000),
  problemImpact: z.string().max(4000),
  alternative: z.string().max(4000),
  recommendation: z.string().max(4000),
  successMetric: z.string().max(4000),
  biggestAssumption: z.string().max(4000)
});

export const TrainingSessionSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioSnapshot: TrainingScenarioSchema.optional(),
  scenarioVersion: z.number().int().positive(),
  rubricVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  engine: TrainingEngineSchema,
  mode: TrainingModeSchema,
  stage: TrainingStageSchema,
  messages: z.array(TrainingMessageSchema).max(100),
  coveredSkills: z.array(SkillIdSchema),
  hintsUsed: z.number().int().nonnegative(),
  judgment: ProductJudgmentSchema.optional()
});

export const EvaluationDimensionSchema = z.object({
  id: SkillIdSchema,
  name: z.string(),
  score: z.number().min(0).max(4),
  level: EvidenceLevelSchema,
  evidence: z.string(),
  evidenceMessageIds: z.array(z.string()),
  evidenceQuotes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  why: z.string(),
  nextAction: z.string()
});

export const EvaluationIssueSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
  nextAction: z.string(),
  retryPrompt: z.string(),
  targetSkill: SkillIdSchema
});

export const EvaluationSchema = z.object({
  id: z.string().min(1),
  totalScore: z.number().min(0).max(100),
  summary: z.string(),
  dimensions: z.array(EvaluationDimensionSchema),
  issues: z.array(EvaluationIssueSchema),
  strengths: z.array(z.string()),
  confidence: z.enum(["高", "中", "低"]),
  engine: TrainingEngineSchema,
  modelVersion: z.string(),
  rubricVersion: z.string(),
  scenarioVersion: z.number().int().positive()
});

export const RetryResultSchema = z.object({
  id: z.string().optional(),
  issueId: z.string().min(1),
  targetSkill: SkillIdSchema,
  answer: z.string().max(4000),
  improved: z.boolean(),
  feedback: z.string(),
  engine: TrainingEngineSchema.optional(),
  modelVersion: z.string().optional()
});

export const MentorNoteSchema = z.object({
  author: z.string().min(1).max(120),
  content: z.string().min(1).max(4000),
  createdAt: z.string().datetime()
});

export const TrainingHistoryRecordSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioSnapshot: TrainingScenarioSchema.optional(),
  scenarioVersion: z.number().int().positive(),
  rubricVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  engine: TrainingEngineSchema,
  mode: TrainingModeSchema,
  completedAt: z.string().datetime(),
  totalScore: z.number().min(0).max(100),
  messages: z.array(TrainingMessageSchema).max(100),
  judgment: ProductJudgmentSchema.optional(),
  evaluation: EvaluationSchema,
  retry: RetryResultSchema.optional(),
  mentorNote: MentorNoteSchema.optional()
});

export const StoredHistorySchema = z.object({
  version: z.literal(1),
  records: z.array(TrainingHistoryRecordSchema)
});

export const CreateSessionBodySchema = z.object({
  scenarioId: z.string().min(1),
  mode: TrainingModeSchema.optional()
});

export const MessageBodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
  session: TrainingSessionSchema.optional()
});

export const JudgmentBodySchema = z.object({
  judgment: ProductJudgmentSchema,
  session: TrainingSessionSchema.optional()
});

export const EvaluationBodySchema = z.object({
  session: TrainingSessionSchema.optional()
});

export const RetryBodySchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  issueId: z.string().min(1),
  record: TrainingHistoryRecordSchema.optional()
});

export const HistorySyncBodySchema = z.object({ record: TrainingHistoryRecordSchema });
