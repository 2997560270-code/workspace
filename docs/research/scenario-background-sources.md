# 训练场景业务背景来源索引

训练地图 12 个场景的 `background` 业务背景均改编自真实、可公开验证的业务案例或行业研究。
本文件记录每个场景的来源、可核查的关键事实，以及改编幅度。场景数据本身位于
`product-drill-app/src/lib/training-config.ts`，其中 `backgroundSource` 字段是本索引的用户可见摘要。

改编原则：

1. 业务背景中的公司、规模、流程为改编后的虚构情境，但张力、数字量级与行业事实来自真实来源；
2. 场景的 `hiddenFacts`（隐藏事实）是训练机制的"可发现层"，属于教学设计，不声称来自真实公司；
3. 每个背景至少对应一个可点击核查的公开来源。

## 场景来源

### 1. 数据大屏需求（dashboard-request）

- **行业事实**：IBM 统计传统 BI 项目失败率约 60%-70%；Gartner 分析师 Nick Heudecker（2017）称约 85% 的大数据项目失败；Dataversity 报道每年超 150 亿美元 BI 支出中约 60% 项目未交付业务价值。
- **来源**：
  - TechRepublic（引 Gartner）: <https://www.techrepublic.com/article/85-of-big-data-projects-fail-but-your-developers-can-help-yours-succeed/>
  - Dataversity: <https://www.dataversity.net/articles/why-60-of-bi-initiatives-fail-and-how-enterprises-can-avoid-it/>
- **对应关系**：客户"要一块大屏"的表层需求背后，是数据整合、编码不一致与看板无人使用的行业普遍失败模式。
- **改编**：公司（48 家门店、三套系统）为改编情境；门店编码不一致、周报 6 小时等细节来自场景既有教学设计。

### 2. 老板要求加 AI（ai-mandate）

- **行业事实**：2023 年 4 月钉钉宣布接入通义千问并宣布全面智能化；飞书同期发布 My AI；金山办公发布 WPS AI——协同办公三家进入 AI 功能竞赛（财联社《从争夺流量到比拼AI 腾讯、字节、阿里开启协同办公"三国杀"》）。
- **来源**：
  - 财联社: <https://www.cls.cn/detail/2125860>
  - 华尔街见闻（钉钉接入通义千问，2023-04-18）等公开报道
- **对应关系**："竞品都有所以我们必须有"的管理层焦虑，是 2023 年协同办公行业的真实集体行为。
- **改编**：训练情境中的公司（2 万付费团队）为虚构，竞争压力与时间线为真实行业事件。

### 3. 报表导出慢（export-slow）

- **行业事实**：Salesforce 官方文档规定 Lightning 格式化报表单次导出上限 2000 行（XLSX"仅详细信息"上限 10 万行）；官方社区与 StackExchange 中大量"拆分导出再合并"的绕行讨论。
- **来源**：
  - Salesforce Help（官方限制）: <https://help.salesforce.com/s/articleView?language=en_US&id=analytics.reports_export.htm&type=5>
  - Salesforce Trailblazer Community: <https://trailhead.salesforce.com/trailblazer-community/feed/0D54S00000A915VSAR>
- **对应关系**："导出慢/导不出"的投诉背后存在真实的平台限制与用户绕行成本，训练重点是区分投诉者与真实等待者（财务分析师）。
- **改编**：20-40 分钟等待与月度关账情境为场景教学设定，量级与真实用户反馈一致。

### 4. 提醒功能（reminder-feature）

- **行业事实**：便利蜂对短保商品引入动态促销机制，系统自动测算临期折扣；日本全家以"泪目贴纸"折扣标签使临期食品多卖约 5%；全家鲜食损耗率约 3%，行业平均 6%-8%（CBNData 报道）。
- **来源**：
  - 中国食品安全网（便利蜂动态促销）: <https://cfsn.cn/news/detail/35/99026.html?view=pc>
  - FoodTalks（日本全家泪目贴纸）: <https://www.foodtalks.cn/news/56577>
  - CBNData（全家损耗率 3%）: <https://www.cbndata.com/information/295434>
- **对应关系**：店长"加个提醒"的诉求背后，是行业用系统化方式（自动折扣、数据订货）解决临期损耗的真实实践。
- **改编**：单店每月约 3000 元损耗为场景教学数字；手写日期、微信群提醒来自便利店门店管理的普遍现状。

### 5. 激活率下降（activation-drop）

