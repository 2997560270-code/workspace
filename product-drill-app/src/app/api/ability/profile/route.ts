import { buildAbilityProfile } from "@/lib/ability-profile";
import { apiError, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { getHistoryRecords } from "@/lib/repositories/training-repository";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    const records = await getHistoryRecords(user.id);
    const formalRecords = records.filter((record) => record.engine === "openai");
    return Response.json({
      profile: buildAbilityProfile(formalRecords, { formalEvidenceOnly: true }),
      practiceProfile: buildAbilityProfile(records),
      formalRecordCount: formalRecords.length,
      practiceRecordCount: records.length
    });
  } catch (error) {
    captureServerException(error, { area: "ability_profile" });
    return apiError("能力画像暂时无法读取。", 503);
  }
}
