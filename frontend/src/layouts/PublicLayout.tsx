import { Bell, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { buttonClass } from "@/components/ui/Button";
import { homeFor, useAuth } from "@/features/auth/AuthContext";
import { useUnreadCount } from "@/features/notifications/hooks";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold" aria-label="HireHub home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">H</span>
      <span className={light ? "text-white" : "text-ink"}>HireHub</span>
    </Link>
  );
}

export function NotificationBell({ to }: { to: string }) {
  const { user } = useAuth();
  const { data } = useUnreadCount(!!user);
  const n = data?.count ?? 0;
  return (
    <Link to={to} aria-label={n ? `Notifications, ${n} unread` : "Notifications"} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
      <Bell className="h-5 w-5" aria-hidden />
      {n > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "text-brand-700" : "text-slate-600 hover:text-ink"}`;

function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const signOut = async () => { await logout(); setOpen(false); nav("/"); };

  const links = (
    <>
      <NavLink to="/jobs" className={navLink} onClick={() => setOpen(false)}>Find jobs</NavLink>
      <NavLink to="/companies" className={navLink} onClick={() => setOpen(false)}>Companies</NavLink>
      <NavLink to="/about" className={navLink} onClick={() => setOpen(false)}>About</NavLink>
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">{links}</nav>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <NotificationBell to={`${homeFor(user.role)}/notifications`} />
              <Link to={homeFor(user.role)} className={buttonClass("secondary", "sm")}>Dashboard</Link>
              <button onClick={signOut} className={buttonClass("ghost", "sm")}><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className={buttonClass("ghost", "sm")}>Log in</Link>
              <Link to="/register" className={buttonClass("primary", "sm")}>Sign up</Link>
            </>
          )}
        </div>
        <button className="rounded-lg p-2 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col py-2">{links}</nav>
          <div className="flex flex-col gap-2 pt-2">
            {user ? (
              <>
                <Link to={homeFor(user.role)} onClick={() => setOpen(false)} className={buttonClass("secondary")}>Dashboard</Link>
                <button onClick={signOut} className={buttonClass("ghost")}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className={buttonClass("secondary")}>Log in</Link>
                <Link to="/register" onClick={() => setOpen(false)} className={buttonClass("primary")}>Sign up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const col = "space-y-2 text-sm text-slate-400";
  const a = "hover:text-white";
  return (
    <footer className="mt-20 bg-ink text-slate-300">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-sm text-slate-400">Connecting students and graduates with employers who value emerging talent.</p>
        </div>
        <div><h2 className="mb-3 text-sm text-white">Candidates</h2>
          <ul className={col}>
            <li><Link className={a} to="/jobs">Browse jobs</Link></li>
            <li><Link className={a} to="/jobs?employment_type=internship">Internships</Link></li>
            <li><Link className={a} to="/register">Create a profile</Link></li>
          </ul></div>
        <div><h2 className="mb-3 text-sm text-white">Employers</h2>
          <ul className={col}>
            <li><Link className={a} to="/register?role=employer">Post a job</Link></li>
            <li><Link className={a} to="/companies">Companies</Link></li>
            <li><Link className={a} to="/login">Employer login</Link></li>
          </ul></div>
        <div><h2 className="mb-3 text-sm text-white">Company</h2>
          <ul className={col}>
            <li><Link className={a} to="/about">About</Link></li>
            <li><Link className={a} to="/contact">Contact</Link></li>
            <li><Link className={a} to="/privacy">Privacy Policy</Link></li>
            <li><Link className={a} to="/terms">Terms &amp; Conditions</Link></li>
          </ul></div>
      </div>
      <div className="border-t border-slate-700 py-5 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} HireHub. A portfolio project. &middot; hello@hirehub.example
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
