import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/components/ui/Toast";
import type { Role, User } from "@/types";

export const makeUser = (role: Role = "student"): User => ({
  id: "u1", email: `${role}@example.com`, full_name: `Test ${role}`, role, is_active: true,
  email_verified: true, created_at: "2025-01-01T00:00:00Z", company_id: null,
});

/** Shared mutable auth state that the mocked useAuth() reads. */
export const authState: { user: User | null; loading: boolean; login: ReturnType<typeof vi.fn>; register: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> } = {
  user: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn(),
};

export function renderApp(ui: ReactElement, route = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></ToastProvider>
    </QueryClientProvider>,
  );
}

type Handler = (url: URL, init?: RequestInit) => unknown | Response;

/** Stubs fetch with path-based handlers; unknown paths return 404. Returns the call log. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { method: string; url: URL; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = `${method} ${url.pathname.replace("/api/v1", "")}`;
    const h = routes[key];
    if (!h) return new Response(JSON.stringify({ error: { code: "not_found", message: "Not found" } }), { status: 404 });
    const out = h(url, init);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
  return calls;
}

export const jobItem = (over: Record<string, unknown> = {}) => ({
  id: "j1", title: "Backend Intern", employment_type: "internship", experience_level: "entry", workplace_type: "hybrid",
  location: "Berlin", salary_min: 1000, salary_max: 2000, salary_currency: "EUR", deadline: null, status: "published",
  published_at: new Date().toISOString(), created_at: new Date().toISOString(), skills: ["Python"], is_saved: false,
  application_count: null, category: null, company: { id: "c1", name: "Acme", slug: "acme", location: "Berlin", has_logo: false }, ...over,
});

export const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, page_size: 10, pages: 1 });
