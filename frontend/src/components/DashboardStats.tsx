"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Car, Folder, Layers, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { currentYearMonth, formatCurrency } from "@/lib/format";
import type {
  BookingKendaraanStatsResponse,
  BookingRuangStatsResponse,
  Me,
  PengirimanStatsResponse,
  PerbaikanSaranaStatsResponse,
  PermintaanArsipStatsResponse,
  PermintaanAtkStatsResponse,
} from "@/lib/types";

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
  onPengirimanStats?: (data: PengirimanStatsResponse | null) => void;
  onBookingStats?: (data: BookingRuangStatsResponse | null) => void;
  onKendaraanStats?: (data: BookingKendaraanStatsResponse | null) => void;
  onAtkStats?: (data: PermintaanAtkStatsResponse | null) => void;
  onSaranaStats?: (data: PerbaikanSaranaStatsResponse | null) => void;
  onArsipStats?: (data: PermintaanArsipStatsResponse | null) => void;
}

export default function DashboardStats({
  me,
  onPengirimanStats,
  onBookingStats,
  onKendaraanStats,
  onAtkStats,
  onSaranaStats,
  onArsipStats,
}: Props) {
  const [pengiriman, setPengiriman] = useState<PengirimanStatsView | null>(null);
  const [booking, setBooking] = useState<BookingStatsView | null>(null);
  const [kendaraan, setKendaraan] = useState<BookingStatsView | null>(null);
  const [atk, setAtk] = useState<BookingStatsView | null>(null);
  const [sarana, setSarana] = useState<BookingStatsView | null>(null);
  const [arsip, setArsip] = useState<BookingStatsView | null>(null);
  const [pengirimanFailed, setPengirimanFailed] = useState(false);
  const [bookingFailed, setBookingFailed] = useState(false);
  const [kendaraanFailed, setKendaraanFailed] = useState(false);
  const [atkFailed, setAtkFailed] = useState(false);
  const [saranaFailed, setSaranaFailed] = useState(false);
  const [arsipFailed, setArsipFailed] = useState(false);

  useEffect(() => {
    const bulan = currentYearMonth();
    api
      .getPengirimanStats(bulan)
      .then((p) => {
        onPengirimanStats?.(p);
        const pc = p.countsByStatus;
        setPengiriman({
          waitingL1: p.waitingL1,
          waitingGa: p.waitingGa,
          waitingGaApproval: p.waitingGaApproval,
          waitingKpu: p.waitingKpu,
          completed: pc.COMPLETED ?? 0,
          totalBulanIni: p.totalBulanIni != null ? Number(p.totalBulanIni) : null,
        });
      })
      .catch(() => {
        setPengirimanFailed(true);
        onPengirimanStats?.(null);
      });

    if (me.role === "KPU") return;

    api
      .getBookingStats(bulan)
      .then((b) => {
        onBookingStats?.(b);
        const bc = b.countsByStatus;
        setBooking({
          waitingL1: bc.SUBMITTED ?? 0,
          waitingGa: bc.APPROVED_L1 ?? 0,
          waitingGaApproval: bc.APPROVED_GA ?? 0,
          completed: bc.APPROVED_GA_APPROVAL ?? 0,
          // Room Booking's own "Rejected" table filter (RejectedStatuses on the backend) counts
          // CANCELLED alongside the 3 real reject statuses - this card needs to match that total
          // or it undercounts next to what the Transaksi/Overview "Rejected" filter shows.
          rejected: (bc.REJECTED_L1 ?? 0) + (bc.REJECTED_GA ?? 0) + (bc.REJECTED_GA_APPROVAL ?? 0) + (bc.CANCELLED ?? 0),
        });
      })
      .catch(() => {
        setBookingFailed(true);
        onBookingStats?.(null);
      });

    api
      .getKendaraanStats(bulan)
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

    api
      .getAtkStats(bulan)
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

    api
      .getSaranaStats(bulan)
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

    api
      .getArsipStats(bulan)
      .then((r) => {
        onArsipStats?.(r);
        const rc = r.countsByStatus;
        setArsip({
          waitingL1: rc.SUBMITTED ?? 0,
          waitingGa: rc.APPROVED_L1 ?? 0,
          waitingGaApproval: rc.APPROVED_GA ?? 0,
          completed: rc.APPROVED_GA_APPROVAL ?? 0,
          rejected: (rc.REJECTED_L1 ?? 0) + (rc.REJECTED_GA ?? 0) + (rc.REJECTED_GA_APPROVAL ?? 0),
        });
      })
      .catch(() => {
        setArsipFailed(true);
        onArsipStats?.(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const l1Label =
    me.role === "ADMIN_DEPARTEMEN" || me.role === "APPROVAL_DEPARTEMEN"
      ? "L1 Dept"
      : me.role === "ADMIN_DIVISI" || me.role === "APPROVAL_DIVISI"
      ? "L1 Div"
      : "Approval L1";

  const atkIcon = (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  );

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>Data Statistik Bulan Ini</h3>
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          Periode: {currentYearMonth()}
        </span>
      </div>

      <div className="dashboard-stats-grid">
        {/* 1. Ekspedisi */}
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card-head">
            <div className="dashboard-stat-card-title">
              <div className="dashboard-stat-card-icon">
                <Layers width={18} height={18} />
              </div>
              <h4>Ekspedisi</h4>
            </div>
            <Link href="/ekspedisi/transaksi" className="dashboard-stat-card-link">
              Buka Transaksi <ArrowRight width={14} height={14} />
            </Link>
          </div>

          {!pengiriman ? (
            <p className="text-secondary" style={{ margin: "16px 0", fontSize: "0.85rem" }}>
              {pengirimanFailed ? "Gagal memuat statistik." : "Memuat data statistik..."}
            </p>
          ) : (
            <>
              <div className="dashboard-stat-highlight-row">
                <div className="dashboard-stat-highlight-box warning">
                  <div className="dashboard-stat-highlight-val">
                    {pengiriman.waitingL1 + pengiriman.waitingGa + pengiriman.waitingGaApproval + pengiriman.waitingKpu}
                  </div>
                  <div className="dashboard-stat-highlight-lbl">Menunggu Approval</div>
                </div>
                <div className="dashboard-stat-highlight-box success">
                  <div className="dashboard-stat-highlight-val">{pengiriman.completed}</div>
                  <div className="dashboard-stat-highlight-lbl">Selesai / Approved</div>
                </div>
              </div>

              <div className="dashboard-stat-breakdown-row">
                <span className="dashboard-stat-breakdown-item">
                  <span>{l1Label}:</span>
                  <span className="dashboard-stat-breakdown-num">{pengiriman.waitingL1}</span>
                </span>
                <span className="dashboard-stat-breakdown-item">
                  <span>Admin GA:</span>
                  <span className="dashboard-stat-breakdown-num">{pengiriman.waitingGa}</span>
                </span>
                <span className="dashboard-stat-breakdown-item">
                  <span>Approval GA:</span>
                  <span className="dashboard-stat-breakdown-num">{pengiriman.waitingGaApproval}</span>
                </span>
                <span className="dashboard-stat-breakdown-item">
                  <span>Mitra:</span>
                  <span className="dashboard-stat-breakdown-num">{pengiriman.waitingKpu}</span>
                </span>
              </div>

              {pengiriman.totalBulanIni != null && pengiriman.totalBulanIni > 0 && (
                <div className="dashboard-stat-footer">
                  Biaya Pengiriman: <strong>{formatCurrency(pengiriman.totalBulanIni)}</strong>
                </div>
              )}
            </>
          )}
        </div>

        {/* 2. Room Booking */}
        {me.role !== "KPU" && (
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-card-head">
              <div className="dashboard-stat-card-title">
                <div className="dashboard-stat-card-icon">
                  <Calendar width={18} height={18} />
                </div>
                <h4>Booking Ruang Meeting</h4>
              </div>
              <Link href="/booking-ruang-meeting/transaksi" className="dashboard-stat-card-link">
                Buka Transaksi <ArrowRight width={14} height={14} />
              </Link>
            </div>

            {!booking ? (
              <p className="text-secondary" style={{ margin: "16px 0", fontSize: "0.85rem" }}>
                {bookingFailed ? "Gagal memuat statistik." : "Memuat data statistik..."}
              </p>
            ) : (
              <>
                <div className="dashboard-stat-highlight-row">
                  <div className="dashboard-stat-highlight-box warning">
                    <div className="dashboard-stat-highlight-val">
                      {booking.waitingL1 + booking.waitingGa + booking.waitingGaApproval}
                    </div>
                    <div className="dashboard-stat-highlight-lbl">Menunggu Approval</div>
                  </div>
                  <div className="dashboard-stat-highlight-box success">
                    <div className="dashboard-stat-highlight-val">{booking.completed}</div>
                    <div className="dashboard-stat-highlight-lbl">Disetujui</div>
                  </div>
                  <div className="dashboard-stat-highlight-box danger">
                    <div className="dashboard-stat-highlight-val">{booking.rejected}</div>
                    <div className="dashboard-stat-highlight-lbl">Ditolak</div>
                  </div>
                </div>

                <div className="dashboard-stat-breakdown-row">
                  <span className="dashboard-stat-breakdown-item">
                    <span>{l1Label}:</span>
                    <span className="dashboard-stat-breakdown-num">{booking.waitingL1}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Admin GA:</span>
                    <span className="dashboard-stat-breakdown-num">{booking.waitingGa}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Approval GA:</span>
                    <span className="dashboard-stat-breakdown-num">{booking.waitingGaApproval}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. Vehicle Booking */}
        {me.role !== "KPU" && (
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-card-head">
              <div className="dashboard-stat-card-title">
                <div className="dashboard-stat-card-icon">
                  <Car width={18} height={18} />
                </div>
                <h4>Booking Kendaraan</h4>
              </div>
              <Link href="/booking-kendaraan/transaksi" className="dashboard-stat-card-link">
                Buka Transaksi <ArrowRight width={14} height={14} />
              </Link>
            </div>

            {!kendaraan ? (
              <p className="text-secondary" style={{ margin: "16px 0", fontSize: "0.85rem" }}>
                {kendaraanFailed ? "Gagal memuat statistik." : "Memuat data statistik..."}
              </p>
            ) : (
              <>
                <div className="dashboard-stat-highlight-row">
                  <div className="dashboard-stat-highlight-box warning">
                    <div className="dashboard-stat-highlight-val">
                      {kendaraan.waitingL1 + kendaraan.waitingGa + kendaraan.waitingGaApproval}
                    </div>
                    <div className="dashboard-stat-highlight-lbl">Menunggu Approval</div>
                  </div>
                  <div className="dashboard-stat-highlight-box success">
                    <div className="dashboard-stat-highlight-val">{kendaraan.completed}</div>
                    <div className="dashboard-stat-highlight-lbl">Disetujui</div>
                  </div>
                  <div className="dashboard-stat-highlight-box danger">
                    <div className="dashboard-stat-highlight-val">{kendaraan.rejected}</div>
                    <div className="dashboard-stat-highlight-lbl">Ditolak</div>
                  </div>
                </div>

                <div className="dashboard-stat-breakdown-row">
                  <span className="dashboard-stat-breakdown-item">
                    <span>{l1Label}:</span>
                    <span className="dashboard-stat-breakdown-num">{kendaraan.waitingL1}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Admin GA:</span>
                    <span className="dashboard-stat-breakdown-num">{kendaraan.waitingGa}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Approval GA:</span>
                    <span className="dashboard-stat-breakdown-num">{kendaraan.waitingGaApproval}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. Office Supplies */}
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-card-head">
            <div className="dashboard-stat-card-title">
              <div className="dashboard-stat-card-icon">{atkIcon}</div>
              <h4>Office Supplies</h4>
            </div>
            <Link href="/office-supplies/transaksi" className="dashboard-stat-card-link">
              Buka Transaksi <ArrowRight width={14} height={14} />
            </Link>
          </div>

          {!atk ? (
            <p className="text-secondary" style={{ margin: "16px 0", fontSize: "0.85rem" }}>
              {atkFailed ? "Gagal memuat statistik." : "Memuat data statistik..."}
            </p>
          ) : (
            <>
              <div className="dashboard-stat-highlight-row">
                <div className="dashboard-stat-highlight-box warning">
                  <div className="dashboard-stat-highlight-val">
                    {atk.waitingL1 + atk.waitingGa + atk.waitingGaApproval}
                  </div>
                  <div className="dashboard-stat-highlight-lbl">Menunggu Approval</div>
                </div>
                <div className="dashboard-stat-highlight-box success">
                  <div className="dashboard-stat-highlight-val">{atk.completed}</div>
                  <div className="dashboard-stat-highlight-lbl">Selesai / Approved</div>
                </div>
                <div className="dashboard-stat-highlight-box danger">
                  <div className="dashboard-stat-highlight-val">{atk.rejected}</div>
                  <div className="dashboard-stat-highlight-lbl">Ditolak</div>
                </div>
              </div>

              <div className="dashboard-stat-breakdown-row">
                <span className="dashboard-stat-breakdown-item">
                  <span>{l1Label}:</span>
                  <span className="dashboard-stat-breakdown-num">{atk.waitingL1}</span>
                </span>
                <span className="dashboard-stat-breakdown-item">
                  <span>Admin GA:</span>
                  <span className="dashboard-stat-breakdown-num">{atk.waitingGa}</span>
                </span>
                <span className="dashboard-stat-breakdown-item">
                  <span>Approval GA:</span>
                  <span className="dashboard-stat-breakdown-num">{atk.waitingGaApproval}</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* 5. Maintenance */}
        {me.role !== "KPU" && (
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-card-head">
              <div className="dashboard-stat-card-title">
                <div className="dashboard-stat-card-icon">
                  <Wrench width={18} height={18} />
                </div>
                <h4>Maintenance</h4>
              </div>
              <Link href="/maintenance/transaksi" className="dashboard-stat-card-link">
                Buka Transaksi <ArrowRight width={14} height={14} />
              </Link>
            </div>

            {!sarana ? (
              <p className="text-secondary" style={{ margin: "16px 0", fontSize: "0.85rem" }}>
                {saranaFailed ? "Gagal memuat statistik." : "Memuat data statistik..."}
              </p>
            ) : (
              <>
                <div className="dashboard-stat-highlight-row">
                  <div className="dashboard-stat-highlight-box warning">
                    <div className="dashboard-stat-highlight-val">
                      {sarana.waitingL1 + sarana.waitingGa + sarana.waitingGaApproval}
                    </div>
                    <div className="dashboard-stat-highlight-lbl">Menunggu Approval</div>
                  </div>
                  <div className="dashboard-stat-highlight-box success">
                    <div className="dashboard-stat-highlight-val">{sarana.completed}</div>
                    <div className="dashboard-stat-highlight-lbl">Disetujui</div>
                  </div>
                  <div className="dashboard-stat-highlight-box danger">
                    <div className="dashboard-stat-highlight-val">{sarana.rejected}</div>
                    <div className="dashboard-stat-highlight-lbl">Ditolak</div>
                  </div>
                </div>

                <div className="dashboard-stat-breakdown-row">
                  <span className="dashboard-stat-breakdown-item">
                    <span>{l1Label}:</span>
                    <span className="dashboard-stat-breakdown-num">{sarana.waitingL1}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Admin GA:</span>
                    <span className="dashboard-stat-breakdown-num">{sarana.waitingGa}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Approval GA:</span>
                    <span className="dashboard-stat-breakdown-num">{sarana.waitingGaApproval}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* 6. Archive */}
        {me.role !== "KPU" && (
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-card-head">
              <div className="dashboard-stat-card-title">
                <div className="dashboard-stat-card-icon">
                  <Folder width={18} height={18} />
                </div>
                <h4>Arsip</h4>
              </div>
              <Link href="/arsip/transaksi" className="dashboard-stat-card-link">
                Buka Transaksi <ArrowRight width={14} height={14} />
              </Link>
            </div>

            {!arsip ? (
              <p className="text-secondary" style={{ margin: "16px 0", fontSize: "0.85rem" }}>
                {arsipFailed ? "Gagal memuat statistik." : "Memuat data statistik..."}
              </p>
            ) : (
              <>
                <div className="dashboard-stat-highlight-row">
                  <div className="dashboard-stat-highlight-box warning">
                    <div className="dashboard-stat-highlight-val">
                      {arsip.waitingL1 + arsip.waitingGa + arsip.waitingGaApproval}
                    </div>
                    <div className="dashboard-stat-highlight-lbl">Menunggu Approval</div>
                  </div>
                  <div className="dashboard-stat-highlight-box success">
                    <div className="dashboard-stat-highlight-val">{arsip.completed}</div>
                    <div className="dashboard-stat-highlight-lbl">Disetujui</div>
                  </div>
                  <div className="dashboard-stat-highlight-box danger">
                    <div className="dashboard-stat-highlight-val">{arsip.rejected}</div>
                    <div className="dashboard-stat-highlight-lbl">Ditolak</div>
                  </div>
                </div>

                <div className="dashboard-stat-breakdown-row">
                  <span className="dashboard-stat-breakdown-item">
                    <span>{l1Label}:</span>
                    <span className="dashboard-stat-breakdown-num">{arsip.waitingL1}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Admin GA:</span>
                    <span className="dashboard-stat-breakdown-num">{arsip.waitingGa}</span>
                  </span>
                  <span className="dashboard-stat-breakdown-item">
                    <span>Approval GA:</span>
                    <span className="dashboard-stat-breakdown-num">{arsip.waitingGaApproval}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
