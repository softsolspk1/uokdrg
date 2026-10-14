export type EmployeeFilters = {
  q?: string;
  type?: string;
  unit?: string;
  designation?: string;
  bps?: string;
  status?: string;
  gender?: string;
  sort?: string;
};

const SORTS: Record<string, string> = {
  name: "e.full_name ASC",
  bps: "e.bps DESC NULLS LAST, e.full_name",
  retirement: "e.date_of_retirement ASC NULLS LAST",
  unit: "u.name ASC NULLS LAST, e.bps DESC NULLS LAST",
  newest: "e.created_at DESC",
  empno: "e.employee_no",
};

export function readFilters(sp: Record<string, string | string[] | undefined>): EmployeeFilters {
  const g = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  return { q: g("q"), type: g("type"), unit: g("unit"), designation: g("designation"), bps: g("bps"), status: g("status"), gender: g("gender"), sort: g("sort") };
}

/** Builds a WHERE clause (aliases: e = employees, u = units) and its parameters. */
export function buildWhere(f: EmployeeFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll("$?", `$${params.length}`));
  };
  if (f.q) add("(e.full_name ILIKE $? OR e.employee_no ILIKE $? OR e.cnic ILIKE $? OR e.designation ILIKE $? OR e.personnel_file_no ILIKE $?)", `%${f.q}%`);
  if (f.type) add("e.staff_type = $?", f.type);
  if (f.unit) add("e.unit_id = $?", Number(f.unit));
  if (f.designation) add("e.designation ILIKE $?", f.designation);
  if (f.bps) add("e.bps = $?", Number(f.bps));
  if (f.gender) add("e.gender = $?", f.gender);
  if (f.status === "away") where.push("e.status <> 'Working' AND e.status NOT IN ('Retired','Resigned','Terminated','Deceased')");
  else if (f.status) add("e.status = $?", f.status);
  return {
    sql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
    order: SORTS[f.sort ?? ""] ?? SORTS.unit,
  };
}

export function toQueryString(f: EmployeeFilters, extra: Record<string, string | number> = {}) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v !== undefined && v !== "") usp.set(k, String(v));
  const s = usp.toString();
  return s ? `?${s}` : "";
}
