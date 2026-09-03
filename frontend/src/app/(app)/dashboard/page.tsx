"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Car, Folder, Layers, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardStats from "@/components/DashboardStats";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";

interface ModuleDef {
  key: string;
  titleKey: string;
  href: string;
  icon: React.ReactNode;
  // KPU only deals with Expedition (final sign-off + invoices) - same convention as AppShell's
  // KPU_HIDDEN_CATEGORIES, so their module list here matches what they actually see in the sidebar.
  kpuHidden?: boolean;
}

const MODULES: ModuleDef[] = [
  {
    key: "ekspedisi",
    titleKey: "nav.expedition",
    href: "/ekspedisi/overview",
    icon: <Layers width={24} height={24} />,
  },
  {
    key: "rumahtangga",
    titleKey: "nav.officeSupplies",
    href: "/office-supplies/overview",
    kpuHidden: true,
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path></svg>,
  },
  {
    key: "bookingkendaraan",
    titleKey: "nav.vehicleBooking",
    href: "/booking-kendaraan/overview",
    kpuHidden: true,
    icon: <Car width={24} height={24} />,
  },
  {
    key: "bookingruangmeeting",
    titleKey: "nav.roomBooking",
    href: "/booking-ruang-meeting/overview",
    kpuHidden: true,
    icon: <Calendar width={24} height={24} />,
  },
  {
    key: "perbaikansarana",
    titleKey: "nav.maintenance",
    href: "/maintenance/overview",
    kpuHidden: true,
    icon: <Wrench width={24} height={24} />,
  },
  {
    key: "arsip",
    titleKey: "nav.archive",
    href: "/arsip",
    kpuHidden: true,
    icon: <Folder width={24} height={24} />,
  },
];

export default function DashboardPage() {
  const { me, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") {
      router.replace("/superadmin");
    }
  }, [loading, me, router]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <WelcomeGreeting me={me} />
      </div>

      <h3 style={{ margin: "0 0 12px" }}>{t("dashboard.modules")}</h3>
      <div className="module-grid">
        {MODULES.filter((mod) => me.role !== "KPU" || !mod.kpuHidden).map((mod) => (
          <a key={mod.key} className="module-card" href={mod.href}>
            <div className="module-card-icon">{mod.icon}</div>
            <div className="module-card-body">
              <h4>{t(mod.titleKey)}</h4>
            </div>
            <span className="module-card-arrow">&rarr;</span>
          </a>
        ))}
      </div>

      <DashboardStats me={me} />
    </>
  );
}
