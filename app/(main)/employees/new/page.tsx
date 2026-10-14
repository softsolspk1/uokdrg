import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import EmployeeForm from "@/components/employee-form";

export const metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  await requireRole("admin", "hr");
  const [units, designations] = await Promise.all([
    query<{ id: number; name: string }>("SELECT id, name FROM units ORDER BY name"),
    query<{ designation: string }>("SELECT designation FROM employees WHERE staff_type = 'Non-Teaching' AND designation IS NOT NULL GROUP BY designation ORDER BY count(*) DESC LIMIT 300"),
  ]);
  return (
    <>
      <PageHeader title="Add employee" subtitle="Create a new personnel record. Documents can be uploaded from the profile after saving." />
      <EmployeeForm units={units} designations={designations.map((d) => d.designation)} initial={{ status: "Working", nationality: "Pakistani", employment_type: "Permanent" }} />
    </>
  );
}
