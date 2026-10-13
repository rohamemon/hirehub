import { zodResolver } from "@hookform/resolvers/zod";
import { Bookmark, Clock, FileText, Star, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Avatar } from "@/components/AuthedImage";
import { JobCard } from "@/components/JobCard";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, FormError, ListSkeleton, Skeleton, StatusBadge } from "@/components/ui/Feedback";
import { Input, Select, Textarea } from "@/components/ui/Form";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard, Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useApply, useDeleteCv, useMyApplications, useSavedJobs, useStudentProfile, useStudentStats, useUpdateProfile, useUploadAvatar, useUploadCv, useWithdraw } from "@/features/student/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { PageHeader } from "@/layouts/DashboardLayout";
import { useSeo } from "@/hooks/useSeo";
import { downloadFile } from "@/services/api";
import { STATUS_LABELS, formatDate } from "@/utils/format";
import type { ApplicationStatus } from "@/types";

export function StudentOverview() {
  useSeo({ title: "Dashboard", noindex: true });
  const { user } = useAuth();
  const stats = useStudentStats();
  const apps = useMyApplications({ page: 1, page_size: 5 });
  const profile = useStudentProfile();
  return (
    <>
      <PageHeader title={`Welcome, ${user?.full_name.split(" ")[0]}`} description="Here's what's happening with your job search." />
      {profile.data && !profile.data.cv_filename && (
        <div role="note" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>Upload your CV to start applying to jobs.</span><LinkButton to="/dashboard/profile" size="sm">Complete profile</LinkButton>
        </div>
      )}
      {stats.isError ? <ErrorState error={stats.error} onRetry={() => stats.refetch()} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.isPending ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />) : <>
            <StatCard label="Total applications" value={stats.data.total_applications} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Pending" value={stats.data.pending} icon={<Clock className="h-5 w-5" />} />
            <StatCard label="Shortlisted" value={stats.data.shortlisted} icon={<Star className="h-5 w-5" />} />
            <StatCard label="Saved jobs" value={stats.data.saved_jobs} icon={<Bookmark className="h-5 w-5" />} />
          </>}
        </div>
      )}
      <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="text-lg">Recent applications</h2><Link to="/dashboard/applications" className="text-sm font-medium text-brand-600 hover:underline">View all</Link></div>
      {apps.isPending ? <ListSkeleton rows={2} /> : apps.isError ? <ErrorState error={apps.error} /> : apps.data.items.length === 0 ? (
        <EmptyState title="No applications yet" description="Find a role you like and apply in a click." action={<LinkButton to="/jobs">Browse jobs</LinkButton>} />
      ) : (
        <Table headers={["Job", "Company", "Applied", "Status"]} caption="Recent applications">
          {apps.data.items.map((a) => (
            <tr key={a.id}><Td><Link className="font-medium hover:text-brand-600" to={`/jobs/${a.job.id}`}>{a.job.title}</Link></Td>
              <Td>{a.job.company.name}</Td><Td>{formatDate(a.created_at)}</Td><Td><StatusBadge status={a.status} /></Td></tr>
          ))}
        </Table>
      )}
    </>
  );
}

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+$/.test(v), "Must start with http:// or https://");
const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name"), headline: z.string().max(160), phone: z.string().max(30),
  location: z.string().max(120), bio: z.string().max(3000), education: z.string().max(3000), experience: z.string().max(3000),
  skills: z.string(), portfolio_url: optionalUrl, github_url: optionalUrl, linkedin_url: optionalUrl,
});
type ProfileForm = z.infer<typeof profileSchema>;

