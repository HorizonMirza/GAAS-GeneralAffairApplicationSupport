"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { currentYearMonth } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-context";
import type {
  BookingKendaraanStatsResponse,
  BookingRuangStatsResponse,
  Me,
  PengirimanStatsResponse,
  PerbaikanSaranaStatsResponse,
  PermintaanAtkStatsResponse,
} from "@/lib/types";

interface PengirimanStatsView {
  waitingL1: number;
  waitingGa: number;
  waitingGaApproval: number;
  waitingKpu: number;
  completed: number;
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
  onKendaraanStats?: (data: BookingKendaraanStatsResponse | null) => void;
  onAtkStats?: (data: PermintaanAtkStatsResponse | null) => void;
  onSaranaStats?: (data: PerbaikanSaranaStatsResponse | null) => void;
}

export default function DashboardStats({ me, onPengirimanStats, onBookingStats, onKendaraanStats, onAtkStats, onSaranaStats }: Props) {
  const { t } = useLanguage();
  const [pengiriman, setPengiriman] = useState<PengirimanStatsView | null>(null);
  const [booking, setBooking] = useState<BookingStatsView | null>(null);
  const [kendaraan, setKendaraan] = useState<BookingStatsView | null>(null);
  const [atk, setAtk] = useState<BookingStatsView | null>(null);
  const [sarana, setSarana] = useState<BookingStatsView | null>(null);
  const [pengirimanFailed, setPengirimanFailed] = useState(false);
  const [bookingFailed, setBookingFailed] = useState(false);
  const [kendaraanFailed, setKendaraanFailed] = useState(false);
  const [atkFailed, setAtkFailed] = useState(false);
  const [saranaFailed, setSaranaFailed] = useState(false);

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
    api.getKendaraanStats(bulan)
      .then((k) => {
        onKendaraanStats?.(k);
        const kc = k.countsByStatus;
        setKendaraan({
          waitingL1: kc.SUBMITTED ?? 0,
          waitingGa: kc.APPROVED_L1 ?? 0,
          waitingGaApproval: kc.APPROVED_GA ?? 0,
          completed: kc.APPROVED_GA_APPROVAL ?? 0,
          rejected: (kc.REJECTED_L1 ?? 0) + (kc.REJECTED_GA ?? 0) + (kc.REJECTED_GA_APPROVAL ?? 0),
        });
      })
      .catch(() => {
        setKendaraanFailed(true);
        onKendaraanStats?.(null);
      });
    api.getAtkStats(bulan)
      .then((a) => {
        onAtkStats?.(a);
        const ac = a.countsByStatus;
        setAtk({
          waitingL1: ac.SUBMITTED ?? 0,
          waitingGa: ac.APPROVED_L1 ?? 0,
          waitingGaApproval: ac.APPROVED_GA ?? 0,
          completed: ac.APPROVED_GA_APPROVAL ?? 0,
          rejected: (ac.REJECTED_L1 ?? 0) + (ac.REJECTED_GA ?? 0) + (ac.REJECTED_GA_APPROVAL ?? 0),
        });
      })
      .catch(() => {
        setAtkFailed(true);
        onAtkStats?.(null);
      });
    api.getSaranaStats(bulan)
      .then((s) => {
        onSaranaStats?.(s);
        const sc = s.countsByStatus;
        setSarana({
          waitingL1: sc.SUBMITTED ?? 0,
          waitingGa: sc.APPROVED_L1 ?? 0,
          waitingGaApproval: sc.APPROVED_GA ?? 0,
          completed: sc.APPROVED_GA_APPROVAL ?? 0,
          rejected: (sc.REJECTED_L1 ?? 0) + (sc.REJECTED_GA ?? 0) + (sc.REJECTED_GA_APPROVAL ?? 0),
        });
      })
      .catch(() => {
        setSaranaFailed(true);
        onSaranaStats?.(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same convention as Ekspedisi Overview's own stat-grid label - the tile for the L1 approval
  // stage is named after whichever track (Departemen or Divisi) the viewer actually belongs to,
  // and falls back to the combined label for accounts with no single track (GA, KPU, Super Admin).
  const l1Label =
    me.role === "ADMIN_DEPARTEMEN" || me.role === "APPROVAL_DEPARTEMEN"
      ? `${t("word.approval")} ${t("word.department")}`
      : me.role === "ADMIN_DIVISI" || me.role === "APPROVAL_DIVISI"
      ? `${t("word.approval")} ${t("word.division")}`
      : `${t("word.approval")} ${t("word.department")}/${t("word.division")}`;
  const adminGaLabel = `${t("word.admin")} ${t("word.generalAffair")}`;
  const approvalGaLabel = `${t("word.approval")} ${t("word.generalAffair")}`;
  const approvedLabel = t("word.approved");
  const rejectedLabel = t("word.rejected");

  return (
    <>
      <h3 style={{ margin: "0 0 14px" }}>{t("dashboard.summaryThisMonth")}</h3>

      <div className="dashboard-stats-section">
        <div className="dashboard-stats-section-head">
          <h4>{t("nav.expedition")}</h4>
          <Link href="/ekspedisi/transaksi" className="dashboard-stats-link">{t("dashboard.viewAll")} &rarr;</Link>
        </div>
        {!pengiriman ? (
          <p className="text-secondary">{pengirimanFailed ? t("dashboard.summaryLoadFailed") : t("dashboard.summaryLoading")}</p>
        ) : (
          <div className="stat-grid">
            <div className="stat-tile"><div className="value">{pengiriman.waitingL1}</div><div className="label">{l1Label}</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.waitingGa}</div><div className="label">{adminGaLabel}</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.waitingGaApproval}</div><div className="label">{approvalGaLabel}</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.waitingKpu}</div><div className="label">{t("word.partner")}</div></div>
            <div className="stat-tile"><div className="value">{pengiriman.completed}</div><div className="label">{approvedLabel}</div></div>
          </div>
        )}
      </div>

      {me.role !== "KPU" && (
        <div className="dashboard-stats-section">
          <div className="dashboard-stats-section-head">
            <h4>{t("nav.roomBooking")}</h4>
            <Link href="/booking-ruang-meeting/transaksi" className="dashboard-stats-link">{t("dashboard.viewAll")} &rarr;</Link>
          </div>
          {!booking ? (
            <p className="text-secondary">{bookingFailed ? t("dashboard.summaryLoadFailed") : t("dashboard.summaryLoading")}</p>
          ) : (
            <div className="stat-grid">
              <div className="stat-tile"><div className="value">{booking.waitingL1}</div><div className="label">{l1Label}</div></div>
              <div className="stat-tile"><div className="value">{booking.waitingGa}</div><div className="label">{adminGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{booking.waitingGaApproval}</div><div className="label">{approvalGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{booking.completed}</div><div className="label">{approvedLabel}</div></div>
              <div className="stat-tile"><div className="value">{booking.rejected}</div><div className="label">{rejectedLabel}</div></div>
            </div>
          )}
        </div>
      )}

      {me.role !== "KPU" && (
        <div className="dashboard-stats-section">
          <div className="dashboard-stats-section-head">
            <h4>{t("nav.vehicleBooking")}</h4>
            <Link href="/booking-kendaraan/transaksi" className="dashboard-stats-link">{t("dashboard.viewAll")} &rarr;</Link>
          </div>
          {!kendaraan ? (
            <p className="text-secondary">{kendaraanFailed ? t("dashboard.summaryLoadFailed") : t("dashboard.summaryLoading")}</p>
          ) : (
            <div className="stat-grid">
              <div className="stat-tile"><div className="value">{kendaraan.waitingL1}</div><div className="label">{l1Label}</div></div>
              <div className="stat-tile"><div className="value">{kendaraan.waitingGa}</div><div className="label">{adminGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{kendaraan.waitingGaApproval}</div><div className="label">{approvalGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{kendaraan.completed}</div><div className="label">{approvedLabel}</div></div>
              <div className="stat-tile"><div className="value">{kendaraan.rejected}</div><div className="label">{rejectedLabel}</div></div>
            </div>
          )}
        </div>
      )}

      {me.role !== "KPU" && (
        <div className="dashboard-stats-section">
          <div className="dashboard-stats-section-head">
            <h4>{t("nav.officeSupplies")}</h4>
            <Link href="/office-supplies/transaksi" className="dashboard-stats-link">{t("dashboard.viewAll")} &rarr;</Link>
          </div>
          {!atk ? (
            <p className="text-secondary">{atkFailed ? t("dashboard.summaryLoadFailed") : t("dashboard.summaryLoading")}</p>
          ) : (
            <div className="stat-grid">
              <div className="stat-tile"><div className="value">{atk.waitingL1}</div><div className="label">{l1Label}</div></div>
              <div className="stat-tile"><div className="value">{atk.waitingGa}</div><div className="label">{adminGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{atk.waitingGaApproval}</div><div className="label">{approvalGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{atk.completed}</div><div className="label">{approvedLabel}</div></div>
              <div className="stat-tile"><div className="value">{atk.rejected}</div><div className="label">{rejectedLabel}</div></div>
            </div>
          )}
        </div>
      )}

      {me.role !== "KPU" && (
        <div className="dashboard-stats-section">
          <div className="dashboard-stats-section-head">
            <h4>{t("nav.maintenance")}</h4>
            <Link href="/maintenance/transaksi" className="dashboard-stats-link">{t("dashboard.viewAll")} &rarr;</Link>
          </div>
          {!sarana ? (
            <p className="text-secondary">{saranaFailed ? t("dashboard.summaryLoadFailed") : t("dashboard.summaryLoading")}</p>
          ) : (
            <div className="stat-grid">
              <div className="stat-tile"><div className="value">{sarana.waitingL1}</div><div className="label">{l1Label}</div></div>
              <div className="stat-tile"><div className="value">{sarana.waitingGa}</div><div className="label">{adminGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{sarana.waitingGaApproval}</div><div className="label">{approvalGaLabel}</div></div>
              <div className="stat-tile"><div className="value">{sarana.completed}</div><div className="label">{approvedLabel}</div></div>
              <div className="stat-tile"><div className="value">{sarana.rejected}</div><div className="label">{rejectedLabel}</div></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
