import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { isSupabaseConfigured } from "./env";
import { withLocalRuntimeState } from "./local-runtime-store";

export type LocalUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidate, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Create a local account. Returns null when the email is already registered. */
export async function createLocalUser(input: { email: string; password: string; name: string }): Promise<LocalUser | null> {
  const email = input.email.trim().toLowerCase();
  return withLocalRuntimeState((state) => {
    const exists = state.localUsers.some((user) => (user as { email?: string }).email === email);
    if (exists) return null;
    const user: LocalUser = {
      id: `local-${crypto.randomUUID()}`,
      email,
      name: input.name.trim() || email.split("@")[0],
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    state.localUsers.push(user as unknown as Record<string, unknown>);
    return user;
  });
}

export async function findLocalUserByEmail(email: string): Promise<LocalUser | null> {
  const normalized = email.trim().toLowerCase();
  return withLocalRuntimeState((state) => {
    const user = state.localUsers.find((item) => (item as { email?: string }).email === normalized);
    return user ? (user as unknown as LocalUser) : null;
  });
}

export async function getLocalUserById(id: string): Promise<LocalUser | null> {
  return withLocalRuntimeState((state) => {
    const user = state.localUsers.find((item) => (item as { id?: string }).id === id);
    return user ? (user as unknown as LocalUser) : null;
  });
}

export function verifyLocalCredentials(user: LocalUser, password: string): boolean {
  return verifyPassword(password, user.passwordHash);
}

/** Local email/password accounts are available on local/dev machines (and
 *  E2E-isolated runs). Production deployments should configure Supabase. */
export function isLocalAuthEnabled(): boolean {
  return !isSupabaseConfigured() && (process.env.NODE_ENV !== "production" || process.env.E2E_ISOLATED_USERS === "true");
}
