import type { SkillId } from "./training-config";
import type { ProductJudgment, TrainingMessage } from "./training-session";

export type JudgmentFieldKey = keyof ProductJudgment;

export type JudgmentDraft = {
  /** 只含能从对话抽到内容的字段，缺失的留空给用户自己写 */
  values: Partial<ProductJudgment>;
  /** 出处：来自第几轮的哪条用户原话，供 UI 展示与一键撤销 */
  provenance: Partial<Record<JudgmentFieldKey, { messageIds: string[]; turnIndex: number }>>;
  /** 对话未覆盖的字段，UI 用来提示「还缺这一项」 */
  missing: JudgmentFieldKey[];
};

const ALL_FIELDS: JudgmentFieldKey[] = [
  "targetUser",
  "currentWorkflow",
  "coreProblem",
  "problemImpact",
  "alternative",
  "recommendation",
  "successMetric",
  "biggestAssumption",
];

/** 维度 → 可预填字段。recommendation / biggestAssumption 故意不映射：
 *  判断与假设必须由用户自己形成（产品原则），也保证评分输入不被预填污染。 */
const FIELD_BY_SKILL: Partial<Record<SkillId, JudgmentFieldKey[]>> = {
  role: ["targetUser"],
  workflow: ["currentWorkflow"],
  impact: ["coreProblem", "problemImpact"],
  alternative: ["alternative"],
  metric: ["successMetric"],
};

/** 从对话生成判断画布草稿：取「引出该维度揭示」的那条用户原话作为预填值。
 *  确定性抽取，不依赖模型。 */
export function draftJudgmentFromTranscript(
  messages: readonly TrainingMessage[],
  coveredSkills: readonly SkillId[]
): JudgmentDraft {
  const values: Partial<ProductJudgment> = {};
  const provenance: JudgmentDraft["provenance"] = {};

  messages.forEach((message, index) => {
    if (message.role !== "ai" || !message.revealedSkill) return;
    if (!coveredSkills.includes(message.revealedSkill)) return;
    const previous = messages[index - 1];
    if (!previous || previous.role !== "user" || !previous.content.trim()) return;
    for (const field of FIELD_BY_SKILL[message.revealedSkill] ?? []) {
      if (values[field]) continue;
      values[field] = previous.content.trim();
      provenance[field] = { messageIds: [previous.id, message.id], turnIndex: message.turnIndex };
    }
  });

  return {
    values,
    provenance,
    missing: ALL_FIELDS.filter((field) => !values[field]),
  };
}

/** 把草稿并入当前画布：用户手改过的字段与已有内容永不被覆盖；幂等。 */
export function mergeJudgmentDraft(
  current: ProductJudgment,
  draft: JudgmentDraft,
  touched: ReadonlySet<JudgmentFieldKey>
): ProductJudgment {
  const next: ProductJudgment = { ...current };
  for (const [field, value] of Object.entries(draft.values) as Array<[JudgmentFieldKey, string]>) {
    if (touched.has(field)) continue;
    if (next[field].trim()) continue;
    next[field] = value;
  }
  return next;
}
