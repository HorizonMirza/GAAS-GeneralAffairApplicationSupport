"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  LOG_ROLE_LABEL,
  RIWAYAT_ACTION_FILTER_LABEL,
  RIWAYAT_ACTION_OPTIONS,
  RIWAYAT_MODUL_HREF,
  RIWAYAT_MODUL_LABEL,
  riwayatActionMeta,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { RiwayatAktivitas, RiwayatAktor, RiwayatModul, Role } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import SearchableSelect from "@/components/SearchableSelect";
import DateFilterPicker from "@/components/DateFilterPicker";
import PeriodFilterPicker from "@/components/PeriodFilterPicker";

interface FilterState {
  page: number;
  limit: number;
  search: string;
  bulan: string;
  tanggal: string;
  modul: RiwayatModul | "";
  actorId: string;
  action: string;
  dariTanggal: string;
  sampaiTanggal: string;
}

const EMPTY_FILTERS: FilterState = {
  page: 1,
  limit: 20,
  search: "",
  bulan: "",
  tanggal: "",
  modul: "",
  actorId: "",
  action: "",
  dariTanggal: "",
  sampaiTanggal: "",
};

const MODUL_OPTIONS = Object.keys(RIWAYAT_MODUL_LABEL) as RiwayatModul[];

// APPROVED_L1/REJECTED_L1 name a track, not a fixed role - an Approval Divisi and an Approval
// Departemen both produce the same action code, so the actor's own role decides the wording,
// the same way ApprovalLog does it for the per-item history.
function actionTitle(row: RiwayatAktivitas): string {
  const meta = riwayatActionMeta(row.modul, row.action);
  if (row.action === "APPROVED_L1" || row.action === "REJECTED_L1") {
    const track = row.actorRole === "APPROVAL_DIVISI" ? "Divisi" : "Departemen";
    return row.action === "APPROVED_L1" ? `Disetujui Approval ${track}` : `Ditolak Approval ${track}`;
  }
  return meta.label;
}

const BADGE_CLASS: Record<"neutral" | "approve" | "reject", string> = {
  neutral: "badge-draft",
  approve: "badge-approved",
  reject: "badge-rejected",
};

