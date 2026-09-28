"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock3,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PeriodFilterPicker from "@/components/PeriodFilterPicker";
import SearchableSelect from "@/components/SearchableSelect";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import { api } from "@/lib/api";
import { BOOKING_STATUS_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatTimeRange, todayLocalDate } from "@/lib/format";
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
import { useExclusivePanel } from "@/lib/exclusivePanel";
import styles from "./DashboardContent.module.css";

type ModuleKey = "expedition" | "room" | "vehicle" | "atk" | "maintenance" | "archive";
type DashboardView = "all" | ModuleKey;
type DashboardStatusFilter =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED_L1"
  | "APPROVED_GA"
  | "APPROVED_GA_APPROVAL"
  | "COMPLETED"
  | "REJECTED"
  | "ON_APPROVAL";
type DashboardStatusSelection = "DRAFT" | "ON_APPROVAL" | "REJECTED" | "COMPLETED" | "";
type SourceItem = Pengiriman | BookingRuang | BookingKendaraan | PermintaanAtk | PerbaikanSarana | PermintaanArsip;
type ScheduleTab = "all" | "room" | "vehicle";
type ChartStatusKey = "completed" | "pending" | "rejected";

interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  shortLabel: string;
  overviewHref: string;
  transactionHref: string;
  hiddenForKpu?: boolean;
}

interface CommonListParams {
  page?: number;
  limit?: number;
  bulan?: string;
  tanggal?: string;
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
  stats: (bulan?: string, tanggal?: string, divisi?: string, direktorat?: string, departemen?: string) => Promise<CommonStatsResult>;
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
  { key: "expedition", label: "Expedition", shortLabel: "Eksp.", overviewHref: "/ekspedisi/overview", transactionHref: "/ekspedisi/transaksi" },
  { key: "room", label: "Room Booking", shortLabel: "Ruang", overviewHref: "/booking-ruang-meeting/overview", transactionHref: "/booking-ruang-meeting/transaksi", hiddenForKpu: true },
  { key: "vehicle", label: "Vehicle Booking", shortLabel: "Kend.", overviewHref: "/booking-kendaraan/overview", transactionHref: "/booking-kendaraan/transaksi", hiddenForKpu: true },
  { key: "atk", label: "Office Supplies", shortLabel: "ATK", overviewHref: "/office-supplies/overview", transactionHref: "/office-supplies/transaksi" },
  { key: "maintenance", label: "Maintenance", shortLabel: "Maint.", overviewHref: "/maintenance/overview", transactionHref: "/maintenance/transaksi", hiddenForKpu: true },
  { key: "archive", label: "Archive", shortLabel: "Arsip", overviewHref: "/arsip/overview", transactionHref: "/arsip/transaksi", hiddenForKpu: true },
];

const EMPTY_SUMMARY: ModuleSummary = { total: 0, pending: 0, completed: 0, rejected: 0, actionable: 0, failed: false };

function emptySummaries(): Record<ModuleKey, ModuleSummary> {
  return {
    expedition: { ...EMPTY_SUMMARY },
    room: { ...EMPTY_SUMMARY },
    vehicle: { ...EMPTY_SUMMARY },
    atk: { ...EMPTY_SUMMARY },
    maintenance: { ...EMPTY_SUMMARY },
    archive: { ...EMPTY_SUMMARY },
  };
}

const MODULE_SOURCES: Record<ModuleKey, ModuleSource> = {
  expedition: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getPengirimanStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listPengiriman(params),
  },
  room: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getBookingStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listBooking({ ...params, status: params.status as BookingStatus | "REJECTED" | "ON_APPROVAL" | undefined }),
  },
  vehicle: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getKendaraanStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listKendaraanBooking({ ...params, status: params.status as BookingStatus | "REJECTED" | "ON_APPROVAL" | undefined }),
  },
  atk: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getAtkStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listAtk(params),
  },
  maintenance: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getSaranaStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listSarana({ ...params, status: params.status as BookingStatus | "REJECTED" | "ON_APPROVAL" | undefined }),
  },
  archive: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getArsipStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
    list: async (params) => api.listArsip({ ...params, status: params.status as BookingStatus | "REJECTED" | "ON_APPROVAL" | undefined }),
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
  if (moduleKey === "room" || moduleKey === "vehicle") return false;
  if ("rejectTarget" in item && (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU")) {
    return item.rejectTarget === "ORIGIN";
  }
  return true;
}

