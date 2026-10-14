import Link from "next/link";
import { initials } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  Working: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  "Study Leave": "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  "Foreign Study Leave": "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  "Leave (Other)": "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  "Unauthorized Absence": "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  "On Lien": "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  Deputation: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  Suspended: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"}`}>{status}</span>;
}

export function TypeBadge({ type }: { type: string }) {
  return type === "Teaching"
    ? <span className="badge bg-uok-50 text-uok-700 ring-1 ring-uok-200">Teaching</span>
    : <span className="badge bg-slate-100 text-navy ring-1 ring-slate-200">Non-Teaching</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ name, id, hasPhoto, size = 40 }: { name: string; id: number; hasPhoto?: boolean; size?: number }) {
  if (hasPhoto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/employees/${id}/photo`} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-uok-100 font-semibold text-uok-700"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name) || "?"}
    </div>
  );
}

export function Stat({ label, value, hint, href, accent = "uok" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; accent?: "uok" | "navy" | "gold" | "crimson" }) {
  const bar = { uok: "bg-uok-700", navy: "bg-navy", gold: "bg-gold", crimson: "bg-crimson" }[accent];
  const body = (
    <div className="card relative overflow-hidden p-4 transition-shadow hover:shadow-md">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-navy tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Single-series horizontal bar list: one hue, value labels in ink, native tooltip on hover. */
export function BarList({ data, unit = "employees", hrefFor }: { data: { label: string; value: number; key?: string }[]; unit?: string; hrefFor?: (key: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const row = (
          <div className="group grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm" title={`${d.label}: ${d.value.toLocaleString()} ${unit}`}>
            <span className="truncate text-muted group-hover:text-ink">{d.label}</span>
            <span className="h-3.5 rounded-r bg-canvas">
              <span className="block h-full rounded-r bg-uok-700 transition-colors group-hover:bg-crimson" style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="text-right font-medium text-ink tabular-nums">{d.value.toLocaleString()}</span>
          </div>
        );
        return <li key={d.label}>{hrefFor && d.key ? <Link href={hrefFor(d.key)}>{row}</Link> : row}</li>;
      })}
    </ul>
  );
}

export function Pagination({ page, total, pageSize, makeHref }: { page: number; total: number; pageSize: number; makeHref: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))).sort((a, b) => a - b);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm text-muted">
      <span>Page {page} of {pages} · {total.toLocaleString()} records</span>
      <div className="flex items-center gap-1">
        {page > 1 && <Link className="btn-secondary btn-sm" href={makeHref(page - 1)}>Previous</Link>}
        {nums.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && nums[i - 1] !== p - 1 && <span className="px-1">…</span>}
            <Link href={makeHref(p)} className={`btn-sm btn ${p === page ? "bg-uok-700 text-white" : "border border-line bg-white hover:bg-canvas"}`}>{p}</Link>
          </span>
        ))}
        {page < pages && <Link className="btn-secondary btn-sm" href={makeHref(page + 1)}>Next</Link>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>;
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value === null || value === undefined || value === "" ? <span className="text-slate-400">—</span> : value}</dd>
    </div>
  );
}
