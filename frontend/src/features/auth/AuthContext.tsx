import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, refreshSession, setAccessToken, setSessionLostHandler, type AuthResponse } from "@/services/api";
import type { Role, User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
}
export interface RegisterData {
  email: string; password: string; full_name: string; role: Exclude<Role, "admin">; company_name?: string;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  // On first load, try to restore the session from the refresh cookie.
  useEffect(() => {
    let alive = true;
    refreshSession().then((r) => {
      if (alive) { setUser(r?.user ?? null); setLoading(false); }
    });
    setSessionLostHandler(() => { setAccessToken(null); setUser(null); qc.clear(); });
    return () => { alive = false; setSessionLostHandler(null); };
  }, [qc]);

  const accept = useCallback((r: AuthResponse) => {
    setAccessToken(r.access_token);
    setUser(r.user);
    qc.clear();
    return r.user;
  }, [qc]);

  const value = useMemo<AuthState>(() => ({
    user, loading,
    login: async (email, password) => accept(await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password } })),
    register: async (data) => accept(await api<AuthResponse>("/auth/register", { method: "POST", body: data })),
    logout: async () => {
      try { await api("/auth/logout", { method: "POST", body: {}, retry: false }); } finally {
        setAccessToken(null); setUser(null); qc.clear();
      }
    },
  }), [user, loading, accept, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

export const homeFor = (role: Role) => (role === "admin" ? "/admin" : role === "employer" ? "/employer" : "/dashboard");
