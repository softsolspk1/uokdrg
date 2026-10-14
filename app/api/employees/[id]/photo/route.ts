import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await queryOne<{ photo: Buffer | null; photo_mime: string | null }>(
    "SELECT photo, photo_mime FROM employees WHERE id = $1", [Number(id) || 0]);
  if (!row?.photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(row.photo), {
    headers: { "Content-Type": row.photo_mime ?? "image/jpeg", "Cache-Control": "private, max-age=60" },
  });
}
