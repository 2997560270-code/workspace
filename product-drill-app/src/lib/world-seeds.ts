/**
 * world-seeds.ts — 三个演示世界的静态数据
 *
 * 无 Supabase 时用于 demo 模式，内容与 202607230002 migration 中的世界一致。
 * 类型来自 causal-world.ts。
 */
import type { CausalWorldVersion } from "./causal-world";

export type WorldSeed = {
  world_id: string;
  title: string;
  domain: string;
  transfer_role: "calibration" | "intervention" | "transfer_test";
  description: string;
  version: CausalWorldVersion;
};

export const DEMO_WORLDS: WorldSeed[] = [
  {
    world_id: "world-1",
    title: "数据大屏建设请求",
    domain: "product",
    transfer_role: "calibration",
    description: "产品部门收到建设数据大屏的需求，需要在决策前充分调查。",
    version: {
      world_id: "world-1",
      version: "1.0.0",
      transfer_role: "calibration",
      trigger_statement:
        "运营部负责人找到你，说希望有一个数据大屏来提升效率。你有机会在做决策前先了解情况。",
      visible_facts: [
        "运营部负责人提出需要数据大屏",
        "团队有前端开发资源",
        "目前没有统一的数据展示入口",
      ],
      immutable_rules: {
        hidden_facts: [
          {
            id: "wf-1",
            content: "实际上每天真正用报表的人只有两位区域经理，其他人偶尔看",
            reveal_condition_id: "rc-users",
            causal_significance: "使用人数少意味着大屏价值有限",
          },
          {
            id: "wf-2",
            content: "当前核心痛点是多系统数据编码不一致，手工核对每周耗时6小时",
            reveal_condition_id: "rc-workflow",
            causal_significance: "真正问题是数据治理而非展示",
          },
          {
            id: "wf-3",
            content: "团队曾尝试Excel模板方案，但因编码不一致而放弃",
            reveal_condition_id: "rc-alt",
            causal_significance: "替代方案已被尝试并失败，原因与本质问题相关",
          },
        ],
        causal_rules: [
          {
            id: "cr-1",
            trigger_action: "直接建设大屏",
            consequence_path: "premature",
            short_term: "大屏建成但数据仍然不一致，用户需要手工比对",
            medium_term: "用户放弃使用大屏，编码问题依然存在",
            counterfactual: "如果先解决编码问题，大屏价值会大幅提升",
          },
        ],
        role_interests: [
          {
            role: "运营部负责人",
            stated_position: "需要一个数据大屏",
            true_interest: "减少每周6小时的数据整理时间",
            information_boundary: "不了解技术实现复杂度，只知道自己的时间成本",
          },
        ],
        reveal_conditions: [
          { id: "rc-users", trigger: "谁在用", reveals: ["wf-1"] },
          { id: "rc-workflow", trigger: "现在怎么做", reveals: ["wf-2"] },
          { id: "rc-alt", trigger: "试过什么", reveals: ["wf-3"] },
          { id: "rc-workflow2", trigger: "工作流程", reveals: ["wf-2"] },
          { id: "rc-users2", trigger: "使用者", reveals: ["wf-1"] },
        ],
      },
      behavior_anchors: {
        premature_commitment: {
          level: 1,
          description: "未调查直接给出大屏方案",
          observable_indicators: ["未问使用者", "未问当前工作流", "未问替代方案"],
          anti_examples: ["先建大屏再说", "用户肯定需要"],
        },
        adequate_investigation: {
          level: 3,
          description: "调查了三个核心维度再做判断",
          observable_indicators: ["明确了使用频率", "了解了当前工作流", "询问了替代方案"],
          anti_examples: [],
        },
        model_behavior: {
          level: 5,
          description: "识别出编码不一致是根因，建议先治理数据再考虑大屏",
          observable_indicators: ["发现编码问题", "重新定义解决方案范围", "量化时间成本"],
          anti_examples: [],
        },
      },
      transfer_surface_differences: [],
      approved_by: "wu908",
      source_references: ["行为主张 #15"],
      created_at: "2026-07-23T00:00:00.000Z",
    },
  },
  {
    world_id: "world-2",
    title: "用户投诉处理系统重构",
    domain: "product",
    transfer_role: "intervention",
    description: "客服团队反映投诉处理系统效率低，希望进行系统重构。",
    version: {
      world_id: "world-2",
      version: "1.0.0",
      transfer_role: "intervention",
      trigger_statement:
        "客服主管找到你，说现有投诉处理系统让客服效率很低，希望你主导重构项目。",
      visible_facts: [
        "客服团队20人",
        "每天处理约200个投诉工单",
        "系统已使用3年",
      ],
      immutable_rules: {
        hidden_facts: [
          {
            id: "w2-f1",
            content: "80%的投诉集中在3类问题，其余系统功能几乎不用",
            reveal_condition_id: "w2-rc-pareto",
            causal_significance: "集中资源解决高频问题比全面重构ROI高",
          },
          {
            id: "w2-f2",
            content: "客服每次查询需要在4个系统间切换，平均每单增加8分钟",
            reveal_condition_id: "w2-rc-workflow",
            causal_significance: "核心痛点是多系统切换，不是系统功能本身",
          },
          {
            id: "w2-f3",
            content: "上次重构因需求不清晰导致项目延期6个月并最终烂尾",
            reveal_condition_id: "w2-rc-history",
            causal_significance: "历史失败案例提示重构风险极高",
          },
        ],
        causal_rules: [
          {
            id: "w2-cr-1",
            trigger_action: "直接立项重构",
            consequence_path: "premature",
            short_term: "项目范围不清晰，需求反复变更",
            medium_term: "项目延期或烂尾，客服效率问题未解决",
            counterfactual: "如果先做流程优化（减少系统切换），成本低且见效快",
          },
        ],
        role_interests: [
          {
            role: "客服主管",
            stated_position: "需要重构投诉处理系统",
            true_interest: "客服效率提升，每单处理时间减少",
            information_boundary: "不了解技术复杂度，也未量化过具体痛点",
          },
        ],
        reveal_conditions: [
          { id: "w2-rc-pareto", trigger: "哪类投诉", reveals: ["w2-f1"] },
          { id: "w2-rc-workflow", trigger: "操作流程", reveals: ["w2-f2"] },
          { id: "w2-rc-workflow2", trigger: "每单要多久", reveals: ["w2-f2"] },
          { id: "w2-rc-history", trigger: "之前", reveals: ["w2-f3"] },
          { id: "w2-rc-history2", trigger: "历史", reveals: ["w2-f3"] },
        ],
      },
      behavior_anchors: {
        premature_commitment: {
          level: 1,
          description: "未调查直接同意重构立项",
          observable_indicators: ["未问投诉分布", "未问当前操作流程", "未问历史改造记录"],
          anti_examples: [],
        },
        adequate_investigation: {
          level: 3,
          description: "调查了投诉分布、操作流程和历史改造背景",
          observable_indicators: ["了解了80/20分布", "了解了多系统切换问题", "了解了上次烂尾原因"],
          anti_examples: [],
        },
        model_behavior: {
          level: 5,
          description: "建议先做轻量流程优化代替全面重构",
          observable_indicators: ["量化时间损耗", "识别高频场景", "建议分阶段验证"],
          anti_examples: [],
        },
      },
      transfer_surface_differences: ["服务业场景而非产品研发", "存量系统改造而非新建"],
      approved_by: "wu908",
      source_references: ["行为主张 #15"],
      created_at: "2026-07-23T00:00:00.000Z",
    },
  },
  {
    world_id: "world-3",
    title: "供应链采购系统升级",
    domain: "ops",
    transfer_role: "transfer_test",
    description: "采购部门希望升级采购系统，表面上与前两个世界完全不同。",
    version: {
      world_id: "world-3",
      version: "1.0.0",
      transfer_role: "transfer_test",
      trigger_statement:
        "采购部负责人找到你（产品负责人），说现有采购系统跟不上业务增长，希望你帮忙评估是否需要升级或换系统。",
      visible_facts: [
        "公司采购订单量过去一年增长了3倍",
        "采购系统已用了5年",
        "采购部共15人",
      ],
      immutable_rules: {
        hidden_facts: [
          {
            id: "w3-f1",
            content: "90%的采购订单集中在5个供应商，其余供应商几乎不动",
            reveal_condition_id: "w3-rc-pareto",
            causal_significance: "高度集中的供应商意味着换系统不能解决供应商管理问题",
          },
          {
            id: "w3-f2",
            content: "主要瓶颈是审批流程要经过7个层级，每单平均等待3天",
            reveal_condition_id: "w3-rc-workflow",
            causal_significance: "核心痛点是流程审批而非系统能力",
          },
          {
            id: "w3-f3",
            content: "部门曾尝试Excel + 邮件简化审批，但因合规要求被叫停",
            reveal_condition_id: "w3-rc-alt",
            causal_significance: "合规约束限制了简单替代方案，需要在合规框架内寻找解法",
          },
        ],
        causal_rules: [
          {
            id: "w3-cr-1",
            trigger_action: "直接推荐换系统",
            consequence_path: "premature",
            short_term: "选型周期长，审批流程问题换系统后依然存在",
            medium_term: "新系统上线后用户发现痛点依然未解，ROI极低",
            counterfactual: "如果先优化审批层级再考虑系统，成本低且直击痛点",
          },
        ],
        role_interests: [
          {
            role: "采购部负责人",
            stated_position: "需要升级或更换采购系统",
            true_interest: "缩短采购周期，减少等待时间",
            information_boundary: "将审批慢归因于系统，而非流程本身",
          },
        ],
        reveal_conditions: [
          { id: "w3-rc-pareto", trigger: "供应商", reveals: ["w3-f1"] },
          { id: "w3-rc-workflow", trigger: "审批", reveals: ["w3-f2"] },
          { id: "w3-rc-workflow2", trigger: "多久", reveals: ["w3-f2"] },
          { id: "w3-rc-alt", trigger: "试过", reveals: ["w3-f3"] },
          { id: "w3-rc-alt2", trigger: "以前怎么", reveals: ["w3-f3"] },
        ],
      },
      behavior_anchors: {
        premature_commitment: {
          level: 1,
          description: "未调查直接推荐换系统",
          observable_indicators: ["未问供应商集中度", "未问审批流程", "未问历史替代方案"],
          anti_examples: [],
        },
        adequate_investigation: {
          level: 3,
          description: "调查了采购分布、审批流程和历史替代方案",
          observable_indicators: ["了解了供应商集中情况", "了解了审批层级和耗时", "了解了合规约束"],
          anti_examples: [],
        },
        model_behavior: {
          level: 5,
          description: "识别出审批流程是根因，建议在合规框架内优化审批而非换系统",
          observable_indicators: ["量化等待时间", "区分系统问题和流程问题", "考虑合规约束"],
          anti_examples: [],
        },
      },
      transfer_surface_differences: [
        "供应链/采购领域而非产品/研发",
        "B2B采购场景而非用户产品",
        "合规约束是新增限制条件",
      ],
      approved_by: "wu908",
      source_references: ["行为主张 #15"],
      created_at: "2026-07-23T00:00:00.000Z",
    },
  },
];

/** 按 world_id 查找演示世界 */
export function getDemoWorld(worldId: string): WorldSeed | undefined {
  return DEMO_WORLDS.find((w) => w.world_id === worldId);
}
