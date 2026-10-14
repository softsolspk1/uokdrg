import Link from "next/link";
import { Download } from "lucide-react";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { fmtDate, remaining } from "@/lib/format";
import { BarList, Empty, PageHeader, StatusBadge, TypeBadge } from "@/components/ui";

export const metadata = { title: "Retirements" };

const RANGES: Record<string, [string, string]> = {
  "3m": ["Next 3 months", "3 months"],
  "6m": ["Next 6 months", "6 months"],
  "12m": ["Next 12 months", "12 months"],
  "24m": ["Next 2 years", "24 months"],
  "60m": ["Next 5 years", "60 months"],
};

export default async function RetirementsPage({ searchParams }: { searchParams: Promise<{ range?: string; type?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const range = RANGES[sp.range ?? ""] ? sp.range! : "12m";
  const type = sp.type === "Teaching" || sp.type === "Non-Teaching" ? sp.type : "";

  const params: unknown[] = [ACTIVE_STATUSES, RANGES[range][1]];
  let typeSql = "";
  if (type) { params.push(type); typeSql = `AND e.staff_type = $3`; }

  const [rows, byYear] = await Promise.all([
    query<{ id: number; employee_no: string; full_name: string; designation: string; bps: number | null; staff_type: string; status: string; unit: string | null; unit_id: number | null; date_of_retirement: string }>(
      `SELECT e.id, e.employee_no, e.full_name, e.designation, e.bps, e.staff_type, e.status, u.name unit, e.unit_id, e.date_of_retirement
       FROM employees e LEFT JOIN units u ON u.id = e.unit_id
       WHERE e.status = ANY($1) AND e.date_of_retirement BETWEEN current_date AND current_date + $2::interval ${typeSql}
       ORDER BY e.date_of_retirement`, params),
    query<{ y: number; n: number }>(
      `SELECT extract(year FROM date_of_retirement)::int y, count(*)::int n FROM employees e
       WHERE status = ANY($1) AND date_of_retirement >= current_date AND date_of_retirement < make_date(extract(year FROM current_date)::int + 10, 1, 1)
       ${type ? "AND e.staff_type = $2" : ""}
       GROUP BY 1 ORDER BY 1`, type ? [ACTIVE_STATUSES, type] : [ACTIVE_STATUSES]),
  ]);

  const q = (o: Record<string, string>) => `/retirements?${new URLSearchParams(Object.fromEntries(Object.entries({ range, type, ...o }).filter(([, v]) => v)))}`;

  return (
    <>
      <PageHeader title="Retirements" subtitle="Superannuation forecast (age 60) for employees in service"
        actions={<a className="btn-secondary" href={`/api/export/employees?sort=retirement${type ? `&type=${type}` : ""}`}><Download size={15} /> Export all by retirement date</a>} />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(RANGES).map(([k, [label]]) => (
              <Link key={k} href={q({ range: k })} className={`btn-sm btn ${k === range ? "bg-uok-700 text-white" : "border border-line bg-white hover:bg-canvas"}`}>{label}</Link>
            ))}
            <span className="mx-2 w-px bg-line" />
            {["", "Teaching", "Non-Teaching"].map((t) => (
              <Link key={t} href={q({ type: t })} className={`btn-sm btn ${t === type ? "bg-navy text-white" : "border border-line bg-white hover:bg-canvas"}`}>{t || "All staff"}</Link>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="px-5 pt-5 pb-3 font-semibold text-navy">{rows.length} employees retiring · {RANGES[range][0].toLowerCase()}</div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Retires on</th><th>Name</th><th>Designation</th><th>BPS</th><th>Department / office</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap"><div className="font-medium">{fmtDate(e.date_of_retirement)}</div><div className="text-xs text-muted">in {remaining(e.date_of_retirement)}</div></td>
                      <td><Link href={`/employees/${e.id}`} className="font-medium text-navy hover:text-uok-700">{e.full_name}</Link><div className="mt-0.5 flex gap-2 text-xs text-muted">{e.employee_no}<TypeBadge type={e.staff_type} /></div></td>
                      <td>{e.designation}</td>
                      <td className="tabular-nums">{e.bps ?? "—"}</td>
                      <td className="text-muted">{e.unit_id ? <Link href={`/units/${e.unit_id}`} className="hover:text-uok-700">{e.unit}</Link> : "—"}</td>
                      <td><StatusBadge status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <Empty>No retirements in this period.</Empty>}
            </div>
          </div>
        </div>
        <section className="card h-fit p-5">
          <h2 className="mb-1 font-semibold text-navy">Retirements by year</h2>
          <p className="mb-4 text-xs text-muted">Next 10 calendar years{type ? ` · ${type}` : ""}</p>
          <BarList data={byYear.map((r) => ({ label: String(r.y), value: r.n }))} />
        </section>
      </div>
    </>
  );
}
