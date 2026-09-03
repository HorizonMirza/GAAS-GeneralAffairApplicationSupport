"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { bookingRoomsLabel, getBookingStatusLabelMap, getInvoiceStatusLabelMap, getStatusLabelMap, INVOICE_STATUS_CLASS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatTimeRange, invoiceBulanLabel, truncateText } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-context";
import type { BookingKendaraan, BookingRuang, BookingStatus, Invoice, Pengiriman, RoomOption, Status, VehicleOption } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useRowMenu } from "@/lib/useRowMenu";
import StatusBadge from "@/components/StatusBadge";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import InvoiceRowMenuDropdown from "@/components/InvoiceRowMenuDropdown";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import InvoiceHistoryModal from "@/components/InvoiceHistoryModal";
import DashboardStats from "@/components/DashboardStats";
import SearchableSelect from "@/components/SearchableSelect";
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

interface KendaraanFilterState {
  page: number;
  limit: number;
  tanggal: string;
  status: BookingStatus | "";
  divisi: string;
  departemen: string;
  namaKendaraan: string;
}

const EMPTY_KENDARAAN_FILTERS: KendaraanFilterState = { page: 1, limit: 10, tanggal: "", status: "", divisi: "", departemen: "", namaKendaraan: "" };

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
  const { language, t } = useLanguage();

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

  const [kendaraanFilters, setKendaraanFilters] = useState<KendaraanFilterState>(EMPTY_KENDARAAN_FILTERS);
  const [kendaraanItems, setKendaraanItems] = useState<BookingKendaraan[]>([]);
  const [kendaraanTotal, setKendaraanTotal] = useState(0);
  const [kendaraanBusy, setKendaraanBusy] = useState(true);
  const [kendaraanError, setKendaraanError] = useState("");
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  const invoiceRowMenu = useRowMenu(invoices ?? []);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const filterBulanInputRef = useRef<HTMLInputElement>(null);
  const invoiceBulanInputRef = useRef<HTMLInputElement>(null);
  const tableReqIdRef = useRef(0);
  const invoiceReqIdRef = useRef(0);
  const bookingReqIdRef = useRef(0);
  const kendaraanReqIdRef = useRef(0);
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

  const loadKendaraanBookings = useCallback(async () => {
    const reqId = ++kendaraanReqIdRef.current;
    setKendaraanBusy(true);
    setKendaraanError("");
    try {
      const result = await api.listKendaraanBooking({
        page: kendaraanFilters.page,
        limit: kendaraanFilters.limit,
        tanggal: kendaraanFilters.tanggal,
        status: kendaraanFilters.status,
        divisi: kendaraanFilters.divisi,
        departemen: kendaraanFilters.departemen,
        namaKendaraan: kendaraanFilters.namaKendaraan,
      });
      if (reqId !== kendaraanReqIdRef.current) return;
      const kendaraanItemsResult = result?.items ?? [];
      const kendaraanTotalResult = result?.total ?? 0;
      if (kendaraanItemsResult.length === 0 && kendaraanTotalResult > 0 && kendaraanFilters.page > 1) {
        setKendaraanFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setKendaraanItems(kendaraanItemsResult);
      setKendaraanTotal(kendaraanTotalResult);
    } catch (err) {
      if (reqId !== kendaraanReqIdRef.current) return;
      setKendaraanError((err as Error).message);
    } finally {
      if (reqId === kendaraanReqIdRef.current) setKendaraanBusy(false);
    }
  }, [kendaraanFilters]);

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
    loadKendaraanBookings();
  }, [loadKendaraanBookings]);

  useEffect(() => {
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
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
    confirm(t("sa.confirmDeleteDataPermanent"), async () => {
      try {
        await api.deleteCompleted(item.id);
        showToast(t("sa.toastDataDeletedPermanent"));
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, t("sa.deletePermanent"));
  }

  function handleDeleteInvoice(inv: Invoice) {
    confirm(t("sa.confirmDeleteInvoicePermanent"), async () => {
      try {
        await api.deleteInvoice(inv.id);
        showToast(t("sa.toastInvoiceDeletedPermanent"));
        loadInvoices();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, t("sa.deletePermanent"));
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
    confirm(t("sa.confirmDeleteRoomBookingPermanent"), async () => {
      try {
        await api.superAdminDeleteBooking(item.id);
        showToast(t("sa.toastBookingDeletedPermanent"));
        loadBookings();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, t("sa.deletePermanent"));
  }

  function updateKendaraanFilter(patch: Partial<KendaraanFilterState>) {
    setKendaraanFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function resetKendaraanFilters() {
    setKendaraanFilters(EMPTY_KENDARAAN_FILTERS);
  }

  function goToKendaraanPage(page: number) {
    if (page < 1) return;
    setKendaraanFilters((f) => ({ ...f, page }));
  }

  function handleDeleteKendaraanBooking(item: BookingKendaraan) {
    confirm(t("sa.confirmDeleteVehicleBookingPermanent"), async () => {
      try {
        await api.superAdminDeleteKendaraanBooking(item.id);
        showToast(t("sa.toastBookingDeletedPermanent"));
        loadKendaraanBookings();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, t("sa.deletePermanent"));
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.max(1, Math.min(filters.page, totalPages - 1));
  const pageEnd = Math.min(totalPages, pageStart + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotal / invoiceLimit));
  const invoicePageStart = Math.max(1, Math.min(invoicePage, invoiceTotalPages - 1));
  const invoicePageEnd = Math.min(invoiceTotalPages, invoicePageStart + 1);
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
  const bookingPageStart = Math.max(1, Math.min(bookingFilters.page, bookingTotalPages - 1));
  const bookingPageEnd = Math.min(bookingTotalPages, bookingPageStart + 1);
  const bookingPageButtons: number[] = [];
  for (let p = bookingPageStart; p <= bookingPageEnd; p++) bookingPageButtons.push(p);

  const bookingDivisiOptions = orgStructure?.divisi || [];
  const bookingSelectedDivisiNode = bookingFilters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === bookingFilters.divisi)
    : null;
  const bookingDepartemenOptions = bookingSelectedDivisiNode ? bookingSelectedDivisiNode.departemen : orgStructure?.departemen || [];

  const kendaraanTotalPages = Math.max(1, Math.ceil(kendaraanTotal / kendaraanFilters.limit));
  const kendaraanPageStart = Math.max(1, Math.min(kendaraanFilters.page, kendaraanTotalPages - 1));
  const kendaraanPageEnd = Math.min(kendaraanTotalPages, kendaraanPageStart + 1);
  const kendaraanPageButtons: number[] = [];
  for (let p = kendaraanPageStart; p <= kendaraanPageEnd; p++) kendaraanPageButtons.push(p);

  const kendaraanDivisiOptions = orgStructure?.divisi || [];
  const kendaraanSelectedDivisiNode = kendaraanFilters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === kendaraanFilters.divisi)
    : null;
  const kendaraanDepartemenOptions = kendaraanSelectedDivisiNode ? kendaraanSelectedDivisiNode.departemen : orgStructure?.departemen || [];

  return (
    <>
      <DashboardStats me={me} />

      <h2 style={{ margin: "24px 0 12px" }}>{t("nav.expedition")}</h2>

      <div className="card">
        <div className="toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-search">{t("common.searchTransaction")}</label>
            <input type="text" id="filter-search" placeholder={t("eks.noTransmittalPlaceholder")} value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-bulan">{t("common.filterMonth")}</label>
            <input type="month" id="filter-bulan" autoComplete="off" ref={filterBulanInputRef} value={filters.bulan} onChange={(e) => updateFilter({ bulan: e.target.value })} />
          </div>
          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="field-label-spacer">{t("common.filter")}</label>
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              {t("common.allFilters")}
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field">
                  <label htmlFor="filter-status">{t("common.status")}</label>
                  <SearchableSelect
                    id="filter-status"
                    value={filters.status}
                    onChange={(v) => updateFilter({ status: v as Status | "" })}
                    options={["DRAFT", "SUBMITTED", "REJECTED_L1", "APPROVED_L1", "REJECTED_GA", "APPROVED_GA", "REJECTED_GA_APPROVAL", "APPROVED_GA_APPROVAL", "REJECTED_KPU", "COMPLETED"]}
                    getLabel={(v) => getStatusLabelMap(language)[v as Status] || v}
                    clearLabel={t("common.allStatus")}
                    placeholder={t("common.allStatus")}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-direktorat">{t("word.directorate")}</label>
                  <SearchableSelect
                    id="filter-direktorat"
                    value={filters.direktorat}
                    onChange={(v) => updateFilter({ direktorat: v, divisi: "", departemen: "" })}
                    options={orgStructure?.direktorat || []}
                    clearLabel={t("common.allDirectorate")}
                    placeholder={t("common.allDirectorate")}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-divisi">{t("word.division")}</label>
                  <SearchableSelect
                    id="filter-divisi"
                    value={filters.divisi}
                    onChange={(v) => updateFilter({ divisi: v, departemen: "" })}
                    options={divisiOptions}
                    clearLabel={t("common.allDivision")}
                    placeholder={t("common.allDivision")}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-departemen">{t("word.department")}</label>
                  <SearchableSelect
                    id="filter-departemen"
                    value={filters.departemen}
                    onChange={(v) => updateFilter({ departemen: v })}
                    options={departemenOptions}
                    clearLabel={t("common.allDepartment")}
                    placeholder={t("common.allDepartment")}
                  />
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>{t("sa.hapusFilter")}</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("common.rowNo")}</th><th>{t("eks.noTransmittalPlaceholder")}</th><th>{t("eks.thNoResi")}</th><th>{t("common.date")}</th><th>{t("eks.tujuan")}</th><th>{t("eks.thItem")}</th><th>{t("word.division")}</th><th>{t("word.department")}</th>
                <th>{t("eks.thPengirim")}</th><th>{t("eks.thTelpPengirim")}</th><th>{t("eks.thPenerima")}</th><th>{t("eks.thTelpPenerima")}</th>
                <th>{t("eks.kodeProgram")}</th><th>{t("eks.asuransi")}</th><th>{t("eks.thPacking")}</th><th>{t("common.notes")}</th>
                <th>{t("eks.thBeratKg")}</th><th>{t("eks.hargaOngkosKirim")}</th><th>{t("common.total")}</th><th>{t("common.status")}</th><th>{t("common.aksi")}</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={21} className="table-empty">{t("common.loadingData")}</td></tr>
              ) : tableError ? (
                <tr><td colSpan={21} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={21} className="table-empty">{t("eks.noDataForFilter")}</td></tr>
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
                      <td><StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} /></td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => handleDelete(item)}>{t("common.delete")}</button>
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
              <label htmlFor="filter-limit">{t("common.show")}</label>
              <SearchableSelect
                id="filter-limit"
                value={String(filters.limit)}
                onChange={(v) => updateFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} ${t("eks.unitTransaksi")}`}
                placeholder={`${filters.limit} ${t("eks.unitTransaksi")}`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">{t("common.total")} {total} {t("eks.unitTransaksiCap")} · {t("common.page")} {filters.page} {t("common.ofTotal")} {totalPages}</span>
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
          <h3>{t("sa.historyInvoicePembiayaan")}</h3>
        </div>

        <div className="invoice-toolbar-slim">
          <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
            <label htmlFor="invoice-filter-bulan">{t("common.filterMonth")}</label>
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
            <span className="field-label-spacer">{t("eks.semuaInvoice")}</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "auto" }}
              onClick={() => { setInvoiceFilterBulan(""); setInvoicePage(1); }}
            >
              {t("eks.semuaInvoice")}
            </button>
          </div>
        </div>

        <div className="invoice-list">
          {invoiceError ? (
            <p className="text-secondary">{invoiceError}</p>
          ) : invoices == null ? (
            <p className="text-secondary">{t("eks.loadingInvoiceData")}</p>
          ) : invoices.length === 0 ? (
            <p className="text-secondary">{invoiceFilterBulan ? t("eks.noInvoiceForFilter") : t("eks.noInvoiceYet")}</p>
          ) : (
            invoices.map((inv) => (
              <div className="invoice-row" key={inv.id}>
                <div className="invoice-row-main">
                  <div className="invoice-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div className="invoice-row-info">
                    <div className="invoice-row-title">{t("nav.invoice")} {invoiceBulanLabel(inv.bulan)}</div>
                    <div className="invoice-row-meta">{inv.originalFilename} · {t("sa.uploadedAtPrefix")} {formatDateTime(inv.uploadedAt)}</div>
                    {inv.reviewedAt && <div className="invoice-row-meta">{t("sa.reviewedAtColon")} {formatDateTime(inv.reviewedAt)}</div>}
                    {inv.catatan && <div className="invoice-row-note"><strong>{t("sa.catatanColon")}</strong> {inv.catatan}</div>}
                  </div>
                </div>
                <div className="invoice-row-actions">
                  <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{getInvoiceStatusLabelMap(language)[inv.status] || inv.status}</span>
                  <button type="button" className="row-menu-btn" aria-label={t("common.aksi")} onClick={(e) => invoiceRowMenu.toggle(e, inv.id)}>
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
              <label htmlFor="invoice-limit">{t("common.show")}</label>
              <SearchableSelect
                id="invoice-limit"
                value={String(invoiceLimit)}
                onChange={(v) => { setInvoiceLimit(Number(v)); setInvoicePage(1); }}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} ${t("eks.unitInvoice")}`}
                placeholder={`${invoiceLimit} ${t("eks.unitInvoice")}`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">{t("common.total")} {invoiceTotal} {t("eks.unitInvoice")} · {t("common.page")} {invoicePage} {t("common.ofTotal")} {invoiceTotalPages}</span>
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

      <h2 style={{ margin: "24px 0 12px" }}>{t("nav.roomBooking")}</h2>

      <div className="card">
        <div className="card-header">
          <h3>{t("sa.roomBookingMeetingTitle")}</h3>
        </div>
        <div className="toolbar">
          <div className="field">
            <label htmlFor="filter-booking-tanggal">{t("sa.filterTanggal")}</label>
            <input type="date" id="filter-booking-tanggal" value={bookingFilters.tanggal} onChange={(e) => updateBookingFilter({ tanggal: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-status">{t("common.status")}</label>
            <SearchableSelect
              id="filter-booking-status"
              value={bookingFilters.status}
              onChange={(v) => updateBookingFilter({ status: v as BookingStatus | "" })}
              options={["DRAFT", "SUBMITTED", "REJECTED_L1", "APPROVED_L1", "REJECTED_GA", "APPROVED_GA", "REJECTED_GA_APPROVAL", "APPROVED_GA_APPROVAL"]}
              getLabel={(v) => getBookingStatusLabelMap(language)[v as BookingStatus] || v}
              clearLabel={t("common.allStatus")}
              placeholder={t("common.allStatus")}
            />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-ruang">{t("bk.ruangLabel")}</label>
            <SearchableSelect
              id="filter-booking-ruang"
              value={bookingFilters.namaRuang}
              onChange={(v) => updateBookingFilter({ namaRuang: v })}
              options={rooms.map((r) => r.nama)}
              clearLabel={t("bk.semuaRuang")}
              placeholder={t("bk.semuaRuang")}
            />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-divisi">{t("word.division")}</label>
            <SearchableSelect
              id="filter-booking-divisi"
              value={bookingFilters.divisi}
              onChange={(v) => updateBookingFilter({ divisi: v, departemen: "" })}
              options={bookingDivisiOptions}
              clearLabel={t("common.allDivision")}
              placeholder={t("common.allDivision")}
            />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-departemen">{t("word.department")}</label>
            <SearchableSelect
              id="filter-booking-departemen"
              value={bookingFilters.departemen}
              onChange={(v) => updateBookingFilter({ departemen: v })}
              options={bookingDepartemenOptions}
              clearLabel={t("common.allDepartment")}
              placeholder={t("common.allDepartment")}
            />
          </div>
          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetBookingFilters}>{t("sa.hapusFilter")}</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("common.rowNo")}</th><th>{t("sa.thNoPesanan")}</th><th>{t("bk.namaKegiatan")}</th><th>{t("bk.pic")}</th><th>{t("bk.ruangLabel")}</th><th>{t("sa.thPeserta")}</th>
                <th>{t("common.date")}</th><th>{t("common.time")}</th><th>{t("bk.diajukanHeader")}</th><th>{t("word.division")}</th><th>{t("word.department")}</th><th>{t("common.status")}</th><th>{t("common.aksi")}</th>
              </tr>
            </thead>
            <tbody>
              {bookingBusy ? (
                <tr><td colSpan={13} className="table-empty">{t("common.loadingData")}</td></tr>
              ) : bookingError ? (
                <tr><td colSpan={13} className="table-empty">{bookingError}</td></tr>
              ) : bookingItems.length === 0 ? (
                <tr><td colSpan={13} className="table-empty">{t("eks.noDataForFilter")}</td></tr>
              ) : (
                bookingItems.map((item, index) => {
                  const rowNumber = (bookingFilters.page - 1) * bookingFilters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPemesanan || "-"}</td>
                      <td title={item.namaKegiatan}>{truncateText(item.namaKegiatan, 25)}</td>
                      <td title={item.pic || ""}>{truncateText(item.pic, 15)}</td>
                      <td title={bookingRoomsLabel(item)}>{truncateText(bookingRoomsLabel(item), 20)}</td>
                      <td>{item.jumlahPeserta}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td>
                        <span className="badge-stack">
                          <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} />
                          {item.hasConflict && <span className="badge badge-rejected">{t("sa.bentrok")}</span>}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => handleDeleteBooking(item)}>{t("common.delete")}</button>
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
              <label htmlFor="filter-booking-limit">{t("common.show")}</label>
              <SearchableSelect
                id="filter-booking-limit"
                value={String(bookingFilters.limit)}
                onChange={(v) => updateBookingFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} ${t("sa.unitBooking")}`}
                placeholder={`${bookingFilters.limit} ${t("sa.unitBooking")}`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">{t("common.total")} {bookingTotal} {t("sa.unitBooking")} · {t("common.page")} {bookingFilters.page} {t("common.ofTotal")} {bookingTotalPages}</span>
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
          <h3>{t("sa.historyInvoicePembiayaan")}</h3>
        </div>

        <div className="invoice-toolbar-slim">
          <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
            <label htmlFor="invoice-filter-bulan">{t("common.filterMonth")}</label>
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
            <span className="field-label-spacer">{t("eks.semuaInvoice")}</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "auto" }}
              onClick={() => { setInvoiceFilterBulan(""); setInvoicePage(1); }}
            >
              {t("eks.semuaInvoice")}
            </button>
          </div>
        </div>

        <div className="invoice-list">
          {invoiceError ? (
            <p className="text-secondary">{invoiceError}</p>
          ) : invoices == null ? (
            <p className="text-secondary">{t("eks.loadingInvoiceData")}</p>
          ) : invoices.length === 0 ? (
            <p className="text-secondary">{invoiceFilterBulan ? t("eks.noInvoiceForFilter") : t("eks.noInvoiceYet")}</p>
          ) : (
            invoices.map((inv) => (
              <div className="invoice-row" key={inv.id}>
                <div className="invoice-row-main">
                  <div className="invoice-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div className="invoice-row-info">
                    <div className="invoice-row-title">{t("nav.invoice")} {invoiceBulanLabel(inv.bulan)}</div>
                    <div className="invoice-row-meta">{inv.originalFilename} · {t("sa.uploadedAtPrefix")} {formatDateTime(inv.uploadedAt)}</div>
                    {inv.reviewedAt && <div className="invoice-row-meta">{t("sa.reviewedAtColon")} {formatDateTime(inv.reviewedAt)}</div>}
                    {inv.catatan && <div className="invoice-row-note"><strong>{t("sa.catatanColon")}</strong> {inv.catatan}</div>}
                  </div>
                </div>
                <div className="invoice-row-actions">
                  <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{getInvoiceStatusLabelMap(language)[inv.status] || inv.status}</span>
                  <button type="button" className="row-menu-btn" aria-label={t("common.aksi")} onClick={(e) => invoiceRowMenu.toggle(e, inv.id)}>
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
              <label htmlFor="invoice-limit">{t("common.show")}</label>
              <SearchableSelect
                id="invoice-limit"
                value={String(invoiceLimit)}
                onChange={(v) => { setInvoiceLimit(Number(v)); setInvoicePage(1); }}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} ${t("eks.unitInvoice")}`}
                placeholder={`${invoiceLimit} ${t("eks.unitInvoice")}`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">{t("common.total")} {invoiceTotal} {t("eks.unitInvoice")} · {t("common.page")} {invoicePage} {t("common.ofTotal")} {invoiceTotalPages}</span>
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
