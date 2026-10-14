import Link from "next/link";
import { Search } from "lucide-react";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Departments & Offices" };

type Row = { id: number; code: string; name: string; category: string; budgeted: number; working: number; teaching: number; nonteaching: number };

export default async function UnitsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  await requireUser();
  const { q, category } = await searchParams;
  const params: unknown[] = [];
  const where: string[] = [];
  if (q) { params.push(`%${q}%`); where.push(`u.name ILIKE $${params.length}`); }
  if (category) { params.push(category); where.push(`u.category = $${params.length}`); }

  const [rows, categories] = await Promise.all([
    query<Row>(
      `SELECT u.id, u.code, u.name, u.category,
              coalesce((SELECT sum(positions) FROM budget_posts b WHERE b.unit_id = u.id), 0)::int budgeted,
              count(e.id) FILTER (WHERE e.status <> 'Retired')::int working,
              count(e.id) FILTER (WHERE e.staff_type = 'Teaching')::int teaching,
              count(e.id) FILTER (WHERE e.staff_type = 'Non-Teaching')::int nonteaching
       FROM units u LEFT JOIN employees e ON e.unit_id = u.id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       GROUP BY u.id ORDER BY u.category, u.name`, params),
    query<{ category: string; n: number }>("SELECT category, count(*)::int n FROM units GROUP BY category ORDER BY category"),
  ]);

  const grouped = rows.reduce<Record<string, Row[]>>((acc, r) => ((acc[r.category] ??= []).push(r), acc), {});

  return (
    <>
      <PageHeader title="Departments & Offices" subtitle={`${rows.length} units · budgeted posts from the approved Budget Book vs staff on record`} />
      <form className="card mb-5 flex flex-wrap gap-3 p-4" method="get">
        <div className="relative min-w-60 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Search departments, institutes, offices…" className="input pl-9" />
        </div>
        <select name="category" defaultValue={category ?? ""} className="input w-auto">
          <option value="">All types</option>
          {categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.n})</option>)}
        </select>
        <button className="btn-primary">Filter</button>
      </form>

      {rows.length === 0 && <div className="card"><Empty>No units found.</Empty></div>}
      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{cat} <span className="font-normal">· {list.length}</span></h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((u) => {
                const pct = u.budgeted ? Math.min(100, Math.round((u.nonteaching / u.budgeted) * 100)) : 0;
                return (
                  <Link key={u.id} href={`/units/${u.id}`} className="card group p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-navy group-hover:text-uok-700">{u.name}</div>
                      <span className="badge shrink-0 bg-canvas text-muted">#{u.code}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div><div className="text-lg font-semibold text-navy tabular-nums">{u.teaching}</div><div className="text-muted">Faculty</div></div>
                      <div><div className="text-lg font-semibold text-navy tabular-nums">{u.nonteaching}</div><div className="text-muted">Staff</div></div>
                      <div><div className="text-lg font-semibold text-navy tabular-nums">{u.budgeted}</div><div className="text-muted">Budgeted</div></div>
                    </div>
                    {u.budgeted > 0 && (
                      <div className="mt-3" title={`${u.nonteaching} non-teaching staff against ${u.budgeted} budgeted posts`}>
                        <div className="h-1.5 rounded-full bg-canvas"><div className="h-full rounded-full bg-uok-700" style={{ width: `${pct}%` }} /></div>
                        <div className="mt-1 text-[11px] text-muted">{pct}% of budgeted non-teaching posts filled</div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
