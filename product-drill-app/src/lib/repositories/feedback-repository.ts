import { createSupabaseAdminClient } from "../supabase/admin";
import { isLocalRuntimeFallbackEnabled, withLocalRuntimeState } from "../local-runtime-store";
import {
  FeedbackListQuery,
  FeedbackRecord,
  FeedbackRecordSchema,
  FeedbackSubmission
} from "../api/feedback-schemas";

// 反馈持久化：优先写 Supabase（服务端 service_role），数据库未配置时回退到本地运行时状态，
// 方便本地开发与集成测试。正式上线后配置 SUPABASE_SERVICE_ROLE_KEY 即可直接落库。

async function parseSnapshot(value: unknown): Promise<FeedbackRecord | null> {
  const result = FeedbackRecordSchema.safeParse(value);
  return result.success ? result.data : null;
}

export async function createFeedbackRecord(
  submission: FeedbackSubmission,
  userId: string | null,
  userAgent?: string | null
): Promise<FeedbackRecord> {
  const record: FeedbackRecord = {
    id: crypto.randomUUID(),
    userId,
    status: "open",
    userAgent: userAgent ?? null,
    createdAt: new Date().toISOString(),
    ...submission
  };

  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Feedback persistence is not configured");
    return withLocalRuntimeState((state) => {
      state.feedbackSubmissions.push(record);
      return record;
    });
  }

  const { error } = await admin.from("user_feedback").insert({
    id: record.id,
    user_id: record.userId,
    category: record.category,
    content: record.content,
    contact: record.contact ?? null,
    page: record.page ?? null,
    rating: record.rating ?? null,
    status: record.status,
    user_agent: record.userAgent ?? null,
    snapshot: record,
    created_at: record.createdAt
  });
  if (error) throw error;
  return record;
}

export async function listFeedbackRecords(query: Partial<FeedbackListQuery> = {}): Promise<FeedbackRecord[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (!isLocalRuntimeFallbackEnabled()) throw new Error("Feedback persistence is not configured");
    return withLocalRuntimeState((state) => {
      const records = state.feedbackSubmissions as unknown as FeedbackRecord[];
      let rows = [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (query.category) rows = rows.filter((item) => item.category === query.category);
      if (query.status) rows = rows.filter((item) => item.status === query.status);
      return rows.slice(0, query.limit ?? 50);
    });
  }

  let builder = admin
    .from("user_feedback")
    .select("id,snapshot,user_id,status,category,created_at")
    .order("created_at", { ascending: false })
    .limit(query.limit ?? 50);
  if (query.category) builder = builder.eq("category", query.category);
  if (query.status) builder = builder.eq("status", query.status);

  const { data, error } = await builder;
  if (error) throw error;

  const records: FeedbackRecord[] = [];
  for (const row of data ?? []) {
    const parsed = await parseSnapshot(row.snapshot);
    if (parsed) records.push(parsed);
  }
  return records;
}
