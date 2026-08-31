"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { BookingStatus, Status } from "@/lib/types";

// Same restriction as the Room Booking Laporan page this borrows its pattern from - aggregate
// counts across every module, so it's scoped to the roles that actually do cross-module
// reporting, not every requester.
const REPORT_ROLES = new Set(["ADMIN_GA", "APPROVAL_GA", "SUPER_ADMIN"]);

interface Bucket {
  label: string;
  count: number;
  color: string;
}

// Every module besides Ekspedisi reuses the exact same BookingStatus enum (see
// PengirimanApi's shared approval-flow shape), so one bucketing function covers all four.
function bucketsFromBooking(counts: Partial<Record<BookingStatus, number>>): Bucket[] {
  return [
    { label: "Draft", count: counts.DRAFT ?? 0, color: "#94a3b8" },
    {
      label: "On-Approval",
      count: (counts.SUBMITTED ?? 0) + (counts.APPROVED_L1 ?? 0) + (counts.APPROVED_GA ?? 0),
      color: "#f59e0b",
    },
    { label: "Approved", count: counts.APPROVED_GA_APPROVAL ?? 0, color: "#16a34a" },
    {
      label: "Rejected",
      count: (counts.REJECTED_L1 ?? 0) + (counts.REJECTED_GA ?? 0) + (counts.REJECTED_GA_APPROVAL ?? 0),
      color: "#dc2626",
    },
  ];
}

// Ekspedisi's own Status enum has one extra final stage (KPU) that the shared BookingStatus
// modules don't, so it gets its own bucketing instead of reusing bucketsFromBooking.
function bucketsFromPengiriman(counts: Partial<Record<Status, number>>): Bucket[] {
  return [
    { label: "Draft", count: counts.DRAFT ?? 0, color: "#94a3b8" },
    {
      label: "On-Approval",
      count: (counts.SUBMITTED ?? 0) + (counts.APPROVED_L1 ?? 0) + (counts.APPROVED_GA ?? 0) + (counts.APPROVED_GA_APPROVAL ?? 0),
      color: "#f59e0b",
    },
    { label: "Approved", count: counts.COMPLETED ?? 0, color: "#16a34a" },
    {
      label: "Rejected",
      count: (counts.REJECTED_L1 ?? 0) + (counts.REJECTED_GA ?? 0) + (counts.REJECTED_GA_APPROVAL ?? 0) + (counts.REJECTED_KPU ?? 0),
      color: "#dc2626",
    },
  ];
}

function sumBuckets(buckets: Bucket[]): number {
  return buckets.reduce((total, b) => total + b.count, 0);
}

interface ModuleCard {
  key: string;
  title: string;
  accent: string;
  href: string;
  buckets: Bucket[];
}

function BarRow({ bucket, max }: { bucket: Bucket; max: number }) {
  const width = max === 0 ? 0 : Math.max(bucket.count === 0 ? 0 : 4, (bucket.count / max) * 100);
  return (
    <div className="data-bar-row">
      <span className="data-bar-label">{bucket.label}</span>
      <div className="data-bar-track">
        <div className="data-bar-fill" style={{ width: `${width}%`, background: bucket.color }} />
      </div>
      <span className="data-bar-count">{bucket.count}</span>
    </div>
  );
}

function ModuleReportCard({ card }: { card: ModuleCard }) {
  const total = sumBuckets(card.buckets);
  const max = Math.max(1, ...card.buckets.map((b) => b.count));
  return (
    <Link href={card.href} className="data-module-card">
      <div className="data-module-card-head">
        <span className="data-module-dot" style={{ background: card.accent }} />
        <h4>{card.title}</h4>
        <span className="data-module-total">{total}</span>
      </div>
      <div className="data-bar-list">
        {card.buckets.map((b) => (
          <BarRow key={b.label} bucket={b} max={max} />
        ))}
      </div>
    </Link>
  );
}

export default function DataOverviewPage() {
  const { me, loading } = useAuth();
  const router = useRouter();

  const [cards, setCards] = useState<ModuleCard[] | null>(null);
  const [archiveTotal, setArchiveTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && me && !REPORT_ROLES.has(me.role)) router.replace("/dashboard");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me || !REPORT_ROLES.has(me.role)) return;
    setBusy(true);
    setError(null);
    // Empty bulan is dropped by apiRequest's param filter, so each GetStats call comes back
    // as an all-time total instead of scoped to the current month - a broader first read than
    // the per-page overview tiles, which is the point of a dedicated Data section.
    Promise.all([
      api.getPengirimanStats(""),
      api.getBookingStats(""),
      api.getKendaraanStats(""),
      api.getAtkStats(""),
      api.getSaranaStats(""),
      api.listArchive({ page: 1, limit: 5 }),
    ])
      .then(([pengiriman, ruang, kendaraan, atk, sarana, arsip]) => {
        setCards([
          { key: "ekspedisi", title: "Ekspedisi", accent: "#1450C9", href: "/ekspedisi/transaksi", buckets: bucketsFromPengiriman(pengiriman.countsByStatus) },
          { key: "room", title: "Room Booking", accent: "#7c3aed", href: "/booking-ruang-meeting/transaksi", buckets: bucketsFromBooking(ruang.countsByStatus) },
          { key: "vehicle", title: "Vehicle Booking", accent: "#0891b2", href: "/booking-kendaraan/transaksi", buckets: bucketsFromBooking(kendaraan.countsByStatus) },
          { key: "atk", title: "Office Supplies", accent: "#ca8a04", href: "/office-supplies/transaksi", buckets: bucketsFromBooking(atk.countsByStatus) },
          { key: "sarana", title: "Maintenance", accent: "#dc2626", href: "/maintenance/transaksi", buckets: bucketsFromBooking(sarana.countsByStatus) },
        ]);
        setArchiveTotal(arsip.total);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(false));
  }, [me]);

  if (!me || !REPORT_ROLES.has(me.role)) return null;

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
        <h3 className="welcome-heading">Data</h3>
      </div>
      <p className="text-secondary" style={{ marginTop: -10, marginBottom: 20 }}>
        Ringkasan seluruh data yang sudah tercatat di setiap modul, sepanjang waktu. Klik salah satu kartu untuk buka daftar transaksinya.
      </p>

      {error && <p className="text-secondary" style={{ color: "var(--badge-rejected-fg)" }}>{error}</p>}

      {busy ? (
        <p className="text-secondary">Memuat data...</p>
      ) : (
        <>
          <div className="data-module-grid">
            {cards?.map((card) => (
              <ModuleReportCard key={card.key} card={card} />
            ))}
          </div>

          <Link href="/arsip" className="data-module-card" style={{ marginTop: 14, maxWidth: 320 }}>
            <div className="data-module-card-head">
              <span className="data-module-dot" style={{ background: "#16a34a" }} />
              <h4>Archive</h4>
              <span className="data-module-total">{archiveTotal ?? 0}</span>
            </div>
            <p className="text-secondary" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
              Total dokumen tersimpan
            </p>
          </Link>
        </>
      )}
    </>
  );
}
