import { Briefcase, Building2, FileText, Flag, GraduationCap, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, EmptyState, ErrorState, FormError, JobStatusBadge, ListSkeleton, Skeleton } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Form";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard, Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAdminJobs, useAdminStats, useAdminUsers, useAuditLogs, useDeleteCategory, useModerateJob, useReports, useResolveReport, useSaveCategory, useSetUserActive } from "@/features/admin/hooks";
import { useCategories } from "@/features/jobs/hooks";
import { useDebounce } from "@/hooks/useDebounce";
import { useSeo } from "@/hooks/useSeo";
import { PageHeader } from "@/layouts/DashboardLayout";
import { formatDate, formatDateTime, humanize } from "@/utils/format";

export function AdminOverview() {
  useSeo({ title: "Admin overview", noindex: true });
  const s = useAdminStats();
  if (s.isError) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  return (
    <>
      <PageHeader title="Platform overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {s.isPending ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />) : <>
          <StatCard label="Registered users" value={s.data.total_users} icon={<Users className="h-5 w-5" />} />
          <StatCard label="Students" value={s.data.students} icon={<GraduationCap className="h-5 w-5" />} />
          <StatCard label="Employers" value={s.data.employers} icon={<Briefcase className="h-5 w-5" />} />
          <StatCard label="Companies" value={s.data.companies} icon={<Building2 className="h-5 w-5" />} />
          <StatCard label={`Jobs (${s.data.published_jobs} published, ${s.data.closed_jobs} closed)`} value={s.data.total_jobs} icon={<Briefcase className="h-5 w-5" />} />
          <StatCard label="Applications" value={s.data.total_applications} icon={<FileText className="h-5 w-5" />} />
        </>}
      </div>
      {s.data && s.data.open_reports > 0 && (
        <Link to="/admin/reports" className="mt-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Flag className="h-4 w-4" aria-hidden />{s.data.open_reports} open report{s.data.open_reports === 1 ? "" : "s"} need review
        </Link>
      )}
      <h2 className="mb-3 mt-8 text-lg">Recent activity</h2>
      {s.data && (s.data.recent_activity.length === 0 ? <EmptyState title="No activity yet" /> : (
        <Table headers={["When", "Actor", "Action"]} caption="Recent activity">
          {s.data.recent_activity.map((a) => <tr key={a.id}><Td>{formatDateTime(a.created_at)}</Td><Td>{a.actor_email ?? "system"}</Td><Td>{humanize(a.action)}</Td></tr>)}
        </Table>
      ))}
    </>
  );
}

