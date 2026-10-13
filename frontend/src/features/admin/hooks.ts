import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post, put } from "@/services/api";
import type { AdminStats, AuditEntry, Category, JobListItem, Page, Report, User } from "@/types";

export const useAdminStats = () => useQuery({ queryKey: ["admin", "stats"], queryFn: () => get<AdminStats>("/admin/stats") });

export const useAdminUsers = (params: { q?: string; role?: string; is_active?: string; page?: number }) =>
  useQuery({ queryKey: ["admin", "users", params], queryFn: () => get<Page<User>>("/admin/users", params), placeholderData: keepPreviousData });

export const useAdminJobs = (params: { q?: string; status?: string; page?: number }) =>
  useQuery({ queryKey: ["admin", "jobs", params], queryFn: () => get<Page<JobListItem>>("/admin/jobs", params), placeholderData: keepPreviousData });

export const useReports = (status: string, page = 1) =>
  useQuery({ queryKey: ["admin", "reports", status, page], queryFn: () => get<Page<Report>>("/admin/reports", { status, page }) });

export const useAuditLogs = (page = 1) =>
  useQuery({ queryKey: ["admin", "audit", page], queryFn: () => get<Page<AuditEntry>>("/admin/audit-logs", { page }), placeholderData: keepPreviousData });

function useAdminMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["jobs"] }); } });
}

export const useSetUserActive = () => useAdminMutation((v: { id: string; is_active: boolean }) => patch(`/admin/users/${v.id}`, { is_active: v.is_active }));
export const useModerateJob = () => useAdminMutation((v: { id: string; action: "remove" | "restore" }) => post(`/admin/jobs/${v.id}/moderate`, { action: v.action }));
export const useResolveReport = () => useAdminMutation((v: { id: string; action: "resolve" | "dismiss"; remove_job: boolean }) => post(`/admin/reports/${v.id}/resolve`, v));
export const useSaveCategory = () => useAdminMutation((v: { id?: string; name: string }) => (v.id ? put<Category>(`/admin/categories/${v.id}`, { name: v.name }) : post<Category>("/admin/categories", { name: v.name })));
export const useDeleteCategory = () => useAdminMutation((id: string) => del(`/admin/categories/${id}`));
