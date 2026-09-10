"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { arsipItemsSummary, bookingRoomsLabel, INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatTimeRange, invoiceBulanLabel, truncateText } from "@/lib/format";
import type { BookingKendaraan, BookingRuang, BookingStatus, Invoice, Pengiriman, PermintaanArsip, RoomOption, Status, VehicleOption } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import { useRowMenu } from "@/lib/useRowMenu";
import StatusBadge from "@/components/StatusBadge";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import InvoiceRowMenuDropdown from "@/components/InvoiceRowMenuDropdown";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import InvoiceHistoryModal from "@/components/InvoiceHistoryModal";
import DashboardStats from "@/components/DashboardStats";
import NotificationSoundSettingsCard from "@/components/NotificationSoundSettingsCard";
import SearchableSelect from "@/components/SearchableSelect";
import MonthFilterPicker from "@/components/MonthFilterPicker";
import DateFilterPicker from "@/components/DateFilterPicker";
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

interface ArsipFilterState {
  page: number;
  limit: number;
  bulan: string;
  search: string;
  status: BookingStatus | "REJECTED" | "";
  divisi: string;
  departemen: string;
}

const EMPTY_ARSIP_FILTERS: ArsipFilterState = { page: 1, limit: 10, bulan: "", search: "", status: "", divisi: "", departemen: "" };

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
  useExclusivePanel(filterOpen, () => setFilterOpen(false));
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

  const [arsipFilters, setArsipFilters] = useState<ArsipFilterState>(EMPTY_ARSIP_FILTERS);
  const [arsipSearchInput, setArsipSearchInput] = useState("");
  const [arsipItems, setArsipItems] = useState<PermintaanArsip[]>([]);
  const [arsipTotal, setArsipTotal] = useState(0);
  const [arsipBusy, setArsipBusy] = useState(true);
  const [arsipError, setArsipError] = useState("");

  const invoiceRowMenu = useRowMenu(invoices ?? []);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const tableReqIdRef = useRef(0);
  const invoiceReqIdRef = useRef(0);
  const bookingReqIdRef = useRef(0);
  const kendaraanReqIdRef = useRef(0);
  const arsipSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arsipReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

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

  const loadArsip = useCallback(async () => {
    const reqId = ++arsipReqIdRef.current;
    setArsipBusy(true);
    setArsipError("");
    try {
      const result = await api.listArsip({
        page: arsipFilters.page,
        limit: arsipFilters.limit,
        bulan: arsipFilters.bulan,
        status: arsipFilters.status,
        divisi: arsipFilters.divisi,
        departemen: arsipFilters.departemen,
        search: arsipFilters.search,
      });
      if (reqId !== arsipReqIdRef.current) return;
      const arsipItemsResult = result?.items ?? [];
      const arsipTotalResult = result?.total ?? 0;
      if (arsipItemsResult.length === 0 && arsipTotalResult > 0 && arsipFilters.page > 1) {
        setArsipFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setArsipItems(arsipItemsResult);
      setArsipTotal(arsipTotalResult);
    } catch (err) {
      if (reqId !== arsipReqIdRef.current) return;
      setArsipError((err as Error).message);
    } finally {
      if (reqId === arsipReqIdRef.current) setArsipBusy(false);
    }
  }, [arsipFilters]);

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
    loadArsip();
  }, [loadArsip]);

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
    confirm("Yakin ingin menghapus booking kendaraan ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.superAdminDeleteKendaraanBooking(item.id);
        showToast("Booking berhasil dihapus permanen");
        loadKendaraanBookings();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  function updateArsipFilter(patch: Partial<ArsipFilterState>) {
    setArsipFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleArsipSearchChange(value: string) {
    setArsipSearchInput(value);
    if (arsipSearchDebounce.current) clearTimeout(arsipSearchDebounce.current);
    arsipSearchDebounce.current = setTimeout(() => {
      updateArsipFilter({ search: value.trim() });
    }, 350);
  }

  function resetArsipFilters() {
    setArsipSearchInput("");
    setArsipFilters(EMPTY_ARSIP_FILTERS);
  }

  function goToArsipPage(page: number) {
    if (page < 1) return;
    setArsipFilters((f) => ({ ...f, page }));
  }

  function handleDeleteArsip(item: PermintaanArsip) {
    confirm("Yakin ingin menghapus pemindahan arsip ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.superAdminDeleteArsip(item.id);
        showToast("Data berhasil dihapus permanen");
        loadArsip();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  // Anchored at the current page (not a fixed 2-wide window pulled back from the end), so the
  // last page shows just itself instead of always padding in the page before it too.
  const pageStart = Math.min(Math.max(1, filters.page), totalPages);
  const pageEnd = Math.min(totalPages, pageStart + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotal / invoiceLimit));
  const invoicePageStart = Math.min(Math.max(1, invoicePage), invoiceTotalPages);
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
  const bookingPageStart = Math.min(Math.max(1, bookingFilters.page), bookingTotalPages);
  const bookingPageEnd = Math.min(bookingTotalPages, bookingPageStart + 1);
  const bookingPageButtons: number[] = [];
  for (let p = bookingPageStart; p <= bookingPageEnd; p++) bookingPageButtons.push(p);

  const bookingDivisiOptions = orgStructure?.divisi || [];
  const bookingSelectedDivisiNode = bookingFilters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === bookingFilters.divisi)
    : null;
  const bookingDepartemenOptions = bookingSelectedDivisiNode ? bookingSelectedDivisiNode.departemen : orgStructure?.departemen || [];

  const kendaraanTotalPages = Math.max(1, Math.ceil(kendaraanTotal / kendaraanFilters.limit));
  const kendaraanPageStart = Math.min(Math.max(1, kendaraanFilters.page), kendaraanTotalPages);
  const kendaraanPageEnd = Math.min(kendaraanTotalPages, kendaraanPageStart + 1);
  const kendaraanPageButtons: number[] = [];
  for (let p = kendaraanPageStart; p <= kendaraanPageEnd; p++) kendaraanPageButtons.push(p);

  const kendaraanDivisiOptions = orgStructure?.divisi || [];
  const kendaraanSelectedDivisiNode = kendaraanFilters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === kendaraanFilters.divisi)
    : null;
  const kendaraanDepartemenOptions = kendaraanSelectedDivisiNode ? kendaraanSelectedDivisiNode.departemen : orgStructure?.departemen || [];

  const arsipTotalPages = Math.max(1, Math.ceil(arsipTotal / arsipFilters.limit));
  const arsipPageStart = Math.min(Math.max(1, arsipFilters.page), arsipTotalPages);
  const arsipPageEnd = Math.min(arsipTotalPages, arsipPageStart + 1);
  const arsipPageButtons: number[] = [];
  for (let p = arsipPageStart; p <= arsipPageEnd; p++) arsipPageButtons.push(p);

  const arsipDivisiOptions = orgStructure?.divisi || [];
  const arsipSelectedDivisiNode = arsipFilters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === arsipFilters.divisi)
    : null;
  const arsipDepartemenOptions = arsipSelectedDivisiNode ? arsipSelectedDivisiNode.departemen : orgStructure?.departemen || [];

  return (
    <>
      <DashboardStats me={me} />

      <NotificationSoundSettingsCard />

      <h2 style={{ margin: "24px 0 12px" }}>Expedition</h2>

      <div className="card">
        <div className="toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-search">Cari Transaksi</label>
            <input type="text" id="filter-search" placeholder="No Transmittal" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-bulan">Filter Bulan</label>
            <MonthFilterPicker id="filter-bulan" value={filters.bulan} onChange={(v) => updateFilter({ bulan: v })} />
          </div>
          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button type="button" className="btn filter-dropdown-toggle" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
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
                    onChange={(v) => updateFilter({ status: v as Status | "" })}
                    options={["DRAFT", "SUBMITTED", "REJECTED_L1", "APPROVED_L1", "REJECTED_GA", "APPROVED_GA", "REJECTED_GA_APPROVAL", "APPROVED_GA_APPROVAL", "REJECTED_KPU", "COMPLETED"]}
                    getLabel={(v) => ({
                      DRAFT: "Draft",
                      SUBMITTED: "On-Approval: Approval Departemen/Divisi",
                      REJECTED_L1: "Rejected: Approval Departemen/Divisi",
                      APPROVED_L1: "On-Approval: Admin GA",
                      REJECTED_GA: "Rejected: Admin GA",
                      APPROVED_GA: "On-Approval: Approval GA",
                      REJECTED_GA_APPROVAL: "Rejected: Approval GA",
                      APPROVED_GA_APPROVAL: "On-Approval: Mitra",
                      REJECTED_KPU: "Rejected: Mitra",
                      COMPLETED: "Approved",
                    } as Record<string, string>)[v] || v}
                    clearLabel="Semua Status"
                    placeholder="Semua Status"
                  />
                </div>
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
                <th>Pengirim</th><th>No. Telepon Pengirim</th><th>Penerima</th><th>No. Telepon Penerima</th>
                <th>Kode Program</th><th>Asuransi</th><th>Packing</th><th>Catatan</th>
                <th>Berat (Kg)</th><th>Harga Ongkos Kirim</th><th>Total</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={21} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={21} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={21} className="table-empty">Tidak Ada Data</td></tr>
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

      <div className="card">
        <div className="card-header">
          <h3>History Invoice Pembiayaan</h3>
        </div>

        <div className="invoice-toolbar-slim">
          <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
            <label htmlFor="invoice-filter-bulan">Filter Bulan</label>
            <MonthFilterPicker
              id="invoice-filter-bulan"
              value={invoiceFilterBulan}
              onChange={(v) => { setInvoiceFilterBulan(v); setInvoicePage(1); }}
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
              <SearchableSelect
                id="invoice-limit"
                value={String(invoiceLimit)}
                onChange={(v) => { setInvoiceLimit(Number(v)); setInvoicePage(1); }}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} invoice`}
                placeholder={`${invoiceLimit} invoice`}
              />
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

      <h2 style={{ margin: "24px 0 12px" }}>Room Booking</h2>

      <div className="card">
        <div className="card-header">
          <h3>Room Booking Meeting</h3>
        </div>
        <div className="toolbar">
          <div className="field">
            <label htmlFor="filter-booking-tanggal">Filter Tanggal</label>
            <DateFilterPicker id="filter-booking-tanggal" value={bookingFilters.tanggal} onChange={(v) => updateBookingFilter({ tanggal: v })} />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-status">Status</label>
            <SearchableSelect
              id="filter-booking-status"
              value={bookingFilters.status}
              onChange={(v) => updateBookingFilter({ status: v as BookingStatus | "" })}
              options={["DRAFT", "SUBMITTED", "REJECTED_L1", "APPROVED_L1", "REJECTED_GA", "APPROVED_GA", "REJECTED_GA_APPROVAL", "APPROVED_GA_APPROVAL"]}
              getLabel={(v) => ({
                DRAFT: "Draft",
                SUBMITTED: "On-Approval: Approval Departemen/Divisi",
                REJECTED_L1: "Rejected: Approval Departemen/Divisi",
                APPROVED_L1: "On-Approval: Admin GA",
                REJECTED_GA: "Rejected: Admin GA",
                APPROVED_GA: "On-Approval: Approval GA",
                REJECTED_GA_APPROVAL: "Rejected: Approval GA",
                APPROVED_GA_APPROVAL: "Approved",
              } as Record<string, string>)[v] || v}
              clearLabel="Semua Status"
              placeholder="Semua Status"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-ruang">Ruang</label>
            <SearchableSelect
              id="filter-booking-ruang"
              value={bookingFilters.namaRuang}
              onChange={(v) => updateBookingFilter({ namaRuang: v })}
              options={rooms.map((r) => r.nama)}
              clearLabel="Semua Ruang"
              placeholder="Semua Ruang"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-divisi">Divisi</label>
            <SearchableSelect
              id="filter-booking-divisi"
              value={bookingFilters.divisi}
              onChange={(v) => updateBookingFilter({ divisi: v, departemen: "" })}
              options={bookingDivisiOptions}
              clearLabel="Semua Divisi"
              placeholder="Semua Divisi"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-departemen">Departemen</label>
            <SearchableSelect
              id="filter-booking-departemen"
              value={bookingFilters.departemen}
              onChange={(v) => updateBookingFilter({ departemen: v })}
              options={bookingDepartemenOptions}
              clearLabel="Semua Departemen"
              placeholder="Semua Departemen"
            />
          </div>
          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetBookingFilters}>Hapus Filter</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pesanan</th><th>Nama Kegiatan</th><th>PIC</th><th>Ruang</th><th>Peserta</th>
                <th>Tanggal</th><th>Jam</th><th>Diajukan</th><th>Divisi</th><th>Departemen</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bookingBusy ? (
                <tr><td colSpan={13} className="table-empty">Memuat data...</td></tr>
              ) : bookingError ? (
                <tr><td colSpan={13} className="table-empty">{bookingError}</td></tr>
              ) : bookingItems.length === 0 ? (
                <tr><td colSpan={13} className="table-empty">Tidak Ada Data</td></tr>
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
              <SearchableSelect
                id="filter-booking-limit"
                value={String(bookingFilters.limit)}
                onChange={(v) => updateBookingFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} booking`}
                placeholder={`${bookingFilters.limit} booking`}
              />
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
            <MonthFilterPicker
              id="invoice-filter-bulan"
              value={invoiceFilterBulan}
              onChange={(v) => { setInvoiceFilterBulan(v); setInvoicePage(1); }}
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
              <SearchableSelect
                id="invoice-limit"
                value={String(invoiceLimit)}
                onChange={(v) => { setInvoiceLimit(Number(v)); setInvoicePage(1); }}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} invoice`}
                placeholder={`${invoiceLimit} invoice`}
              />
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

      <h2 style={{ margin: "24px 0 12px" }}>Archive</h2>

      <div className="card">
        <div className="card-header">
          <h3>Pemindahan Arsip</h3>
        </div>
        <div className="toolbar">
          <div className="field">
            <label htmlFor="filter-arsip-search">Cari Arsip</label>
            <input type="text" id="filter-arsip-search" placeholder="No Pemindahan" value={arsipSearchInput} onChange={(e) => handleArsipSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-arsip-bulan">Filter Bulan</label>
            <MonthFilterPicker id="filter-arsip-bulan" value={arsipFilters.bulan} onChange={(v) => updateArsipFilter({ bulan: v })} />
          </div>
          <div className="field">
            <label htmlFor="filter-arsip-status">Status</label>
            <SearchableSelect
              id="filter-arsip-status"
              value={arsipFilters.status}
              onChange={(v) => updateArsipFilter({ status: v as BookingStatus | "REJECTED" | "" })}
              options={["DRAFT", "SUBMITTED", "APPROVED_L1", "APPROVED_GA", "REJECTED", "APPROVED_GA_APPROVAL"]}
              getLabel={(v) => ({
                DRAFT: "Draft",
                SUBMITTED: "On-Approval: Approval Departemen/Divisi",
                APPROVED_L1: "On-Approval: Admin GA",
                APPROVED_GA: "On-Approval: Approval GA",
                REJECTED: "Rejected",
                APPROVED_GA_APPROVAL: "Approved",
              } as Record<string, string>)[v] || v}
              clearLabel="Semua Status"
              placeholder="Semua Status"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-arsip-divisi">Divisi</label>
            <SearchableSelect
              id="filter-arsip-divisi"
              value={arsipFilters.divisi}
              onChange={(v) => updateArsipFilter({ divisi: v, departemen: "" })}
              options={arsipDivisiOptions}
              clearLabel="Semua Divisi"
              placeholder="Semua Divisi"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-arsip-departemen">Departemen</label>
            <SearchableSelect
              id="filter-arsip-departemen"
              value={arsipFilters.departemen}
              onChange={(v) => updateArsipFilter({ departemen: v })}
              options={arsipDepartemenOptions}
              clearLabel="Semua Departemen"
              placeholder="Semua Departemen"
            />
          </div>
          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetArsipFilters}>Hapus Filter</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pemindahan</th><th>Diajukan</th><th>Daftar Arsip</th>
                <th>Lokasi Penyimpanan Saat Ini</th><th>Divisi</th><th>Departemen</th><th>Tanggal</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {arsipBusy ? (
                <tr><td colSpan={10} className="table-empty">Memuat data...</td></tr>
              ) : arsipError ? (
                <tr><td colSpan={10} className="table-empty">{arsipError}</td></tr>
              ) : arsipItems.length === 0 ? (
                <tr><td colSpan={10} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                arsipItems.map((item, index) => {
                  const rowNumber = (arsipFilters.page - 1) * arsipFilters.limit + index + 1;
                  const arsipList = arsipItemsSummary(item);
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorArsip || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td title={arsipList}>{truncateText(arsipList, 45)}</td>
                      <td title={item.lokasiPenyimpanan}>{truncateText(item.lokasiPenyimpanan, 25)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td><BookingStatusBadge status={item.status} departemen={item.departemen} /></td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => handleDeleteArsip(item)}>Delete</button>
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
              <label htmlFor="filter-arsip-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-arsip-limit"
                value={String(arsipFilters.limit)}
                onChange={(v) => updateArsipFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} pemindahan`}
                placeholder={`${arsipFilters.limit} pemindahan`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {arsipTotal} pemindahan · Halaman {arsipFilters.page} dari {arsipTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={arsipFilters.page <= 1} onClick={() => goToArsipPage(arsipFilters.page - 1)}>‹</button>
              {arsipPageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === arsipFilters.page ? "active" : ""}`} onClick={() => goToArsipPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={arsipFilters.page >= arsipTotalPages} onClick={() => goToArsipPage(arsipFilters.page + 1)}>›</button>
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
