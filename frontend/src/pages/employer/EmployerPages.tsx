import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Eye, FileText, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { z } from "zod";
import { Avatar } from "@/components/AuthedImage";
import { CompanyLogo } from "@/components/JobCard";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorState, FormError, JobStatusBadge, ListSkeleton, Skeleton, StatusBadge } from "@/components/ui/Feedback";
import { Input, Select, Textarea } from "@/components/ui/Form";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard, Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useChangeStatus, useEmployerJob, useEmployerJobs, useEmployerStats, useJobAction, useMyCompany, useSaveCompany, useSaveJob, useUploadLogo, useApplicants } from "@/features/employer/hooks";
import { useCategories } from "@/features/jobs/hooks";
import { useDebounce } from "@/hooks/useDebounce";
import { useSeo } from "@/hooks/useSeo";
import { PageHeader } from "@/layouts/DashboardLayout";
import { ApiError, downloadFile } from "@/services/api";
import type { Applicant, ApplicationStatus, EmploymentType, ExperienceLevel, JobInput, WorkplaceType } from "@/types";
import { EMPLOYMENT_LABELS, LEVEL_LABELS, STATUS_LABELS, WORKPLACE_LABELS, formatDate, formatDateTime } from "@/utils/format";

const GRID = "#e2e8f0", AXIS = "#64748b", BRAND = "#4f46e5";

