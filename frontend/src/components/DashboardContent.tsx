"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Calendar, Car, Folder, Layers, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { currentYearMonth } from "@/lib/format";
import type { Me } from "@/lib/types";

// ─── Tab type ─────────────────────────────────────────────────────────────────
type DashTab = "all" | "ekspedisi" | "room" | "vehicle" | "atk" | "maint" | "arsip";

// ─── Stats shapes ──────────────────────────────────────────────────────────────
interface ModuleStats {
  pending: number;
  completed: number;
  rejected: number;
}

interface AllStats {
  ekspedisi: ModuleStats | null;
  room:      ModuleStats | null;
  vehicle:   ModuleStats | null;
  atk:       ModuleStats | null;
  maint:     ModuleStats | null;
  arsip:     ModuleStats | null;
  loading:   boolean;
}

// ─── ATK icon ─────────────────────────────────────────────────────────────────
function AtkIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  );
}

// ─── Tab config ────────────────────────────────────────────────────────────────
const ALL_TABS: { key: DashTab; label: string; icon: React.ReactNode; kpuHidden?: boolean }[] = [
  { key: "all",      label: "Keseluruhan",    icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { key: "ekspedisi",label: "Ekspedisi",      icon: <Layers width={14} height={14} /> },
  { key: "room",     label: "Room Booking",   icon: <Calendar width={14} height={14} />, kpuHidden: true },
  { key: "vehicle",  label: "Vehicle Booking",icon: <Car width={14} height={14} />,      kpuHidden: true },
  { key: "atk",      label: "Office Supplies",icon: <AtkIcon /> },
  { key: "maint",    label: "Maintenance",    icon: <Wrench width={14} height={14} />,   kpuHidden: true },
  { key: "arsip",    label: "Archive",        icon: <Folder width={14} height={14} />,   kpuHidden: true },
];

// ─── Chart: Donut ──────────────────────────────────────────────────────────────
function drawDonut(
  canvas: HTMLCanvasElement,
  segs: { v: number; c: string }[],
  total: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dark   = document.documentElement.getAttribute("data-theme") === "dark";
  const txtStr = dark ? "#eef4ff" : "#0b1a33";
  const txtMut = dark ? "#9db4dd" : "#4a5b7a";
  const bg     = dark ? "#081328" : "#ffffff";
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const r = Math.min(canvas.width, canvas.height) / 2 - 6;
  const ri = r * 0.56;
  let a = -Math.PI / 2;
  segs.forEach((s) => {
    const sw = total > 0 ? (s.v / total) * 2 * Math.PI : 0;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a, a + sw); ctx.closePath();
    ctx.fillStyle = s.c; ctx.fill();
    a += sw;
  });
  // empty state
  if (total === 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = dark ? "#16234a" : "#dbe6fb"; ctx.lineWidth = 12; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, 2 * Math.PI);
  ctx.fillStyle = bg; ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = txtStr; ctx.font = `bold 14px -apple-system,"Segoe UI",sans-serif`;
  ctx.fillText(total.toLocaleString(), cx, cy - 8);
  ctx.fillStyle = txtMut; ctx.font = `11px -apple-system,sans-serif`;
  ctx.fillText("total", cx, cy + 9);
}

