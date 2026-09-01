"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isEditableByOrigin } from "@/lib/constants";
import { formatCurrency, formatDate, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Pengiriman, Status } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import PengirimanFormModal from "@/components/PengirimanFormModal";
import PengirimanDetailModal from "@/components/PengirimanDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import StatusHistoryModal from "@/components/StatusHistoryModal";
import ChatModal from "@/components/ChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import SearchableSelect from "@/components/SearchableSelect";

interface FilterState {
  page: number;
  limit: number;
  bulan: string;
  search: string;
  // "REJECTED" is a synthetic value (not a real Status) meaning "any of the 4 reject-stage
  // statuses" - collapsed into one Status filter dropdown option.
  status: Status | "REJECTED" | "";
  divisi: string;
  departemen: string;
  direktorat: string;
}

const EMPTY_FILTERS: FilterState = { page: 1, limit: 10, bulan: "", search: "", status: "", divisi: "", departemen: "", direktorat: "" };

function TransaksiPageInner() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<Pengiriman[]>([]);
  const [total, setTotal] = useState(0);
  const [totalBulanIni, setTotalBulanIni] = useState<number | null>(null);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: Pengiriman; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<Pengiriman | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string; createdByRole: string } | null>(null);

  const rowMenu = useRowMenu(items);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const filterBulanInputRef = useRef<HTMLInputElement>(null);
  const tableReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  // Some browsers restore a previously-typed value into this input on page reload without
  // firing onChange, leaving it visually filled while React's state (the actual source of
  // truth for the API call) stays empty. Force the DOM back in sync with state on mount.
  useEffect(() => {
    if (filterBulanInputRef.current) filterBulanInputRef.current.value = filters.bulan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  // An activity/chat notification banner's click lands here with ?chat=<itemId> - fetched
  // directly (not found-in-loaded-items, since the item may not be on whatever page/filter is
  // currently shown) so the thread opens regardless of pagination. The param is stripped right
  // after so a later refresh of this same URL doesn't keep reopening it.
  useEffect(() => {
    const chatId = searchParams.get("chat");
    if (!chatId) return;
    api.getPengiriman(Number(chatId)).then(setChatItem).catch(() => {});
    router.replace("/ekspedisi/transaksi");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadTable = useCallback(async () => {
    const reqId = ++tableReqIdRef.current;
    setTableBusy(true);
    setTableError("");
    try {
      const result = await api.listPengiriman({
        page: filters.page,
        limit: filters.limit,
        bulan: filters.bulan,
        nomorTransmittal: filters.search,
        status: filters.status,
        divisi: filters.divisi,
        departemen: filters.departemen,
        direktorat: filters.direktorat,
      });
      // A slower earlier request can resolve after a newer one triggered by changing a filter -
      // ignore it so it doesn't clobber the results that actually match the current filters.
      if (reqId !== tableReqIdRef.current) return;
      const pengirimanItems = result?.items ?? [];
      const pengirimanTotal = result?.total ?? 0;
      // The page we were on can end up past the end after a delete (e.g. the last row on the
      // last page got removed) - back off one page instead of showing a blank "no data" table.
      if (pengirimanItems.length === 0 && pengirimanTotal > 0 && filters.page > 1) {
        setFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setItems(pengirimanItems);
      setTotal(pengirimanTotal);
      setTotalBulanIni(result?.totalBulanIni ?? null);
    } catch (err) {
      if (reqId !== tableReqIdRef.current) return;
      setTableError((err as Error).message);
    } finally {
      if (reqId === tableReqIdRef.current) setTableBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"].includes(me.role)
    : false;

  if (!me || me.role === "SUPER_ADMIN") return null;

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      updateFilter({ search: value.trim() });
    }, 350);
  }

  function resetFilters() {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function currentExportParams() {
    return {
      bulan: filters.bulan,
      status: filters.status,
      divisi: filters.divisi,
      departemen: filters.departemen,
      direktorat: filters.direktorat,
      nomor_transmittal: filters.search,
    };
  }

  function handleDelete(item: Pengiriman) {
    confirm("Hapus data pengiriman ini secara permanen?", async () => {
      try {
        await api.deletePengiriman(item.id);
        showToast("Data berhasil dihapus");
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.max(1, Math.min(filters.page, totalPages - 1));
  const pageEnd = Math.min(totalPages, pageStart + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const showOrgFilters = [
    "ADMIN_DEPARTEMEN",
    "APPROVAL_DEPARTEMEN",
    "ADMIN_DIVISI",
    "APPROVAL_DIVISI",
    "ADMIN_GA",
    "APPROVAL_GA",
    "KPU",
  ].includes(me.role);

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
            <label htmlFor="filter-search">Cari Transaksi</label>
            <input type="text" id="filter-search" placeholder="No Transmittal" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="filter-bulan">Filter Bulan</label>
            <input type="month" id="filter-bulan" autoComplete="off" ref={filterBulanInputRef} value={filters.bulan} onChange={(e) => updateFilter({ bulan: e.target.value })} />
          </div>

          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="field-label-spacer">Filter</label>
            <button type="button" className="btn btn-secondary" id="filter-toggle" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field">
                  <label htmlFor="filter-status">Status</label>
                  <SearchableSelect
                    id="filter-status"
                    value={filters.status}
                    onChange={(v) => updateFilter({ status: v as Status | "REJECTED" | "" })}
                    options={["DRAFT", "SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL", "REJECTED", "COMPLETED"]}
                    getLabel={(v) => ({
                      DRAFT: "Draft",
                      SUBMITTED: "On-Approval: Approval Departemen/Divisi",
                      APPROVED_L1: "On-Approval: Admin GA",
                      APPROVED_GA: "On-Approval: Approval GA",
                      APPROVED_GA_APPROVAL: "On-Approval: KPU",
                      REJECTED: "Rejected",
                      COMPLETED: "Approved",
                    } as Record<string, string>)[v] || v}
                    clearLabel="Semua Status"
                    placeholder="Semua Status"
                  />
                </div>
                {showOrgFilters && (
                  <>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-direktorat">Direktorat</label>
                      <SearchableSelect
                        id="filter-direktorat"
                        value={filters.direktorat}
                        onChange={(v) => updateFilter({ direktorat: v, divisi: "", departemen: "" })}
                        options={orgStructure?.direktorat || []}
                        clearLabel="Semua Direktorat"
                        placeholder="Semua Direktorat"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-divisi">Divisi</label>
                      <SearchableSelect
                        id="filter-divisi"
                        value={filters.divisi}
                        onChange={(v) => updateFilter({ divisi: v, departemen: "" })}
                        options={divisiOptions}
                        clearLabel="Semua Divisi"
                        placeholder="Semua Divisi"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-departemen">Departemen</label>
                      <SearchableSelect
                        id="filter-departemen"
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

          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Semua Transaksi</button>

          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.pdfUrl(currentExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.exportUrl(currentExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            {isOrigin && (
              <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>+ Input Data Barang</button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Transmittal</th><th>No Resi</th><th>Tanggal</th><th>Tujuan</th><th>Item</th><th>Divisi</th><th>Departemen</th>
                <th>Pengirim</th><th>Telp. Pengirim</th><th>Penerima</th><th>Telp. Penerima</th>
                <th>Kode Program</th><th>Asuransi</th><th>Packing</th><th>Catatan</th>
                <th>Berat (Kg)</th><th>Harga Ongkos Kirim</th><th>Total</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={20} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={20} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={20} className="table-empty">Tidak ada data untuk filter ini.</td></tr>
              ) : (
                items.map((item, index) => {
                  const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorTransmittal}</td>
                      <td>{item.noResi || "-"}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td title={item.tujuanPenerimaan}>{truncateText(item.tujuanPenerimaan, 15)}</td>
                      <td>{item.jumlahItem}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.namaPengirim}>{truncateText(item.namaPengirim, 18)}</td>
                      <td>{item.noTeleponPengirim}</td>
                      <td title={item.namaPenerima}>{truncateText(item.namaPenerima, 18)}</td>
                      <td>{item.noTeleponPenerima}</td>
                      <td>{item.kodeProgram}</td>
                      <td>{item.asuransiStatus}</td>
                      <td title={item.requestPacking || ""}>{truncateText(item.requestPacking, 15)}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>{item.beratBarangKg ?? "-"}</td>
                      <td>{item.subTotal ? formatCurrency(item.subTotal) : "-"}</td>
                      <td>{item.total ? formatCurrency(item.total) : "-"}</td>
                      <td>
                        <div className="status-cell">
                          <StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setChatItem(item)}
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id, 180)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA", "KPU"].includes(me.role) && totalBulanIni != null && (
          <div className="total-akumulasi-footer">
            <span className="total-akumulasi-label">Total Akumulasi Biaya</span>
            <span className="total-akumulasi-value">{totalBulanIni === 0 ? "–" : formatCurrency(totalBulanIni)}</span>
          </div>
        )}

        <div className="pagination">
          <div className="pagination-left">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="filter-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-limit"
                value={String(filters.limit)}
                onChange={(v) => updateFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} transaksi`}
                placeholder={`${filters.limit} transaksi`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {total} Transaksi · Halaman {filters.page} dari {totalPages}</span>
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
        canEditDelete={!!rowMenu.menuItem && isOrigin && isEditableByOrigin(rowMenu.menuItem, me)}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "edit" });
        }}
        onStatus={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setStatusItemId(item.id);
        }}
        onDelete={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) handleDelete(item);
        }}
      />

      <ChatModal
        open={!!chatItem}
        itemId={chatItem?.id ?? null}
        itemLabel={chatItem ? `${chatItem.tujuanPenerimaan} - ${chatItem.nomorTransmittal}` : ""}
        departemen={chatItem?.departemen ?? null}
        createdByRole={chatItem?.createdByRole ?? null}
        me={me}
        onClose={() => setChatItem(null)}
        onRead={loadTable}
      />

      <PengirimanFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={loadTable} />

      <PengirimanDetailModal
        open={!!detail}
        mode={detail?.mode || "view"}
        item={detail?.item || null}
        me={me}
        onClose={() => setDetail(null)}
        onSaved={loadTable}
        onRequestReject={(id, type, originLabel, createdByRole) => setRejectTarget({ id, type, originLabel, createdByRole })}
      />

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        createdByRole={rejectTarget?.createdByRole ?? null}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          loadTable();
        }}
      />

      <StatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />
    </>
  );
}

export default function TransaksiPage() {
  return (
    <Suspense fallback={null}>
      <TransaksiPageInner />
    </Suspense>
  );
}