function CvCard() {
  const profile = useStudentProfile();
  const upload = useUploadCv();
  const remove = useDeleteCv();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const pick = (f: File | undefined) => {
    setClientError(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setClientError("Please choose a PDF file.");
    if (f.size > 4 * 1024 * 1024) return setClientError("The file is larger than 4 MB.");
    upload.mutate(f, { onSuccess: () => toast.success("CV uploaded"), onError: toast.error });
  };
  const name = profile.data?.cv_filename;
  return (
    <section className="card p-6" aria-labelledby="cv-h">
      <h2 id="cv-h" className="text-lg">Your CV</h2>
      <p className="mt-1 text-sm text-slate-500">PDF only, up to 4 MB. Employers see it only when you apply to their jobs.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {name ? (
          <>
            <button className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium hover:bg-slate-100"
              onClick={() => downloadFile("/students/me/cv", name).catch(toast.error)}><FileText className="h-4 w-4" aria-hidden />{name}</button>
            <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => input.current?.click()}><Upload className="h-4 w-4" aria-hidden />Replace</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" aria-hidden />Delete</Button>
          </>
        ) : <Button loading={upload.isPending} onClick={() => input.current?.click()}><Upload className="h-4 w-4" aria-hidden />Upload CV (PDF)</Button>}
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Choose CV file" tabIndex={-1}
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {clientError && <p role="alert" className="mt-2 text-sm text-red-600">{clientError}</p>}
      <ConfirmDialog open={confirm} danger title="Delete CV?" message="You won't be able to apply to new jobs until you upload another CV." confirmLabel="Delete" loading={remove.isPending}
        onClose={() => setConfirm(false)} onConfirm={() => remove.mutate(undefined, { onSuccess: () => { setConfirm(false); toast.success("CV deleted"); }, onError: toast.error })} />
    </section>
  );
}

export function StudentProfilePage() {
  useSeo({ title: "My profile", noindex: true });
  const { user } = useAuth();
  const profile = useStudentProfile();
  const update = useUpdateProfile();
  const avatar = useUploadAvatar();
  const toast = useToast();
  const avatarInput = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    const p = profile.data;
    if (p) reset({ full_name: p.full_name, headline: p.headline ?? "", phone: p.phone ?? "", location: p.location ?? "", bio: p.bio ?? "",
      education: p.education ?? "", experience: p.experience ?? "", skills: p.skills.join(", "),
      portfolio_url: p.portfolio_url ?? "", github_url: p.github_url ?? "", linkedin_url: p.linkedin_url ?? "" });
  }, [profile.data, reset]);

  if (profile.isPending) return <ListSkeleton rows={3} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;

  const onSubmit = handleSubmit((v) => update.mutate(
    { ...v, skills: v.skills.split(",").map((s) => s.trim()).filter(Boolean) },
    { onSuccess: () => toast.success("Profile saved"), onError: toast.error }));

  return (
    <>
      <PageHeader title="Profile & CV" description="Keep this up to date, employers see it when you apply." />
      <div className="space-y-6">
        <CvCard />
        <form onSubmit={onSubmit} noValidate className="card space-y-5 p-6">
          <div className="flex items-center gap-4">
            <Avatar userId={profile.data.user_id} enabled={profile.data.has_avatar} size={72} name={profile.data.full_name} />
            <div>
              <Button type="button" variant="secondary" size="sm" loading={avatar.isPending} onClick={() => avatarInput.current?.click()}>Change photo</Button>
              <p className="mt-1 text-xs text-slate-500">PNG or JPEG, up to 2 MB</p>
              <input ref={avatarInput} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Choose profile photo" tabIndex={-1}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) avatar.mutate(f, { onSuccess: () => toast.success("Photo updated"), onError: toast.error }); e.target.value = ""; }} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" error={errors.full_name?.message} {...register("full_name")} />
            <Input label="Email" value={user?.email ?? ""} readOnly disabled hint="Email can't be changed here." />
            <Input label="Professional headline" placeholder="e.g. Computer Science student" error={errors.headline?.message} {...register("headline")} />
            <Input label="Phone (optional)" type="tel" error={errors.phone?.message} {...register("phone")} />
            <Input label="Location" error={errors.location?.message} {...register("location")} />
            <Input label="Skills" hint="Comma separated, e.g. Python, SQL, React" {...register("skills")} />
          </div>
          <Textarea label="Biography" rows={4} error={errors.bio?.message} {...register("bio")} />
          <Textarea label="Education" rows={3} error={errors.education?.message} {...register("education")} />
          <Textarea label="Experience" rows={3} error={errors.experience?.message} {...register("experience")} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Portfolio website" placeholder="https://" error={errors.portfolio_url?.message} {...register("portfolio_url")} />
            <Input label="GitHub" placeholder="https://github.com/..." error={errors.github_url?.message} {...register("github_url")} />
            <Input label="LinkedIn" placeholder="https://linkedin.com/in/..." error={errors.linkedin_url?.message} {...register("linkedin_url")} />
          </div>
          <FormError error={update.error} />
          <div className="flex justify-end"><Button type="submit" loading={update.isPending} disabled={!isDirty}>Save changes</Button></div>
        </form>
      </div>
    </>
  );
}

