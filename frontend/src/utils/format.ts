import type { ApplicationStatus, EmploymentType, ExperienceLevel, JobListItem, JobStatus, WorkplaceType } from "@/types";

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time", part_time: "Part-time", internship: "Internship", contract: "Contract", temporary: "Temporary",
};
export const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  entry: "Entry level", junior: "Junior", mid: "Mid level", senior: "Senior",
};
export const WORKPLACE_LABELS: Record<WorkplaceType, string> = { remote: "Remote", hybrid: "Hybrid", on_site: "On-site" };
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending", reviewed: "Reviewed", shortlisted: "Shortlisted", interview: "Interview",
  accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn",
};
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft", published: "Published", closed: "Closed", removed: "Removed",
};

// Timestamps arrive in UTC; display them in the viewer's local time zone.
export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "-";

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export function formatSalary(j: Pick<JobListItem, "salary_min" | "salary_max" | "salary_currency">): string | null {
  const { salary_min: min, salary_max: max, salary_currency: cur } = j;
  if (min == null && max == null) return null;
  const f = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  if (min != null && max != null) return `${f(min)} - ${f(max)}`;
  return min != null ? `From ${f(min)}` : `Up to ${f(max as number)}`;
}

export const locationLabel = (j: Pick<JobListItem, "location" | "workplace_type">) =>
  j.workplace_type === "remote" ? (j.location ? `Remote (${j.location})` : "Remote") : (j.location ?? "-");

export const humanize = (s: string) => s.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
