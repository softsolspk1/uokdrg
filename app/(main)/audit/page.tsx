import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { Empty, PageHeader, Pagination } from "@/components/ui";

export const metadata = { title: "Activity log" };
const SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole("admin");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [rows, total] = await Promise.all([
    query<{ id: number; username: string; action: string; entity: string; entity_id: number | null; details: string | null; created_at: string; full_name: string | null }>(
      `SELECT a.*, e.full_name FROM audit_log a LEFT JOIN employees e ON a.entity = 'employee' AND e.id = a.entity_id
       ORDER BY a.created_at DESC LIMIT ${SIZE} OFFSET ${(page - 1) * SIZE}`),
    queryOne<{ n: number }>("SELECT count(*)::int n FROM audit_log"),
  ]);
  return (
    <>
      <PageHeader title="Activity log" subtitle="Every sign-in and change made in the HRM" />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</td>
                  <td className="font-medium">{r.username}</td>
                  <td><span className="badge bg-canvas text-ink">{r.action}</span></td>
                  <td>{r.entity === "employee" && r.full_name ? <Link href={`/employees/${r.entity_id}`} className="text-navy hover:text-uok-700">{r.full_name}</Link> : `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ""}`}</td>
                  <td className="text-muted">{r.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No activity yet.</Empty>}
        </div>
        <div className="border-t border-line px-4"><Pagination page={page} total={total?.n ?? 0} pageSize={SIZE} makeHref={(p) => `/audit?page=${p}`} /></div>
      </div>
    </>
  );
}
