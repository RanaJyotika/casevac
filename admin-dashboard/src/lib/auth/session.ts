/**
 * DEMO ADMIN AUTHENTICATION — NOT PRODUCTION SECURITY.
 *
 * - One demo administrator account configured in .env.local.
 * - Session = HMAC-SHA256 signed, HTTP-only cookie with an 8-hour expiry.
 * - Every protected page, server action and route handler checks the
 *   session on the server.
 * Production needs verified identities, per-user credentials, roles from the
 * backend, revocation, audit and organisational approval (APP_FLOW.md §6).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "../domain/types";

export const SESSION_COOKIE = "casevac_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  sub: string;
  name: string;
  role: "SYSTEM_ADMIN";
  mode: "DEMO";
  iat: number;
  exp: number;
}

function sessionSecret(): string {
  const secret = process.env.CASEVAC_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "CASEVAC_SESSION_SECRET is missing or shorter than 32 characters. Copy .env.example to .env.local and set it.",
    );
  }
  return secret;
}

export function demoAdminAccount() {
  return {
    id: (process.env.DEMO_ADMIN_ID ?? "ADM-DEMO-01").trim().toUpperCase(),
    name: process.env.DEMO_ADMIN_NAME ?? "Demo Administrator",
    password: process.env.DEMO_ADMIN_PASSWORD ?? "",
  };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checks demo credentials. Returns the actor on success. */
export function verifyDemoCredentials(id: string, password: string): Actor | null {
  const account = demoAdminAccount();
  if (!account.password) return null; // refuse to run with an unset password
  const idOk = safeEqual(id.trim().toUpperCase(), account.id);
  const pwOk = safeEqual(password, account.password);
  return idOk && pwOk ? { id: account.id, name: account.name } : null;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function createSessionToken(actor: Actor, secret = sessionSecret(), nowSeconds = Math.floor(Date.now() / 1000)): string {
  const payload: AdminSession = {
    sub: actor.id,
    name: actor.name,
    role: "SYSTEM_ADMIN",
    mode: "DEMO",
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret = sessionSecret(), nowSeconds = Math.floor(Date.now() / 1000)): AdminSession | null {
  if (!token) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, sign(body, secret))) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSession;
    if (typeof session.exp !== "number" || session.exp <= nowSeconds) return null;
    if (session.mode !== "DEMO" || session.role !== "SYSTEM_ADMIN") return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(actor: Actor): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(actor), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** For pages and server actions: redirects to /login when signed out. */
export async function requireAdmin(): Promise<Actor> {
  const session = await getSession();
  if (!session) redirect("/login");
  return { id: session.sub, name: session.name };
}
