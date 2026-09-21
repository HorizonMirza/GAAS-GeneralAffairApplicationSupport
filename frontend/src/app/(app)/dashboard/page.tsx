"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Calendar, Car, Folder, Layers, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import DashboardStats from "@/components/DashboardStats";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";

interface ModuleDef {
  key: string;
  title: string;
  href: string;
  icon: React.ReactNode;
  // KPU only deals with Expedition (final sign-off + invoices) and Office Supplies (as procurement channel).
  // Other categories are hidden for KPU.
  kpuHidden?: boolean;
}

const MODULES: ModuleDef[] = [
  {
    key: "ekspedisi",
    title: "Ekspedisi",
    href: "/ekspedisi/overview",
    icon: <Layers width={20} height={20} />,
  },
  {
    key: "bookingruangmeeting",
    title: "Booking Ruang Meeting",
    href: "/booking-ruang-meeting/overview",
    kpuHidden: true,
    icon: <Calendar width={20} height={20} />,
  },
  {
    key: "bookingkendaraan",
    title: "Booking Kendaraan",
    href: "/booking-kendaraan/overview",
    kpuHidden: true,
    icon: <Car width={20} height={20} />,
  },
  {
    key: "rumahtangga",
    title: "Office Supplies",
    href: "/office-supplies/overview",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      </svg>
    ),
  },
  {
    key: "perbaikansarana",
    title: "Maintenance",
    href: "/maintenance/overview",
    kpuHidden: true,
    icon: <Wrench width={20} height={20} />,
  },
  {
    key: "arsip",
    title: "Arsip",
    href: "/arsip/overview",
    kpuHidden: true,
    icon: <Folder width={20} height={20} />,
  },
];

export default function DashboardPage() {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") {
      router.replace("/superadmin");
    }
  }, [loading, me, router]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  const visibleModules = MODULES.filter((mod) => me.role !== "KPU" || !mod.kpuHidden);

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 20 }}>
        <WelcomeGreeting me={me} />
      </div>

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>Menu Modul</h3>
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          {visibleModules.length} Modul Tersedia
        </span>
      </div>

      <div className="dashboard-module-grid">
        {visibleModules.map((mod) => (
          <Link key={mod.key} className="dashboard-module-btn" href={mod.href}>
            <div className="dashboard-module-btn-icon">{mod.icon}</div>
            <span className="dashboard-module-btn-title">{mod.title}</span>
            <ArrowRight className="dashboard-module-btn-arrow" width={16} height={16} />
          </Link>
        ))}
      </div>

      <DashboardStats me={me} />
    </>
  );
}
