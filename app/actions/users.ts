"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { audit, pool, queryOne } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import type { FormState } from "./employees";

export async function createUser(_prev: FormState, f: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const username = String(f.get("username") ?? "").trim().toLowerCase();
  const fullName = String(f.get("full_name") ?? "").trim();
  const role = String(f.get("role") ?? "viewer");
  const password = String(f.get("password") ?? "");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return { error: "Username: 3–32 characters (letters, digits, . _ -)." };
  if (!fullName) return { error: "Full name is required." };
  if (!["admin", "hr", "viewer"].includes(role)) return { error: "Invalid role." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (await queryOne("SELECT 1 FROM users WHERE username = $1", [username])) return { error: "That username already exists." };
  const res = await pool.query(
    "INSERT INTO users (username, full_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id",
    [username, fullName, role, await bcrypt.hash(password, 10)]);
  await audit(admin.username, "create", "user", res.rows[0].id, `${username} (${role})`);
  revalidatePath("/users");
  return { ok: `User "${username}" created.` };
}

export async function setUserActive(id: number, active: boolean) {
  const admin = await requireRole("admin");
  if (id === admin.id) throw new Error("You cannot deactivate your own account.");
  await pool.query("UPDATE users SET is_active = $1 WHERE id = $2", [active, id]);
  await audit(admin.username, active ? "activate" : "deactivate", "user", id);
  revalidatePath("/users");
}

export async function setUserRole(id: number, role: string) {
  const admin = await requireRole("admin");
  if (!["admin", "hr", "viewer"].includes(role)) throw new Error("Invalid role.");
  if (id === admin.id) throw new Error("You cannot change your own role.");
  await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);
  await audit(admin.username, "set-role", "user", id, role);
  revalidatePath("/users");
}

export async function resetPassword(_prev: FormState, f: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const id = Number(f.get("id"));
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(password, 10), id]);
  await audit(admin.username, "reset-password", "user", id);
  return { ok: "Password updated." };
}

export async function changeOwnPassword(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(f.get("current") ?? "");
  const next = String(f.get("password") ?? "");
  const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!row || !(await bcrypt.compare(current, row.password_hash))) return { error: "Current password is incorrect." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(next, 10), user.id]);
  await audit(user.username, "change-password", "user", user.id);
  return { ok: "Your password has been changed." };
}
