"use client";

import { useAuth } from "@/lib/auth-context";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import DashboardContent from "@/components/DashboardContent";

export default function DashboardPage() {
  const { me } = useAuth();

  // Super Admin sudah punya halaman /superadmin khusus, tapi tetap bisa akses
  // dashboard untuk melihat statistik keseluruhan — tidak di-redirect lagi.
  if (!me) return null;

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 22 }}>
        <WelcomeGreeting me={me} />
      </div>

      <DashboardContent me={me} />
    </>
  );
}
