"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Car, Folder, Layers, PanelsLeftRight, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import DashboardStats from "@/components/DashboardStats";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";

interface ModuleDef {
  key: string;
  title: string;
  href: string;
  icon: React.ReactNode;
  // KPU only deals with Expedition (final sign-off + invoices) - same convention as AppShell's
  // KPU_HIDDEN_CATEGORIES, so their module list here matches what they actually see in the sidebar.
  kpuHidden?: boolean;
}

const MODULES: ModuleDef[] = [
  {
    key: "ekspedisi",
    title: "Expedition",
    href: "/ekspedisi/overview",
    icon: <Layers width={24} height={24} />,
  },
  {
    key: "rumahtangga",
    title: "Office Supplies",
    href: "/office-supplies/overview",
    kpuHidden: true,
    icon: <PanelsLeftRight width={24} height={24} />,
  },
  {
    key: "bookingkendaraan",
    title: "Vehicle Booking",
    href: "/booking-kendaraan/overview",
    kpuHidden: true,
    icon: <Car width={24} height={24} />,
  },
  {
    key: "bookingruangmeeting",
    title: "Room Booking",
    href: "/booking-ruang-meeting/overview",
    kpuHidden: true,
    icon: <Calendar width={24} height={24} />,
  },
  {
    key: "perbaikansarana",
    title: "Maintenance",
    href: "/maintenance/overview",
    kpuHidden: true,
    icon: <Wrench width={24} height={24} />,
  },
  {
    key: "arsip",
    title: "Archive",
    href: "/arsip",
    kpuHidden: true,
    icon: <Folder width={24} height={24} />,
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

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <WelcomeGreeting me={me} />
      </div>

      <h3 style={{ margin: "0 0 12px" }}>Modul</h3>
      <div className="module-grid">
        {MODULES.filter((mod) => me.role !== "KPU" || !mod.kpuHidden).map((mod) => (
          <a key={mod.key} className="module-card" href={mod.href}>
            <div className="module-card-icon">{mod.icon}</div>
            <div className="module-card-body">
              <h4>{mod.title}</h4>
            </div>
            <span className="module-card-arrow">&rarr;</span>
          </a>
        ))}
      </div>

      <DashboardStats me={me} />
    </>
  );
}
