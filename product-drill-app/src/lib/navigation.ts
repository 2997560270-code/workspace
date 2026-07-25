export type ViewId = "today" | "map" | "review" | "ability";

export type NavItem = {
  view: ViewId;
  label: string;
  hint: string;
};

export type ViewMeta = {
  title: string;
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  { view: "today", label: "今日训练", hint: "开始一次针对性练习" },
  { view: "map", label: "训练地图", hint: "按能力选择训练任务" },
  { view: "review", label: "复盘与复练", hint: "重练具体失误时刻" },
  { view: "ability", label: "我的能力", hint: "查看掌握状态和证据" }
];

const VIEW_META: Record<ViewId, ViewMeta> = {
  today: {
    title: "今天，练会一个真正的产品判断",
    description: "用 5—10 分钟完成一个真实业务情境，获得逐句证据反馈。"
  },
  map: {
    title: "训练地图",
    description: "按产品发现能力逐步进阶，而不是机械刷题。"
  },
  review: {
    title: "复盘与复练",
    description: "回到具体失误时刻，用更好的行为证明自己已经改善。"
  },
  ability: {
    title: "我的能力",
    description: "每一个结论都可以追溯到真实训练证据。"
  }
};

export function getViewMeta(view: ViewId): ViewMeta {
  return VIEW_META[view];
}
