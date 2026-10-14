"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit, queryOne } from "@/lib/db";
import { SESSION_COOKIE, signSession, type Role } from "@/lib/session";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const user = await queryOne<{ id: number; username: string; full_name: string; password_hash: string; role: Role; is_active: boolean }>(
    "SELECT id, username, full_name, password_hash, role, is_active FROM users WHERE lower(username) = $1",
    [username],
  );
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "Invalid username or password." };
  }

  const token = await signSession({ id: user.id, username: user.username, name: user.full_name, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  await queryOne("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await audit(user.username, "login", "user", user.id);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
