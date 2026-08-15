import type { SkillId } from "./training-config";

export type CommunityCaseStatus = "pending" | "published" | "archived";
export type CommunityCase = {
  id: string;
  title: string;
  industry: string;
  skillId: SkillId;
  summary: string;
  lesson: string;
  author: string;
  status: CommunityCaseStatus;
  createdAt: string;
};

export type KnowledgeEntry = {
  id: string;
  title: string;
  industry: string;
  tags: string[];
  content: string;
  source: string;
};

export const RESOURCE_CASES_STORAGE_KEY = "product-drill-community-cases-v1";

export const COMMUNITY_CASES: CommunityCase[] = [
  { id: "case-b2b-onboarding", title: "客户说想要更多引导，先确认哪里卡住", industry: "B2B SaaS", skillId: "workflow", summary: "一次需求评审中，团队把激活下降直接归因于缺少引导。", lesson: "先还原用户在关键步骤的真实行为，再决定是否增加说明。", author: "Product Drill", status: "published", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "case-ops-spreadsheet", title: "表格并不一定是问题本身", industry: "运营工具", skillId: "alternative", summary: "运营团队提出做新报表，但现有表格已经满足大部分查看需求。", lesson: "追问表格在哪一步失效，以及用户真正承担的成本。", author: "Product Drill", status: "published", createdAt: "2026-08-02T00:00:00.000Z" },
  { id: "case-renewal", title: "续费下降不等于需要立刻降价", industry: "企业软件", skillId: "impact", summary: "续费问题同时涉及上线、价值证明和采购谈判。", lesson: "拆分不同角色和阶段，再验证哪个因素真正影响续费。", author: "Product Drill", status: "published", createdAt: "2026-08-03T00:00:00.000Z" }
];

export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  { id: "knowledge-role", title: "用户角色拆分", industry: "通用", tags: ["角色", "访谈"], content: "提出需求、每天使用、做出决策和承担后果的人可能不是同一个人。", source: "产品发现训练规范" },
  { id: "knowledge-workflow", title: "当前流程还原", industry: "通用", tags: ["流程", "观察"], content: "优先追问最近一次真实发生的过程，避免只收集抽象评价。", source: "产品发现训练规范" },
  { id: "knowledge-evidence", title: "事实与假设边界", industry: "通用", tags: ["证据", "判断"], content: "用户原话和可观察行为是证据，解释和方案仍然需要验证。", source: "证据反馈规范" },
  { id: "knowledge-saas", title: "SaaS 续费分析", industry: "企业软件", tags: ["续费", "价值"], content: "拆分上线完成率、关键流程覆盖、续费意愿和折扣成本。", source: "企业软件案例集" },
  { id: "knowledge-retail", title: "零售异常处理", industry: "零售运营", tags: ["门店", "损耗"], content: "识别录入、检查、提醒和责任归属之间的断点。", source: "零售运营案例集" },
  { id: "knowledge-ai", title: "AI 功能需求判断", industry: "协同办公", tags: ["AI", "需求"], content: "先确认用户问题和替代流程，再判断模型能力是否是必要解法。", source: "AI 产品发现案例集" }
];

export function loadCommunityCases(): CommunityCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RESOURCE_CASES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCommunityCase) : [];
  } catch {
    return [];
  }
}

export function saveCommunityCase(input: Omit<CommunityCase, "id" | "createdAt" | "status">): CommunityCase {
  const next: CommunityCase = { ...input, id: `case-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), status: "pending" };
  if (typeof window !== "undefined") window.localStorage.setItem(RESOURCE_CASES_STORAGE_KEY, JSON.stringify([...loadCommunityCases(), next]));
  return next;
}

function isCommunityCase(value: unknown): value is CommunityCase {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CommunityCase>;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.industry === "string" && typeof item.skillId === "string" && typeof item.summary === "string" && typeof item.lesson === "string" && typeof item.author === "string" && (item.status === "pending" || item.status === "published" || item.status === "archived") && typeof item.createdAt === "string";
}
