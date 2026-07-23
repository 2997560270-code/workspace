import { z } from "zod";

export const SkillIdSchema = z.enum(["role", "workflow", "impact", "alternative", "metric"]);
export const EvidenceLevelSchema = z.enum(["未体现", "在提示下体现", "独立体现", "稳定且深入"]);

export const RoleplayOutputSchema = z.object({
  reply: z.string().min(1),
  revealedSkill: SkillIdSchema.nullable(),
  coveredSkills: z.array(SkillIdSchema)
});

export const EvaluationOutputSchema = z.object({
  summary: z.string(),
  confidence: z.enum(["高", "中", "低"]),
  dimensions: z.array(z.object({
    id: SkillIdSchema,
    level: EvidenceLevelSchema,
    confidence: z.number().min(0).max(1),
    evidenceMessageIds: z.array(z.string()),
    evidenceQuotes: z.array(z.string()),
    why: z.string(),
    nextAction: z.string()
  })),
  strengths: z.array(z.string()).max(3),
  issues: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    evidenceMessageIds: z.array(z.string()),
    evidenceQuote: z.string(),
    nextAction: z.string(),
    retryPrompt: z.string(),
    targetSkill: SkillIdSchema
  })).max(3)
});

export const RetryOutputSchema = z.object({
  improved: z.boolean(),
  feedback: z.string(),
  evidence: z.string()
});
