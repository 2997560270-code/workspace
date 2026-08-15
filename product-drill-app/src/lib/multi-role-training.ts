import type { SkillId } from "./training-config";

export type MultiRoleProfile = {
  id: string;
  name: string;
  objective: string;
  opening: string;
  facts: Record<SkillId, string>;
};

export type MultiRoleScenario = {
  id: string;
  title: string;
  context: string;
  roles: MultiRoleProfile[];
};

export const MULTI_ROLE_SCENARIOS: MultiRoleScenario[] = [{
  id: "inventory-discrepancy",
  title: "库存差异：同一问题的三种视角",
  context: "月底盘点出现库存差异，团队正在讨论是否开发一套自动提醒工具。",
  roles: [
    { id: "operations", name: "仓储运营负责人", objective: "降低盘点和复核成本", opening: "盘点差异越来越多，我们需要一个自动提醒工具。", facts: { role: "运营负责人推动项目，仓库主管每天执行复核。", workflow: "每月底从系统导出库存，再和实盘表格逐项比对。", impact: "一次盘点通常需要两天，差异大时会延迟发货。", alternative: "团队使用共享表格记录异常，但没有统一提醒。", metric: "复核时间降到半天以内，并能追溯差异来源。" } },
    { id: "finance", name: "财务负责人", objective: "确保账实一致和审计可追溯", opening: "我关心的不是提醒数量，而是账实差异能不能解释清楚。", facts: { role: "财务负责月度结账，仓库和采购提供原始记录。", workflow: "财务在结账前抽查高价值 SKU，再追问异常原因。", impact: "无法解释的差异会延长结账并增加审计风险。", alternative: "财务用邮件追踪异常，但往返确认很慢。", metric: "高价值差异 100% 有责任人和处理记录。" } },
    { id: "worker", name: "一线仓库员工", objective: "快速完成收货、上架和盘点", opening: "每天已经有很多表要填，别再增加复杂操作了。", facts: { role: "员工录入收货和盘点数据，主管负责抽查。", workflow: "收货时扫码，异常时拍照并在群里留言。", impact: "重复录入会挤占出库时间，忙时最容易漏填。", alternative: "员工用手机拍照和群消息暂时记录异常。", metric: "每次异常新增操作不超过一分钟，漏填明显减少。" } }
  ]
}];

const KEYWORDS: Record<SkillId, string[]> = {
  role: ["谁", "角色", "负责人", "使用", "决策"],
  workflow: ["流程", "现在", "目前", "步骤", "怎么", "如何"],
  impact: ["影响", "后果", "损失", "频率", "多久", "风险"],
  alternative: ["现在用", "替代", "表格", "邮件", "群", "其他方法"],
  metric: ["指标", "成功", "证明", "目标", "衡量"]
};

export function answerMultiRoleQuestion(role: MultiRoleProfile, question: string): string {
  const skill = (Object.keys(KEYWORDS) as SkillId[]).find((id) => KEYWORDS[id].some((keyword) => question.includes(keyword)));
  return skill ? role.facts[skill] : "我可以继续说明，但请把问题落到具体角色、流程、影响、替代方式或成功指标上。";
}
