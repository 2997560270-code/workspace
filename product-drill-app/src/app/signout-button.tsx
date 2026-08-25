"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

/** Sign out (Supabase) or clear the demo cookie, then return to the login page
 *  where the user can switch to another account. */
export function SignOutButton() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      } else {
        // Demo mode: session lives in an httpOnly cookie, cleared server-side.
        await fetch("/api/auth/logout", { method: "POST" });
      }
    } catch {
      // Best-effort; still navigate so the user is never stuck.
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <button className="sidebar-signout" disabled={busy} onClick={handleSignOut} type="button">
      {busy ? "正在退出…" : "切换账号 / 退出"}
    </button>
  );
}
