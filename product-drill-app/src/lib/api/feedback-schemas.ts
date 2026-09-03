import { z } from "zod";

// 用户使用体验反馈：分类、提交与持久化记录的结构定义。
// 供 /api/feedback 路由与前端 feedback-client 共用。

export const FEEDBACK_CATEGORIES = ["bug", "experience", "feature", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ["open", "processing", "resolved", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FeedbackSubmissionSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  content: z.string().trim().min(5, "反馈内容至少 5 个字。").max(2000, "反馈内容不能超过 2000 字。"),
  contact: z.string().trim().max(100, "联系方式不能超过 100 字。").optional(),
  page: z.string().trim().max(200, "页面路径不能超过 200 字。").optional(),
  rating: z.number().int().min(1, "评分最低 1 分。").max(5, "评分最高 5 分。").optional()
});

export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;

// 服务端持久化后返回的完整记录（与 user_feedback 表的 snapshot 保持一致）。
export const FeedbackRecordSchema = FeedbackSubmissionSchema.extend({
  id: z.string().min(1),
  userId: z.string().min(1).nullable(),
  status: z.enum(FEEDBACK_STATUSES).default("open"),
  userAgent: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime()
});

export type FeedbackRecord = z.infer<typeof FeedbackRecordSchema>;

// GET /api/feedback 的查询参数。
export const FeedbackListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  category: z.enum(FEEDBACK_CATEGORIES).optional(),
  status: z.enum(FEEDBACK_STATUSES).optional()
});

export type FeedbackListQuery = z.infer<typeof FeedbackListQuerySchema>;
