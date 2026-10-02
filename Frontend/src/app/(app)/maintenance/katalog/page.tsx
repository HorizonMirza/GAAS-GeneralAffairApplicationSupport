"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isBookingOriginRole } from "@/lib/constants";
import { formatDate, truncateText } from "@/lib/format";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import { useRowMenu } from "@/lib/useRowMenu";
import { useMasterDataOptions } from "@/lib/useMasterData";
import { useToast } from "@/components/ui/ToastProvider";
import type { KategoriKerusakan, PerbaikanSarana, PerbaikanSaranaCatalogItem } from "@/lib/types";
import SearchableSelect from "@/components/SearchableSelect";
import PeriodFilterPicker from "@/components/PeriodFilterPicker";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import SaranaDetailModal from "@/components/SaranaDetailModal";
import SaranaStatusHistoryModal from "@/components/SaranaStatusHistoryModal";
import SaranaChatModal from "@/components/SaranaChatModal";

interface FilterState {
  page: number;
  limit: number;
  search: string;
  kategori: KategoriKerusakan | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  bulan: string;
  tanggal: string;
}

function defaultFilters(): FilterState {
  return { page: 1, limit: 10, search: "", kategori: "", divisi: "", departemen: "", direktorat: "", bulan: "", tanggal: "" };
}

