import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { moderateCommunityCase, moderateKnowledgeEntry } from "@/lib/repositories/resource-repository";

const BodySchema = z.object({ resourceType: z.enum(["community_case", "knowledge_entry"]).default("community_case"), status: z.enum(["published", "archived", "rejected"]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = BodySchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("审核状态不正确。", 400);
  try {
    const { id } = await context.params;
    if (parsed.data.resourceType === "knowledge_entry" && parsed.data.status === "rejected") return apiError("知识库条目不支持 rejected 状态。", 400);
    const item = parsed.data.resourceType === "knowledge_entry"
      ? await moderateKnowledgeEntry(user.id, id, parsed.data.status as "published" | "archived")
      : await moderateCommunityCase(user.id, id, parsed.data.status);
    return Response.json({ item });
  } catch (error) {
    captureServerException(error, { area: "resource_moderate" });
    return apiError("内容审核失败，请确认管理员权限。", 403);
  }
}
