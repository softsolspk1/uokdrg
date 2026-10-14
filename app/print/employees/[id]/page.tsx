import { Fragment } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { age, fmtDate } from "@/lib/format";
import PrintButton from "./print-button";

export const metadata = { title: "Employee profile sheet" };

type R = Record<string, string | number | boolean | null>;

function Row({ items }: { items: [string, string][] }) {
  return (
    <tr>{items.map(([k, val]) => <Fragment key={k}><th className="w-[16%] border border-slate-300 bg-slate-50 px-2 py-1 text-left text-[11px] font-semibold text-slate-600">{k}</th><td className="border border-slate-300 px-2 py-1">{val}</td></Fragment>)}</tr>
  );
}

function List({ title, rows, cols }: { title: string; rows: R[]; cols: [string, string, boolean?][] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-1 border-b-2 border-uok-700 pb-0.5 text-sm font-bold text-uok-700 uppercase">{title}</h2>
      <table className="w-full border-collapse text-xs">
        <thead><tr>{cols.map(([, l]) => <th key={l} className="border border-slate-300 bg-slate-50 px-2 py-1 text-left">{l}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([k, , isDate]) => <td key={k} className="border border-slate-300 px-2 py-1">{isDate ? fmtDate(r[k] as string) : (r[k] as string) ?? "—"}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}

export default async function PrintProfile({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const e = await queryOne<R>(
    `SELECT e.*, (e.photo IS NOT NULL) has_photo, u.name unit_name FROM employees e LEFT JOIN units u ON u.id = e.unit_id WHERE e.id = $1`, [id || 0]);
  if (!e) notFound();
  delete e.photo;
  const [quals, service, charges, family, docs] = await Promise.all([
    query<R>("SELECT * FROM qualifications WHERE employee_id = $1 ORDER BY passing_year DESC NULLS LAST", [id]),
    query<R>("SELECT * FROM service_records WHERE employee_id = $1 ORDER BY effective_date DESC NULLS FIRST", [id]),
    query<R>("SELECT * FROM employee_charges WHERE employee_id = $1 ORDER BY present_from DESC NULLS LAST", [id]),
    query<R>("SELECT * FROM family_members WHERE employee_id = $1 ORDER BY id", [id]),
    query<R>("SELECT category, title FROM documents WHERE employee_id = $1 ORDER BY category", [id]),
  ]);
  const v = (k: string) => (e[k] === null || e[k] === undefined || e[k] === "" ? "—" : String(e[k]));
  const d = (k: string) => fmtDate(e[k] as string | null);

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden"><PrintButton /></div>
      <article className="mx-auto max-w-[210mm] bg-white p-[12mm] text-[12px] text-slate-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-4 border-double border-uok-700 pb-3">
          <Image src="/uok-logo.png" alt="University of Karachi" width={58} height={70} />
          <div className="flex-1 text-center">
            <div className="font-serif text-xl font-bold text-uok-700">UNIVERSITY OF KARACHI</div>
            <div className="text-xs">Office of the Deputy Registrar (General)</div>
            <div className="mt-1 text-sm font-semibold tracking-wide">EMPLOYEE PROFILE SHEET</div>
          </div>
          {e.has_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/employees/${id}/photo`} alt="" className="h-[30mm] w-[24mm] border border-slate-300 object-cover" />
          ) : <div className="flex h-[30mm] w-[24mm] items-center justify-center border border-dashed border-slate-400 text-[10px] text-slate-400">Photo</div>}
        </header>

        <section className="mt-4">
          <h2 className="mb-1 border-b-2 border-uok-700 pb-0.5 text-sm font-bold text-uok-700 uppercase">Particulars</h2>
          <table className="w-full border-collapse text-xs"><tbody>
            <Row items={[["Name", v("full_name")], ["Employee No.", v("employee_no")]]} />
            <Row items={[["Father / Husband", v("father_name")], ["CNIC", v("cnic")]]} />
            <Row items={[["Date of Birth", `${d("date_of_birth")}${age(e.date_of_birth as string) !== null ? ` (${age(e.date_of_birth as string)} yrs)` : ""}`], ["Gender", v("gender")]]} />
            <Row items={[["Domicile", v("domicile")], ["Marital Status", v("marital_status")]]} />
            <Row items={[["Designation", v("designation")], ["BPS", v("bps")]]} />
            <Row items={[["Department / Office", v("unit_name")], ["Staff Type", v("staff_type")]]} />
            <Row items={[["Status", `${v("status")}${e.status_remarks ? ` — ${e.status_remarks}` : ""}`], ["Employment", v("employment_type")]]} />
            <Row items={[["Date of Joining", d("date_of_joining")], ["Date of Retirement", d("date_of_retirement")]]} />
            <Row items={[["Mobile", v("mobile")], ["Email", v("email")]]} />
            <Row items={[["Present Address", v("present_address")], ["Personal File No.", v("personnel_file_no")]]} />
          </tbody></table>
        </section>

        <List title="Administrative charges" rows={charges} cols={[["role", "Role"], ["unit_name", "Department / Institute"], ["present_from", "From", true], ["present_to", "To"], ["second_term", "Second term"]]} />
        <List title="Service record" rows={service} cols={[["event_type", "Event"], ["effective_date", "Date", true], ["designation", "Designation"], ["bps", "BPS"], ["unit_name", "Department / Office"], ["order_no", "Order No."]]} />
        <List title="Qualifications" rows={quals} cols={[["degree", "Degree"], ["specialization", "Specialization"], ["institution", "Institution"], ["passing_year", "Year"], ["grade", "Grade"]]} />
        <List title="Family members" rows={family} cols={[["name", "Name"], ["relation", "Relation"], ["date_of_birth", "DOB", true], ["cnic", "CNIC / B-Form"]]} />
        <List title="Documents on file" rows={docs} cols={[["category", "Category"], ["title", "Title"]]} />

        <footer className="mt-12 flex justify-between text-xs">
          <div>Printed on {fmtDate(new Date().toISOString().slice(0, 10))}</div>
          <div className="text-center"><div className="mb-1 w-48 border-t border-slate-500" />Deputy Registrar (General)</div>
        </footer>
      </article>
    </div>
  );
}