function ChartCard({ title, data, xKey, children, tableCols }: {
  title: string; data: Record<string, string | number>[]; xKey: string; children: React.ReactNode; tableCols: [string, string];
}) {
  return (
    <figure className="card p-5">
      <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>
      <div className="h-64" aria-hidden>{children}</div>
      {/* Accessible table alternative to the chart */}
      <table className="sr-only"><caption>{title}</caption>
        <thead><tr><th>{tableCols[0]}</th><th>{tableCols[1]}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={String(d[xKey])}><td>{d[xKey]}</td><td>{d[tableCols[1].toLowerCase()] ?? d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function EmployerOverview() {
  useSeo({ title: "Employer analytics", noindex: true });
  const stats = useEmployerStats();
  const applicants = useApplicants({ page: 1 });
  const company = useMyCompany();
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;

  const statusData = stats.data ? Object.entries(STATUS_LABELS).map(([k, label]) => ({ status: label, value: stats.data.by_status[k] ?? 0 })) : [];
  const trend = stats.data?.trend.map((t) => ({ date: t.date.slice(5), value: t.applications })) ?? [];
  return (
    <>
      <PageHeader title="Analytics" description="How your listings are performing."
        action={<LinkButton to="/employer/jobs/new">Post a job</LinkButton>} />
      {company.data === null && (
        <div role="note" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>Create your company profile before posting jobs.</span><LinkButton to="/employer/company" size="sm">Set up company</LinkButton>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.isPending ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />) : <>
          <StatCard label="Total jobs" value={stats.data.total_jobs} icon={<Briefcase className="h-5 w-5" />} />
          <StatCard label="Published jobs" value={stats.data.published_jobs} icon={<Eye className="h-5 w-5" />} />
          <StatCard label="Active vacancies" value={stats.data.active_vacancies} icon={<Briefcase className="h-5 w-5" />} />
          <StatCard label="Total applications" value={stats.data.total_applications} icon={<Users className="h-5 w-5" />} />
        </>}
      </div>
      {stats.data && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Applications by status" data={statusData} xKey="status" tableCols={["Status", "Value"]}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="status" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={55} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [v, "Applications"]} />
                <Bar dataKey="value" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Applications, last 30 days" data={trend} xKey="date" tableCols={["Date", "Value"]}>
            {trend.length < 2 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Not enough data yet. Trends appear after a few days of applications.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [v, "Applications"]} />
                  <Line type="monotone" dataKey="value" stroke={BRAND} strokeWidth={2} dot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
      <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="text-lg">Recent applicants</h2><Link to="/employer/applicants" className="text-sm font-medium text-brand-600 hover:underline">View all</Link></div>
      {applicants.isPending ? <ListSkeleton rows={2} /> : applicants.data?.items.length === 0 ? <EmptyState title="No applicants yet" description="Publish a job to start receiving applications." /> : (
        <Table headers={["Candidate", "Job", "Applied", "Status"]} caption="Recent applicants">
          {applicants.data?.items.slice(0, 5).map((a) => (
            <tr key={a.id}><Td className="font-medium">{a.student.full_name}</Td><Td>{a.job.title}</Td><Td>{formatDate(a.created_at)}</Td><Td><StatusBadge status={a.status} /></Td></tr>
          ))}
        </Table>
      )}
    </>
  );
}

// ---- company -------------------------------------------------------------------

const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(160),
  description: z.string().max(5000), website: z.string().trim().refine((v) => !v || /^https?:\/\/\S+$/.test(v), "Must start with http:// or https://"),
  location: z.string().max(120), industry: z.string().max(100), size: z.string().max(40),
});
type CompanyForm = z.infer<typeof companySchema>;

export function EmployerCompany() {
  useSeo({ title: "Company profile", noindex: true });
  const company = useMyCompany();
  const exists = !!company.data;
  const save = useSaveCompany(exists);
  const logo = useUploadLogo();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<CompanyForm>({ resolver: zodResolver(companySchema), defaultValues: { name: "", description: "", website: "", location: "", industry: "", size: "" } });
  useEffect(() => {
    const c = company.data;
    if (c) reset({ name: c.name, description: c.description ?? "", website: c.website ?? "", location: c.location ?? "", industry: c.industry ?? "", size: c.size ?? "" });
  }, [company.data, reset]);

  if (company.isPending) return <ListSkeleton rows={2} />;
  if (company.isError) return <ErrorState error={company.error} onRetry={() => company.refetch()} />;
  const onSubmit = handleSubmit((v) => save.mutate(v, { onSuccess: () => toast.success("Company saved"), onError: toast.error }));
  return (
    <>
      <PageHeader title="Company profile" description={exists ? "This is shown on your public company page." : "Create your company to start posting jobs."}
        action={company.data && <LinkButton variant="secondary" to={`/companies/${company.data.slug}`}>View public page</LinkButton>} />
      <form onSubmit={onSubmit} noValidate className="card space-y-5 p-6">
        {company.data && (
          <div className="flex items-center gap-4">
            <CompanyLogo company={company.data} size={72} />
            <div>
              <Button type="button" variant="secondary" size="sm" loading={logo.isPending} onClick={() => input.current?.click()}>Upload logo</Button>
              <p className="mt-1 text-xs text-slate-500">PNG or JPEG, up to 2 MB</p>
              <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Choose company logo" tabIndex={-1}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) logo.mutate(f, { onSuccess: () => toast.success("Logo updated"), onError: toast.error }); e.target.value = ""; }} />
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Company name" error={errors.name?.message} {...register("name")} />
          <Input label="Industry" error={errors.industry?.message} {...register("industry")} />
          <Input label="Location" error={errors.location?.message} {...register("location")} />
          <Input label="Company size" placeholder="e.g. 11-50" error={errors.size?.message} {...register("size")} />
          <Input label="Website" placeholder="https://" className="sm:col-span-2" error={errors.website?.message} {...register("website")} />
        </div>
        <Textarea label="Description" rows={5} error={errors.description?.message} {...register("description")} />
        <FormError error={save.error} />
        <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={exists && !isDirty}>{exists ? "Save changes" : "Create company"}</Button></div>
      </form>
    </>
  );
}

// ---- jobs ----------------------------------------------------------------------

export function EmployerJobs() {
  useSeo({ title: "Job listings", noindex: true });
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const jobs = useEmployerJobs({ status: status || undefined, q: dq || undefined, page });
  const action = useJobAction();
  const toast = useToast();
  const [del, setDel] = useState<string | null>(null);
  const run = (id: string, a: "publish" | "close", msg: string) => action.mutate({ id, action: a }, { onSuccess: () => toast.success(msg), onError: toast.error });
  return (
    <>
      <PageHeader title="Job listings" action={<LinkButton to="/employer/jobs/new">New job</LinkButton>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input label="Search" placeholder="Search by title" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option><option value="removed">Removed</option>
        </Select>
      </div>
      {jobs.isPending ? <ListSkeleton /> : jobs.isError ? (
        jobs.error instanceof ApiError && jobs.error.code === "company_required"
          ? <EmptyState title="Set up your company first" action={<LinkButton to="/employer/company">Create company</LinkButton>} />
          : <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : jobs.data.items.length === 0 ? <EmptyState title="No listings" description="Create your first job listing." action={<LinkButton to="/employer/jobs/new">New job</LinkButton>} /> : (
        <>
          <Table headers={["Title", "Status", "Applicants", "Posted", "Actions"]} caption="Your job listings">
            {jobs.data.items.map((j) => (
              <tr key={j.id}>
                <Td><span className="font-medium">{j.title}</span><div className="text-xs text-slate-500">{EMPLOYMENT_LABELS[j.employment_type]}</div></Td>
                <Td><JobStatusBadge status={j.status} /></Td>
                <Td><Link className="text-brand-600 hover:underline" to={`/employer/applicants?job_id=${j.id}`}>{j.application_count ?? 0}</Link></Td>
                <Td>{formatDate(j.published_at ?? j.created_at)}</Td>
                <Td><div className="flex flex-wrap gap-1">
                  {j.status !== "removed" && <LinkButton size="sm" variant="secondary" to={`/employer/jobs/${j.id}`}>Edit</LinkButton>}
                  {(j.status === "draft" || j.status === "closed") && <Button size="sm" onClick={() => run(j.id, "publish", "Job published")}>Publish</Button>}
                  {j.status === "published" && <Button size="sm" variant="secondary" onClick={() => run(j.id, "close", "Job closed")}>Close</Button>}
                  {j.status === "published" && <LinkButton size="sm" variant="ghost" to={`/jobs/${j.id}`}>View</LinkButton>}
                  <Button size="sm" variant="ghost" onClick={() => setDel(j.id)}>Delete</Button>
                </div></Td>
              </tr>
            ))}
          </Table>
          <Pagination page={jobs.data.page} pages={jobs.data.pages} total={jobs.data.total} onChange={setPage} />
        </>
      )}
      <ConfirmDialog open={!!del} danger title="Delete this listing?" message="Listings with applications can't be deleted; close them instead." confirmLabel="Delete" loading={action.isPending}
        onClose={() => setDel(null)} onConfirm={() => del && action.mutate({ id: del, action: "delete" }, { onSuccess: () => { setDel(null); toast.success("Job deleted"); }, onError: (e) => { setDel(null); toast.error(e); } })} />
    </>
  );
}

const numField = z.preprocess((v) => (v === "" || v == null || Number.isNaN(v) ? null : v), z.number().int().min(0).max(10_000_000).nullable());
const jobSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().trim().min(20, "Describe the role in at least 20 characters").max(10000),
  responsibilities: z.string().max(5000), requirements: z.string().max(5000), skills: z.string(),
  category_id: z.string(), employment_type: z.enum(["full_time", "part_time", "internship", "contract", "temporary"]),
  experience_level: z.enum(["entry", "junior", "mid", "senior"]), workplace_type: z.enum(["remote", "hybrid", "on_site"]),
  location: z.string().max(120), salary_min: numField, salary_max: numField, salary_currency: z.string().length(3), deadline: z.string(),
}).refine((v) => v.workplace_type === "remote" || v.location.trim().length > 0, { path: ["location"], message: "Location is required unless remote" })
  .refine((v) => v.salary_min == null || v.salary_max == null || v.salary_min <= v.salary_max, { path: ["salary_max"], message: "Maximum must be at least the minimum" });
type JobForm = z.input<typeof jobSchema>;

export function EmployerJobForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const existing = useEmployerJob(id);
  const cats = useCategories();
  const save = useSaveJob(id);
  const action = useJobAction();
  useSeo({ title: id ? "Edit job" : "New job", noindex: true });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: { title: "", description: "", responsibilities: "", requirements: "", skills: "", category_id: "", employment_type: "full_time",
      experience_level: "entry", workplace_type: "on_site", location: "", salary_min: "", salary_max: "", salary_currency: "USD", deadline: "" } as JobForm,
  });
  useEffect(() => {
    const j = existing.data;
    if (j) reset({ title: j.title, description: j.description, responsibilities: j.responsibilities ?? "", requirements: j.requirements ?? "", skills: j.skills.join(", "),
      category_id: j.category?.id ?? "", employment_type: j.employment_type, experience_level: j.experience_level, workplace_type: j.workplace_type,
      location: j.location ?? "", salary_min: j.salary_min ?? "", salary_max: j.salary_max ?? "", salary_currency: j.salary_currency, deadline: j.deadline ?? "" } as JobForm);
  }, [existing.data, reset]);

  if (id && existing.isPending) return <ListSkeleton rows={2} />;
  if (id && existing.isError) return <ErrorState error={existing.error} />;

  const submit = (publish: boolean) => handleSubmit((raw) => {
    const v = jobSchema.parse(raw);
    const body: JobInput = { ...v, skills: v.skills.split(",").map((s) => s.trim()).filter(Boolean), category_id: v.category_id || null,
      location: v.location.trim() || null, responsibilities: v.responsibilities || null, requirements: v.requirements || null, deadline: v.deadline || null };
    save.mutate(body, {
      onSuccess: (job) => {
        if (!publish || job.status === "published") { toast.success("Job saved"); return nav("/employer/jobs"); }
        action.mutate({ id: job.id, action: "publish" }, { onSuccess: () => { toast.success("Job published"); nav("/employer/jobs"); }, onError: (e) => { toast.error(e); nav(`/employer/jobs/${job.id}`); } });
      },
      onError: toast.error,
    });
  });
  const busy = save.isPending || action.isPending;
  return (
    <>
      <PageHeader title={id ? "Edit job" : "New job"} description={existing.data ? `Status: ${existing.data.status}` : "Save as a draft or publish right away."} />
      <form noValidate onSubmit={submit(false)} className="card space-y-5 p-6">
        <Input label="Job title" error={errors.title?.message} {...register("title")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" {...register("category_id")}><option value="">None</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select label="Employment type" {...register("employment_type")}>{(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((k) => <option key={k} value={k}>{EMPLOYMENT_LABELS[k]}</option>)}</Select>
          <Select label="Experience level" {...register("experience_level")}>{(Object.keys(LEVEL_LABELS) as ExperienceLevel[]).map((k) => <option key={k} value={k}>{LEVEL_LABELS[k]}</option>)}</Select>
          <Select label="Workplace" {...register("workplace_type")}>{(Object.keys(WORKPLACE_LABELS) as WorkplaceType[]).map((k) => <option key={k} value={k}>{WORKPLACE_LABELS[k]}</option>)}</Select>
          <Input label="Location" error={errors.location?.message} {...register("location")} />
          <Input label="Application deadline" type="date" error={errors.deadline?.message} {...register("deadline")} />
          <Input label="Salary minimum (per year)" type="number" min={0} error={errors.salary_min?.message as string | undefined} {...register("salary_min")} />
          <Input label="Salary maximum (per year)" type="number" min={0} error={errors.salary_max?.message as string | undefined} {...register("salary_max")} />
          <Input label="Currency (ISO code)" maxLength={3} error={errors.salary_currency?.message} {...register("salary_currency")} />
        </div>
        <Textarea label="Description" rows={6} error={errors.description?.message} {...register("description")} />
        <Textarea label="Responsibilities" rows={4} hint="One per line" {...register("responsibilities")} />
        <Textarea label="Requirements" rows={4} hint="One per line" {...register("requirements")} />
        <Input label="Required skills" hint="Comma separated" {...register("skills")} />
        <FormError error={save.error ?? action.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => nav("/employer/jobs")}>Cancel</Button>
          <Button type="submit" variant="secondary" loading={busy}>Save {existing.data?.status === "published" ? "changes" : "as draft"}</Button>
          {existing.data?.status !== "published" && <Button loading={busy} onClick={submit(true)}>Save &amp; publish</Button>}
        </div>
      </form>
    </>
  );
}

// ---- applicants ------------------------------------------------------------------

const NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ["reviewed", "shortlisted", "rejected"], reviewed: ["shortlisted", "rejected"], shortlisted: ["interview", "rejected"],
  interview: ["accepted", "rejected"], accepted: [], rejected: [], withdrawn: [],
};

function ApplicantModal({ a, onClose }: { a: Applicant; onClose: () => void }) {
  const change = useChangeStatus();
  const toast = useToast();
  const [current, setCurrent] = useState(a);
  const s = current.student;
  return (
    <Modal open onClose={onClose} title={s.full_name}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <Avatar userId={s.user_id} enabled={s.has_avatar} name={s.full_name} />
          <div><p className="font-medium">{s.headline ?? "Student"}</p><p className="text-slate-500">{s.email}{s.location ? ` - ${s.location}` : ""}</p></div>
        </div>
        <p>Applied for <strong>{current.job.title}</strong> on {formatDate(current.created_at)} <StatusBadge status={current.status} /></p>
        {s.skills.length > 0 && <div className="flex flex-wrap gap-1.5">{s.skills.map((k) => <Badge key={k} tone="brand">{k}</Badge>)}</div>}
        {s.bio && <section><h3 className="text-sm">About</h3><p className="prose-plain">{s.bio}</p></section>}
        {s.education && <section><h3 className="text-sm">Education</h3><p className="prose-plain">{s.education}</p></section>}
        {s.experience && <section><h3 className="text-sm">Experience</h3><p className="prose-plain">{s.experience}</p></section>}
        <section><h3 className="text-sm">Cover letter</h3><p className="prose-plain">{current.cover_letter || "No cover letter provided."}</p></section>
        <div className="flex flex-wrap gap-3">
          {[["Portfolio", s.portfolio_url], ["GitHub", s.github_url], ["LinkedIn", s.linkedin_url]].map(([l, u]) => u &&
            <a key={l} href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-600 underline">{l}<span className="sr-only"> (opens in a new tab)</span></a>)}
        </div>
        {current.has_cv && <Button variant="secondary" size="sm" onClick={() => downloadFile(`/applications/${current.id}/cv`, `${s.full_name.replace(/\s+/g, "_")}_CV.pdf`).catch(toast.error)}><FileText className="h-4 w-4" aria-hidden />Download CV</Button>}
        <section><h3 className="text-sm">History</h3>
          <ol className="mt-1 space-y-1 text-xs text-slate-600">{current.history.map((h, i) => <li key={i}>{formatDateTime(h.created_at)}: {STATUS_LABELS[h.to_status as ApplicationStatus] ?? h.to_status}</li>)}</ol></section>
        {NEXT[current.status].length > 0 && (
          <div className="border-t border-slate-200 pt-4"><p className="mb-2 font-medium">Move to:</p>
            <div className="flex flex-wrap gap-2">
              {NEXT[current.status].map((n) => (
                <Button key={n} size="sm" variant={n === "rejected" ? "danger" : "secondary"} loading={change.isPending && change.variables?.status === n}
                  onClick={() => change.mutate({ id: current.id, status: n }, { onSuccess: (u) => { setCurrent(u); toast.success(`Marked ${STATUS_LABELS[n].toLowerCase()}`); }, onError: toast.error })}>{STATUS_LABELS[n]}</Button>
              ))}
            </div></div>
        )}
      </div>
    </Modal>
  );
}

export function EmployerApplicants() {
  useSeo({ title: "Applicants", noindex: true });
  const params = new URLSearchParams(window.location.search);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const jobId = params.get("job_id") ?? undefined;
  const list = useApplicants({ status: status || undefined, q: dq || undefined, job_id: jobId, page });
  const [open, setOpen] = useState<Applicant | null>(null);
  return (
    <>
      <PageHeader title="Applicants" description={jobId ? "Showing applicants for one job." : "People who applied to your jobs."}
        action={jobId && <LinkButton variant="secondary" to="/employer/applicants">Show all</LinkButton>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input label="Search" placeholder="Name, email or job title" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {list.isPending ? <ListSkeleton /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.items.length === 0 ? (
        <EmptyState title="No applicants found" description="Try changing the filters." />
      ) : (
        <>
          <Table headers={["Candidate", "Job", "Applied", "Status", ""]} caption="Applicants">
            {list.data.items.map((a) => (
              <tr key={a.id}><Td><span className="font-medium">{a.student.full_name}</span><div className="text-xs text-slate-500">{a.student.headline}</div></Td>
                <Td>{a.job.title}</Td><Td>{formatDate(a.created_at)}</Td><Td><StatusBadge status={a.status} /></Td>
                <Td className="text-right"><Button size="sm" variant="secondary" onClick={() => setOpen(a)}>Review</Button></Td></tr>
            ))}
          </Table>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} onChange={setPage} />
        </>
      )}
      {open && <ApplicantModal a={open} onClose={() => setOpen(null)} />}
    </>
  );
}

