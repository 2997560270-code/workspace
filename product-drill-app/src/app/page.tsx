import { getCurrentUser } from "../lib/auth-server";
import { AppShell } from "./app-shell";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <LoginForm />;
  return <AppShell userId={user.id} userName={user.name} userSource={user.source} />;
}
