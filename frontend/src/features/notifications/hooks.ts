import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/services/api";
import type { AppNotification, Page } from "@/types";

export const useUnreadCount = (enabled: boolean) =>
  useQuery({ queryKey: ["notifications", "count"], queryFn: () => get<{ count: number }>("/notifications/unread-count"), enabled, refetchInterval: 60_000 });

export const useNotifications = (page = 1) =>
  useQuery({ queryKey: ["notifications", "list", page], queryFn: () => get<Page<AppNotification>>("/notifications", { page, page_size: 20 }) });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | "all") => (id === "all" ? post("/notifications/read-all") : post(`/notifications/${id}/read`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
