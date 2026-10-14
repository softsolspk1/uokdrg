"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarClock, FileStack, LayoutDashboard, ScrollText, ShieldCheck, Users, UserPlus, Briefcase } from "lucide-react";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/employees/new", label: "Add Employee", icon: UserPlus, edit: true },
  { href: "/units", label: "Departments & Offices", icon: Building2 },
  { href: "/vacancies", label: "Vacant Positions", icon: Briefcase },
  { href: "/retirements", label: "Retirements", icon: CalendarClock },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/users", label: "Users", icon: ShieldCheck },
  { href: "/audit", label: "Activity Log", icon: ScrollText, admin: true },
];

export default function NavLinks({ role, mobile }: { role: string; mobile?: boolean }) {
  const path = usePathname();
  const links = LINKS.filter((l) => (!l.admin || role === "admin") && (!l.edit || role !== "viewer"))
    .map((l) => (l.href === "/users" && role !== "admin" ? { ...l, label: "My Account" } : l));
  const isActive = (href: string) =>
    href === "/" ? path === "/" : href === "/employees" ? path.startsWith("/employees") && path !== "/employees/new" : path.startsWith(href);

  if (mobile) {
    return (
      <nav className="flex gap-1 px-3 py-1.5">
        {links.map((l) => (
          <Link key={l.href} href={l.href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${isActive(l.href) ? "bg-uok-700 text-white" : "text-muted hover:bg-canvas"}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {links.map((l) => {
        const Icon = l.icon;
        const active = isActive(l.href);
        return (
          <Link key={l.href} href={l.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-uok-700 font-medium text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
            <Icon size={17} className={active ? "text-gold" : ""} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
