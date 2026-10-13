import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put, upload } from "@/services/api";
import type { Application, JobListItem, Page, StudentProfile, StudentStats } from "@/types";

export const useStudentProfile = () => useQuery({ queryKey: ["student-profile"], queryFn: () => get<StudentProfile>("/students/me") });
export const useStudentStats = () => useQuery({ queryKey: ["student-stats"], queryFn: () => get<StudentStats>("/students/me/stats") });

export const useMyApplications = (params: { status?: string; page?: number; page_size?: number }) =>
  useQuery({ queryKey: ["my-applications", params], queryFn: () => get<Page<Application>>("/applications/me", params), placeholderData: keepPreviousData });

export const useSavedJobs = (page = 1) =>
  useQuery({ queryKey: ["saved-jobs", page], queryFn: () => get<Page<JobListItem>>("/saved-jobs", { page, page_size: 12 }), placeholderData: keepPreviousData });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => put<StudentProfile>("/students/me", data),
    onSuccess: (d) => qc.setQueryData(["student-profile"], d),
  });
}

export function useUploadCv() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: File) => upload<StudentProfile>("/students/me/cv", f), onSuccess: (d) => qc.setQueryData(["student-profile"], d) });
}
export function useDeleteCv() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => del("/students/me/cv"), onSuccess: () => qc.invalidateQueries({ queryKey: ["student-profile"] }) });
}
export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (f: File) => upload<StudentProfile>("/students/me/avatar", f), onSuccess: (d) => qc.setQueryData(["student-profile"], d) });
}

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { jobId: string; cover_letter?: string }) => post<Application>(`/jobs/${v.jobId}/apply`, { cover_letter: v.cover_letter || null }),
    onSuccess: () => {
      for (const k of ["job", "jobs", "my-applications", "student-stats", "notifications"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<Application>(`/applications/${id}/withdraw`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-applications"] });
      qc.invalidateQueries({ queryKey: ["student-stats"] });
    },
  });
}
