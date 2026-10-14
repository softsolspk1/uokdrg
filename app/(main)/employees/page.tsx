import Link from "next/link";
import { Download, Search } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { requireUser, canEdit } from "@/lib/auth";
import { PAGE_SIZE, STATUSES } from "@/lib/constants";
import { buildWhere, readFilters, toQueryString } from "@/lib/employee-filters";
import { fmtDate, remaining } from "@/lib/format";
import { Avatar, Empty, PageHeader, Pagination, StatusBadge, TypeBadge } from "@/components/ui";

export const metadata = { title: "Employees" };

type Row = {
  id: number; employee_no: string; full_name: string; designation: string | null; bps: number | null; staff_type: string;
  status: string; unit: string | null; unit_id: number | null; date_of_retirement: string | null; has_photo: boolean; docs: number;
};

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = readFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const { sql, params, order } = buildWhere(f);

  const [rows, count, units, designations] = await Promise.all([
    query<Row>(
      `SELECT e.id, e.employee_no, e.full_name, e.designation, e.bps, e.staff_type, e.status, u.name unit, e.unit_id,
              e.date_of_retirement, (e.photo IS NOT NULL) has_photo,
              (SELECT count(*)::int FROM documents d WHERE d.employee_id = e.id) docs
       FROM employees e LEFT JOIN units u ON u.id = e.unit_id ${sql}
       ORDER BY ${order}, e.id LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, params),
    queryOne<{ n: number }>(`SELECT count(*)::int n FROM employees e LEFT JOIN units u ON u.id = e.unit_id ${sql}`, params),
    query<{ id: number; name: string }>("SELECT id, name FROM units ORDER BY name"),
    query<{ designation: string }>("SELECT designation FROM employees WHERE designation IS NOT NULL GROUP BY designation ORDER BY count(*) DESC LIMIT 150"),
  ]);
  const total = count?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${total.toLocaleString()} matching records`}
        actions={<>
          <a href={`/api/export/employees${toQueryString(f)}`} className="btn-secondary"><Download size={15} /> Export CSV</a>
          {canEdit(user) && <Link href="/employees/new" className="btn-primary">Add employee</Link>}
        </>}
      />

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" method="get">
        <div className="relative sm:col-span-2 xl:col-span-2">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={f.q} placeholder="Name, employee no., CNIC, designation" className="input pl-9" />
        </div>
        <select name="type" defaultValue={f.type ?? ""} className="input">
          <option value="">All staff types</option><option>Teaching</option><option>Non-Teaching</option>
        </select>
        <select name="unit" defaultValue={f.unit ?? ""} className="input xl:col-span-2">
          <option value="">All departments / offices</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input name="designation" list="designations" defaultValue={f.designation} placeholder="Designation" className="input" />
        <datalist id="designations">{designations.map((d) => <option key={d.designation} value={d.designation} />)}</datalist>
        <select name="bps" defaultValue={f.bps ?? ""} className="input">
          <option value="">Any BPS</option>
          {Array.from({ length: 22 }, (_, i) => 22 - i).map((b) => <option key={b} value={b}>BPS-{b}</option>)}
        </select>
        <select name="status" defaultValue={f.status ?? ""} className="input">
          <option value="">Any status</option>
          <option value="away">On leave / away (all)</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="sort" defaultValue={f.sort ?? ""} className="input xl:col-span-2">
          <option value="">Sort: Department</option>
          <option value="name">Sort: Name</option>
          <option value="bps">Sort: BPS (high → low)</option>
          <option value="retirement">Sort: Retirement date</option>
          <option value="empno">Sort: Employee no.</option>
          <option value="newest">Sort: Recently added</option>
        </select>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-2 xl:col-start-7">
          <button className="btn-primary flex-1">Apply filters</button>
          <Link href="/employees" className="btn-secondary">Reset</Link>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Designation</th><th>BPS</th><th>Department / Office</th><th>Status</th><th>Retirement</th><th className="text-right">Docs</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/employees/${e.id}`} className="flex items-center gap-3">
                      <Avatar name={e.full_name} id={e.id} hasPhoto={e.has_photo} size={36} />
                      <div>
                        <div className="font-medium text-navy hover:text-uok-700">{e.full_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted">{e.employee_no} <TypeBadge type={e.staff_type} /></div>
                      </div>
                    </Link>
                  </td>
                  <td>{e.designation ?? "—"}</td>
                  <td className="tabular-nums">{e.bps ?? "—"}</td>
                  <td className="max-w-64 text-muted">{e.unit_id ? <Link href={`/units/${e.unit_id}`} className="hover:text-uok-700">{e.unit}</Link> : "—"}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td className="whitespace-nowrap">{fmtDate(e.date_of_retirement)}<div className="text-xs text-muted">{remaining(e.date_of_retirement)}</div></td>
                  <td className="text-right tabular-nums">{e.docs || <span className="text-slate-300">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No employees match these filters.</Empty>}
        </div>
        <div className="border-t border-line px-4">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} makeHref={(p) => `/employees${toQueryString(f, { page: p })}`} />
        </div>
      </div>
    </>
  );
}
