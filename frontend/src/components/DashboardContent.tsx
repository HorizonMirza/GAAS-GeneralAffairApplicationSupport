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
  RoomOption,
  Status,
  SumberPembelian,
  VehicleOption,
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
type ChartStatusKey = "completed" | "pending" | "rejected";
type OrganizationDimension = "direktorat" | "divisi" | "departemen";

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
  kind: "room" | "vehicle";
  time: string;
  title: string;
  detail: string;
  resources: string[];
  startMinutes: number;
  endMinutes: number;
}

interface DashboardState {
  summaries: Record<ModuleKey, ModuleSummary>;
  queue: DashboardItem[];
  recent: DashboardItem[];
  schedules: ScheduleItem[];
  roomResources: string[];
  vehicleResources: string[];
  analytics: AnalyticsItem[];
  errors: number;
}

interface AnalyticsItem {
  moduleKey: ModuleKey;
  divisi: string;
  departemen: string | null;
  createdAt: string;
  amount: number;
}

const MODULES: ModuleDefinition[] = [
  { key: "expedition", label: "Expedition", shortLabel: "Expedition", overviewHref: "/ekspedisi/overview", transactionHref: "/ekspedisi/transaksi" },
  { key: "room", label: "Room Booking", shortLabel: "Room Book.", overviewHref: "/booking-ruang-meeting/overview", transactionHref: "/booking-ruang-meeting/transaksi", hiddenForKpu: true },
  { key: "vehicle", label: "Vehicle Booking", shortLabel: "Vehicle Book.", overviewHref: "/booking-kendaraan/overview", transactionHref: "/booking-kendaraan/transaksi", hiddenForKpu: true },
  { key: "atk", label: "Office Supplies", shortLabel: "Office Sup.", overviewHref: "/office-supplies/overview", transactionHref: "/office-supplies/transaksi" },
  { key: "maintenance", label: "Maintenance", shortLabel: "Maintenance", overviewHref: "/maintenance/overview", transactionHref: "/maintenance/transaksi", hiddenForKpu: true },
  { key: "archive", label: "Archive", shortLabel: "Archive", overviewHref: "/arsip/overview", transactionHref: "/arsip/transaksi", hiddenForKpu: true },
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

const SCHEDULE_START_MINUTES = 7 * 60;
const SCHEDULE_END_MINUTES = 18 * 60;
const SCHEDULE_DURATION_MINUTES = SCHEDULE_END_MINUTES - SCHEDULE_START_MINUTES;
const SCHEDULE_HOURS = [7, 9, 11, 13, 15, 17];

function timeToMinutes(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return hours * 60 + minutes;
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
  return "Semua Periode";
}

function monthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonthBuckets(reference: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(reference.getFullYear(), reference.getMonth() - (count - 1 - index), 1);
    return {
      key: monthKey(value),
      label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(value).replace(".", ""),
    };
  });
}

