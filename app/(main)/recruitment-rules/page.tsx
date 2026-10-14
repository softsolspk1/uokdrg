import Link from "next/link";
import { Search } from "lucide-react";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Recruitment Rules" };

type Rule = {
  id: number; sr_label: string; post: string; post_title: string; num_posts: string | null; scale: string | null;
  recruitment_mode: string | null; age_limit: string | null; departments: { department: string; posts: string | null }[];
};

export default async function RecruitmentRulesPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string }> }) {
  await requireUser();
  const { q = "", view = "" } = await searchParams;
  const params: unknown[] = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE post_title ILIKE $1 OR qualification ILIKE $1 OR job_description ILIKE $1 OR departments::text ILIKE $1`;
  }
  const [rules, general] = await Promise.all([
    query<Rule>(`SELECT id, sr_label, post, post_title, num_posts, scale, recruitment_mode, age_limit, departments
                 FROM recruitment_rules ${where} ORDER BY sr_no, sr_label`, params),
    view === "general" ? query<{ id: number; text: string; heading: boolean }>("SELECT * FROM recruitment_rules_text ORDER BY sort") : Promise.resolve([]),
  ]);
  const tab = (key: string, label: string) => (
    <Link href={key ? `/recruitment-rules?view=${key}` : "/recruitment-rules"}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap ${view === key ? "border-uok-700 text-uok-700" : "border-transparent text-muted hover:text-ink"}`}>
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Recruitment Rules, 2026"
        subtitle="Officers Recruitment Rules for non-teaching & technical posts in BPS-17 and above, plus ORIC and Consultant Cardiologist contractual posts — approved by the Syndicate on 21-01-2026 (Resolution No. 5)" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Posts with rules" value={rules.length} hint={q ? `matching “${q}”` : "Annexure-II"} />
        <Stat label="Selection" value="60 / 40" hint="BPS-17: selection board / promotion" accent="navy" />
        <Stat label="Probation" value="1 year" hint="Extendable by up to one year" accent="gold" />
        <Stat label="Promotion service" value="5 · 12 · 15" hint="Years for BPS-18 · 19 · 20" accent="crimson" />
      </div>

      <nav className="mt-5 flex gap-1 border-b border-line">
        {tab("", "Posts & eligibility")}
        {tab("general", "General provisions")}
      </nav>

      {view === "general" ? (
        <section className="card mt-5 max-w-4xl p-6">
          {general.map((g) => g.heading
            ? <h2 key={g.id} className="mt-6 mb-2 font-semibold text-navy first:mt-0">{g.text.replace(/:$/, "")}</h2>
            : <p key={g.id} className="mb-2 text-sm leading-relaxed text-ink">{g.text}</p>)}
        </section>
      ) : (
        <>
          <form className="card mt-5 mb-4 flex flex-wrap gap-3 p-4" method="get">
            <div className="relative min-w-60 flex-1">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} placeholder="Search post, department, qualification or duties…" className="input pl-9" />
            </div>
            <button className="btn-primary">Search</button>
            <Link href="/recruitment-rules" className="btn-secondary">Reset</Link>
          </form>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Sr.</th><th>Post</th><th>Scale</th><th className="text-right">Posts</th><th>Recruitment mode</th><th>Age limit</th><th>Departments (Annexure-I)</th></tr></thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className="text-muted tabular-nums">{r.sr_label}</td>
                      <td><Link href={`/recruitment-rules/${r.id}`} className="font-medium text-navy hover:text-uok-700">{r.post_title}</Link></td>
                      <td className="whitespace-nowrap">{r.scale ? (/^\d+$/.test(r.scale) ? `BPS-${r.scale}` : r.scale) : "—"}</td>
                      <td className="text-right tabular-nums">{r.num_posts ?? "—"}</td>
                      <td className="text-xs text-muted">{r.recruitment_mode?.split("\n")[0]}</td>
                      <td className="text-xs whitespace-nowrap text-muted">{r.age_limit?.split("\n")[0]}</td>
                      <td className="text-xs text-muted">{r.departments.map((d) => d.department).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rules.length === 0 && <Empty>No recruitment rules match.</Empty>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