function adaptItem(module: ModuleDefinition, item: SourceItem): DashboardItem {
  const base = {
    id: item.id,
    moduleKey: module.key,
    moduleLabel: module.label,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
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

function selectedStatusForModule(key: ModuleKey, status: DashboardStatusSelection): DashboardStatusFilter | undefined {
  if (!status) return undefined;
  if (status === "COMPLETED" && key !== "expedition" && key !== "atk") return "APPROVED_GA_APPROVAL";
  return status;
}

function actionMatchesSelection(actionFilter: DashboardStatusFilter, status: DashboardStatusSelection): boolean {
  if (!status) return true;
  if (status === "REJECTED") return actionFilter === "REJECTED";
  if (status === "ON_APPROVAL") return actionFilter !== "REJECTED";
  return false;
}

function filterCountsBySelection(
  key: ModuleKey,
  counts: Partial<Record<string, number>>,
  status: DashboardStatusSelection,
): Partial<Record<string, number>> {
  if (!status) return counts;
  if (status === "DRAFT") return { DRAFT: counts.DRAFT ?? 0 };
  if (status === "ON_APPROVAL") {
    const stages = key === "expedition" || key === "atk"
      ? ["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"]
      : ["SUBMITTED", "APPROVED_L1", "APPROVED_GA"];
    return Object.fromEntries(stages.map((stage) => [stage, counts[stage] ?? 0]));
  }
  if (status === "REJECTED") {
    const stages = key === "expedition" || key === "atk"
      ? ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL", "REJECTED_KPU"]
      : ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL", "CANCELLED"];
    return Object.fromEntries(stages.map((stage) => [stage, counts[stage] ?? 0]));
  }
  const completedStage = key === "expedition" || key === "atk" ? "COMPLETED" : "APPROVED_GA_APPROVAL";
  return { [completedStage]: counts[completedStage] ?? 0 };
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

function periodDescription(month: string, date: string): string {
  if (date) {
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" })
      .format(new Date(`${date}T00:00:00`));
  }
  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
      .format(new Date(year, monthNumber - 1, 1));
  }
  return "Semua periode";
}

export default function DashboardContent({ me }: { me: Me }) {
  const [activeView, setActiveView] = useState<DashboardView>("all");
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<DashboardStatusSelection>("");
  const [direktorat, setDirektorat] = useState("");
  const [divisi, setDivisi] = useState("");
  const [departemen, setDepartemen] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [org, setOrg] = useState<OrgStructure | null>(null);
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("all");
  const [hoveredStatusKey, setHoveredStatusKey] = useState<ChartStatusKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<DashboardState>({ summaries: emptySummaries(), queue: [], recent: [], schedules: [], errors: 0 });
  const filterWrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);
  useExclusivePanel(filterOpen, () => setFilterOpen(false));

  const visibleModules = useMemo(
    () => MODULES.filter((module) => me.role !== "KPU" || !module.hiddenForKpu),
    [me.role],
  );
  const selectedModules = useMemo(
    () => activeView === "all" ? visibleModules : visibleModules.filter((module) => module.key === activeView),
    [activeView, visibleModules],
  );
  const activeModuleLabel = activeView === "all"
    ? "Overall"
    : visibleModules.find((module) => module.key === activeView)?.label ?? "Overall";

  const selectedDirektoratNode = org?.direktoratTree.find((node) => node.nama === direktorat) ?? null;
  const divisiOptions = selectedDirektoratNode ? selectedDirektoratNode.divisi.map((node) => node.nama) : org?.divisi ?? [];
  const selectedDivisiNode = divisi
    ? (selectedDirektoratNode?.divisi ?? org?.direktoratTree.flatMap((node) => node.divisi) ?? []).find((node) => node.nama === divisi) ?? null
    : null;
  const departemenOptions = selectedDivisiNode
    ? selectedDivisiNode.departemen
    : selectedDirektoratNode
      ? selectedDirektoratNode.divisi.flatMap((node) => node.departemen)
      : org?.departemen ?? [];

  useEffect(() => { api.orgStructure().then(setOrg).catch(() => setOrg(null)); }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const unitScope = { direktorat: direktorat || undefined, divisi: divisi || undefined, departemen: departemen || undefined };
    const scope: CommonListParams = { page: 1, bulan: month || undefined, tanggal: date || undefined, ...unitScope };
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
        source.stats(month || undefined, date || undefined, unitScope.divisi, unitScope.direktorat, unitScope.departemen),
        source.list(queueParams),
        source.list({ ...scope, limit: 5, status: selectedStatusForModule(module.key, status) }),
      ]);
      const filteredCounts = statsResult.status === "fulfilled"
        ? filterCountsBySelection(module.key, statsResult.value.countsByStatus, status)
        : {};
      const stats = statsResult.status === "fulfilled"
        ? summarizeModule(module.key, filteredCounts)
        : { total: 0, pending: 0, completed: 0, rejected: 0 };
      const rawQueue = queueResult.status === "fulfilled" && actionMatchesSelection(actionFilter, status) ? queueResult.value.items : [];
      const filteredQueue = isOriginAdmin(me.role) ? rawQueue.filter((item) => isOriginCorrection(module.key, item, me)) : rawQueue;
      const actionCount = isOriginAdmin(me.role)
        ? filteredQueue.length
        : queueResult.status === "fulfilled" && actionMatchesSelection(actionFilter, status) ? queueResult.value.total : 0;
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
      id: `room-${item.id}`,
      kind: "room",
      time: formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay),
      title: item.namaKegiatan,
      detail: `${item.jumlahPeserta} peserta${item.pic ? ` · PIC ${item.pic}` : ""}`,
      resource: [item.namaRuang, ...item.additionalRooms].join(", "),
    }));
    const vehicles = scheduleResult.vehicles.filter(matchesUnit).map<ScheduleItem>((item) => ({
      id: `vehicle-${item.id}`,
      kind: "vehicle",
      time: formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay),
      title: item.keperluan,
      detail: `${item.jumlahPenumpang} penumpang${item.supir ? ` · ${item.supir}` : ""}`,
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
  }, [date, departemen, direktorat, divisi, me, month, org, status, visibleModules]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard, refreshToken]);

  function resetDashboard() {
    setActiveView("all");
    setMonth("");
    setDate("");
    setStatus("");
    setDirektorat("");
    setDivisi("");
    setDepartemen("");
    setScheduleTab("all");
    setFilterOpen(false);
    setRefreshToken((value) => value + 1);
  }

  const totals = useMemo(() => selectedModules.reduce((result, module) => {
    const summary = state.summaries[module.key];
    result.total += summary.total;
    result.pending += summary.pending;
    result.completed += summary.completed;
    result.rejected += summary.rejected;
    result.actionable += summary.actionable;
    return result;
  }, { total: 0, pending: 0, completed: 0, rejected: 0, actionable: 0 }), [selectedModules, state.summaries]);

  const completedPercent = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;
  const pendingPercent = totals.total > 0 ? Math.round((totals.pending / totals.total) * 100) : 0;
  const rejectedPercent = totals.total > 0 ? Math.round((totals.rejected / totals.total) * 100) : 0;
  const statusChartData = [
    { key: "completed" as const, label: "Approved", value: totals.completed, percent: completedPercent, className: styles.completedSegment },
    { key: "pending" as const, label: "On-Approval", value: totals.pending, percent: pendingPercent, className: styles.pendingSegment },
    { key: "rejected" as const, label: "Rejected", value: totals.rejected, percent: rejectedPercent, className: styles.rejectedSegment },
  ];
  let donutOffset = 0;
  const donutSegments = statusChartData.map((item) => {
    const exactPercent = totals.total > 0 ? (item.value / totals.total) * 100 : 0;
    const segment = { ...item, exactPercent, offset: donutOffset };
    donutOffset += exactPercent;
    return segment;
  });
  const hoveredStatus = statusChartData.find((item) => item.key === hoveredStatusKey) ?? null;
  const maxBarValue = Math.max(
    1,
    ...selectedModules.flatMap((module) => {
      const summary = state.summaries[module.key];
      return [summary.completed, summary.pending, summary.rejected];
    }),
  );
  const periodText = periodDescription(month, date);
  const progressTotal = totals.completed + totals.pending + totals.rejected;
  const progressWidths = {
    completed: progressTotal > 0 ? (totals.completed / progressTotal) * 100 : 0,
    pending: progressTotal > 0 ? (totals.pending / progressTotal) * 100 : 0,
    rejected: progressTotal > 0 ? (totals.rejected / progressTotal) * 100 : 0,
  };
  const dashboardQueue = state.queue.filter((item) => activeView === "all" || item.moduleKey === activeView);
  const dashboardRecent = state.recent.filter((item) => activeView === "all" || item.moduleKey === activeView);
  const filteredSchedules = state.schedules.filter((item) => scheduleTab === "all" || item.kind === scheduleTab);
  const overallTotal = visibleModules.reduce((total, module) => total + state.summaries[module.key].total, 0);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.greeting}><WelcomeGreeting me={me} /></div>
        <div className={styles.headerActions}>
          <div className={styles.monthFilter}>
            <PeriodFilterPicker
              id="dashboard-period"
              bulan={month}
              tanggal={date}
              onChangeBulan={(value) => { setMonth(value); setDate(""); }}
              onChangeTanggal={(value) => { setDate(value); setMonth(""); }}
              placeholder="Semua Periode"
            />
          </div>
          <div className={`filter-dropdown-wrap ${styles.moreFilter}`} ref={filterWrapRef}>
            <button type="button" className={`btn filter-dropdown-toggle ${styles.filterToggle}`} id="dashboard-filter-toggle" aria-expanded={filterOpen} onClick={() => setFilterOpen((value) => !value)}>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {filterOpen && (
              <div className={`filter-dropdown-panel ${styles.filterPanel}`}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="dashboard-status">Status</label>
                  <SearchableSelect id="dashboard-status" value={status} onChange={(value) => setStatus(value as DashboardStatusSelection)} options={["DRAFT", "ON_APPROVAL", "REJECTED", "COMPLETED"]} getLabel={(value) => ({ DRAFT: "Draft", ON_APPROVAL: "On-Approval", REJECTED: "Rejected", COMPLETED: "Approved" } as Record<string, string>)[value] ?? value} clearLabel="Semua Status" placeholder="Semua Status" />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="dashboard-direktorat">Direktorat</label>
                  <SearchableSelect id="dashboard-direktorat" value={direktorat} onChange={(value) => { setDirektorat(value); setDivisi(""); setDepartemen(""); }} options={org?.direktorat ?? []} clearLabel="Semua Direktorat" placeholder="Semua Direktorat" />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="dashboard-divisi">Divisi</label>
                  <SearchableSelect id="dashboard-divisi" value={divisi} onChange={(value) => { setDivisi(value); setDepartemen(""); }} options={divisiOptions} clearLabel="Semua Divisi" placeholder="Semua Divisi" />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="dashboard-departemen">Departemen</label>
                  <SearchableSelect id="dashboard-departemen" value={departemen} onChange={setDepartemen} options={departemenOptions} clearLabel="Semua Departemen" placeholder="Semua Departemen" />
                </div>
              </div>
            )}
          </div>
          <button type="button" className={styles.refreshButton} onClick={resetDashboard} disabled={loading} title="Reset filter dan muat ulang dashboard" aria-label="Reset filter dan muat ulang dashboard">
            <RefreshCw className={loading ? styles.spinning : ""} aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className={styles.moduleTabs} aria-label="Dashboard per modul">
        <button type="button" className={activeView === "all" ? styles.moduleTabActive : ""} aria-pressed={activeView === "all"} onClick={() => setActiveView("all")}>
          <span>Overall ({overallTotal.toLocaleString("id-ID")})</span>
        </button>
        {visibleModules.map(({ key, label }) => (
          <button key={key} type="button" className={activeView === key ? styles.moduleTabActive : ""} aria-pressed={activeView === key} onClick={() => setActiveView(key)}>
            <span>{label} ({state.summaries[key].total.toLocaleString("id-ID")})</span>
          </button>
        ))}
      </nav>

      {state.errors > 0 && !loading && <div className={styles.partialWarning} role="status"><AlertTriangle aria-hidden="true" />Sebagian data belum dapat dimuat. Gunakan tombol muat ulang untuk mencoba kembali.</div>}
      {totals.actionable > 0 && (
        <section className={styles.attentionBanner}>
          <span className={styles.attentionIcon}><Clock3 aria-hidden="true" /></span>
          <div><strong>{totals.actionable.toLocaleString("id-ID")} permohonan memerlukan tindakan Anda</strong><span>Antrean disusun dari permohonan yang paling lama menunggu.</span></div>
          <a href="#dashboard-action-queue">Buka antrean <ArrowRight aria-hidden="true" /></a>
        </section>
      )}

      <section className={`${styles.moduleGrid} ${selectedModules.length === 1 ? styles.singleModule : ""}`} aria-label="Total transaksi per modul">
        {selectedModules.map(({ key, label, overviewHref }) => {
          const summary = state.summaries[key];
          return (
            <Link key={key} href={overviewHref} className={styles.moduleCard} aria-label={`Buka Overview ${label}`}>
              <span className={styles.moduleCardValue}>{summary.failed ? "-" : summary.total.toLocaleString("id-ID")}</span>
              <span className={styles.moduleCardLabel}>{summary.failed ? "Data tidak tersedia" : label}</span>
            </Link>
          );
        })}
      </section>

      <section className={styles.analyticsGrid} aria-label="Analitik dashboard">
        <article className={styles.statusPanel}>
          <header className={styles.panelHeader}><div><h2>Ringkasan Status Transaksi</h2><p>{activeView === "all" ? "Seluruh modul" : activeModuleLabel} pada {periodText.toLowerCase()}</p></div></header>
          <div className={styles.statusContent}>
            <div className={styles.donut} aria-label={`${totals.completed} approved, ${totals.pending} on-approval, ${totals.rejected} rejected`}>
              <svg className={styles.donutSvg} viewBox="0 0 120 120" role="group" aria-label="Distribusi status transaksi">
                <circle className={styles.donutTrack} cx="60" cy="60" r="47" pathLength="100" />
                {donutSegments.filter((item) => item.value > 0).map((item) => (
                  <circle
                    key={item.key}
                    className={`${styles.donutSegment} ${item.className}`}
                    cx="60"
                    cy="60"
                    r="47"
                    pathLength="100"
                    strokeDasharray={`${item.exactPercent} ${100 - item.exactPercent}`}
                    strokeDashoffset={-item.offset}
                    tabIndex={0}
                    aria-label={`${item.label}: ${item.value.toLocaleString("id-ID")} (${item.percent}%)`}
                    onMouseEnter={() => setHoveredStatusKey(item.key)}
                    onMouseLeave={() => setHoveredStatusKey(null)}
                    onFocus={() => setHoveredStatusKey(item.key)}
                    onBlur={() => setHoveredStatusKey(null)}
                  >
                    <title>{`${item.label}: ${item.value.toLocaleString("id-ID")} (${item.percent}%)`}</title>
                  </circle>
                ))}
              </svg>
              <div className={styles.donutCenter}><strong>{totals.total.toLocaleString("id-ID")}</strong><span>transaksi</span></div>
              {hoveredStatus && (
                <div className={styles.chartTooltip} role="status">
                  <span>{hoveredStatus.label}</span>
                  <strong>{hoveredStatus.value.toLocaleString("id-ID")} ({hoveredStatus.percent}%)</strong>
                </div>
              )}
            </div>
            <div className={styles.statusLegend}>
              <div><span><i className={styles.completedDot} />Approved</span><strong>{totals.completed.toLocaleString("id-ID")}</strong><em>{completedPercent}%</em></div>
              <div><span><i className={styles.pendingDot} />On-Approval</span><strong>{totals.pending.toLocaleString("id-ID")}</strong><em>{pendingPercent}%</em></div>
              <div><span><i className={styles.rejectedDot} />Rejected</span><strong>{totals.rejected.toLocaleString("id-ID")}</strong><em>{rejectedPercent}%</em></div>
            </div>
          </div>
        </article>

        <article className={styles.comparisonPanel}>
          <header className={styles.panelHeader}>
            <div><h2>Perbandingan Status Modul</h2><p>Distribusi transaksi pada {periodText.toLowerCase()}</p></div>
            <div className={styles.chartLegend} aria-label="Legenda grafik"><span><i className={styles.completedDot} />Approved</span><span><i className={styles.pendingDot} />On-Approval</span><span><i className={styles.rejectedDot} />Rejected</span></div>
          </header>
          <div className={styles.chartViewport}>
            <div className={styles.chartGrid} aria-hidden="true"><span /><span /><span /><span /></div>
            <div className={styles.barGroups} style={{ gridTemplateColumns: `repeat(${selectedModules.length}, minmax(62px, 1fr))` }}>
              {selectedModules.map((module) => {
                const summary = state.summaries[module.key];
                const values = [
                  { key: "completed", label: "Approved", value: summary.completed, className: styles.completedBar },
                  { key: "pending", label: "On-Approval", value: summary.pending, className: styles.pendingBar },
                  { key: "rejected", label: "Rejected", value: summary.rejected, className: styles.rejectedBar },
                ];
                return (
                  <div className={styles.barGroup} key={module.key}>
                    <div className={styles.bars}>
                      {values.map((item) => (
                        <span key={item.key} className={`${styles.bar} ${item.className}`} style={{ height: item.value > 0 ? `${Math.max(7, (item.value / maxBarValue) * 100)}%` : 0 }} tabIndex={item.value > 0 ? 0 : -1} aria-label={`${module.label}, ${item.label}: ${item.value.toLocaleString("id-ID")}`}>
                          {item.value > 0 && <small>{item.value.toLocaleString("id-ID")}</small>}
                          {item.value > 0 && <span className={styles.barTooltip}>{module.label} · <strong>{item.label}: {item.value.toLocaleString("id-ID")}</strong></span>}
                        </span>
                      ))}
                    </div>
                    <strong>{module.shortLabel}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <div className={`${styles.workspace} ${me.role === "KPU" ? styles.workspaceKpu : ""}`}>
        <div className={styles.leftColumn}>
          <section className={styles.panel} id="dashboard-action-queue">
            <header className={styles.legacyPanelHeader}>
              <div><h2>Perlu Tindakan Saya</h2><p>Permohonan yang sedang menunggu tahap kerja Anda</p></div>
              <span className={styles.panelCount}>{totals.actionable.toLocaleString("id-ID")} antrean</span>
            </header>
            {loading && dashboardQueue.length === 0 ? <div className={styles.emptyState}>Memuat antrean tindakan...</div>
              : dashboardQueue.length === 0 ? (
                <div className={styles.emptyState}><PackageCheck aria-hidden="true" /><strong>Tidak ada antrean</strong><span>Semua permohonan untuk tahap Anda sudah ditangani.</span></div>
              ) : (
                <div className={styles.queueList}>
                  {dashboardQueue.slice(0, 5).map((item) => (
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
            <header><div><h2>Kinerja Periode Ini</h2><p>Status dari {selectedModules.length} modul pada tampilan aktif</p></div><strong>{totals.total.toLocaleString("id-ID")} pengajuan</strong></header>
            <div className={styles.progressTrack} aria-label={`${completedPercent}% pengajuan selesai`}>
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
              <header className={styles.legacyPanelHeader}>
                <div><h2>Jadwal Hari Ini</h2><p>Ruang meeting dan kendaraan operasional</p></div>
                <div className={styles.scheduleTabs}>
                  {(["all", "room", "vehicle"] as const).map((tab) => (
                    <button key={tab} type="button" className={scheduleTab === tab ? styles.scheduleTabActive : ""} onClick={() => setScheduleTab(tab)}>
                      {tab === "all" ? "Semua" : tab === "room" ? "Ruang" : "Kendaraan"}
                    </button>
                  ))}
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
            <header className={styles.legacyPanelHeader}><div><h2>Aktivitas Terbaru</h2><p>Pembaruan status lintas modul</p></div></header>
            <div className={styles.activityList}>
              {loading && dashboardRecent.length === 0 ? <div className={styles.compactEmpty}>Memuat aktivitas...</div>
                : dashboardRecent.length === 0 ? <div className={styles.compactEmpty}>Belum ada aktivitas pada periode ini.</div>
                : dashboardRecent.map((item) => (
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
