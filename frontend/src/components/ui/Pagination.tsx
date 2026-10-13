import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (pages <= 1) return <p className="mt-4 text-sm text-slate-500">{total} result{total === 1 ? "" : "s"}</p>;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      <p className="text-sm text-slate-500">Page {page} of {pages} - {total} results</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
