import type { SkillId } from "./training-config";

export type CourseLesson = {
  id: string;
  title: string;
  summary: string;
  exercise: string;
  skillId: SkillId;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  lessons: CourseLesson[];
};

export const COURSE_PROGRESS_STORAGE_KEY = "product-drill-course-progress-v1";

export const COURSES: Course[] = [
  {
    id: "discovery-basics",
    title: "产品发现基础",
    description: "把模糊需求还原成可验证的问题和证据。",
    lessons: [
      { id: "basics-role", title: "不要把提出需求的人当成用户", summary: "识别使用者、决策者、付费者和承担后果的人。", exercise: "面对一个功能请求，分别写出每天使用、最终决策和承担结果的角色。", skillId: "role" },
      { id: "basics-workflow", title: "让用户带你走一遍流程", summary: "从具体步骤而不是抽象评价开始提问。", exercise: "把“流程很麻烦”改写成一个要求用户还原当前步骤的问题。", skillId: "workflow" },
      { id: "basics-impact", title: "把痛点连接到后果", summary: "确认频率、损失和不解决的代价。", exercise: "为一个痛点写出发生频率、直接影响和业务后果。", skillId: "impact" }
    ]
  },
  {
    id: "judgment-loop",
    title: "从证据到判断",
    description: "学会区分事实、假设、方案和成功指标。",
    lessons: [
      { id: "judgment-alternative", title: "先问用户现在怎么解决", summary: "现有替代方案能暴露真实优先级和约束。", exercise: "列出用户可能已经采用的临时替代方案，并写出追问。", skillId: "alternative" },
      { id: "judgment-metric", title: "定义可以被验证的成功", summary: "把“体验更好”转成行为或业务结果。", exercise: "为一个产品建议写出一个时间、行为或业务指标。", skillId: "metric" },
      { id: "judgment-assumption", title: "给判断留下验证出口", summary: "明确最大假设和下一步验证计划。", exercise: "写出一个可能推翻当前建议的证据。", skillId: "impact" }
    ]
  },
  {
    id: "transfer-practice",
    title: "迁移到真实工作",
    description: "把训练中的行为带回会议、访谈和需求评审。",
    lessons: [
      { id: "transfer-meeting", title: "会议中先确认问题", summary: "面对方案压力时，先补齐当前流程和影响。", exercise: "把一个会议中的功能请求改写成三个验证问题。", skillId: "workflow" },
      { id: "transfer-tradeoff", title: "说清楚暂不做什么", summary: "边界和非目标同样是产品判断的一部分。", exercise: "为一个建议写出暂不解决的范围和原因。", skillId: "alternative" },
      { id: "transfer-review", title: "用证据复盘自己的行为", summary: "回看原话、证据和下一次具体动作。", exercise: "从最近一次讨论中挑一句原话，写出它支持和不能支持的结论。", skillId: "metric" }
    ]
  }
];

export type CourseProgress = Record<string, string[]>;

export function loadCourseProgress(userId: string): CourseProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${COURSE_PROGRESS_STORAGE_KEY}:${userId}`);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => Array.isArray(value) && value.every((item) => typeof item === "string")));
  } catch {
    return {};
  }
}

export function completeCourseLesson(userId: string, courseId: string, lessonId: string): CourseProgress {
  const current = loadCourseProgress(userId);
  const next = { ...current, [courseId]: [...new Set([...(current[courseId] ?? []), lessonId])] };
  if (typeof window !== "undefined") window.localStorage.setItem(`${COURSE_PROGRESS_STORAGE_KEY}:${userId}`, JSON.stringify(next));
  return next;
}

export function courseCompletion(course: Course, progress: CourseProgress): number {
  if (!course.lessons.length) return 0;
  return Math.round(((progress[course.id]?.filter((id) => course.lessons.some((lesson) => lesson.id === id)).length ?? 0) / course.lessons.length) * 100);
}
