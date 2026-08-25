import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { findLocalUserByEmail, isLocalAuthEnabled, verifyLocalCredentials } from "@/lib/local-auth";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    return Response.json({ error: "Supabase 已启用。" }, { status: 400 });
  }
  if (!isLocalAuthEnabled()) {
    return Response.json({ error: "本地邮箱账号仅在本地开发模式启用。" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim() ?? "";
  const password = body?.password ?? "";

  const user = await findLocalUserByEmail(email);
  if (!user || !verifyLocalCredentials(user, password)) {
    return Response.json({ error: "邮箱或密码不正确，请重试。" }, { status: 401 });
  }

  const response = new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: user.id,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
