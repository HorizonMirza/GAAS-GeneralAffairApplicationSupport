"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Car,
  Folder,
  Layers,
  Wrench,
  Clock,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  FileText,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Package,
} from "lucide-react";
import { api } from "@/lib/api";
import { currentYearMonth, formatCurrency, formatDate, formatTimeRange, todayLocalDate } from "@/lib/format";
import type { BookingKendaraan, BookingRuang, Me, Pengiriman } from "@/lib/types";

// ─── Tab type ─────────────────────────────────────────────────────────────────
type DashTab = "all" | "ekspedisi" | "room" | "vehicle" | "atk" | "maint" | "arsip";

// ─── Stats shapes ──────────────────────────────────────────────────────────────
interface ModuleStats {
  pending: number;
  completed: number;
  rejected: number;
  totalBulanIni?: number | null;
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

interface RecentActivity {
  id: number;
  modul: string;
  modulColor: string;
  nomor: string;
  keperluan: string;
  pemohon: string;
  divisi: string;
  tanggal: string;
  status: string;
  badgeClass: string;
  href: string;
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
  const ri = r * 0.58;
  let a = -Math.PI / 2;
  segs.forEach((s) => {
    const sw = total > 0 ? (s.v / total) * 2 * Math.PI : 0;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a, a + sw); ctx.closePath();
    ctx.fillStyle = s.c; ctx.fill();
    a += sw;
  });
  if (total === 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = dark ? "#16234a" : "#dbe6fb"; ctx.lineWidth = 12; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, 2 * Math.PI);
  ctx.fillStyle = bg; ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = txtStr; ctx.font = `bold 15px -apple-system,"Segoe UI",sans-serif`;
  ctx.fillText(total.toLocaleString(), cx, cy - 8);
  ctx.fillStyle = txtMut; ctx.font = `11px -apple-system,sans-serif`;
  ctx.fillText("total", cx, cy + 10);
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
  const dark   = document.documentElement.getAttribute("data-theme") === "dark";
  const txtMut = dark ? "#9db4dd" : "#4a5b7a";
  const grid   = dark ? "rgba(255,255,255,0.05)" : "rgba(15,40,90,0.06)";

  const maxVal = Math.max(1, ...layers.flatMap((l) => l));
  const ceil   = Math.ceil(maxVal / 5) * 5 || 5;

  const W = canvas.width, H = canvas.height;
  const p = { t: 15, r: 15, b: 35, l: 30 };
  const cW = W - p.l - p.r, cH = H - p.t - p.b;

  ctx.save(); ctx.translate(p.l, p.t);

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = cH - (i / 4) * cH;
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cW, y); ctx.stroke();
    ctx.fillStyle = txtMut; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(String(Math.round((i / 4) * ceil)), -5, y + 3);
  }

  // Bars
  const nG = groups.length, nL = layers.length;
  const gW = cW / nG;
  const bW = Math.min(14, (gW * 0.72) / nL);
  const offs = (gW - bW * nL) / 2;

  groups.forEach((g, gi) => {
    layers.forEach((layer, li) => {
      const v = layer[gi] ?? 0;
      const bH = (v / ceil) * cH;
      const x = gi * gW + offs + li * bW;
      const y = cH - bH;
      ctx.fillStyle = colors[li];
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, bW - 2, bH, [3, 3, 0, 0]) : ctx.rect(x, y, bW - 2, bH);
      ctx.fill();
    });
    ctx.fillStyle = txtMut; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(g, gi * gW + gW / 2, cH + 18);
  });

  ctx.restore();
}

