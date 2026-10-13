import { ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CompanyLogo, JobCard } from "@/components/JobCard";
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Form";
import { Pagination } from "@/components/ui/Pagination";
import { useCompanies, useCompany, useJobs } from "@/features/jobs/hooks";
import { useDebounce } from "@/hooks/useDebounce";
import { useSeo } from "@/hooks/useSeo";
import { ApiError } from "@/services/api";

export function CompaniesPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, isPending, error, refetch } = useCompanies({ q: dq || undefined, page, page_size: 12 });
  useSeo({ title: "Companies hiring now", canonicalPath: "/companies", description: "Explore companies hiring students and graduates on HireHub." });
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">Companies</h1>
      <Input label="Search companies" className="mt-6 max-w-sm" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Company name" />
      <div className="mt-6">
        {isPending ? <ListSkeleton rows={3} /> : error ? <ErrorState error={error} onRetry={() => refetch()} /> :
          data.items.length === 0 ? <EmptyState title="No companies found" /> : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((c) => (
                  <Link key={c.id} to={`/companies/${c.slug}`} className="card flex gap-4 p-5 transition-shadow hover:shadow-md">
                    <CompanyLogo company={c} size={48} />
                    <div className="min-w-0"><h2 className="truncate text-base">{c.name}</h2>
                      <p className="text-sm text-slate-500">{c.industry ?? ""}{c.industry && c.location ? " - " : ""}{c.location ?? ""}</p>
                      <p className="mt-1 text-sm font-medium text-brand-600">{c.open_jobs} open role{c.open_jobs === 1 ? "" : "s"}</p></div>
                  </Link>
                ))}
              </div>
              <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
            </>
          )}
      </div>
    </div>
  );
}

export function CompanyDetailPage() {
  const { slug } = useParams();
  const company = useCompany(slug);
  const jobs = useJobs({ company_id: company.data?.id, page_size: 20 });
  const c = company.data;
  useSeo({ title: c ? `${c.name} - jobs and company profile` : "Company", canonicalPath: slug ? `/companies/${slug}` : undefined,
    description: c ? (c.description ?? `Open roles at ${c.name}.`).slice(0, 155) : undefined });

  if (company.isPending) return <div className="container-page py-10"><Skeleton className="h-10 w-1/3" /></div>;
  if (company.error) {
    const nf = company.error instanceof ApiError && company.error.status === 404;
    return <div className="container-page py-16"><ErrorState error={nf ? new ApiError(404, "not_found", "Company not found.") : company.error} /></div>;
  }
  return (
    <div className="container-page py-10">
      <div className="card flex flex-wrap items-start gap-5 p-6">
        <CompanyLogo company={company.data} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">{company.data.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {company.data.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{company.data.location}</span>}
            {company.data.industry && <span>{company.data.industry}</span>}
            {company.data.size && <span>{company.data.size} employees</span>}
            {company.data.website && (
              <a href={company.data.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                Website <ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
            )}
          </div>
          {company.data.description && <p className="prose-plain mt-4">{company.data.description}</p>}
        </div>
      </div>
      <h2 className="mb-4 mt-10 text-xl">Open positions ({company.data.open_jobs})</h2>
      {jobs.isPending ? <ListSkeleton rows={2} /> : jobs.isError ? <ErrorState error={jobs.error} /> :
        jobs.data.items.length === 0 ? <EmptyState title="No open positions right now" /> :
          <div className="space-y-3">{jobs.data.items.map((j) => <JobCard key={j.id} job={j} />)}</div>}
    </div>
  );
}
