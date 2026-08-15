export type PlanId = "free" | "team" | "pro";
export type SubscriptionStatus = "active" | "trial" | "canceled";

export type Plan = { id: PlanId; name: string; price: string; description: string; features: string[] };
export type Subscription = { planId: PlanId; status: SubscriptionStatus; startedAt: string };

export const BILLING_STORAGE_KEY = "product-drill-billing-v1";

export const PLANS: Plan[] = [
  { id: "free", name: "个人练习", price: "免费", description: "适合个人熟悉训练闭环。", features: ["内置场景与课程", "本地训练记录", "基础复盘"] },
  { id: "team", name: "团队试用", price: "待定", description: "用于小团队验证邀请和点评流程。", features: ["团队邀请码", "成员角色", "导师点评预览"] },
  { id: "pro", name: "专业版", price: "待定", description: "正式计费方案将在支付服务接入后开放。", features: ["正式模型额度", "团队分析", "服务端知识库"] }
];

export function loadSubscription(userId: string): Subscription {
  if (typeof window === "undefined") return { planId: "free", status: "active", startedAt: new Date(0).toISOString() };
  try {
    const raw = window.localStorage.getItem(`${BILLING_STORAGE_KEY}:${userId}`);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (isSubscription(value)) return value;
  } catch {
    // Use the free plan when local state is unavailable.
  }
  return { planId: "free", status: "active", startedAt: new Date().toISOString() };
}

export function selectPlan(userId: string, planId: PlanId): Subscription {
  const next: Subscription = { planId, status: planId === "free" ? "active" : "trial", startedAt: new Date().toISOString() };
  if (typeof window !== "undefined") window.localStorage.setItem(`${BILLING_STORAGE_KEY}:${userId}`, JSON.stringify(next));
  return next;
}

function isSubscription(value: unknown): value is Subscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<Subscription>;
  return (subscription.planId === "free" || subscription.planId === "team" || subscription.planId === "pro")
    && (subscription.status === "active" || subscription.status === "trial" || subscription.status === "canceled")
    && typeof subscription.startedAt === "string";
}