// ─── Chart: Grouped bar ────────────────────────────────────────────────────────
function drawGroupedBar(
  canvas: HTMLCanvasElement,
  groups: string[],
  layers: number[][],
  colors: string[]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dark    = document.documentElement.getAttribute("data-theme") === "dark";
  const txtMut  = dark ? "#9db4dd" : "#4a5b7a";
  const txtStr  = dark ? "#eef4ff" : "#0b1a33";
  const grid    = dark ? "rgba(255,255,255,0.05)" : "rgba(15,40,90,0.05)";
  const W = canvas.width, H = canvas.height;
  const p = { t: 12, r: 18, b: 34, l: 36 };
  const cW = W - p.l - p.r, cH = H - p.t - p.b;
  const maxV = Math.max(...layers.flat(), 1);
  const gW = cW / groups.length;
  const bW = Math.min(gW * 0.22, 24);

  ctx.save(); ctx.translate(p.l, p.t);

  for (let i = 0; i <= 4; i++) {
    const y = cH - (i / 4) * cH;
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cW, y); ctx.stroke();
    ctx.fillStyle = txtMut; ctx.font = "11px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(String(Math.round((i / 4) * maxV)), -6, y + 4);
  }
  groups.forEach((g, i) => {
    const gX = i * gW + (gW - bW * layers.length - (layers.length - 1) * 3) / 2;
    layers.forEach((layer, j) => {
      const bh = (layer[i] / maxV) * cH;
      ctx.fillStyle = colors[j];
      ctx.beginPath();
      ctx.roundRect(gX + j * (bW + 3), cH - bh, bW, Math.max(bh, 1), [3, 3, 0, 0]);
      ctx.fill();
    });
    ctx.fillStyle = txtStr; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(g, i * gW + gW / 2, cH + 20);
  });
  ctx.restore();
}

// ─── StatTile ──────────────────────────────────────────────────────────────────
function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat-tile">
      <div className="value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

