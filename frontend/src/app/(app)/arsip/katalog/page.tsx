"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ARCHIVE_KATEGORI_LABEL, isBookingOriginRole } from "@/lib/constants";
import { formatDate, truncateText } from "@/lib/format";
import { useClickOutside } from "@/lib/useClickOutside";
import type { ArchiveKategori, PermintaanArsipCatalogItem } from "@/lib/types";
import SearchableSelect from "@/components/SearchableSelect";

const KATEGORI_OPTIONS = Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[];

interface FilterState {
  page: number;
  limit: number;
  search: string;
  kategori: ArchiveKategori | "";
  tahun: string;
  divisi: string;
  departemen: string;
  direktorat: string;
}

function defaultFilters(): FilterState {
  return { page: 1, limit: 10, search: "", kategori: "", tahun: "", divisi: "", departemen: "", direktorat: "" };
}

export default function ArsipKatalogPage() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<PermintaanArsipCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setBusy(true);
    setError("");
    try {
      const result = await api.getArsipCatalog(filters);
      if (reqId !== reqIdRef.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setError((err as Error).message);
    } finally {
      if (reqId === reqIdRef.current) setBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => updateFilter({ search: value.trim() }), 350);
  }

  function resetFilters() {
    setSearchInput("");
    setFilters(defaultFilters());
  }

  function currentExportParams() {
    return {
      search: filters.search,
      kategori: filters.kategori,
      tahun: filters.tahun,
      divisi: filters.divisi,
      departemen: filters.departemen,
      direktorat: filters.direktorat,
    };
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  // Anchored at the current page (not a fixed 2-wide window pulled back from the end), so the
  // last page shows just itself instead of always padding in the page before it too.
  const pageStart = Math.min(Math.max(1, filters.page), totalPages);
  const pageEnd = Math.min(totalPages, pageStart + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  // Matches Transaction's filter panel (isBookingOriginRole) instead of GA-only - a Departemen/
  // Divisi user filtering their own approved archive by unit is just as valid a use case.
  const showOrgFilters = isBookingOriginRole(me.role);

  const selectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === filters.direktorat) || null;
  const divisiOptions = selectedDirektoratNode
    ? selectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const selectedDivisiNode = filters.divisi
    ? (selectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === filters.divisi
      )
    : null;
  const departemenOptions = selectedDivisiNode
    ? selectedDivisiNode.departemen
    : selectedDirektoratNode
      ? selectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  return (
    <div className="card">
      <div className="toolbar transactions-page-toolbar">
        <div className="field toolbar-search-field">
          <label htmlFor="filter-katalog-search">Cari Arsip</label>
          <input type="text" id="filter-katalog-search" placeholder="Nama Arsip" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="filter-katalog-tahun">Tahun Arsip</label>
          <input type="text" id="filter-katalog-tahun" inputMode="numeric" placeholder="2020" value={filters.tahun} onChange={(e) => updateFilter({ tahun: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
        </div>

        <div className="filter-dropdown-wrap" ref={filterWrapRef}>
          <label className="field-label-spacer">Filter</label>
          <button type="button" className="btn btn-secondary" id="filter-katalog-toggle" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            Semua Filter
            <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          {filterOpen && (
            <div className="filter-dropdown-panel">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="filter-katalog-kategori">Kategori</label>
                <SearchableSelect
                  id="filter-katalog-kategori"
                  value={filters.kategori}
                  onChange={(v) => updateFilter({ kategori: v as ArchiveKategori | "" })}
                  options={KATEGORI_OPTIONS}
                  getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
                  clearLabel="Semua Kategori"
                  placeholder="Semua Kategori"
                />
              </div>
              {showOrgFilters && (
                <>
                  <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                    <label htmlFor="filter-katalog-direktorat">Direktorat</label>
                    <SearchableSelect
                      id="filter-katalog-direktorat"
                      value={filters.direktorat}
                      onChange={(v) => updateFilter({ direktorat: v, divisi: "", departemen: "" })}
                      options={orgStructure?.direktorat || []}
                      clearLabel="Semua Direktorat"
                      placeholder="Semua Direktorat"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                    <label htmlFor="filter-katalog-divisi">Divisi</label>
                    <SearchableSelect
                      id="filter-katalog-divisi"
                      value={filters.divisi}
                      onChange={(v) => updateFilter({ divisi: v, departemen: "" })}
                      options={divisiOptions}
                      clearLabel="Semua Divisi"
                      placeholder="Semua Divisi"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                    <label htmlFor="filter-katalog-departemen">Departemen</label>
                    <SearchableSelect
                      id="filter-katalog-departemen"
                      value={filters.departemen}
                      onChange={(v) => updateFilter({ departemen: v })}
                      options={departemenOptions}
                      clearLabel="Semua Departemen"
                      placeholder="Semua Departemen"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Semua Arsip</button>

        <div className="toolbar-actions">
          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.arsipKatalogExportPdfUrl(currentExportParams()), "_blank")}>
            ⬇ Download PDF
          </button>
          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.arsipKatalogExportUrl(currentExportParams()), "_blank")}>
            ⬇ Download Excel
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>Nama Arsip</th><th>Kategori</th><th>Tahun</th><th>Jumlah</th><th>Satuan</th>
              <th>No Pemindahan</th><th>Tujuan</th><th>Nama PIC</th><th>Telp. PIC</th><th>Lokasi Penyimpanan</th>
              <th>Divisi</th><th>Departemen</th><th>Catatan</th><th>Tanggal Disetujui</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={15} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={15} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={15} className="table-empty">Belum ada arsip yang resmi dipindahkan untuk filter ini.</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>{(filters.page - 1) * filters.limit + index + 1}</td>
                  <td title={item.namaArsip}>{truncateText(item.namaArsip, 30)}</td>
                  <td>{ARCHIVE_KATEGORI_LABEL[item.kategori]}</td>
                  <td>{item.tahunArsip}</td>
                  <td>{item.jumlah}</td>
                  <td>{item.satuan}</td>
                  <td>{item.nomorArsip || "-"}</td>
                  <td title={item.keperluan}>{truncateText(item.keperluan, 25)}</td>
                  <td title={item.namaPic || ""}>{truncateText(item.namaPic, 15)}</td>
                  <td>{item.noTeleponPic || "-"}</td>
                  <td title={item.lokasiPenyimpanan}>{truncateText(item.lokasiPenyimpanan, 25)}</td>
                  <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                  <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                  <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                  <td>{item.approvedApprovalGaAt ? formatDate(item.approvedApprovalGaAt) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="pagination-left">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-katalog-limit">Tampilkan</label>
            <SearchableSelect
              id="filter-katalog-limit"
              value={String(filters.limit)}
              onChange={(v) => updateFilter({ limit: Number(v) })}
              options={["5", "10", "20", "50"]}
              getLabel={(v) => `${v} arsip`}
              placeholder={`${filters.limit} arsip`}
            />
          </div>
        </div>
        <div className="pagination-right">
          <span className="text-secondary">Total {total} Arsip · Halaman {filters.page} dari {totalPages}</span>
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
