/**
 * API client. The short-lived access token lives only in memory (never localStorage);
 * the refresh token is an HttpOnly cookie the browser sends to /auth/* automatically.
 */
import type { User } from "@/types";

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const setSessionLostHandler = (fn: (() => void) | null) => { onSessionLost = fn; };

export interface AuthResponse { access_token: string; user: User }

let refreshing: Promise<AuthResponse | null> | null = null;

/** Exchange the refresh cookie for a new access token (single-flight). */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST", credentials: "include", headers: { "X-Requested-With": "HireHub" },
      });
      if (!res.ok) { accessToken = null; return null; }
      const data = (await res.json()) as AuthResponse;
      accessToken = data.access_token;
      return data;
    } catch {
      return null;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

type Options = {
  method?: string; body?: unknown; form?: FormData; params?: Record<string, unknown>; retry?: boolean;
};

function qs(params?: Record<string, unknown>) {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function raw(path: string, o: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  if (path.startsWith("/auth/")) headers["X-Requested-With"] = "HireHub";
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs(o.params)}`, {
      method: o.method ?? "GET", headers, credentials: "include",
      body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server. Check your connection and try again.");
  }
  const isCredentialCall = path.startsWith("/auth/login") || path.startsWith("/auth/register");
  if (res.status === 401 && o.retry !== false && !isCredentialCall) {
    const refreshed = await refreshSession();
    if (refreshed) return raw(path, { ...o, retry: false });
    onSessionLost?.();
  }
  return res;
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const j = await res.json();
    const e = j.error ?? {};
    return new ApiError(res.status, e.code ?? "error", e.message ?? res.statusText, e.details ?? undefined);
  } catch {
    return new ApiError(res.status, "error", res.statusText || "Request failed");
  }
}

export async function api<T>(path: string, o: Options = {}): Promise<T> {
  const res = await raw(path, o);
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Fetch a protected binary (e.g. CV, avatar) with auth, returning a Blob. */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await raw(path, {});
  if (!res.ok) throw await toError(res);
  return res.blob();
}

export async function downloadFile(path: string, filename: string) {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const get = <T>(path: string, params?: Record<string, unknown>) => api<T>(path, { params });
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const put = <T>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
export const upload = <T>(path: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api<T>(path, { method: "POST", form });
};

export const logoUrl = (companyId: string) => `${BASE}/companies/${companyId}/logo`;
