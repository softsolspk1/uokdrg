import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import NavLinks from "@/components/nav-links";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy text-slate-200 lg:flex">
        <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="rounded-md bg-white p-1">
            <Image src="/uok-logo.png" alt="University of Karachi" width={30} height={36} />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-sm font-bold text-white">University of Karachi</div>
            <div className="text-[11px] tracking-wider text-gold uppercase">HR Management</div>
          </div>
        </Link>
        <NavLinks role={user.role} />
        <div className="border-t border-white/10 p-4 text-xs text-slate-400">
          Office of the Deputy Registrar (Establishment)
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="h-1 bg-gradient-to-r from-uok-700 via-crimson to-gold" />
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <Image src="/uok-logo.png" alt="" width={26} height={31} />
            <span className="font-serif text-sm font-bold text-uok-700">UoK HRM</span>
          </div>
          <div className="hidden text-sm text-muted lg:block">Human Resource Management System</div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-ink">{user.name}</div>
              <div className="text-xs text-muted capitalize">{user.role === "hr" ? "HR Officer" : user.role}</div>
            </div>
            <form action={logout}>
              <button className="btn-secondary btn-sm" title="Sign out"><LogOut size={14} /> <span className="hidden sm:inline">Sign out</span></button>
            </form>
          </div>
        </div>
        <div className="overflow-x-auto border-t border-line lg:hidden">
          <NavLinks role={user.role} mobile />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
