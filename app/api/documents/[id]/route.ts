import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await queryOne<{ file_name: string; mime_type: string; data: Buffer }>(
    "SELECT file_name, mime_type, data FROM documents WHERE id = $1", [Number(id) || 0]);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inline = req.nextUrl.searchParams.has("inline");
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Length": String(doc.data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