// Every module records who-did-what-when in its own *_logs table, but each one is only readable
// through that module's own {id}/logs endpoint - so an audit question that spans modules ("what
// did this person do last week") had no answer inside the app. This is the Super Admin view over
// the backend's union of all seven.
export default function RiwayatAktivitasCard() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<RiwayatAktivitas[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [aktor, setAktor] = useState<RiwayatAktor[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);

  useExclusivePanel(filterOpen, () => setFilterOpen(false));
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.listRiwayatAktivitas({
        page: filters.page,
        limit: filters.limit,
        search: filters.search,
        bulan: filters.bulan,
        tanggal: filters.tanggal,
        modul: filters.modul,
        actorId: filters.actorId ? Number(filters.actorId) : "",
        action: filters.action,
        dariTanggal: filters.dariTanggal,
        sampaiTanggal: filters.sampaiTanggal,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "Gagal memuat riwayat aktivitas");
    } finally {
      setBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Loaded once: the actor list only grows when someone acts, and a stale entry here costs
  // nothing (the row it filters to still exists).
  useEffect(() => {
    api.listRiwayatAktor().then(setAktor).catch(() => setAktor([]));
  }, []);

  // Any filter change resets to page 1 - staying on page 7 of a narrower result set would show
  // an empty table with no explanation.
  const updateFilter = (patch: Partial<FilterState>) => setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  const goToPage = (page: number) => setFilters((prev) => ({ ...prev, page }));
  const resetFilters = () => {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
    setFilterOpen(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.min(Math.max(1, filters.page), totalPages);
  const pageEnd = Math.min(totalPages, pageStart + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const aktorLabel = (id: string) => {
    const found = aktor.find((a) => String(a.id) === id);
    if (!found) return id;
    const role = LOG_ROLE_LABEL[found.role as Role] || found.role;
    return `${found.nama} (${role})`;
  };

  const hasOtherFilters = !!filters.modul || !!filters.actorId || !!filters.action || !!filters.dariTanggal || !!filters.sampaiTanggal;

  return (
    <div className="card">
      <div className="toolbar transactions-page-toolbar">
        <div className="field toolbar-search-field">
          <label htmlFor="filter-riwayat-search">Cari Nomor</label>
          <input
            type="text"
            id="filter-riwayat-search"
            placeholder="Nomor Transaksi"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="filter-riwayat-bulan">Filter Periode</label>
          <PeriodFilterPicker
            id="filter-riwayat-bulan"
            bulan={filters.bulan}
            tanggal={filters.tanggal}
            onChangeBulan={(v) => updateFilter({ bulan: v, tanggal: "" })}
            onChangeTanggal={(v) => updateFilter({ tanggal: v, bulan: "" })}
          />
        </div>

        <div className="filter-dropdown-wrap" ref={filterWrapRef}>
          <label className="filter-dropdown-label">Filter Lainnya</label>
          <button
            type="button"
            className="btn filter-dropdown-toggle"
            id="filter-riwayat-toggle"
            style={{ minWidth: 145, justifyContent: "space-between" }}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <span className={hasOtherFilters ? "" : "searchable-select-placeholder"}>
              {hasOtherFilters ? "Filter Aktif" : "Semua Filter"}
            </span>
            <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          {filterOpen && (
            <div className="filter-dropdown-panel">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="filter-riwayat-modul">Modul</label>
                <SearchableSelect
                  id="filter-riwayat-modul"
                  value={filters.modul}
                  onChange={(v) => updateFilter({ modul: v as RiwayatModul | "" })}
                  options={MODUL_OPTIONS}
                  getLabel={(v) => RIWAYAT_MODUL_LABEL[v as RiwayatModul] || v}
                  clearLabel="Semua Modul"
                  placeholder="Semua Modul"
                />
              </div>
              <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                <label htmlFor="filter-riwayat-aktor">Pelaku</label>
                <SearchableSelect
                  id="filter-riwayat-aktor"
                  value={filters.actorId}
                  onChange={(v) => updateFilter({ actorId: v })}
                  options={aktor.map((a) => String(a.id))}
                  getLabel={aktorLabel}
                  clearLabel="Semua Pelaku"
                  placeholder="Semua Pelaku"
                  emptyOptionsText="Belum ada aktivitas tercatat"
                />
              </div>
              <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                <label htmlFor="filter-riwayat-action">Aksi</label>
                <SearchableSelect
                  id="filter-riwayat-action"
                  value={filters.action}
                  onChange={(v) => updateFilter({ action: v })}
                  options={RIWAYAT_ACTION_OPTIONS}
                  getLabel={(v) => RIWAYAT_ACTION_FILTER_LABEL[v] || riwayatActionMeta("ekspedisi", v).label}
                  clearLabel="Semua Aksi"
                  placeholder="Semua Aksi"
                />
              </div>
              <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                <label htmlFor="filter-riwayat-dari">Dari Tanggal (Kustom)</label>
                <DateFilterPicker
                  id="filter-riwayat-dari"
                  value={filters.dariTanggal}
                  onChange={(v) => updateFilter({ dariTanggal: v })}
                  placeholder="Semua Tanggal"
                />
              </div>
              <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                <label htmlFor="filter-riwayat-sampai">Sampai Tanggal (Kustom)</label>
                <DateFilterPicker
                  id="filter-riwayat-sampai"
                  value={filters.sampaiTanggal}
                  onChange={(v) => updateFilter({ sampaiTanggal: v })}
                  placeholder="Semua Tanggal"
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "auto", alignSelf: "flex-end", height: 38, padding: "0 16px", borderRadius: 8, boxSizing: "border-box" }}
          onClick={resetFilters}
        >
          Semua Aktivitas
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Waktu</th>
              <th>Modul</th>
              <th>Nomor</th>
              <th>Aksi</th>
              <th>Pelaku</th>
              <th>Role</th>
              <th>Divisi</th>
              <th>Departemen</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={10} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={10} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              items.map((row, index) => {
                const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                const meta = riwayatActionMeta(row.modul, row.action);
                const hasDirectLink = row.itemId && row.modul !== "deleted" && row.modul !== "admin";
                return (
                  <tr key={`${row.modul}-${row.itemId}-${row.createdAt}-${row.action}-${index}`}>
                    <td>{rowNumber}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.createdAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link
                        href={`${RIWAYAT_MODUL_HREF[row.modul]}${hasDirectLink ? `?highlight=${row.itemId}` : ""}`}
                        style={{ color: "var(--blue-600)", fontWeight: 500, textDecoration: "none" }}
                      >
                        {RIWAYAT_MODUL_LABEL[row.modul]}
                      </Link>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                      {row.nomor ? (
                        hasDirectLink ? (
                          <Link
                            href={`${RIWAYAT_MODUL_HREF[row.modul]}?highlight=${row.itemId}`}
                            style={{ color: "inherit", textDecoration: "underline" }}
                          >
                            {row.nomor}
                          </Link>
                        ) : (
                          row.nomor
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <span className={`badge ${BADGE_CLASS[meta.type]}`}>{actionTitle(row)}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{row.actorNama || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.actorRole ? LOG_ROLE_LABEL[row.actorRole as Role] || row.actorRole : "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.actorDivisi || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.actorDepartemen || "-"}</td>
                    <td style={{ minWidth: 200, wordBreak: "break-word" }}>{row.reason || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="pagination-left">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-riwayat-limit">Tampilkan</label>
            <SearchableSelect
              id="filter-riwayat-limit"
              value={String(filters.limit)}
              onChange={(v) => updateFilter({ limit: Number(v) })}
              options={["10", "20", "50", "100"]}
              getLabel={(v) => `${v} aktivitas`}
              placeholder={`${filters.limit} aktivitas`}
            />
          </div>
        </div>
        <div className="pagination-right">
          <span className="text-secondary">Total {total} Aktivitas · Halaman {filters.page} dari {totalPages}</span>
          <div className="pages">
            <button className="page-btn" disabled={filters.page <= 1} onClick={() => goToPage(filters.page - 1)}>‹</button>
            {pageButtons.map((p) => (
              <button key={p} className={`page-btn ${p === filters.page ? "active" : ""}`} onClick={() => goToPage(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={filters.page >= totalPages} onClick={() => goToPage(filters.page + 1)}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
