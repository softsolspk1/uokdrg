"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { addChild, uploadDocuments, type FormState } from "@/app/actions/employees";

export type FieldSpec = { name: string; label: string; type?: "text" | "date" | "number" | "select"; options?: readonly string[]; required?: boolean; wide?: boolean; placeholder?: string };

function useSubmit(fn: (p: FormState, f: FormData) => Promise<FormState>) {
  const [state, action, pending] = useActionState(fn, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, pending, ref, onSubmit };
}

/** Collapsible "Add record" form for qualifications, experience, family, service, leave, charges */
export function AddRecordForm({ kind, employeeId, fields, label }: { kind: string; employeeId: number; fields: FieldSpec[]; label: string }) {
  const [open, setOpen] = useState(false);
  const { state, pending, ref, onSubmit } = useSubmit(addChild);

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm"><Plus size={14} /> {label}</button>;
  }
  return (
    <form ref={ref} onSubmit={onSubmit} className="w-full rounded-lg border border-uok-200 bg-uok-50/40 p-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.name} className={f.wide ? "sm:col-span-2" : ""}>
            <label className="label" htmlFor={`${kind}-${f.name}`}>{f.label}{f.required && <span className="text-crimson"> *</span>}</label>
            {f.type === "select" ? (
              <select id={`${kind}-${f.name}`} name={f.name} required={f.required} className="input">
                <option value="">—</option>
                {f.options?.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input id={`${kind}-${f.name}`} name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} className="input" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="btn-primary btn-sm" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">Close</button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
    </form>
  );
}

/** Two-step delete (no browser confirm dialog) */
export function ConfirmButton({ onConfirm, label = "Delete", confirmLabel = "Confirm delete", small = true }: { onConfirm: () => Promise<void>; label?: string; confirmLabel?: string; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 8000);
    return () => clearTimeout(t);
  }, [armed]);
  const size = small ? "btn-sm" : "";
  if (!armed) {
    return <button type="button" onClick={() => setArmed(true)} className={`btn-danger ${size}`} title={label}><Trash2 size={13} />{!small && label}</button>;
  }
  return (
    <span className="inline-flex gap-1">
      <button type="button" disabled={pending} onClick={() => start(() => onConfirm())} className={`btn ${size} bg-red-600 text-white hover:bg-red-700`}>
        {pending ? "Deleting…" : confirmLabel}
      </button>
      <button type="button" onClick={() => setArmed(false)} className={`btn-secondary ${size}`}><X size={13} /></button>
    </span>
  );
}

export function DocumentUploader({ employeeId, categories }: { employeeId: number; categories: string[] }) {
  const { state, pending, ref, onSubmit } = useSubmit(uploadDocuments);
  const [names, setNames] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={ref} onSubmit={onSubmit} onReset={() => setNames([])} className="card p-5">
      <h3 className="mb-3 font-semibold text-navy">Upload documents</h3>
      <input type="hidden" name="employee_id" value={employeeId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="doc-category">Category <span className="text-crimson">*</span></label>
          <select id="doc-category" name="category" required className="input">
            <option value="">Select category…</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="doc-title">Title (optional)</label>
          <input id="doc-title" name="title" className="input" placeholder="e.g. Promotion order to BPS-20" />
        </div>
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (inputRef.current && e.dataTransfer.files.length) {
            inputRef.current.files = e.dataTransfer.files;
            setNames(Array.from(e.dataTransfer.files).map((f) => f.name));
          }
        }}
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${drag ? "border-uok-500 bg-uok-50" : "border-line hover:border-uok-300 hover:bg-canvas"}`}
      >
        <Upload className="mb-2 text-uok-700" size={22} />
        <span className="text-sm font-medium text-ink">Drop files here or click to browse</span>
        <span className="mt-1 text-xs text-muted">PDF, JPG, PNG, WebP, Word, Excel · up to 10 MB each · multiple files allowed</span>
        <input ref={inputRef} type="file" name="files" multiple className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
          onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))} />
      </label>
      {names.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted">{names.map((n) => <li key={n}>• {n}</li>)}</ul>}
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" disabled={pending}><Upload size={15} /> {pending ? "Uploading…" : "Upload"}</button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
      </div>
    </form>
  );
}
