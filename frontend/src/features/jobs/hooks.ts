import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "@/services/api";
import type { Category, Company, Job, JobListItem, Page } from "@/types";

export interface JobSearch {
  q?: string; location?: string; employment_type?: string; experience_level?: string; workplace_type?: string;
  category_id?: string; company_id?: string; salary_min?: string; salary_max?: string; sort?: string;
  page?: number; page_size?: number;
}

export const useJobs = (params: JobSearch) =>
  useQuery({ queryKey: ["jobs", params], queryFn: () => get<Page<JobListItem>>("/jobs", params as Record<string, unknown>), placeholderData: keepPreviousData });

export const useJob = (id: string | undefined) =>
  useQuery({ queryKey: ["job", id], queryFn: () => get<Job>(`/jobs/${id}`), enabled: !!id });

export const useRelatedJobs = (id: string | undefined) =>
  useQuery({ queryKey: ["job", id, "related"], queryFn: () => get<JobListItem[]>(`/jobs/${id}/related`), enabled: !!id });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => get<Category[]>("/categories"), staleTime: 5 * 60_000 });

export const useCompanies = (params: { q?: string; page?: number; page_size?: number }) =>
  useQuery({ queryKey: ["companies", params], queryFn: () => get<Page<Company>>("/companies", params), placeholderData: keepPreviousData });

export const useCompany = (slug: string | undefined) =>
  useQuery({ queryKey: ["company", slug], queryFn: () => get<Company>(`/companies/${slug}`), enabled: !!slug });

/** Save / unsave a job, then refresh everything that shows the bookmark state. */
export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => (saved ? del(`/saved-jobs/${id}`) : put(`/saved-jobs/${id}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["student-stats"] });
    },
  });
}

export const useReportJob = () =>
  useMutation({ mutationFn: (v: { id: string; reason: string; details?: string }) => post(`/jobs/${v.id}/report`, { reason: v.reason, details: v.details }) });

export const useJobFacets = () =>
  useQuery({ queryKey: ["job-facets"], queryFn: () => get<{ titles: string[]; locations: string[] }>("/jobs/facets"), staleTime: 5 * 60_000 });