const WITHDRAWABLE: ApplicationStatus[] = ["pending", "reviewed", "shortlisted", "interview"];

export function StudentApplications() {
  useSeo({ title: "My applications", noindex: true });
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const apps = useMyApplications({ status: status || undefined, page, page_size: 10 });
  const withdraw = useWithdraw();
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="My applications" description="Track every application and its status." />
      <Select label="Filter by status" className="mb-4 max-w-xs" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      {apps.isPending ? <ListSkeleton /> : apps.isError ? <ErrorState error={apps.error} onRetry={() => apps.refetch()} /> : apps.data.items.length === 0 ? (
        <EmptyState title={status ? "No applications with this status" : "You haven't applied yet"} action={<LinkButton to="/jobs">Browse jobs</LinkButton>} />
      ) : (
        <>
          <Table headers={["Job", "Company", "Applied", "Status", ""]} caption="Your applications">
            {apps.data.items.map((a) => (
              <tr key={a.id}>
                <Td><Link className="font-medium hover:text-brand-600" to={`/jobs/${a.job.id}`}>{a.job.title}</Link></Td>
                <Td>{a.job.company.name}</Td><Td>{formatDate(a.created_at)}</Td><Td><StatusBadge status={a.status} /></Td>
                <Td className="text-right">{WITHDRAWABLE.includes(a.status) && <Button variant="ghost" size="sm" onClick={() => setTarget(a.id)}>Withdraw</Button>}</Td>
              </tr>
            ))}
          </Table>
          <Pagination page={apps.data.page} pages={apps.data.pages} total={apps.data.total} onChange={setPage} />
        </>
      )}
      <ConfirmDialog open={!!target} danger title="Withdraw application?" message="The employer will no longer consider this application. This can't be undone."
        confirmLabel="Withdraw" loading={withdraw.isPending} onClose={() => setTarget(null)}
        onConfirm={() => target && withdraw.mutate(target, { onSuccess: () => { setTarget(null); toast.success("Application withdrawn"); }, onError: toast.error })} />
    </>
  );
}

export function SavedJobsPage() {
  useSeo({ title: "Saved jobs", noindex: true });
  const [page, setPage] = useState(1);
  const saved = useSavedJobs(page);
  const apply = useApply();
  const toast = useToast();
  return (
    <>
      <PageHeader title="Saved jobs" description="Jobs you've bookmarked." />
      {saved.isPending ? <ListSkeleton /> : saved.isError ? <ErrorState error={saved.error} onRetry={() => saved.refetch()} /> : saved.data.items.length === 0 ? (
        <EmptyState title="No saved jobs" description="Tap the bookmark on any job to save it for later." action={<LinkButton to="/jobs">Browse jobs</LinkButton>} />
      ) : (
        <>
          <div className="space-y-3">
            {saved.data.items.map((j) => (
              <div key={j.id}>
                <JobCard job={j} />
                {j.status === "published" && (
                  <div className="-mt-1 flex justify-end gap-2 rounded-b-xl border border-t-0 border-slate-200 bg-slate-50 px-4 py-2">
                    <Button size="sm" loading={apply.isPending && apply.variables?.jobId === j.id}
                      onClick={() => apply.mutate({ jobId: j.id }, { onSuccess: () => toast.success(`Applied to ${j.title}`), onError: toast.error })}>Quick apply</Button>
                    <LinkButton size="sm" variant="secondary" to={`/jobs/${j.id}`}>View &amp; add cover letter</LinkButton>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination page={saved.data.page} pages={saved.data.pages} total={saved.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}

