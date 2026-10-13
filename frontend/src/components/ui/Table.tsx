import type { ReactNode } from "react";

/** Responsive table: scrolls horizontally on small screens. */
export function Table({ headers, children, caption }: { headers: string[]; children: ReactNode; caption?: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{headers.map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;

export function StatCard({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      {icon && <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600">{icon}</div>}
      <div><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
    </div>
  );
}
