"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The Vehicle Booking module is fully built (Overview/Transaksi/Calendar) - this bare
// /booking-kendaraan route only exists because it's the URL AppShell's nav link and browser
// bookmarks point at, so it redirects straight to Overview instead of showing a stale
// "Segera Hadir" placeholder for a module that's actually finished.
export default function BookingKendaraanPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/booking-kendaraan/overview");
  }, [router]);
  return null;
}
