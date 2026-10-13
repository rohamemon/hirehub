import {
  BarChart3, Bell, BookmarkCheck, Briefcase, Building2, FileText, Flag, LayoutDashboard, LogOut, Menu, ScrollText,
  Tags, UserRound, Users, X, type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "@/features/auth/AuthContext";
import type { Role } from "@/types";
import { Logo, NotificationBell } from "./PublicLayout";

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean }

const NAV: Record<Role, Item[]> = {
  student: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/dashboard/applications", label: "My applications", icon: FileText },
    { to: "/dashboard/saved", label: "Saved jobs", icon: BookmarkCheck },
    { to: "/dashboard/profile", label: "Profile & CV", icon: UserRound },
    { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
  ],
  employer: [
    { to: "/employer", label: "Analytics", icon: BarChart3, end: true },
    { to: "/employer/jobs", label: "Job listings", icon: Briefcase },
    { to: "/employer/applicants", label: "Applicants", icon: Users },
    { to: "/employer/company", label: "Company", icon: Building2 },
    { to: "/employer/notifications", label: "Notifications", icon: Bell },
  ],
  admin: [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/jobs", label: "Jobs", icon: Briefcase },
    { to: "/admin/reports", label: "Reports", icon: Flag },
    { to: "/admin/categories", label: "Categories", icon: Tags },
    { to: "/admin/audit", label: "Audit log", icon: ScrollText },
    { to: "/admin/notifications", label: "Notifications", icon: Bell },
  ],
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const items = NAV[user.role];
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`;

  const sidebar = (
    <nav aria-label="Dashboard" className="flex flex-col gap-1 p-4">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={link} onClick={() => setOpen(false)}>
          <Icon className="h-4 w-4" aria-hidden />{label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button className="rounded-lg p-2 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell to={`${homeFor(user.role)}/notifications`} />
          <span className="hidden text-sm text-slate-600 sm:inline">{user.full_name}</span>
          <Link to="/jobs" className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 sm:block">Browse jobs</Link>
          <button onClick={async () => { await logout(); nav("/"); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
        {open && <div className="fixed inset-x-0 top-16 z-30 border-b border-slate-200 bg-white shadow-lg lg:hidden">{sidebar}</div>}
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-8"><div className="mx-auto max-w-5xl"><Outlet /></div></main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
      {action}
    </div>
  );
}
