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

const tables = ["audit_log", "office_staff", "job_descriptions", "office_sections", "recruitment_rules_text",
  "recruitment_rules", "establishment_posts", "vacancies", "documents", "leaves", "service_records", "family_members",
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
       status_remarks, date_of_birth, dob_derived, date_of_retirement, director_id, posting_label, remarks, source)
     SELECT x.employee_no, x.full_name, x.gender, x.staff_type, x.designation, x.bps, u.id, x.status,
       x.status_remarks, x.date_of_birth, coalesce(x.dob_derived, false), x.date_of_retirement,
       x.director_id, x.posting_label, x.remarks, x.source
     FROM json_to_recordset($1) AS x(employee_no text, full_name text, gender text, staff_type text,
       designation text, bps int, unit_code text, status text, status_remarks text, date_of_birth date,
       dob_derived boolean, date_of_retirement date, director_id text, posting_label text, remarks text, source text)
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
    `INSERT INTO vacancies (grp, post, department, bps, sanctioned, working, vacant, priority, remarks)
     SELECT "group", post, department, bps, sanctioned, working, vacant, priority, remarks
     FROM json_to_recordset($1) AS x("group" text, post text, department text, bps text,
       sanctioned int, working int, vacant int, priority int, remarks text, ord int)
     ORDER BY ord`,
    [JSON.stringify(seed.vacancies.map((v, ord) => ({ ...v, ord })))]);

  await client.query(
    `INSERT INTO establishment_posts (post, bps, approved_2006_10, approved_after_2010, abolished, total, working, remarks)
     SELECT post, bps, approved_2006_10, approved_after_2010, abolished, total, working, remarks
     FROM json_to_recordset($1) AS x(post text, bps int, approved_2006_10 int, approved_after_2010 int,
       abolished int, total int, working int, remarks text)`,
    [JSON.stringify(seed.establishment)]);

  const rr = seed.recruitment_rules;
  await client.query(
    `INSERT INTO recruitment_rules (sr_no, sr_label, post, post_title, num_posts, cadre, classification, scale,
       recruitment_mode, age_limit, qualification, probation, experience, job_description, departments)
     SELECT sr_no, sr_label, post, post_title, num_posts, cadre, classification, scale, recruitment_mode, age_limit,
       qualification, probation, experience, job_description, coalesce(departments, '[]')
     FROM json_to_recordset($1) AS x(sr_no int, sr_label text, post text, post_title text, num_posts text, cadre text,
       classification text, scale text, recruitment_mode text, age_limit text, qualification text, probation text,
       experience text, job_description text, departments jsonb)`,
    [JSON.stringify(rr.rules)]);
  await client.query(
    `INSERT INTO recruitment_rules_text (sort, text, heading)
     SELECT ord, text, heading FROM json_to_recordset($1) AS x(ord int, text text, heading boolean)`,
    [JSON.stringify(rr.general.map((g, ord) => ({ ...g, ord })))]);

  const drg = seed.drg_office;
  await client.query(
    `INSERT INTO office_sections (sort, name, description)
     SELECT sort, name, description FROM json_to_recordset($1) AS x(sort int, name text, description text)`,
    [JSON.stringify(drg.sections)]);
  const { rows: jdRows } = await client.query(
    `INSERT INTO job_descriptions (sort, position, summary, duties)
     SELECT ord, position, summary, ARRAY(SELECT json_array_elements_text(duties))
     FROM json_to_recordset($1) AS x(ord int, position text, summary text, duties json)
     ORDER BY ord
     RETURNING id, sort`,
    [JSON.stringify(drg.job_descriptions.map((j, ord) => ({ ...j, ord })))]);
  const jdId = Object.fromEntries(jdRows.map((r) => [r.sort, r.id]));
  await client.query(
    `INSERT INTO office_staff (sort, name, designation, section, duties, job_description_id, employee_id)
     SELECT x.ord, x.name, x.designation, x.section, x.duties, x.jd_id, e.id
     FROM json_to_recordset($1) AS x(ord int, name text, designation text, section text, duties text, jd_id int, employee_no text)
     LEFT JOIN employees e ON e.employee_no = x.employee_no`,
    [JSON.stringify(drg.staff.map((s, ord) => ({ ...s, ord, jd_id: jdId[s.jd] ?? null })))]);

  await client.query("COMMIT");
  const counts = await client.query(
    `SELECT (SELECT count(*) FROM units) units, (SELECT count(*) FROM budget_posts) posts,
            (SELECT count(*) FROM employees) employees, (SELECT count(*) FROM employee_charges) charges,
            (SELECT count(*) FROM vacancies) vacancies, (SELECT count(*) FROM establishment_posts) establishment,
            (SELECT count(*) FROM recruitment_rules) recruitment_rules, (SELECT count(*) FROM office_staff) drg_staff`);
  console.log("Loaded:", counts.rows[0]);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
