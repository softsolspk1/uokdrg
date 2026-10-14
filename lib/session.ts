// Edge-safe session helpers (used by proxy.ts and server code)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "uok_hrm_session";
export type Role = "admin" | "hr" | "viewer";
export type SessionUser = { id: number; username: string; name: string; role: Role };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { id: payload.id as number, username: payload.username as string, name: payload.name as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
