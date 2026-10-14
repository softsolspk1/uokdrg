"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { saveEmployee } from "@/app/actions/employees";
import { BLOOD_GROUPS, DOMICILES, EMPLOYMENT_TYPES, GENDERS, MARITAL, RELIGIONS, STATUSES, TEACHING_DESIGNATIONS } from "@/lib/constants";

export type EmployeeFormValues = Partial<Record<string, string | number | null | boolean>>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 border-b border-line pb-2 font-semibold text-navy">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function fmtVal(initial: EmployeeFormValues | undefined, k: string) {
  return initial?.[k] === null || initial?.[k] === undefined ? "" : String(initial[k]);
}

function Text({ initial, name, label, type: t = "text", required, placeholder, span }: { initial?: EmployeeFormValues; name: string; label: string; type?: string; required?: boolean; placeholder?: string; span?: boolean }) {
  const v = (k: string) => fmtVal(initial, k);
  return (
    <div className={span ? "sm:col-span-2 lg:col-span-3" : ""}>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-crimson"> *</span>}</label>
      <input id={name} name={name} type={t} defaultValue={v(name)} required={required} placeholder={placeholder} className="input" />
    </div>
  );
}
function Select({ initial, name, label, options, required }: { initial?: EmployeeFormValues; name: string; label: string; options: readonly string[]; required?: boolean }) {
  const v = (k: string) => fmtVal(initial, k);
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{required && <span className="text-crimson"> *</span>}</label>
      <select id={name} name={name} defaultValue={v(name)} required={required} className="input">
        <option value="">—</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function EmployeeForm({ initial, units, designations }: {
  initial?: EmployeeFormValues;
  units: { id: number; name: string }[];
  designations: string[];
}) {
  const [state, action, pending] = useActionState(saveEmployee, undefined);
  const [type, setType] = useState(String(initial?.staff_type ?? "Teaching"));
  const v = (k: string) => fmtVal(initial, k);

  // Submitted manually so React does not reset the fields when the server returns a validation error
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {initial?.id && <input type="hidden" name="id" value={String(initial.id)} />}

      <Section title="Identification">
        <Text initial={initial} name="full_name" label="Full name" required placeholder="e.g. Dr. Ayesha Khan" />
        <Text initial={initial} name="father_name" label="Father / husband name" />
        <Text initial={initial} name="cnic" label="CNIC" placeholder="42101-1234567-1" />
        {!initial?.id && <Text initial={initial} name="employee_no" label="Employee no. (leave blank to auto-generate)" placeholder="UOK-T-0001" />}
        <Text initial={initial} name="personnel_file_no" label="Personal file no." />
        <div>
          <label className="label" htmlFor="photo">Photograph</label>
          <input id="photo" name="photo" type="file" accept="image/*" className="input file:mr-3 file:rounded file:border-0 file:bg-uok-50 file:px-2 file:py-1 file:text-uok-700" />
        </div>
      </Section>

      <Section title="Personal information">
        <Select initial={initial} name="gender" label="Gender" options={GENDERS} />
        <Text initial={initial} name="date_of_birth" label="Date of birth" type="date" />
        <Select initial={initial} name="marital_status" label="Marital status" options={MARITAL} />
        <Select initial={initial} name="religion" label="Religion" options={RELIGIONS} />
        <Text initial={initial} name="nationality" label="Nationality" />
        <Select initial={initial} name="domicile" label="Domicile" options={DOMICILES} />
        <Select initial={initial} name="blood_group" label="Blood group" options={BLOOD_GROUPS} />
      </Section>

      <Section title="Contact">
        <Text initial={initial} name="mobile" label="Mobile" placeholder="03xx-xxxxxxx" />
        <Text initial={initial} name="phone" label="Phone / extension" />
        <Text initial={initial} name="email" label="Email" type="email" placeholder="name@uok.edu.pk" />
        <Text initial={initial} name="present_address" label="Present address" span />
        <Text initial={initial} name="permanent_address" label="Permanent address" span />
        <Text initial={initial} name="city" label="City" />
        <Text initial={initial} name="emergency_name" label="Emergency contact name" />
        <Text initial={initial} name="emergency_relation" label="Emergency contact relation" />
        <Text initial={initial} name="emergency_phone" label="Emergency contact phone" />
      </Section>

      <Section title="Employment">
        <div>
          <label className="label" htmlFor="staff_type">Staff type<span className="text-crimson"> *</span></label>
          <select id="staff_type" name="staff_type" value={type} onChange={(e) => setType(e.target.value)} className="input" required>
            <option>Teaching</option><option>Non-Teaching</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="designation">Designation</label>
          <input id="designation" name="designation" list="designation-list" defaultValue={v("designation")} className="input" />
          <datalist id="designation-list">
            {(type === "Teaching" ? TEACHING_DESIGNATIONS : designations).map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="bps">BPS</label>
          <select id="bps" name="bps" defaultValue={v("bps")} className="input">
            <option value="">—</option>
            {Array.from({ length: 22 }, (_, i) => 22 - i).map((b) => <option key={b} value={b}>BPS-{b}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="unit_id">Department / office</label>
          <select id="unit_id" name="unit_id" defaultValue={v("unit_id")} className="input">
            <option value="">—</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <Select initial={initial} name="employment_type" label="Employment type" options={EMPLOYMENT_TYPES} />
        <Select initial={initial} name="status" label="Service status" options={STATUSES} required />
        <Text initial={initial} name="status_remarks" label="Status remarks" />
        <Text initial={initial} name="date_of_joining" label="Date of joining (University)" type="date" />
        <Text initial={initial} name="date_of_current_post" label="Date of current post" type="date" />
        <Text initial={initial} name="date_of_retirement" label="Date of retirement (auto = age 60)" type="date" />
      </Section>

      <Section title="Pay & bank">
        <Text initial={initial} name="basic_pay" label="Basic pay (PKR)" type="number" />
        <Text initial={initial} name="bank_name" label="Bank" />
        <Text initial={initial} name="bank_branch" label="Branch" />
        <Text initial={initial} name="bank_account" label="Account no. / IBAN" />
        <Text initial={initial} name="ntn" label="NTN" />
      </Section>

      <section className="card p-5">
        <label className="label" htmlFor="remarks">Remarks</label>
        <textarea id="remarks" name="remarks" defaultValue={v("remarks")} rows={3} className="input" />
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {state?.error && <p role="alert" className="mr-auto rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <Link href={initial?.id ? `/employees/${initial.id}` : "/employees"} className="btn-secondary">Cancel</Link>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : initial?.id ? "Save changes" : "Create employee"}</button>
      </div>
    </form>
  );
}
