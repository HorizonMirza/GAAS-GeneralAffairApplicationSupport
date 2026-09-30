"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The Room Booking module is fully built (Overview/Transaksi/Calendar/Laporan) - this bare
// /booking-ruang-meeting route only exists because it's the URL AppShell's nav link and browser
// bookmarks point at, so it redirects straight to Overview instead of showing a stale
// "Segera Hadir" placeholder for a module that's actually finished.
export default function BookingRuangMeetingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/booking-ruang-meeting/overview");
  }, [router]);
  return null;
}