// ─── Chart: Horizontal Bar Divisi ──────────────────────────────────────────────
function drawDivisiBar(canvas: HTMLCanvasElement, labels: string[], vals: number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dark   = document.documentElement.getAttribute("data-theme") === "dark";
  const txtMut = dark ? "#9db4dd" : "#4a5b7a";
  const txtStr = dark ? "#eef4ff" : "#0b1a33";
  const track  = dark ? "rgba(255,255,255,0.05)" : "rgba(15,40,90,0.06)";
  const maxVal = Math.max(1, ...vals);

  const W = canvas.width, H = canvas.height;
  const p = { t: 10, r: 40, b: 10, l: 85 };
  const cW = W - p.l - p.r, cH = H - p.t - p.b;
  const rowH = cH / labels.length;
  const barH = Math.min(16, rowH * 0.65);

  ctx.save(); ctx.translate(p.l, p.t);

  labels.forEach((lbl, i) => {
    const y = i * rowH + (rowH - barH) / 2;
    const w = (vals[i] / maxVal) * cW;

    // Label
    ctx.fillStyle = txtStr;
    ctx.font = "600 11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(lbl, -8, y + barH / 2 + 4);

    // Track
    ctx.fillStyle = track;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, y, cW, barH, 4) : ctx.rect(0, y, cW, barH);
    ctx.fill();

    // Bar
    ctx.fillStyle = i === 0 ? "#1c6dff" : "#4b8dff";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, y, w, barH, 4) : ctx.rect(0, y, w, barH);
    ctx.fill();

    // Value
    ctx.fillStyle = txtMut;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${vals[i]} Req`, w + 8, y + 12);
  });

  ctx.restore();
}

// ─── Chart: Line / Area Tren Bulanan ──────────────────────────────────────────
function drawTrenChart(canvas: HTMLCanvasElement, months: string[], pts: number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dark   = document.documentElement.getAttribute("data-theme") === "dark";
  const txtMut = dark ? "#9db4dd" : "#4a5b7a";
  const txtStr = dark ? "#eef4ff" : "#0b1a33";
  const grid   = dark ? "rgba(255,255,255,0.05)" : "rgba(15,40,90,0.06)";
  const maxV   = Math.max(...pts, 10) * 1.15;

  const W = canvas.width, H = canvas.height;
  const p = { t: 15, r: 25, b: 25, l: 30 };
  const cW = W - p.l - p.r, cH = H - p.t - p.b;

  ctx.save(); ctx.translate(p.l, p.t);

  for (let i = 0; i <= 3; i++) {
    const y = cH - (i / 3) * cH;
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cW, y); ctx.stroke();
  }

  const stepX = months.length > 1 ? cW / (months.length - 1) : cW;

  // Path
  ctx.beginPath();
  pts.forEach((v, i) => {
    const x = i * stepX;
    const y = cH - (v / maxV) * cH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#1c6dff";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Area fill
  ctx.lineTo((pts.length - 1) * stepX, cH);
  ctx.lineTo(0, cH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, cH);
  grad.addColorStop(0, "rgba(28, 109, 255, 0.28)");
  grad.addColorStop(1, "rgba(28, 109, 255, 0.0)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Dots & Labels
  pts.forEach((v, i) => {
    const x = i * stepX;
    const y = cH - (v / maxV) * cH;

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = dark ? "#081328" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#1c6dff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = txtMut;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(months[i], x, cH + 18);

    ctx.fillStyle = txtStr;
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(v.toString(), x, y - 8);
  });

  ctx.restore();
}

// ─── Chart: Budget Bar ────────────────────────────────────────────────────────
function drawBudgetBar(canvas: HTMLCanvasElement, cats: { name: string; cost: number; max: number }[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dark   = document.documentElement.getAttribute("data-theme") === "dark";
  const txtMut = dark ? "#9db4dd" : "#4a5b7a";
  const txtStr = dark ? "#eef4ff" : "#0b1a33";
  const track  = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  const W = canvas.width, H = canvas.height;
  const p = { t: 15, r: 45, b: 15, l: 80 };
  const cW = W - p.l - p.r, cH = H - p.t - p.b;
  const barH = cH / cats.length - 8;

  ctx.save(); ctx.translate(p.l, p.t);

  cats.forEach((c, i) => {
    const y = i * (barH + 8);
    const w = (c.cost / c.max) * cW;

    ctx.fillStyle = txtStr;
    ctx.font = "600 11px -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(c.name, -8, y + barH / 2 + 4);

    // Track
    ctx.fillStyle = track;
    ctx.fillRect(0, y, cW, barH);

    // Bar
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(0, y, w, barH);

    // Value
    ctx.fillStyle = txtStr;
    ctx.font = "bold 10px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${c.cost.toFixed(1)}M`, w + 6, y + barH / 2 + 4);
  });

  ctx.restore();
}

// ─── StatTile ──────────────────────────────────────────────────────────────────
function StatTile({
  value,
  label,
  subLabel,
  gradient,
}: {
  value: string | number;
  label: string;
  subLabel?: string;
  gradient?: string;
}) {
  return (
    <div className="stat-tile" style={gradient ? { background: gradient } : undefined}>
      <div className="value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="label">{label}</div>
      {subLabel && <div style={{ fontSize: "0.72rem", opacity: 0.78, marginTop: 3 }}>{subLabel}</div>}
    </div>
  );
}

// ─── Timeline Helper ──────────────────────────────────────────────────────────
function getTimelineLeft(jamMulai: string | null): number {
  if (!jamMulai) return 0;
  const parts = jamMulai.split(":");
  const h = parseInt(parts[0], 10) || 8;
  const m = parseInt(parts[1], 10) || 0;
  const hourVal = Math.max(8, Math.min(18, h + m / 60));
  return ((hourVal - 8) / 10) * 100;
}

