import { CheckCircle2, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ApiError } from "@/services/api";

interface ToastItem { id: number; kind: "success" | "error"; message: string }
interface ToastApi { success: (m: string) => void; error: (e: unknown) => void }

const Ctx = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastItem["kind"], message: string) => {
    const id = ++counter;
    setItems((s) => [...s, { id, kind, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (e) => push("error", e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
            {t.kind === "success"
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}
