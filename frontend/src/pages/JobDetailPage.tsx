import { Banknote, Briefcase, CalendarClock, Flag, MapPin, Signal } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CompanyLogo, JobCard, SaveButton } from "@/components/JobCard";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge, ErrorState, FormError, Skeleton } from "@/components/ui/Feedback";
import { Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { useJob, useRelatedJobs, useReportJob } from "@/features/jobs/hooks";
import { useApply, useStudentProfile } from "@/features/student/hooks";
import { useSeo } from "@/hooks/useSeo";
import { ApiError } from "@/services/api";
import type { Job } from "@/types";
import { EMPLOYMENT_LABELS, formatDate, formatSalary, LEVEL_LABELS, locationLabel, WORKPLACE_LABELS } from "@/utils/format";

function ApplyModal({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const profile = useStudentProfile();
  const apply = useApply();
  const toast = useToast();
  const [letter, setLetter] = useState("");
  const hasCv = !!profile.data?.cv_filename;

  const submit = () => apply.mutate({ jobId: job.id, cover_letter: letter }, {
    onSuccess: () => { toast.success("Application submitted"); onClose(); },
  });
  return (
    <Modal open={open} onClose={onClose} title={`Apply to ${job.title}`}>
      <div className="space-y-4">
        {profile.isPending ? <Skeleton className="h-10 w-full" /> : hasCv ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm">Your profile and CV <strong>{profile.data?.cv_filename}</strong> will be sent to {job.company.name}.</p>
        ) : (
          <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            You need to upload a CV before applying. <Link className="font-medium underline" to="/dashboard/profile">Go to your profile</Link>
          </p>
        )}
        <Textarea label="Cover letter (optional)" rows={6} maxLength={5000} value={letter} onChange={(e) => setLetter(e.target.value)}
          hint="Tell the employer why you're a great fit." />
        <FormError error={apply.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={apply.isPending} disabled={!hasCv}>Submit application</Button>
        </div>
      </div>
    </Modal>
  );
}

function ReportModal({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const report = useReportJob();
  const toast = useToast();
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Report this listing">
      <div className="space-y-4">
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="spam">Spam</option><option value="scam">Scam or fraud</option><option value="discriminatory">Discriminatory</option>
          <option value="misleading">Misleading</option><option value="other">Other</option>
        </Select>
        <Textarea label="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
        <FormError error={report.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={report.isPending} onClick={() => report.mutate({ id: job.id, reason, details }, {
            onSuccess: () => { toast.success("Thanks, we'll review this listing."); onClose(); },
          })}>Send report</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function JobDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { data: job, isPending, error, refetch } = useJob(id);
  const related = useRelatedJobs(id);
  const [applyOpen, setApplyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const jsonLd = useMemo(() => job && {
    "@context": "https://schema.org", "@type": "JobPosting", title: job.title, description: job.description,
    datePosted: job.published_at, validThrough: job.deadline ?? undefined,
    employmentType: job.employment_type.toUpperCase(),
    hiringOrganization: { "@type": "Organization", name: job.company.name },
    jobLocation: job.location ? { "@type": "Place", address: job.location } : undefined,
    jobLocationType: job.workplace_type === "remote" ? "TELECOMMUTE" : undefined,
  }, [job]);

  useSeo({
    title: job ? `${job.title} at ${job.company.name}` : "Job details",
    description: job ? `${job.title} at ${job.company.name}, ${locationLabel(job)}. ${job.description.slice(0, 120)}` : undefined,
    canonicalPath: id ? `/jobs/${id}` : undefined, jsonLd: jsonLd ?? undefined,
  });

  if (isPending) return <div className="container-page py-10"><Skeleton className="h-8 w-1/2" /><Skeleton className="mt-4 h-40 w-full" /></div>;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return <div className="container-page py-16"><ErrorState error={notFound ? new ApiError(404, "not_found", "This job doesn't exist or is no longer available.") : error} onRetry={notFound ? undefined : () => refetch()} /></div>;
  }

  const salary = formatSalary(job);
  const lines = (s: string | null) => s?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];

  const applyArea = () => {
    if (!job.is_open) return <p className="rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-600">This position is no longer accepting applications.</p>;
    if (!user) return <LinkButton to="/login" state={{ from: location.pathname }} className="w-full">Log in to apply</LinkButton>;
    if (user.role !== "student") return <p className="text-sm text-slate-500">Only student accounts can apply.</p>;
    if (job.has_applied) return <Badge tone="green">You've applied to this job</Badge>;
    return <Button className="w-full" size="lg" onClick={() => setApplyOpen(true)}>Apply now</Button>;
  };

  return (
    <div className="container-page py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="flex items-start gap-4">
            <CompanyLogo company={job.company} size={60} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl">{job.title}</h1>
              <Link to={`/companies/${job.company.slug}`} className="text-slate-600 hover:underline">{job.company.name}</Link>
            </div>
            <SaveButton job={job} label />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="brand">{EMPLOYMENT_LABELS[job.employment_type]}</Badge>
            <Badge>{WORKPLACE_LABELS[job.workplace_type]}</Badge>
            <Badge>{LEVEL_LABELS[job.experience_level]}</Badge>
            {job.category && <Badge>{job.category.name}</Badge>}
            {job.status === "closed" && <Badge tone="amber">Closed</Badge>}
          </div>

          <section className="mt-8"><h2 className="text-lg">About the role</h2><p className="prose-plain mt-2">{job.description}</p></section>
          {lines(job.responsibilities).length > 0 && (
            <section className="mt-8"><h2 className="text-lg">Responsibilities</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{lines(job.responsibilities).map((l, i) => <li key={i}>{l.replace(/^[-*]\s*/, "")}</li>)}</ul></section>
          )}
          {lines(job.requirements).length > 0 && (
            <section className="mt-8"><h2 className="text-lg">Requirements</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{lines(job.requirements).map((l, i) => <li key={i}>{l.replace(/^[-*]\s*/, "")}</li>)}</ul></section>
          )}
          {job.skills.length > 0 && (
            <section className="mt-8"><h2 className="text-lg">Required skills</h2>
              <div className="mt-2 flex flex-wrap gap-2">{job.skills.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div></section>
          )}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card space-y-4 p-5">
            {applyArea()}
            <dl className="space-y-3 text-sm">
              <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden /><div><dt className="sr-only">Location</dt><dd>{locationLabel(job)}</dd></div></div>
              <div className="flex gap-3"><Briefcase className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden /><div><dt className="sr-only">Type</dt><dd>{EMPLOYMENT_LABELS[job.employment_type]}</dd></div></div>
              <div className="flex gap-3"><Signal className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden /><div><dt className="sr-only">Level</dt><dd>{LEVEL_LABELS[job.experience_level]}</dd></div></div>
              {salary && <div className="flex gap-3"><Banknote className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden /><div><dt className="sr-only">Salary</dt><dd>{salary} / year</dd></div></div>}
              <div className="flex gap-3"><CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden />
                <div><dt className="sr-only">Deadline</dt><dd>{job.deadline ? `Apply by ${formatDate(job.deadline)}` : "No deadline"}</dd></div></div>
            </dl>
          </div>
          <div className="card p-5 text-sm">
            <h2 className="text-base">About {job.company.name}</h2>
            <p className="mt-1 text-slate-600">{job.company.location ?? ""}</p>
            <Link to={`/companies/${job.company.slug}`} className="mt-2 inline-block font-medium text-brand-600 hover:underline">View company profile</Link>
          </div>
          {user && user.role !== "admin" && (
            <button onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600">
              <Flag className="h-3.5 w-3.5" aria-hidden />Report this listing
            </button>
          )}
        </aside>
      </div>

      {related.data && related.data.length > 0 && (
        <section className="mt-14" aria-labelledby="related"><h2 id="related" className="mb-4 text-xl">Related jobs</h2>
          <div className="grid gap-4 lg:grid-cols-2">{related.data.map((j) => <JobCard key={j.id} job={j} />)}</div></section>
      )}
      {applyOpen && <ApplyModal job={job} open onClose={() => setApplyOpen(false)} />}
      {reportOpen && <ReportModal job={job} open onClose={() => setReportOpen(false)} />}
    </div>
  );
}