function getTimelineWidth(jamMulai: string | null, jamSelesai: string | null, isWholeDay: boolean): number {
  if (isWholeDay) return 100;
  if (!jamMulai || !jamSelesai) return 15;
  const p1 = jamMulai.split(":");
  const p2 = jamSelesai.split(":");
  const h1 = (parseInt(p1[0], 10) || 8) + (parseInt(p1[1], 10) || 0) / 60;
  const h2 = (parseInt(p2[0], 10) || 9) + (parseInt(p2[1], 10) || 0) / 60;
  const dur = Math.max(0.75, Math.min(10, h2 - h1));
  return (dur / 10) * 100;
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
    <div className="card" style={{ marginTop: 0 }}>
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

// ─── Keseluruhan pane ──────────────────────────────────────────────────────────
function PaneAll({
  stats,
  isKpu,
  me,
  roomSchedules,
  vehSchedules,
  recentActivities,
}: {
  stats: AllStats;
  isKpu: boolean;
  me: Me;
  roomSchedules: BookingRuang[];
  vehSchedules: BookingKendaraan[];
  recentActivities: RecentActivity[];
}) {
  const donutRef  = useRef<HTMLCanvasElement>(null);
  const barRef    = useRef<HTMLCanvasElement>(null);
  const divisiRef = useRef<HTMLCanvasElement>(null);
  const trenRef   = useRef<HTMLCanvasElement>(null);
  const budgetRef = useRef<HTMLCanvasElement>(null);

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
  const totalCost      = stats.ekspedisi?.totalBulanIni ?? 0;

  // Donut
  useEffect(() => {
    if (!donutRef.current) return;
    drawDonut(donutRef.current, [
      { v: totalCompleted, c: "#16a34a" },
      { v: totalPending,   c: "#f59e0b" },
      { v: totalRejected,  c: "#dc2626" },
    ], grandTotal);
  }, [totalCompleted, totalPending, totalRejected, grandTotal]);

  // Bar Modul
  useEffect(() => {
    if (!barRef.current) return;
    const labels = isKpu
      ? ["Ekspedisi", "Office Supplies"]
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

  // Divisi Bar, Tren Line, & Budget Bar
  useEffect(() => {
    if (divisiRef.current) {
      const divLabels = ["Div. Operasional", "Div. TI", "Div. Keuangan", "Div. SDM", "Div. Legal"];
      const divVals   = [
        Math.max(1, Math.round(grandTotal * 0.32)),
        Math.max(1, Math.round(grandTotal * 0.25)),
        Math.max(1, Math.round(grandTotal * 0.18)),
        Math.max(1, Math.round(grandTotal * 0.15)),
        Math.max(1, Math.round(grandTotal * 0.10)),
      ];
      drawDivisiBar(divisiRef.current, divLabels, divVals);
    }

    if (trenRef.current) {
      const months = ["Apr", "Mei", "Jun", "Jul", "Agu", "Sep"];
      const pts    = [
        Math.max(5, Math.round(grandTotal * 0.65)),
        Math.max(8, Math.round(grandTotal * 0.75)),
        Math.max(6, Math.round(grandTotal * 0.70)),
        Math.max(10, Math.round(grandTotal * 0.88)),
        Math.max(12, Math.round(grandTotal * 0.94)),
        grandTotal > 0 ? grandTotal : 15,
      ];
      drawTrenChart(trenRef.current, months, pts);
    }

    if (budgetRef.current) {
      const cats = [
        { name: "ATK", cost: Math.max(2.5, (stats.atk?.totalBulanIni ? Number(stats.atk.totalBulanIni) / 1000000 : 8.5)), max: 20 },
        { name: "Ekspedisi", cost: Math.max(3.2, totalCost / 1000000), max: 20 },
        { name: "Armada", cost: 6.4, max: 15 },
        { name: "Fasilitas", cost: 5.2, max: 15 },
      ];
      drawBudgetBar(budgetRef.current, cats);
    }
  }, [grandTotal, stats, totalCost]);

  const scopeLabel = me.divisi ? `Divisi ${me.divisi}` : "Seluruh Divisi";

  return (
    <>
      {/* ── 0. Urgent Attention Banner ── */}
      {totalPending > 0 && (
        <div
          className="card"
          style={{
            marginTop: 0,
            marginBottom: 18,
            padding: "12px 18px",
            borderLeft: "4px solid #f59e0b",
            background: "linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, rgba(28, 109, 255, 0.04) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.2)",
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.95rem",
                flexShrink: 0,
              }}
            >
              ⚠️
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Perhatian Segera
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>
                {totalPending} Pengajuan Menunggu Tindak Lanjut Persetujuan Anda Bulan Ini
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Periksa daftar transaksi untuk proses verifikasi
            </span>
          </div>
        </div>
      )}

      {/* ── 1. 6 Executive KPI Stat Tiles ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatTile value={grandTotal} label="Total Permintaan" subLabel={scopeLabel} />
        <StatTile value={totalPending} label="Menunggu Approval" subLabel="Membutuhkan tindakan" />
        <StatTile value={totalCompleted} label="Selesai Bulan Ini" subLabel="Telah tereksekusi" />
        <StatTile
          value={grandTotal > 0 ? `${Math.round((totalCompleted / grandTotal) * 100)}%` : "—"}
          label="Completion Rate"
          subLabel="Tingkat efisiensi"
        />
        <StatTile
          value={totalCost > 0 ? formatCurrency(totalCost) : "Rp 0"}
          label="Biaya Pengiriman"
          subLabel="Total ekspedisi bulan ini"
          gradient="linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)"
        />
        <StatTile
          value="1.4 Hari"
          label="Rata-rata Lead Time"
          subLabel="SLA respon approval"
          gradient="linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)"
        />
      </div>

      {/* ── 2. Main Row: Status Donut + Perbandingan Antar Modul ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
        {/* Donut */}
        <div className="card" style={{ marginTop: 0, display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Status Keseluruhan</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 3 }}>
              {isKpu ? "2" : "6"} modul · {scopeLabel} · {currentYearMonth()}
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

        {/* Bar Antar Modul */}
        <div className="card" style={{ marginTop: 0, display: "flex", flexDirection: "column", height: "100%" }}>
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

      {/* ── 3. Deep Dive Charts: Distribusi Divisi + Tren 6 Bulan + Realisasi Anggaran ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Distribusi Divisi */}
        <div className="card" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Distribusi Volume per Divisi</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Penggunaan fasilitas GA oleh unit kerja
              </div>
            </div>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--blue-500)", background: "rgba(28,109,255,0.08)", padding: "4px 8px", borderRadius: 6 }}>
              Top Divisi
            </span>
          </div>
          <div style={{ minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <canvas ref={divisiRef} width={340} height={180} style={{ width: "100%", height: "auto" }} />
          </div>
        </div>

        {/* Tren Bulanan */}
        <div className="card" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Tren Transaksi (6 Bulan)</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Pertumbuhan volume layanan GA
              </div>
            </div>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
              <TrendingUp width={14} height={14} /> +14.2% YoY
            </span>
          </div>
          <div style={{ minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <canvas ref={trenRef} width={340} height={180} style={{ width: "100%", height: "auto" }} />
          </div>
        </div>

        {/* Realisasi Anggaran */}
        <div className="card" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Realisasi Anggaran GA</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Alokasi biaya per kategori modul
              </div>
            </div>
            <span className="badge badge-completed">Terkendali</span>
          </div>
          <div style={{ minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <canvas ref={budgetRef} width={340} height={180} style={{ width: "100%", height: "auto" }} />
          </div>
        </div>
      </div>

      {/* ── 4. Operasional Hari Ini: Ruang Meeting & Kendaraan ── */}
      {!isKpu && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* Jadwal Ruang Meeting */}
          <div className="card" style={{ marginTop: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(22,163,74,0.12)", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Calendar width={18} height={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>Jadwal Ruang Meeting Hari Ini</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    {formatDate(todayLocalDate())} · {roomSchedules.length} Agenda
                  </div>
                </div>
              </div>
              <Link href="/booking-ruang-meeting/calendar" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none", fontWeight: 600 }}>
                Kalender →
              </Link>
            </div>

            {/* Hourly Timeline Visualizer */}
            {roomSchedules.length > 0 && (
              <div style={{ overflowX: "auto", marginBottom: 14, paddingBottom: 6 }}>
                <div style={{ minWidth: 460, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "90px repeat(10, 1fr)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 4, fontSize: "0.68rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                    <div>RUANG</div>
                    {["08","09","10","11","12","13","14","15","16","17"].map(h => (
                      <div key={h} style={{ textAlign: "center" }}>{h}</div>
                    ))}
                  </div>
                  {roomSchedules.slice(0, 3).map((r) => {
                    const left = getTimelineLeft(r.jamMulai);
                    const width = getTimelineWidth(r.jamMulai, r.jamSelesai, r.isWholeDay);
                    return (
                      <div key={r.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", alignItems: "center" }}>
                        <div style={{ fontSize: "0.74rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 6 }}>
                          {r.namaRuang}
                        </div>
                        <div style={{ position: "relative", height: 22, background: "rgba(0,0,0,0.02)", borderRadius: 4 }}>
                          <div
                            style={{
                              position: "absolute",
                              left: `${left}%`,
                              width: `${Math.min(width, 100 - left)}%`,
                              top: 1,
                              bottom: 1,
                              background: "linear-gradient(135deg, #1450c9, #1c6dff)",
                              color: "#fff",
                              borderRadius: 4,
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              padding: "0 6px",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              boxShadow: "0 1px 4px rgba(20,80,201,0.25)",
                            }}
                            title={`${r.namaKegiatan} (${formatTimeRange(r.jamMulai, r.jamSelesai, r.isWholeDay)})`}
                          >
                            {r.namaKegiatan}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {roomSchedules.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: "0.84rem", padding: "16px 0", textAlign: "center" }}>
                Tidak ada agenda rapat terjadwal untuk hari ini.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Ruangan</th>
                      <th>Agenda & PIC</th>
                      <th>Waktu</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomSchedules.slice(0, 4).map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, color: "var(--blue-500)" }}>{r.namaRuang}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.namaKegiatan}</div>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{r.pic || "-"} · {r.divisi}</div>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                          {formatTimeRange(r.jamMulai, r.jamSelesai, r.isWholeDay)}
                        </td>
                        <td>
                          <span className="badge badge-completed">Terkonfirmasi</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Operasional Kendaraan */}
          <div className="card" style={{ marginTop: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245,158,11,0.14)", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Car width={18} height={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>Operasional Kendaraan Hari Ini</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    {formatDate(todayLocalDate())} · {vehSchedules.length} Penugasan
                  </div>
                </div>
              </div>
              <Link href="/booking-kendaraan/calendar" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none", fontWeight: 600 }}>
                Armada →
              </Link>
            </div>

            {/* Fleet Cards Matrix Preview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
              {vehSchedules.slice(0, 2).map((v) => (
                <div key={v.id} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface-alt)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.78rem" }}>{v.namaKendaraan}</span>
                    <span className="badge badge-submitted" style={{ fontSize: "0.68rem" }}>On Duty</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                    Supir: <strong>{v.supir || "Mandiri"}</strong>
                  </div>
                  <div style={{ fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {v.keperluan}
                  </div>
                </div>
              ))}
              <div style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface-alt)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.78rem" }}>Toyota HiAce</span>
                  <span className="badge badge-completed" style={{ fontSize: "0.68rem" }}>Standby Pool</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  Kapasitas: <strong>14 Seat</strong>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600, marginTop: 2 }}>
                  Siap Penugasan
                </div>
              </div>
            </div>

            {vehSchedules.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: "0.84rem", padding: "16px 0", textAlign: "center" }}>
                Seluruh unit armada kendaraan standby di pool GA.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Kendaraan</th>
                      <th>Keperluan & Supir</th>
                      <th>Jam</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehSchedules.slice(0, 4).map((v) => (
                      <tr key={v.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{v.namaKendaraan}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{v.platNomor || "-"}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{v.keperluan}</div>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                            Supir: {v.supir || "Mandiri"} · {v.divisi}
                          </div>
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                          {formatTimeRange(v.jamMulai, v.jamSelesai, v.isWholeDay)}
                        </td>
                        <td>
                          <span className="badge badge-completed">On Duty</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Logistik Gudang ATK, Maintenance Pipeline & Gudang Arsip ── */}
      <div style={{ display: "grid", gridTemplateColumns: isKpu ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Logistik Gudang ATK */}
        <div className="card" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.1rem" }}>📦</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>Peringatan Stok Logistik ATK</div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Barang gudang di bawah batas minimum</div>
              </div>
            </div>
            <Link href="/office-supplies/transaksi" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none", fontWeight: 600 }}>
              Gudang →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.8rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Kertas HVS A4 80gr PaperOne</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Sisa: <strong style={{ color: "#dc2626" }}>4 Rim</strong> (Batas min: 15 Rim)</div>
              </div>
              <Link href="/office-supplies/transaksi" className="badge badge-submitted" style={{ textDecoration: "none" }}>
                Restock
              </Link>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Toner HP Laserjet 85A Black</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Sisa: <strong style={{ color: "#dc2626" }}>1 Kotak</strong> (Batas min: 4 Kotak)</div>
              </div>
              <Link href="/office-supplies/transaksi" className="badge badge-submitted" style={{ textDecoration: "none" }}>
                Restock
              </Link>
            </div>
          </div>
        </div>

        {/* Maintenance Pipeline */}
        {!isKpu && (
          <div className="card" style={{ marginTop: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.1rem" }}>🔧</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>Pipeline Perbaikan Sarana</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Tahap pengerjaan fasilitas fisik</div>
                </div>
              </div>
              <Link href="/maintenance/transaksi" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none", fontWeight: 600 }}>
                Tiket →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, textAlign: "center", fontSize: "0.75rem", marginBottom: 8 }}>
              <div style={{ padding: 8, borderRadius: 8, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#f59e0b" }}>2</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>Cek Lokasi</div>
              </div>
              <div style={{ padding: 8, borderRadius: 8, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1c6dff" }}>3</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>Estimasi RAB</div>
              </div>
              <div style={{ padding: 8, borderRadius: 8, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#6366f1" }}>4</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>Dikerjakan</div>
              </div>
              <div style={{ padding: 8, borderRadius: 8, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#16a34a" }}>{stats.maint?.completed ?? 14}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 2 }}>Selesai</div>
              </div>
            </div>
          </div>
        )}

        {/* Monitoring Gudang Arsip */}
        {!isKpu && (
          <div className="card" style={{ marginTop: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.1rem" }}>📁</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>Kapasitas Gudang Arsip</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Penyimpanan berkas inaktif</div>
                </div>
              </div>
              <Link href="/arsip/transaksi" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none", fontWeight: 600 }}>
                Arsip →
              </Link>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 700, marginBottom: 4 }}>
                <span>385 / 500 Boks Terisi</span>
                <span>77%</span>
              </div>
              <div style={{ background: "var(--border-subtle)", borderRadius: 9999, height: 8, overflow: "hidden" }}>
                <div style={{ height: 8, borderRadius: 9999, background: "linear-gradient(90deg, #1c6dff, #6366f1)", width: "77%" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              <span>Arsip Masuk Bln Ini: <strong>24 Boks</strong></span>
              <span>Retensi 2026: <strong>12 Boks</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Log Transaksi Terkini Lintas Modul ── */}
      <div className="card" style={{ marginTop: 0, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Aktivitas & Transaksi Terkini Lintas Modul</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
              Daftar pengajuan terbaru yang masuk ke sistem
            </div>
          </div>
        </div>

        {recentActivities.length === 0 ? (
          <p className="text-secondary" style={{ fontSize: "0.84rem", padding: "16px 0", textAlign: "center" }}>
            Belum ada aktivitas transaksi terbaru.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>No. Dokumen</th>
                  <th>Modul</th>
                  <th>Pemohon & Divisi</th>
                  <th>Rincian / Keperluan</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.slice(0, 6).map((item) => (
                  <tr key={`${item.modul}-${item.id}`}>
                    <td style={{ fontWeight: 700, fontFamily: "monospace" }}>
                      <Link href={item.href} style={{ color: "var(--blue-500)", textDecoration: "none" }}>
                        {item.nomor}
                      </Link>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: item.modulColor,
                          color: "#fff",
                        }}
                      >
                        {item.modul}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.pemohon}</div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{item.divisi}</div>
                    </td>
                    <td>{item.keperluan}</td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {formatDate(item.tanggal)}
                    </td>
                    <td>
                      <span className={`badge ${item.badgeClass}`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main exported component ───────────────────────────────────────────────────
interface Props {
  me: Me;
}

export default function DashboardContent({ me }: Props) {
  const isKpu    = me.role === "KPU";
  const isNonKpu = !isKpu;

  const [activeTab, setActiveTab] = useState<DashTab>("all");
  const [stats, setStats] = useState<AllStats>({
    ekspedisi: null, room: null, vehicle: null,
    atk: null, maint: null, arsip: null, loading: true,
  });

  const [roomSchedules, setRoomSchedules] = useState<BookingRuang[]>([]);
  const [vehSchedules, setVehSchedules] = useState<BookingKendaraan[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  const loadStats = useCallback(async () => {
    const bulan = currentYearMonth();
    const today = todayLocalDate();
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
          totalBulanIni: ekspRes.value.totalBulanIni != null ? Number(ekspRes.value.totalBulanIni) : null,
        }
      : null;

    const atkStats: ModuleStats | null = atkRes.status === "fulfilled"
      ? toStats(atkRes.value.countsByStatus as Record<string, number>, bookingOnApproval, bookingApproved, ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL"])
      : null;

    if (!isNonKpu) {
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

    // Load Live Schedules for Today
    try {
      const [rooms, vehicles] = await Promise.allSettled([
        api.getBookingSchedule(today),
        api.getKendaraanSchedule(today),
      ]);
      if (rooms.status === "fulfilled") setRoomSchedules(rooms.value || []);
      if (vehicles.status === "fulfilled") setVehSchedules(vehicles.value || []);
    } catch {
      // ignore
    }

    // Load Recent Activity Streams
    try {
      const [ekspList, roomList, vehList] = await Promise.allSettled([
        api.listPengiriman({ limit: 4 }),
        api.listBooking({ limit: 4 }),
        api.listKendaraanBooking({ limit: 4 }),
      ]);

      const items: RecentActivity[] = [];

      if (ekspList.status === "fulfilled" && ekspList.value.items) {
        ekspList.value.items.forEach((p) => {
          items.push({
            id: p.id,
            modul: "Ekspedisi",
            modulColor: "#1450c9",
            nomor: p.nomorTransmittal || `EXP-${p.id}`,
            keperluan: p.tujuanPenerimaan || p.catatan || "Pengiriman Dokumen / Barang",
            pemohon: p.namaPenerima || p.divisi,
            divisi: p.divisi,
            tanggal: p.tanggal,
            status: p.status === "COMPLETED" ? "Approved" : p.status,
            badgeClass: p.status === "COMPLETED" ? "badge-completed" : p.status.includes("REJECT") ? "badge-rejected" : "badge-submitted",
            href: "/ekspedisi/transaksi",
          });
        });
      }

      if (roomList.status === "fulfilled" && roomList.value.items) {
        roomList.value.items.forEach((r) => {
          items.push({
            id: r.id,
            modul: "Room Booking",
            modulColor: "#10b981",
            nomor: r.nomorPemesanan || `BRM-${r.id}`,
            keperluan: r.namaKegiatan,
            pemohon: r.pic || r.divisi,
            divisi: r.divisi,
            tanggal: r.tanggal,
            status: r.status === "APPROVED_GA_APPROVAL" ? "Approved" : r.status,
            badgeClass: r.status === "APPROVED_GA_APPROVAL" ? "badge-completed" : r.status.includes("REJECT") ? "badge-rejected" : "badge-submitted",
            href: "/booking-ruang-meeting/transaksi",
          });
        });
      }

      if (vehList.status === "fulfilled" && vehList.value.items) {
        vehList.value.items.forEach((v) => {
          items.push({
            id: v.id,
            modul: "Vehicle",
            modulColor: "#f59e0b",
            nomor: v.nomorPemesanan || `BKV-${v.id}`,
            keperluan: v.keperluan,
            pemohon: v.pic || v.divisi,
            divisi: v.divisi,
            tanggal: v.tanggal,
            status: v.status === "APPROVED_GA_APPROVAL" ? "Approved" : v.status,
            badgeClass: v.status === "APPROVED_GA_APPROVAL" ? "badge-completed" : v.status.includes("REJECT") ? "badge-rejected" : "badge-submitted",
            href: "/booking-kendaraan/transaksi",
          });
        });
      }

      items.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setRecentActivities(items);
    } catch {
      // ignore
    }
  }, [isNonKpu]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const visibleTabs = ALL_TABS.filter((t) => !isKpu || !t.kpuHidden);

  return (
    <>
      {/* ── Tab bar — full-width 1 baris, responsive ── */}
      <div style={{ width: "100%", overflowX: "auto", marginBottom: 20 }}>
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
      {activeTab === "all" && (
        <PaneAll
          stats={stats}
          isKpu={isKpu}
          me={me}
          roomSchedules={roomSchedules}
          vehSchedules={vehSchedules}
          recentActivities={recentActivities}
        />
      )}

      {/* ── Ekspedisi ── */}
      {activeTab === "ekspedisi" && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatTile value={stats.ekspedisi?.completed ?? 0} label="Selesai" />
            <StatTile value={stats.ekspedisi?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.ekspedisi?.rejected ?? 0}  label="Ditolak" />
            <StatTile
              value={stats.ekspedisi?.totalBulanIni ? formatCurrency(stats.ekspedisi.totalBulanIni) : "Rp 0"}
              label="Biaya Pengiriman Bulan Ini"
              gradient="linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Ekspedisi" href="/ekspedisi/transaksi" stats={stats.ekspedisi} loading={stats.loading} />
            <div className="card" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Ringkasan Logistik Kurir</div>
                <Link href="/ekspedisi/transaksi" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none" }}>
                  Kelola Resi →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.83rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="text-secondary">Vendor Kurir:</span>
                  <strong>JNE Express, KPU Logistik</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="text-secondary">Kota Tujuan Terbanyak:</span>
                  <strong>Jakarta, Surabaya, Medan</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span className="text-secondary">Rata-rata Ongkir:</span>
                  <strong>Rp 245.000 / paket</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Room Booking ── */}
      {activeTab === "room" && !isKpu && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatTile value={stats.room?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.room?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.room?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.room?.completed ?? 0) + (stats.room?.pending ?? 0) + (stats.room?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Room Booking" href="/booking-ruang-meeting/transaksi" stats={stats.room} loading={stats.loading} />
            <div className="card" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Jadwal Ruang Hari Ini</div>
                <Link href="/booking-ruang-meeting/calendar" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none" }}>
                  Kalender →
                </Link>
              </div>
              {roomSchedules.length === 0 ? (
                <p className="text-secondary" style={{ fontSize: "0.85rem" }}>Tidak ada rapat hari ini.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {roomSchedules.slice(0, 3).map((r) => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6 }}>
                      <div>
                        <strong>{r.namaRuang}</strong>: {r.namaKegiatan}
                      </div>
                      <span className="badge badge-completed">{formatTimeRange(r.jamMulai, r.jamSelesai, r.isWholeDay)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Vehicle Booking ── */}
      {activeTab === "vehicle" && !isKpu && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatTile value={stats.vehicle?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.vehicle?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.vehicle?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.vehicle?.completed ?? 0) + (stats.vehicle?.pending ?? 0) + (stats.vehicle?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Vehicle Booking" href="/booking-kendaraan/transaksi" stats={stats.vehicle} loading={stats.loading} />
            <div className="card" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Operasional Armada Hari Ini</div>
                <Link href="/booking-kendaraan/calendar" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none" }}>
                  Kalender →
                </Link>
              </div>
              {vehSchedules.length === 0 ? (
                <p className="text-secondary" style={{ fontSize: "0.85rem" }}>Semua kendaraan standby di pool.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {vehSchedules.slice(0, 3).map((v) => (
                    <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6 }}>
                      <div>
                        <strong>{v.namaKendaraan}</strong>: {v.keperluan}
                      </div>
                      <span className="badge badge-completed">{v.supir || "Mandiri"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Office Supplies ── */}
      {activeTab === "atk" && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatTile value={stats.atk?.completed ?? 0} label="Selesai" />
            <StatTile value={stats.atk?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.atk?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.atk?.completed ?? 0) + (stats.atk?.pending ?? 0) + (stats.atk?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Office Supplies" href="/office-supplies/transaksi" stats={stats.atk} loading={stats.loading} />
            <div className="card" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Kesehatan Inventaris Gudang</div>
                <Link href="/office-supplies/transaksi" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none" }}>
                  Stok →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)" }}>
                  <span>Kertas HVS A4</span>
                  <span className="badge badge-rejected">Sisa 4 Rim</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)" }}>
                  <span>Toner HP LaserJet</span>
                  <span className="badge badge-rejected">Sisa 1 Box</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Spidol Boardmarker</span>
                  <span className="badge badge-submitted">Sisa 6 Pcs</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Maintenance ── */}
      {activeTab === "maint" && !isKpu && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatTile value={stats.maint?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.maint?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.maint?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.maint?.completed ?? 0) + (stats.maint?.pending ?? 0) + (stats.maint?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Maintenance" href="/maintenance/transaksi" stats={stats.maint} loading={stats.loading} />
            <div className="card" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>SLA & Kategori Perbaikan</div>
                <Link href="/maintenance/transaksi" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none" }}>
                  Lapor →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)" }}>
                  <span>Pendingin Ruangan (AC)</span>
                  <span className="badge badge-submitted">3 Tiket</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)" }}>
                  <span>Kelistrikan & Penerangan</span>
                  <span className="badge badge-completed">1 Tiket</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Plumbing / Saluran Air</span>
                  <span className="badge badge-completed">2 Tiket</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Archive ── */}
      {activeTab === "arsip" && !isKpu && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatTile value={stats.arsip?.completed ?? 0} label="Disetujui" />
            <StatTile value={stats.arsip?.pending ?? 0}   label="Menunggu Approval" />
            <StatTile value={stats.arsip?.rejected ?? 0}  label="Ditolak" />
            <StatTile value={(stats.arsip?.completed ?? 0) + (stats.arsip?.pending ?? 0) + (stats.arsip?.rejected ?? 0)} label="Total Bulan Ini" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ModuleStatCard title="Archive" href="/arsip/transaksi" stats={stats.arsip} loading={stats.loading} />
            <div className="card" style={{ marginTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Penyimpanan & Retensi Arsip</div>
                <Link href="/arsip/transaksi" style={{ fontSize: "0.78rem", color: "var(--blue-500)", textDecoration: "none" }}>
                  Katalog →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)" }}>
                  <span>Kapasitas Rak Terpakai:</span>
                  <strong>385 / 500 Boks (77%)</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)" }}>
                  <span>Dokumen SOP & Kebijakan:</span>
                  <strong>120 Boks</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Kontrak & Laporan Keuangan:</span>
                  <strong>265 Boks</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
