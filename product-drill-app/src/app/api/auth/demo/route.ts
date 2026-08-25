import { NextResponse } from "next/server";
import { DEV_USER, isDemoAuthAllowed, SESSION_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST() {
  if (isSupabaseConfigured() || !isDemoAuthAllowed(process.env.NODE_ENV, process.env.ALLOW_DEMO_AUTH)) {
    return Response.json({ error: "演示登录未启用。" }, { status: 403 });
  }
  // Keep the browser's current host (localhost or 127.0.0.1) so the demo cookie remains available after redirect.
  const response = new NextResponse(null, { status: 303, headers: { location: "/" } });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: DEV_USER.id,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