export function AdminUsers() {
  useSeo({ title: "Users", noindex: true });
  const [q, setQ] = useState(""); const [role, setRole] = useState(""); const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const users = useAdminUsers({ q: dq || undefined, role: role || undefined, page });
  const toggle = useSetUserActive();
  const toast = useToast();
  const [target, setTarget] = useState<{ id: string; name: string; active: boolean } | null>(null);
  return (
    <>
      <PageHeader title="Users" />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input label="Search" placeholder="Name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="student">Students</option><option value="employer">Employers</option><option value="admin">Admins</option>
        </Select>
      </div>
      {users.isPending ? <ListSkeleton /> : users.isError ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : users.data.items.length === 0 ? <EmptyState title="No users found" /> : (
        <>
          <Table headers={["Name", "Email", "Role", "Joined", "Status", ""]} caption="Users">
            {users.data.items.map((u) => (
              <tr key={u.id}><Td className="font-medium">{u.full_name}</Td><Td>{u.email}</Td><Td><Badge tone={u.role === "admin" ? "brand" : "gray"}>{u.role}</Badge></Td>
                <Td>{formatDate(u.created_at)}</Td><Td><Badge tone={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Disabled"}</Badge></Td>
                <Td className="text-right">{u.role !== "admin" && <Button size="sm" variant="ghost" onClick={() => setTarget({ id: u.id, name: u.full_name, active: u.is_active })}>{u.is_active ? "Disable" : "Reactivate"}</Button>}</Td></tr>
            ))}
          </Table>
          <Pagination page={users.data.page} pages={users.data.pages} total={users.data.total} onChange={setPage} />
        </>
      )}
      <ConfirmDialog open={!!target} danger={target?.active} title={target?.active ? "Disable account?" : "Reactivate account?"}
        message={target?.active ? `${target?.name} will be signed out and unable to log in.` : `${target?.name} will be able to log in again.`}
        confirmLabel={target?.active ? "Disable" : "Reactivate"} loading={toggle.isPending} onClose={() => setTarget(null)}
        onConfirm={() => target && toggle.mutate({ id: target.id, is_active: !target.active }, { onSuccess: () => { setTarget(null); toast.success("Account updated"); }, onError: (e) => { setTarget(null); toast.error(e); } })} />
    </>
  );
}

export function AdminJobs() {
  useSeo({ title: "Moderate jobs", noindex: true });
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const jobs = useAdminJobs({ q: dq || undefined, status: status || undefined, page });
  const moderate = useModerateJob();
  const toast = useToast();
  return (
    <>
      <PageHeader title="Job moderation" />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input label="Search" placeholder="Job title" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option><option value="removed">Removed</option>
        </Select>
      </div>
      {jobs.isPending ? <ListSkeleton /> : jobs.isError ? <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} /> : jobs.data.items.length === 0 ? <EmptyState title="No jobs found" /> : (
        <>
          <Table headers={["Title", "Company", "Status", "Created", ""]} caption="Jobs">
            {jobs.data.items.map((j) => (
              <tr key={j.id}><Td className="font-medium">{j.status === "published" ? <Link className="hover:text-brand-600" to={`/jobs/${j.id}`}>{j.title}</Link> : j.title}</Td>
                <Td>{j.company.name}</Td><Td><JobStatusBadge status={j.status} /></Td><Td>{formatDate(j.created_at)}</Td>
                <Td className="text-right">{j.status === "removed"
                  ? <Button size="sm" variant="secondary" onClick={() => moderate.mutate({ id: j.id, action: "restore" }, { onSuccess: () => toast.success("Listing restored"), onError: toast.error })}>Restore</Button>
                  : <Button size="sm" variant="ghost" onClick={() => moderate.mutate({ id: j.id, action: "remove" }, { onSuccess: () => toast.success("Listing removed"), onError: toast.error })}>Remove</Button>}</Td></tr>
            ))}
          </Table>
          <Pagination page={jobs.data.page} pages={jobs.data.pages} total={jobs.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}

export function AdminReports() {
  useSeo({ title: "Reports", noindex: true });
  const [status, setStatus] = useState("open"); const [page, setPage] = useState(1);
  const reports = useReports(status, page);
  const resolve = useResolveReport();
  const toast = useToast();
  const act = (id: string, action: "resolve" | "dismiss", remove_job: boolean) =>
    resolve.mutate({ id, action, remove_job }, { onSuccess: () => toast.success("Report updated"), onError: toast.error });
  return (
    <>
      <PageHeader title="Reported listings" />
      <Select label="Status" className="mb-4 max-w-xs" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
      </Select>
      {reports.isPending ? <ListSkeleton /> : reports.isError ? <ErrorState error={reports.error} /> : reports.data.items.length === 0 ? <EmptyState title="No reports" description="Nothing to review here." /> : (
        <>
          <div className="space-y-3">
            {reports.data.items.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-medium">{r.job.title} <span className="text-slate-500">at {r.job.company.name}</span></p>
                    <p className="mt-1 text-sm text-slate-600"><Badge tone="amber">{humanize(r.reason)}</Badge> {formatDate(r.created_at)}</p>
                    {r.details && <p className="mt-2 text-sm text-slate-700">{r.details}</p>}</div>
                  {r.status === "open" && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="danger" onClick={() => act(r.id, "resolve", true)}>Remove listing</Button>
                      <Button size="sm" variant="secondary" onClick={() => act(r.id, "resolve", false)}>Resolve</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(r.id, "dismiss", false)}>Dismiss</Button>
                    </div>)}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={reports.data.page} pages={reports.data.pages} total={reports.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}

export function AdminCategories() {
  useSeo({ title: "Categories", noindex: true });
  const cats = useCategories();
  const save = useSaveCategory();
  const del = useDeleteCategory();
  const toast = useToast();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({ id: editing?.id, name: (editing ? editing.name : name).trim() }, {
      onSuccess: () => { toast.success("Category saved"); setName(""); setEditing(null); }, onError: toast.error,
    });
  };
  return (
    <>
      <PageHeader title="Categories" description="Deleting a category keeps its jobs; they just become uncategorised." />
      <form onSubmit={submit} className="card mb-6 flex items-end gap-3 p-4">
        <Input label={editing ? "Rename category" : "New category"} className="flex-1" value={editing ? editing.name : name}
          onChange={(e) => (editing ? setEditing({ ...editing, name: e.target.value }) : setName(e.target.value))} minLength={2} required />
        <Button type="submit" loading={save.isPending}>{editing ? "Save" : "Add"}</Button>
        {editing && <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>}
      </form>
      <FormError error={save.error} />
      {cats.isPending ? <ListSkeleton rows={3} /> : cats.isError ? <ErrorState error={cats.error} /> : (
        <Table headers={["Name", "Slug", ""]} caption="Categories">
          {cats.data.map((c) => (
            <tr key={c.id}><Td className="font-medium">{c.name}</Td><Td className="text-slate-500">{c.slug}</Td>
              <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name })}>Rename</Button>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(c.id, { onSuccess: () => toast.success("Category deleted"), onError: toast.error })}>Delete</Button></Td></tr>
          ))}
        </Table>
      )}
    </>
  );
}

export function AdminAudit() {
  useSeo({ title: "Audit log", noindex: true });
  const [page, setPage] = useState(1);
  const logs = useAuditLogs(page);
  return (
    <>
      <PageHeader title="Audit log" description="Security-relevant actions across the platform." />
      {logs.isPending ? <ListSkeleton /> : logs.isError ? <ErrorState error={logs.error} /> : logs.data.items.length === 0 ? <EmptyState title="No entries" /> : (
        <>
          <Table headers={["When", "Actor", "Action", "Entity"]} caption="Audit log">
            {logs.data.items.map((l) => <tr key={l.id}><Td>{formatDateTime(l.created_at)}</Td><Td>{l.actor_email ?? "system"}</Td><Td>{humanize(l.action)}</Td><Td className="text-slate-500">{l.entity_type ?? ""}</Td></tr>)}
          </Table>
          <Pagination page={logs.data.page} pages={logs.data.pages} total={logs.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
