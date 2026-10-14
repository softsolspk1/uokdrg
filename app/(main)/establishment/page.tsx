import Link from "next/link";
import { Search } from "lucide-react";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nf } from "@/lib/format";
import { Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Establishment" };

type Row = {
  id: number; post: string; bps: number | null; approved_2006_10: number; approved_after_2010: number; abolished: number;
  total: number; working: number | null; remarks: string | null; rule_id: number | null;
};

export default async function EstablishmentPage({ searchParams }: { searchParams: Promise<{ q?: string; bps?: string; band?: string }> }) {
  await requireUser();
  const { q = "", bps = "", band = "" } = await searchParams;
  const params: unknown[] = [];
  const where: string[] = [];
  if (q) { params.push(`%${q}%`); where.push(`p.post ILIKE $${params.length}`); }
  if (bps) { params.push(Number(bps) || 0); where.push(`p.bps = $${params.length}`); }
  if (band === "low") where.push("p.bps <= 16");
  if (band === "officers") where.push("p.bps >= 17");

  const [rows, byBps, totals] = await Promise.all([
    query<Row>(
      `SELECT p.*, (SELECT r.id FROM recruitment_rules r WHERE lower(r.post) = lower(p.post) ORDER BY r.sr_no LIMIT 1) rule_id
       FROM establishment_posts p ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.post, p.bps`, params),
    query<{ bps: number | null; lines: number; total: number; working: number | null }>(
      `SELECT bps, count(*)::int lines, sum(total)::int total, sum(working)::int working
       FROM establishment_posts GROUP BY bps ORDER BY bps NULLS LAST`),
    query<{ band: string; total: number; working: number | null; after: number; abolished: number }>(
      `SELECT CASE WHEN bps <= 16 THEN 'low' ELSE 'officers' END band, sum(total)::int total, sum(working)::int working,
              sum(approved_after_2010)::int after, sum(abolished)::int abolished
       FROM establishment_posts GROUP BY 1`),
  ]);
  const low = totals.find((t) => t.band === "low");
  const off = totals.find((t) => t.band === "officers");
  const sum = (k: "total" | "after" | "abolished") => totals.reduce((a, t) => a + (t[k] ?? 0), 0);

  const href = (o: Record<string, string>) => {
    const u = new URLSearchParams({ q, bps, band, ...o });
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k);
    return `/establishment?${u}`;
  };
  const gap = (r: { total: number; working: number | null }) => (r.working === null ? null : r.total - r.working);

  return (
    <>
      <PageHeader title="Establishment"
        subtitle="Post-wise sanctioned strength of the non-teaching cadre (BPS-01 to 22) — posts approved in the Budget Book 2006-10, approved after 2010, and abolished" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total approved posts" value={nf.format(sum("total"))} hint={`${nf.format(sum("after"))} approved after 2010 · ${sum("abolished")} abolished`} href="/establishment" />
        <Stat label="BPS 1-16 approved" value={nf.format(low?.total ?? 0)} hint={`${nf.format(low?.working ?? 0)} working`} href={href({ band: "low", bps: "" })} accent="navy" />
        <Stat label="BPS 1-16 net vacant" value={nf.format((low?.total ?? 0) - (low?.working ?? 0))} hint="Approved minus working" accent="crimson" />
        <Stat label="BPS 17+ approved" value={nf.format(off?.total ?? 0)} hint="Officer posts · working shown on Vacant Positions" href={href({ band: "officers", bps: "" })} accent="gold" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
        <div>
          <form className="card mb-4 flex flex-wrap gap-3 p-4" method="get">
            <div className="relative min-w-60 flex-1">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} placeholder="Search post…" className="input pl-9" />
            </div>
            <select name="band" defaultValue={band} className="input w-auto">
              <option value="">All scales</option>
              <option value="low">BPS 1-16</option>
              <option value="officers">BPS 17 & above</option>
            </select>
            <select name="bps" defaultValue={bps} className="input w-auto">
              <option value="">Any BPS</option>
              {byBps.filter((b) => b.bps).map((b) => <option key={b.bps} value={b.bps!}>BPS-{b.bps}</option>)}
            </select>
            <button className="btn-primary">Filter</button>
            <Link href="/establishment" className="btn-secondary">Reset</Link>
          </form>

          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr>
                  <th>Post</th><th>BPS</th>
                  <th className="text-right" title="Approved in Budget Book 2006-10">2006-10</th>
                  <th className="text-right" title="Approved after 2010">After 2010</th>
                  <th className="text-right" title="Approved in 2006-10 and abolished afterwards">Abolished</th>
                  <th className="text-right">Total approved</th><th className="text-right">Working</th><th className="text-right">Vacant</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const g = gap(r);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="font-medium text-navy">{r.post}</span>
                          {r.remarks && <span className="badge ml-2 bg-amber-50 text-amber-800 ring-1 ring-amber-200">{r.remarks}</span>}
                          {r.rule_id && <Link href={`/recruitment-rules/${r.rule_id}`} className="ml-2 text-xs text-uok-700 hover:underline">Recruitment rule</Link>}
                        </td>
                        <td className="tabular-nums">{r.bps ?? "—"}</td>
                        <td className="text-right tabular-nums">{r.approved_2006_10 || ""}</td>
                        <td className="text-right tabular-nums">{r.approved_after_2010 || ""}</td>
                        <td className="text-right tabular-nums">{r.abolished || ""}</td>
                        <td className="text-right font-medium tabular-nums">{r.total}</td>
                        <td className="text-right tabular-nums">{r.working ?? <span className="text-slate-400">—</span>}</td>
                        <td className="text-right font-semibold tabular-nums">
                          {g === null ? "" : g < 0 ? <span className="text-sky-700" title="Working above approved strength">+{-g} excess</span> : <span className="text-uok-700">{g}</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length > 0 && (
                    <tr className="bg-canvas font-semibold">
                      <td>Total ({rows.length} posts)</td><td />
                      <td className="text-right tabular-nums">{rows.reduce((a, r) => a + r.approved_2006_10, 0)}</td>
                      <td className="text-right tabular-nums">{rows.reduce((a, r) => a + r.approved_after_2010, 0)}</td>
                      <td className="text-right tabular-nums">{rows.reduce((a, r) => a + r.abolished, 0)}</td>
                      <td className="text-right tabular-nums">{rows.reduce((a, r) => a + r.total, 0)}</td>
                      <td className="text-right tabular-nums">{rows.reduce((a, r) => a + (r.working ?? 0), 0)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
              {rows.length === 0 && <Empty>No posts match.</Empty>}
            </div>
          </section>
        </div>

        <section className="card self-start overflow-hidden">
          <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">By pay scale</h2><p className="text-xs text-muted">Approved posts and working staff per BPS</p></div>
          <table className="table">
            <thead><tr><th>BPS</th><th className="text-right">Posts</th><th className="text-right">Approved</th><th className="text-right">Working</th></tr></thead>
            <tbody>
              {byBps.map((b) => (
                <tr key={b.bps ?? "nil"}>
                  <td>{b.bps ? <Link href={href({ bps: String(b.bps), band: "" })} className="text-navy hover:text-uok-700">BPS-{String(b.bps).padStart(2, "0")}</Link> : <span className="text-muted">Not specified</span>}</td>
                  <td className="text-right text-muted tabular-nums">{b.lines}</td>
                  <td className="text-right font-medium tabular-nums">{nf.format(b.total)}</td>
                  <td className="text-right tabular-nums">{b.working === null ? "—" : nf.format(b.working)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <p className="mt-3 text-xs text-muted">Source: Budget proforma — Employees of Non-Teaching Cadre, vacancy position BPS-01 to BPS-22.</p>
    </>
  );
}
