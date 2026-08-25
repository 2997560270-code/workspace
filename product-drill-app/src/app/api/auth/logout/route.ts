import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Demo-mode logout: clears the local demo session cookie so the user returns
// to the login page. Supabase sessions are cleared by the client signOut() call.
export async function POST() {
  const cookieStore = await cookies();
  const response = new NextResponse(null, { status: 303, headers: { location: "/" } });
  response.cookies.set({ name: SESSION_COOKIE, value: "", maxAge: 0, path: "/" });
  response.cookies.set({ name: "product_drill_e2e_user", value: "", maxAge: 0, path: "/" });
  response.headers.set("cache-control", "no-store");
  return response;
}
