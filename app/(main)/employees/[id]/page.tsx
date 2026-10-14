import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, FileText, Pencil, Printer } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { canEdit, requireUser } from "@/lib/auth";
import { DOCUMENT_CATEGORIES, LEAVE_TYPES, RELATIONS, SERVICE_EVENTS } from "@/lib/constants";
import { age, fmtBytes, fmtDate, fmtDateTime, remaining } from "@/lib/format";
import { deleteChild, deleteDocument, deleteEmployee, removePhoto } from "@/app/actions/employees";
import { Avatar, Empty, Field, StatusBadge, TypeBadge } from "@/components/ui";
import { AddRecordForm, ConfirmButton, DocumentUploader, type FieldSpec } from "@/components/record-forms";

type Emp = Record<string, string | number | boolean | null> & {
  id: number; full_name: string; employee_no: string; staff_type: string; status: string; unit_name: string | null; unit_id: number | null; unit_category: string | null; has_photo: boolean;
};

const TABS = [
  ["overview", "Overview"],
  ["service", "Service history"],
  ["charges", "Admin charges"],
  ["qualifications", "Qualifications"],
  ["experience", "Experience"],
  ["family", "Family"],
  ["leaves", "Leaves"],
  ["documents", "Documents"],
] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await queryOne<{ full_name: string }>("SELECT full_name FROM employees WHERE id = $1", [Number(id) || 0]);
  return { title: e?.full_name ?? "Employee" };
}

