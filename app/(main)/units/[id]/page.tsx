import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { Avatar, Empty, PageHeader, Stat, StatusBadge, TypeBadge } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await queryOne<{ name: string }>("SELECT name FROM units WHERE id = $1", [Number((await params).id) || 0]);
  return { title: u?.name ?? "Unit" };
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const unit = await queryOne<{ id: number; code: string; name: string; category: string; source_name: string; sheet: string }>(
    "SELECT * FROM units WHERE id = $1", [id || 0]);
  if (!unit) notFound();

  const [posts, staff, byBps, heads] = await Promise.all([
    query<{ id: number; section: string | null; designation: string; bps: number | null; positions: number }>(
      "SELECT * FROM budget_posts WHERE unit_id = $1 ORDER BY id", [id]),
    query<{ id: number; employee_no: string; full_name: string; designation: string; bps: number | null; staff_type: string; status: string; date_of_retirement: string | null; has_photo: boolean }>(
      `SELECT id, employee_no, full_name, designation, bps, staff_type, status, date_of_retirement, (photo IS NOT NULL) has_photo
       FROM employees WHERE unit_id = $1 ORDER BY staff_type DESC, bps DESC NULLS LAST, full_name`, [id]),
    query<{ bps: number; budgeted: number; working: number }>(
      `WITH b AS (SELECT bps, sum(positions)::int n FROM budget_posts WHERE unit_id = $1 GROUP BY bps),
            w AS (SELECT bps, count(*)::int n FROM employees WHERE unit_id = $1 AND staff_type = 'Non-Teaching' GROUP BY bps)
       SELECT coalesce(b.bps, w.bps) bps, coalesce(b.n, 0) budgeted, coalesce(w.n, 0) working
       FROM b FULL JOIN w ON w.bps = b.bps WHERE coalesce(b.bps, w.bps) IS NOT NULL ORDER BY 1 DESC`, [id]),
    query<{ employee_id: number; full_name: string; role: string; present_from: string | null; present_to: string | null }>(
      `SELECT c.employee_id, e.full_name, c.role, c.present_from, c.present_to FROM employee_charges c JOIN employees e ON e.id = c.employee_id
       WHERE c.unit_id = $1 ORDER BY c.present_from DESC NULLS LAST`, [id]),
  ]);

  const budgeted = posts.reduce((a, p) => a + p.positions, 0);
  const teaching = staff.filter((s) => s.staff_type === "Teaching").length;
  const nonTeaching = staff.length - teaching;

  return (
    <>
      <div className="mb-3 text-sm text-muted"><Link href="/units" className="hover:text-uok-700">Departments & Offices</Link> / <span className="text-ink">#{unit.code}</span></div>
      <PageHeader title={unit.name} subtitle={<>{unit.category} · Budget Book S.No {unit.code}{unit.sheet && ` · ${unit.sheet}`}</>}
        actions={<Link href={`/employees?unit=${id}`} className="btn-secondary">Open in employee list</Link>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Faculty members" value={teaching} accent="crimson" />
        <Stat label="Non-teaching staff" value={nonTeaching} accent="navy" />
        <Stat label="Budgeted posts" value={budgeted} hint="Approved budget book" accent="gold" />
        <Stat label="Gap vs budget" value={budgeted ? budgeted - nonTeaching : "—"} hint="Budgeted − non-teaching on record" />
      </div>

      {heads.length > 0 && (
        <div className="card mt-5 flex flex-wrap gap-4 p-4">
          {heads.map((h, i) => (
            <Link key={i} href={`/employees/${h.employee_id}?tab=charges`} className="text-sm">
              <span className="badge mr-2 bg-gold-100 text-amber-900">{h.role}</span>
              <span className="font-medium text-navy hover:text-uok-700">{h.full_name}</span>
              {h.present_from && <span className="text-muted"> · since {fmtDate(h.present_from)}</span>}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">Present staff position <span className="font-normal text-muted">({staff.length})</span></h2></div>
          {staff.length === 0 ? <Empty>No staff on record for this unit.</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Name</th><th>Designation</th><th>BPS</th><th>Status</th><th>Retirement</th></tr></thead>
                <tbody>
                  {staff.map((e) => (
                    <tr key={e.id}>
                      <td><Link href={`/employees/${e.id}`} className="flex items-center gap-2.5">
                        <Avatar name={e.full_name} id={e.id} hasPhoto={e.has_photo} size={30} />
                        <span><span className="font-medium text-navy hover:text-uok-700">{e.full_name}</span><span className="ml-2"><TypeBadge type={e.staff_type} /></span></span>
                      </Link></td>
                      <td>{e.designation}</td>
                      <td className="tabular-nums">{e.bps ?? "—"}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td className="whitespace-nowrap">{fmtDate(e.date_of_retirement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">Budgeted positions</h2><p className="text-xs text-muted">Approved Budget Book (non-teaching)</p></div>
            {posts.length === 0 ? <Empty>No budgeted posts in the approved budget book.</Empty> : (
              <table className="table">
                <thead><tr><th>Sec.</th><th>Designation</th><th>BPS</th><th className="text-right">Posts</th></tr></thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}><td className="text-muted">{p.section ?? ""}</td><td>{p.designation}</td><td className="tabular-nums">{p.bps ?? "—"}</td><td className="text-right font-medium tabular-nums">{p.positions}</td></tr>
                  ))}
                  <tr className="bg-canvas font-semibold"><td /><td>Total</td><td /><td className="text-right tabular-nums">{budgeted}</td></tr>
                </tbody>
              </table>
            )}
          </section>
          {byBps.length > 0 && (
            <section className="card overflow-hidden">
              <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">Budgeted vs on record, by BPS</h2></div>
              <table className="table">
                <thead><tr><th>BPS</th><th className="text-right">Budgeted</th><th className="text-right">On record</th><th className="text-right">Difference</th></tr></thead>
                <tbody>
                  {byBps.map((r) => {
                    const d = r.working - r.budgeted;
                    return (
                      <tr key={r.bps}><td>BPS-{r.bps}</td><td className="text-right tabular-nums">{r.budgeted}</td><td className="text-right tabular-nums">{r.working}</td>
                        <td className={`text-right font-medium tabular-nums ${d < 0 ? "text-amber-700" : d > 0 ? "text-sky-700" : "text-muted"}`}>{d > 0 ? `+${d}` : d}</td></tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-3 text-xs text-muted">Negative = posts available; positive = staff on record above budgeted posts at that scale (e.g. upgradations / move-over).</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
