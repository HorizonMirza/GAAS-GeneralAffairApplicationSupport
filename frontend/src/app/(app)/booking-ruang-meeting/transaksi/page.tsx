"use client";

import { MessageSquare } from "lucide-react";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  bookingRoomsLabel,
  canGaRescheduleBooking,
  isBookingCancellableByOrigin,
  isBookingDeletableByOrigin,
  isBookingEditableByOrigin,
  isBookingOriginRole,
  isBookingPdfAvailable,
  TIPE_BOOKING_LABELS,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatTimeRange, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import type { BookingRuang, BookingStatus, RoomOption } from "@/lib/types";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import SearchableSelect from "@/components/SearchableSelect";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RoomBookingRescheduleModal from "@/components/RoomBookingRescheduleModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import CancelBookingModal from "@/components/CancelBookingModal";
import BookingStatusHistoryModal from "@/components/BookingStatusHistoryModal";
import RoomBookingChatModal from "@/components/RoomBookingChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface FilterState {
  page: number;
  limit: number;
  tanggal: string;
  bulan: string;
  // "REJECTED" is a synthetic value (not a real BookingStatus) meaning "any of the 3
  // reject-stage statuses" - collapsed into one Status filter dropdown option.
  status: BookingStatus | "REJECTED" | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  namaRuang: string;
  search: string;
}

// Default menampilkan seluruh data (bukan hanya bulan berjalan), sama seperti Ekspedisi's
// EMPTY_FILTERS - "Semua Pesanan" adalah state awal, bukan cuma hasil tombol reset.
function defaultFilters(): FilterState {
  return { page: 1, limit: 10, tanggal: "", bulan: "", status: "", divisi: "", departemen: "", direktorat: "", namaRuang: "", search: "" };
}

