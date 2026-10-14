import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { fmtDate, nf } from "@/lib/format";
import { BarList, PageHeader, Stat, StatusBadge, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const active = ACTIVE_STATUSES;

  const [totals, byBps, byCategory, byStatus, byDesignation, upcoming, vac, budget, recentDocs] = await Promise.all([
    queryOne<{ total: number; teaching: number; nonteaching: number; away: number; retiring12: number; units: number; docs: number }>(
      `SELECT count(*)::int total,
              count(*) FILTER (WHERE staff_type = 'Teaching')::int teaching,
              count(*) FILTER (WHERE staff_type = 'Non-Teaching')::int nonteaching,
              count(*) FILTER (WHERE status <> 'Working')::int away,
              count(*) FILTER (WHERE date_of_retirement BETWEEN current_date AND current_date + interval '12 months')::int retiring12,
              (SELECT count(*) FROM units)::int units,
              (SELECT count(*) FROM documents)::int docs
       FROM employees WHERE status = ANY($1)`, [active]),
    query<{ bps: number; n: number }>(
      `SELECT bps, count(*)::int n FROM employees WHERE status = ANY($1) AND bps IS NOT NULL GROUP BY bps ORDER BY bps DESC`, [active]),
    query<{ category: string; n: number }>(
      `SELECT coalesce(u.category, 'Unassigned') category, count(*)::int n FROM employees e LEFT JOIN units u ON u.id = e.unit_id
       WHERE e.status = ANY($1) GROUP BY 1 ORDER BY n DESC`, [active]),
    query<{ status: string; n: number }>(
      `SELECT status, count(*)::int n FROM employees GROUP BY status ORDER BY n DESC`),
    query<{ designation: string; n: number }>(
      `SELECT designation, count(*)::int n FROM employees WHERE staff_type = 'Teaching' AND status = ANY($1) GROUP BY designation ORDER BY n DESC`, [active]),
    query<{ id: number; full_name: string; designation: string; staff_type: string; unit: string; date_of_retirement: string }>(
      `SELECT e.id, e.full_name, e.designation, e.staff_type, u.name unit, e.date_of_retirement
       FROM employees e LEFT JOIN units u ON u.id = e.unit_id
       WHERE e.date_of_retirement >= current_date AND e.status = ANY($1)
       ORDER BY e.date_of_retirement LIMIT 8`, [active]),
    queryOne<{ sanctioned: number; working: number; vacant: number }>(
      `SELECT sum(sanctioned)::int sanctioned, sum(working)::int working, sum(vacant)::int vacant FROM vacancies`),
    queryOne<{ positions: number }>(`SELECT sum(positions)::int positions FROM budget_posts`),
    query<{ id: number; title: string; category: string; employee_id: number; full_name: string; uploaded_at: string }>(
      `SELECT d.id, d.title, d.category, d.employee_id, e.full_name, d.uploaded_at FROM documents d JOIN employees e ON e.id = d.employee_id
       ORDER BY d.uploaded_at DESC LIMIT 5`),
  ]);

  const t = totals!;
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={<>Welcome, {user.name} · Establishment overview of the University of Karachi · {fmtDate(new Date().toISOString().slice(0, 10))}</>}
        actions={<>
          <Link href="/employees" className="btn-secondary">Browse employees</Link>
          {user.role !== "viewer" && <Link href="/employees/new" className="btn-primary">Add employee</Link>}
        </>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Employees in service" value={nf.format(t.total)} hint="Working + on leave" href="/employees" />
        <Stat label="Teaching staff" value={nf.format(t.teaching)} hint="Faculty members" href="/employees?type=Teaching" accent="crimson" />
        <Stat label="Non-teaching staff" value={nf.format(t.nonteaching)} hint="Officers & staff" href="/employees?type=Non-Teaching" accent="navy" />
        <Stat label="On leave / away" value={nf.format(t.away)} hint="Study leave, FSL, lien, UA…" href="/employees?status=away" accent="gold" />
        <Stat label="Retiring in 12 months" value={nf.format(t.retiring12)} hint="Superannuation at 60" href="/retirements" accent="crimson" />
        <Stat label="Vacant positions" value={nf.format(vac?.vacant ?? 0)} hint={`of ${nf.format(vac?.sanctioned ?? 0)} listed posts`} href="/vacancies" accent="navy" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold text-navy">Employees by pay scale (BPS)</h2>
            <span className="text-xs text-muted">Employees in service</span>
          </div>
          <BarList data={byBps.map((r) => ({ label: `BPS-${String(r.bps).padStart(2, "0")}`, value: r.n, key: String(r.bps) }))}
            hrefFor={(k) => `/employees?bps=${k}`} />
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-navy">Faculty by designation</h2>
            <BarList data={byDesignation.map((r) => ({ label: r.designation ?? "—", value: r.n, key: r.designation }))}
              hrefFor={(k) => `/employees?type=Teaching&designation=${encodeURIComponent(k)}`} />
          </section>
          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-navy">By unit type</h2>
            <BarList data={byCategory.map((r) => ({ label: r.category, value: r.n }))} />
          </section>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-semibold text-navy">Upcoming retirements</h2>
            <Link href="/retirements" className="text-sm font-medium text-uok-700 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th>Designation</th><th>Department / Office</th><th>Retires on</th></tr></thead>
              <tbody>
                {upcoming.map((e) => (
                  <tr key={e.id}>
                    <td><Link href={`/employees/${e.id}`} className="font-medium text-navy hover:text-uok-700">{e.full_name}</Link><div className="mt-0.5"><TypeBadge type={e.staff_type} /></div></td>
                    <td>{e.designation}</td>
                    <td className="text-muted">{e.unit ?? "—"}</td>
                    <td className="font-medium whitespace-nowrap">{fmtDate(e.date_of_retirement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-navy">Service status</h2>
            <ul className="divide-y divide-line">
              {byStatus.map((s) => (
                <li key={s.status} className="flex items-center justify-between py-2">
                  <Link href={`/employees?status=${encodeURIComponent(s.status)}`}><StatusBadge status={s.status} /></Link>
                  <span className="text-sm font-medium tabular-nums">{nf.format(s.n)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-navy">Establishment</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted uppercase">Units</dt><dd className="text-xl font-semibold text-navy">{nf.format(t.units)}</dd></div>
              <div><dt className="text-xs text-muted uppercase">Budgeted posts</dt><dd className="text-xl font-semibold text-navy">{nf.format(budget?.positions ?? 0)}</dd></div>
              <div><dt className="text-xs text-muted uppercase">Documents</dt><dd className="text-xl font-semibold text-navy">{nf.format(t.docs)}</dd></div>
              <div><dt className="text-xs text-muted uppercase">Working (vac. list)</dt><dd className="text-xl font-semibold text-navy">{nf.format(vac?.working ?? 0)}</dd></div>
            </dl>
          </section>
          {recentDocs.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-navy">Recently uploaded</h2>
              <ul className="space-y-2 text-sm">
                {recentDocs.map((d) => (
                  <li key={d.id}><Link href={`/employees/${d.employee_id}?tab=documents`} className="font-medium text-navy hover:text-uok-700">{d.title}</Link>
                    <div className="text-xs text-muted">{d.category} · {d.full_name}</div></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
