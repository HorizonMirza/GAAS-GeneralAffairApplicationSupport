"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  async function refresh() {
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
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthContext.Provider value={{ me, orgStructure, loading, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
