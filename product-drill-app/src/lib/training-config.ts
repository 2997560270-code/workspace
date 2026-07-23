export type SkillId = "role" | "workflow" | "impact" | "alternative" | "metric";

export type SkillDefinition = {
  id: SkillId;
  name: string;
  description: string;
  practiceTip: string;
};

export type TrainingScenario = {
  id: string;
  title: string;
  shortTitle: string;
  industry: string;
  skillId: SkillId;
  difficulty: "基础" | "标准" | "严格";
  duration: number;
  role: string;
  context: string;
  opening: string;
  hiddenFacts: Record<SkillId, string>;
  briefing: string[];
};

export const SKILLS: SkillDefinition[] = [
  {
    id: "role",
    name: "用户与角色识别",
    description: "区分使用者、决策者、付费者与问题承担者。",
    practiceTip: "先问谁每天使用、谁做决定、谁承担结果。"
  },
  {
    id: "workflow",
    name: "场景与当前流程",
    description: "还原问题发生前后的真实步骤，而不是停留在需求表述。",
    practiceTip: "请用户带你走一遍现在是怎么完成这件事的。"
  },
  {
    id: "impact",
    name: "问题影响与根因",
    description: "确认问题频率、严重程度、业务影响和真正原因。",
    practiceTip: "追问多久发生一次、不解决会造成什么后果。"
  },
  {
    id: "alternative",
    name: "现有替代方案",
    description: "理解用户当前如何绕过问题，以及为什么仍然不满意。",
    practiceTip: "不要假设用户什么都没做，先问现在用什么方法解决。"
  },
  {
    id: "metric",
    name: "成功指标",
    description: "把模糊的“更好”转成能够验证的行为或业务结果。",
    practiceTip: "问什么变化能证明问题真的被解决。"
  }
];

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: "dashboard-request",
    title: "客户说：我们需要一个数据大屏",
    shortTitle: "数据大屏需求",
    industry: "企业服务",
    skillId: "workflow",
    difficulty: "标准",
    duration: 8,
    role: "连锁零售运营负责人",
    context: "总部每周需要汇总 48 家门店的经营数据，运营负责人提出建设数据大屏。",
    opening: "我们现在看经营情况太麻烦了，能不能给我们做一个数据大屏？最好所有指标都放上去。",
    hiddenFacts: {
      role: "真正每天整理数据的是区域运营，老板只在周会上看汇总结论，门店店长负责补录异常数据。",
      workflow: "区域运营每周从三个系统导出 Excel，再花约 6 小时合并、检查并制作周报。",
      impact: "主要问题不是没有图表，而是不同系统的门店编码不一致，导致约 15% 的数据需要人工核对。",
      alternative: "团队已经使用固定 Excel 模板和 BI 免费版，图表本身基本够用。",
      metric: "如果能把周报准备时间从 6 小时降到 1 小时，并把异常核对减少一半，就算成功。"
    },
    briefing: ["客户主动提出了一个明确功能", "你需要判断功能背后的真实问题", "本轮重点：还原当前流程"]
  },
  {
    id: "ai-mandate",
    title: "老板说：我们的产品必须加 AI",
    shortTitle: "老板要求加 AI",
    industry: "协同办公",
    skillId: "impact",
    difficulty: "标准",
    duration: 7,
    role: "协同办公产品业务负责人",
    context: "管理层担心产品落后于竞品，希望快速发布 AI 功能。",
    opening: "竞品都在上 AI，我们下个季度也必须有一个 AI 功能，你们尽快给方案吧。",
    hiddenFacts: {
      role: "老板是推动者，但真正使用产品的是中小企业行政和项目负责人。",
      workflow: "用户目前最常用的是任务分配、审批和会议记录，AI 需求尚未经过用户验证。",
      impact: "管理层的核心焦虑是销售演示缺少新亮点，而不是现有用户效率明显下降。",
      alternative: "销售团队目前会用第三方 AI 工具生成会议摘要，再复制到产品中。",
      metric: "管理层希望 AI 能提高试用转付费率，但尚未定义目标幅度。"
    },
    briefing: ["需求来自管理层", "不要默认技术方案就是问题答案", "本轮重点：确认问题影响和动机"]
  },
  {
    id: "export-slow",
    title: "用户投诉：导出报表太慢",
    shortTitle: "报表导出慢",
    industry: "SaaS",
    skillId: "role",
    difficulty: "基础",
    duration: 6,
    role: "客户成功经理",
    context: "多个客户反馈月底导出经营报表耗时很长。",
    opening: "最近好几个客户都在投诉报表导出太慢，这个问题优先级必须提上去。",
    hiddenFacts: {
      role: "提出投诉的是管理员，但真正等待报表的是财务分析师，审批人只接收最终文件。",
      workflow: "财务每月最后一天选择全量数据导出，通常重复点击并同时开启多个任务。",
      impact: "大客户需要等待 20 到 40 分钟，偶尔会因重复任务失败，影响月度关账。",
      alternative: "部分客户会拆分日期范围导出，再手工合并文件。",
      metric: "95% 的标准导出在 5 分钟内完成，且重复任务失败率低于 1%。"
    },
    briefing: ["投诉来自二手信息", "需要区分反馈者和真实使用者", "本轮重点：识别角色"]
  },
  {
    id: "reminder-feature",
    title: "用户说：帮我做一个提醒功能",
    shortTitle: "提醒功能",
    industry: "零售运营",
    skillId: "alternative",
    difficulty: "基础",
    duration: 6,
    role: "门店店长",
    context: "门店经常有临期商品未及时处理，店长希望增加提醒。",
    opening: "我们经常忘记处理快过期的商品，系统加个提醒就行，最好每天自动提醒。",
    hiddenFacts: {
      role: "店长负责处理，但商品日期主要由收货员工录入，区域经理关心损耗金额。",
      workflow: "员工收货时手写日期，闭店前店长凭经验检查临期商品。",
      impact: "问题集中在乳制品和鲜食，每月平均造成约 3000 元损耗。",
      alternative: "门店已经使用微信群和纸质临期表提醒，但高峰期经常漏填。",
      metric: "临期商品漏处理数量下降 60%，且员工每天新增操作不超过 3 分钟。"
    },
    briefing: ["用户已经提出了解决方案", "重点理解现有替代方式为什么失败", "本轮重点：替代方案"]
  },
  {
    id: "activation-drop",
    title: "新用户激活率连续两周下降",
    shortTitle: "激活率下降",
    industry: "效率工具",
    skillId: "metric",
    difficulty: "严格",
    duration: 10,
    role: "增长负责人",
    context: "产品改版后新用户激活率下降，团队对原因存在不同判断。",
    opening: "这两周激活率一直往下掉，我倾向于把新手引导再做长一点，多解释几个核心功能。",
    hiddenFacts: {
      role: "增长负责人关注激活率，真正经历流程的是首次创建项目的新用户，销售导入用户另有路径。",
      workflow: "改版后用户必须先邀请成员，才能创建第一个项目；过去可以跳过邀请。",
      impact: "个人用户下降最明显，企业销售导入用户基本不受影响。",
      alternative: "部分用户会关闭页面，之后通过帮助中心直接进入模板库。",
      metric: "核心目标是首次访问 24 小时内成功创建项目，而不是完成所有引导步骤。"
    },
    briefing: ["团队已经提出解决方案", "数据口径可能掩盖用户分群", "本轮重点：定义成功指标"]
  },
  {
    id: "custom-request",
    title: "高价值客户要求定制审批流",
    shortTitle: "大客户定制",
    industry: "B2B SaaS",
    skillId: "impact",
    difficulty: "严格",
    duration: 10,
    role: "大客户销售总监",
    context: "一个重要客户把定制审批流作为续约条件，销售要求产品团队立即承诺。",
    opening: "这个客户占我们年度收入很大一部分，他们说没有多级审批就不续约，你们必须这个月排进去。",
    hiddenFacts: {
      role: "销售总监传递需求，客户采购提出续约条件，真正使用审批的是区域财务团队。",
      workflow: "客户目前通过邮件完成特殊审批，标准审批仍在系统内完成。",
      impact: "特殊审批每月约 20 次，但续约合同金额较高，销售担心竞争对手切入。",
      alternative: "客户可使用现有条件分支加人工复核，但配置复杂且缺少审计提示。",
      metric: "需要同时验证续约风险、功能复用客户数和研发维护成本，不能只看单一客户收入。"
    },
    briefing: ["需求带有强烈商业压力", "需要区分客户价值与产品复用价值", "本轮重点：量化影响与决策风险"]
  }
];

export const DEFAULT_SCENARIO_ID = TRAINING_SCENARIOS[0].id;

export function getScenario(id: string): TrainingScenario {
  return TRAINING_SCENARIOS.find((scenario) => scenario.id === id) ?? TRAINING_SCENARIOS[0];
}

export function getSkill(id: SkillId): SkillDefinition {
  return SKILLS.find((skill) => skill.id === id) ?? SKILLS[0];
}