// ─── ModuleStatCard ────────────────────────────────────────────────────────────
function ModuleStatCard({
  title, href, stats, loading,
}: {
  title: string;
  href: string;
  stats: ModuleStats | null;
  loading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !stats) return;
    const t = stats.pending + stats.completed + stats.rejected;
    drawDonut(canvasRef.current, [
      { v: stats.completed, c: "#16a34a" },
      { v: stats.pending,   c: "#f59e0b" },
      { v: stats.rejected,  c: "#dc2626" },
    ], t);
  }, [stats]);

  const total = stats ? stats.pending + stats.completed + stats.rejected : 0;

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</div>
        <Link href={href} style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none" }}>
          Buka Transaksi →
        </Link>
      </div>

      {loading && !stats ? (
        <p className="text-secondary" style={{ fontSize: "0.85rem" }}>Memuat data...</p>
      ) : !stats ? (
        <p className="text-secondary" style={{ fontSize: "0.85rem" }}>Gagal memuat statistik.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center" }}>
          <canvas ref={canvasRef} width={140} height={128} />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { label: "Selesai",  v: stats.completed, dot: "#16a34a" },
              { label: "Menunggu", v: stats.pending,   dot: "#f59e0b" },
              { label: "Ditolak",  v: stats.rejected,  dot: "#dc2626" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.dot, display: "inline-block", flexShrink: 0 }} />
                  {r.label}
                </span>
                <strong>{r.v.toLocaleString()}</strong>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "2px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem" }}>
              <span className="text-secondary">Total bulan ini</span>
              <strong>{total.toLocaleString()}</strong>
            </div>
            {total > 0 && (
              <div style={{ background: "var(--border-subtle)", borderRadius: 9999, height: 6 }}>
                <div style={{ height: 6, borderRadius: 9999, background: "#16a34a", width: `${Math.round((stats.completed / total) * 100)}%`, transition: "width 0.4s" }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QuickLinks ────────────────────────────────────────────────────────────────
function QuickLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 12 }}>Akses Cepat</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} style={{ color: "var(--blue-500)", fontSize: "0.85rem", textDecoration: "none" }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Keseluruhan pane ──────────────────────────────────────────────────────────
function PaneAll({ stats, isKpu }: { stats: AllStats; isKpu: boolean }) {
  const donutRef = useRef<HTMLCanvasElement>(null);
  const barRef   = useRef<HTMLCanvasElement>(null);

  const sum = (field: keyof ModuleStats) => {
    const modules: (keyof AllStats)[] = isKpu
      ? ["ekspedisi", "atk"]
      : ["ekspedisi", "room", "vehicle", "atk", "maint", "arsip"];
    return modules.reduce((acc, m) => {
      const s = stats[m] as ModuleStats | null | boolean;
      return acc + (s && typeof s === "object" ? (s[field] as number) : 0);
    }, 0);
  };

  const totalPending   = sum("pending");
  const totalCompleted = sum("completed");
  const totalRejected  = sum("rejected");
  const grandTotal     = totalPending + totalCompleted + totalRejected;

  // Donut
  useEffect(() => {
    if (!donutRef.current) return;
    drawDonut(donutRef.current, [
      { v: totalCompleted, c: "#16a34a" },
      { v: totalPending,   c: "#f59e0b" },
      { v: totalRejected,  c: "#dc2626" },
    ], grandTotal);
  }, [totalCompleted, totalPending, totalRejected, grandTotal]);

  // Bar
  useEffect(() => {
    if (!barRef.current) return;
    const labels = isKpu
      ? ["Ekspedisi", "ATK"]
      : ["Eksp.", "Ruang", "Kend.", "ATK", "Maint.", "Arsip"];
    const keys: (keyof AllStats)[] = isKpu
      ? ["ekspedisi", "atk"]
      : ["ekspedisi", "room", "vehicle", "atk", "maint", "arsip"];
    const get = (field: keyof ModuleStats) =>
      keys.map((k) => {
        const s = stats[k] as ModuleStats | null | boolean;
        return s && typeof s === "object" ? (s[field] as number) : 0;
      });
    drawGroupedBar(
      barRef.current,
      labels,
      [get("completed"), get("pending"), get("rejected")],
      ["#1c6dff", "#f59e0b", "#ef4444"]
    );
  }, [stats, isKpu]);

  return (
    <>
      <div className="stat-grid">
        <StatTile value={grandTotal} label="Total Permintaan Bulan Ini" />
        <StatTile value={totalPending} label="Menunggu Approval" />
        <StatTile value={totalCompleted} label="Selesai Bulan Ini" />
        <StatTile
          value={grandTotal > 0 ? `${Math.round((totalCompleted / grandTotal) * 100)}%` : "—"}
          label="Completion Rate"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
        {/* Donut */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Status Keseluruhan</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 3 }}>
              {isKpu ? "2" : "6"} modul · {currentYearMonth()}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 180 }}>
              <canvas ref={donutRef} width={200} height={180} style={{ display: "block" }} />
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { label: "Selesai",  v: totalCompleted, dot: "#16a34a", cls: "badge-completed" },
                { label: "Diproses", v: totalPending,   dot: "#f59e0b", cls: "badge-submitted" },
                { label: "Ditolak",  v: totalRejected,  dot: "#dc2626", cls: "badge-rejected"  },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.83rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                    {s.label}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                    {s.v.toLocaleString()}
                    {grandTotal > 0 && (
                      <span className={`badge ${s.cls}`}>{Math.round((s.v / grandTotal) * 100)}%</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Perbandingan Antar Modul</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 3 }}>
                Volume selesai · pending · ditolak bulan ini
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.75rem", fontWeight: 600 }}>
              {(["#1c6dff", "#f59e0b", "#ef4444"] as const).map((c, i) => (
                <span key={c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: c, display: "inline-block" }} />
                  {["Selesai", "Pending", "Tolak"][i]}
                </span>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <canvas ref={barRef} width={580} height={260} style={{ width: "100%", height: "auto" }} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main exported component ───────────────────────────────────────────────────
interface Props {
  me: Me;
}

export default function DashboardContent({ me }: Props) {
  const isKpu      = me.role === "KPU";
  const isSuperAdmin = me.role === "SUPER_ADMIN";
  // Super Admin: fetch all modules (same as non-KPU)
  const isNonKpu   = !isKpu;

  const [activeTab, setActiveTab] = useState<DashTab>("all");
  const [stats, setStats] = useState<AllStats>({
    ekspedisi: null, room: null, vehicle: null,
    atk: null, maint: null, arsip: null, loading: true,
  });

  const loadStats = useCallback(async () => {
    const bulan = currentYearMonth();
    setStats((prev) => ({ ...prev, loading: true }));

    // Helper: convert countsByStatus to ModuleStats
    const toStats = (
      counts: Record<string, number>,
      onApproval: string[],
      approved: string,
      rejected: string[]
    ): ModuleStats => ({
      pending:   onApproval.reduce((s, k) => s + (counts[k] ?? 0), 0),
      completed: counts[approved] ?? 0,
      rejected:  rejected.reduce((s, k) => s + (counts[k] ?? 0), 0),
    });

    const bookingOnApproval = ["SUBMITTED", "APPROVED_L1", "APPROVED_GA"];
    const bookingApproved   = "APPROVED_GA_APPROVAL";
    const bookingRejected   = ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL", "CANCELLED"];

    const [ekspRes, atkRes] = await Promise.allSettled([
      api.getPengirimanStats(bulan),
      api.getAtkStats(bulan),
    ]);

    const ekspStats: ModuleStats | null = ekspRes.status === "fulfilled"
      ? {
          pending:   (ekspRes.value.waitingL1 ?? 0) + (ekspRes.value.waitingGa ?? 0) + (ekspRes.value.waitingGaApproval ?? 0) + (ekspRes.value.waitingKpu ?? 0),
          completed: ekspRes.value.countsByStatus?.COMPLETED ?? 0,
          rejected:  (ekspRes.value.countsByStatus?.REJECTED_L1 ?? 0) + (ekspRes.value.countsByStatus?.REJECTED_GA ?? 0) + (ekspRes.value.countsByStatus?.REJECTED_GA_APPROVAL ?? 0) + (ekspRes.value.countsByStatus?.REJECTED_KPU ?? 0),
        }
      : null;

    const atkStats: ModuleStats | null = atkRes.status === "fulfilled"
      ? toStats(atkRes.value.countsByStatus as Record<string, number>, bookingOnApproval, bookingApproved, ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL"])
      : null;

    if (!isNonKpu) {
      // KPU: only ekspedisi + atk
      setStats({ ekspedisi: ekspStats, room: null, vehicle: null, atk: atkStats, maint: null, arsip: null, loading: false });
      return;
    }

    const [roomRes, vehRes, maintRes, arsipRes] = await Promise.allSettled([
      api.getBookingStats(bulan),
      api.getKendaraanStats(bulan),
      api.getSaranaStats(bulan),
      api.getArsipStats(bulan),
    ]);

    setStats({
      ekspedisi: ekspStats,
      room:   roomRes.status  === "fulfilled" ? toStats(roomRes.value.countsByStatus  as Record<string, number>, bookingOnApproval, bookingApproved, bookingRejected) : null,
      vehicle: vehRes.status  === "fulfilled" ? toStats(vehRes.value.countsByStatus   as Record<string, number>, bookingOnApproval, bookingApproved, bookingRejected) : null,
      atk:    atkStats,
      maint:  maintRes.status === "fulfilled" ? toStats(maintRes.value.countsByStatus as Record<string, number>, bookingOnApproval, bookingApproved, bookingRejected) : null,
      arsip:  arsipRes.status === "fulfilled" ? toStats(arsipRes.value.countsByStatus as Record<string, number>, bookingOnApproval, bookingApproved, bookingRejected) : null,
      loading: false,
    });
  }, [isNonKpu]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const visibleTabs = ALL_TABS.filter((t) => !isKpu || !t.kpuHidden);

  return (
    <>
      {/* ── Tab bar — full-width 1 baris, responsive ── */}
      <div style={{ width: "100%", overflowX: "auto", marginBottom: 22 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
            gap: 8,
            width: "100%",
            minWidth: visibleTabs.length > 3 ? 720 : "auto",
          }}
        >
          {visibleTabs.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 10px",
                  borderRadius: 10,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all .15s",
                  width: "100%",
                  background: isActive ? "var(--gradient-primary)" : "var(--bg-surface)",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  border: isActive ? "none" : "1px solid var(--border-subtle)",
                  boxShadow: isActive ? "0 4px 14px rgba(20,80,201,0.3)" : "none",
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Keseluruhan ── */}
      {activeTab === "all" && <PaneAll stats={stats} isKpu={isKpu} />}

      {/* ── Ekspedisi ── */}
      {activeTab === "ekspedisi" && (
        <>
          <div className="stat-grid">
            <StatTile value={stats.ekspedisi?.completed ?? 0} label="Selesai" />
            <StatTile value={stats.ekspedisi?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.ekspedisi?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.ekspedisi?.completed ?? 0) + (stats.ekspedisi?.pending ?? 0) + (stats.ekspedisi?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <ModuleStatCard title="Ekspedisi" href="/ekspedisi/transaksi" stats={stats.ekspedisi} loading={stats.loading} />
        </>
      )}

      {/* ── Room Booking ── */}
      {activeTab === "room" && !isKpu && (
        <>
          <div className="stat-grid">
            <StatTile value={stats.room?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.room?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.room?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.room?.completed ?? 0) + (stats.room?.pending ?? 0) + (stats.room?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Room Booking" href="/booking-ruang-meeting/transaksi" stats={stats.room} loading={stats.loading} />
            <QuickLinks links={[
              { href: "/booking-ruang-meeting/calendar", label: "📅 Lihat Kalender Ruang Meeting →" },
              { href: "/booking-ruang-meeting/transaksi", label: "📋 Semua Transaksi →" },
              { href: "/booking-ruang-meeting/overview", label: "📊 Overview Permintaan Saya →" },
            ]} />
          </div>
        </>
      )}

      {/* ── Vehicle Booking ── */}
      {activeTab === "vehicle" && !isKpu && (
        <>
          <div className="stat-grid">
            <StatTile value={stats.vehicle?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.vehicle?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.vehicle?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.vehicle?.completed ?? 0) + (stats.vehicle?.pending ?? 0) + (stats.vehicle?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Vehicle Booking" href="/booking-kendaraan/transaksi" stats={stats.vehicle} loading={stats.loading} />
            <QuickLinks links={[
              { href: "/booking-kendaraan/calendar", label: "📅 Lihat Kalender Kendaraan →" },
              { href: "/booking-kendaraan/transaksi", label: "📋 Semua Transaksi →" },
              { href: "/booking-kendaraan/overview", label: "📊 Overview Permintaan Saya →" },
            ]} />
          </div>
        </>
      )}

      {/* ── Office Supplies ── */}
      {activeTab === "atk" && (
        <>
          <div className="stat-grid">
            <StatTile value={stats.atk?.completed ?? 0} label="Selesai" />
            <StatTile value={stats.atk?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.atk?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.atk?.completed ?? 0) + (stats.atk?.pending ?? 0) + (stats.atk?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Office Supplies" href="/office-supplies/transaksi" stats={stats.atk} loading={stats.loading} />
            <QuickLinks links={[
              { href: "/office-supplies/transaksi", label: "📋 Semua Transaksi →" },
              { href: "/office-supplies/overview", label: "📊 Overview Permintaan Saya →" },
            ]} />
          </div>
        </>
      )}

      {/* ── Maintenance ── */}
      {activeTab === "maint" && !isKpu && (
        <>
          <div className="stat-grid">
            <StatTile value={stats.maint?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.maint?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.maint?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.maint?.completed ?? 0) + (stats.maint?.pending ?? 0) + (stats.maint?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Maintenance" href="/maintenance/transaksi" stats={stats.maint} loading={stats.loading} />
            <QuickLinks links={[
              { href: "/maintenance/transaksi", label: "📋 Semua Transaksi →" },
              { href: "/maintenance/overview", label: "📊 Overview Permintaan Saya →" },
            ]} />
          </div>
        </>
      )}

      {/* ── Archive ── */}
      {activeTab === "arsip" && !isKpu && (
        <>
          <div className="stat-grid">
            <StatTile value={stats.arsip?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.arsip?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.arsip?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.arsip?.completed ?? 0) + (stats.arsip?.pending ?? 0) + (stats.arsip?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Archive" href="/arsip/transaksi" stats={stats.arsip} loading={stats.loading} />
            <QuickLinks links={[
              { href: "/arsip/transaksi", label: "📋 Semua Transaksi →" },
              { href: "/arsip/overview", label: "📊 Overview Permintaan Saya →" },
              { href: "/arsip/katalog", label: "📁 Repository Arsip →" },
            ]} />
          </div>
        </>
      )}
    </>
  );
}
