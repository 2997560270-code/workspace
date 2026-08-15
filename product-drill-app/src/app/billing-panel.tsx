"use client";

import { useEffect, useState } from "react";
import { loadSubscription, PLANS, selectPlan, type Subscription } from "../lib/billing";
import { requestClientJson } from "../lib/client-api";

export function BillingPanel({ userId }: { userId: string }) {
  const [subscription, setSubscription] = useState<Subscription>(() => loadSubscription(userId));
  useEffect(() => {
    setSubscription(loadSubscription(userId));
    let active = true;
    void requestClientJson<{ subscription: { plan_id?: string; status?: string } | null }>("/api/billing").then((result) => {
      const planId = result?.subscription?.plan_id;
      const status = result?.subscription?.status;
      if (!active || !result?.subscription || !["free", "team", "pro"].includes(String(planId))) return;
      setSubscription({
        planId: planId as Subscription["planId"],
        status: status === "trial" ? "trial" : status === "canceled" ? "canceled" : "active",
        startedAt: new Date().toISOString(),
      });
    });
    return () => { active = false; };
  }, [userId]);
  return <section className="surface billing-panel" data-testid="billing-panel"><div className="section-heading"><div><span className="section-kicker">计划与订阅</span><h2>选择适合当前阶段的训练方式</h2></div><span className="status-tag">本地计费预览</span></div><p className="billing-boundary">当前只记录本地套餐状态，不会发起扣款。正式支付需要接入支付服务、发票和取消流程。</p><div className="billing-plans">{PLANS.map((plan) => { const active = subscription.planId === plan.id; return <article className={active ? "billing-plan active" : "billing-plan"} key={plan.id}><span className="section-kicker">{plan.name}</span><strong>{plan.price}</strong><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><button className="button button-secondary" disabled={active} onClick={() => setSubscription(selectPlan(userId, plan.id))} type="button">{active ? subscription.status === "trial" ? "试用中" : "当前方案" : "选择方案"}</button></article>; })}</div></section>;
}
