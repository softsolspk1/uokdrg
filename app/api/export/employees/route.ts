import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { buildWhere, readFilters } from "@/lib/employee-filters";

const COLS: [string, string][] = [
  ["employee_no", "Employee No"], ["full_name", "Name"], ["father_name", "Father/Husband"], ["staff_type", "Staff Type"],
  ["designation", "Designation"], ["bps", "BPS"], ["unit", "Department/Office"], ["unit_category", "Unit Type"],
  ["status", "Status"], ["status_remarks", "Status Remarks"], ["employment_type", "Employment Type"], ["gender", "Gender"],
  ["cnic", "CNIC"], ["date_of_birth", "Date of Birth"], ["date_of_joining", "Date of Joining"], ["date_of_retirement", "Date of Retirement"],
  ["mobile", "Mobile"], ["email", "Email"], ["personnel_file_no", "Personal File No"], ["charges", "Administrative Charges"],
];

function csv(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  if (!(await getUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const f = readFilters(Object.fromEntries(req.nextUrl.searchParams));
  const { sql, params, order } = buildWhere(f);
  const rows = await query<Record<string, unknown>>(
    `SELECT e.employee_no, e.full_name, e.father_name, e.staff_type, e.designation, e.bps, e.status, e.status_remarks,
            e.employment_type, e.gender, e.cnic, e.date_of_birth, e.date_of_joining, e.date_of_retirement, e.mobile, e.email,
            e.personnel_file_no, u.name unit, u.category unit_category,
            (SELECT string_agg(c.role || coalesce(' - ' || c.unit_name, ''), '; ') FROM employee_charges c WHERE c.employee_id = e.id) charges
     FROM employees e LEFT JOIN units u ON u.id = e.unit_id ${sql} ORDER BY ${order}, e.id`, params);

  const lines = [COLS.map(([, h]) => h).join(","), ...rows.map((r) => COLS.map(([k]) => csv(r[k])).join(","))];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uok-employees-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
