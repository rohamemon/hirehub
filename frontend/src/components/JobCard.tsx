import { Bookmark, BookmarkCheck, Building2, Clock, MapPin } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useToggleSave } from "@/features/jobs/hooks";
import { logoUrl } from "@/services/api";
import type { CompanyBrief, JobListItem } from "@/types";
import { EMPLOYMENT_LABELS, formatSalary, LEVEL_LABELS, locationLabel, timeAgo, WORKPLACE_LABELS } from "@/utils/format";
import { Badge } from "./ui/Feedback";
import { useToast } from "./ui/Toast";

export function CompanyLogo({ company, size = 44 }: { company: CompanyBrief; size?: number }) {
  const style = { width: size, height: size };
  if (company.has_logo) {
    return <img src={logoUrl(company.id)} alt={`${company.name} logo`} style={style} className="shrink-0 rounded-lg border border-slate-200 bg-white object-contain" />;
  }
  return (
    <div style={style} aria-hidden className="flex shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
      <Building2 className="h-1/2 w-1/2" />
    </div>
  );
}

export function SaveButton({ job, label = false }: { job: Pick<JobListItem, "id" | "is_saved">; label?: boolean }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const toggle = useToggleSave();

  // Only students can bookmark; others see nothing.
  if (user && user.role !== "student") return null;
  const onClick = () => {
    if (!user) return nav("/login", { state: { from: loc.pathname + loc.search } });
    toggle.mutate({ id: job.id, saved: job.is_saved }, {
      onSuccess: () => toast.success(job.is_saved ? "Removed from saved jobs" : "Job saved"),
      onError: toast.error,
    });
  };
  const Icon = job.is_saved ? BookmarkCheck : Bookmark;
  return (
    <button onClick={onClick} disabled={toggle.isPending} aria-pressed={job.is_saved}
      aria-label={job.is_saved ? "Remove from saved jobs" : "Save job"}
      className={`inline-flex items-center gap-1.5 rounded-lg p-2 text-sm hover:bg-slate-100 ${job.is_saved ? "text-brand-600" : "text-slate-500"}`}>
      <Icon className="h-5 w-5" aria-hidden />{label && (job.is_saved ? "Saved" : "Save")}
    </button>
  );
}

export function JobCard({ job }: { job: JobListItem }) {
  const salary = formatSalary(job);
  return (
    <article className="card flex gap-4 p-5 transition-shadow hover:shadow-md">
      <CompanyLogo company={job.company} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base"><Link to={`/jobs/${job.id}`} className="hover:text-brand-600 focus-visible:text-brand-600">{job.title}</Link></h3>
            <Link to={`/companies/${job.company.slug}`} className="text-sm text-slate-600 hover:underline">{job.company.name}</Link>
          </div>
          <SaveButton job={job} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{locationLabel(job)}</span>
          {job.published_at && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{timeAgo(job.published_at)}</span>}
          {salary && <span className="font-medium text-slate-700">{salary}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="brand">{EMPLOYMENT_LABELS[job.employment_type]}</Badge>
          <Badge>{WORKPLACE_LABELS[job.workplace_type]}</Badge>
          <Badge>{LEVEL_LABELS[job.experience_level]}</Badge>
          {job.category && <Badge>{job.category.name}</Badge>}
        </div>
      </div>
    </article>
  );
}
