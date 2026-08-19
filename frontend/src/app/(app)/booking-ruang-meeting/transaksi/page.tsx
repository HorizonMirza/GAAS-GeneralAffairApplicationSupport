"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isBookingEditableByOrigin } from "@/lib/constants";
import { formatDate, formatTimeRange, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import type { BookingRuang, BookingStatus, RoomOption } from "@/lib/types";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import BookingStatusHistoryModal from "@/components/BookingStatusHistoryModal";
import RoomBookingChatModal from "@/components/RoomBookingChatModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface FilterState {
  page: number;
  limit: number;
  tanggal: string;
  status: BookingStatus | "";
  divisi: string;
  departemen: string;
  namaRuang: string;
}

const EMPTY_FILTERS: FilterState = { page: 1, limit: 10, tanggal: "", status: "", divisi: "", departemen: "", namaRuang: "" };

export default function BookingTransaksiPage() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [items, setItems] = useState<BookingRuang[]>([]);
  const [total, setTotal] = useState(0);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingRuang | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const rowMenu = useRowMenu(items);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  useEffect(() => {
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  const loadTable = useCallback(async () => {
    setTableBusy(true);
    setTableError("");
    try {
      const result = await api.listBooking({
        page: filters.page,
        limit: filters.limit,
        tanggal: filters.tanggal,
        status: filters.status,
        divisi: filters.divisi,
        departemen: filters.departemen,
        namaRuang: filters.namaRuang,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setTableError((err as Error).message);
    } finally {
      setTableBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI"].includes(me.role)
    : false;

  if (!me || me.role === "SUPER_ADMIN") return null;

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function handleDelete(item: BookingRuang) {
    confirm("Hapus booking ruangan ini secara permanen?", async () => {
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
  const pageStart = Math.max(1, filters.page - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const showOrgFilters = ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"].includes(me.role);

  const divisiOptions = orgStructure?.divisi || [];
  const selectedDivisiNode = filters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === filters.divisi)
    : null;
  const departemenOptions = selectedDivisiNode ? selectedDivisiNode.departemen : orgStructure?.departemen || [];

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div className="field">
            <label htmlFor="filter-tanggal">Filter Tanggal</label>
            <input type="date" id="filter-tanggal" value={filters.tanggal} onChange={(e) => updateFilter({ tanggal: e.target.value })} />
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
                  <select id="filter-status" value={filters.status} onChange={(e) => updateFilter({ status: e.target.value as BookingStatus | "" })}>
                    <option value="">Semua Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">On-Approval: Approval Departemen/Divisi</option>
                    <option value="REJECTED_L1">Rejected: Approval Departemen/Divisi</option>
                    <option value="APPROVED_L1">On-Approval: Admin GA</option>
                    <option value="REJECTED_GA">Rejected: Admin GA</option>
                    <option value="APPROVED_GA">On-Approval: Approval GA</option>
                    <option value="REJECTED_GA_APPROVAL">Rejected: Approval GA</option>
                    <option value="APPROVED_GA_APPROVAL">Terkonfirmasi</option>
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-ruang">Ruang</label>
                  <select id="filter-ruang" value={filters.namaRuang} onChange={(e) => updateFilter({ namaRuang: e.target.value })}>
                    <option value="">Semua Ruang</option>
                    {rooms.map((r) => (
                      <option key={r.nama} value={r.nama}>{r.nama}</option>
                    ))}
                  </select>
                </div>
                {showOrgFilters && (
                  <>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-divisi">Divisi</label>
                      <select id="filter-divisi" value={filters.divisi} onChange={(e) => updateFilter({ divisi: e.target.value, departemen: "" })}>
                        <option value="">Semua Divisi</option>
                        {divisiOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-departemen">Departemen</label>
                      <select id="filter-departemen" value={filters.departemen} onChange={(e) => updateFilter({ departemen: e.target.value })}>
                        <option value="">Semua Departemen</option>
                        {departemenOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Hapus Filter</button>

          <div className="toolbar-actions">
            {isOrigin && (
              <button className="btn btn-primary btn-sm" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>+ Booking Ruang Meeting</button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>Nama Kegiatan</th><th>Ruang</th><th>Kapasitas</th><th>Peserta</th>
                <th>Tanggal</th><th>Jam</th><th>Divisi</th><th>Departemen</th><th>Catatan</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={11} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={11} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="table-empty">Tidak ada data untuk filter ini.</td></tr>
              ) : (
                items.map((item, index) => {
                  const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td title={item.namaKegiatan}>{truncateText(item.namaKegiatan, 25)}</td>
                      <td>{item.namaRuang}</td>
                      <td>{item.kapasitasRuang}</td>
                      <td>{item.jumlahPeserta}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)}</td>
                      <td>{item.divisi}</td>
                      <td>{item.departemen || "-"}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
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

        <div className="pagination">
          <div className="pagination-left">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="filter-limit">Tampilkan</label>
              <select id="filter-limit" value={filters.limit} onChange={(e) => updateFilter({ limit: Number(e.target.value) })}>
                <option value={5}>5 booking</option>
                <option value={10}>10 booking</option>
                <option value={20}>20 booking</option>
                <option value={50}>50 booking</option>
              </select>
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {total} booking · Halaman {filters.page} dari {totalPages}</span>
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
        canEditDelete={!!rowMenu.menuItem && isOrigin && isBookingEditableByOrigin(rowMenu.menuItem, me)}
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

      <RoomBookingFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={loadTable} />

      <RoomBookingDetailModal
        open={!!detail}
        mode={detail?.mode || "view"}
        item={detail?.item || null}
        me={me}
        onClose={() => setDetail(null)}
        onSaved={loadTable}
        onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
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

      <BookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <RoomBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.namaKegiatan} - ${chatItem.namaRuang}` : ""}
          departemen={chatItem?.departemen ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={loadTable}
        />
      )}
    </>
  );
}
