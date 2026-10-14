import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "DRG Office" };

type Staff = {
  id: number; name: string; designation: string | null; section: string | null; duties: string | null;
  employee_id: number | null; employee_no: string | null; bps: number | null; jd_position: string | null;
};

export default async function DrgOfficePage() {
  await requireUser();
  const [sections, staff, jds, unit] = await Promise.all([
    query<{ id: number; sort: number; name: string; description: string | null }>("SELECT * FROM office_sections ORDER BY sort"),
    query<Staff>(
      `SELECT s.id, s.name, s.designation, s.section, s.duties, s.employee_id, e.employee_no, e.bps, j.position jd_position
       FROM office_staff s LEFT JOIN employees e ON e.id = s.employee_id LEFT JOIN job_descriptions j ON j.id = s.job_description_id
       ORDER BY s.sort, s.id`),
    query<{ id: number; position: string; summary: string | null; duties: string[] }>("SELECT * FROM job_descriptions ORDER BY sort"),
    queryOne<{ id: number; staff: number }>(
      `SELECT u.id, (SELECT count(*)::int FROM employees e WHERE e.unit_id = u.id) staff
       FROM units u WHERE u.name ILIKE 'Deputy Registrar (general%' LIMIT 1`),
  ]);
  const officers = staff.filter((s) => s.section?.startsWith("Office of"));
  const bySection = (name: string) => staff.filter((s) => s.section === name);
  const unassigned = staff.filter((s) => !s.section);

  const person = (s: Staff) => s.employee_id
    ? <Link href={`/employees/${s.employee_id}`} className="font-medium text-navy hover:text-uok-700">{s.name}</Link>
    : <span className="font-medium text-navy">{s.name}</span>;

  return (
    <>
      <PageHeader title="Office of the Deputy Registrar (General)"
        subtitle="Sections of the DRG office, their workings, staff assignments and job descriptions"
        actions={unit && <Link href={`/units/${unit.id}`} className="btn-secondary">Budget book unit</Link>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sections" value={sections.length} hint="Service matters, records & correspondence" />
        <Stat label="Staff with assignments" value={staff.length} hint={`${staff.filter((s) => s.employee_id).length} linked to employee records`} accent="navy" />
        <Stat label="Job descriptions" value={jds.length} hint="Positions in the office" accent="gold" />
        <Stat label="Personal & leave files" value="3,300–3,600" hint="N.T.I, II, III, Technical & Officers sections" accent="crimson" />
      </div>

      {officers.length > 0 && (
        <section className="card mt-5 flex flex-wrap gap-x-8 gap-y-3 p-5">
          {officers.map((o) => (
            <div key={o.id}>
              <div className="text-xs tracking-wide text-muted uppercase">{o.jd_position}</div>
              <div className="mt-0.5">{person(o)}</div>
              {o.designation !== o.jd_position && <div className="text-xs text-muted">{o.designation}</div>}
            </div>
          ))}
        </section>
      )}

      <h2 className="mt-8 mb-3 font-serif text-lg font-bold text-navy">Sections & their workings</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((sec) => {
          const members = bySection(sec.name);
          return (
            <section key={sec.id} className="card flex flex-col p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gold tabular-nums">{String(sec.sort).padStart(2, "0")}</span>
                <h3 className="font-semibold text-navy">{sec.name}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{sec.description}</p>
              {members.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-line pt-3">
                  {members.map((m) => (
                    <li key={m.id} className="text-sm">
                      {person(m)} <span className="text-xs text-muted">· {m.designation}</span>
                      {m.duties && <p className="mt-0.5 text-xs text-muted">{m.duties}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 font-serif text-lg font-bold text-navy">Staff of the office</h2>
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Employee no.</th><th>Designation</th><th>Section</th><th>Main section-specific work</th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>{person(s)}</td>
                  <td className="text-xs whitespace-nowrap text-muted">{s.employee_no ?? <span title="Not matched to an employee record">—</span>}</td>
                  <td>{s.designation}{s.bps && <span className="text-muted"> · BPS-{s.bps}</span>}</td>
                  <td className="whitespace-nowrap">{s.section?.startsWith("Office of") ? "—" : s.section ?? "—"}</td>
                  <td className="max-w-md text-xs text-muted">{s.duties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {unassigned.length > 0 && <p className="px-5 py-3 text-xs text-muted">Messengers / helpers serve the office as a whole and are not assigned to a section.</p>}
      </section>

      <h2 className="mt-8 mb-3 font-serif text-lg font-bold text-navy">Job descriptions</h2>
      <div className="space-y-3">
        {jds.map((jd) => {
          const holders = staff.filter((s) => s.jd_position === jd.position);
          return (
            <details key={jd.id} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-semibold text-navy">{jd.position}</span>
                <span className="text-xs text-muted">{jd.duties.length} duties · {holders.length} {holders.length === 1 ? "person" : "people"}
                  <span className="ml-2 inline-block transition-transform group-open:rotate-90">›</span></span>
              </summary>
              {jd.summary && <p className="mt-3 text-sm text-muted">{jd.summary}</p>}
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink">
                {jd.duties.map((d, i) => <li key={i}>{d}</li>)}
              </ol>
              {holders.length > 0 && (
                <p className="mt-3 text-xs text-muted">Performing these duties: {holders.map((h, i) => <span key={h.id}>{i > 0 && ", "}{person(h)}</span>)}</p>
              )}
            </details>
          );
        })}
      </div>
    </>
  );
}
