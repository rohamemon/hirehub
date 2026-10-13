import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, del, get, patch, post, put, upload } from "@/services/api";
import type { Applicant, ApplicationStatus, Company, EmployerStats, Job, JobInput, JobListItem, Page } from "@/types";

export const useEmployerStats = () => useQuery({ queryKey: ["employer-stats"], queryFn: () => get<EmployerStats>("/employer/stats") });

export const useMyCompany = () =>
  useQuery({
    queryKey: ["my-company"], queryFn: () => get<Company | null>("/employer/company").catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null; // no company yet is a normal state
      throw e;
    }),
  });

export function useSaveCompany(exists: boolean) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => (exists ? put<Company>("/employer/company", data) : post<Company>("/employer/company", data)),
    onSuccess: (d) => { qc.setQueryData(["my-company"], d); qc.invalidateQueries({ queryKey: ["company"] }); },
  });
}
export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: File) => upload<Company>("/employer/company/logo", f), onSuccess: (d) => qc.setQueryData(["my-company"], d) });
}

export const useEmployerJobs = (params: { status?: string; q?: string; page?: number }) =>
  useQuery({ queryKey: ["employer-jobs", params], queryFn: () => get<Page<JobListItem>>("/employer/jobs", params), placeholderData: keepPreviousData });

export const useEmployerJob = (id: string | undefined) =>
  useQuery({ queryKey: ["employer-job", id], queryFn: () => get<Job>(`/employer/jobs/${id}`), enabled: !!id });

const invalidateJobs = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ["employer-jobs", "employer-job", "employer-stats", "jobs", "job"]) qc.invalidateQueries({ queryKey: [k] });
};

export function useSaveJob(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: JobInput) => (id ? put<Job>(`/employer/jobs/${id}`, data) : post<Job>("/employer/jobs", data)),
    onSuccess: () => invalidateJobs(qc),
  });
}
export function useJobAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "close" | "delete" }) =>
      action === "delete" ? del(`/employer/jobs/${id}`) : post<Job>(`/employer/jobs/${id}/${action}`),
    onSuccess: () => invalidateJobs(qc),
  });
}

export const useApplicants = (params: { status?: string; q?: string; job_id?: string; page?: number }) =>
  useQuery({ queryKey: ["applicants", params], queryFn: () => get<Page<Applicant>>("/employer/applications", params), placeholderData: keepPreviousData });

export function useChangeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: ApplicationStatus }) => patch<Applicant>(`/applications/${v.id}/status`, { status: v.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants"] }); qc.invalidateQueries({ queryKey: ["employer-stats"] }); },
  });
}
