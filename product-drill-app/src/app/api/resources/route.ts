import { z } from "zod";
import { apiError, parseJsonBody, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { listPublishedCommunityCases, searchKnowledgeEntries, submitCommunityCase } from "@/lib/repositories/resource-repository";

const CaseSchema = z.object({ title: z.string().trim().min(4).max(160), industry: z.string().trim().min(2).max(80), skillId: z.string().min(1), summary: z.string().trim().min(4).max(4000), lesson: z.string().trim().min(4).max(4000) });

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const type = new URL(request.url).searchParams.get("type") ?? "knowledge";
  try {
    if (type === "community") return Response.json({ items: await listPublishedCommunityCases(), source: "server" });
    if (type === "knowledge") return Response.json({ items: await searchKnowledgeEntries(new URL(request.url).searchParams.get("q") ?? ""), source: "server" });
    return apiError("不支持的资源类型。", 400);
  } catch (error) {
    captureServerException(error, { area: "resource_read", type });
    return apiError("资源暂时无法读取。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  const parsed = CaseSchema.safeParse(await parseJsonBody(request));
  if (!parsed.success) return apiError("案例内容格式不正确。", 400, parsed.error.flatten());
  try {
    return Response.json({ item: await submitCommunityCase(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    captureServerException(error, { area: "resource_submit" });
    return apiError("案例暂时无法提交。", 503);
  }
}
