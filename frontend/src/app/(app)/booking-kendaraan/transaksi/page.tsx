"use client";

import { MessageSquare } from "lucide-react";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  canGaRescheduleKendaraan,
  getBookingStatusLabelMap,
  isBookingOriginRole,
  isKendaraanCancellableByOrigin,
  isKendaraanDeletableByOrigin,
  isKendaraanEditableByOrigin,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatTimeRange, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import { useLanguage } from "@/lib/i18n/language-context";
import type { BookingKendaraan, BookingStatus, VehicleOption } from "@/lib/types";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import SearchableSelect from "@/components/SearchableSelect";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import VehicleBookingFormModal from "@/components/VehicleBookingFormModal";
import VehicleBookingDetailModal from "@/components/VehicleBookingDetailModal";
import VehicleBookingRescheduleModal from "@/components/VehicleBookingRescheduleModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import CancelBookingModal from "@/components/CancelBookingModal";
import VehicleBookingStatusHistoryModal from "@/components/VehicleBookingStatusHistoryModal";
import VehicleBookingChatModal from "@/components/VehicleBookingChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface FilterState {
  page: number;
  limit: number;
  tanggal: string;
  bulan: string;
  status: BookingStatus | "REJECTED" | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  namaKendaraan: string;
  search: string;
}

function defaultFilters(): FilterState {
  return { page: 1, limit: 10, tanggal: "", bulan: "", status: "", divisi: "", departemen: "", direktorat: "", namaKendaraan: "", search: "" };
}

