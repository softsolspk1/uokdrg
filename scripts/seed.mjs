// Creates the schema and loads data/seed.json into PostgreSQL.
//   node scripts/seed.mjs           -> create schema, load data only if the employees table is empty
//   node scripts/seed.mjs --reset   -> drop all HRM tables and reload everything (DESTROYS uploaded documents)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const reset = process.argv.includes("--reset");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const tables = ["audit_log", "vacancies", "documents", "leaves", "service_records", "family_members",
  "experiences", "qualifications", "employee_charges", "employees", "budget_posts", "units"];

try {
  if (reset) {
    console.log("Dropping HRM tables…");
    await client.query(`DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE`);
  }
  await client.query(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
  console.log("Schema ready.");

  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const { rowCount: hasAdmin } = await client.query("SELECT 1 FROM users WHERE username = $1", [adminUser]);
  if (!hasAdmin) {
    const pw = process.env.ADMIN_PASSWORD || "Admin@123";
    await client.query(
      "INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      [adminUser, "System Administrator", await bcrypt.hash(pw, 10)]);
    console.log(`Created admin user "${adminUser}".`);
  }

  const { rows: [{ n }] } = await client.query("SELECT count(*)::int AS n FROM employees");
  if (n > 0) {
    console.log(`employees already has ${n} rows — skipping data load (use --reset to reload).`);
    process.exit(0);
  }

  const seed = JSON.parse(fs.readFileSync(path.join(root, "data", "seed.json"), "utf8"));
  await client.query("BEGIN");

  await client.query(
    `INSERT INTO units (code, name, category, sheet, source_name)
     SELECT code, name, category, sheet, source_name
     FROM json_to_recordset($1) AS x(code text, name text, category text, sheet text, source_name text)`,
    [JSON.stringify(seed.units)]);

  await client.query(
    `INSERT INTO budget_posts (unit_id, section, designation, bps, positions)
     SELECT u.id, x.section, x.designation, x.bps, x.positions
     FROM json_to_recordset($1) AS x(unit_code text, section text, designation text, bps int, positions int)
     JOIN units u ON u.code = x.unit_code`,
    [JSON.stringify(seed.budget_posts)]);

  await client.query(
    `INSERT INTO employees (employee_no, full_name, gender, staff_type, designation, bps, unit_id, status,
       status_remarks, date_of_birth, dob_derived, date_of_retirement, director_id, posting_label, source)
     SELECT x.employee_no, x.full_name, x.gender, x.staff_type, x.designation, x.bps, u.id, x.status,
       x.status_remarks, x.date_of_birth, coalesce(x.dob_derived, false), x.date_of_retirement,
       x.director_id, x.posting_label, x.source
     FROM json_to_recordset($1) AS x(employee_no text, full_name text, gender text, staff_type text,
       designation text, bps int, unit_code text, status text, status_remarks text, date_of_birth date,
       dob_derived boolean, date_of_retirement date, director_id text, posting_label text, source text)
     LEFT JOIN units u ON u.code = x.unit_code
     ORDER BY x.employee_no`,
    [JSON.stringify(seed.employees)]);

  const charges = seed.employees.flatMap((e) => e.charges.map((c) => ({ employee_no: e.employee_no, ...c })));
  await client.query(
    `INSERT INTO employee_charges (employee_id, role, unit_id, unit_name, present_from, present_to, second_term, first_from, first_to)
     SELECT e.id, x.role, u.id, coalesce(u.name, x.unit), x.present_from, x.present_to, x.second_term, x.first_from, x.first_to
     FROM json_to_recordset($1) AS x(employee_no text, role text, unit_code text, unit text, present_from date, present_to text,
       second_term text, first_from date, first_to date)
     JOIN employees e ON e.employee_no = x.employee_no
     LEFT JOIN units u ON u.code = x.unit_code`,
    [JSON.stringify(charges)]);

  // Appointment record so each profile starts with a service-history entry
  await client.query(
    `INSERT INTO service_records (employee_id, event_type, designation, bps, unit_name, remarks)
     SELECT e.id, 'Current Posting', e.designation, e.bps, u.name, 'Imported from ' || e.source
     FROM employees e LEFT JOIN units u ON u.id = e.unit_id`);

  await client.query(
    `INSERT INTO vacancies (grp, post, department, bps, sanctioned, working, vacant, priority)
     SELECT "group", post, department, bps, sanctioned, working, vacant, priority
     FROM json_to_recordset($1) AS x("group" text, post text, department text, bps text,
       sanctioned int, working int, vacant int, priority int)`,
    [JSON.stringify(seed.vacancies)]);

  await client.query("COMMIT");
  const counts = await client.query(
    `SELECT (SELECT count(*) FROM units) units, (SELECT count(*) FROM budget_posts) posts,
            (SELECT count(*) FROM employees) employees, (SELECT count(*) FROM employee_charges) charges,
            (SELECT count(*) FROM vacancies) vacancies`);
  console.log("Loaded:", counts.rows[0]);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
