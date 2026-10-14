"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, pool, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/constants";

export type FormState = { error?: string; ok?: string } | undefined;

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const n = (f: FormData, k: string) => {
  const v = s(f, k);
  return v === null || Number.isNaN(Number(v)) ? null : Number(v);
};

// Columns editable through the employee form (name in form == column name)
const TEXT_COLS = [
  "full_name", "father_name", "gender", "date_of_birth", "cnic", "marital_status", "religion", "nationality", "domicile", "blood_group",
  "mobile", "phone", "email", "present_address", "permanent_address", "city", "emergency_name", "emergency_relation", "emergency_phone",
  "staff_type", "designation", "employment_type", "status", "status_remarks", "date_of_joining", "date_of_current_post", "date_of_retirement",
  "personnel_file_no", "bank_name", "bank_branch", "bank_account", "ntn", "remarks",
] as const;
const NUM_COLS = ["bps", "unit_id", "basic_pay"] as const;

function validate(f: FormData): string | null {
  if (!s(f, "full_name")) return "Full name is required.";
  if (!s(f, "staff_type")) return "Staff type is required.";
  const cnic = s(f, "cnic");
  if (cnic && !/^\d{5}-\d{7}-\d$/.test(cnic)) return "CNIC must be in the format 42101-1234567-1.";
  const email = s(f, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  const bps = n(f, "bps");
  if (bps !== null && (bps < 1 || bps > 22)) return "BPS must be between 1 and 22.";
  return null;
}

/** Retirement = day before 60th birthday, if DOB given and DOR left blank */
function deriveRetirement(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + 60);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function readPhoto(f: FormData) {
  const file = f.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) throw new Error("Photo must be an image (JPG/PNG/WebP).");
  if (file.size > 2 * 1024 * 1024) throw new Error("Photo must be smaller than 2 MB.");
  return { data: Buffer.from(await file.arrayBuffer()), mime: file.type };
}

