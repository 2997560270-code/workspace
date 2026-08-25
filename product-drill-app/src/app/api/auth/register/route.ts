import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createLocalUser, isLocalAuthEnabled } from "@/lib/local-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    return Response.json({ error: "Supabase 已启用，请使用邮箱密码注册接口。" }, { status: 400 });
  }
  if (!isLocalAuthEnabled()) {
    return Response.json({ error: "本地邮箱账号仅在本地开发模式启用。" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { email?: string; password?: string; name?: string } | null;
  const email = body?.email?.trim() ?? "";
  const password = body?.password ?? "";
  const name = body?.name?.trim() ?? "";

  if (!EMAIL_RE.test(email)) return Response.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "密码至少需要 8 位。" }, { status: 400 });

  const user = await createLocalUser({ email, password, name });
  if (!user) return Response.json({ error: "该邮箱已注册，请直接登录。" }, { status: 409 });

  const response = new NextResponse(JSON.stringify({ ok: true }), {
    status: 201,
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
