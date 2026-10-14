import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ChangePasswordForm, CreateUserForm, UserRowControls } from "@/components/user-forms";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireUser();
  if (me.role !== "admin") {
    return (
      <>
        <PageHeader title="My account" />
        <div className="max-w-md"><ChangePasswordForm /></div>
      </>
    );
  }
  const users = await query<{ id: number; username: string; full_name: string; role: string; is_active: boolean; last_login_at: string | null }>(
    "SELECT id, username, full_name, role, is_active, last_login_at FROM users ORDER BY is_active DESC, role, username");
  return (
    <>
      <PageHeader title="Users & access" subtitle="Administrators manage accounts; HR officers maintain records; viewers have read-only access." />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th className="text-right">Manage</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><div className="font-medium text-navy">{u.full_name}</div><div className="text-xs text-muted">{u.username}</div></td>
                    <td className="capitalize">{u.role === "hr" ? "HR Officer" : u.role}</td>
                    <td>{u.is_active ? <span className="badge bg-emerald-50 text-emerald-700">Active</span> : <span className="badge bg-slate-100 text-slate-500">Inactive</span>}</td>
                    <td className="text-xs whitespace-nowrap text-muted">{fmtDateTime(u.last_login_at)}</td>
                    <td><UserRowControls id={u.id} role={u.role} active={u.is_active} self={u.id === me.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="space-y-5">
          <CreateUserForm />
          <ChangePasswordForm />
        </div>
      </div>
    </>
  );
}
