import type { MasteryState } from "./ability-profile";
import type { TrainingSession } from "./training-session";
import type { ScenarioTrainingStatus } from "./training-history";

/** 状态值 → CSS 修饰符（纯 ASCII，永不随文案变动）。
 *  状态值本身已持久化在训练记录与 fixture 里，故保持中文联合类型不动，
 *  只在展示层解耦「值 / 类名 / 用户可见文案」三者。 */
export const MASTERY_CLASS: Record<MasteryState, string> = {
  "尚未训练": "untouched",
  "已接触": "exposed",
  "在提示下完成": "guided",
  "可独立完成": "independent",
  "表现稳定": "stable",
};

export const SCENARIO_STATUS_CLASS: Record<ScenarioTrainingStatus, string> = {
  "未训练": "untrained",
  "已覆盖": "covered",
  "待复练": "needs_retry",
};

/** 状态值 → 用户可见白话（C6 / C17 的落点，改文案只动这里）。 */
export const MASTERY_LABEL: Record<MasteryState, string> = {
  "尚未训练": "没练过",
  "已接触": "试过一次",
  "在提示下完成": "在提示下完成",
  "可独立完成": "能独立完成",
  "表现稳定": "表现稳定",
};

export const SCENARIO_STATUS_LABEL: Record<ScenarioTrainingStatus, string> = {
  "未训练": "还没开始",
  "已覆盖": "已练完",
  "待复练": "可复练",
};

/** 模式 → 一句话解释（放进 aria-describedby，不进入按钮可访问名）。 */
export const MODE_HINTS: Record<TrainingSession["mode"], string> = {
  "诊断": "诊断：不限时，反馈计入能力记录。",
  "严格": "严格：限时作答，检验独立判断。",
  "练习": "练习：可用提示，结果只作练习反馈。",
};

/** 初始态输入卡下方的建议追问（标题 + 对应信息维度说明）。 */
export const SUGGESTED_QUESTIONS: readonly { question: string; hint: string }[] = [
  { question: "谁每天在用这个功能？", hint: "用户与角色识别" },
  { question: "现在流程哪一步最耗时？", hint: "场景与当前流程" },
  { question: "有没有现成的替代方案？", hint: "现有替代方案" },
  { question: "这件事的成功指标怎么定？", hint: "成功指标" },
];
