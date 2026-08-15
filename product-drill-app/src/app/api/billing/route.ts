import { apiError, requireApiUser } from "@/lib/api/server";
import { captureServerException } from "@/lib/monitoring/server";
import { getSubscription } from "@/lib/repositories/resource-repository";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return apiError("请先登录。", 401);
  try {
    return Response.json({ subscription: await getSubscription(user.id), paymentConfigured: Boolean(process.env.STRIPE_SECRET_KEY || process.env.PAYMENT_PROVIDER) });
  } catch (error) {
    captureServerException(error, { area: "billing_read" });
    return apiError("订阅状态暂时无法读取。", 503);
  }
}
