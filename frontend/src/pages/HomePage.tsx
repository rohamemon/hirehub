import {
  ArrowRight, BarChart3, Briefcase, CheckCircle2, FileSearch, GraduationCap, Handshake, Headphones, Landmark,
  Megaphone, Palette, Search, Sparkles, Users, type LucideIcon, Code2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CompanyLogo, JobCard } from "@/components/JobCard";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/Feedback";
import { useCategories, useCompanies, useJobFacets, useJobs } from "@/features/jobs/hooks";
import { useSeo } from "@/hooks/useSeo";

const ICONS: Record<string, LucideIcon> = {
  code: Code2, palette: Palette, megaphone: Megaphone, "bar-chart": BarChart3, landmark: Landmark,
  handshake: Handshake, users: Users, headphones: Headphones,
};

function SearchForm() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const facets = useJobFacets();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (location.trim()) p.set("location", location.trim());
    if (type) p.set("employment_type", type);
    nav(`/jobs?${p}`);
  };
  return (
    <form onSubmit={submit} role="search" aria-label="Search jobs" className="card mx-auto mt-8 grid max-w-3xl gap-3 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
      <div>
        <label htmlFor="hero-q" className="sr-only">Job title or keyword</label>
        <input id="hero-q" className="input" list="hero-titles" placeholder="Job title or keyword" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hero-loc" className="sr-only">Location</label>
        <input id="hero-loc" className="input" list="hero-locs" placeholder="City or country" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <datalist id="hero-titles">{facets.data?.titles.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="hero-locs">{facets.data?.locations.map((t) => <option key={t} value={t} />)}</datalist>
      <div>
        <label htmlFor="hero-type" className="sr-only">Job type</label>
        <select id="hero-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option><option value="internship">Internship</option><option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option><option value="contract">Contract</option>
        </select>
      </div>
      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700">
        <Search className="h-4 w-4" aria-hidden />Search
      </button>
    </form>
  );
}

export default function HomePage() {
  useSeo({ title: "HireHub - Jobs and internships for students and graduates", canonicalPath: "/",
    description: "Find internships, entry-level jobs and graduate roles, or hire emerging talent, on HireHub." });
  const jobs = useJobs({ page_size: 6 });
  const cats = useCategories();
  const companies = useCompanies({ page_size: 4 });

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="container-page py-16 text-center sm:py-24">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-card">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />Built for students and first-time job seekers
          </p>
          <h1 className="mx-auto mt-5 max-w-2xl text-3xl sm:text-5xl sm:leading-tight">Start your career with a team that wants you</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">Search internships and entry-level roles from verified employers, apply in minutes, and track every application in one place.</p>
          <SearchForm />
        </div>
      </section>

      <section className="container-page mt-16" aria-labelledby="featured">
        <div className="mb-6 flex items-end justify-between">
          <h2 id="featured" className="text-2xl">Latest opportunities</h2>
          <Link to="/jobs" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">View all jobs <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        {jobs.isPending ? <ListSkeleton rows={3} /> : jobs.isError ? <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} /> :
          jobs.data.items.length === 0 ? <EmptyState title="No jobs yet" description="Check back soon, new roles are posted every day." /> : (
            <div className="grid gap-4 lg:grid-cols-2">{jobs.data.items.map((j) => <JobCard key={j.id} job={j} />)}</div>
          )}
      </section>

      <section className="container-page mt-16" aria-labelledby="cats">
        <h2 id="cats" className="mb-6 text-2xl">Popular categories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(cats.data ?? []).map((c) => {
            const Icon = ICONS[c.icon ?? ""] ?? Briefcase;
            return (
              <Link key={c.id} to={`/jobs?category_id=${c.id}`} className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
                <span className="rounded-lg bg-brand-50 p-2 text-brand-600"><Icon className="h-5 w-5" aria-hidden /></span>
                <span className="text-sm font-medium">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-page mt-16" aria-labelledby="how">
        <h2 id="how" className="mb-8 text-center text-2xl">How HireHub works</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: GraduationCap, t: "Build your profile", d: "Add your education, skills and upload your CV once." },
            { icon: FileSearch, t: "Find the right role", d: "Filter by type, location, level and salary to see what fits." },
            { icon: CheckCircle2, t: "Apply and track", d: "Apply in a click and follow your status from pending to accepted." },
          ].map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
              <h3 className="mt-4 flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-brand-600" aria-hidden />{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page mt-16 grid gap-6 md:grid-cols-2" aria-label="Benefits">
        <div className="card p-8">
          <h2 className="text-xl">For students</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {["Free to use, always", "One profile and CV for every application", "Save jobs and apply later", "Live application status updates"].map((x) =>
              <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{x}</li>)}
          </ul>
          <LinkButton to="/register" className="mt-6">Create your profile</LinkButton>
        </div>
        <div className="card p-8">
          <h2 className="text-xl">For employers</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {["Publish vacancies in minutes", "Review applicants and CVs in one dashboard", "Move candidates through a clear pipeline", "Analytics on every listing"].map((x) =>
              <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{x}</li>)}
          </ul>
          <LinkButton to="/register?role=employer" variant="secondary" className="mt-6">Start hiring</LinkButton>
        </div>
      </section>

      <section className="container-page mt-16" aria-labelledby="cos">
        <div className="mb-6 flex items-end justify-between">
          <h2 id="cos" className="text-2xl">Featured companies</h2>
          <Link to="/companies" className="text-sm font-medium text-brand-600 hover:underline">All companies</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(companies.data?.items ?? []).map((c) => (
            <Link key={c.id} to={`/companies/${c.slug}`} className="card flex flex-col items-center p-5 text-center transition-shadow hover:shadow-md">
              <CompanyLogo company={c} size={52} />
              <p className="mt-3 text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-slate-500">{c.open_jobs} open role{c.open_jobs === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page mt-16">
        <div className="rounded-2xl bg-ink px-6 py-12 text-center">
          <h2 className="text-2xl text-white">Your next opportunity is waiting</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">Join HireHub today. It takes under two minutes to get started.</p>
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton to="/register" size="lg">Get started</LinkButton>
            <LinkButton to="/jobs" variant="secondary" size="lg">Browse jobs</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
