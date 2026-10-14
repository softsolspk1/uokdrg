-- University of Karachi HRM — PostgreSQL schema
-- Safe to re-run: every object is created IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'hr', 'viewer')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Departments, institutes, centres and administrative offices (budget book "S.No" = code)
CREATE TABLE IF NOT EXISTS units (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  sheet       TEXT,
  source_name TEXT,
  head_employee_id INTEGER,
  phone       TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sanctioned posts per unit from the approved budget book
CREATE TABLE IF NOT EXISTS budget_posts (
  id          SERIAL PRIMARY KEY,
  unit_id     INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  section     TEXT,
  designation TEXT NOT NULL,
  bps         INTEGER,
  positions   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS budget_posts_unit_idx ON budget_posts(unit_id);

CREATE TABLE IF NOT EXISTS employees (
  id                  SERIAL PRIMARY KEY,
  employee_no         TEXT NOT NULL UNIQUE,
  personnel_file_no   TEXT,
  -- personal
  full_name           TEXT NOT NULL,
  father_name         TEXT,
  gender              TEXT,
  date_of_birth       DATE,
  dob_derived         BOOLEAN NOT NULL DEFAULT FALSE,
  cnic                TEXT,
  marital_status      TEXT,
  religion            TEXT,
  nationality         TEXT DEFAULT 'Pakistani',
  domicile            TEXT,
  blood_group         TEXT,
  -- contact
  mobile              TEXT,
  phone               TEXT,
  email               TEXT,
  present_address     TEXT,
  permanent_address   TEXT,
  city                TEXT,
  emergency_name      TEXT,
  emergency_relation  TEXT,
  emergency_phone     TEXT,
  -- employment
  staff_type          TEXT NOT NULL CHECK (staff_type IN ('Teaching', 'Non-Teaching')),
  designation         TEXT,
  bps                 INTEGER,
  unit_id             INTEGER REFERENCES units(id) ON DELETE SET NULL,
  employment_type     TEXT DEFAULT 'Permanent',
  status              TEXT NOT NULL DEFAULT 'Working',
  status_remarks      TEXT,
  date_of_joining     DATE,
  date_of_current_post DATE,
  date_of_retirement  DATE,
  director_id         TEXT,
  posting_label       TEXT,
  -- payroll
  bank_name           TEXT,
  bank_branch         TEXT,
  bank_account        TEXT,
  ntn                 TEXT,
  basic_pay           NUMERIC(12, 2),
  -- misc
  photo               BYTEA,
  photo_mime          TEXT,
  remarks             TEXT,
  source              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_unit_idx ON employees(unit_id);
CREATE INDEX IF NOT EXISTS employees_type_idx ON employees(staff_type);
CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);
CREATE INDEX IF NOT EXISTS employees_retire_idx ON employees(date_of_retirement);
CREATE INDEX IF NOT EXISTS employees_name_idx ON employees(lower(full_name));

-- Administrative charges (Chairperson / Director / Dean / In-charge, terms)
CREATE TABLE IF NOT EXISTS employee_charges (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  unit_id      INTEGER REFERENCES units(id) ON DELETE SET NULL,
  unit_name    TEXT,
  present_from DATE,
  present_to   TEXT,
  second_term  TEXT,
  first_from   DATE,
  first_to     DATE,
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS employee_charges_emp_idx ON employee_charges(employee_id);

CREATE TABLE IF NOT EXISTS qualifications (
  id             SERIAL PRIMARY KEY,
  employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  degree         TEXT NOT NULL,
  specialization TEXT,
  institution    TEXT,
  passing_year   INTEGER,
  grade          TEXT
);

CREATE TABLE IF NOT EXISTS experiences (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  organization TEXT NOT NULL,
  designation  TEXT,
  from_date    DATE,
  to_date      DATE,
  remarks      TEXT
);

CREATE TABLE IF NOT EXISTS family_members (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  relation      TEXT NOT NULL,
  date_of_birth DATE,
  cnic          TEXT,
  occupation    TEXT
);

-- Appointment / promotion / transfer / upgradation etc.
CREATE TABLE IF NOT EXISTS service_records (
  id             SERIAL PRIMARY KEY,
  employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  effective_date DATE,
  designation    TEXT,
  bps            INTEGER,
  unit_name      TEXT,
  order_no       TEXT,
  remarks        TEXT
);

CREATE TABLE IF NOT EXISTS leaves (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL,
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  days        INTEGER,
  status      TEXT NOT NULL DEFAULT 'Approved',
  order_no    TEXT,
  remarks     TEXT
);

-- Uploaded documents are stored in the database so the app is stateless / deployable anywhere
CREATE TABLE IF NOT EXISTS documents (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  title        TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  data         BYTEA NOT NULL,
  uploaded_by  TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_emp_idx ON documents(employee_id);

-- Non-teaching vacancy statements
CREATE TABLE IF NOT EXISTS vacancies (
  id          SERIAL PRIMARY KEY,
  grp         TEXT NOT NULL,
  post        TEXT NOT NULL,
  department  TEXT,
  bps         TEXT,
  sanctioned  INTEGER NOT NULL DEFAULT 0,
  working     INTEGER NOT NULL DEFAULT 0,
  vacant      INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  username    TEXT,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   INTEGER,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