function BookingTransaksiPageInner() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<BookingRuang[]>([]);
  const [total, setTotal] = useState(0);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingRuang | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingRuang | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

  const rowMenu = useRowMenu(items);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const filterBulanInputRef = useRef<HTMLInputElement>(null);
  const tableReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  // Some browsers restore a previously-typed value into this input on page reload without
  // firing onChange, leaving it visually filled while React's state (the actual source of
  // truth for the API call) stays out of sync. Force the DOM back in sync with state on mount.
  useEffect(() => {
    if (filterBulanInputRef.current) filterBulanInputRef.current.value = filters.bulan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    // KPU only deals with Expedition (see AppShell's KPU_HIDDEN_CATEGORIES) - Room Booking isn't
    // part of their workflow, so a direct link/URL shouldn't land them here either.
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  // A chat notification banner's click lands here with ?chat=<itemId> - fetched directly (not
  // found-in-loaded-items, since the item may not be on whatever page/filter is currently shown)
  // so the thread opens regardless of pagination. The param is stripped right after so a later
  // refresh of this same URL doesn't keep reopening it.
  useEffect(() => {
    const chatId = searchParams.get("chat");
    if (!chatId) return;
    api.getBooking(Number(chatId)).then(setChatItem).catch(() => {});
    router.replace("/booking-ruang-meeting/transaksi");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  // `silent` skips the busy-flag toggle - used by the chat modal's onRead, which fires on every
  // incoming message while the modal is open and would otherwise unmount the table to "Memuat
  // data..." and back on every message, flickering the page visible behind the modal's blurred
  // backdrop for no visible benefit.
  const loadTable = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++tableReqIdRef.current;
    if (!opts?.silent) setTableBusy(true);
    setTableError("");
    try {
      const result = await api.listBooking({
        page: filters.page,
        limit: filters.limit,
        tanggal: filters.tanggal,
        bulan: filters.bulan,
        status: filters.status,
        divisi: filters.divisi,
        departemen: filters.departemen,
        direktorat: filters.direktorat,
        namaRuang: filters.namaRuang,
        search: filters.search,
      });
      // A slower earlier request can resolve after a newer one triggered by changing a filter -
      // ignore it so it doesn't clobber the results that actually match the current filters.
      if (reqId !== tableReqIdRef.current) return;
      const bookingItemsResult = result?.items ?? [];
      const bookingTotalResult = result?.total ?? 0;
      // The page we were on can end up past the end after a delete (e.g. the last row on the
      // last page got removed) - back off one page instead of showing a blank "no data" table.
      if (bookingItemsResult.length === 0 && bookingTotalResult > 0 && filters.page > 1) {
        setFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setItems(bookingItemsResult);
      setTotal(bookingTotalResult);
    } catch (err) {
      if (reqId !== tableReqIdRef.current) return;
      setTableError((err as Error).message);
    } finally {
      if (reqId === tableReqIdRef.current) setTableBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    // Fetches from the API on mount/whenever filters change - genuinely synchronizing with an
    // external system, not state derived from a prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTable();
  }, [loadTable]);

  const isOrigin = me ? isBookingOriginRole(me.role) : false;

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

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
    setFilters(defaultFilters());
  }

  function currentExportParams() {
    return {
      bulan: filters.bulan,
      status: filters.status,
      divisi: filters.divisi,
      departemen: filters.departemen,
      direktorat: filters.direktorat,
      nama_ruang: filters.namaRuang,
      tanggal: filters.tanggal,
      search: filters.search,
    };
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function handleDelete(item: BookingRuang) {
    const message = item.seriesId
      ? "Booking ini bagian dari jadwal berulang\nmenghapusnya akan menghapus seluruh jadwal"
      : "Hapus booking ruangan ini secara permanen?";
    confirm(message, async () => {
      try {
        await api.deleteBooking(item.id);
        showToast("Booking berhasil dihapus");
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  // Window of up to 2 page numbers, re-anchored after clamping to totalPages so the last page
  // still shows a full 2-button window (e.g. totalPages=5, page=5 -> [4,5], not just [5]).
  const PAGE_WINDOW = 2;
  let pageStart = Math.max(1, filters.page - 1);
  const pageEnd = Math.min(totalPages, pageStart + PAGE_WINDOW - 1);
  pageStart = Math.max(1, pageEnd - PAGE_WINDOW + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

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
            <label htmlFor="filter-search">Cari Pesanan</label>
            <input type="text" id="filter-search" placeholder="No Pesanan" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="filter-bulan">Filter Bulan</label>
            <input type="month" id="filter-bulan" autoComplete="off" ref={filterBulanInputRef} value={filters.bulan} onChange={(e) => updateFilter({ bulan: e.target.value, tanggal: "" })} />
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
                  <label htmlFor="filter-tanggal">Filter Tanggal</label>
                  <input type="date" id="filter-tanggal" value={filters.tanggal} onChange={(e) => updateFilter({ tanggal: e.target.value, bulan: "" })} />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-status">Status</label>
                  <SearchableSelect
                    id="filter-status"
                    value={filters.status}
                    onChange={(v) => updateFilter({ status: v as BookingStatus | "REJECTED" | "" })}
                    options={["DRAFT", "SUBMITTED", "APPROVED_L1", "APPROVED_GA", "REJECTED", "APPROVED_GA_APPROVAL", "CANCELLED"]}
                    getLabel={(v) => ({
                      DRAFT: "Draft",
                      SUBMITTED: "On-Approval: Approval Departemen/Divisi",
                      APPROVED_L1: "On-Approval: Admin GA",
                      APPROVED_GA: "On-Approval: Approval GA",
                      REJECTED: "Rejected",
                      APPROVED_GA_APPROVAL: "Approved",
                      CANCELLED: "Cancelled",
                    } as Record<string, string>)[v] || v}
                    clearLabel="Semua Status"
                    placeholder="Semua Status"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-ruang">Ruang</label>
                  <SearchableSelect
                    id="filter-ruang"
                    value={filters.namaRuang}
                    onChange={(v) => updateFilter({ namaRuang: v })}
                    options={rooms.map((r) => r.nama)}
                    clearLabel="Semua Ruang"
                    placeholder="Semua Ruang"
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

          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Semua Pesanan</button>

          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.bookingExportPdfUrl(currentExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.bookingExportUrl(currentExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            {isOrigin && (
              <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>
                + Booking Ruang Meeting
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pesanan</th><th>Diajukan</th><th>Tanggal</th><th>Jam</th><th>Nama Kegiatan</th><th>PIC</th><th>Ruangan</th><th>Divisi</th><th>Departemen</th>
                <th>Tipe</th><th>Peserta</th><th>Catatan</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={14} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={14} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={14} className="table-empty">Tidak ada data untuk filter ini.</td></tr>
              ) : (
                items.map((item, index) => {
                  const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPemesanan || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)}</td>
                      <td title={item.namaKegiatan}>{truncateText(item.namaKegiatan, 25)}</td>
                      <td title={item.pic || ""}>{truncateText(item.pic, 15)}</td>
                      <td title={bookingRoomsLabel(item)}>{truncateText(bookingRoomsLabel(item), 20)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td>{TIPE_BOOKING_LABELS[item.tipe]}</td>
                      <td>{item.jumlahPeserta}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} />
                            {item.hasConflict && <span className="badge badge-rejected">Bentrok</span>}
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
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

        <div className="pagination">
          <div className="pagination-left">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="filter-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-limit"
                value={String(filters.limit)}
                onChange={(v) => updateFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} booking`}
                placeholder={`${filters.limit} booking`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {total} Pesanan · Halaman {filters.page} dari {totalPages}</span>
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
        canEditDelete={
          !!rowMenu.menuItem &&
          ((isOrigin && isBookingEditableByOrigin(rowMenu.menuItem, me)) || canGaRescheduleBooking(rowMenu.menuItem, me))
        }
        canDelete={!!rowMenu.menuItem && isOrigin && isBookingDeletableByOrigin(rowMenu.menuItem, me)}
        canCancel={!!rowMenu.menuItem && isBookingCancellableByOrigin(rowMenu.menuItem, me)}
        onCancel={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setCancelTargetId(item.id);
        }}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          if (isOrigin && isBookingEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaRescheduleBooking(item, me)) setRescheduleTarget(item);
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
        pdfUrl={rowMenu.menuItem && isBookingPdfAvailable(rowMenu.menuItem) ? api.bookingPdfUrl(rowMenu.menuItem.id) : undefined}
        onPdfClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.bookingPdfUrl(item.id), `Bukti-Booking-${item.nomorPemesanan || item.id}.pdf`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }}
        icsUrl={rowMenu.menuItem && isBookingPdfAvailable(rowMenu.menuItem) ? api.bookingIcsUrl(rowMenu.menuItem.id) : undefined}
        onIcsClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.bookingIcsUrl(item.id), `Booking-${item.nomorPemesanan || item.id}.ics`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }}
      />

      {me && (
        <RoomBookingFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={loadTable} />
      )}

      <RoomBookingDetailModal
        open={!!detail}
        mode={detail?.mode || "view"}
        item={detail?.item || null}
        me={me}
        onClose={() => setDetail(null)}
        onSaved={loadTable}
        onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
      />

      <RoomBookingRescheduleModal
        open={!!rescheduleTarget}
        item={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSaved={loadTable}
      />

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          loadTable();
        }}
      />

      <CancelBookingModal
        open={cancelTargetId != null}
        targetId={cancelTargetId}
        targetType="room"
        onClose={() => setCancelTargetId(null)}
        onDone={() => {
          setCancelTargetId(null);
          loadTable();
        }}
      />

      <BookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <RoomBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.namaKegiatan} - ${bookingRoomsLabel(chatItem)} - ${chatItem.nomorPemesanan || "-"}` : ""}
          departemen={chatItem?.departemen ?? null}
          createdByRole={chatItem?.createdByRole ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={() => loadTable({ silent: true })}
        />
      )}
    </>
  );
}

export default function BookingTransaksiPage() {
  return (
    <Suspense fallback={null}>
      <BookingTransaksiPageInner />
    </Suspense>
  );
}