export default async function EmployeeProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const editable = canEdit(user);
  const id = Number((await params).id);
  const tab = (await searchParams).tab ?? "overview";
  if (!id) notFound();

  const emp = await queryOne<Emp>(
    `SELECT e.*, (e.photo IS NOT NULL) has_photo, u.name unit_name, u.category unit_category
     FROM employees e LEFT JOIN units u ON u.id = e.unit_id WHERE e.id = $1`, [id]);
  if (!emp) notFound();
  delete emp.photo;

  const [counts, rows, assignment, rule] = await Promise.all([
    queryOne<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM service_records WHERE employee_id = $1) service,
              (SELECT count(*)::int FROM employee_charges WHERE employee_id = $1) charges,
              (SELECT count(*)::int FROM qualifications WHERE employee_id = $1) qualifications,
              (SELECT count(*)::int FROM experiences WHERE employee_id = $1) experience,
              (SELECT count(*)::int FROM family_members WHERE employee_id = $1) family,
              (SELECT count(*)::int FROM leaves WHERE employee_id = $1) leaves,
              (SELECT count(*)::int FROM documents WHERE employee_id = $1) documents`, [id]),
    loadTab(tab, id),
    queryOne<{ section: string | null; duties: string | null; designation: string | null }>(
      "SELECT section, duties, designation FROM office_staff WHERE employee_id = $1 LIMIT 1", [id]),
    emp.staff_type === "Non-Teaching" && Number(emp.bps) >= 17 && emp.designation
      ? queryOne<{ id: number; post_title: string }>(
        `SELECT id, post_title FROM recruitment_rules
         WHERE lower(post) = lower($1) OR lower(post) = lower(regexp_replace($1, '\\s*/.*$', '')) ORDER BY sr_no LIMIT 1`, [emp.designation])
      : Promise.resolve(null),
  ]);

  const s = (k: string) => (emp[k] as string | null) ?? null;
  const delChild = (kind: string, rid: number) => deleteChild.bind(null, kind, rid, id);

  return (
    <>
      <div className="mb-3 text-sm text-muted">
        <Link href="/employees" className="hover:text-uok-700">Employees</Link> / <span className="text-ink">{emp.employee_no}</span>
      </div>

      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-uok-700 via-uok-600 to-crimson" />
        <div className="flex flex-wrap items-end gap-5 px-6 pb-5">
          <div className="-mt-10 rounded-full bg-white p-1 shadow">
            <Avatar name={emp.full_name} id={emp.id} hasPhoto={emp.has_photo} size={96} />
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="font-serif text-2xl font-bold text-navy">{emp.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-medium text-ink">{s("designation") ?? "—"}</span>
              {emp.bps && <span>· BPS-{emp.bps}</span>}
              {emp.unit_id && <>· <Link href={`/units/${emp.unit_id}`} className="hover:text-uok-700">{emp.unit_name}</Link></>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <TypeBadge type={emp.staff_type} />
              <StatusBadge status={emp.status} />
              <span className="badge bg-gold-100 text-amber-900 ring-1 ring-amber-200">{emp.employee_no}</span>
              {s("status_remarks") && <span className="badge bg-slate-100 text-slate-600">{s("status_remarks")}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/print/employees/${id}`} className="btn-secondary" target="_blank"><Printer size={15} /> Profile sheet</Link>
            {editable && <Link href={`/employees/${id}/edit`} className="btn-primary"><Pencil size={15} /> Edit</Link>}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line text-center sm:grid-cols-4">
          {[
            ["Age", age(s("date_of_birth")) ?? "—"],
            ["Retirement", fmtDate(s("date_of_retirement"))],
            ["Service left", remaining(s("date_of_retirement")) ?? "—"],
            ["Documents", counts?.documents ?? 0],
          ].map(([k, v]) => (
            <div key={k as string} className="border-line px-4 py-3 not-last:border-r">
              <div className="text-xs tracking-wide text-muted uppercase">{k}</div>
              <div className="font-semibold text-navy">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {TABS.map(([key, label]) => {
          const c = key === "overview" ? null : counts?.[key];
          return (
            <Link key={key} href={`/employees/${id}?tab=${key}`} scroll={false}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap ${tab === key ? "border-uok-700 text-uok-700" : "border-transparent text-muted hover:text-ink"}`}>
              {label}{c ? <span className="ml-1.5 rounded-full bg-canvas px-1.5 text-xs text-muted">{c}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-navy">Personal information</h2>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Father / husband" value={s("father_name")} />
                <Field label="CNIC" value={s("cnic")} />
                <Field label="Gender" value={s("gender")} />
                <Field label="Date of birth" value={s("date_of_birth") && <>{fmtDate(s("date_of_birth"))}{emp.dob_derived && <span className="ml-1 text-xs text-muted" title="Computed from date of retirement (age 60)">(derived)</span>}</>} />
                <Field label="Marital status" value={s("marital_status")} />
                <Field label="Religion" value={s("religion")} />
                <Field label="Nationality" value={s("nationality")} />
                <Field label="Domicile" value={s("domicile")} />
                <Field label="Blood group" value={s("blood_group")} />
              </dl>
            </section>
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-navy">Employment</h2>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Staff type" value={emp.staff_type} />
                <Field label="Employment type" value={s("employment_type")} />
                <Field label="Designation" value={s("designation")} />
                <Field label="BPS" value={emp.bps} />
                <Field label="Department / office" value={emp.unit_name} />
                <Field label="Unit type" value={emp.unit_category} />
                <Field label="Date of joining" value={s("date_of_joining") && fmtDate(s("date_of_joining"))} />
                <Field label="Current post since" value={s("date_of_current_post") && fmtDate(s("date_of_current_post"))} />
                <Field label="Date of retirement" value={fmtDate(s("date_of_retirement"))} />
                <Field label="Personal file no." value={s("personnel_file_no")} />
                {s("director_id") && <Field label="Director ID" value={s("director_id")} />}
                {s("posting_label") && <Field label="Posting / office (as listed)" value={s("posting_label")} />}
                {rule && <Field label="Recruitment rule" value={<Link href={`/recruitment-rules/${rule.id}`} className="text-uok-700 hover:underline">{rule.post_title}</Link>} />}
              </dl>
              {assignment && (
                <div className="mt-5 rounded-lg border border-line bg-canvas p-3 text-sm">
                  <div className="text-xs font-medium tracking-wide text-muted uppercase">Assignment in the DRG office</div>
                  <div className="mt-1 font-medium text-navy">
                    <Link href="/drg-office" className="hover:text-uok-700">{assignment.section?.startsWith("Office of") ? assignment.designation : assignment.section ?? assignment.designation}</Link>
                  </div>
                  {assignment.duties && <p className="mt-1 text-xs text-muted">{assignment.duties}</p>}
                </div>
              )}
            </section>
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-navy">Contact</h2>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Mobile" value={s("mobile")} />
                <Field label="Phone" value={s("phone")} />
                <Field label="Email" value={s("email") && <a className="text-uok-700 hover:underline" href={`mailto:${s("email")}`}>{s("email")}</a>} />
                <Field label="City" value={s("city")} />
                <div className="col-span-2"><Field label="Present address" value={s("present_address")} /></div>
                <div className="col-span-2"><Field label="Permanent address" value={s("permanent_address")} /></div>
                <Field label="Emergency contact" value={s("emergency_name") && `${s("emergency_name")}${s("emergency_relation") ? ` (${s("emergency_relation")})` : ""}`} />
                <Field label="Emergency phone" value={s("emergency_phone")} />
              </dl>
            </section>
            <section className="card p-5">
              <h2 className="mb-4 font-semibold text-navy">Pay & bank</h2>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Basic pay" value={emp.basic_pay ? `PKR ${Number(emp.basic_pay).toLocaleString()}` : null} />
                <Field label="NTN" value={s("ntn")} />
                <Field label="Bank" value={s("bank_name")} />
                <Field label="Branch" value={s("bank_branch")} />
                <div className="col-span-2"><Field label="Account / IBAN" value={s("bank_account")} /></div>
              </dl>
              <h2 className="mt-6 mb-2 font-semibold text-navy">Remarks</h2>
              <p className="text-sm whitespace-pre-wrap text-ink">{s("remarks") ?? <span className="text-slate-400">—</span>}</p>
              <p className="mt-4 text-xs text-muted">Source: {s("source")} · Last updated {fmtDateTime(emp.updated_at as string)}</p>
            </section>
            {editable && (
              <section className="card flex flex-wrap items-center justify-between gap-3 p-5 lg:col-span-2">
                <div className="text-sm text-muted">Record management</div>
                <div className="flex gap-2">
                  {emp.has_photo && <ConfirmButton small={false} label="Remove photo" confirmLabel="Remove photo?" onConfirm={removePhoto.bind(null, id)} />}
                  {user.role === "admin" && <ConfirmButton small={false} label="Delete employee" confirmLabel="Delete permanently?" onConfirm={deleteEmployee.bind(null, id)} />}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "service" && (
          <RecordTable title="Service history" kind="service" employeeId={id} editable={editable} rows={rows}
            add="Add service record" fields={SERVICE_FIELDS}
            cols={[["event_type", "Event"], ["effective_date", "Effective", "date"], ["designation", "Designation"], ["bps", "BPS"], ["unit_name", "Department / office"], ["order_no", "Order no."], ["remarks", "Remarks"]]}
            onDelete={delChild} />
        )}
        {tab === "charges" && (
          <RecordTable title="Administrative charges" kind="charge" employeeId={id} editable={editable} rows={rows}
            add="Add charge" fields={CHARGE_FIELDS}
            cols={[["role", "Role"], ["unit_name", "Department / institute"], ["present_from", "Present term from", "date"], ["present_to", "Present term to"], ["second_term", "Second term"], ["first_from", "First term from", "date"], ["first_to", "First term to", "date"], ["notes", "Notes"]]}
            onDelete={delChild} />
        )}
        {tab === "qualifications" && (
          <RecordTable title="Academic qualifications" kind="qualification" employeeId={id} editable={editable} rows={rows}
            add="Add qualification" fields={QUAL_FIELDS}
            cols={[["degree", "Degree"], ["specialization", "Specialization"], ["institution", "Institution / board"], ["passing_year", "Year"], ["grade", "Division / CGPA"]]}
            onDelete={delChild} />
        )}
        {tab === "experience" && (
          <RecordTable title="Previous experience" kind="experience" employeeId={id} editable={editable} rows={rows}
            add="Add experience" fields={EXP_FIELDS}
            cols={[["organization", "Organization"], ["designation", "Designation"], ["from_date", "From", "date"], ["to_date", "To", "date"], ["remarks", "Remarks"]]}
            onDelete={delChild} />
        )}
        {tab === "family" && (
          <RecordTable title="Family members / dependents" kind="family" employeeId={id} editable={editable} rows={rows}
            add="Add family member" fields={FAMILY_FIELDS}
            cols={[["name", "Name"], ["relation", "Relation"], ["date_of_birth", "Date of birth", "date"], ["cnic", "CNIC / B-Form"], ["occupation", "Occupation"]]}
            onDelete={delChild} />
        )}
        {tab === "leaves" && (
          <RecordTable title="Leave record" kind="leave" employeeId={id} editable={editable} rows={rows}
            add="Add leave" fields={LEAVE_FIELDS}
            cols={[["leave_type", "Type"], ["from_date", "From", "date"], ["to_date", "To", "date"], ["days", "Days"], ["status", "Status"], ["order_no", "Order no."], ["remarks", "Remarks"]]}
            onDelete={delChild} />
        )}
        {tab === "documents" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="card overflow-hidden">
              <div className="px-5 pt-5 pb-3"><h2 className="font-semibold text-navy">Documents</h2></div>
              {rows.length === 0 ? <Empty>No documents uploaded yet.</Empty> : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr key={d.id as number}>
                          <td>
                            <div className="flex items-start gap-2">
                              <FileText size={18} className="mt-0.5 shrink-0 text-uok-700" />
                              <div><div className="font-medium text-navy">{d.title as string}</div><div className="text-xs text-muted">{d.file_name as string}</div></div>
                            </div>
                          </td>
                          <td className="text-muted">{d.category as string}</td>
                          <td className="whitespace-nowrap tabular-nums">{fmtBytes(d.size_bytes as number)}</td>
                          <td className="text-xs whitespace-nowrap text-muted">{fmtDateTime(d.uploaded_at as string)}<div>{d.uploaded_by as string}</div></td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <a href={`/api/documents/${d.id}?inline=1`} target="_blank" className="btn-secondary btn-sm" title="View"><Eye size={13} /></a>
                              <a href={`/api/documents/${d.id}`} className="btn-secondary btn-sm" title="Download"><Download size={13} /></a>
                              {editable && <ConfirmButton onConfirm={deleteDocument.bind(null, d.id as number, id)} confirmLabel="Delete?" />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {editable && <DocumentUploader employeeId={id} categories={DOCUMENT_CATEGORIES} />}
          </div>
        )}
      </div>
    </>
  );
}

async function loadTab(tab: string, id: number) {
  const sql: Record<string, string> = {
    service: "SELECT * FROM service_records WHERE employee_id = $1 ORDER BY effective_date DESC NULLS FIRST, id DESC",
    charges: "SELECT * FROM employee_charges WHERE employee_id = $1 ORDER BY present_from DESC NULLS LAST, id",
    qualifications: "SELECT * FROM qualifications WHERE employee_id = $1 ORDER BY passing_year DESC NULLS LAST, id",
    experience: "SELECT * FROM experiences WHERE employee_id = $1 ORDER BY from_date DESC NULLS LAST, id",
    family: "SELECT * FROM family_members WHERE employee_id = $1 ORDER BY id",
    leaves: "SELECT * FROM leaves WHERE employee_id = $1 ORDER BY from_date DESC",
    documents: "SELECT id, category, title, file_name, mime_type, size_bytes, uploaded_by, uploaded_at FROM documents WHERE employee_id = $1 ORDER BY uploaded_at DESC",
  };
  return sql[tab] ? query<Record<string, string | number | null>>(sql[tab], [id]) : [];
}

function RecordTable({ title, kind, employeeId, editable, rows, cols, add, fields, onDelete }: {
  title: string; kind: string; employeeId: number; editable: boolean; rows: Record<string, string | number | null>[];
  cols: [string, string, ("date" | undefined)?][]; add: string; fields: FieldSpec[];
  onDelete: (kind: string, id: number) => () => Promise<void>;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-semibold text-navy">{title}</h2>
        {editable && <AddRecordForm kind={kind} employeeId={employeeId} fields={fields} label={add} />}
      </div>
      {rows.length === 0 ? <Empty>No records yet.</Empty> : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr>{cols.map(([, l]) => <th key={l}>{l}</th>)}{editable && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id as number}>
                  {cols.map(([k, , t]) => <td key={k} className={t === "date" ? "whitespace-nowrap" : ""}>{t === "date" ? fmtDate(r[k] as string) : (r[k] ?? "—")}</td>)}
                  {editable && <td className="text-right"><ConfirmButton onConfirm={onDelete(kind, r.id as number)} confirmLabel="Delete?" /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const SERVICE_FIELDS: FieldSpec[] = [
  { name: "event_type", label: "Event", type: "select", options: SERVICE_EVENTS, required: true },
  { name: "effective_date", label: "Effective date", type: "date" },
  { name: "designation", label: "Designation" },
  { name: "bps", label: "BPS", type: "number" },
  { name: "unit_name", label: "Department / office", wide: true },
  { name: "order_no", label: "Order / notification no." },
  { name: "remarks", label: "Remarks" },
];
const CHARGE_FIELDS: FieldSpec[] = [
  { name: "role", label: "Role", required: true, placeholder: "Chairperson / Director / Dean / In-charge" },
  { name: "unit_name", label: "Department / institute", wide: true },
  { name: "present_from", label: "Present term from", type: "date" },
  { name: "present_to", label: "Present term to", placeholder: "date or e.g. Till F. Order" },
  { name: "first_from", label: "First term from", type: "date" },
  { name: "first_to", label: "First term to", type: "date" },
  { name: "second_term", label: "Second term" },
  { name: "notes", label: "Notes" },
];
const QUAL_FIELDS: FieldSpec[] = [
  { name: "degree", label: "Degree", required: true, placeholder: "PhD / M.Phil / MSc / Matric" },
  { name: "specialization", label: "Specialization" },
  { name: "institution", label: "Institution / board", wide: true },
  { name: "passing_year", label: "Passing year", type: "number" },
  { name: "grade", label: "Division / CGPA" },
];
const EXP_FIELDS: FieldSpec[] = [
  { name: "organization", label: "Organization", required: true, wide: true },
  { name: "designation", label: "Designation" },
  { name: "from_date", label: "From", type: "date" },
  { name: "to_date", label: "To", type: "date" },
  { name: "remarks", label: "Remarks", wide: true },
];
const FAMILY_FIELDS: FieldSpec[] = [
  { name: "name", label: "Name", required: true },
  { name: "relation", label: "Relation", type: "select", options: RELATIONS, required: true },
  { name: "date_of_birth", label: "Date of birth", type: "date" },
  { name: "cnic", label: "CNIC / B-Form" },
  { name: "occupation", label: "Occupation" },
];
const LEAVE_FIELDS: FieldSpec[] = [
  { name: "leave_type", label: "Leave type", type: "select", options: LEAVE_TYPES, required: true },
  { name: "from_date", label: "From", type: "date", required: true },
  { name: "to_date", label: "To", type: "date", required: true },
  { name: "days", label: "Days (auto if blank)", type: "number" },
  { name: "status", label: "Status", type: "select", options: ["Approved", "Applied", "Rejected", "Cancelled"] },
  { name: "order_no", label: "Order no." },
  { name: "remarks", label: "Remarks", wide: true },
];
