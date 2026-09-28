"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Clock3,
  FileText,
  Folder,
  Layers,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MonthFilterPicker from "@/components/MonthFilterPicker";
import SearchableSelect from "@/components/SearchableSelect";
import { api } from "@/lib/api";
import { BOOKING_STATUS_LABEL, ROLE_LABEL_FULL, STATUS_LABEL } from "@/lib/constants";
import { currentYearMonth, formatTimeRange, todayLocalDate } from "@/lib/format";
import type {
  BookingKendaraan,
  BookingRuang,
  BookingStatus,
  Me,
  OrgStructure,
  Pengiriman,
  PerbaikanSarana,
  PermintaanArsip,
  PermintaanAtk,
  Role,
  Status,
  SumberPembelian,
} from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import styles from "./DashboardContent.module.css";

type ModuleKey = "expedition" | "room" | "vehicle" | "atk" | "maintenance" | "archive";
type DashboardStatusFilter =
  | "SUBMITTED"
  | "APPROVED_L1"
  | "APPROVED_GA"
  | "APPROVED_GA_APPROVAL"
  | "REJECTED"
  | "ON_APPROVAL";
type SourceItem = Pengiriman | BookingRuang | BookingKendaraan | PermintaanAtk | PerbaikanSarana | PermintaanArsip;
type ScheduleTab = "all" | "room" | "vehicle";

interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  Icon: LucideIcon;
  overviewHref: string;
  transactionHref: string;
  hiddenForKpu?: boolean;
}

interface CommonListParams {
  page?: number;
  limit?: number;
  bulan?: string;
  direktorat?: string;
  divisi?: string;
  departemen?: string;
  status?: DashboardStatusFilter;
  sumberPembelian?: SumberPembelian;
}

interface CommonListResult {
  items: SourceItem[];
  total: number;
}

interface CommonStatsResult {
  countsByStatus: Partial<Record<string, number>>;
}

interface ModuleSource {
  stats: (bulan?: string, divisi?: string, direktorat?: string, departemen?: string) => Promise<CommonStatsResult>;
  list: (params: CommonListParams) => Promise<CommonListResult>;
}

interface ModuleSummary {
  total: number;
  pending: number;
  completed: number;
  rejected: number;
  actionable: number;
  failed: boolean;
}

interface DashboardItem {
  id: number;
  moduleKey: ModuleKey;
  moduleLabel: string;
  number: string;
  title: string;
  requester: string;
  unit: string;
  status: Status | BookingStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  ageMilliseconds: number;
  href: string;
}

interface ScheduleItem {
  id: string;
  kind: Exclude<ScheduleTab, "all">;
  time: string;
  title: string;
  detail: string;
  resource: string;
}

interface DashboardState {
  summaries: Record<ModuleKey, ModuleSummary>;
  queue: DashboardItem[];
  recent: DashboardItem[];
  schedules: ScheduleItem[];
  errors: number;
}

const MODULES: ModuleDefinition[] = [
  { key: "expedition", label: "Expedition", Icon: Layers, overviewHref: "/ekspedisi/overview", transactionHref: "/ekspedisi/transaksi" },
  { key: "room", label: "Room Booking", Icon: Calendar, overviewHref: "/booking-ruang-meeting/overview", transactionHref: "/booking-ruang-meeting/transaksi", hiddenForKpu: true },
  { key: "vehicle", label: "Vehicle Booking", Icon: Car, overviewHref: "/booking-kendaraan/overview", transactionHref: "/booking-kendaraan/transaksi", hiddenForKpu: true },
  { key: "atk", label: "Office Supplies", Icon: Pencil, overviewHref: "/office-supplies/overview", transactionHref: "/office-supplies/transaksi" },
  { key: "maintenance", label: "Maintenance", Icon: Wrench, overviewHref: "/maintenance/overview", transactionHref: "/maintenance/transaksi", hiddenForKpu: true },
  { key: "archive", label: "Archive", Icon: Folder, overviewHref: "/arsip/overview", transactionHref: "/arsip/transaksi", hiddenForKpu: true },
];

