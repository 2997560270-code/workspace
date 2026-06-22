import { cookies } from "next/headers";
import { isLoggedIn, SESSION_COOKIE } from "../lib/auth";
import { AppShell } from "./app-shell";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!isLoggedIn(session)) {
    return <LoginForm />;
  }

  return <AppShell />;
}
