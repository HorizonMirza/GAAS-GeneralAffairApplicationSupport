"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Car,
  ChevronRight,
  Folder,
  Layers,
  LayoutDashboard,
  Pencil,
  RefreshCw,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import PeriodFilterPicker from "@/components/PeriodFilterPicker";
import SearchableSelect from "@/components/SearchableSelect";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import { api } from "@/lib/api";
import type { Me, OrgStructure } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import styles from "./DashboardContent.module.css";

type ModuleKey = "expedition" | "room" | "vehicle" | "atk" | "maintenance" | "archive";
type DashboardView = "all" | ModuleKey;
type DashboardStatusSelection = "DRAFT" | "ON_APPROVAL" | "REJECTED" | "COMPLETED" | "";

interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  overviewHref: string;
  hiddenForKpu?: boolean;
}

interface CommonStatsResult {
  countsByStatus: Partial<Record<string, number>>;
}

interface ModuleSource {
  stats: (bulan?: string, tanggal?: string, divisi?: string, direktorat?: string, departemen?: string) => Promise<CommonStatsResult>;
}

interface ModuleSummary {
  total: number;
  pending: number;
  completed: number;
  rejected: number;
  failed: boolean;
}

interface DashboardState {
  summaries: Record<ModuleKey, ModuleSummary>;
  errors: number;
}

const MODULES: ModuleDefinition[] = [
  { key: "expedition", label: "Expedition", shortLabel: "Eksp.", Icon: Layers, overviewHref: "/ekspedisi/overview" },
  { key: "room", label: "Room Booking", shortLabel: "Ruang", Icon: Calendar, overviewHref: "/booking-ruang-meeting/overview", hiddenForKpu: true },
  { key: "vehicle", label: "Vehicle Booking", shortLabel: "Kend.", Icon: Car, overviewHref: "/booking-kendaraan/overview", hiddenForKpu: true },
  { key: "atk", label: "Office Supplies", shortLabel: "ATK", Icon: Pencil, overviewHref: "/office-supplies/overview" },
  { key: "maintenance", label: "Maintenance", shortLabel: "Maint.", Icon: Wrench, overviewHref: "/maintenance/overview", hiddenForKpu: true },
  { key: "archive", label: "Archive", shortLabel: "Arsip", Icon: Folder, overviewHref: "/arsip/overview", hiddenForKpu: true },
];

const EMPTY_SUMMARY: ModuleSummary = { total: 0, pending: 0, completed: 0, rejected: 0, failed: false };

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
  },
  room: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getBookingStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
  },
  vehicle: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getKendaraanStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
  },
  atk: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getAtkStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
  },
  maintenance: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getSaranaStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
  },
  archive: {
    stats: async (bulan, tanggal, divisi, direktorat, departemen) => {
      const result = await api.getArsipStats(bulan, tanggal, divisi, direktorat, departemen);
      return { countsByStatus: result.countsByStatus as Partial<Record<string, number>> };
    },
  },
};

function sumStatuses(counts: Partial<Record<string, number>>, statuses: string[]): number {
  return statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);
}