export default function MaintenanceKatalogPage() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const kategoriOptions = useMasterDataOptions("KATEGORI_KERUSAKAN");

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<PerbaikanSaranaCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  useExclusivePanel(filterOpen, () => setFilterOpen(false));

  const [detail, setDetail] = useState<PerbaikanSarana | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<PerbaikanSaranaCatalogItem | null>(null);
  const rowMenu = useRowMenu(items);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setBusy(true);
    setError("");
    try {
      const result = await api.getSaranaCatalog(filters);
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
    load();
  }, [load]);

  if (!me || me.role === "KPU") return null;

  async function openDetail(id: number) {
    try {
      const item = await api.getSarana(id);
      setDetail(item);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

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
      divisi: filters.divisi,
      departemen: filters.departemen,
      direktorat: filters.direktorat,
      bulan: filters.bulan,
      tanggal: filters.tanggal,
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
  // Divisi user filtering their own approved repairs by unit is just as valid a use case.
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
    <>
    <div className="card">
      <div className="toolbar transactions-page-toolbar">
        <div className="field toolbar-search-field">
          <label htmlFor="filter-sarana-katalog-search">Cari Laporan</label>
          <input type="text" id="filter-sarana-katalog-search" placeholder="Nama Laporan" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="filter-sarana-katalog-bulan">Filter Periode</label>
          <PeriodFilterPicker id="filter-sarana-katalog-bulan" bulan={filters.bulan} tanggal={filters.tanggal} onChangeBulan={(v) => updateFilter({ bulan: v, tanggal: "" })} onChangeTanggal={(v) => updateFilter({ tanggal: v, bulan: "" })} />
        </div>

        <div className="filter-dropdown-wrap" ref={filterWrapRef}>
          <label className="filter-dropdown-label">Filter Lainnya</label>
          <button type="button" className="btn filter-dropdown-toggle" id="filter-sarana-katalog-toggle" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
            <span className="searchable-select-placeholder">Semua Filter</span>
            <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          {filterOpen && (
            <div className="filter-dropdown-panel">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="filter-sarana-katalog-kategori">Kategori</label>
                <SearchableSelect
                  id="filter-sarana-katalog-kategori"
                  value={filters.kategori}
                  onChange={(v) => updateFilter({ kategori: v as KategoriKerusakan | "" })}
                  options={kategoriOptions.options}
                  getLabel={kategoriOptions.getLabel}
                  clearLabel="Semua Kategori"
                  placeholder="Semua Kategori"
                />
              </div>
              {showOrgFilters && (
                <>
                  <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                    <label htmlFor="filter-sarana-katalog-direktorat">Direktorat</label>
                    <SearchableSelect
                      id="filter-sarana-katalog-direktorat"
                      value={filters.direktorat}
                      onChange={(v) => updateFilter({ direktorat: v, divisi: "", departemen: "" })}
                      options={orgStructure?.direktorat || []}
                      clearLabel="Semua Direktorat"
                      placeholder="Semua Direktorat"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                    <label htmlFor="filter-sarana-katalog-divisi">Divisi</label>
                    <SearchableSelect
                      id="filter-sarana-katalog-divisi"
                      value={filters.divisi}
                      onChange={(v) => updateFilter({ divisi: v, departemen: "" })}
                      options={divisiOptions}
                      clearLabel="Semua Divisi"
                      placeholder="Semua Divisi"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                    <label htmlFor="filter-sarana-katalog-departemen">Departemen</label>
                    <SearchableSelect
                      id="filter-sarana-katalog-departemen"
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

        <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Semua Laporan</button>

        <div className="toolbar-actions">
          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.saranaKatalogExportPdfUrl(currentExportParams()), "_blank")}>
            ⬇ Download PDF
          </button>
          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.saranaKatalogExportUrl(currentExportParams()), "_blank")}>
            ⬇ Download Excel
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>No Perbaikan</th><th>Tanggal</th>
              <th>Lokasi</th><th>Kategori</th><th>Deskripsi Kerusakan</th>
              <th>Divisi</th><th>Departemen</th>
              <th>Nama Pelapor</th><th>No. Telepon Pelapor</th><th>Catatan</th><th>Tanggal Disetujui</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={13} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={13} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={13} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>{(filters.page - 1) * filters.limit + index + 1}</td>
                  <td>{item.nomorPerbaikan || "-"}</td>
                  <td>{formatDate(item.tanggal)}</td>
                  <td title={item.lokasi}>{truncateText(item.lokasi, 25)}</td>
                  <td>{kategoriOptions.getLabel(item.kategori)}</td>
                  <td title={item.deskripsiKerusakan}>{truncateText(item.deskripsiKerusakan, 30)}</td>
                  <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                  <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                  <td title={item.namaPelapor}>{truncateText(item.namaPelapor, 15)}</td>
                  <td>{item.noTeleponPelapor || "-"}</td>
                  <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                  <td>{item.approvedApprovalGaAt ? formatDate(item.approvedApprovalGaAt) : "-"}</td>
                  <td>
                    <div className="status-cell">
                      <span className="badge badge-approved">Approved</span>
                      <button
                        type="button"
                        className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}`}
                        aria-label="Chat"
                        onClick={() => setChatItem(item)}
                      >
                        <MessageSquare width="17" height="17" />
                        {item.unreadChatCount > 0 && (
                          <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                        )}
                      </button>
                      <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id, 120)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="pagination-left">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-sarana-katalog-limit">Tampilkan</label>
            <SearchableSelect
              id="filter-sarana-katalog-limit"
              value={String(filters.limit)}
              onChange={(v) => updateFilter({ limit: Number(v) })}
              options={["5", "10", "20", "50"]}
              getLabel={(v) => `${v} Laporan`}
              placeholder={`${filters.limit} Laporan`}
            />
          </div>
        </div>
        <div className="pagination-right">
          <span className="text-secondary">Total {total} Laporan · Halaman {filters.page} dari {totalPages}</span>
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

    <RowMenuDropdown
      position={rowMenu.position}
      canEditDelete={false}
      canDelete={false}
      onDetail={() => {
        const item = rowMenu.menuItem;
        rowMenu.close();
        if (item) openDetail(item.id);
      }}
      onUpdates={() => {}}
      onStatus={() => {
        const item = rowMenu.menuItem;
        rowMenu.close();
        if (item) setStatusItemId(item.id);
      }}
      onDelete={() => {}}
      pdfUrl={rowMenu.menuItem ? api.saranaPdfUrl(rowMenu.menuItem.id) : undefined}
      onPdfClick={async () => {
        const item = rowMenu.menuItem;
        rowMenu.close();
        if (!item) return;
        try {
          await downloadFile(api.saranaPdfUrl(item.id), `Bukti-Perbaikan-Sarana-${item.nomorPerbaikan || item.id}.pdf`);
        } catch (err) {
          showToast((err as Error).message, "error");
        }
      }}
    />

    {me && (
      <SaranaDetailModal
        open={!!detail}
        mode="view"
        item={detail}
        me={me}
        onClose={() => setDetail(null)}
        onSaved={() => {}}
        onRequestReject={() => {}}
      />
    )}

    <SaranaStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

    {me && (
      <SaranaChatModal
        open={!!chatItem}
        itemId={chatItem?.id ?? null}
        itemLabel={chatItem ? `${chatItem.lokasi} - ${chatItem.nomorPerbaikan || "-"}` : ""}
        departemen={chatItem?.departemen ?? null}
        me={me}
        onClose={() => setChatItem(null)}
        onRead={load}
      />
    )}
    </>
  );
}
