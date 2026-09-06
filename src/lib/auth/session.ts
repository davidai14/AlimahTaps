import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export type StaffRole =
  | "owner"
  | "manager"
  | "cashier"
  | "kitchen"
  | "server"
  | "encoder";

export type SessionPayload = {
  employeeId: string;
  storeId: string;
  fullName: string;
  role: StaffRole;
  // "pin" (cashier/kitchen/server/encoder) or "password" (owner/manager)
  method: "pin" | "password";
};

const COOKIE_NAME = "alimah_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hour shift-length session

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function createSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${body}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