function summarizeModule(key: ModuleKey, counts: Partial<Record<string, number>>): Omit<ModuleSummary, "failed"> {
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
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<DashboardState>({ summaries: emptySummaries(), errors: 0 });
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
    ? "Keseluruhan"
    : visibleModules.find((module) => module.key === activeView)?.label ?? "Keseluruhan";

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
    const results = await Promise.all(visibleModules.map(async (module) => {
      const [statsResult] = await Promise.allSettled([
        MODULE_SOURCES[module.key].stats(
          month || undefined,
          date || undefined,
          divisi || undefined,
          direktorat || undefined,
          departemen || undefined,
        ),
      ]);
      const counts = statsResult.status === "fulfilled"
        ? filterCountsBySelection(module.key, statsResult.value.countsByStatus, status)
        : {};
      return {
        key: module.key,
        summary: {
          ...summarizeModule(module.key, counts),
          failed: statsResult.status === "rejected",
        } satisfies ModuleSummary,
      };
    }));

    const summaries = emptySummaries();
    results.forEach((result) => { summaries[result.key] = result.summary; });
    setState({ summaries, errors: results.filter((result) => result.summary.failed).length });
    setLoading(false);
  }, [date, departemen, direktorat, divisi, month, status, visibleModules]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard, refreshToken]);

  function resetDashboard() {
    setActiveView("all");
    setMonth("");
    setDate("");
    setStatus("");
    setDirektorat("");
    setDivisi("");
    setDepartemen("");
    setFilterOpen(false);
    setRefreshToken((value) => value + 1);
  }

  const totals = useMemo(() => selectedModules.reduce((result, module) => {
    const summary = state.summaries[module.key];
    result.total += summary.total;
    result.pending += summary.pending;
    result.completed += summary.completed;
    result.rejected += summary.rejected;
    return result;
  }, { total: 0, pending: 0, completed: 0, rejected: 0 }), [selectedModules, state.summaries]);

  const completedPercent = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;
  const pendingPercent = totals.total > 0 ? Math.round((totals.pending / totals.total) * 100) : 0;
  const rejectedPercent = totals.total > 0 ? Math.round((totals.rejected / totals.total) * 100) : 0;
  const donutStyle = {
    "--completed-angle": `${(totals.completed / Math.max(1, totals.total)) * 360}deg`,
    "--pending-angle": `${((totals.completed + totals.pending) / Math.max(1, totals.total)) * 360}deg`,
    "--rejected-angle": `${((totals.completed + totals.pending + totals.rejected) / Math.max(1, totals.total)) * 360}deg`,
  } as CSSProperties;
  const maxBarValue = Math.max(
    1,
    ...selectedModules.flatMap((module) => {
      const summary = state.summaries[module.key];
      return [summary.completed, summary.pending, summary.rejected];
    }),
  );
  const periodText = periodDescription(month, date);

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.greeting}><WelcomeGreeting me={me} /></div>
      </header>

      <nav className={styles.moduleTabs} aria-label="Dashboard per modul">
        <button type="button" className={activeView === "all" ? styles.moduleTabActive : ""} aria-pressed={activeView === "all"} onClick={() => setActiveView("all")}>
          <LayoutDashboard aria-hidden="true" /><span>Keseluruhan</span>
        </button>
        {visibleModules.map(({ key, label, Icon }) => (
          <button key={key} type="button" className={activeView === key ? styles.moduleTabActive : ""} aria-pressed={activeView === key} onClick={() => setActiveView(key)}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>

      <section className={styles.filterBar} aria-label="Filter dashboard">
        <div className={styles.filterControls}>
          <div className={styles.filterField}>
            <label htmlFor="dashboard-period">Filter Periode</label>
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
          </div>
          <div className={styles.filterField}>
            <label htmlFor="dashboard-filter-toggle">Filter Lainnya</label>
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
          </div>
          <button type="button" className={styles.refreshButton} onClick={resetDashboard} disabled={loading} title="Reset filter dan muat ulang dashboard" aria-label="Reset filter dan muat ulang dashboard">
            <RefreshCw className={loading ? styles.spinning : ""} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.activeContext}><span>{activeModuleLabel}</span><strong>{periodText}</strong></div>
      </section>

      {state.errors > 0 && !loading && <div className={styles.partialWarning} role="status"><AlertTriangle aria-hidden="true" />Sebagian data belum dapat dimuat. Gunakan tombol muat ulang untuk mencoba kembali.</div>}

      <section className={`${styles.moduleGrid} ${selectedModules.length === 1 ? styles.singleModule : ""}`} aria-label="Total transaksi per modul">
        {selectedModules.map(({ key, label, Icon, overviewHref }) => {
          const summary = state.summaries[key];
          return (
            <Link key={key} href={overviewHref} className={styles.moduleCard} aria-label={`Buka Overview ${label}`}>
              <span className={styles.moduleCardHeader}><Icon aria-hidden="true" /><strong>{label}</strong></span>
              <span className={styles.moduleCardValue}>{summary.failed ? "-" : summary.total.toLocaleString("id-ID")}</span>
              <span className={styles.moduleCardMeta}>{summary.failed ? "Data tidak tersedia" : `${summary.completed.toLocaleString("id-ID")} selesai · ${summary.pending.toLocaleString("id-ID")} diproses`}</span>
              <ChevronRight className={styles.moduleCardArrow} aria-hidden="true" />
            </Link>
          );
        })}
      </section>

      <section className={styles.analyticsGrid} aria-label="Analitik dashboard">
        <article className={styles.statusPanel}>
          <header className={styles.panelHeader}><div><h2>Status Keseluruhan</h2><p>{activeModuleLabel} · {periodText}</p></div></header>
          <div className={styles.statusContent}>
            <div className={styles.donut} style={donutStyle} role="img" aria-label={`${totals.completed} selesai, ${totals.pending} diproses, ${totals.rejected} ditolak`}>
              <div className={styles.donutCenter}><strong>{totals.total.toLocaleString("id-ID")}</strong><span>transaksi</span></div>
            </div>
            <div className={styles.statusLegend}>
              <div><span><i className={styles.completedDot} />Selesai</span><strong>{totals.completed.toLocaleString("id-ID")} <em>{completedPercent}%</em></strong></div>
              <div><span><i className={styles.pendingDot} />Diproses</span><strong>{totals.pending.toLocaleString("id-ID")} <em>{pendingPercent}%</em></strong></div>
              <div><span><i className={styles.rejectedDot} />Ditolak</span><strong>{totals.rejected.toLocaleString("id-ID")} <em>{rejectedPercent}%</em></strong></div>
            </div>
          </div>
        </article>

        <article className={styles.comparisonPanel}>
          <header className={styles.panelHeader}>
            <div><h2>Perbandingan Antar Modul</h2><p>Volume selesai, diproses, dan ditolak · {periodText}</p></div>
            <div className={styles.chartLegend} aria-label="Legenda grafik"><span><i className={styles.completedDot} />Selesai</span><span><i className={styles.pendingDot} />Diproses</span><span><i className={styles.rejectedDot} />Ditolak</span></div>
          </header>
          <div className={styles.chartViewport}>
            <div className={styles.chartGrid} aria-hidden="true"><span /><span /><span /><span /></div>
            <div className={styles.barGroups} style={{ gridTemplateColumns: `repeat(${selectedModules.length}, minmax(62px, 1fr))` }}>
              {selectedModules.map((module) => {
                const summary = state.summaries[module.key];
                const values = [
                  { key: "completed", value: summary.completed, className: styles.completedBar },
                  { key: "pending", value: summary.pending, className: styles.pendingBar },
                  { key: "rejected", value: summary.rejected, className: styles.rejectedBar },
                ];
                return (
                  <div className={styles.barGroup} key={module.key}>
                    <div className={styles.bars}>
                      {values.map((item) => (
                        <span key={item.key} className={`${styles.bar} ${item.className}`} style={{ height: item.value > 0 ? `${Math.max(7, (item.value / maxBarValue) * 100)}%` : 0 }} title={`${module.label}: ${item.value.toLocaleString("id-ID")}`}>
                          {item.value > 0 && <small>{item.value.toLocaleString("id-ID")}</small>}
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
    </div>
  );
}
