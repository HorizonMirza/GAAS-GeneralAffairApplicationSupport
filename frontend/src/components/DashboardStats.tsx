"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { currentYearMonth, formatCurrency } from "@/lib/format";
import type { Me } from "@/lib/types";

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

export default function DashboardStats({ me }: { me: Me }) {
  const [pengiriman, setPengiriman] = useState<PengirimanStatsView | null>(null);
  const [booking, setBooking] = useState<BookingStatsView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const bulan = currentYearMonth();
    Promise.all([api.getPengirimanStats(bulan), api.getBookingStats(bulan)])
      .then(([p, b]) => {
        const pc = p.countsByStatus;
        setPengiriman({
          waitingL1: (pc.SUBMITTED ?? 0) + (pc.REJECTED_GA ?? 0),
          waitingGa: (pc.APPROVED_L1 ?? 0) + (pc.REJECTED_GA_APPROVAL ?? 0),
          waitingGaApproval: (pc.APPROVED_GA ?? 0) + (pc.REJECTED_KPU ?? 0),
          waitingKpu: pc.APPROVED_GA_APPROVAL ?? 0,
          completed: pc.COMPLETED ?? 0,
          totalBulanIni: p.totalBulanIni,
        });
        const bc = b.countsByStatus;
        setBooking({
          waitingL1: bc.SUBMITTED ?? 0,
          waitingGa: bc.APPROVED_L1 ?? 0,
          waitingGaApproval: bc.APPROVED_GA ?? 0,
          completed: bc.APPROVED_GA_APPROVAL ?? 0,
          rejected: (bc.REJECTED_L1 ?? 0) + (bc.REJECTED_GA ?? 0) + (bc.REJECTED_GA_APPROVAL ?? 0),
        });
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

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
          <p className="text-secondary">Memuat ringkasan...</p>
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

      <div className="dashboard-stats-section">
        <div className="dashboard-stats-section-head">
          <h4>Room Booking</h4>
          <Link href="/booking-ruang-meeting/transaksi" className="dashboard-stats-link">Lihat Semua &rarr;</Link>
        </div>
        {!booking ? (
          <p className="text-secondary">Memuat ringkasan...</p>
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
    </>
  );
}
