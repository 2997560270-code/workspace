import type { Evaluation } from "../evaluation";
import type { RetryResult, TrainingHistoryRecord } from "../training-history";
import type { ProductJudgment, TrainingSession } from "../training-session";

export class TrainingApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TrainingApiError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new TrainingApiError(payload.error ?? "请求失败，请稍后重试。", response.status);
  return payload;
}

export async function createRemoteSession(scenarioId: string, mode: TrainingSession["mode"]): Promise<TrainingSession> {
  const data = await requestJson<{ session: TrainingSession }>("/api/training/sessions", {
    method: "POST",
    body: JSON.stringify({ scenarioId, mode })
  });
  return data.session;
}

export async function sendRemoteMessage(session: TrainingSession, content: string) {
  return requestJson<{ session: TrainingSession; fallback: boolean }>(`/api/training/sessions/${encodeURIComponent(session.id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, session })
  });
}

export async function submitRemoteJudgment(session: TrainingSession, judgment: ProductJudgment) {
  return requestJson<{ session: TrainingSession }>(`/api/training/sessions/${encodeURIComponent(session.id)}/judgment`, {
    method: "POST",
    body: JSON.stringify({ judgment, session })
  });
}

export async function requestRemoteEvaluation(session: TrainingSession) {
  return requestJson<{ evaluation: Evaluation; record: TrainingHistoryRecord; fallback: boolean }>(`/api/training/sessions/${encodeURIComponent(session.id)}/evaluation`, {
    method: "POST",
    body: JSON.stringify({ session })
  });
}

export async function submitRemoteRetry(record: TrainingHistoryRecord, issueId: string, answer: string) {
  return requestJson<{ retry: RetryResult; record: TrainingHistoryRecord; fallback: boolean }>(`/api/training/sessions/${encodeURIComponent(record.sessionId)}/retries`, {
    method: "POST",
    body: JSON.stringify({ issueId, answer, record })
  });
}

export async function fetchRemoteHistory(): Promise<TrainingHistoryRecord[]> {
  const data = await requestJson<{ records: TrainingHistoryRecord[] }>("/api/training/history");
  return data.records;
}

export async function syncDeterministicRecord(record: TrainingHistoryRecord): Promise<void> {
  if (record.engine !== "deterministic") return;
  await requestJson<{ record: TrainingHistoryRecord }>("/api/training/history", {
    method: "POST",
    body: JSON.stringify({ record })
  });
}
