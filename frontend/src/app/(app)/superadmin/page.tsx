"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { bookingRoomsLabel, INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatTimeRange, invoiceBulanLabel, truncateText } from "@/lib/format";
import type { BookingRuang, BookingStatus, Invoice, Pengiriman, RoomOption, Status } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useRowMenu } from "@/lib/useRowMenu";
import StatusBadge from "@/components/StatusBadge";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import InvoiceRowMenuDropdown from "@/components/InvoiceRowMenuDropdown";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import InvoiceHistoryModal from "@/components/InvoiceHistoryModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface BookingFilterState {
  page: number;
  limit: number;
  tanggal: string;
  status: BookingStatus | "";
  divisi: string;
  departemen: string;
  namaRuang: string;
}

const EMPTY_BOOKING_FILTERS: BookingFilterState = { page: 1, limit: 10, tanggal: "", status: "", divisi: "", departemen: "", namaRuang: "" };

interface FilterState {
  page: number;
  limit: number;
  bulan: string;
  search: string;
  status: Status | "";
  divisi: string;
  departemen: string;
  direktorat: string;
}

const EMPTY_FILTERS: FilterState = { page: 1, limit: 10, bulan: "", search: "", status: "", divisi: "", departemen: "", direktorat: "" };

export default function SuperAdminPage() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<Pengiriman[]>([]);
  const [total, setTotal] = useState(0);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceFilterBulan, setInvoiceFilterBulan] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(10);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [invoiceHistoryId, setInvoiceHistoryId] = useState<number | null>(null);

  const [bookingFilters, setBookingFilters] = useState<BookingFilterState>(EMPTY_BOOKING_FILTERS);
  const [bookingItems, setBookingItems] = useState<BookingRuang[]>([]);
  const [bookingTotal, setBookingTotal] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(true);
  const [bookingError, setBookingError] = useState("");
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  const invoiceRowMenu = useRowMenu(invoices ?? []);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const filterBulanInputRef = useRef<HTMLInputElement>(null);
  const invoiceBulanInputRef = useRef<HTMLInputElement>(null);
  const tableReqIdRef = useRef(0);
  const invoiceReqIdRef = useRef(0);
  const bookingReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  // Some browsers restore a previously-typed value into these inputs on page reload without
  // firing onChange, leaving them visually filled while React's state (the actual source of
  // truth for the API call) stays empty. Force the DOM back in sync with state on mount.
  useEffect(() => {
    if (filterBulanInputRef.current) filterBulanInputRef.current.value = filters.bulan;
    if (invoiceBulanInputRef.current) invoiceBulanInputRef.current.value = invoiceFilterBulan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && me && me.role !== "SUPER_ADMIN") router.replace("/dashboard");
  }, [loading, me, router]);

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
    } catch (err) {
      if (reqId !== tableReqIdRef.current) return;
      setTableError((err as Error).message);
    } finally {
      if (reqId === tableReqIdRef.current) setTableBusy(false);
    }
  }, [filters]);

  const loadInvoices = useCallback(async () => {
    const reqId = ++invoiceReqIdRef.current;
    try {
      const result = await api.listInvoice({ page: invoicePage, limit: invoiceLimit, bulan: invoiceFilterBulan });
      if (reqId !== invoiceReqIdRef.current) return;
      const invoiceItems = result?.items ?? [];
      const invoiceTotalCount = result?.total ?? 0;
      if (invoiceItems.length === 0 && invoiceTotalCount > 0 && invoicePage > 1) {
        setInvoicePage((p) => p - 1);
        return;
      }
      setInvoices(invoiceItems);
      setInvoiceTotal(invoiceTotalCount);
    } catch (err) {
      if (reqId !== invoiceReqIdRef.current) return;
      setInvoiceError((err as Error).message);
    }
  }, [invoicePage, invoiceLimit, invoiceFilterBulan]);

  const loadBookings = useCallback(async () => {
    const reqId = ++bookingReqIdRef.current;
    setBookingBusy(true);
    setBookingError("");
    try {
      const result = await api.listBooking({
        page: bookingFilters.page,
        limit: bookingFilters.limit,
        tanggal: bookingFilters.tanggal,
        status: bookingFilters.status,
        divisi: bookingFilters.divisi,
        departemen: bookingFilters.departemen,
        namaRuang: bookingFilters.namaRuang,
      });
      if (reqId !== bookingReqIdRef.current) return;
      const bookingItemsResult = result?.items ?? [];
      const bookingTotalResult = result?.total ?? 0;
      if (bookingItemsResult.length === 0 && bookingTotalResult > 0 && bookingFilters.page > 1) {
        setBookingFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setBookingItems(bookingItemsResult);
      setBookingTotal(bookingTotalResult);
    } catch (err) {
      if (reqId !== bookingReqIdRef.current) return;
      setBookingError((err as Error).message);
    } finally {
      if (reqId === bookingReqIdRef.current) setBookingBusy(false);
    }
  }, [bookingFilters]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    if (me?.role === "SUPER_ADMIN") loadInvoices();
  }, [me, loadInvoices]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  if (!me || me.role !== "SUPER_ADMIN") return null;

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
    setFilters(EMPTY_FILTERS);
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function handleDelete(item: Pengiriman) {
    confirm("Yakin ingin menghapus data ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.deleteCompleted(item.id);
        showToast("Data berhasil dihapus permanen");
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  function handleDeleteInvoice(inv: Invoice) {
    confirm("Yakin ingin menghapus invoice ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.deleteInvoice(inv.id);
        showToast("Invoice berhasil dihapus permanen");
        loadInvoices();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  function updateBookingFilter(patch: Partial<BookingFilterState>) {
    setBookingFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function resetBookingFilters() {
    setBookingFilters(EMPTY_BOOKING_FILTERS);
  }

  function goToBookingPage(page: number) {
    if (page < 1) return;
    setBookingFilters((f) => ({ ...f, page }));
  }

  function handleDeleteBooking(item: BookingRuang) {
    confirm("Yakin ingin menghapus booking ruang meeting ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.superAdminDeleteBooking(item.id);
        showToast("Booking berhasil dihapus permanen");
        loadBookings();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.max(1, filters.page - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotal / invoiceLimit));
  const invoicePageStart = Math.max(1, invoicePage - 2);
  const invoicePageEnd = Math.min(invoiceTotalPages, invoicePageStart + 4);
  const invoicePageButtons: number[] = [];
  for (let p = invoicePageStart; p <= invoicePageEnd; p++) invoicePageButtons.push(p);

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

  const bookingTotalPages = Math.max(1, Math.ceil(bookingTotal / bookingFilters.limit));
  const bookingPageStart = Math.max(1, bookingFilters.page - 2);
  const bookingPageEnd = Math.min(bookingTotalPages, bookingPageStart + 4);
  const bookingPageButtons: number[] = [];
  for (let p = bookingPageStart; p <= bookingPageEnd; p++) bookingPageButtons.push(p);

  const bookingDivisiOptions = orgStructure?.divisi || [];
  const bookingSelectedDivisiNode = bookingFilters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === bookingFilters.divisi)
    : null;
  const bookingDepartemenOptions = bookingSelectedDivisiNode ? bookingSelectedDivisiNode.departemen : orgStructure?.departemen || [];

  return (
    <>
      <div className="card">
        <div className="toolbar">
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
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field">
                  <label htmlFor="filter-status">Status</label>
                  <select id="filter-status" value={filters.status} onChange={(e) => updateFilter({ status: e.target.value as Status | "" })}>
                    <option value="">Semua Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">On-Approval: Approval Departemen/Divisi</option>
                    <option value="REJECTED_L1">Rejected: Approval Departemen/Divisi</option>
                    <option value="APPROVED_L1">On-Approval: Admin GA</option>
                    <option value="REJECTED_GA">Rejected: Admin GA</option>
                    <option value="APPROVED_GA">On-Approval: Approval GA</option>
                    <option value="REJECTED_GA_APPROVAL">Rejected: Approval GA</option>
                    <option value="APPROVED_GA_APPROVAL">On-Approval: KPU</option>
                    <option value="REJECTED_KPU">Rejected: KPU</option>
                    <option value="COMPLETED">Approved</option>
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-direktorat">Direktorat</label>
                  <select
                    id="filter-direktorat"
                    value={filters.direktorat}
                    onChange={(e) => updateFilter({ direktorat: e.target.value, divisi: "", departemen: "" })}
                  >
                    <option value="">Semua Direktorat</option>
                    {(orgStructure?.direktorat || []).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-divisi">Divisi</label>
                  <select
                    id="filter-divisi"
                    value={filters.divisi}
                    onChange={(e) => updateFilter({ divisi: e.target.value, departemen: "" })}
                  >
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
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Hapus Filter</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Transmittal</th><th>No Resi</th><th>Tanggal</th><th>Tujuan</th><th>Item</th><th>Divisi</th><th>Departemen</th>
                <th>Pengirim</th><th>Telp. Pengirim</th><th>Penerima</th><th>Telp. Penerima</th>
                <th>Kode Program</th><th>Asuransi</th><th>Packing</th><th>Catatan</th>
                <th>Berat (Kg)</th><th>Ongkos Kirim (Harga)</th><th>Total</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={21} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={21} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={21} className="table-empty">Tidak ada data untuk filter ini.</td></tr>
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
                      <td>{item.divisi}</td>
                      <td>{item.departemen || "-"}</td>
                      <td>{item.namaPengirim}</td>
                      <td>{item.noTeleponPengirim}</td>
                      <td>{item.namaPenerima}</td>
                      <td>{item.noTeleponPenerima}</td>
                      <td>{item.kodeProgram}</td>
                      <td>{item.asuransiStatus}</td>
                      <td>{item.requestPacking || "-"}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>{item.beratBarangKg ?? "-"}</td>
                      <td>{item.subTotal ? formatCurrency(item.subTotal) : "-"}</td>
                      <td>{item.total ? formatCurrency(item.total) : "-"}</td>
                      <td><StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} /></td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => handleDelete(item)}>Delete</button>
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
                <option value={5}>5 transaksi</option>
                <option value={10}>10 transaksi</option>
                <option value={20}>20 transaksi</option>
                <option value={50}>50 transaksi</option>
              </select>
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {total} transaksi · Halaman {filters.page} dari {totalPages}</span>
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

      <div className="card">
        <div className="card-header">
          <h3>Room Booking Meeting</h3>
        </div>
        <div className="toolbar">
          <div className="field">
            <label htmlFor="filter-booking-tanggal">Filter Tanggal</label>
            <input type="date" id="filter-booking-tanggal" value={bookingFilters.tanggal} onChange={(e) => updateBookingFilter({ tanggal: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-status">Status</label>
            <select id="filter-booking-status" value={bookingFilters.status} onChange={(e) => updateBookingFilter({ status: e.target.value as BookingStatus | "" })}>
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">On-Approval: Approval Departemen/Divisi</option>
              <option value="REJECTED_L1">Rejected: Approval Departemen/Divisi</option>
              <option value="APPROVED_L1">On-Approval: Admin GA</option>
              <option value="REJECTED_GA">Rejected: Admin GA</option>
              <option value="APPROVED_GA">On-Approval: Approval GA</option>
              <option value="REJECTED_GA_APPROVAL">Rejected: Approval GA</option>
              <option value="APPROVED_GA_APPROVAL">Approved</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-booking-ruang">Ruang</label>
            <select id="filter-booking-ruang" value={bookingFilters.namaRuang} onChange={(e) => updateBookingFilter({ namaRuang: e.target.value })}>
              <option value="">Semua Ruang</option>
              {rooms.map((r) => (
                <option key={r.nama} value={r.nama}>{r.nama}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-booking-divisi">Divisi</label>
            <select id="filter-booking-divisi" value={bookingFilters.divisi} onChange={(e) => updateBookingFilter({ divisi: e.target.value, departemen: "" })}>
              <option value="">Semua Divisi</option>
              {bookingDivisiOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-booking-departemen">Departemen</label>
            <select id="filter-booking-departemen" value={bookingFilters.departemen} onChange={(e) => updateBookingFilter({ departemen: e.target.value })}>
              <option value="">Semua Departemen</option>
              {bookingDepartemenOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetBookingFilters}>Hapus Filter</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pemesanan</th><th>Nama Kegiatan</th><th>PIC</th><th>Ruang</th><th>Peserta</th>
                <th>Tanggal</th><th>Jam</th><th>Diajukan</th><th>Divisi</th><th>Departemen</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bookingBusy ? (
                <tr><td colSpan={13} className="table-empty">Memuat data...</td></tr>
              ) : bookingError ? (
                <tr><td colSpan={13} className="table-empty">{bookingError}</td></tr>
              ) : bookingItems.length === 0 ? (
                <tr><td colSpan={13} className="table-empty">Tidak ada data untuk filter ini.</td></tr>
              ) : (
                bookingItems.map((item, index) => {
                  const rowNumber = (bookingFilters.page - 1) * bookingFilters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPemesanan || "-"}</td>
                      <td title={item.namaKegiatan}>{truncateText(item.namaKegiatan, 25)}</td>
                      <td>{item.pic || "-"}</td>
                      <td title={bookingRoomsLabel(item)}>{truncateText(bookingRoomsLabel(item), 20)}</td>
                      <td>{item.jumlahPeserta}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{item.divisi}</td>
                      <td>{item.departemen || "-"}</td>
                      <td>
                        <span className="badge-stack">
                          <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
                          {item.hasConflict && <span className="badge badge-rejected">Bentrok</span>}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => handleDeleteBooking(item)}>Delete</button>
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
              <label htmlFor="filter-booking-limit">Tampilkan</label>
              <select id="filter-booking-limit" value={bookingFilters.limit} onChange={(e) => updateBookingFilter({ limit: Number(e.target.value) })}>
                <option value={5}>5 booking</option>
                <option value={10}>10 booking</option>
                <option value={20}>20 booking</option>
                <option value={50}>50 booking</option>
              </select>
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {bookingTotal} booking · Halaman {bookingFilters.page} dari {bookingTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={bookingFilters.page <= 1} onClick={() => goToBookingPage(bookingFilters.page - 1)}>‹</button>
              {bookingPageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === bookingFilters.page ? "active" : ""}`} onClick={() => goToBookingPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={bookingFilters.page >= bookingTotalPages} onClick={() => goToBookingPage(bookingFilters.page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>History Invoice Pembiayaan</h3>
        </div>

        <div className="invoice-toolbar-slim">
          <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
            <label htmlFor="invoice-filter-bulan">Filter Bulan</label>
            <input
              type="month"
              id="invoice-filter-bulan"
              autoComplete="off"
              ref={invoiceBulanInputRef}
              value={invoiceFilterBulan}
              onChange={(e) => { setInvoiceFilterBulan(e.target.value); setInvoicePage(1); }}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="field-label-spacer">Semua Invoice</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "auto" }}
              onClick={() => { setInvoiceFilterBulan(""); setInvoicePage(1); }}
            >
              Semua Invoice
            </button>
          </div>
        </div>

        <div className="invoice-list">
          {invoiceError ? (
            <p className="text-secondary">{invoiceError}</p>
          ) : invoices == null ? (
            <p className="text-secondary">Memuat data invoice...</p>
          ) : invoices.length === 0 ? (
            <p className="text-secondary">{invoiceFilterBulan ? "Tidak ada invoice untuk filter ini." : "Belum ada invoice."}</p>
          ) : (
            invoices.map((inv) => (
              <div className="invoice-row" key={inv.id}>
                <div className="invoice-row-main">
                  <div className="invoice-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div className="invoice-row-info">
                    <div className="invoice-row-title">Invoice {invoiceBulanLabel(inv.bulan)}</div>
                    <div className="invoice-row-meta">{inv.originalFilename} · Diunggah {formatDateTime(inv.uploadedAt)}</div>
                    {inv.reviewedAt && <div className="invoice-row-meta">Ditinjau: {formatDateTime(inv.reviewedAt)}</div>}
                    {inv.catatan && <div className="invoice-row-note"><strong>Catatan:</strong> {inv.catatan}</div>}
                  </div>
                </div>
                <div className="invoice-row-actions">
                  <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                  <button type="button" className="row-menu-btn" aria-label="Aksi" onClick={(e) => invoiceRowMenu.toggle(e, inv.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pagination">
          <div className="pagination-left">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="invoice-limit">Tampilkan</label>
              <select id="invoice-limit" value={invoiceLimit} onChange={(e) => { setInvoiceLimit(Number(e.target.value)); setInvoicePage(1); }}>
                <option value={5}>5 invoice</option>
                <option value={10}>10 invoice</option>
                <option value={20}>20 invoice</option>
                <option value={50}>50 invoice</option>
              </select>
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {invoiceTotal} invoice · Halaman {invoicePage} dari {invoiceTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={invoicePage <= 1} onClick={() => setInvoicePage(invoicePage - 1)}>‹</button>
              {invoicePageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === invoicePage ? "active" : ""}`} onClick={() => setInvoicePage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={invoicePage >= invoiceTotalPages} onClick={() => setInvoicePage(invoicePage + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      <InvoiceRowMenuDropdown
        position={invoiceRowMenu.position}
        showUpdates={false}
        showDelete={!!invoiceRowMenu.menuItem}
        pdfViewUrl={invoiceRowMenu.menuItem ? api.invoiceFileUrl(invoiceRowMenu.menuItem.id) : "#"}
        pdfDownloadUrl={invoiceRowMenu.menuItem ? api.invoiceDownloadUrl(invoiceRowMenu.menuItem.id) : "#"}
        onDetail={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) setInvoiceDetail(item);
        }}
        onUpdates={() => {}}
        onRiwayat={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) setInvoiceHistoryId(item.id);
        }}
        onDelete={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) handleDeleteInvoice(item);
        }}
        onLinkClick={() => invoiceRowMenu.close()}
      />

      <InvoiceDetailModal
        open={!!invoiceDetail}
        item={invoiceDetail}
        me={me}
        onClose={() => setInvoiceDetail(null)}
        onRequestAction={() => {}}
        onSubmitted={() => {}}
      />

      <InvoiceHistoryModal
        open={invoiceHistoryId != null}
        invoiceId={invoiceHistoryId}
        onClose={() => setInvoiceHistoryId(null)}
      />
    </>
  );
}
