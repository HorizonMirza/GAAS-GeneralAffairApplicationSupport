"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ModulePlaceholder({ moduleName }: { moduleName: string }) {
  // Every other module page redirects SUPER_ADMIN to its dedicated oversight view instead of
  // the normal workflow screen - placeholder pages were missing this, so a Super Admin clicking
  // one of these still-unbuilt modules landed on the plain stub instead of /superadmin.
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  return (
    <div className="card placeholder-card">
      <div className="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 2"></path></svg>
      </div>
      <h3>Segera Hadir</h3>
      <p className="text-secondary">Fitur {moduleName} sedang dalam pengembangan.</p>
    </div>
  );
}
