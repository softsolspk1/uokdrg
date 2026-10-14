import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import EmployeeForm, { type EmployeeFormValues } from "@/components/employee-form";

export const metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "hr");
  const id = Number((await params).id);
  const emp = await queryOne<EmployeeFormValues>(
    `SELECT id, employee_no, full_name, father_name, gender, date_of_birth, cnic, marital_status, religion, nationality, domicile, blood_group,
            mobile, phone, email, present_address, permanent_address, city, emergency_name, emergency_relation, emergency_phone,
            staff_type, designation, bps, unit_id, employment_type, status, status_remarks, date_of_joining, date_of_current_post,
            date_of_retirement, personnel_file_no, bank_name, bank_branch, bank_account, ntn, basic_pay, remarks
     FROM employees WHERE id = $1`, [id || 0]);
  if (!emp) notFound();
  const [units, designations] = await Promise.all([
    query<{ id: number; name: string }>("SELECT id, name FROM units ORDER BY name"),
    query<{ designation: string }>("SELECT designation FROM employees WHERE staff_type = 'Non-Teaching' AND designation IS NOT NULL GROUP BY designation ORDER BY count(*) DESC LIMIT 300"),
  ]);
  return (
    <>
      <PageHeader title={`Edit — ${emp.full_name}`} subtitle={String(emp.employee_no)} />
      <EmployeeForm initial={emp} units={units} designations={designations.map((d) => d.designation)} />
    </>
  );
}
