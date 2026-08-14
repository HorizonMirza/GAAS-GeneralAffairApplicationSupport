"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { greetingName } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

interface ModuleDef {
  key: string;
  title: string;
  href: string;
  icon: React.ReactNode;
  live?: boolean;
}

const MODULES: ModuleDef[] = [
  {
    key: "ekspedisi",
    title: "Expedition",
    href: "/ekspedisi/overview",
    live: true,
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>,
  },
  {
    key: "rumahtangga",
    title: "Office Supplies",
    href: "/rumah-tangga",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"></path></svg>,
  },
  {
    key: "bookingkendaraan",
    title: "Vehicle Booking",
    href: "/booking-kendaraan",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 17V9l2-5h10l2 5v8"></path><path d="M3 11h18"></path></svg>,
  },
  {
    key: "bookingruangmeeting",
    title: "Room Booking",
    href: "/booking-ruang-meeting",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  },
  {
    key: "perbaikansarana",
    title: "Maintenance",
    href: "/perbaikan-sarana",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"></path></svg>,
  },
  {
    key: "arsip",
    title: "Archive",
    href: "/arsip",
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"></rect><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"></path><line x1="10" y1="13" x2="14" y2="13"></line></svg>,
  },
];

export default function DashboardPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<{ total: number; totalBulanIni: number | null } | null | undefined>(undefined);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") {
      router.replace("/superadmin");
    }
  }, [loading, me, router]);

  useEffect(() => {
    api
      .listPengiriman({ page: 1, limit: 5 })
      .then((r) => setSummary({ total: r.total, totalBulanIni: r.totalBulanIni }))
      .catch(() => setSummary(null));
  }, []);

  if (!me || me.role === "SUPER_ADMIN") return null;

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <h3 className="welcome-heading">Halo, <span className="welcome-name">{greetingName(me)}</span></h3>
      </div>
      <div className="module-grid">
        {MODULES.map((mod) => {
          if (mod.live) {
            const subtitle =
              summary === undefined
                ? "Memuat..."
                : summary
                ? `${summary.total} transaksi${summary.totalBulanIni != null ? ` · ${formatCurrency(summary.totalBulanIni)} bulan ini` : ""}`
                : "Tidak dapat memuat data";
            return (
              <a key={mod.key} className="module-card" href={mod.href}>
                <div className="module-card-icon">{mod.icon}</div>
                <div className="module-card-body">
                  <h4>{mod.title}</h4>
                  <p className="text-secondary">{subtitle}</p>
                </div>
                <span className="module-card-arrow">&rarr;</span>
              </a>
            );
          }
          return (
            <a key={mod.key} className="module-card module-card-soon" href={mod.href}>
              <div className="module-card-icon">{mod.icon}</div>
              <div className="module-card-body">
                <h4>{mod.title}</h4>
                <p className="text-secondary">Segera Hadir</p>
              </div>
              <span className="module-card-arrow">&rarr;</span>
            </a>
          );
        })}
      </div>
    </>
  );
}
