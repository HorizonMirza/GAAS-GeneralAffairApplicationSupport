"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n/language-context";

export default function ModulePlaceholder({ moduleNameKey }: { moduleNameKey: string }) {
  // Every other module page redirects SUPER_ADMIN to its dedicated oversight view instead of
  // the normal workflow screen - placeholder pages were missing this, so a Super Admin clicking
  // one of these still-unbuilt modules landed on the plain stub instead of /superadmin.
  const { me, loading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  return (
    <div className="card placeholder-card">
      <div className="placeholder-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 2"></path></svg>
      </div>
      <h3>{t("nav.comingSoon")}</h3>
      <p className="text-secondary">{t("common.featureInDevelopmentPrefix")} {t(moduleNameKey)} {t("common.featureInDevelopmentSuffix")}</p>
    </div>
  );
}
