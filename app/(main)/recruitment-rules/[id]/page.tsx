import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Empty, Field, PageHeader, StatusBadge } from "@/components/ui";

type Rule = {
  id: number; sr_label: string; post: string; post_title: string; num_posts: string | null; cadre: string | null;
  classification: string | null; scale: string | null; recruitment_mode: string | null; age_limit: string | null;
  qualification: string | null; probation: string | null; experience: string | null; job_description: string | null;
  departments: { department: string; posts: string | null }[];
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const r = await queryOne<{ post_title: string }>("SELECT post_title FROM recruitment_rules WHERE id = $1", [Number((await params).id) || 0]);
  return { title: r ? `${r.post_title} — Recruitment Rule` : "Recruitment Rule" };
}

/** Multi-line cells from the rules document: one paragraph per line; "OR" lines separate alternatives. */
function Lines({ text }: { text: string | null }) {
  if (!text) return <span className="text-slate-400">—</span>;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) return <p className="text-sm text-ink">{lines[0]}</p>;
  return (
    <ul className="space-y-1.5 text-sm text-ink">
      {lines.map((l, i) => /^(OR|AND)$/i.test(l)
        ? <li key={i} className="text-xs font-semibold tracking-wide text-muted uppercase">{l}</li>
        : <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-uok-700" />{l.replace(/;?\s*(OR|AND)$/i, "")}</li>)}
    </ul>
  );
}

export default async function RecruitmentRulePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const rule = await queryOne<Rule>("SELECT * FROM recruitment_rules WHERE id = $1", [id || 0]);
  if (!rule) notFound();

  // "Director (Physical Education)" → incumbents/vacancies are listed under the bare post name
  const base = rule.post.replace(/\s*\(.*\)\s*$/, "");
  const [incumbents, vacancies, siblings] = await Promise.all([
    query<{ id: number; full_name: string; designation: string; bps: number | null; unit: string | null; status: string; posting_label: string | null }>(
      `SELECT e.id, e.full_name, e.designation, e.bps, u.name unit, e.status, e.posting_label
       FROM employees e LEFT JOIN units u ON u.id = e.unit_id
       WHERE e.staff_type = 'Non-Teaching' AND (e.designation ILIKE $1 OR e.designation ILIKE $2) AND coalesce(e.bps, 17) >= 16
       ORDER BY e.bps DESC NULLS LAST, e.full_name LIMIT 60`, [base, `${base} /%`]),
    query<{ id: number; department: string | null; bps: string | null; sanctioned: number; working: number; vacant: number; remarks: string | null }>(
      `SELECT id, department, bps, sanctioned, working, vacant, remarks FROM vacancies
       WHERE grp = 'BPS 17 & above' AND (post ILIKE $1 OR post ILIKE $2) ORDER BY department`, [base, base.replace(/^Senior /i, "Sr. ")]),
    query<{ id: number; sr_label: string; post_title: string }>(
      "SELECT id, sr_label, post_title FROM recruitment_rules WHERE post = $1 AND id <> $2 ORDER BY sr_label", [rule.post, id]),
  ]);

  return (
    <>
      <div className="mb-3 text-sm text-muted"><Link href="/recruitment-rules" className="hover:text-uok-700">Recruitment Rules</Link> / <span className="text-ink">Sr. No. {rule.sr_label}</span></div>
      <PageHeader title={rule.post_title}
        subtitle={<>Recruitment Rules 2026 · Annexure-II, Sr. No. {rule.sr_label}{rule.scale && <> · {/^\d+$/.test(rule.scale) ? `BPS-${rule.scale}` : rule.scale}</>}</>} />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card p-5">
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Sanctioned scale" value={rule.scale} />
              <Field label="Number of posts" value={rule.num_posts} />
              <Field label="Maximum age" value={rule.age_limit} />
              <Field label="Cadre / classification" value={rule.cadre ?? rule.classification} />
              <div className="col-span-2"><Field label="Recruitment mode" value={rule.recruitment_mode && <Lines text={rule.recruitment_mode} />} /></div>
              <div className="col-span-2"><Field label="Probation" value={rule.probation} /></div>
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-navy">Minimum qualification & fitness</h2>
            <Lines text={rule.qualification} />
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-navy">Experience</h2>
            <Lines text={rule.experience} />
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-navy">Job description</h2>
            <Lines text={rule.job_description} />
          </section>
        </div>

        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">Sanctioned posts by department</h2><p className="text-xs text-muted">Annexure-I schedule</p></div>
            {rule.departments.length === 0 ? <Empty>Not listed in the schedule.</Empty> : (
              <table className="table">
                <tbody>
                  {rule.departments.map((d, i) => (
                    <tr key={i}><td>{d.department}</td><td className="text-right font-medium tabular-nums">{d.posts ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {vacancies.length > 0 && (
            <section className="card overflow-hidden">
              <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">Working & vacant (BPS-17+ statement)</h2></div>
              <table className="table">
                <thead><tr><th>Department</th><th className="text-right">Sanc.</th><th className="text-right">Work.</th><th className="text-right">Vac.</th></tr></thead>
                <tbody>
                  {vacancies.map((v) => (
                    <tr key={v.id} title={v.remarks ?? undefined}>
                      <td>{v.department}{v.remarks && <div className="mt-0.5 text-xs text-muted">{v.remarks}</div>}</td>
                      <td className="text-right tabular-nums">{v.sanctioned}</td>
                      <td className="text-right tabular-nums">{v.working}</td>
                      <td className="text-right font-semibold text-uok-700 tabular-nums">{v.vacant}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">Officers on record <span className="font-normal text-muted">({incumbents.length})</span></h2><p className="text-xs text-muted">Non-teaching employees designated “{base}”</p></div>
            {incumbents.length === 0 ? <Empty>No employees on record with this designation.</Empty> : (
              <ul className="divide-y divide-line">
                {incumbents.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
                    <div>
                      <Link href={`/employees/${e.id}`} className="font-medium text-navy hover:text-uok-700">{e.full_name}</Link>
                      <div className="text-xs text-muted">{e.posting_label ?? e.unit ?? "—"}{e.bps && ` · BPS-${e.bps}`}</div>
                    </div>
                    {e.status !== "Working" && <StatusBadge status={e.status} />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {siblings.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-2 font-semibold text-navy">Other rules for “{rule.post}”</h2>
              <ul className="space-y-1 text-sm">
                {siblings.map((s) => <li key={s.id}><Link href={`/recruitment-rules/${s.id}`} className="text-uok-700 hover:underline">{s.sr_label} · {s.post_title}</Link></li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
