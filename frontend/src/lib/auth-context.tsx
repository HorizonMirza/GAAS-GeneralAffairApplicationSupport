"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import type { Me, OrgStructure } from "./types";

interface AuthContextValue {
  me: Me | null;
  orgStructure: OrgStructure | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ me: null, orgStructure: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [orgStructure, setOrgStructure] = useState<OrgStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Memoized because pages list it in useCallback/useEffect deps (see each overview page's
  // `load`) - a new function identity on every provider render would retrigger their data fetch.
  const refresh = useCallback(async () => {
    try {
      const result = await api.me();
      setMe(result);
      api.orgStructure().then(setOrgStructure).catch(() => setOrgStructure(null));
    } catch (err) {
      // apiRequest already hard-redirects to "/" on a real 401. A network blip or server error
      // here must not also force a logout - the session cookie may still be perfectly valid.
      if (err instanceof ApiError && err.status === 401) {
        setMe(null);
        router.replace("/");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Session check on mount - genuinely synchronizing with an external system (the API/cookie),
    // not state derived from props, so the "no setState in effect" guidance doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // A fresh object literal here would be a new context value on every provider render, which
  // re-renders every useAuth() consumer in the app - which is all of them, via AppShell.
  const value = useMemo(
    () => ({ me, orgStructure, loading, refresh }),
    [me, orgStructure, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
