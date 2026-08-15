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
  },
  {
    id: "ai-support-inaccuracy",
    title: "客服说：AI 回答经常不准确",
    shortTitle: "AI 客服不准确",
    industry: "客户支持",
    skillId: "workflow",
    difficulty: "标准",
    duration: 8,
    role: "客户支持负责人",
    context: "AI 客服上线后，支持团队收到回答不准确的反馈，团队正在考虑扩大知识库。",
    opening: "最近客户总说 AI 客服答得不准，我们先把知识库再扩充一轮吧。",
    hiddenFacts: {
      role: "支持负责人关注工单量，真正使用 AI 回复的是一线客服，最终承担错误后果的是客户和售后团队。",
      workflow: "AI 先根据帮助中心草稿生成答案，客服通常直接发送，只有高风险工单才会人工复核。",
      impact: "不准确主要集中在退款和权限问题，错误回答会导致客户重复提交工单，但普通使用说明的准确率并不低。",
      alternative: "客服已经维护一份内部纠错清单，并会在群聊中互相提醒，但更新没有同步回知识库。",
      metric: "应分别追踪高风险问题的人工接管率、重复工单率和正确解决率，而不是只看总体满意度。"
    },
    briefing: ["反馈来自一线客服和客户的混合信息", "准确率可能因问题类型而不同", "本轮重点：还原回答流程"]
  },
  {
    id: "training-completion-drop",
    title: "企业培训：员工总是学到一半",
    shortTitle: "培训完成率低",
    industry: "企业培训",
    skillId: "role",
    difficulty: "标准",
    duration: 8,
    role: "企业学习负责人",
    context: "企业客户购买了在线培训，但员工课程完成率连续下降，管理者要求增加提醒。",
    opening: "员工总是学到一半就不学了，我们需要更强的提醒和排行榜来推动完成。",
    hiddenFacts: {
      role: "学习负责人负责采购和汇报，实际学习者是轮班员工，直属主管决定是否给他们留出学习时间。",
      workflow: "员工在移动端利用碎片时间学习，课程中途退出后没有记录下次应从哪一节继续。",
      impact: "完成率最低的是夜班和外勤岗位，强制提醒反而增加了主管的投诉，合规课程的通过率仍然稳定。",
      alternative: "部分团队会把课程拆成短链接发到群里，由主管口头提醒，但无法确认员工是否真正理解。",
      metric: "应关注目标岗位在规定周期内完成并通过关键测验的比例，而不是所有员工的平均打开率。"
    },
    briefing: ["购买者、学习者和推动者不是同一角色", "完成率下降存在明确人群差异", "本轮重点：识别真实使用者"]
  },
  {
    id: "complaints-with-usage",
    title: "用户投诉很多，但功能使用率并不低",
    shortTitle: "投诉与使用率冲突",
    industry: "项目管理",
    skillId: "impact",
    difficulty: "严格",
    duration: 10,
    role: "项目管理产品负责人",
    context: "客户成功团队汇总了大量功能投诉，但数据却显示相关功能仍被高频使用。",
    opening: "这个功能的投诉太多了，大家都觉得应该重做，可使用率明明还在上涨。",
    hiddenFacts: {
      role: "投诉主要由项目负责人提交，实际高频操作的是协作者，管理层只关注项目是否按期交付。",
      workflow: "用户每天从任务列表进入功能，完成批量更新后还要逐项确认，流程在移动端尤其繁琐。",
      impact: "投诉集中在批量操作和权限提示，用户仍然使用是因为没有替代入口，流失风险尚未体现在当前使用率中。",
      alternative: "团队通过浏览器脚本和导出后再导入的方式绕过限制，但这些做法没有被产品埋点记录。",
      metric: "需要同时观察任务完成耗时、绕行比例、错误率和留存，不能用单一使用率判断功能健康度。"
    },
    briefing: ["使用率和满意度指向不同事实", "高频使用不等于体验良好", "本轮重点：确认问题影响与根因"]
  },
  {
    id: "sales-lost-deals",
    title: "销售说：缺这个功能所以丢单",
    shortTitle: "销售认为缺功能丢单",
    industry: "销售管理",
    skillId: "alternative",
    difficulty: "严格",
    duration: 9,
    role: "销售副总裁",
    context: "销售团队把近期几次丢单归因于缺少一个报表功能，产品团队需要判断是否投入。",
    opening: "最近丢掉的几个客户都问过这个报表，我们必须马上补上，否则还会继续丢单。",
    hiddenFacts: {
      role: "销售副总裁汇总丢单原因，实际评估产品的是数据平台主管，采购和安全团队也会参与决策。",
      workflow: "销售演示时展示静态报表样例，客户进入试用后才会验证权限、数据接入和交付周期。",
      impact: "只有一笔丢单明确提到报表，其余客户卡在安全审查和实施资源；报表需求来自少数大型客户。",
      alternative: "销售可以用导出模板和专业服务完成临时报表，但交付成本高且无法实时更新。",
      metric: "应验证目标客户中该能力的真实采用率、对赢单的边际影响和可复用程度，再决定投入规模。"
    },
    briefing: ["丢单归因来自二手总结", "现有替代方案可能已经能满足部分客户", "本轮重点：判断替代方案和投入风险"]
  },
  {
    id: "low-feature-adoption",
    title: "新功能上线后，使用率一直上不去",
    shortTitle: "功能使用率低",
    industry: "团队协作",
    skillId: "metric",
    difficulty: "标准",
    duration: 8,
    role: "产品增长经理",
    context: "团队上线了新的协作视图，但月活使用率低于预期，推广团队建议增加入口曝光。",
    opening: "新视图已经上线一个月了，使用率还是很低，我们把入口放到首页最显眼的位置吧。",
    hiddenFacts: {
      role: "增长经理关注点击率，真正需要视图的是跨团队项目负责人，普通成员只有被分配任务时才会看到。",
      workflow: "用户必须先完成项目模板配置才能使用新视图，首次进入时默认没有可展示的数据。",
      impact: "使用率低主要发生在新建项目，已有成熟项目的使用率较高；增加入口曝光没有改善首次激活。",
      alternative: "团队会在项目复盘时导出数据到表格中协作，虽然麻烦但不需要额外配置。",
      metric: "应以目标项目完成配置后在关键任务中持续使用的比例为主指标，并拆分首次激活和重复使用。"
    },
    briefing: ["低使用率可能是激活问题而非认知问题", "需要拆分不同项目阶段的数据", "本轮重点：定义可验证成功指标"]
  },
  {
    id: "enterprise-renewal-drop",
    title: "企业客户续费率下降",
    shortTitle: "企业续费下降",
    industry: "企业软件",
    skillId: "impact",
    difficulty: "严格",
    duration: 10,
    role: "客户业务副总裁",
    context: "企业客户续费率连续两个季度下降，团队争论是应该降价还是补充功能。",
    opening: "续费率已经连续两个季度下降了，我们先给大客户打折，再承诺几个新功能吧。",
    hiddenFacts: {
      role: "业务副总裁负责续费数字，合同签署者是采购负责人，日常使用和价值评估由业务部门主管完成。",
      workflow: "客户通常在续费前两个月收到使用报告，但报告只展示登录和功能次数，没有对应业务结果。",
      impact: "流失客户集中在未完成上线的团队，已深度使用的客户对价格不敏感；降价无法解决未落地问题。",
      alternative: "客户成功团队会提供额外培训和人工报表，但服务依赖个人，难以规模化复制。",
      metric: "应区分上线完成率、关键流程覆盖率、续费意愿和折扣成本，验证哪项变化真正影响续费。"
    },
    briefing: ["续费是多角色、多阶段结果", "价格和功能只是可能原因", "本轮重点：拆解影响链条和根因"]
  }
];

export const DEFAULT_SCENARIO_ID = TRAINING_SCENARIOS[0].id;

export function getScenario(id: string): TrainingScenario {
  return TRAINING_SCENARIOS.find((scenario) => scenario.id === id) ?? TRAINING_SCENARIOS[0];
}

export function getSkill(id: SkillId): SkillDefinition {
  return SKILLS.find((skill) => skill.id === id) ?? SKILLS[0];
}