const EMPTY_SUMMARY: ModuleSummary = { total: 0, pending: 0, completed: 0, rejected: 0, actionable: 0, failed: false };

function emptySummaries(): Record<ModuleKey, ModuleSummary> {
  return {
    expedition: { ...EMPTY_SUMMARY }, room: { ...EMPTY_SUMMARY }, vehicle: { ...EMPTY_SUMMARY },
    atk: { ...EMPTY_SUMMARY }, maintenance: { ...EMPTY_SUMMARY }, archive: { ...EMPTY_SUMMARY },
  };
}

const MODULE_SOURCES: Record<ModuleKey, ModuleSource> = {
  expedition: {
    stats: async (bulan, divisi, direktorat, departemen) => {
      const result = await api.getPengirimanStats(bulan, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listPengiriman(params),
  },
  room: {
    stats: async (bulan, divisi, direktorat, departemen) => {
      const result = await api.getBookingStats(bulan, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listBooking(params),
  },
  vehicle: {
    stats: async (bulan, divisi, direktorat, departemen) => {
      const result = await api.getKendaraanStats(bulan, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listKendaraanBooking(params),
  },
  atk: {
    stats: async (bulan, divisi, direktorat, departemen) => {
      const result = await api.getAtkStats(bulan, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listAtk(params),
  },
  maintenance: {
    stats: async (bulan, divisi, direktorat, departemen) => {
      const result = await api.getSaranaStats(bulan, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listSarana(params),
  },
  archive: {
    stats: async (bulan, divisi, direktorat, departemen) => {
      const result = await api.getArsipStats(bulan, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listArsip(params),
  },
};

function getActionFilter(role: Role): DashboardStatusFilter {
  if (role === "APPROVAL_DEPARTEMEN" || role === "APPROVAL_DIVISI") return "SUBMITTED";
  if (role === "ADMIN_GA") return "APPROVED_L1";
  if (role === "APPROVAL_GA") return "APPROVED_GA";
  if (role === "KPU") return "APPROVED_GA_APPROVAL";
  if (role === "SUPER_ADMIN") return "ON_APPROVAL";
  return "REJECTED";
}

function sumStatuses(counts: Partial<Record<string, number>>, statuses: string[]): number {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
}

function summarizeModule(key: ModuleKey, counts: Partial<Record<string, number>>): Omit<ModuleSummary, "actionable" | "failed"> {
  const isFourTier = key === "expedition" || key === "atk";
  const pendingStatuses = isFourTier
    ? ["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"]
    : ["SUBMITTED", "APPROVED_L1", "APPROVED_GA"];
  const completedStatus = isFourTier ? "COMPLETED" : "APPROVED_GA_APPROVAL";
  const rejectedStatuses = isFourTier
    ? ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL", "REJECTED_KPU"]
    : ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL", "CANCELLED"];
  return {
    total: Object.values(counts).reduce<number>((total, count) => total + (count ?? 0), 0),
    pending: sumStatuses(counts, pendingStatuses),
    completed: counts[completedStatus] ?? 0,
    rejected: sumStatuses(counts, rejectedStatuses),
  };
}

function isOriginAdmin(role: Role): boolean {
  return role === "ADMIN_DEPARTEMEN" || role === "ADMIN_DIVISI";
}

function isOriginCorrection(moduleKey: ModuleKey, item: SourceItem, me: Me): boolean {
  if (!isOriginAdmin(me.role) || item.createdBy !== me.id || !item.status.includes("REJECTED")) return false;
  // Rejected Room/Vehicle bookings are terminal and cannot be revised or resubmitted.
  if (moduleKey === "room" || moduleKey === "vehicle") return false;
  if ("rejectTarget" in item && (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU")) {
    return item.rejectTarget === "ORIGIN";
  }
  return true;
}

function adaptItem(module: ModuleDefinition, item: SourceItem): DashboardItem {
  const base = {
    id: item.id, moduleKey: module.key, moduleLabel: module.label, status: item.status,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
    ageMilliseconds: Math.max(0, Date.now() - new Date(item.updatedAt).getTime()),
    href: module.transactionHref,
    unit: item.departemen ? `${item.divisi} / ${item.departemen}` : item.divisi,
  };
  switch (module.key) {
    case "expedition": {
      const value = item as Pengiriman;
      return { ...base, number: value.nomorTransmittal || value.noResi || `EXP-${value.id}`, title: value.tujuanPenerimaan || value.catatan || "Pengiriman barang atau dokumen", requester: value.namaPengirim, statusLabel: STATUS_LABEL[value.status] };
    }
    case "room": {
      const value = item as BookingRuang;
      return { ...base, number: value.nomorPemesanan || `ROOM-${value.id}`, title: value.namaKegiatan, requester: value.pic || value.divisi, statusLabel: BOOKING_STATUS_LABEL[value.status] };
    }
    case "vehicle": {
      const value = item as BookingKendaraan;
      return { ...base, number: value.nomorPemesanan || `VEH-${value.id}`, title: value.keperluan, requester: value.pic || value.divisi, statusLabel: BOOKING_STATUS_LABEL[value.status] };
    }
    case "atk": {
      const value = item as PermintaanAtk;
      return { ...base, number: value.nomorPermintaan || `ATK-${value.id}`, title: value.keperluan, requester: value.namaPemohon, statusLabel: STATUS_LABEL[value.status] };
    }
    case "maintenance": {
      const value = item as PerbaikanSarana;
      return { ...base, number: value.nomorPerbaikan || `MNT-${value.id}`, title: value.deskripsiKerusakan, requester: value.namaPelapor, statusLabel: BOOKING_STATUS_LABEL[value.status] };
    }
    case "archive": {
      const value = item as PermintaanArsip;
      return { ...base, number: value.nomorArsip || `ARC-${value.id}`, title: value.namaArsip, requester: value.namaPic || value.divisi, statusLabel: BOOKING_STATUS_LABEL[value.status] };
    }
  }
}

function scopeFromUnit(value: string): Pick<CommonListParams, "direktorat" | "divisi" | "departemen"> {
  if (!value) return {};
  const separator = value.indexOf("|");
  if (separator < 0) return {};
  const type = value.slice(0, separator);
  const name = value.slice(separator + 1);
  if (type === "DIREKTORAT") return { direktorat: name };
  if (type === "DIVISI") return { divisi: name };
  if (type === "DEPARTEMEN") return { departemen: name };
  return {};
}

function unitLabel(value: string): string {
  const separator = value.indexOf("|");
  if (separator < 0) return value;
  const type = value.slice(0, separator);
  const name = value.slice(separator + 1);
  const labels: Record<string, string> = { DIREKTORAT: "Direktorat", DIVISI: "Divisi", DEPARTEMEN: "Departemen" };
  return `${labels[type] ?? type} - ${name}`;
}

function roleCopy(role: Role): string {
  if (role === "ADMIN_GA" || role === "APPROVAL_GA") return "Pantau antrean persetujuan dan operasi General Affair hari ini.";
  if (role === "APPROVAL_DEPARTEMEN" || role === "APPROVAL_DIVISI") return "Prioritaskan permohonan yang menunggu persetujuan Anda.";
  if (role === "KPU") return "Pantau permintaan mitra yang menunggu tindak lanjut.";
  if (role === "SUPER_ADMIN") return "Pantau kondisi operasional seluruh modul GAAS.";
  return "Pantau progres pengajuan dan layanan General Affair Anda.";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function relativeAge(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

function statusTone(status: Status | BookingStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "COMPLETED" || status === "APPROVED_GA_APPROVAL") return "success";
  if (status.includes("REJECTED") || status === "CANCELLED") return "danger";
  if (status === "DRAFT") return "neutral";
  return "warning";
}

function scheduleTimeValue(time: string): number {
  if (time === "Sepanjang Hari") return 0;
  const match = /^(\d{2}):(\d{2})/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

function KpiCard({ label, value, helper, Icon, tone }: {
  label: string; value: number; helper: string; Icon: LucideIcon; tone: "primary" | "warning" | "success" | "danger";
}) {
  return (
    <div className={styles.kpiCard}>
      <div><span className={styles.kpiLabel}>{label}</span><strong className={styles.kpiValue}>{value.toLocaleString("id-ID")}</strong></div>
      <span className={`${styles.kpiIcon} ${styles[tone]}`}><Icon aria-hidden="true" /></span>
      <span className={styles.kpiHelper}>{helper}</span>
    </div>
  );
}

export default function DashboardContent({ me }: { me: Me }) {
  const [month, setMonth] = useState(currentYearMonth());
  const [unit, setUnit] = useState("");
  const [org, setOrg] = useState<OrgStructure | null>(null);
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("all");
  const [quickOpen, setQuickOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<DashboardState>({ summaries: emptySummaries(), queue: [], recent: [], schedules: [], errors: 0 });
  const quickRef = useRef<HTMLDivElement>(null);
  useClickOutside([quickRef], () => setQuickOpen(false), quickOpen);

  const visibleModules = useMemo(() => MODULES.filter((module) => me.role !== "KPU" || !module.hiddenForKpu), [me.role]);
  const unitOptions = useMemo(() => {
    if (!org) return [];
    return [
      ...org.direktorat.map((name) => `DIREKTORAT|${name}`),
      ...org.divisi.map((name) => `DIVISI|${name}`),
      ...org.departemen.map((name) => `DEPARTEMEN|${name}`),
    ];
  }, [org]);

  useEffect(() => { api.orgStructure().then(setOrg).catch(() => setOrg(null)); }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const unitScope = scopeFromUnit(unit);
    const scope: CommonListParams = { page: 1, bulan: month || undefined, ...unitScope };
    const actionFilter = getActionFilter(me.role);

    const moduleTasks = visibleModules.map(async (module) => {
      const source = MODULE_SOURCES[module.key];
      const queueParams: CommonListParams = {
        ...scope,
        limit: isOriginAdmin(me.role) ? 50 : 10,
        status: actionFilter,
        ...(me.role === "KPU" && module.key === "atk" ? { sumberPembelian: "KPU" as const } : {}),
      };
      const [statsResult, queueResult, recentResult] = await Promise.allSettled([
        source.stats(month || undefined, unitScope.divisi, unitScope.direktorat, unitScope.departemen),
        source.list(queueParams),
        source.list({ ...scope, limit: 5 }),
      ]);
      const stats = statsResult.status === "fulfilled"
        ? summarizeModule(module.key, statsResult.value.countsByStatus)
        : { total: 0, pending: 0, completed: 0, rejected: 0 };
      const rawQueue = queueResult.status === "fulfilled" ? queueResult.value.items : [];
      const filteredQueue = isOriginAdmin(me.role) ? rawQueue.filter((item) => isOriginCorrection(module.key, item, me)) : rawQueue;
      const actionCount = isOriginAdmin(me.role)
        ? filteredQueue.length
        : queueResult.status === "fulfilled" ? queueResult.value.total : 0;
      return {
        module,
        summary: { ...stats, actionable: actionCount, failed: statsResult.status === "rejected" } satisfies ModuleSummary,
        queue: filteredQueue.map((item) => adaptItem(module, item)),
        recent: recentResult.status === "fulfilled" ? recentResult.value.items.map((item) => adaptItem(module, item)) : [],
        errors: [statsResult, queueResult, recentResult].filter((result) => result.status === "rejected").length,
      };
    });

    const schedulePromise = me.role === "KPU"
      ? Promise.resolve({ rooms: [] as BookingRuang[], vehicles: [] as BookingKendaraan[], errors: 0 })
      : Promise.allSettled([api.getBookingSchedule(todayLocalDate()), api.getKendaraanSchedule(todayLocalDate())])
        .then(([rooms, vehicles]) => ({
          rooms: rooms.status === "fulfilled" ? rooms.value : [],
          vehicles: vehicles.status === "fulfilled" ? vehicles.value : [],
          errors: Number(rooms.status === "rejected") + Number(vehicles.status === "rejected"),
        }));

    const [moduleResults, scheduleResult] = await Promise.all([Promise.all(moduleTasks), schedulePromise]);
    const summaries = emptySummaries();
    const queue: DashboardItem[] = [];
    const recent: DashboardItem[] = [];
    let errors = scheduleResult.errors;
    moduleResults.forEach((result) => {
      summaries[result.module.key] = result.summary;
      queue.push(...result.queue);
      recent.push(...result.recent);
      errors += result.errors;
    });

    const selectedDirektoratDivisions = unitScope.direktorat
      ? org?.direktoratTree.find((node) => node.nama === unitScope.direktorat)?.divisi.map((node) => node.nama) ?? []
      : [];
    const matchesUnit = (item: { divisi: string; departemen: string | null }) => {
      if (unitScope.direktorat && !selectedDirektoratDivisions.includes(item.divisi)) return false;
      if (unitScope.divisi && item.divisi !== unitScope.divisi) return false;
      if (unitScope.departemen && item.departemen !== unitScope.departemen) return false;
      return true;
    };
    const rooms = scheduleResult.rooms.filter(matchesUnit).map<ScheduleItem>((item) => ({
      id: `room-${item.id}`, kind: "room", time: formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay),
      title: item.namaKegiatan, detail: `${item.jumlahPeserta} peserta${item.pic ? ` · PIC ${item.pic}` : ""}`,
      resource: [item.namaRuang, ...item.additionalRooms].join(", "),
    }));
    const vehicles = scheduleResult.vehicles.filter(matchesUnit).map<ScheduleItem>((item) => ({
      id: `vehicle-${item.id}`, kind: "vehicle", time: formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay),
      title: item.keperluan, detail: `${item.jumlahPenumpang} penumpang${item.supir ? ` · ${item.supir}` : ""}`,
      resource: item.namaKendaraan,
    }));
    queue.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    recent.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setState({
      summaries,
      queue: queue.slice(0, 8),
      recent: recent.slice(0, 5),
      schedules: [...rooms, ...vehicles].sort((a, b) => scheduleTimeValue(a.time) - scheduleTimeValue(b.time)),
      errors,
    });
    setLoading(false);
  }, [me, month, org, unit, visibleModules]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard, refreshToken]);

  const totals = useMemo(() => visibleModules.reduce((result, module) => {
    const summary = state.summaries[module.key];
    result.total += summary.total;
    result.pending += summary.pending;
    result.completed += summary.completed;
    result.rejected += summary.rejected;
    result.actionable += summary.actionable;
    return result;
  }, { total: 0, pending: 0, completed: 0, rejected: 0, actionable: 0 }), [state.summaries, visibleModules]);
  const completionRate = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;
  const progressTotal = totals.completed + totals.pending + totals.rejected;
  const progressWidths = {
    completed: progressTotal > 0 ? (totals.completed / progressTotal) * 100 : 0,
    pending: progressTotal > 0 ? (totals.pending / progressTotal) * 100 : 0,
    rejected: progressTotal > 0 ? (totals.rejected / progressTotal) * 100 : 0,
  };
  const filteredSchedules = state.schedules.filter((item) => scheduleTab === "all" || item.kind === scheduleTab);

  return (
    <div className={styles.dashboard}>
      <section className={styles.header}>
        <div>
          <span className={styles.eyebrow}>General Affair Command Center</span>
          <h1>Selamat datang, {firstName(me.nama)}</h1>
          <p>{roleCopy(me.role)}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.monthFilter}><MonthFilterPicker id="dashboard-month" value={month} onChange={setMonth} placeholder="Semua Periode" /></div>
          <div className={styles.unitFilter}>
            <SearchableSelect id="dashboard-unit" value={unit} onChange={setUnit} options={unitOptions} placeholder="Semua Unit" clearLabel="Semua Unit" getLabel={unitLabel} />
          </div>
          <button type="button" className={styles.refreshButton} onClick={() => setRefreshToken((value) => value + 1)} disabled={loading} title="Muat ulang data dashboard" aria-label="Muat ulang data dashboard">
            <RefreshCw className={loading ? styles.spinning : ""} aria-hidden="true" />
          </button>
          <div className={styles.quickAction} ref={quickRef}>
            <button type="button" className={styles.primaryButton} onClick={() => setQuickOpen((value) => !value)} aria-expanded={quickOpen}><Plus aria-hidden="true" />Buat Pengajuan</button>
            {quickOpen && (
              <div className={styles.quickMenu}>
                <div className={styles.quickMenuHeading}>Pilih modul pengajuan</div>
                {visibleModules.map(({ key, label, Icon, transactionHref }) => (
                  <Link key={key} href={transactionHref} onClick={() => setQuickOpen(false)}><span><Icon aria-hidden="true" /></span>{label}<ChevronRight aria-hidden="true" /></Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {state.errors > 0 && !loading && <div className={styles.partialWarning} role="status"><AlertTriangle aria-hidden="true" />Sebagian data belum dapat dimuat. Gunakan tombol muat ulang untuk mencoba kembali.</div>}
      {totals.actionable > 0 && (
        <section className={styles.attentionBanner}>
          <span className={styles.attentionIcon}><Clock3 aria-hidden="true" /></span>
          <div><strong>{totals.actionable.toLocaleString("id-ID")} permohonan memerlukan tindakan Anda</strong><span>Antrean disusun dari permohonan yang paling lama menunggu.</span></div>
          <a href="#dashboard-action-queue">Buka antrean <ArrowRight aria-hidden="true" /></a>
        </section>
      )}

      <section className={styles.kpiGrid} aria-label="Ringkasan dashboard">
        <KpiCard label="Perlu Tindakan" value={totals.actionable} helper={`Untuk ${ROLE_LABEL_FULL[me.role]}`} Icon={Clock3} tone="warning" />
        <KpiCard label="Total Pengajuan" value={totals.total} helper={month ? "Pada periode terpilih" : "Semua periode"} Icon={FileText} tone="primary" />
        <KpiCard label="Selesai" value={totals.completed} helper={`${completionRate}% tingkat penyelesaian`} Icon={CheckCircle2} tone="success" />
        <KpiCard label="Ditolak / Dibatalkan" value={totals.rejected} helper="Akumulasi seluruh modul" Icon={CircleX} tone="danger" />
      </section>

      <section className={`${styles.moduleGrid} ${visibleModules.length === 2 ? styles.twoModules : ""}`} aria-label="Ringkasan modul">
        {visibleModules.map(({ key, label, Icon, overviewHref }) => {
          const summary = state.summaries[key];
          return (
            <Link key={key} href={overviewHref} className={styles.moduleCard}>
              <span className={styles.moduleIcon}><Icon aria-hidden="true" /></span>
              <span className={styles.moduleText}><strong>{label}</strong><small>{summary.failed ? "Data tidak tersedia" : `${summary.total.toLocaleString("id-ID")} transaksi`}</small></span>
              {summary.actionable > 0 && <span className={styles.moduleBadge}>{summary.actionable}</span>}
              <ChevronRight className={styles.moduleArrow} aria-hidden="true" />
            </Link>
          );
        })}
      </section>

      <div className={`${styles.workspace} ${me.role === "KPU" ? styles.workspaceKpu : ""}`}>
        <div className={styles.leftColumn}>
          <section className={styles.panel} id="dashboard-action-queue">
            <header className={styles.panelHeader}>
              <div><h2>Perlu Tindakan Saya</h2><p>Permohonan yang sedang menunggu tahap kerja Anda</p></div>
              <span className={styles.panelCount}>{totals.actionable.toLocaleString("id-ID")} antrean</span>
            </header>
            {loading && state.queue.length === 0 ? <div className={styles.emptyState}>Memuat antrean tindakan...</div>
              : state.queue.length === 0 ? (
                <div className={styles.emptyState}><PackageCheck aria-hidden="true" /><strong>Tidak ada antrean</strong><span>Semua permohonan untuk tahap Anda sudah ditangani.</span></div>
              ) : (
                <div className={styles.queueList}>
                  {state.queue.slice(0, 5).map((item) => (
                    <Link key={`${item.moduleKey}-${item.id}`} href={item.href} className={styles.queueRow}>
                      <div className={styles.queueDocument}><span className={`${styles.moduleTag} ${styles[item.moduleKey]}`}>{item.moduleLabel}</span><strong>{item.number}</strong></div>
                      <div className={styles.queueRequest}><strong>{item.title}</strong><span>{item.requester} · {item.unit}</span></div>
                      <span className={`${styles.ageBadge} ${item.ageMilliseconds >= 86_400_000 ? styles.ageUrgent : ""}`}>{relativeAge(item.ageMilliseconds)}</span>
                      <span className={styles.rowAction}><ChevronRight aria-hidden="true" /></span>
                    </Link>
                  ))}
                </div>
              )}
          </section>

          <section className={styles.performancePanel}>
            <header><div><h2>Kinerja Periode Ini</h2><p>Status keseluruhan dari {visibleModules.length} modul yang dapat Anda akses</p></div><strong>{totals.total.toLocaleString("id-ID")} pengajuan</strong></header>
            <div className={styles.progressTrack} aria-label={`${completionRate}% pengajuan selesai`}>
              <span className={styles.progressCompleted} style={{ width: `${progressWidths.completed}%` }} />
              <span className={styles.progressPending} style={{ width: `${progressWidths.pending}%` }} />
              <span className={styles.progressRejected} style={{ width: `${progressWidths.rejected}%` }} />
            </div>
            <div className={styles.progressLegend}>
              <span><i className={styles.legendCompleted} />Selesai <strong>{totals.completed.toLocaleString("id-ID")}</strong></span>
              <span><i className={styles.legendPending} />Diproses <strong>{totals.pending.toLocaleString("id-ID")}</strong></span>
              <span><i className={styles.legendRejected} />Ditolak/Batal <strong>{totals.rejected.toLocaleString("id-ID")}</strong></span>
            </div>
          </section>
        </div>

        <aside className={styles.rightColumn}>
          {me.role !== "KPU" && (
            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <div><h2>Jadwal Hari Ini</h2><p>Ruang meeting dan kendaraan operasional</p></div>
                <div className={styles.scheduleTabs}>
                  {(["all", "room", "vehicle"] as const).map((tab) => <button key={tab} type="button" className={scheduleTab === tab ? styles.scheduleTabActive : ""} onClick={() => setScheduleTab(tab)}>{tab === "all" ? "Semua" : tab === "room" ? "Ruang" : "Kendaraan"}</button>)}
                </div>
              </header>
              <div className={styles.scheduleList}>
                {loading && state.schedules.length === 0 ? <div className={styles.compactEmpty}>Memuat jadwal...</div>
                  : filteredSchedules.length === 0 ? <div className={styles.compactEmpty}>Tidak ada jadwal pada kategori ini.</div>
                  : filteredSchedules.slice(0, 4).map((item) => (
                    <div key={item.id} className={styles.scheduleRow}>
                      <span className={styles.scheduleTime}>{item.time}</span><span className={`${styles.scheduleRail} ${item.kind === "vehicle" ? styles.vehicleRail : ""}`} />
                      <span className={styles.scheduleDetail}><strong>{item.title}</strong><small>{item.detail}</small></span><span className={styles.resourceBadge}>{item.resource}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><h2>Aktivitas Terbaru</h2><p>Pembaruan status lintas modul</p></div></header>
            <div className={styles.activityList}>
              {loading && state.recent.length === 0 ? <div className={styles.compactEmpty}>Memuat aktivitas...</div>
                : state.recent.length === 0 ? <div className={styles.compactEmpty}>Belum ada aktivitas pada periode ini.</div>
                : state.recent.map((item) => (
                  <Link key={`${item.moduleKey}-${item.id}`} href={item.href} className={styles.activityRow}>
                    <span className={`${styles.activityDot} ${styles[statusTone(item.status)]}`} />
                    <span><strong>{item.number}</strong><small>{item.moduleLabel} · {item.statusLabel}</small></span><time>{relativeAge(item.ageMilliseconds)}</time>
                  </Link>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