- **行业事实**：Slack 创始人 Stewart Butterfield（First Round Review 访谈）：团队累计发送 2000 条消息后 93% 客户留存；Facebook 早期以"10 天加 7 个好友"为激活指标（Mode 复盘），Geckoboard 撰文指出其是相关性而非因果。
- **来源**：
  - First Round Review: <https://review.firstround.com/from-0-to-1b-slacks-founder-shares-their-epic-launch-strategy/>
  - Mode（Facebook aha moment）: <https://mode.com/blog/facebook-aha-moment-simpler-than-you-think/>
  - Geckoboard（相关性与因果讨论）: <https://medium.com/geckoboard-under-the-hood/how-facebooks-7-friends-in-10-days-got-everyone-confused-about-correlation-and-causation-25da4bb8220e>
- **对应关系**：改版把"邀请成员"设为创建项目的前置门禁，个人用户激活受挫——对照行业"先单人价值、后网络邀请"的公认实践。
- **改编**：协作工具与"先邀请再建项目"改版为教学情境，映射真实的社交门禁反模式。

### 6. 大客户定制（custom-request）

- **行业事实**：SaaStr 创始人 Jason Lemkin 公开判断框架："One-off customization per se is bad. This is SaaS, not a services business."；钉钉 2021 年公布组织数超 1900 万，把多级审批做成可配置产品（官方称支撑数亿次审批提速，厂商口径）。
- **来源**：
  - SaaStr（定制边界）: <https://www.saastr.com/where-do-you-draw-the-line-when-companies-ask-for-customization-for-a-saas-product/>
  - SaaStr（一条简单规则）: <https://www.saastr.com/one-simple-rule-on-when-to-build-a-custom-feature/>
  - 新浪财经（钉钉未来组织大会）: <https://finance.sina.com.cn/tech/2021-10-13/doc-iktzqtyu1138949.shtml>
- **对应关系**：大客户把定制作为续约条件，是 B2B SaaS 最经典的"单客特例 vs 共性需求"判断题。
- **改编**：客户占年收入 12%、每月 20 次特殊审批为场景教学数字。

### 7. AI 客服不准确（ai-support-inaccuracy）

- **行业事实**（均为 2024 年公开报道案例）：
  - Air Canada：Moffatt v. Air Canada（2024 BCCRT 149），官网聊天机器人给出错误丧亲票价政策，仲裁庭认定公司对其网站 AI 内容负全责，判赔 812.02 加元（BBC/ABA 报道）；
  - DPD：2024 年 1 月聊天机器人被诱导输出辱骂内容并自称无用，公司随即禁用 AI 部分（BBC/The Guardian）；
  - 纽约市 MyCity 商务聊天机器人：2024 年 3 月被 The Markup 曝出给出"可拿走员工小费"等违法建议（The Markup/AP）。
- **来源**：
  - BBC（Air Canada）: <https://www.bbc.com/travel/article/20240222-air-canada-chatbot-misinformation-what-travellers-should-know>
  - BBC（DPD）: <https://www.bbc.com/news/technology-68025677>
  - The Markup（NYC MyCity）: <https://themarkup.org/artificial-intelligence/2024/03/29/nycs-ai-chatbot-tells-businesses-to-break-the-law>
- **对应关系**：AI 客服错误回答不只是体验问题，会产生法律责任与公关危机，训练重点是还原"AI 草拟→客服直发"的流程并区分问题类型。
- **改编**：电商平台情境与"纠错清单未同步回知识库"为教学设计，映射真实事故中的护栏缺失。

### 8. 培训完成率低（training-completion-drop）

- **行业事实**：Katy Jordan（开放大学）对 221 门 MOOC 的研究：完成率中位数约 12.6%；Reich & Ruipérez-Valiente（*Science*, 2019）分析 563 万 MITx/HarvardX 学习者：全量获证率约 3.13%；Duolingo 前增长负责人 Jorge Mazal 复盘：2018-2022 年靠 streak（连续打卡）与排行榜使 DAU 增长 4.5 倍。
- **来源**：
  - Katy Jordan MOOC 项目: <http://www.katyjordan.com/MOOCproject.html>
  - The MOOC Pivot（Science 2019）: <https://www.semanticscholar.org/paper/The-MOOC-pivot-Reich-Ruip%C3%A9rez-Valiente/fdd37727342a0da25294ba57953ea918665a5a2d>
  - Lenny's Newsletter（Duolingo 增长复盘）: <https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth>
- **对应关系**：管理者"加提醒、上排行榜"的直觉有真实成功案例支撑（Duolingo），但完成率基线（MOOC 12.6%/3%）提示需要区分岗位与场景，而非一刀切。
- **改编**：连锁服务企业 4000 名轮班员工为教学情境；"中途退出无续学记录"来自场景既有教学设计。

### 9. 投诉与使用率冲突（complaints-with-usage）

