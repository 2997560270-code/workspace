import type { SkillId } from "./training-config";
import type { TrainingScenario } from "./training-config";

export const CUSTOM_SCENARIOS_STORAGE_KEY = "product-drill-custom-scenarios-v1";
export const CUSTOM_SCENARIO_ID_PREFIX = "custom-";

export function isCustomScenarioId(id: string): boolean {
  return id.startsWith(CUSTOM_SCENARIO_ID_PREFIX);
}

export function createCustomScenario(input: {
  title: string;
  industry: string;
  role: string;
  context: string;
  opening: string;
  skillId: SkillId;
  hiddenFacts: Record<SkillId, string>;
}): TrainingScenario {
  const slug = input.title.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "scenario";
  return {
    id: `${CUSTOM_SCENARIO_ID_PREFIX}${slug}-${crypto.randomUUID().slice(0, 8)}`,
    title: input.title.trim(),
    shortTitle: input.title.trim().slice(0, 24),
    industry: input.industry.trim(),
    skillId: input.skillId,
    difficulty: "标准",
    duration: 8,
    role: input.role.trim(),
    context: input.context.trim(),
    opening: input.opening.trim(),
    hiddenFacts: input.hiddenFacts,
    briefing: ["这是你创建的本地练习场景", "回答只用于练习，不进入正式能力趋势", "本轮重点：" + skillName(input.skillId)]
  };
}

const SKILL_NAMES: Record<SkillId, string> = {
  role: "用户与角色识别",
  workflow: "场景与当前流程",
  impact: "问题影响与根因",
  alternative: "现有替代方案",
  metric: "成功指标"
};

function skillName(id: SkillId): string {
  return SKILL_NAMES[id];
}

export function loadCustomScenarios(): TrainingScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_SCENARIOS_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter(isTrainingScenario).filter((scenario) => isCustomScenarioId(scenario.id));
  } catch {
    return [];
  }
}

export function saveCustomScenario(scenario: TrainingScenario): void {
  const scenarios = loadCustomScenarios().filter((item) => item.id !== scenario.id);
  window.localStorage.setItem(CUSTOM_SCENARIOS_STORAGE_KEY, JSON.stringify([...scenarios, scenario]));
}

function isSkillId(value: unknown): value is SkillId {
  return value === "role" || value === "workflow" || value === "impact" || value === "alternative" || value === "metric";
}

function isTrainingScenario(value: unknown): value is TrainingScenario {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TrainingScenario>;
  const facts = item.hiddenFacts;
  return typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.shortTitle === "string"
    && typeof item.industry === "string"
    && isSkillId(item.skillId)
    && item.difficulty === "标准"
    && typeof item.duration === "number"
    && typeof item.role === "string"
    && typeof item.context === "string"
    && typeof item.opening === "string"
    && Array.isArray(item.briefing)
    && item.briefing.every((entry) => typeof entry === "string")
    && !!facts
    && typeof facts === "object"
    && typeof facts.role === "string"
    && typeof facts.workflow === "string"
    && typeof facts.impact === "string"
    && typeof facts.alternative === "string"
    && typeof facts.metric === "string";
}
