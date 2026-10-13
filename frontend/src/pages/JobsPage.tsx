import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/Feedback";
import { Input, Select } from "@/components/ui/Form";
import { Pagination } from "@/components/ui/Pagination";
import { useCategories, useJobFacets, useJobs, type JobSearch } from "@/features/jobs/hooks";
import { useDebounce } from "@/hooks/useDebounce";
import { useSeo } from "@/hooks/useSeo";

const KEYS = ["q", "location", "employment_type", "category_id", "experience_level", "workplace_type", "salary_min", "sort"] as const;

/** Filters live in the URL, so searches are shareable and survive refresh/back. */
export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const page = Number(params.get("page") ?? 1) || 1;

  const [q, setQ] = useState(get("q"));
  const [loc, setLoc] = useState(get("location"));
  const dq = useDebounce(q);
  const dloc = useDebounce(loc);
  const [showFilters, setShowFilters] = useState(false);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  };

  // Push debounced text inputs into the URL.
  useEffect(() => {
    if (dq !== get("q") || dloc !== get("location")) update({ q: dq, location: dloc });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, dloc]);

  const search: JobSearch = { page, page_size: 10 };
  for (const k of KEYS) if (params.get(k)) (search as Record<string, unknown>)[k] = params.get(k);

  const jobs = useJobs(search);
  const cats = useCategories();
  const facets = useJobFacets();
  const hasFilters = KEYS.some((k) => params.get(k));
  useSeo({ title: "Browse jobs and internships", canonicalPath: "/jobs", description: "Search jobs and internships by keyword, location, type, category and salary." });

  const clear = () => { setQ(""); setLoc(""); setParams({}, { replace: true }); };

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">Find your next role</h1>
      <p className="mt-1 text-slate-600">{jobs.data ? `${jobs.data.total} open position${jobs.data.total === 1 ? "" : "s"}` : "Searching..."}</p>

      <div role="search" className="card mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-slate-400" aria-hidden />
          <Input label="Job title or keyword" className="[&_input]:pl-9" placeholder="Select or type a job title" suggestions={facets.data?.titles} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input label="City or country" placeholder="Select or type a location" suggestions={facets.data?.locations} value={loc} onChange={(e) => setLoc(e.target.value)} />
        <Button variant="secondary" className="self-end sm:hidden" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />Filters
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside aria-label="Filters" className={`card h-fit space-y-4 p-4 ${showFilters ? "block" : "hidden"} sm:block`}>
          <Select label="Job type" value={get("employment_type")} onChange={(e) => update({ employment_type: e.target.value })}>
            <option value="">Any</option><option value="full_time">Full-time</option><option value="part_time">Part-time</option>
            <option value="internship">Internship</option><option value="contract">Contract</option><option value="temporary">Temporary</option>
          </Select>
          <Select label="Category" value={get("category_id")} onChange={(e) => update({ category_id: e.target.value })}>
            <option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Experience level" value={get("experience_level")} onChange={(e) => update({ experience_level: e.target.value })}>
            <option value="">Any</option><option value="entry">Entry level</option><option value="junior">Junior</option>
            <option value="mid">Mid level</option><option value="senior">Senior</option>
          </Select>
          <Select label="Workplace" value={get("workplace_type")} onChange={(e) => update({ workplace_type: e.target.value })}>
            <option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="on_site">On-site</option>
          </Select>
          <Input label="Minimum salary" type="number" min={0} step={1000} placeholder="e.g. 30000" value={get("salary_min")}
            onChange={(e) => update({ salary_min: e.target.value })} />
          <Select label="Sort by" value={get("sort") || "newest"} onChange={(e) => update({ sort: e.target.value === "newest" ? "" : e.target.value })}>
            <option value="newest">Newest first</option><option value="salary">Highest salary</option><option value="deadline">Deadline soonest</option>
          </Select>
          {hasFilters && <Button variant="ghost" size="sm" className="w-full" onClick={clear}><X className="h-4 w-4" aria-hidden />Clear all</Button>}
        </aside>

        <section aria-live="polite" aria-label="Results">
          {jobs.isPending ? <ListSkeleton /> : jobs.isError ? <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} /> :
            jobs.data.items.length === 0 ? (
              <EmptyState title="No jobs match your search" description="Try removing a filter or using different keywords."
                action={hasFilters ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />
            ) : (
              <>
                <div className={`space-y-3 transition-opacity ${jobs.isPlaceholderData ? "opacity-60" : ""}`}>
                  {jobs.data.items.map((j) => <JobCard key={j.id} job={j} />)}
                </div>
                <Pagination page={jobs.data.page} pages={jobs.data.pages} total={jobs.data.total}
                  onChange={(p) => { update({ page: String(p) }); window.scrollTo({ top: 0 }); }} />
              </>
            )}
        </section>
      </div>
    </div>
  );
}