export async function saveEmployee(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireRole("admin", "hr");
  const err = validate(f);
  if (err) return { error: err };
  const id = n(f, "id");

  const values: Record<string, unknown> = {};
  for (const c of TEXT_COLS) values[c] = s(f, c);
  for (const c of NUM_COLS) values[c] = n(f, c);
  if (!values.date_of_retirement) values.date_of_retirement = deriveRetirement(values.date_of_birth as string | null);
  values.dob_derived = false;

  let photo;
  try {
    photo = await readPhoto(f);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (photo) {
    values.photo = photo.data;
    values.photo_mime = photo.mime;
  }

  const cols = Object.keys(values);
  let newId = id;
  try {
    if (id) {
      const set = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await pool.query(`UPDATE employees SET ${set}, updated_at = now() WHERE id = $${cols.length + 1}`, [...Object.values(values), id]);
      await audit(user.username, "update", "employee", id, values.full_name as string);
    } else {
      const prefix = values.staff_type === "Teaching" ? "UOK-T-" : "UOK-N-";
      const width = values.staff_type === "Teaching" ? 4 : 5;
      const next = await queryOne<{ n: number }>(
        `SELECT coalesce(max(substring(employee_no from '\\d+$')::int), 0) + 1 n FROM employees WHERE employee_no LIKE $1`, [`${prefix}%`]);
      const empNo = s(f, "employee_no") ?? `${prefix}${String(next!.n).padStart(width, "0")}`;
      const all = ["employee_no", "source", ...cols];
      const res = await pool.query(
        `INSERT INTO employees (${all.join(", ")}) VALUES (${all.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
        [empNo, "Entered in HRM", ...Object.values(values)]);
      newId = res.rows[0].id;
      await audit(user.username, "create", "employee", newId, `${empNo} ${values.full_name}`);
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("employees_employee_no_key")) return { error: "That employee number is already in use." };
    return { error: msg };
  }
  revalidatePath("/employees");
  redirect(`/employees/${newId}`);
}

export async function deleteEmployee(id: number) {
  const user = await requireRole("admin");
  const emp = await queryOne<{ full_name: string; employee_no: string }>("SELECT full_name, employee_no FROM employees WHERE id = $1", [id]);
  await pool.query("DELETE FROM employees WHERE id = $1", [id]);
  await audit(user.username, "delete", "employee", id, emp ? `${emp.employee_no} ${emp.full_name}` : undefined);
  revalidatePath("/employees");
  redirect("/employees");
}

export async function removePhoto(id: number) {
  const user = await requireRole("admin", "hr");
  await pool.query("UPDATE employees SET photo = NULL, photo_mime = NULL, updated_at = now() WHERE id = $1", [id]);
  await audit(user.username, "remove-photo", "employee", id);
  revalidatePath(`/employees/${id}`);
}

// ------------------------------------------------------------- sub-records
// Each child table: allowed columns + which are numeric
const CHILD: Record<string, { table: string; cols: string[]; nums?: string[]; required: string[] }> = {
  qualification: { table: "qualifications", cols: ["degree", "specialization", "institution", "passing_year", "grade"], nums: ["passing_year"], required: ["degree"] },
  experience: { table: "experiences", cols: ["organization", "designation", "from_date", "to_date", "remarks"], required: ["organization"] },
  family: { table: "family_members", cols: ["name", "relation", "date_of_birth", "cnic", "occupation"], required: ["name", "relation"] },
  service: { table: "service_records", cols: ["event_type", "effective_date", "designation", "bps", "unit_name", "order_no", "remarks"], nums: ["bps"], required: ["event_type"] },
  leave: { table: "leaves", cols: ["leave_type", "from_date", "to_date", "days", "status", "order_no", "remarks"], nums: ["days"], required: ["leave_type", "from_date", "to_date"] },
  charge: { table: "employee_charges", cols: ["role", "unit_name", "present_from", "present_to", "first_from", "first_to", "second_term", "notes"], required: ["role"] },
};

export async function addChild(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireRole("admin", "hr");
  const kind = s(f, "kind")!;
  const employeeId = n(f, "employee_id")!;
  const def = CHILD[kind];
  if (!def) return { error: "Unknown record type." };
  for (const r of def.required) if (!s(f, r)) return { error: `${r.replace(/_/g, " ")} is required.` };

  const vals = def.cols.map((c) => (def.nums?.includes(c) ? n(f, c) : s(f, c)));
  if (kind === "leave" && vals[3] === null && vals[1] && vals[2]) {
    const days = Math.round((Date.parse(vals[2] as string) - Date.parse(vals[1] as string)) / 86_400_000) + 1;
    vals[3] = days > 0 ? days : null;
  }
  if (kind === "leave") {
    if ((vals[2] as string) < (vals[1] as string)) return { error: "Leave end date is before the start date." };
    vals[4] ??= "Approved";
  }
  try {
    if (kind === "charge") {
      // link to a unit when the name matches one exactly
      const name = s(f, "unit_name");
      const unit = name ? await queryOne<{ id: number }>("SELECT id FROM units WHERE lower(name) = lower($1)", [name]) : null;
      await pool.query(
        `INSERT INTO employee_charges (employee_id, unit_id, ${def.cols.join(", ")}) VALUES ($1, $2, ${def.cols.map((_, i) => `$${i + 3}`).join(", ")})`,
        [employeeId, unit?.id ?? null, ...vals]);
    } else await pool.query(
      `INSERT INTO ${def.table} (employee_id, ${def.cols.join(", ")}) VALUES ($1, ${def.cols.map((_, i) => `$${i + 2}`).join(", ")})`,
      [employeeId, ...vals]);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await audit(user.username, `add-${kind}`, "employee", employeeId);
  revalidatePath(`/employees/${employeeId}`);
  return { ok: "Saved." };
}

export async function deleteChild(kind: string, id: number, employeeId: number) {
  const user = await requireRole("admin", "hr");
  const def = CHILD[kind];
  if (!def) throw new Error("Unknown record type.");
  await pool.query(`DELETE FROM ${def.table} WHERE id = $1 AND employee_id = $2`, [id, employeeId]);
  await audit(user.username, `delete-${kind}`, "employee", employeeId, `id=${id}`);
  revalidatePath(`/employees/${employeeId}`);
}

// ------------------------------------------------------------- documents
export async function uploadDocuments(_prev: FormState, f: FormData): Promise<FormState> {
  const user = await requireRole("admin", "hr");
  const employeeId = n(f, "employee_id");
  const category = s(f, "category");
  const title = s(f, "title");
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  if (!employeeId || !category) return { error: "Choose a document category." };
  if (files.length === 0) return { error: "Choose at least one file to upload." };

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) return { error: `${file.name} is larger than 10 MB.` };
    if (!ALLOWED_MIME.includes(file.type)) return { error: `${file.name}: only PDF, images, Word and Excel files are allowed.` };
  }
  for (const file of files) {
    const docTitle = files.length === 1 && title ? title : title ? `${title} — ${file.name}` : file.name.replace(/\.[^.]+$/, "");
    await pool.query(
      `INSERT INTO documents (employee_id, category, title, file_name, mime_type, size_bytes, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [employeeId, category, docTitle, file.name, file.type, file.size, Buffer.from(await file.arrayBuffer()), user.name]);
  }
  await audit(user.username, "upload-document", "employee", employeeId, `${files.length} file(s), ${category}`);
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/documents");
  return { ok: `${files.length} document${files.length > 1 ? "s" : ""} uploaded.` };
}

export async function deleteDocument(id: number, employeeId: number) {
  const user = await requireRole("admin", "hr");
  const doc = await queryOne<{ title: string }>("SELECT title FROM documents WHERE id = $1", [id]);
  await pool.query("DELETE FROM documents WHERE id = $1 AND employee_id = $2", [id, employeeId]);
  await audit(user.username, "delete-document", "employee", employeeId, doc?.title);
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/documents");
}
