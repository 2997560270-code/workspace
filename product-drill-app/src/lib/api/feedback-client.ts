import type { FeedbackRecord, FeedbackSubmission } from "./feedback-schemas";

export class FeedbackApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "FeedbackApiError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new FeedbackApiError(payload.error ?? "反馈提交失败，请稍后重试。", response.status);
  return payload;
}

/** 提交一条用户使用体验反馈。 */
export async function submitFeedback(submission: FeedbackSubmission): Promise<FeedbackRecord> {
  const data = await requestJson<{ record: FeedbackRecord }>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(submission)
  });
  return data.record;
}
