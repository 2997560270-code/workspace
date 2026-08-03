-- Approved Phase 1 behavior claim (#15) and governed worlds (#8).
-- Existing world versions remain immutable and are not deleted or overwritten.

alter table public.causal_world_versions
  add column if not exists available_actions jsonb not null default '[]'::jsonb;

alter table public.causal_world_versions
  add column if not exists pressure_context text not null default '';

insert into public.causal_worlds (
  id, target_habit, current_version, domain, governance_status
) values
  ('world-1-ai-summary', 'premature_solution_commitment', '2.0.0', 'B2C / AI 工具产品', 'approved'),
  ('world-2-enterprise-renewal', 'premature_solution_commitment', '2.0.0', 'B2B SaaS / 协作工具', 'approved'),
  ('world-3-growth-decline', 'premature_solution_commitment', '2.0.0', 'B2C / 设计工具', 'approved')
on conflict (id) do update set
  target_habit = excluded.target_habit,
  current_version = excluded.current_version,
  domain = excluded.domain,
  governance_status = excluded.governance_status,
  updated_at = now();

insert into public.causal_world_versions (
  world_id,
  version,
  transfer_role,
  trigger_statement,
  visible_facts,
  available_actions,
  pressure_context,
  immutable_rules,
  behavior_anchors,
  transfer_surface_differences,
  approved_by,
  source_references,
  created_at
) values
(
  'world-1-ai-summary',
  '2.0.0',
  'calibration',
  'CEO 刚从投资人路演回来，直接找到你说：我承诺过投资人，我们下个季度会上线 AI 摘要功能。你们能做吗？',
  $json$[
    "CEO 刚完成一轮融资路演，情绪高涨",
    "当前产品有一个基础摘要功能，入口在设置页深处",
    "本季度工程团队还有两个正在进行的项目"
  ]$json$::jsonb,
  $json$[
    {"id":"w1-ask-audience","label":"询问演示对象和反馈来源","category":"investigate"},
    {"id":"w1-request-usage","label":"请求现有摘要功能使用数据","category":"request_data"},
    {"id":"w1-check-projects","label":"核查工程、法务和在建项目","category":"investigate"},
    {"id":"w1-clarify-goal","label":"澄清 CEO 最终要解决的问题","category":"investigate"},
    {"id":"w1-commit","label":"提交是否承诺及下一步行动","category":"commit"}
  ]$json$::jsonb,
  '内部权威与融资叙事压力',
  $json${
    "model_forbidden_to_modify": true,
    "hidden_facts": [
      {"id":"HF-1-01","content":"CEO 演示的对象是技术极客天使投资人，不代表核心用户群","reveal_condition_id":"RC-1-01","causal_significance":"投资人反馈不能替代核心用户证据"},
      {"id":"HF-1-02","content":"现有摘要功能使用率仅 12%，根本问题是功能入口路径，而非摘要能力","reveal_condition_id":"RC-1-02","causal_significance":"使用数据指向入口问题而非新能力缺口"},
      {"id":"HF-1-03","content":"基础设施团队已在做 LLM 接入层，贸然承诺会产生双轨冲突","reveal_condition_id":"RC-1-03","causal_significance":"在建工程形成交付依赖和重复建设风险"},
      {"id":"HF-1-04","content":"该功能涉及数据隐私合规审查，法务周期至少 6 周","reveal_condition_id":"RC-1-04","causal_significance":"合规周期使直接排期承诺不可信"},
      {"id":"HF-1-05","content":"CEO 的真实诉求是能向投资人讲可信的 AI 故事，不是某个固定功能形态","reveal_condition_id":"RC-1-05","causal_significance":"真实目标允许更小的解决路径"}
    ],
    "causal_rules": [
      {"id":"CR-1-A","trigger_action":"未调查任何隐藏事实就承诺下季度上线 AI 摘要","consequence_path":"premature","short_term":"CEO 满意，会议快速结束","medium_term":"工程发现双轨和合规问题，法务叫停，季度目标落空","long_term":"功能延期且 PM 公信力受损","counterfactual":"先核查使用数据和真实目标，再提出分层路径"},
      {"id":"CR-1-B","trigger_action":"调查使用数据和 CEO 真实目标后再做承诺","consequence_path":"investigated","short_term":"CEO 对延迟承诺产生轻微摩擦","medium_term":"团队形成入口优化与 AI 摘要 MVP 的分层方案","long_term":"季度内交付更小且合规的 MVP","counterfactual":"直接承诺会在执行期暴露双轨和合规约束"}
    ],
    "role_interests": [
      {"role":"CEO","stated_position":"下季度上线 AI 摘要功能","true_interest":"让投资叙事可信","information_boundary":"不知道现有摘要使用率和工程双轨风险"},
      {"role":"工程团队","stated_position":"需要评估可行性","true_interest":"避免重复建设和计划冲突","information_boundary":"不知道 CEO 的真实叙事目标"},
      {"role":"核心用户","stated_position":"尚未参与本次讨论","true_interest":"更容易发现和使用已有摘要能力","information_boundary":"不知道团队正在做本次承诺"}
    ],
    "reveal_conditions": [
      {"id":"RC-1-01","trigger":"向谁演示","reveals":["HF-1-01"]},
      {"id":"RC-1-02","trigger":"现有摘要","reveals":["HF-1-02"]},
      {"id":"RC-1-03","trigger":"在建项目","reveals":["HF-1-03"]},
      {"id":"RC-1-04","trigger":"合规","reveals":["HF-1-04"]},
      {"id":"RC-1-05","trigger":"最终要解决","reveals":["HF-1-05"]}
    ]
  }$json$::jsonb,
  $json${
    "premature_commitment":{"level":1,"description":"未调查背景，在前两轮内承诺功能或时间节点","observable_indicators":["未核查使用数据","未澄清真实目标","直接给出上线排期"],"anti_examples":["先核查现有摘要使用数据"]},
    "adequate_investigation":{"level":3,"description":"承诺前调查当前数据和真实目标","observable_indicators":["覆盖当前工作流","确认问题后果","了解现有替代路径"],"anti_examples":["只询问功能如何实现"]},
    "model_behavior":{"level":5,"description":"覆盖三个发现维度并提出有前提的分层方案","observable_indicators":["识别入口根因","核查双轨依赖","说明方案前提"],"anti_examples":["把投资人偏好当作核心用户需求"]}
  }$json$::jsonb,
  '[]'::jsonb,
  'product-owner',
  '["GitHub Issue #15 v0.3","GitHub Issue #8 v1.0"]'::jsonb,
  '2026-08-03T00:00:00Z'
),
(
  'world-2-enterprise-renewal',
  '2.0.0',
  'intervention',
  'CSM 在 Slack 发消息：TechCorp 合同下月到期，他们说除非我们做 SSO 和权限管理，否则不续签。这是我们 ARR 最大的单一客户，年费 120 万。',
  '["TechCorp 是 500 人规模企业，年费 120 万，是最大单一客户","CSM 已和对方沟通过两轮，并称 IT 部门把 SSO 视为合规要求","竞品 A 已支持 SSO，竞品 B 不支持"]'::jsonb,
  $json$[
    {"id":"w2-check-segments","label":"查看客户与用户分布","category":"request_data"},
    {"id":"w2-check-usage","label":"查看 TechCorp 实际使用数据","category":"request_data"},
    {"id":"w2-read-source","label":"查看客户原始反馈记录","category":"investigate"},
    {"id":"w2-check-alternative","label":"询问客户不续签时的替代方案","category":"investigate"},
    {"id":"w2-commit","label":"提交续约与产品行动决策","category":"commit"}
  ]$json$::jsonb,
  '最大客户续约与 ARR 压力',
  $json${
    "model_forbidden_to_modify": true,
    "hidden_facts": [
      {"id":"HF-2-01","content":"产品 80% 用户来自 20-100 人团队，SSO 对核心用户群几乎没有感知价值","reveal_condition_id":"RC-2-01","causal_significance":"单一大客户需求与核心市场价值存在冲突"},
      {"id":"HF-2-02","content":"竞品 B 不支持 SSO，TechCorp 真正的替代方案是内部自建工具，而非迁移竞品","reveal_condition_id":"RC-2-02","causal_significance":"真实替代方案改变续约风险和谈判空间"},
      {"id":"HF-2-03","content":"TechCorp 活跃用户数过去 6 个月下降 40%，根本问题是 onboarding 失败","reveal_condition_id":"RC-2-03","causal_significance":"续约风险主要来自激活问题"},
      {"id":"HF-2-04","content":"CSM 转述经过情绪放大，客户原话是 IT 部门建议有 SSO 会更好，并非硬性条件","reveal_condition_id":"RC-2-04","causal_significance":"二手转述夸大了方案紧迫性"},
      {"id":"HF-2-05","content":"为该客户定制会触发连锁效应，另外 3 个大客户也在观望","reveal_condition_id":"RC-2-05","causal_significance":"一次定制承诺会改变后续客户预期"}
    ],
    "causal_rules": [
      {"id":"CR-2-A","trigger_action":"未核查使用数据和原始反馈就承诺开发 SSO","consequence_path":"premature","short_term":"CSM 压力缓解","medium_term":"工程资源被占用，中小客户功能延期","long_term":"TechCorp 仍因激活率问题流失","counterfactual":"先核查客户使用数据和原始反馈"},
      {"id":"CR-2-B","trigger_action":"调查使用数据和信息来源后再承诺","consequence_path":"investigated","short_term":"CSM 担心决策被拖延","medium_term":"团队先改善 onboarding 并给出 SSO 路线图","long_term":"激活率回升并支持续约","counterfactual":"只交付 SSO 无法解决客户活跃度根因"}
    ],
    "role_interests": [
      {"role":"CSM","stated_position":"必须尽快承诺 SSO","true_interest":"规避个人续约 KPI 风险","information_boundary":"没有核查客户真实使用数据"},
      {"role":"TechCorp IT","stated_position":"需要 SSO 满足合规","true_interest":"让合规诉求得到回应","information_boundary":"不知道内部自建工具的完整成本"},
      {"role":"TechCorp 业务方","stated_position":"尚未直接参与讨论","true_interest":"解决 onboarding 问题","information_boundary":"不知道 IT 与 CSM 的谈判内容"}
    ],
    "reveal_conditions": [
      {"id":"RC-2-01","trigger":"用户分布","reveals":["HF-2-01"]},
      {"id":"RC-2-02","trigger":"不续签","reveals":["HF-2-02"]},
      {"id":"RC-2-03","trigger":"使用数据","reveals":["HF-2-03"]},
      {"id":"RC-2-04","trigger":"原始反馈","reveals":["HF-2-04"]},
      {"id":"RC-2-05","trigger":"其他客户","reveals":["HF-2-05"]}
    ]
  }$json$::jsonb,
  $json${
    "premature_commitment":{"level":1,"description":"未核查信息就在前两轮承诺 SSO","observable_indicators":["只依据二手转述","未调查客户活跃度","直接给出排期"],"anti_examples":["查看客户原始反馈"]},
    "adequate_investigation":{"level":3,"description":"调查客户使用数据和信息来源","observable_indicators":["识别 onboarding 问题","核对客户原话","了解真实替代方案"],"anti_examples":["只讨论 SSO 功能细节"]},
    "model_behavior":{"level":5,"description":"识别连锁效应并提出分层方案","observable_indicators":["识别核心市场影响","说明定制连锁效应","承诺附带条件"],"anti_examples":["把单一客户等同于全体市场"]}
  }$json$::jsonb,
  '["外部客户压力","B2B 续约场景","金额与合规谈判"]'::jsonb,
  'product-owner',
  '["GitHub Issue #15 v0.3","GitHub Issue #8 v1.0"]'::jsonb,
  '2026-08-03T00:00:00Z'
),
(
  'world-3-growth-decline',
  '2.0.0',
  'transfer_test',
  '增长团队周会上，数据负责人展示本月 DAU 下降 8%，立刻有人说：Figma 刚上线了 AI 设计建议，我们必须跟上，不然用户会流失。',
  '["本月 DAU 环比下降 8%，为过去一年最大单月跌幅","Figma 上周发布 AI 设计建议功能，Product Hunt 评分 4.2/5","增长团队已在 Slack 形成必须跟进的共识"]'::jsonb,
  $json$[
    {"id":"w3-check-cohort","label":"查看 DAU 下降的用户群分布","category":"request_data"},
    {"id":"w3-check-competitor","label":"核查竞品功能真实使用数据","category":"request_data"},
    {"id":"w3-check-effort","label":"评估工程改造范围","category":"investigate"},
    {"id":"w3-interview","label":"核查流失访谈和现有替代方案","category":"investigate"},
    {"id":"w3-commit","label":"提交增长问题行动决策","category":"commit"}
  ]$json$::jsonb,
  '增长指标下跌与团队竞品焦虑；本世界不得提供决策前提示',
  $json${
    "model_forbidden_to_modify": true,
    "hidden_facts": [
      {"id":"HF-3-01","content":"Cohort 分析显示 DAU 下降来自 30 天内新注册用户，30 日留存从 45% 降至 28%，是 onboarding 问题","reveal_condition_id":"RC-3-01","causal_significance":"指标分群后指向新用户激活"},
      {"id":"HF-3-02","content":"Figma AI 功能 7 日使用率不足 15%，用户反馈其建议不准确","reveal_condition_id":"RC-3-02","causal_significance":"竞品发布热度不能证明稳定用户价值"},
      {"id":"HF-3-03","content":"实现同类 AI 建议需要重构核心编辑器架构，预计占用两个季度","reveal_condition_id":"RC-3-03","causal_significance":"复制竞品的机会成本高"},
      {"id":"HF-3-04","content":"团队要求复制竞品背后是对是否落后的焦虑，不是基于用户研究的决策","reveal_condition_id":"RC-3-04","causal_significance":"内部共识属于压力信号而非用户证据"},
      {"id":"HF-3-05","content":"团队没有联系过流失用户，当前所有原因判断都来自内部推断","reveal_condition_id":"RC-3-05","causal_significance":"缺少真实问题叙述"}
    ],
    "causal_rules": [
      {"id":"CR-3-A","trigger_action":"未诊断 DAU 下降原因就承诺复制竞品 AI 功能","consequence_path":"premature","short_term":"团队焦虑暂时缓解","medium_term":"工程启动重构，既有路线图延期，DAU 继续下降","long_term":"功能上线后使用率仍低","counterfactual":"先完成一周 DAU 下降诊断"},
      {"id":"CR-3-B","trigger_action":"先完成 DAU 下降诊断再决定是否跟进竞品","consequence_path":"investigated","short_term":"增长团队对延后决策不满","medium_term":"团队发现 onboarding 漏斗问题并修复激活节点","long_term":"DAU 在 6 周内回升","counterfactual":"立即复制竞品会掩盖真正的激活问题"}
    ],
    "role_interests": [
      {"role":"数据负责人","stated_position":"需要解释 DAU 下降","true_interest":"建立可信的数据驱动原因","information_boundary":"尚未完成 cohort 细分"},
      {"role":"增长团队","stated_position":"必须追上竞品","true_interest":"缓解产品落后的焦虑","information_boundary":"不知道竞品真实使用率"},
      {"role":"流失用户","stated_position":"尚未被访谈","true_interest":"解决实际激活障碍","information_boundary":"不知道团队把流失归因于竞品功能"}
    ],
    "reveal_conditions": [
      {"id":"RC-3-01","trigger":"用户群分布","reveals":["HF-3-01"]},
      {"id":"RC-3-02","trigger":"竞品数据","reveals":["HF-3-02"]},
      {"id":"RC-3-03","trigger":"工程量","reveals":["HF-3-03"]},
      {"id":"RC-3-04","trigger":"为什么跟进","reveals":["HF-3-04"]},
      {"id":"RC-3-05","trigger":"流失访谈","reveals":["HF-3-05"]}
    ]
  }$json$::jsonb,
  $json${
    "premature_commitment":{"level":1,"description":"未调查指标结构就在前两轮承诺跟进","observable_indicators":["未拆分 DAU cohort","未核查竞品使用率","直接进入路线图"],"anti_examples":["先诊断 DAU 下降来源"]},
    "adequate_investigation":{"level":3,"description":"调查 DAU 用户结构和竞品实际数据","observable_indicators":["识别 onboarding 根因","区分热度与价值","评估机会成本"],"anti_examples":["只比较竞品功能清单"]},
    "model_behavior":{"level":5,"description":"主动识别缺少流失访谈并提出有期限的诊断 sprint","observable_indicators":["指出内部推断边界","给出一周诊断计划","说明重评条件"],"anti_examples":["把同期下降直接归因于竞品"]}
  }$json$::jsonb,
  '["内部团队共识压力","B2C 增长场景","无提示迁移测试"]'::jsonb,
  'product-owner',
  '["GitHub Issue #15 v0.3","GitHub Issue #8 v1.0"]'::jsonb,
  '2026-08-03T00:00:00Z'
)
on conflict (world_id, version) do nothing;

