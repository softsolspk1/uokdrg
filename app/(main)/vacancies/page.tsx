import Link from "next/link";
import { Search } from "lucide-react";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nf } from "@/lib/format";
import { Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Vacant Positions" };

type Row = { id: number; grp: string; post: string; department: string | null; bps: string | null; sanctioned: number; working: number; vacant: number; priority: number | null; remarks: string | null };

const GROUP_INFO: Record<string, { label: string; accent: "navy" | "crimson" | "gold" }> = {
  "BPS 1-16": { label: "Non-teaching · BPS 1-16", accent: "navy" },
  "BPS 17 & above": { label: "Non-teaching · BPS 17+", accent: "crimson" },
  Teaching: { label: "Teaching posts", accent: "gold" },
};

export default async function VacanciesPage({ searchParams }: { searchParams: Promise<{ grp?: string; q?: string; only?: string }> }) {
  await requireUser();
  const { grp = "", q = "", only = "" } = await searchParams;
  const params: unknown[] = [];
  const where: string[] = [];
  if (grp) { params.push(grp); where.push(`grp = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(post ILIKE $${params.length} OR department ILIKE $${params.length} OR remarks ILIKE $${params.length})`); }
  if (only === "fully") where.push("working = 0 AND sanctioned > 0");
  if (only === "vacant") where.push("vacant > 0");
  if (only === "excess") where.push("vacant < 0");
  if (only === "remarks") where.push("remarks IS NOT NULL");
  const rows = await query<Row>(
    `SELECT * FROM vacancies ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`, params);
  const all = await query<{ grp: string; sanctioned: number; working: number; vacant: number; lines: number }>(
    "SELECT grp, sum(sanctioned)::int sanctioned, sum(working)::int working, sum(vacant)::int vacant, count(*)::int lines FROM vacancies GROUP BY grp ORDER BY min(id)");

  const tot = rows.reduce((a, r) => ({ s: a.s + r.sanctioned, w: a.w + r.working, v: a.v + r.vacant }), { s: 0, w: 0, v: 0 });
  const showDept = rows.some((r) => r.department);
  const showRemarks = rows.some((r) => r.remarks);
  const href = (o: Record<string, string>) => {
    const u = new URLSearchParams({ grp, q, only, ...o });
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k);
    return `/vacancies?${u}`;
  };

  return (
    <>
      <PageHeader title="Vacant Positions"
        subtitle="Sanctioned, working and vacant positions — non-teaching statements (BPS-01 to 16, BPS-17 & above) and department-wise teaching positions" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {all.map((g) => (
          <Stat key={g.grp} label={`Vacant · ${GROUP_INFO[g.grp]?.label ?? g.grp}`} value={nf.format(g.vacant)}
            hint={`${nf.format(g.sanctioned)} sanctioned · ${nf.format(g.working)} working · ${g.lines} lines`}
            href={href({ grp: g.grp })} accent={GROUP_INFO[g.grp]?.accent ?? "uok"} />
        ))}
        <Stat label="Total vacant (net)" value={nf.format(all.reduce((a, g) => a + g.vacant, 0))}
          hint={`of ${nf.format(all.reduce((a, g) => a + g.sanctioned, 0))} sanctioned posts listed`} />
      </div>

      <form className="card mt-5 mb-4 flex flex-wrap gap-3 p-4" method="get">
        <div className="relative min-w-60 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Search post, department or remarks…" className="input pl-9" />
        </div>
        <select name="grp" defaultValue={grp} className="input w-auto">
          <option value="">All statements</option>
          {all.map((g) => <option key={g.grp} value={g.grp}>{GROUP_INFO[g.grp]?.label ?? g.grp}</option>)}
        </select>
        <select name="only" defaultValue={only} className="input w-auto">
          <option value="">All lines</option>
          <option value="vacant">With vacancies</option>
          <option value="fully">Fully vacant (none working)</option>
          <option value="excess">Working above sanctioned</option>
          <option value="remarks">With remarks</option>
        </select>
        <button className="btn-primary">Filter</button>
        <Link href="/vacancies" className="btn-secondary">Reset</Link>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>Post</th>{showDept && <th>Department / office</th>}<th>BPS</th><th>Statement</th><th className="text-right">Sanctioned</th><th className="text-right">Working</th><th className="text-right">Vacant</th><th>Filled</th>{showRemarks && <th>Remarks</th>}</tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = r.sanctioned ? Math.min(100, Math.round((r.working / r.sanctioned) * 100)) : 0;
                return (
                  <tr key={r.id}>
                    <td className="text-muted tabular-nums">{i + 1}</td>
                    <td className="font-medium text-navy">{r.post}</td>
                    {showDept && <td className="text-muted">{r.department ?? "University-wide"}</td>}
                    <td className="whitespace-nowrap">{r.bps}</td>
                    <td className="text-xs whitespace-nowrap text-muted">{GROUP_INFO[r.grp]?.label ?? r.grp}</td>
                    <td className="text-right tabular-nums">{r.sanctioned}</td>
                    <td className="text-right tabular-nums">{r.working}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {r.vacant < 0
                        ? <span className="text-sky-700" title="Working above sanctioned strength">+{-r.vacant} excess</span>
                        : <span className="text-uok-700">{r.vacant}</span>}
                    </td>
                    <td className="w-28" title={`${r.working} of ${r.sanctioned} filled`}>
                      <div className="h-1.5 rounded-full bg-uok-100"><div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} /></div>
                      <div className="mt-0.5 text-[11px] text-muted">{r.sanctioned ? Math.round((r.working / r.sanctioned) * 100) : 0}%</div>
                    </td>
                    {showRemarks && <td className="max-w-sm text-xs text-muted">{r.remarks}</td>}
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="bg-canvas font-semibold"><td /><td colSpan={showDept ? 4 : 3}>Total ({rows.length} lines)</td><td className="text-right tabular-nums">{tot.s}</td><td className="text-right tabular-nums">{tot.w}</td><td className="text-right text-uok-700 tabular-nums">{tot.v}</td><td />{showRemarks && <td />}</tr>
              )}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No positions match.</Empty>}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Sources: Vacant Positions BPS-1 to BPS-16 statement; Working, Budgeted & Vacant Positions (BPS-17 & above);
        Department-wise Teaching Positions. Vacant figures are net, as in the statements — where more incumbents work than posts are sanctioned the line shows an excess.
      </p>
    </>
  );
}
