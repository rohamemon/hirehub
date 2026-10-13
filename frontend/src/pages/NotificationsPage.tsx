import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";
import { useMarkRead, useNotifications } from "@/features/notifications/hooks";
import { useSeo } from "@/hooks/useSeo";
import { PageHeader } from "@/layouts/DashboardLayout";
import { formatDateTime } from "@/utils/format";

export default function NotificationsPage() {
  useSeo({ title: "Notifications", noindex: true });
  const [page, setPage] = useState(1);
  const list = useNotifications(page);
  const mark = useMarkRead();
  return (
    <>
      <PageHeader title="Notifications" action={<Button variant="secondary" size="sm" onClick={() => mark.mutate("all")}>Mark all as read</Button>} />
      {list.isPending ? <ListSkeleton /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.items.length === 0 ? (
        <EmptyState title="You're all caught up" description="New notifications will show up here." />
      ) : (
        <>
          <ul className="space-y-2">
            {list.data.items.map((n) => (
              <li key={n.id} className={`card flex items-start justify-between gap-3 p-4 ${n.is_read ? "" : "border-brand-200 bg-brand-50/40"}`}>
                <div>
                  <p className="text-sm font-medium">{n.link ? <Link to={n.link} onClick={() => !n.is_read && mark.mutate(n.id)} className="hover:text-brand-600">{n.title}</Link> : n.title}</p>
                  {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.is_read && <Button size="sm" variant="ghost" onClick={() => mark.mutate(n.id)}>Mark read</Button>}
              </li>
            ))}
          </ul>
          <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
