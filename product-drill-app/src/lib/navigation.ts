export type ViewId = "workbench" | "product" | "history" | "profile" | "scenarios";

export type NavItem = {
  view: ViewId;
  label: string;
};

export type ViewMeta = {
  title: string;
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  { view: "workbench", label: "工作台" },
  { view: "product", label: "我的产品" },
  { view: "history", label: "对话历史" },
  { view: "profile", label: "能力画像" },
  { view: "scenarios", label: "场景库" }
];

const VIEW_META: Record<ViewId, ViewMeta> = {
  workbench: {
    title: "训练工作台",
    description: "通过 AI 角色扮演与产品分析，训练需求澄清和产品表达。"
  },
  product: {
    title: "我的产品",
    description: "输入产品资料，生成理解摘要、追问和优化建议。"
  },
  history: {
    title: "对话历史",
    description: "查看过往训练、评分复盘和下一步建议。"
  },
  profile: {
    title: "能力画像",
    description: "用基础趋势和高频短板定位下一轮训练方向。"
  },
  scenarios: {
    title: "场景库",
    description: "B2B、AI+、企业员工培训三个深场景。"
  }
};

export function getViewMeta(view: ViewId): ViewMeta {
  return VIEW_META[view];
}
