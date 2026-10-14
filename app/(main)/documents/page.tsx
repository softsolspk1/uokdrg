import Link from "next/link";
import { Download, Eye, FileText, Search } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { fmtBytes, fmtDateTime } from "@/lib/format";
import { Empty, PageHeader, Pagination } from "@/components/ui";

export const metadata = { title: "Documents" };
const SIZE = 30;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  await requireUser();
  const { q = "", category = "", page: p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const params: unknown[] = [];
  const where: string[] = [];
  if (q) { params.push(`%${q}%`); where.push(`(d.title ILIKE $${params.length} OR d.file_name ILIKE $${params.length} OR e.full_name ILIKE $${params.length} OR e.employee_no ILIKE $${params.length})`); }
  if (category) { params.push(category); where.push(`d.category = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows, total, stats] = await Promise.all([
    query<{ id: number; title: string; file_name: string; category: string; size_bytes: number; uploaded_at: string; uploaded_by: string; employee_id: number; full_name: string; employee_no: string }>(
      `SELECT d.id, d.title, d.file_name, d.category, d.size_bytes, d.uploaded_at, d.uploaded_by, d.employee_id, e.full_name, e.employee_no
       FROM documents d JOIN employees e ON e.id = d.employee_id ${w}
       ORDER BY d.uploaded_at DESC LIMIT ${SIZE} OFFSET ${(page - 1) * SIZE}`, params),
    queryOne<{ n: number }>(`SELECT count(*)::int n FROM documents d JOIN employees e ON e.id = d.employee_id ${w}`, params),
    queryOne<{ n: number; bytes: number; people: number }>("SELECT count(*)::int n, coalesce(sum(size_bytes), 0)::bigint bytes, count(DISTINCT employee_id)::int people FROM documents"),
  ]);

  return (
    <>
      <PageHeader title="Documents" subtitle={`${stats?.n ?? 0} files · ${fmtBytes(Number(stats?.bytes ?? 0))} · ${stats?.people ?? 0} employees. Upload documents from an employee's profile → Documents tab.`} />
      <form className="card mb-4 flex flex-wrap gap-3 p-4" method="get">
        <div className="relative min-w-60 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Search title, file name, employee…" className="input pl-9" />
        </div>
        <select name="category" defaultValue={category} className="input w-auto">
          <option value="">All categories</option>
          {DOCUMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn-primary">Search</button>
      </form>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Document</th><th>Employee</th><th>Category</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td><div className="flex gap-2"><FileText size={18} className="mt-0.5 shrink-0 text-uok-700" /><div><div className="font-medium text-navy">{d.title}</div><div className="text-xs text-muted">{d.file_name}</div></div></div></td>
                  <td><Link href={`/employees/${d.employee_id}?tab=documents`} className="font-medium text-navy hover:text-uok-700">{d.full_name}</Link><div className="text-xs text-muted">{d.employee_no}</div></td>
                  <td className="text-muted">{d.category}</td>
                  <td className="whitespace-nowrap tabular-nums">{fmtBytes(d.size_bytes)}</td>
                  <td className="text-xs whitespace-nowrap text-muted">{fmtDateTime(d.uploaded_at)}<div>{d.uploaded_by}</div></td>
                  <td><div className="flex justify-end gap-1">
                    <a href={`/api/documents/${d.id}?inline=1`} target="_blank" className="btn-secondary btn-sm" title="View"><Eye size={13} /></a>
                    <a href={`/api/documents/${d.id}`} className="btn-secondary btn-sm" title="Download"><Download size={13} /></a>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No documents found. Open an employee profile and use the Documents tab to upload files.</Empty>}
        </div>
        <div className="border-t border-line px-4">
          <Pagination page={page} total={total?.n ?? 0} pageSize={SIZE} makeHref={(n) => `/documents?${new URLSearchParams({ q, category, page: String(n) })}`} />
        </div>
      </div>
    </>
  );
}