function VehicleBookingTransaksiPageInner() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { language, t } = useLanguage();

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<BookingKendaraan[]>([]);
  const [total, setTotal] = useState(0);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: BookingKendaraan; mode: "view" | "edit" } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingKendaraan | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingKendaraan | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

  const rowMenu = useRowMenu(items);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const filterBulanInputRef = useRef<HTMLInputElement>(null);
  const tableReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    if (filterBulanInputRef.current) filterBulanInputRef.current.value = filters.bulan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  // A chat/activity notification banner's click lands here with ?chat=<itemId> - fetched
  // directly (not found-in-loaded-items, since the item may not be on whatever page/filter is
  // currently shown) so the thread opens regardless of pagination. The param is stripped right
  // after so a later refresh of this same URL doesn't keep reopening it.
  useEffect(() => {
    const chatId = searchParams.get("chat");
    if (!chatId) return;
    api.getKendaraanBooking(Number(chatId)).then(setChatItem).catch(() => {});
    router.replace("/booking-kendaraan/transaksi");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
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
      const result = await api.listKendaraanBooking({
        page: filters.page,
        limit: filters.limit,
        tanggal: filters.tanggal,
        bulan: filters.bulan,
        status: filters.status,
        divisi: filters.divisi,
        departemen: filters.departemen,
        direktorat: filters.direktorat,
        namaKendaraan: filters.namaKendaraan,
        search: filters.search,
      });
      if (reqId !== tableReqIdRef.current) return;
      const result_items = result?.items ?? [];
      const result_total = result?.total ?? 0;
      if (result_items.length === 0 && result_total > 0 && filters.page > 1) {
        setFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setItems(result_items);
      setTotal(result_total);
    } catch (err) {
      if (reqId !== tableReqIdRef.current) return;
      setTableError((err as Error).message);
    } finally {
      if (reqId === tableReqIdRef.current) setTableBusy(false);
    }
  }, [filters]);

  useEffect(() => {
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

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function handleDelete(item: BookingKendaraan) {
    confirm(t("vbk.confirmDeleteBooking"), async () => {
      try {
        await api.deleteKendaraanBooking(item.id);
        showToast(t("bk.toastBookingDeleted"));
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
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
            <label htmlFor="filter-kendaraan-search">{t("bk.cariPesanan")}</label>
            <input type="text" id="filter-kendaraan-search" placeholder={t("bk.noPesananPlaceholder")} value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="filter-kendaraan-bulan">{t("common.filterMonth")}</label>
            <input type="month" id="filter-kendaraan-bulan" autoComplete="off" ref={filterBulanInputRef} value={filters.bulan} onChange={(e) => updateFilter({ bulan: e.target.value, tanggal: "" })} />
          </div>

          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="field-label-spacer">{t("common.filter")}</label>
            <button type="button" className="btn btn-secondary" id="filter-kendaraan-toggle" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              {t("common.allFilters")}
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field">
                  <label htmlFor="filter-kendaraan-tanggal">{t("bk.filterTanggal")}</label>
                  <input type="date" id="filter-kendaraan-tanggal" value={filters.tanggal} onChange={(e) => updateFilter({ tanggal: e.target.value, bulan: "" })} />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-kendaraan-status">{t("common.status")}</label>
                  <SearchableSelect
                    id="filter-kendaraan-status"
                    value={filters.status}
                    onChange={(v) => updateFilter({ status: v as BookingStatus | "REJECTED" | "" })}
                    options={["DRAFT", "SUBMITTED", "APPROVED_L1", "APPROVED_GA", "REJECTED", "APPROVED_GA_APPROVAL", "CANCELLED"]}
                    getLabel={(v) => (v === "REJECTED" ? t("word.rejected") : getBookingStatusLabelMap(language)[v as BookingStatus]) || v}
                    clearLabel={t("common.allStatus")}
                    placeholder={t("common.allStatus")}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-kendaraan-vehicle">{t("vbk.kendaraan")}</label>
                  <SearchableSelect
                    id="filter-kendaraan-vehicle"
                    value={filters.namaKendaraan}
                    onChange={(v) => updateFilter({ namaKendaraan: v })}
                    options={vehicles.map((v) => v.nama)}
                    clearLabel={t("vbk.semuaKendaraan")}
                    placeholder={t("vbk.semuaKendaraan")}
                  />
                </div>
                {showOrgFilters && (
                  <>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-kendaraan-direktorat">{t("word.directorate")}</label>
                      <SearchableSelect
                        id="filter-kendaraan-direktorat"
                        value={filters.direktorat}
                        onChange={(v) => updateFilter({ direktorat: v, divisi: "", departemen: "" })}
                        options={orgStructure?.direktorat || []}
                        clearLabel={t("common.allDirectorate")}
                        placeholder={t("common.allDirectorate")}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-kendaraan-divisi">{t("word.division")}</label>
                      <SearchableSelect
                        id="filter-kendaraan-divisi"
                        value={filters.divisi}
                        onChange={(v) => updateFilter({ divisi: v, departemen: "" })}
                        options={divisiOptions}
                        clearLabel={t("common.allDivision")}
                        placeholder={t("common.allDivision")}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-kendaraan-departemen">{t("word.department")}</label>
                      <SearchableSelect
                        id="filter-kendaraan-departemen"
                        value={filters.departemen}
                        onChange={(v) => updateFilter({ departemen: v })}
                        options={departemenOptions}
                        clearLabel={t("common.allDepartment")}
                        placeholder={t("common.allDepartment")}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>{t("bk.semuaPesanan")}</button>

          <div className="toolbar-actions">
            {isOrigin && (
              <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>
                + {t("nav.vehicleBooking")}
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("common.rowNo")}</th><th>{t("bk.noPesananHeader")}</th><th>{t("bk.diajukanHeader")}</th><th>{t("vbk.keperluan")}</th><th>{t("bk.pic")}</th><th>{t("word.division")}</th><th>{t("word.department")}</th><th>{t("vbk.kendaraan")}</th><th>{t("vbk.jumlahPenumpang")}</th>
                <th>{t("common.date")}</th><th>{t("bk.jamHeader")}</th><th>{t("common.notes")}</th><th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={13} className="table-empty">{t("common.loadingData")}</td></tr>
              ) : tableError ? (
                <tr><td colSpan={13} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={13} className="table-empty">{t("eks.noDataForFilter")}</td></tr>
              ) : (
                items.map((item, index) => {
                  const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPemesanan || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td title={item.keperluan}>{truncateText(item.keperluan, 25)}</td>
                      <td title={item.pic || ""}>{truncateText(item.pic, 15)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.namaKendaraan}>{truncateText(item.namaKendaraan, 20)}</td>
                      <td>{item.jumlahPenumpang}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} departemen={item.departemen} cancelledByName={item.cancelledByName} />
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label={t("common.chat")}
                            onClick={() => setChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label={t("common.aksi")} onClick={(e) => rowMenu.toggle(e, item.id, 180)}>
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
              <label htmlFor="filter-kendaraan-limit">{t("common.show")}</label>
              <SearchableSelect
                id="filter-kendaraan-limit"
                value={String(filters.limit)}
                onChange={(v) => updateFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} ${t("bk.unitBooking")}`}
                placeholder={`${filters.limit} ${t("bk.unitBooking")}`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">{t("common.total")} {total} {t("bk.unitPesananCap")} · {t("common.page")} {filters.page} {t("common.ofTotal")} {totalPages}</span>
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
          ((isOrigin && isKendaraanEditableByOrigin(rowMenu.menuItem, me)) || canGaRescheduleKendaraan(rowMenu.menuItem, me))
        }
        canDelete={!!rowMenu.menuItem && isOrigin && isKendaraanDeletableByOrigin(rowMenu.menuItem, me)}
        canCancel={!!rowMenu.menuItem && isKendaraanCancellableByOrigin(rowMenu.menuItem, me)}
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
          if (isOrigin && isKendaraanEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaRescheduleKendaraan(item, me)) setRescheduleTarget(item);
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

      {me && (
        <VehicleBookingFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={loadTable} />
      )}

      <VehicleBookingDetailModal
        open={!!detail}
        mode={detail?.mode || "view"}
        item={detail?.item || null}
        me={me}
        onClose={() => setDetail(null)}
        onSaved={loadTable}
        onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
      />

      <VehicleBookingRescheduleModal
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
        targetType="kendaraan"
        onClose={() => setCancelTargetId(null)}
        onDone={() => {
          setCancelTargetId(null);
          loadTable();
        }}
      />

      <VehicleBookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <VehicleBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.keperluan} - ${chatItem.namaKendaraan} - ${chatItem.nomorPemesanan || "-"}` : ""}
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

export default function VehicleBookingTransaksiPage() {
  return (
    <Suspense fallback={null}>
      <VehicleBookingTransaksiPageInner />
    </Suspense>
  );
}