function analyticsAmount(moduleKey: ModuleKey, item: SourceItem): number {
  if (moduleKey === "expedition") return (item as Pengiriman).total ?? 0;
  if (moduleKey === "atk") return (item as PermintaanAtk).totalHargaBarang ?? 0;
  return 0;
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
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
  const [organizationDimension, setOrganizationDimension] = useState<OrganizationDimension>("direktorat");
  const [hoveredStatusKey, setHoveredStatusKey] = useState<ChartStatusKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<DashboardState>({
    summaries: emptySummaries(),
    queue: [],
    recent: [],
    schedules: [],
    roomResources: [],
    vehicleResources: [],
    analytics: [],
    errors: 0,
  });
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
      const [statsResult, queueResult, recentResult, analyticsResult] = await Promise.allSettled([
        source.stats(month || undefined, date || undefined, unitScope.divisi, unitScope.direktorat, unitScope.departemen),
        source.list(queueParams),
        source.list({ ...scope, limit: 5, status: selectedStatusForModule(module.key, status) }),
        source.list({ page: 1, limit: 1000, ...unitScope, status: selectedStatusForModule(module.key, status) }),
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
        analytics: analyticsResult.status === "fulfilled"
          ? analyticsResult.value.items.map<AnalyticsItem>((item) => ({
            moduleKey: module.key,
            divisi: item.divisi,
            departemen: item.departemen,
            createdAt: item.createdAt,
            amount: analyticsAmount(module.key, item),
          }))
          : [],
        errors: [statsResult, queueResult, recentResult, analyticsResult].filter((result) => result.status === "rejected").length,
      };
    });

    const schedulePromise = me.role === "KPU"
      ? Promise.resolve({
        rooms: [] as BookingRuang[],
        vehicles: [] as BookingKendaraan[],
        roomOptions: [] as RoomOption[],
        vehicleOptions: [] as VehicleOption[],
        errors: 0,
      })
      : Promise.allSettled([
        api.getBookingSchedule(todayLocalDate()),
        api.getKendaraanSchedule(todayLocalDate()),
        api.listRooms(),
        api.listVehicles(),
      ])
        .then(([rooms, vehicles, roomOptions, vehicleOptions]) => ({
          rooms: rooms.status === "fulfilled" ? rooms.value : [],
          vehicles: vehicles.status === "fulfilled" ? vehicles.value : [],
          roomOptions: roomOptions.status === "fulfilled" ? roomOptions.value : [],
          vehicleOptions: vehicleOptions.status === "fulfilled" ? vehicleOptions.value : [],
          errors: [rooms, vehicles, roomOptions, vehicleOptions].filter((result) => result.status === "rejected").length,
        }));

    const [moduleResults, scheduleResult] = await Promise.all([Promise.all(moduleTasks), schedulePromise]);
    const summaries = emptySummaries();
    const queue: DashboardItem[] = [];
    const recent: DashboardItem[] = [];
    const analytics: AnalyticsItem[] = [];
    let errors = scheduleResult.errors;
    moduleResults.forEach((result) => {
      summaries[result.module.key] = result.summary;
      queue.push(...result.queue);
      recent.push(...result.recent);
      analytics.push(...result.analytics);
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
    const rooms = scheduleResult.rooms.filter(matchesUnit).map<ScheduleItem>((item) => {
      const resources = [item.namaRuang, ...item.additionalRooms];
      return {
        id: `room-${item.id}`,
        kind: "room",
        time: formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay),
        title: item.namaKegiatan,
        detail: `${item.jumlahPeserta} peserta${item.pic ? ` · PIC ${item.pic}` : ""}`,
        resources,
        startMinutes: item.isWholeDay ? SCHEDULE_START_MINUTES : timeToMinutes(item.jamMulai, SCHEDULE_START_MINUTES),
        endMinutes: item.isWholeDay ? SCHEDULE_END_MINUTES : timeToMinutes(item.jamSelesai, SCHEDULE_END_MINUTES),
      };
    });
    const vehicles = scheduleResult.vehicles.filter(matchesUnit).map<ScheduleItem>((item) => ({
      id: `vehicle-${item.id}`,
      kind: "vehicle",
      time: formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay),
      title: item.keperluan,
      detail: `${item.jumlahPenumpang} penumpang${item.supir ? ` · ${item.supir}` : ""}`,
      resources: [item.namaKendaraan],
      startMinutes: item.isWholeDay ? SCHEDULE_START_MINUTES : timeToMinutes(item.jamMulai, SCHEDULE_START_MINUTES),
      endMinutes: item.isWholeDay ? SCHEDULE_END_MINUTES : timeToMinutes(item.jamSelesai, SCHEDULE_END_MINUTES),
    }));
    queue.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    recent.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setState({
      summaries,
      queue: queue.slice(0, 8),
      recent: recent.slice(0, 10),
      schedules: [...rooms, ...vehicles].sort((a, b) => scheduleTimeValue(a.time) - scheduleTimeValue(b.time)),
      roomResources: scheduleResult.roomOptions.map((item) => item.nama),
      vehicleResources: scheduleResult.vehicleOptions.map((item) => item.nama),
      analytics,
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
    setOrganizationDimension("direktorat");
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
  const organizationContext = departemen || divisi || direktorat;
  const statusContext = status
    ? ({ DRAFT: "Draft", ON_APPROVAL: "On-Approval", REJECTED: "Rejected", COMPLETED: "Approved" } as Record<Exclude<DashboardStatusSelection, "">, string>)[status]
    : "";
  const analyticsContext = [activeView === "all" ? "Seluruh Modul" : activeModuleLabel, periodText, organizationContext, statusContext].filter(Boolean).join(" · ");
  const selectedAnalytics = state.analytics.filter((item) => activeView === "all" || item.moduleKey === activeView);
  const periodScopedAnalytics = state.analytics.filter((item) => {
    const itemDate = item.createdAt.slice(0, 10);
    if (date) return itemDate === date;
    if (month) return itemDate.startsWith(month);
    return true;
  });
  const periodAnalytics = periodScopedAnalytics.filter((item) => activeView === "all" || item.moduleKey === activeView);
  const scopedDirektoratNodes = direktorat
    ? org?.direktoratTree.filter((node) => node.nama === direktorat) ?? []
    : divisi
      ? org?.direktoratTree.filter((node) => node.divisi.some((unit) => unit.nama === divisi)) ?? []
      : departemen
        ? org?.direktoratTree.filter((node) => node.divisi.some((unit) => unit.departemen.includes(departemen))) ?? []
        : org?.direktoratTree ?? [];
  const scopedDivisiNodes = scopedDirektoratNodes.flatMap((node) => node.divisi)
    .filter((node) => !divisi || node.nama === divisi)
    .filter((node) => !departemen || node.departemen.includes(departemen));
  const organizationOptions = organizationDimension === "direktorat"
    ? scopedDirektoratNodes.map((node) => node.nama)
    : organizationDimension === "divisi"
      ? scopedDivisiNodes.map((node) => node.nama)
      : departemen
        ? [departemen]
        : scopedDivisiNodes.flatMap((node) => node.departemen);
  const organizationCounts = periodAnalytics.reduce<Record<string, number>>((counts, item) => {
    const key = organizationDimension === "direktorat"
      ? org?.direktoratTree.find((node) => node.divisi.some((unit) => unit.nama === item.divisi))?.nama ?? "Tanpa Direktorat"
      : organizationDimension === "divisi"
        ? item.divisi || "Tanpa Divisi"
        : item.departemen || "Tanpa Departemen";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const organizationVolumes = [
    ...organizationOptions.map((label) => ({ label, value: organizationCounts[label] ?? 0 })),
    ...Object.entries(organizationCounts)
      .filter(([label]) => !organizationOptions.includes(label))
      .map(([label, value]) => ({ label, value })),
  ].sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
  const maxOrganizationVolume = Math.max(1, ...organizationVolumes.map((item) => item.value));
  const organizationDimensionLabel = ({ direktorat: "Direktorat", divisi: "Divisi", departemen: "Departemen" } as const)[organizationDimension];
  const distributionPeriodText = periodText;
  const distributionContext = [activeView === "all" ? "" : activeModuleLabel, distributionPeriodText, organizationContext, statusContext].filter(Boolean).join(" · ");
  const spendingRows = ([
    { key: "expedition" as const, label: "Expedition" },
    { key: "atk" as const, label: "Office Supplies" },
  ]).map((module) => {
    const items = periodScopedAnalytics.filter((item) => item.moduleKey === module.key && item.amount > 0);
    return {
      ...module,
      count: items.length,
      value: items.reduce((total, item) => total + item.amount, 0),
    };
  });
  const totalSpending = spendingRows.reduce((total, item) => total + item.value, 0);
  const maxSpending = Math.max(1, ...spendingRows.map((item) => item.value));
  const spendingContext = [periodText, organizationContext, statusContext].filter(Boolean).join(" · ");
  const trendReference = date
    ? new Date(`${date}T00:00:00`)
    : month
      ? new Date(`${month}-01T00:00:00`)
      : new Date();
  const trendData = recentMonthBuckets(trendReference, 6).map((bucket) => ({
    ...bucket,
    value: selectedAnalytics.filter((item) => item.createdAt.slice(0, 7) === bucket.key).length,
  }));
  const trendMax = Math.max(1, ...trendData.map((item) => item.value));
  const trendPoints = trendData.map((item, index) => ({
    ...item,
    x: 34 + (index * 412) / Math.max(1, trendData.length - 1),
    y: 18 + (1 - item.value / trendMax) * 207,
  }));
  const trendLinePoints = trendPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const trendAreaPoints = `34,225 ${trendLinePoints} 446,225`;
  const previousTrendValue = trendData.at(-2)?.value ?? 0;
  const latestTrendValue = trendData.at(-1)?.value ?? 0;
  const trendGrowth = previousTrendValue > 0 ? Math.round(((latestTrendValue - previousTrendValue) / previousTrendValue) * 1000) / 10 : null;
  const yAxisTicks = [maxBarValue, Math.round((maxBarValue * 2) / 3), Math.round(maxBarValue / 3), 0];
  const progressTotal = totals.completed + totals.pending + totals.rejected;
  const progressWidths = {
    completed: progressTotal > 0 ? (totals.completed / progressTotal) * 100 : 0,
    pending: progressTotal > 0 ? (totals.pending / progressTotal) * 100 : 0,
    rejected: progressTotal > 0 ? (totals.rejected / progressTotal) * 100 : 0,
  };
  const dashboardQueue = state.queue.filter((item) => activeView === "all" || item.moduleKey === activeView);
  const dashboardRecent = state.recent.filter((item) => activeView === "all" || item.moduleKey === activeView);
  const roomResourceNames = Array.from(new Set([
    ...state.roomResources,
    ...state.schedules.filter((item) => item.kind === "room").flatMap((item) => item.resources),
  ])).sort((left, right) => left.localeCompare(right));
  const vehicleResourceNames = Array.from(new Set([
    ...state.vehicleResources,
    ...state.schedules.filter((item) => item.kind === "vehicle").flatMap((item) => item.resources),
  ])).sort((left, right) => left.localeCompare(right));
  const roomScheduleRows = roomResourceNames.map((resource) => ({
    resource,
    items: state.schedules.filter((item) => item.kind === "room" && item.resources.includes(resource)),
  }));
  const vehicleScheduleRows = vehicleResourceNames.map((resource) => ({
    resource,
    items: state.schedules.filter((item) => item.kind === "vehicle" && item.resources.includes(resource)),
  }));
  const scheduleDateLabel = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    .format(new Date(`${todayLocalDate()}T00:00:00`));
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
          <header className={styles.panelHeader}><div><h2>Status Transaksi</h2><p>{analyticsContext}</p></div></header>
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
              <div><span><i className={styles.completedDot} />Approved</span><strong className={styles.statusCount}>{totals.completed.toLocaleString("id-ID")}</strong><em>{completedPercent}%</em></div>
              <div><span><i className={styles.pendingDot} />On-Approval</span><strong className={styles.statusCount}>{totals.pending.toLocaleString("id-ID")}</strong><em>{pendingPercent}%</em></div>
              <div><span><i className={styles.rejectedDot} />Rejected</span><strong className={styles.statusCount}>{totals.rejected.toLocaleString("id-ID")}</strong><em>{rejectedPercent}%</em></div>
            </div>
          </div>
        </article>

        <article className={styles.comparisonPanel}>
          <header className={styles.panelHeader}>
            <div><h2>Status Modul</h2><p>{analyticsContext}</p></div>
            <div className={styles.chartLegend} aria-label="Legenda grafik"><span><i className={styles.completedDot} />Approved</span><span><i className={styles.pendingDot} />On-Approval</span><span><i className={styles.rejectedDot} />Rejected</span></div>
          </header>
          <div className={styles.chartViewport}>
            <div className={styles.chartGrid} aria-hidden="true"><span /><span /><span /><span /></div>
            <div className={styles.yAxis} aria-hidden="true">
              {yAxisTicks.map((tick, index) => <span key={`${tick}-${index}`}>{tick.toLocaleString("id-ID")}</span>)}
            </div>
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

      <section className={styles.insightGrid} aria-label="Analitik organisasi dan tren">
        <article className={styles.insightPanel}>
          <header className={`${styles.insightHeader} ${styles.distributionHeader}`}>
            <div><h2>Distribusi Volume {organizationDimensionLabel}</h2><p>{distributionContext}</p></div>
            <select
              className={styles.organizationSelect}
              aria-label="Dimensi distribusi volume"
              value={organizationDimension}
              onChange={(event) => setOrganizationDimension(event.target.value as OrganizationDimension)}
            >
              <option value="direktorat">Direktorat</option>
              <option value="divisi">Divisi</option>
              <option value="departemen">Departemen</option>
            </select>
          </header>
          <div className={styles.divisionChart}>
            {organizationVolumes.length === 0 ? <div className={styles.insightEmpty}>Belum ada struktur organisasi pada filter ini.</div> : organizationVolumes.map((item) => (
              <div className={styles.divisionRow} key={item.label} title={`${item.label}: ${item.value.toLocaleString("id-ID")} transaksi`}>
                <div className={styles.divisionRowHeader}><strong title={item.label}>{item.label}</strong><em>{item.value.toLocaleString("id-ID")}</em></div>
                <span className={styles.divisionTrack}><i style={{ width: item.value > 0 ? `${Math.max(4, (item.value / maxOrganizationVolume) * 100)}%` : 0 }} /></span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.insightPanel}>
          <header className={styles.insightHeader}>
            <div><h2>Tren Transaksi</h2><p>{[activeView === "all" ? "Seluruh Modul" : activeModuleLabel, organizationContext, statusContext].filter(Boolean).join(" · ")}</p></div>
            {trendGrowth !== null && <span className={trendGrowth >= 0 ? styles.positiveTrend : styles.negativeTrend}>{trendGrowth >= 0 ? "+" : ""}{trendGrowth}% vs bulan lalu</span>}
          </header>
          <div className={styles.trendChart}>
            <svg viewBox="0 0 480 265" role="img" aria-label="Tren volume transaksi enam bulan terakhir">
              <title>Tren volume transaksi enam bulan terakhir</title>
              {[0, 1, 2, 3].map((line) => {
                const y = 18 + (line * 207) / 3;
                const value = Math.round(trendMax * (1 - line / 3));
                return <g key={line}><line className={styles.trendGridLine} x1="34" x2="446" y1={y} y2={y} /><text className={styles.trendAxisText} x="26" y={y + 4} textAnchor="end">{value}</text></g>;
              })}
              <polygon className={styles.trendArea} points={trendAreaPoints} />
              <polyline className={styles.trendLine} points={trendLinePoints} />
              {trendPoints.map((point) => (
                <g className={styles.trendPoint} key={point.key} tabIndex={0} aria-label={`${point.label}: ${point.value.toLocaleString("id-ID")} transaksi`}>
                  <circle cx={point.x} cy={point.y} r="5" />
                  <text x={point.x} y={Math.max(13, point.y - 11)} textAnchor="middle">{point.value}</text>
                  <text className={styles.trendMonthLabel} x={point.x} y="252" textAnchor="middle">{point.label}</text>
                  <title>{`${point.label}: ${point.value.toLocaleString("id-ID")} transaksi`}</title>
                </g>
              ))}
            </svg>
          </div>
        </article>

        <article className={`${styles.insightPanel} ${styles.spendingPanel}`} aria-label="Uang keluar Expedition dan Office Supplies">
          <header className={styles.spendingHeader}>
            <div><h2>Uang Keluar</h2><p>{spendingContext}</p></div>
          </header>
          <div className={styles.spendingBreakdown}>
            {spendingRows.map((item) => (
              <div className={styles.spendingItem} key={item.key}>
                <div className={styles.spendingItemHeader}>
                  <strong>{item.label} ({item.count.toLocaleString("id-ID")} Trasaction)</strong>
                  <strong>{formatRupiah(item.value)}</strong>
                </div>
                <span className={styles.spendingTrack}><i style={{ width: item.value > 0 ? `${Math.max(4, (item.value / maxSpending) * 100)}%` : 0 }} /></span>
              </div>
            ))}
            <div className={styles.spendingTotal}><span>Total</span><strong>{formatRupiah(totalSpending)}</strong></div>
          </div>
        </article>
      </section>

      <section className={`${styles.resourceActivityGrid} ${me.role === "KPU" ? styles.resourceActivityGridKpu : ""}`} aria-label="Jadwal fasilitas dan aktivitas terbaru">
        {me.role !== "KPU" && (
          <div className={styles.resourceScheduleStack}>
            {([
              { kind: "room" as const, title: "Jadwal Ruang Meeting Hari Ini", countLabel: "ruangan", rows: roomScheduleRows },
              { kind: "vehicle" as const, title: "Jadwal Vehicle Booking Hari Ini", countLabel: "kendaraan", rows: vehicleScheduleRows },
            ]).map((schedule) => (
              <article className={styles.resourceSchedulePanel} key={schedule.kind}>
                <header className={styles.resourceScheduleHeader}>
                  <div><h2>{schedule.title}</h2><p>{scheduleDateLabel}</p></div>
                </header>
                <div className={styles.resourceScheduleViewport}>
                  {loading && schedule.rows.length === 0 ? <div className={styles.resourceScheduleEmpty}>Memuat jadwal fasilitas...</div>
                    : schedule.rows.length === 0 ? <div className={styles.resourceScheduleEmpty}>Belum ada data {schedule.countLabel}.</div>
                    : (
                      <div className={styles.resourceTimeline}>
                        <div className={styles.resourceTimelineScale} aria-hidden="true">
                          <span />
                          <div>{SCHEDULE_HOURS.map((hour) => <time key={hour} style={{ left: `${((hour * 60 - SCHEDULE_START_MINUTES) / SCHEDULE_DURATION_MINUTES) * 100}%` }}>{String(hour).padStart(2, "0")}</time>)}</div>
                        </div>
                        {schedule.rows.map((row) => (
                          <div className={styles.resourceTimelineRow} key={row.resource}>
                            <strong title={row.resource}>{row.resource}</strong>
                            <div className={styles.resourceTimelineTrack} style={{ minHeight: `${Math.max(36, row.items.length * 27 + 9)}px` }}>
                              {row.items.map((item, index) => {
                                const start = Math.max(SCHEDULE_START_MINUTES, Math.min(item.startMinutes, SCHEDULE_END_MINUTES));
                                const end = Math.max(start + 15, Math.min(item.endMinutes, SCHEDULE_END_MINUTES));
                                const left = ((start - SCHEDULE_START_MINUTES) / SCHEDULE_DURATION_MINUTES) * 100;
                                const width = Math.max(2, ((end - start) / SCHEDULE_DURATION_MINUTES) * 100);
                                return (
                                  <span
                                    className={`${styles.resourceBooking} ${schedule.kind === "vehicle" ? styles.vehicleBooking : ""}`}
                                    key={item.id}
                                    style={{ left: `${left}%`, top: `${5 + index * 27}px`, width: `${Math.min(width, 100 - left)}%` }}
                                    title={`${item.time} · ${item.title} · ${item.detail}`}
                                    tabIndex={0}
                                  >
                                    {item.title}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}

        <section className={`${styles.panel} ${styles.activityPanelTall}`}>
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
      </section>

      <div className={styles.workspace}>
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
      </div>
    </div>
  );
}
