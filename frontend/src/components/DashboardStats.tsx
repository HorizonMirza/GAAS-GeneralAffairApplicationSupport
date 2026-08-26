"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { currentYearMonth, formatCurrency } from "@/lib/format";
import type { BookingRuangStatsResponse, Me, PengirimanStatsResponse } from "@/lib/types";

interface PengirimanStatsView {
  waitingL1: number;
  waitingGa: number;
  waitingGaApproval: number;
  waitingKpu: number;
  completed: number;
  totalBulanIni: number | null;
}

interface BookingStatsView {
  waitingL1: number;
  waitingGa: number;
  waitingGaApproval: number;
  completed: number;
  rejected: number;
}

interface Props {
  me: Me;
  // Callers that also need the raw stats (e.g. the dashboard module cards' subtitles) can read
  // them here instead of firing their own separate list-endpoint calls for the same totals.
  onPengirimanStats?: (data: PengirimanStatsResponse | null) => void;
  onBookingStats?: (data: BookingRuangStatsResponse | null) => void;
}

export default function DashboardStats({ me, onPengirimanStats, onBookingStats }: Props) {
  const [pengiriman, setPengiriman] = useState<PengirimanStatsView | null>(null);
  const [booking, setBooking] = useState<BookingStatsView | null>(null);
  const [pengirimanFailed, setPengirimanFailed] = useState(false);
  const [bookingFailed, setBookingFailed] = useState(false);

  // Fetched (and failure-handled) independently - an outage in one source must not blank out
  // the other's numbers too, which a shared Promise.all/catch would do.
  useEffect(() => {
    const bulan = currentYearMonth();
    api.getPengirimanStats(bulan)
      .then((p) => {
        onPengirimanStats?.(p);
        const pc = p.countsByStatus;
        setPengiriman({
          // Read directly from the backend's own actionability computation (GetStats) instead of
          // re-deriving "which statuses count for this stage" here - see PengirimanController.
          waitingL1: p.waitingL1,
          waitingGa: p.waitingGa,
          waitingGaApproval: p.waitingGaApproval,
          waitingKpu: p.waitingKpu,
          completed: pc.COMPLETED ?? 0,
          totalBulanIni: p.totalBulanIni,
        });
      })
      .catch(() => {
        setPengirimanFailed(true);
        onPengirimanStats?.(null);
      });
    // KPU only deals with Expedition (see AppShell's KPU_HIDDEN_CATEGORIES) - it never sees the
    // Room Booking section below, so skip the fetch entirely instead of loading numbers nobody
    // will see.
    if (me.role === "KPU") return;
    api.getBookingStats(bulan)
      .then((b) => {
        onBookingStats?.(b);
        const bc = b.countsByStatus;
        setBooking({
          waitingL1: bc.SUBMITTED ?? 0,
          waitingGa: bc.APPROVED_L1 ?? 0,
          waitingGaApproval: bc.APPROVED_GA ?? 0,
          completed: bc.APPROVED_GA_APPROVAL ?? 0,
          rejected: (bc.REJECTED_L1 ?? 0) + (bc.REJECTED_GA ?? 0) + (bc.REJECTED_GA_APPROVAL ?? 0),
        });
      })
      .catch(() => {
        setBookingFailed(true);
        onBookingStats?.(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same convention as Ekspedisi Overview's own stat-grid label - the tile for the L1 approval
  // stage is named after whichever track (Departemen or Divisi) the viewer actually belongs to,
  // and falls back to the combined label for accounts with no single track (GA, KPU, Super Admin).
  const l1Label =
    me.role === "ADMIN_DEPARTEMEN" || me.role === "APPROVAL_DEPARTEMEN"
      ? "Approval Departemen"
      : me.role === "ADMIN_DIVISI" || me.role === "APPROVAL_DIVISI"
      ? "Approval Divisi"
      : "Approval Departemen/Divisi";

  return (
    <>
      <h3 style={{ margin: "0 0 14px" }}>Ringkasan Bulan Ini</h3>

      <div className="dashboard-stats-section">
        <div className="dashboard-stats-section-head">
          <h4>Expedition</h4>
          <Link href="/ekspedisi/transaksi" className="dashboard-stats-link">Lihat Semua &rarr;</Link>
        </div>
        {!pengiriman ? (
          <p className="text-secondary">{pengirimanFailed ? "Gagal memuat ringkasan." : "Memuat ringkasan..."}</p>
        ) : (
          <div className="stat-grid">
            <div className="stat-tile"><div className="value">{pengiriman.waitingL1}</div><div className="label">{l1Label}</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.waitingGa}</div><div className="label">Admin General Affair</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.waitingKpu}</div><div className="label">KPU</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.completed}</div><div className="label">Approved</div></div>
            {pengiriman.totalBulanIni != null && (
              <div className="stat-tile stat-tile-money">
                <div className="value">{formatCurrency(pengiriman.totalBulanIni)}</div>
                <div className="label">Total Nilai Bulan Ini</div>
              </div>
            )}
          </div>
        )}
      </div>

      {me.role !== "KPU" && (
        <div className="dashboard-stats-section">
          <div className="dashboard-stats-section-head">
            <h4>Room Booking</h4>
            <Link href="/booking-ruang-meeting/transaksi" className="dashboard-stats-link">Lihat Semua &rarr;</Link>
          </div>
          {!booking ? (
            <p className="text-secondary">{bookingFailed ? "Gagal memuat ringkasan." : "Memuat ringkasan..."}</p>
          ) : (
            <div className="stat-grid">
              <div className="stat-tile"><div className="value">{booking.waitingL1}</div><div className="label">{l1Label}</div></div>
              <div className="stat-tile"><div className="value">{booking.waitingGa}</div><div className="label">Admin General Affair</div></div>
              <div className="stat-tile"><div className="value">{booking.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
              <div className="stat-tile"><div className="value">{booking.completed}</div><div className="label">Approved</div></div>
              <div className="stat-tile"><div className="value">{booking.rejected}</div><div className="label">Rejected</div></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
