import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/services/api";
import type { ApplicationStatus, JobStatus } from "@/types";
import { JOB_STATUS_LABELS, STATUS_LABELS } from "@/utils/format";
import { Button } from "./Button";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> <span className="text-sm">{label}...</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card p-5">
          <Skeleton className="h-5 w-1/3" /><Skeleton className="mt-3 h-4 w-2/3" /><Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-white p-3 text-slate-400 shadow-card">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <h3 className="text-base">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <AlertTriangle className="mb-2 h-6 w-6 text-red-500" aria-hidden />
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

type Tone = "gray" | "brand" | "green" | "amber" | "red" | "blue";
const tones: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700", brand: "bg-brand-50 text-brand-700", green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800", red: "bg-red-50 text-red-700", blue: "bg-sky-50 text-sky-700",
};
export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

const statusTone: Record<ApplicationStatus, Tone> = {
  pending: "amber", reviewed: "blue", shortlisted: "brand", interview: "brand", accepted: "green", rejected: "red", withdrawn: "gray",
};
export const StatusBadge = ({ status }: { status: ApplicationStatus }) => <Badge tone={statusTone[status]}>{STATUS_LABELS[status]}</Badge>;

const jobTone: Record<JobStatus, Tone> = { draft: "gray", published: "green", closed: "amber", removed: "red" };
export const JobStatusBadge = ({ status }: { status: JobStatus }) => <Badge tone={jobTone[status]}>{JOB_STATUS_LABELS[status]}</Badge>;