- **行业事实**：Snapchat 2018 年全面改版引发超 120 万人 Change.org 请愿；2018-02-21 Kylie Jenner 一条推文使 Snap 当日股价跌约 6%、市值蒸发约 13 亿美元；但 Snap 在 2018-02-06 Q4 财报电话会上明确表示"改版后内容消费与使用时长等核心指标在 25 岁以上用户中不成比例地更高"，2018 Q1 财报再次确认人均日使用时长保持 30 分钟以上。随后 Snap 于 2018 年 5 月宣布回调改版——"互动上升"与"口碑/增长受损"两个事实并存。
- **来源**：
  - The Guardian（2018-02-22）: <https://www.theguardian.com/technology/2018/feb/22/snapchat-redesign-12m-signature-petition-social-media-app-kylie-jenner-celebrities>
  - The New York Times（2018-05-01）: <https://www.nytimes.com/2018/05/01/technology/snapchat-redesign-snap-earnings.html>
- **对应关系**：最著名的"投诉声量 ≠ 使用率下降"案例，训练重点是分开态度数据与行为数据、找出沉默的高频使用者。
- **改编**：项目管理工具情境、"批量操作投诉"细节为教学设定，映射同一冲突结构。

### 10. 销售认为缺功能丢单（sales-lost-deals）

- **行业事实**：Clozd 对照 1000 条 CRM 丢单记录与买家访谈，销售填写的丢单原因与买家真实原因仅约 15% 一致，44% 的 CRM"原因"其实是"结果"；Primary Intelligence（5 万+ 次访谈）统计：销售归因于价格约 48%，买家真实提及约 23%。
- **来源**：
  - Clozd（原文核实）: <https://www.clozd.com/blog/5-lies-your-crm-is-telling-you-about-your-buyers>
  - Elevated Signal（引 Primary Intelligence）: <https://elevatedsignal.com/insights/win-loss-analysis/>
- **对应关系**：销售"缺功能所以丢单"的二手归因需要验证，是 win/loss 分析的经典教学点。
- **改编**：5 笔丢单、4 笔归因报表为教学情境；"只有 1 笔明确提到报表、其余卡在安全审查"来自 hiddenFacts 教学设计。

### 11. 功能使用率低（low-feature-adoption）

- **行业事实**：Pendo《2019 Feature Adoption Report》：平均一个软件产品中 80% 的功能很少或从未被使用；平均仅约 6.4 个"核心事件"功能贡献约 80% 的点击量。历史参照：Standish Group CHAOS 报告（2002）约 64% 功能很少或从未使用。
- **来源**：
  - Pendo 原始报告: <https://www.pendo.io/resources/the-2019-feature-adoption-report/>
  - Pendo 基准解读: <https://www.pendo.io/pendo-blog/feature-adoption-benchmarking/>
- **对应关系**：低使用率是行业常态，训练重点是区分"功能发现"与"激活漏斗"，而不是条件反射式加大曝光。
- **改编**：跨团队视图、"先配置模板才能看到数据"为教学设定。

### 12. 企业续费下降（enterprise-renewal-drop）

- **行业事实**：SaaS Capital《2023 B2B SaaS Retention Benchmarks》：B2B SaaS 净收入留存（NRR）中位数约 102%、总收入留存（GRR）中位数约 91%；Nexthink（2023，基于 600 万+ 员工环境）：约 49.96% 的已安装软件许可证从未被员工使用；Zylo SaaS Management Index：约 46% 的 SaaS 许可证被浪费。
- **来源**：
  - SaaS Capital（PDF 原文）: <https://www.saas-capital.com/wp-content/uploads/2023/05/RB28WS1-2023-B2B-SaaS-Retention-Benchmarks.pdf>
  - Nexthink 新闻稿: <https://nexthink.com/press/half-of-software-licenses-goes-unused-by-employees-wasting-businesses-billions>
  - Zylo: <https://zylo.com/blog/how-much-wasted-on-saas-spend/>
- **对应关系**：续费下降时"打折 vs 补功能"都可能是治标；行业数据显示"已购未用"（shelfware）才是最常见根因，训练重点是拆解使用报告与业务成果的断层。
- **改编**：使用报告"只有登录与功能次数"为教学设定，映射真实的续约前健康度诊断缺失。

## 引用注意事项

1. 厂商自报口径（钉钉审批次数、Duolingo DAU 增长倍数、游戏化完成率对比）已在场景文案中用"约"/"官方称"弱化，正式对外引用前需再核实；
2. Gartner"85% 大数据项目失败"为分析师个人观点（2017，Nick Heudecker），非正式报告结论；
3. 弃用无法溯源的数字：1E"每公司年均浪费 $39M"、Gartner"30% toxic spend"（无一手来源）；
4. "The MOOC pivot"发表于 *Science*（2019，Vol. 363），引用时不要写成 PNAS。
