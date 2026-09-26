"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ARCHIVE_KATEGORI_LABEL, atkItemsSummary, bookingRoomsLabel, BOOKING_STATUS_LABEL, buildRoomBookingDuplicateInitial, buildVehicleBookingDuplicateInitial, canGaKoreksiArsip, canGaKoreksiPengiriman, canGaKoreksiSarana, canGaRescheduleBooking, canGaRescheduleKendaraan, canGaUpdateAtk, canKoreksiHargaAtk, canKoreksiHargaPengiriman, EXECUTION_STAGE_LABEL, INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL, isArsipEditableByOrigin, isArsipPdfAvailable, isAtkEditableByOrigin, isAtkPdfAvailable, isBookingCancellableByOrigin, isBookingDeletableByOrigin, isBookingEditableByOrigin, isBookingPdfAvailable, isEditableByOrigin, isKendaraanCancellableByOrigin, isKendaraanDeletableByOrigin, isKendaraanEditableByOrigin, isKendaraanPdfAvailable, isPengirimanPdfAvailable, isSaranaEditableByOrigin, isSaranaPdfAvailable, KATEGORI_ATK_LABEL, KATEGORI_KERUSAKAN_LABEL, STATUS_LABEL, SUMBER_PEMBELIAN_LABEL, TIPE_BOOKING_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatTimeRange, invoiceBulanLabel, truncateText } from "@/lib/format";
import type { ArchiveKategori, BookingKendaraan, BookingKendaraanCreatePayload, BookingRuang, BookingRuangCreatePayload, BookingStatus, Invoice, KategoriKerusakan, PerbaikanSarana, Pengiriman, PermintaanArsip, PermintaanAtk, RoomOption, Status, SumberPembelian, VehicleOption } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import { useRowMenu } from "@/lib/useRowMenu";
import StatusBadge from "@/components/StatusBadge";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import AtkStatusBadge from "@/components/AtkStatusBadge";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import ChatModal from "@/components/ChatModal";
import PengirimanFormModal from "@/components/PengirimanFormModal";
import PengirimanDetailModal from "@/components/PengirimanDetailModal";
import PengirimanKoreksiModal from "@/components/PengirimanKoreksiModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import StatusHistoryModal from "@/components/StatusHistoryModal";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RoomBookingRescheduleModal from "@/components/RoomBookingRescheduleModal";
import CancelBookingModal from "@/components/CancelBookingModal";
import BookingStatusHistoryModal from "@/components/BookingStatusHistoryModal";
import RoomBookingChatModal from "@/components/RoomBookingChatModal";
import VehicleBookingFormModal from "@/components/VehicleBookingFormModal";
import VehicleBookingDetailModal from "@/components/VehicleBookingDetailModal";
import VehicleBookingRescheduleModal from "@/components/VehicleBookingRescheduleModal";
import VehicleBookingStatusHistoryModal from "@/components/VehicleBookingStatusHistoryModal";
import VehicleBookingChatModal from "@/components/VehicleBookingChatModal";
import AtkFormModal from "@/components/AtkFormModal";
import AtkDetailModal from "@/components/AtkDetailModal";
import AtkStatusHistoryModal from "@/components/AtkStatusHistoryModal";
import AtkChatModal from "@/components/AtkChatModal";
import SaranaFormModal from "@/components/SaranaFormModal";
import SaranaDetailModal from "@/components/SaranaDetailModal";
import SaranaKoreksiModal from "@/components/SaranaKoreksiModal";
import SaranaStatusHistoryModal from "@/components/SaranaStatusHistoryModal";
import SaranaChatModal from "@/components/SaranaChatModal";
import ArsipFormModal from "@/components/ArsipFormModal";
import ArsipDetailModal from "@/components/ArsipDetailModal";
import ArsipKoreksiModal from "@/components/ArsipKoreksiModal";
import ArsipStatusHistoryModal from "@/components/ArsipStatusHistoryModal";
import ArsipChatModal from "@/components/ArsipChatModal";
import InvoiceRowMenuDropdown from "@/components/InvoiceRowMenuDropdown";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import InvoiceHistoryModal from "@/components/InvoiceHistoryModal";
import DashboardStats from "@/components/DashboardStats";
import DashboardContent from "@/components/DashboardContent";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import NotificationSoundSettingsCard from "@/components/NotificationSoundSettingsCard";
import BulkDeleteModal, { type BulkDeleteTarget } from "@/components/BulkDeleteModal";
import RiwayatAktivitasCard from "@/components/RiwayatAktivitasCard";
import SearchableSelect from "@/components/SearchableSelect";
import MonthFilterPicker from "@/components/MonthFilterPicker";
import DateFilterPicker from "@/components/DateFilterPicker";
import PeriodFilterPicker from "@/components/PeriodFilterPicker";
import { Building2, Calendar, Car, ClipboardList, Folder, Layers, Shield, Users, Wrench } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import SuperAdminOrgTab from "@/components/SuperAdminOrgTab";
import SuperAdminUsersTab from "@/components/SuperAdminUsersTab";
import SuperAdminMeetingRoomTab from "@/components/SuperAdminMeetingRoomTab";
import SuperAdminVehicleTab from "@/components/SuperAdminVehicleTab";

export type SuperAdminTab = "overview" | "ekspedisi" | "booking-ruang" | "booking-kendaraan" | "atk" | "sarana" | "arsip" | "organisasi" | "users";

const TABS: { key: SuperAdminTab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Ringkasan & Audit", icon: <Shield width={16} height={16} /> },
  { key: "ekspedisi", label: "Ekspedisi & Invoice", icon: <Layers width={16} height={16} /> },
  { key: "booking-ruang", label: "Room Booking", icon: <Calendar width={16} height={16} /> },
  { key: "booking-kendaraan", label: "Vehicle Booking", icon: <Car width={16} height={16} /> },
  { key: "atk", label: "Office Supplies", icon: <ClipboardList width={16} height={16} /> },
  { key: "sarana", label: "Maintenance", icon: <Wrench width={16} height={16} /> },
  { key: "arsip", label: "Arsip", icon: <Folder width={16} height={16} /> },
  { key: "organisasi", label: "Organisasi", icon: <Building2 width={16} height={16} /> },
  { key: "users", label: "Users", icon: <Users width={16} height={16} /> },
];

interface BookingFilterState {
  page: number;
  limit: number;
  tanggal: string;
  status: BookingStatus | "REJECTED" | "ON_APPROVAL" | "";
  divisi: string;
  departemen: string;
  namaRuang: string;
}

const EMPTY_BOOKING_FILTERS: BookingFilterState = { page: 1, limit: 10, tanggal: "", status: "", divisi: "", departemen: "", namaRuang: "" };

const AUTO_WIDTH_STYLE = { width: "auto" };
const RESET_FILTER_BUTTON_STYLE = { width: "auto", alignSelf: "flex-end" };
const FIELD_NO_MARGIN_STYLE = { marginBottom: 0 };
const FIELD_NO_MARGIN_TOP_SPACED_STYLE = { marginBottom: 0, marginTop: 12 };

interface KendaraanFilterState {
  page: number;
  limit: number;
  tanggal: string;
  status: BookingStatus | "REJECTED" | "ON_APPROVAL" | "";
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
  status: BookingStatus | "REJECTED" | "ON_APPROVAL" | "";
  kategori: ArchiveKategori | "";
  divisi: string;
  departemen: string;
}

const EMPTY_ARSIP_FILTERS: ArsipFilterState = { page: 1, limit: 10, bulan: "", search: "", status: "", kategori: "", divisi: "", departemen: "" };

interface AtkFilterState {
  page: number;
  limit: number;
  bulan: string;
  search: string;
  status: Status | "REJECTED" | "ON_APPROVAL" | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  sumberPembelian: SumberPembelian | "";
}

const EMPTY_ATK_FILTERS: AtkFilterState = { page: 1, limit: 10, bulan: "", search: "", status: "", divisi: "", departemen: "", direktorat: "", sumberPembelian: "" };

interface SaranaFilterState {
  page: number;
  limit: number;
  bulan: string;
  search: string;
  status: BookingStatus | "REJECTED" | "ON_APPROVAL" | "";
  kategori: KategoriKerusakan | "";
  divisi: string;
  departemen: string;
  direktorat: string;
}

const EMPTY_SARANA_FILTERS: SaranaFilterState = { page: 1, limit: 10, bulan: "", search: "", status: "", kategori: "", divisi: "", departemen: "", direktorat: "" };

interface FilterState {
  page: number;
  limit: number;
  tanggal: string;
  bulan: string;
  search: string;
  status: Status | "REJECTED" | "ON_APPROVAL" | "";
  divisi: string;
  departemen: string;
  direktorat: string;
}

const EMPTY_FILTERS: FilterState = { page: 1, limit: 10, tanggal: "", bulan: "", search: "", status: "", divisi: "", departemen: "", direktorat: "" };

function SuperAdminPageInner() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTabState] = useState<SuperAdminTab>(() => {
    const fromUrl = searchParams.get("tab") as SuperAdminTab | null;
    return fromUrl && TABS.some((t) => t.key === fromUrl) ? fromUrl : "overview";
  });
  // Keeps the URL's ?tab= in sync (so the sidebar submenu highlights the right item, and a
  // refresh/shared link lands back on the same tab) - the only other way activeTab changes is the
  // effect below reacting to a sidebar link's own navigation.
  const selectTab = useCallback((tab: SuperAdminTab) => {
    setActiveTabState(tab);
    router.replace(`/superadmin?tab=${tab}`, { scroll: false });
  }, [router]);
  // Sidebar submenu links navigate with a plain <Link> (not selectTab), which changes
  // searchParams without unmounting this page - sync activeTab from the URL whenever that happens
  // from outside (a direct link, browser back/forward), not just from selectTab's own replace.
  useEffect(() => {
    const fromUrl = searchParams.get("tab") as SuperAdminTab | null;
    if (fromUrl && TABS.some((t) => t.key === fromUrl) && fromUrl !== activeTab) setActiveTabState(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [ekspedisiSubtab, setEkspedisiSubtab] = useState<"pengiriman" | "invoice">("pengiriman");

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<Pengiriman[]>([]);
  const [total, setTotal] = useState(0);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  useExclusivePanel(filterOpen, () => setFilterOpen(false));
  // Ekspedisi tab's interactive-replica state (Detail/Chat/Reject/Koreksi/Status-history/row menu)
  // - "ekspedisi"-prefixed since Room Booking/Vehicle/ATK/Maintenance/Arsip tabs each carry the
  // same shape for their own module, all living in this one page component.
  const [ekspedisiFormOpen, setEkspedisiFormOpen] = useState(false);
  const [ekspedisiDetail, setEkspedisiDetail] = useState<{ item: Pengiriman; mode: "view" | "edit" | "kpu-edit" } | null>(null);
  const [ekspedisiStatusItemId, setEkspedisiStatusItemId] = useState<number | null>(null);
  const [ekspedisiChatItem, setEkspedisiChatItem] = useState<Pengiriman | null>(null);
  const [ekspedisiRejectTarget, setEkspedisiRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string; createdByRole: string } | null>(null);
  const [ekspedisiKoreksiTarget, setEkspedisiKoreksiTarget] = useState<Pengiriman | null>(null);
  const ekspedisiRowMenu = useRowMenu(items);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceFilterBulan, setInvoiceFilterBulan] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(10);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [invoiceHistoryId, setInvoiceHistoryId] = useState<number | null>(null);
  // One modal serves every section's "Hapus Semua" - whichever section set it describes itself.
  const [bulkTarget, setBulkTarget] = useState<BulkDeleteTarget | null>(null);

  const [bookingFilters, setBookingFilters] = useState<BookingFilterState>(EMPTY_BOOKING_FILTERS);
  const [bookingItems, setBookingItems] = useState<BookingRuang[]>([]);
  const [bookingTotal, setBookingTotal] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(true);
  const [bookingError, setBookingError] = useState("");
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  // "Ruang Meeting" (roster management, formerly its own top-level tab) folded in as a sub-tab
  // here instead - it's the room-side counterpart to this tab's own booking transactions.
  const [bookingRuangSubtab, setBookingRuangSubtab] = useState<"transaksi" | "roster">("transaksi");
  // Room Booking tab's interactive-replica state - same idea as the Ekspedisi tab's above, but
  // mirroring booking-ruang-meeting/transaksi's own modals (Reschedule/Cancel/Duplicate, no Koreksi).
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingFormInitial, setBookingFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [bookingDetail, setBookingDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [bookingRescheduleTarget, setBookingRescheduleTarget] = useState<BookingRuang | null>(null);
  const [bookingStatusItemId, setBookingStatusItemId] = useState<number | null>(null);
  const [bookingChatItem, setBookingChatItem] = useState<BookingRuang | null>(null);
  const [bookingRejectTarget, setBookingRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [bookingCancelTargetId, setBookingCancelTargetId] = useState<number | null>(null);
  const bookingRowMenu = useRowMenu(bookingItems);

  const [kendaraanFilters, setKendaraanFilters] = useState<KendaraanFilterState>(EMPTY_KENDARAAN_FILTERS);
  const [kendaraanItems, setKendaraanItems] = useState<BookingKendaraan[]>([]);
  const [kendaraanTotal, setKendaraanTotal] = useState(0);
  const [kendaraanBusy, setKendaraanBusy] = useState(true);
  const [kendaraanError, setKendaraanError] = useState("");
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  // "Kendaraan" (roster management, formerly its own top-level tab) folded in as a sub-tab here
  // instead - it's the vehicle-side counterpart to this tab's own booking transactions.
  const [kendaraanSubtab, setKendaraanSubtab] = useState<"transaksi" | "roster">("transaksi");
  // Vehicle Booking tab's interactive-replica state - mirrors booking-kendaraan/transaksi's own
  // modals (Reschedule/Cancel/Duplicate, no Koreksi).
  const [kendaraanFormOpen, setKendaraanFormOpen] = useState(false);
  const [kendaraanFormInitial, setKendaraanFormInitial] = useState<Partial<BookingKendaraanCreatePayload> | undefined>(undefined);
  const [kendaraanDetail, setKendaraanDetail] = useState<{ item: BookingKendaraan; mode: "view" | "edit" } | null>(null);
  const [kendaraanRescheduleTarget, setKendaraanRescheduleTarget] = useState<BookingKendaraan | null>(null);
  const [kendaraanStatusItemId, setKendaraanStatusItemId] = useState<number | null>(null);
  const [kendaraanChatItem, setKendaraanChatItem] = useState<BookingKendaraan | null>(null);
  const [kendaraanRejectTarget, setKendaraanRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [kendaraanCancelTargetId, setKendaraanCancelTargetId] = useState<number | null>(null);
  const kendaraanRowMenu = useRowMenu(kendaraanItems);

  const [arsipFilters, setArsipFilters] = useState<ArsipFilterState>(EMPTY_ARSIP_FILTERS);
  const [arsipSearchInput, setArsipSearchInput] = useState("");
  const [arsipItems, setArsipItems] = useState<PermintaanArsip[]>([]);
  const [arsipTotal, setArsipTotal] = useState(0);
  const [arsipBusy, setArsipBusy] = useState(true);
  const [arsipError, setArsipError] = useState("");
  // Arsip tab's interactive-replica state - mirrors arsip/transaksi's own modals.
  const [arsipFormOpen, setArsipFormOpen] = useState(false);
  const [arsipDetail, setArsipDetail] = useState<{ item: PermintaanArsip; mode: "view" | "edit" } | null>(null);
  const [arsipStatusItemId, setArsipStatusItemId] = useState<number | null>(null);
  const [arsipChatItem, setArsipChatItem] = useState<PermintaanArsip | null>(null);
  const [arsipRejectTarget, setArsipRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [arsipKoreksiTarget, setArsipKoreksiTarget] = useState<PermintaanArsip | null>(null);
  const arsipRowMenu = useRowMenu(arsipItems);

  const [atkFilters, setAtkFilters] = useState<AtkFilterState>(EMPTY_ATK_FILTERS);
  const [atkSearchInput, setAtkSearchInput] = useState("");
  const [atkItems, setAtkItems] = useState<PermintaanAtk[]>([]);
  const [atkTotal, setAtkTotal] = useState(0);
  const [atkBusy, setAtkBusy] = useState(true);
  const [atkError, setAtkError] = useState("");
  // Office Supplies tab's interactive-replica state - mirrors office-supplies/transaksi's own
  // modals (its GA/KPU corrections are Detail modes, not a separate Koreksi modal).
  const [atkFormOpen, setAtkFormOpen] = useState(false);
  const [atkDetail, setAtkDetail] = useState<{ item: PermintaanAtk; mode: "view" | "edit" | "ga-edit" | "kpu-edit" } | null>(null);
  const [atkStatusItemId, setAtkStatusItemId] = useState<number | null>(null);
  const [atkChatItem, setAtkChatItem] = useState<PermintaanAtk | null>(null);
  const [atkRejectTarget, setAtkRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const atkRowMenu = useRowMenu(atkItems);

  const [saranaFilters, setSaranaFilters] = useState<SaranaFilterState>(EMPTY_SARANA_FILTERS);
  const [saranaSearchInput, setSaranaSearchInput] = useState("");
  const [saranaItems, setSaranaItems] = useState<PerbaikanSarana[]>([]);
  const [saranaTotal, setSaranaTotal] = useState(0);
  const [saranaBusy, setSaranaBusy] = useState(true);
  const [saranaError, setSaranaError] = useState("");
  // Maintenance tab's interactive-replica state - mirrors maintenance/transaksi's own modals.
  const [saranaFormOpen, setSaranaFormOpen] = useState(false);
  const [saranaDetail, setSaranaDetail] = useState<{ item: PerbaikanSarana; mode: "view" | "edit" } | null>(null);
  const [saranaStatusItemId, setSaranaStatusItemId] = useState<number | null>(null);
  const [saranaChatItem, setSaranaChatItem] = useState<PerbaikanSarana | null>(null);
  const [saranaRejectTarget, setSaranaRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [saranaKoreksiTarget, setSaranaKoreksiTarget] = useState<PerbaikanSarana | null>(null);
  const saranaRowMenu = useRowMenu(saranaItems);

  const invoiceRowMenu = useRowMenu(invoices ?? []);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const atkFilterWrapRef = useRef<HTMLDivElement>(null);
  const saranaFilterWrapRef = useRef<HTMLDivElement>(null);
  const [atkFilterOpen, setAtkFilterOpen] = useState(false);
  const [saranaFilterOpen, setSaranaFilterOpen] = useState(false);
  useExclusivePanel(atkFilterOpen, () => setAtkFilterOpen(false));
  useExclusivePanel(saranaFilterOpen, () => setSaranaFilterOpen(false));
  const tableReqIdRef = useRef(0);
  const invoiceReqIdRef = useRef(0);
  const bookingReqIdRef = useRef(0);
  const kendaraanReqIdRef = useRef(0);
  const arsipSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arsipReqIdRef = useRef(0);
  const atkSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atkReqIdRef = useRef(0);
  const saranaSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saranaReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);
  useClickOutside([atkFilterWrapRef], () => setAtkFilterOpen(false), atkFilterOpen);
  useClickOutside([saranaFilterWrapRef], () => setSaranaFilterOpen(false), saranaFilterOpen);

  useEffect(() => {
    if (!loading && me && me.role !== "SUPER_ADMIN") router.replace("/dashboard");
  }, [loading, me, router]);

  const loadTable = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++tableReqIdRef.current;
    if (!opts?.silent) {
      setTableBusy(true);
      setTableError("");
    }
    try {
      const result = await api.listPengiriman({
        page: filters.page,
        limit: filters.limit,
        tanggal: filters.tanggal,
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
      if (!opts?.silent) setTableError((err as Error).message);
    } finally {
      if (reqId === tableReqIdRef.current && !opts?.silent) setTableBusy(false);
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

  const loadBookings = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++bookingReqIdRef.current;
    if (!opts?.silent) {
      setBookingBusy(true);
      setBookingError("");
    }
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
      if (!opts?.silent) setBookingError((err as Error).message);
    } finally {
      if (reqId === bookingReqIdRef.current && !opts?.silent) setBookingBusy(false);
    }
  }, [bookingFilters]);

  const loadKendaraanBookings = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++kendaraanReqIdRef.current;
    if (!opts?.silent) {
      setKendaraanBusy(true);
      setKendaraanError("");
    }
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
      if (!opts?.silent) setKendaraanError((err as Error).message);
    } finally {
      if (reqId === kendaraanReqIdRef.current && !opts?.silent) setKendaraanBusy(false);
    }
  }, [kendaraanFilters]);

  const loadArsip = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++arsipReqIdRef.current;
    if (!opts?.silent) {
      setArsipBusy(true);
      setArsipError("");
    }
    try {
      const result = await api.listArsip({
        page: arsipFilters.page,
        limit: arsipFilters.limit,
        bulan: arsipFilters.bulan,
        status: arsipFilters.status,
        kategori: arsipFilters.kategori,
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
      if (!opts?.silent) setArsipError((err as Error).message);
    } finally {
      if (reqId === arsipReqIdRef.current && !opts?.silent) setArsipBusy(false);
    }
  }, [arsipFilters]);

  const loadAtk = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++atkReqIdRef.current;
    if (!opts?.silent) {
      setAtkBusy(true);
      setAtkError("");
    }
    try {
      const result = await api.listAtk({
        page: atkFilters.page,
        limit: atkFilters.limit,
        bulan: atkFilters.bulan,
        status: atkFilters.status,
        divisi: atkFilters.divisi,
        departemen: atkFilters.departemen,
        direktorat: atkFilters.direktorat,
        search: atkFilters.search,
        sumberPembelian: atkFilters.sumberPembelian,
      });
      if (reqId !== atkReqIdRef.current) return;
      const atkItemsResult = result?.items ?? [];
      const atkTotalResult = result?.total ?? 0;
      if (atkItemsResult.length === 0 && atkTotalResult > 0 && atkFilters.page > 1) {
        setAtkFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setAtkItems(atkItemsResult);
      setAtkTotal(atkTotalResult);
    } catch (err) {
      if (reqId !== atkReqIdRef.current) return;
      if (!opts?.silent) setAtkError((err as Error).message);
    } finally {
      if (reqId === atkReqIdRef.current && !opts?.silent) setAtkBusy(false);
    }
  }, [atkFilters]);

  const loadSarana = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++saranaReqIdRef.current;
    if (!opts?.silent) {
      setSaranaBusy(true);
      setSaranaError("");
    }
    try {
      const result = await api.listSarana({
        page: saranaFilters.page,
        limit: saranaFilters.limit,
        bulan: saranaFilters.bulan,
        status: saranaFilters.status,
        kategori: saranaFilters.kategori,
        divisi: saranaFilters.divisi,
        departemen: saranaFilters.departemen,
        direktorat: saranaFilters.direktorat,
        search: saranaFilters.search,
      });
      if (reqId !== saranaReqIdRef.current) return;
      const saranaItemsResult = result?.items ?? [];
      const saranaTotalResult = result?.total ?? 0;
      if (saranaItemsResult.length === 0 && saranaTotalResult > 0 && saranaFilters.page > 1) {
        setSaranaFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setSaranaItems(saranaItemsResult);
      setSaranaTotal(saranaTotalResult);
    } catch (err) {
      if (reqId !== saranaReqIdRef.current) return;
      if (!opts?.silent) setSaranaError((err as Error).message);
    } finally {
      if (reqId === saranaReqIdRef.current && !opts?.silent) setSaranaBusy(false);
    }
  }, [saranaFilters]);

  useEffect(() => {
    if (activeTab === "ekspedisi") {
      loadTable();
    }
  }, [activeTab, loadTable]);

  useEffect(() => {
    if (activeTab === "ekspedisi" && me?.role === "SUPER_ADMIN") {
      loadInvoices();
    }
  }, [activeTab, me, loadInvoices]);

  useEffect(() => {
    if (activeTab === "booking-ruang") {
      loadBookings();
    }
  }, [activeTab, loadBookings]);

  useEffect(() => {
    if (activeTab === "booking-kendaraan") {
      loadKendaraanBookings();
    }
  }, [activeTab, loadKendaraanBookings]);

  useEffect(() => {
    if (activeTab === "arsip") {
      loadArsip();
    }
  }, [activeTab, loadArsip]);

  useEffect(() => {
    if (activeTab === "atk") {
      loadAtk();
    }
  }, [activeTab, loadAtk]);

  useEffect(() => {
    if (activeTab === "sarana") {
      loadSarana();
    }
  }, [activeTab, loadSarana]);

  useEffect(() => {
    if (activeTab === "booking-ruang" && rooms.length === 0) {
      api.listRooms().then(setRooms).catch(() => setRooms([]));
    }
  }, [activeTab, rooms.length]);

  useEffect(() => {
    if (activeTab === "booking-kendaraan" && vehicles.length === 0) {
      api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
    }
  }, [activeTab, vehicles.length]);

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

  // --- Hapus Semua per section ---------------------------------------------------------------
  // The button deletes exactly what its own table is showing, across every page, which means the
  // dialog has to say which filters are narrowing that set - "delete this month" and "delete
  // everything" are one forgotten dropdown apart.

  function activeFilters(entries: [string, string | null | undefined][]): string[] {
    return entries.filter(([, v]) => !!v).map(([label, v]) => `${label}: ${v}`);
  }

  // "REJECTED"/"ON_APPROVAL" are the synthetic dropdown values covering every reject-stage or
  // on-approval-stage status, so neither is a key in either status map.
  function statusText(status: string): string {
    if (!status) return "";
    if (status === "REJECTED") return "Rejected";
    if (status === "ON_APPROVAL") return "On-Approval";
    return STATUS_LABEL[status as Status] || BOOKING_STATUS_LABEL[status as BookingStatus] || status;
  }

  function bulanText(bulan: string): string {
    return bulan ? invoiceBulanLabel(bulan) : "";
  }

  function ekspedisiExportParams() {
    return {
      tanggal: filters.tanggal,
      bulan: filters.bulan,
      status: filters.status,
      divisi: filters.divisi,
      departemen: filters.departemen,
      direktorat: filters.direktorat,
      nomor_transmittal: filters.search,
    };
  }

  function arsipExportParams() {
    return {
      bulan: arsipFilters.bulan,
      status: arsipFilters.status,
      kategori: arsipFilters.kategori,
      divisi: arsipFilters.divisi,
      departemen: arsipFilters.departemen,
      search: arsipFilters.search,
    };
  }

  function bookingExportParams() {
    return {
      bulan: undefined,
      tanggal: bookingFilters.tanggal,
      status: bookingFilters.status,
      divisi: bookingFilters.divisi,
      departemen: bookingFilters.departemen,
      nama_ruang: bookingFilters.namaRuang,
      search: undefined,
    };
  }

  function kendaraanExportParams() {
    return {
      bulan: undefined,
      tanggal: kendaraanFilters.tanggal,
      status: kendaraanFilters.status,
      divisi: kendaraanFilters.divisi,
      departemen: kendaraanFilters.departemen,
      nama_kendaraan: kendaraanFilters.namaKendaraan,
      search: undefined,
    };
  }

  function atkExportParams() {
    return {
      bulan: atkFilters.bulan,
      tanggal: undefined,
      status: atkFilters.status,
      divisi: atkFilters.divisi,
      departemen: atkFilters.departemen,
      direktorat: atkFilters.direktorat,
      search: atkFilters.search,
      sumberPembelian: atkFilters.sumberPembelian,
    };
  }

  function saranaExportParams() {
    return {
      bulan: saranaFilters.bulan,
      tanggal: undefined,
      status: saranaFilters.status,
      kategori: saranaFilters.kategori,
      divisi: saranaFilters.divisi,
      departemen: saranaFilters.departemen,
      direktorat: saranaFilters.direktorat,
      search: saranaFilters.search,
    };
  }

  // Wraps the per-section call so every one of them reports the real number the server deleted
  // (not the count the table happened to be showing) and reloads its own table afterwards.
  function askBulkDelete(
    section: string,
    noun: string,
    count: number,
    filters: string[],
    run: () => Promise<{ deleted: number }>,
    reload: () => void
  ) {
    setBulkTarget({
      section,
      noun,
      count,
      filters,
      onConfirm: async () => {
        try {
          const { deleted } = await run();
          showToast(`${deleted} ${noun} berhasil dihapus permanen`);
          reload();
        } catch (err) {
          showToast((err as Error).message, "error");
          throw err;
        }
      },
    });
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
    confirm("Yakin ingin menghapus Invoice ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
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
    confirm("Yakin ingin menghapus Pemindahan Arsip ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.superAdminDeleteArsip(item.id);
        showToast("Data berhasil dihapus permanen");
        loadArsip();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  function updateAtkFilter(patch: Partial<AtkFilterState>) {
    setAtkFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleAtkSearchChange(value: string) {
    setAtkSearchInput(value);
    if (atkSearchDebounce.current) clearTimeout(atkSearchDebounce.current);
    atkSearchDebounce.current = setTimeout(() => {
      updateAtkFilter({ search: value.trim() });
    }, 350);
  }

  function resetAtkFilters() {
    setAtkSearchInput("");
    setAtkFilters(EMPTY_ATK_FILTERS);
  }

  function goToAtkPage(page: number) {
    if (page < 1) return;
    setAtkFilters((f) => ({ ...f, page }));
  }

  function handleDeleteAtk(item: PermintaanAtk) {
    confirm("Yakin ingin menghapus Pesanan Kebutuhan Kantor ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.superAdminDeleteAtk(item.id);
        showToast("Data berhasil dihapus permanen");
        loadAtk();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  function updateSaranaFilter(patch: Partial<SaranaFilterState>) {
    setSaranaFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleSaranaSearchChange(value: string) {
    setSaranaSearchInput(value);
    if (saranaSearchDebounce.current) clearTimeout(saranaSearchDebounce.current);
    saranaSearchDebounce.current = setTimeout(() => {
      updateSaranaFilter({ search: value.trim() });
    }, 350);
  }

  function resetSaranaFilters() {
    setSaranaSearchInput("");
    setSaranaFilters(EMPTY_SARANA_FILTERS);
  }

  function goToSaranaPage(page: number) {
    if (page < 1) return;
    setSaranaFilters((f) => ({ ...f, page }));
  }

  function handleDeleteSarana(item: PerbaikanSarana) {
    confirm("Yakin ingin menghapus Pengajuan Perbaikan ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.superAdminDeleteSarana(item.id);
        showToast("Data berhasil dihapus permanen");
        loadSarana();
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

  const atkTotalPages = Math.max(1, Math.ceil(atkTotal / atkFilters.limit));
  const atkPageStart = Math.min(Math.max(1, atkFilters.page), atkTotalPages);
  const atkPageEnd = Math.min(atkTotalPages, atkPageStart + 1);
  const atkPageButtons: number[] = [];
  for (let p = atkPageStart; p <= atkPageEnd; p++) atkPageButtons.push(p);

  const atkSelectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === atkFilters.direktorat) || null;
  const atkDivisiOptions = atkSelectedDirektoratNode
    ? atkSelectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const atkSelectedDivisiNode = atkFilters.divisi
    ? (atkSelectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === atkFilters.divisi
      )
    : null;
  const atkDepartemenOptions = atkSelectedDivisiNode
    ? atkSelectedDivisiNode.departemen
    : atkSelectedDirektoratNode
      ? atkSelectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  const saranaTotalPages = Math.max(1, Math.ceil(saranaTotal / saranaFilters.limit));
  const saranaPageStart = Math.min(Math.max(1, saranaFilters.page), saranaTotalPages);
  const saranaPageEnd = Math.min(saranaTotalPages, saranaPageStart + 1);
  const saranaPageButtons: number[] = [];
  for (let p = saranaPageStart; p <= saranaPageEnd; p++) saranaPageButtons.push(p);

  const saranaSelectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === saranaFilters.direktorat) || null;
  const saranaDivisiOptions = saranaSelectedDirektoratNode
    ? saranaSelectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const saranaSelectedDivisiNode = saranaFilters.divisi
    ? (saranaSelectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === saranaFilters.divisi
      )
    : null;
  const saranaDepartemenOptions = saranaSelectedDivisiNode
    ? saranaSelectedDivisiNode.departemen
    : saranaSelectedDirektoratNode
      ? saranaSelectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  const KATEGORI_OPTIONS = Object.keys(KATEGORI_KERUSAKAN_LABEL) as KategoriKerusakan[];

  return (
    <>
      <div className="card-header dashboard-welcome-header" style={{ marginBottom: 22 }}>
        <WelcomeGreeting me={me} />
      </div>

      <div className="superadmin-tabs-nav">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`superadmin-tab-btn ${activeTab === tab.key ? "superadmin-tab-btn-active" : ""}`}
            onClick={() => selectTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <DashboardContent me={me} />

          <div style={{ marginTop: 28 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", fontWeight: 700 }}>
              Activity Log (Riwayat Aktivitas Lintas Modul)
            </h3>
            <RiwayatAktivitasCard />
          </div>

          <div style={{ marginTop: 28 }}>
            <NotificationSoundSettingsCard />
          </div>
        </>
      )}

      {activeTab === "ekspedisi" && (
        <>
          <div className="superadmin-subtabs">
            <button
              type="button"
              className={`superadmin-subtab-btn ${ekspedisiSubtab === "pengiriman" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setEkspedisiSubtab("pengiriman")}
            >
              Transaksi Pengiriman ({total})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${ekspedisiSubtab === "invoice" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setEkspedisiSubtab("invoice")}
            >
              Vendor Invoices ({invoiceTotal})
            </button>
          </div>

          {ekspedisiSubtab === "pengiriman" && (
            <div className="card">
        <div className="toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-search">Cari Transaksi</label>
            <input type="text" id="filter-search" placeholder="No Transmittal" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-bulan">Filter Periode</label>
            <PeriodFilterPicker id="filter-bulan" bulan={filters.bulan} tanggal={filters.tanggal} onChangeBulan={(v) => updateFilter({ bulan: v, tanggal: "" })} onChangeTanggal={(v) => updateFilter({ tanggal: v, bulan: "" })} />
          </div>
          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button type="button" className="btn filter-dropdown-toggle" style={AUTO_WIDTH_STYLE} onClick={() => setFilterOpen((v) => !v)}>
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
                    onChange={(v) => updateFilter({ status: v as Status | "REJECTED" | "ON_APPROVAL" | "" })}
                    options={["DRAFT", "ON_APPROVAL", "REJECTED", "COMPLETED"]}
                    getLabel={(v) => ({
                      DRAFT: "Draft",
                      ON_APPROVAL: "On-Approval",
                      REJECTED: "Rejected",
                      COMPLETED: "Approved",
                    } as Record<string, string>)[v] || v}
                    clearLabel="Semua Status"
                    placeholder="Semua Status"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetFilters}>Hapus Filter</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.pdfUrl(ekspedisiExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.exportUrl(ekspedisiExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            <button
              className="btn btn-bulk-delete"
              disabled={tableBusy || total === 0}
              onClick={() => askBulkDelete("Expedition", "Transaksi", total, activeFilters([["Cari", filters.search], ["Tanggal", filters.tanggal], ["Bulan", bulanText(filters.bulan)], ["Status", statusText(filters.status)], ["Direktorat", filters.direktorat], ["Divisi", filters.divisi], ["Departemen", filters.departemen]]), () => api.superAdminBulkDeletePengiriman({ ...filters, nomorTransmittal: filters.search }), loadTable)}
            >
              Hapus Semua
            </button>
            <button className="btn btn-primary" style={AUTO_WIDTH_STYLE} onClick={() => setEkspedisiFormOpen(true)}>+ Input Data Barang</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Transmittal</th><th>No Resi</th><th>Diajukan</th><th>Tanggal</th><th>Tujuan</th><th>Jumlah Barang</th><th>Divisi</th><th>Departemen</th>
                <th>Nama Pengirim</th><th>No. Telepon Pengirim</th><th>Alamat Pengirim</th><th>Nama Penerima</th><th>No. Telepon Penerima</th><th>Alamat Penerima</th>
                <th>Kode Program</th><th>Asuransi</th><th>Pengemasan Tambahan</th><th>Catatan</th>
                <th>Berat Barang (Kg)</th><th>Harga Ongkos Kirim</th><th>Total</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={23} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={23} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={23} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                items.map((item, index) => {
                  const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorTransmittal}</td>
                      <td>{item.noResi || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td title={item.tujuanPenerimaan}>{truncateText(item.tujuanPenerimaan, 15)}</td>
                      <td>{item.jumlahItem}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.namaPengirim}>{truncateText(item.namaPengirim, 18)}</td>
                      <td>{item.noTeleponPengirim}</td>
                      <td title={item.alamatPengirim}>{truncateText(item.alamatPengirim, 18)}</td>
                      <td title={item.namaPenerima}>{truncateText(item.namaPenerima, 18)}</td>
                      <td>{item.noTeleponPenerima}</td>
                      <td title={item.alamatPenerima}>{truncateText(item.alamatPenerima, 18)}</td>
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
                            onClick={() => setEkspedisiChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => ekspedisiRowMenu.toggle(e, item.id, 180)}>
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
            <div className="field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="filter-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-limit"
                value={String(filters.limit)}
                onChange={(v) => updateFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} Transaksi`}
                placeholder={`${filters.limit} Transaksi`}
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
          )}

          <RowMenuDropdown
            position={ekspedisiRowMenu.position}
            canEditDelete={
              !!ekspedisiRowMenu.menuItem &&
              (isEditableByOrigin(ekspedisiRowMenu.menuItem, me) || canGaKoreksiPengiriman(ekspedisiRowMenu.menuItem, me) || canKoreksiHargaPengiriman(ekspedisiRowMenu.menuItem, me))
            }
            canDelete={!!ekspedisiRowMenu.menuItem && isEditableByOrigin(ekspedisiRowMenu.menuItem, me)}
            onDetail={() => {
              const item = ekspedisiRowMenu.menuItem;
              ekspedisiRowMenu.close();
              if (item) setEkspedisiDetail({ item, mode: "view" });
            }}
            onUpdates={() => {
              const item = ekspedisiRowMenu.menuItem;
              ekspedisiRowMenu.close();
              if (!item) return;
              if (isEditableByOrigin(item, me)) setEkspedisiDetail({ item, mode: "edit" });
              else if (canGaKoreksiPengiriman(item, me)) setEkspedisiKoreksiTarget(item);
              else if (canKoreksiHargaPengiriman(item, me)) setEkspedisiDetail({ item, mode: "kpu-edit" });
            }}
            onStatus={() => {
              const item = ekspedisiRowMenu.menuItem;
              ekspedisiRowMenu.close();
              if (item) setEkspedisiStatusItemId(item.id);
            }}
            onDelete={() => {
              const item = ekspedisiRowMenu.menuItem;
              ekspedisiRowMenu.close();
              if (item) handleDelete(item);
            }}
            pdfUrl={ekspedisiRowMenu.menuItem && isPengirimanPdfAvailable(ekspedisiRowMenu.menuItem) ? api.pengirimanPdfUrl(ekspedisiRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = ekspedisiRowMenu.menuItem;
              ekspedisiRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.pengirimanPdfUrl(item.id), `Bukti-Pengiriman-${item.nomorTransmittal || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <ChatModal
            open={!!ekspedisiChatItem}
            itemId={ekspedisiChatItem?.id ?? null}
            itemLabel={ekspedisiChatItem ? `${ekspedisiChatItem.tujuanPenerimaan} - ${ekspedisiChatItem.nomorTransmittal}` : ""}
            departemen={ekspedisiChatItem?.departemen ?? null}
            createdByRole={ekspedisiChatItem?.createdByRole ?? null}
            me={me}
            onClose={() => setEkspedisiChatItem(null)}
            onRead={() => loadTable({ silent: true })}
          />

          <PengirimanFormModal open={ekspedisiFormOpen} me={me} onClose={() => setEkspedisiFormOpen(false)} onCreated={loadTable} />

          <PengirimanDetailModal
            open={!!ekspedisiDetail}
            mode={ekspedisiDetail?.mode || "view"}
            item={ekspedisiDetail?.item || null}
            me={me}
            onClose={() => setEkspedisiDetail(null)}
            onSaved={loadTable}
            onRequestReject={(id, type, originLabel, createdByRole) => setEkspedisiRejectTarget({ id, type, originLabel, createdByRole })}
          />

          <RejectModal
            open={!!ekspedisiRejectTarget}
            targetId={ekspedisiRejectTarget?.id ?? null}
            targetType={ekspedisiRejectTarget?.type ?? null}
            originLabel={ekspedisiRejectTarget?.originLabel ?? ""}
            createdByRole={ekspedisiRejectTarget?.createdByRole ?? null}
            onClose={() => setEkspedisiRejectTarget(null)}
            onDone={() => {
              setEkspedisiRejectTarget(null);
              loadTable();
            }}
          />

          <PengirimanKoreksiModal
            open={!!ekspedisiKoreksiTarget}
            item={ekspedisiKoreksiTarget}
            onClose={() => setEkspedisiKoreksiTarget(null)}
            onSaved={loadTable}
          />

          <StatusHistoryModal open={ekspedisiStatusItemId != null} itemId={ekspedisiStatusItemId} onClose={() => setEkspedisiStatusItemId(null)} />

          {ekspedisiSubtab === "invoice" && (
      <div className="card">
        <div className="card-header">
          <h3>History Invoice Pembiayaan</h3>
        </div>

        <div className="invoice-toolbar-slim">
          <div className="field invoice-filter-field" style={FIELD_NO_MARGIN_STYLE}>
            <label htmlFor="invoice-filter-bulan">Filter Bulan</label>
            <MonthFilterPicker
              id="invoice-filter-bulan"
              value={invoiceFilterBulan}
              onChange={(v) => { setInvoiceFilterBulan(v); setInvoicePage(1); }}
            />
          </div>
          <div className="field" style={FIELD_NO_MARGIN_STYLE}>
            <span className="field-label-spacer">Semua Invoice</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={AUTO_WIDTH_STYLE}
              onClick={() => { setInvoiceFilterBulan(""); setInvoicePage(1); }}
            >
              Semua Invoice
            </button>
          </div>
          <div className="field" style={FIELD_NO_MARGIN_STYLE}>
            <span className="field-label-spacer">Hapus Semua</span>
            <button
              type="button"
              className="btn btn-bulk-delete"
              style={{ alignSelf: "auto" }}
              disabled={invoices == null || invoiceTotal === 0}
              onClick={() => askBulkDelete(
                "Invoice",
                "Invoice",
                invoiceTotal,
                activeFilters([["Bulan", bulanText(invoiceFilterBulan)]]),
                () => api.superAdminBulkDeleteInvoice({ bulan: invoiceFilterBulan }),
                loadInvoices
              )}
            >
              Hapus Semua
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
                    <div className="invoice-row-title">Invoice {invoiceBulanLabel(inv.bulan)} - {inv.nama}</div>
                    <div className="invoice-row-meta">Diunggah: {formatDateTime(inv.uploadedAt)}</div>
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
            <div className="field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="invoice-limit">Tampilkan</label>
              <SearchableSelect
                id="invoice-limit"
                value={String(invoiceLimit)}
                onChange={(v) => { setInvoiceLimit(Number(v)); setInvoicePage(1); }}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} Invoice`}
                placeholder={`${invoiceLimit} Invoice`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {invoiceTotal} Invoice · Halaman {invoicePage} dari {invoiceTotalPages}</span>
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
          )}
        </>
      )}

      {activeTab === "booking-ruang" && (
        <>
          <div className="superadmin-subtabs">
            <button
              type="button"
              className={`superadmin-subtab-btn ${bookingRuangSubtab === "transaksi" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setBookingRuangSubtab("transaksi")}
            >
              Transaksi Booking ({bookingTotal})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${bookingRuangSubtab === "roster" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setBookingRuangSubtab("roster")}
            >
              Kelola Ruang Meeting
            </button>
          </div>

          {bookingRuangSubtab === "roster" && <SuperAdminMeetingRoomTab />}

          {bookingRuangSubtab === "transaksi" && (
        <>
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
              onChange={(v) => updateBookingFilter({ status: v as BookingStatus | "REJECTED" | "ON_APPROVAL" | "" })}
              options={["DRAFT", "ON_APPROVAL", "REJECTED", "APPROVED_GA_APPROVAL"]}
              getLabel={(v) => ({
                DRAFT: "Draft",
                ON_APPROVAL: "On-Approval",
                REJECTED: "Rejected",
                APPROVED_GA_APPROVAL: "Approved",
              } as Record<string, string>)[v] || v}
              clearLabel="Semua Status"
              placeholder="Semua Status"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-ruang">Ruangan</label>
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
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetBookingFilters}>Hapus Filter</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.bookingExportPdfUrl(bookingExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.bookingExportUrl(bookingExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            <button
              className="btn btn-bulk-delete"
              disabled={bookingBusy || bookingTotal === 0}
              onClick={() => askBulkDelete("Room Booking", "booking", bookingTotal, activeFilters([["Tanggal", bookingFilters.tanggal], ["Status", statusText(bookingFilters.status)], ["Ruang", bookingFilters.namaRuang], ["Divisi", bookingFilters.divisi], ["Departemen", bookingFilters.departemen]]), () => api.superAdminBulkDeleteBooking(bookingFilters), loadBookings)}
            >
              Hapus Semua
            </button>
            <button className="btn btn-primary" style={AUTO_WIDTH_STYLE} onClick={() => setBookingFormOpen(true)}>+ Booking Ruang Meeting</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pesanan</th><th>Diajukan</th><th>Tanggal</th><th>Jam</th><th>Nama Kegiatan</th><th>Divisi</th><th>Departemen</th><th>Nama PIC</th><th>No. Telepon PIC</th><th>Ruangan</th>
                <th>Tipe</th><th>Jumlah Peserta</th><th>Catatan</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookingBusy ? (
                <tr><td colSpan={15} className="table-empty">Memuat data...</td></tr>
              ) : bookingError ? (
                <tr><td colSpan={15} className="table-empty">{bookingError}</td></tr>
              ) : bookingItems.length === 0 ? (
                <tr><td colSpan={15} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                bookingItems.map((item, index) => {
                  const rowNumber = (bookingFilters.page - 1) * bookingFilters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPemesanan || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)}</td>
                      <td title={item.namaKegiatan}>{truncateText(item.namaKegiatan, 25)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.pic || ""}>{truncateText(item.pic, 15)}</td>
                      <td>{item.noTeleponPic || "-"}</td>
                      <td title={bookingRoomsLabel(item)}>{truncateText(bookingRoomsLabel(item), 20)}</td>
                      <td>{TIPE_BOOKING_LABELS[item.tipe]}</td>
                      <td>{item.jumlahPeserta}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} cancelledByRole={item.cancelledByRole} isRoom />
                            {item.hasConflict && <span className="badge badge-rejected">Bentrok</span>}
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setBookingChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => bookingRowMenu.toggle(e, item.id, 180)}>
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
            <div className="field" style={FIELD_NO_MARGIN_STYLE}>
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

          <RowMenuDropdown
            position={bookingRowMenu.position}
            canEditDelete={
              !!bookingRowMenu.menuItem &&
              (isBookingEditableByOrigin(bookingRowMenu.menuItem, me) || canGaRescheduleBooking(bookingRowMenu.menuItem, me))
            }
            canDelete={!!bookingRowMenu.menuItem && isBookingDeletableByOrigin(bookingRowMenu.menuItem, me)}
            canCancel={!!bookingRowMenu.menuItem && isBookingCancellableByOrigin(bookingRowMenu.menuItem, me)}
            onCancel={() => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (item) setBookingCancelTargetId(item.id);
            }}
            onDetail={() => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (item) setBookingDetail({ item, mode: "view" });
            }}
            onUpdates={() => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (!item) return;
              if (isBookingEditableByOrigin(item, me)) setBookingDetail({ item, mode: "edit" });
              else if (canGaRescheduleBooking(item, me)) setBookingRescheduleTarget(item);
            }}
            onDuplicate={() => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (!item) return;
              setBookingFormInitial(buildRoomBookingDuplicateInitial(item));
              setBookingFormOpen(true);
            }}
            onStatus={() => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (item) setBookingStatusItemId(item.id);
            }}
            onDelete={() => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (item) handleDeleteBooking(item);
            }}
            pdfUrl={bookingRowMenu.menuItem && isBookingPdfAvailable(bookingRowMenu.menuItem) ? api.bookingPdfUrl(bookingRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.bookingPdfUrl(item.id), `Bukti-Booking-${item.nomorPemesanan || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
            icsUrl={bookingRowMenu.menuItem && isBookingPdfAvailable(bookingRowMenu.menuItem) ? api.bookingIcsUrl(bookingRowMenu.menuItem.id) : undefined}
            onIcsClick={async () => {
              const item = bookingRowMenu.menuItem;
              bookingRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.bookingIcsUrl(item.id), `Booking-${item.nomorPemesanan || item.id}.ics`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <RoomBookingChatModal
            open={!!bookingChatItem}
            itemId={bookingChatItem?.id ?? null}
            itemLabel={bookingChatItem ? `${bookingChatItem.namaKegiatan} - ${bookingRoomsLabel(bookingChatItem)} - ${bookingChatItem.nomorPemesanan || "-"}` : ""}
            departemen={bookingChatItem?.departemen ?? null}
            me={me}
            onClose={() => setBookingChatItem(null)}
            onRead={() => loadBookings({ silent: true })}
          />

          <RoomBookingFormModal
            open={bookingFormOpen}
            me={me}
            initial={bookingFormInitial}
            onClose={() => { setBookingFormOpen(false); setBookingFormInitial(undefined); }}
            onCreated={loadBookings}
          />

          <RoomBookingDetailModal
            open={!!bookingDetail}
            mode={bookingDetail?.mode || "view"}
            item={bookingDetail?.item || null}
            me={me}
            onClose={() => setBookingDetail(null)}
            onSaved={loadBookings}
            onRequestReject={(id, type, originLabel) => setBookingRejectTarget({ id, type, originLabel })}
          />

          <CancelBookingModal
            open={bookingCancelTargetId != null}
            targetId={bookingCancelTargetId}
            targetType="room"
            onClose={() => setBookingCancelTargetId(null)}
            onDone={() => {
              setBookingCancelTargetId(null);
              loadBookings();
            }}
          />

          <RoomBookingRescheduleModal
            open={!!bookingRescheduleTarget}
            item={bookingRescheduleTarget}
            onClose={() => setBookingRescheduleTarget(null)}
            onSaved={loadBookings}
          />

          <RejectModal
            open={!!bookingRejectTarget}
            targetId={bookingRejectTarget?.id ?? null}
            targetType={bookingRejectTarget?.type ?? null}
            originLabel={bookingRejectTarget?.originLabel ?? ""}
            onClose={() => setBookingRejectTarget(null)}
            onDone={() => {
              setBookingRejectTarget(null);
              loadBookings();
            }}
          />

          <BookingStatusHistoryModal open={bookingStatusItemId != null} itemId={bookingStatusItemId} onClose={() => setBookingStatusItemId(null)} />
        </>
          )}
        </>
      )}

      {activeTab === "booking-kendaraan" && (
        <>
          <div className="superadmin-subtabs">
            <button
              type="button"
              className={`superadmin-subtab-btn ${kendaraanSubtab === "transaksi" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setKendaraanSubtab("transaksi")}
            >
              Transaksi Booking ({kendaraanTotal})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${kendaraanSubtab === "roster" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setKendaraanSubtab("roster")}
            >
              Kelola Kendaraan
            </button>
          </div>

          {kendaraanSubtab === "roster" && <SuperAdminVehicleTab />}

          {kendaraanSubtab === "transaksi" && (
        <>
      <div className="card">
        <div className="card-header">
          <h3>Booking Kendaraan</h3>
        </div>
        <div className="toolbar">
          <div className="field">
            <label htmlFor="filter-kendaraan-tanggal">Filter Tanggal</label>
            <DateFilterPicker id="filter-kendaraan-tanggal" value={kendaraanFilters.tanggal} onChange={(v) => updateKendaraanFilter({ tanggal: v })} />
          </div>
          <div className="field">
            <label htmlFor="filter-kendaraan-status">Status</label>
            <SearchableSelect
              id="filter-kendaraan-status"
              value={kendaraanFilters.status}
              onChange={(v) => updateKendaraanFilter({ status: v as BookingStatus | "REJECTED" | "ON_APPROVAL" | "" })}
              options={["DRAFT", "ON_APPROVAL", "REJECTED", "APPROVED_GA_APPROVAL"]}
              getLabel={(v) => ({
                DRAFT: "Draft",
                ON_APPROVAL: "On-Approval",
                REJECTED: "Rejected",
                APPROVED_GA_APPROVAL: "Approved",
              } as Record<string, string>)[v] || v}
              clearLabel="Semua Status"
              placeholder="Semua Status"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-kendaraan-nama">Kendaraan</label>
            <SearchableSelect
              id="filter-kendaraan-nama"
              value={kendaraanFilters.namaKendaraan}
              onChange={(v) => updateKendaraanFilter({ namaKendaraan: v })}
              options={vehicles.map((v) => v.nama)}
              clearLabel="Semua Kendaraan"
              placeholder="Semua Kendaraan"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-kendaraan-divisi">Divisi</label>
            <SearchableSelect
              id="filter-kendaraan-divisi"
              value={kendaraanFilters.divisi}
              onChange={(v) => updateKendaraanFilter({ divisi: v, departemen: "" })}
              options={kendaraanDivisiOptions}
              clearLabel="Semua Divisi"
              placeholder="Semua Divisi"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-kendaraan-departemen">Departemen</label>
            <SearchableSelect
              id="filter-kendaraan-departemen"
              value={kendaraanFilters.departemen}
              onChange={(v) => updateKendaraanFilter({ departemen: v })}
              options={kendaraanDepartemenOptions}
              clearLabel="Semua Departemen"
              placeholder="Semua Departemen"
            />
          </div>
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetKendaraanFilters}>Hapus Filter</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.kendaraanExportPdfUrl(kendaraanExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.kendaraanExportUrl(kendaraanExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            <button
              className="btn btn-bulk-delete"
              disabled={kendaraanBusy || kendaraanTotal === 0}
              onClick={() => askBulkDelete("Vehicle Booking", "booking", kendaraanTotal, activeFilters([["Tanggal", kendaraanFilters.tanggal], ["Status", statusText(kendaraanFilters.status)], ["Kendaraan", kendaraanFilters.namaKendaraan], ["Divisi", kendaraanFilters.divisi], ["Departemen", kendaraanFilters.departemen]]), () => api.superAdminBulkDeleteKendaraanBooking(kendaraanFilters), loadKendaraanBookings)}
            >
              Hapus Semua
            </button>
            <button className="btn btn-primary" style={AUTO_WIDTH_STYLE} onClick={() => setKendaraanFormOpen(true)}>+ Booking Kendaraan</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pesanan</th><th>Diajukan</th><th>Tanggal</th><th>Jam</th><th>Nama Kegiatan</th><th>Divisi</th><th>Departemen</th><th>Nama PIC</th><th>No. Telepon PIC</th><th>Kendaraan</th>
                <th>Nama Pengemudi</th><th>Jumlah Penumpang</th><th>Catatan</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {kendaraanBusy ? (
                <tr><td colSpan={15} className="table-empty">Memuat data...</td></tr>
              ) : kendaraanError ? (
                <tr><td colSpan={15} className="table-empty">{kendaraanError}</td></tr>
              ) : kendaraanItems.length === 0 ? (
                <tr><td colSpan={15} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                kendaraanItems.map((item, index) => {
                  const rowNumber = (kendaraanFilters.page - 1) * kendaraanFilters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPemesanan || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{formatTimeRange(item.jamMulai, item.jamSelesai, item.isWholeDay)}</td>
                      <td title={item.keperluan}>{truncateText(item.keperluan, 25)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.pic || ""}>{truncateText(item.pic, 15)}</td>
                      <td>{item.noTeleponPic || "-"}</td>
                      <td title={item.namaKendaraan}>{truncateText(item.namaKendaraan, 20)}</td>
                      <td title={item.supir || ""}>{truncateText(item.supir, 18)}</td>
                      <td>{item.jumlahPenumpang}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} cancelledByRole={item.cancelledByRole} isKendaraan />
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setKendaraanChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => kendaraanRowMenu.toggle(e, item.id, 180)}>
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
            <div className="field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="filter-kendaraan-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-kendaraan-limit"
                value={String(kendaraanFilters.limit)}
                onChange={(v) => updateKendaraanFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} booking`}
                placeholder={`${kendaraanFilters.limit} booking`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {kendaraanTotal} booking · Halaman {kendaraanFilters.page} dari {kendaraanTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={kendaraanFilters.page <= 1} onClick={() => goToKendaraanPage(kendaraanFilters.page - 1)}>‹</button>
              {kendaraanPageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === kendaraanFilters.page ? "active" : ""}`} onClick={() => goToKendaraanPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={kendaraanFilters.page >= kendaraanTotalPages} onClick={() => goToKendaraanPage(kendaraanFilters.page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

          <RowMenuDropdown
            position={kendaraanRowMenu.position}
            canEditDelete={
              !!kendaraanRowMenu.menuItem &&
              (isKendaraanEditableByOrigin(kendaraanRowMenu.menuItem, me) || canGaRescheduleKendaraan(kendaraanRowMenu.menuItem, me))
            }
            canDelete={!!kendaraanRowMenu.menuItem && isKendaraanDeletableByOrigin(kendaraanRowMenu.menuItem, me)}
            canCancel={!!kendaraanRowMenu.menuItem && isKendaraanCancellableByOrigin(kendaraanRowMenu.menuItem, me)}
            onCancel={() => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (item) setKendaraanCancelTargetId(item.id);
            }}
            onDetail={() => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (item) setKendaraanDetail({ item, mode: "view" });
            }}
            onUpdates={() => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (!item) return;
              if (isKendaraanEditableByOrigin(item, me)) setKendaraanDetail({ item, mode: "edit" });
              else if (canGaRescheduleKendaraan(item, me)) setKendaraanRescheduleTarget(item);
            }}
            onDuplicate={() => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (!item) return;
              setKendaraanFormInitial(buildVehicleBookingDuplicateInitial(item));
              setKendaraanFormOpen(true);
            }}
            onStatus={() => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (item) setKendaraanStatusItemId(item.id);
            }}
            onDelete={() => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (item) handleDeleteKendaraanBooking(item);
            }}
            pdfUrl={kendaraanRowMenu.menuItem && isKendaraanPdfAvailable(kendaraanRowMenu.menuItem) ? api.kendaraanPdfUrl(kendaraanRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.kendaraanPdfUrl(item.id), `Bukti-Booking-Kendaraan-${item.nomorPemesanan || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
            icsUrl={kendaraanRowMenu.menuItem && isKendaraanPdfAvailable(kendaraanRowMenu.menuItem) ? api.kendaraanIcsUrl(kendaraanRowMenu.menuItem.id) : undefined}
            onIcsClick={async () => {
              const item = kendaraanRowMenu.menuItem;
              kendaraanRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.kendaraanIcsUrl(item.id), `Booking-Kendaraan-${item.nomorPemesanan || item.id}.ics`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <VehicleBookingChatModal
            open={!!kendaraanChatItem}
            itemId={kendaraanChatItem?.id ?? null}
            itemLabel={kendaraanChatItem ? `${kendaraanChatItem.keperluan} - ${kendaraanChatItem.namaKendaraan} - ${kendaraanChatItem.nomorPemesanan || "-"}` : ""}
            departemen={kendaraanChatItem?.departemen ?? null}
            me={me}
            onClose={() => setKendaraanChatItem(null)}
            onRead={() => loadKendaraanBookings({ silent: true })}
          />

          <VehicleBookingFormModal
            open={kendaraanFormOpen}
            me={me}
            initial={kendaraanFormInitial}
            onClose={() => { setKendaraanFormOpen(false); setKendaraanFormInitial(undefined); }}
            onCreated={loadKendaraanBookings}
          />

          <VehicleBookingDetailModal
            open={!!kendaraanDetail}
            mode={kendaraanDetail?.mode || "view"}
            item={kendaraanDetail?.item || null}
            me={me}
            onClose={() => setKendaraanDetail(null)}
            onSaved={loadKendaraanBookings}
            onRequestReject={(id, type, originLabel) => setKendaraanRejectTarget({ id, type, originLabel })}
          />

          <CancelBookingModal
            open={kendaraanCancelTargetId != null}
            targetId={kendaraanCancelTargetId}
            targetType="kendaraan"
            onClose={() => setKendaraanCancelTargetId(null)}
            onDone={() => {
              setKendaraanCancelTargetId(null);
              loadKendaraanBookings();
            }}
          />

          <VehicleBookingRescheduleModal
            open={!!kendaraanRescheduleTarget}
            item={kendaraanRescheduleTarget}
            onClose={() => setKendaraanRescheduleTarget(null)}
            onSaved={loadKendaraanBookings}
          />

          <RejectModal
            open={!!kendaraanRejectTarget}
            targetId={kendaraanRejectTarget?.id ?? null}
            targetType={kendaraanRejectTarget?.type ?? null}
            originLabel={kendaraanRejectTarget?.originLabel ?? ""}
            onClose={() => setKendaraanRejectTarget(null)}
            onDone={() => {
              setKendaraanRejectTarget(null);
              loadKendaraanBookings();
            }}
          />

          <VehicleBookingStatusHistoryModal open={kendaraanStatusItemId != null} itemId={kendaraanStatusItemId} onClose={() => setKendaraanStatusItemId(null)} />
        </>
          )}
        </>
      )}

      {activeTab === "arsip" && (
        <>
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
              onChange={(v) => updateArsipFilter({ status: v as BookingStatus | "REJECTED" | "ON_APPROVAL" | "" })}
              options={["DRAFT", "ON_APPROVAL", "REJECTED", "APPROVED_GA_APPROVAL"]}
              getLabel={(v) => ({
                DRAFT: "Draft",
                ON_APPROVAL: "On-Approval",
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
            <label htmlFor="filter-arsip-kategori">Kategori</label>
            <SearchableSelect
              id="filter-arsip-kategori"
              value={arsipFilters.kategori}
              onChange={(v) => updateArsipFilter({ kategori: v as ArchiveKategori | "" })}
              options={Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[]}
              getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
              clearLabel="Semua Kategori"
              placeholder="Semua Kategori"
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
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetArsipFilters}>Hapus Filter</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.arsipExportPdfUrl(arsipExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.arsipExportUrl(arsipExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            <button
              className="btn btn-bulk-delete"
              disabled={arsipBusy || arsipTotal === 0}
              onClick={() => askBulkDelete("Archive", "Permintaan", arsipTotal, activeFilters([["Cari", arsipFilters.search], ["Bulan", bulanText(arsipFilters.bulan)], ["Status", statusText(arsipFilters.status)], ["Kategori", arsipFilters.kategori ? ARCHIVE_KATEGORI_LABEL[arsipFilters.kategori] : ""], ["Divisi", arsipFilters.divisi], ["Departemen", arsipFilters.departemen]]), () => api.superAdminBulkDeleteArsip(arsipFilters), loadArsip)}
            >
              Hapus Semua
            </button>
            <button className="btn btn-primary" style={AUTO_WIDTH_STYLE} onClick={() => setArsipFormOpen(true)}>+ Pemindahan Arsip</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pemindahan</th><th>Diajukan</th><th>Tanggal</th><th>Jumlah Arsip</th>
                <th>Nama Arsip</th><th>Kategori</th><th>Tahun</th>
                <th>Lokasi Penyimpanan Saat Ini</th><th>Divisi</th><th>Departemen</th>
                <th>Nama PIC</th><th>No. Telepon PIC</th><th>Catatan</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {arsipBusy ? (
                <tr><td colSpan={15} className="table-empty">Memuat data...</td></tr>
              ) : arsipError ? (
                <tr><td colSpan={15} className="table-empty">{arsipError}</td></tr>
              ) : arsipItems.length === 0 ? (
                <tr><td colSpan={15} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                arsipItems.map((item, index) => {
                  const rowNumber = (arsipFilters.page - 1) * arsipFilters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorArsip || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{item.jumlahArsip}</td>
                      <td title={item.namaArsip}>{truncateText(item.namaArsip, 25)}</td>
                      <td>{ARCHIVE_KATEGORI_LABEL[item.kategori]}</td>
                      <td>{item.tahunArsip}</td>
                      <td title={item.lokasiPenyimpanan}>{truncateText(item.lokasiPenyimpanan, 25)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.namaPic || ""}>{truncateText(item.namaPic, 15)}</td>
                      <td>{item.noTeleponPic || "-"}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} revisable />
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setArsipChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => arsipRowMenu.toggle(e, item.id, 180)}>
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
            <div className="field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="filter-arsip-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-arsip-limit"
                value={String(arsipFilters.limit)}
                onChange={(v) => updateArsipFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} Pemindahan`}
                placeholder={`${arsipFilters.limit} Pemindahan`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {arsipTotal} Pemindahan · Halaman {arsipFilters.page} dari {arsipTotalPages}</span>
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

          <RowMenuDropdown
            position={arsipRowMenu.position}
            canEditDelete={
              !!arsipRowMenu.menuItem &&
              (isArsipEditableByOrigin(arsipRowMenu.menuItem, me) || canGaKoreksiArsip(arsipRowMenu.menuItem, me))
            }
            canDelete={!!arsipRowMenu.menuItem && isArsipEditableByOrigin(arsipRowMenu.menuItem, me)}
            onDetail={() => {
              const item = arsipRowMenu.menuItem;
              arsipRowMenu.close();
              if (item) setArsipDetail({ item, mode: "view" });
            }}
            onUpdates={() => {
              const item = arsipRowMenu.menuItem;
              arsipRowMenu.close();
              if (!item) return;
              if (isArsipEditableByOrigin(item, me)) setArsipDetail({ item, mode: "edit" });
              else if (canGaKoreksiArsip(item, me)) setArsipKoreksiTarget(item);
            }}
            onStatus={() => {
              const item = arsipRowMenu.menuItem;
              arsipRowMenu.close();
              if (item) setArsipStatusItemId(item.id);
            }}
            onDelete={() => {
              const item = arsipRowMenu.menuItem;
              arsipRowMenu.close();
              if (item) handleDeleteArsip(item);
            }}
            pdfUrl={arsipRowMenu.menuItem && isArsipPdfAvailable(arsipRowMenu.menuItem) ? api.arsipPdfUrl(arsipRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = arsipRowMenu.menuItem;
              arsipRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.arsipPdfUrl(item.id), `Bukti-Pemindahan-Arsip-${item.nomorArsip || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <ArsipChatModal
            open={!!arsipChatItem}
            itemId={arsipChatItem?.id ?? null}
            itemLabel={arsipChatItem ? `${arsipChatItem.namaArsip} - ${arsipChatItem.nomorArsip || "-"}` : ""}
            departemen={arsipChatItem?.departemen ?? null}
            createdByRole={arsipChatItem?.createdByRole ?? null}
            me={me}
            onClose={() => setArsipChatItem(null)}
            onRead={() => loadArsip({ silent: true })}
          />

          <ArsipFormModal open={arsipFormOpen} me={me} onClose={() => setArsipFormOpen(false)} onCreated={loadArsip} />

          <ArsipDetailModal
            open={!!arsipDetail}
            mode={arsipDetail?.mode || "view"}
            item={arsipDetail?.item || null}
            me={me}
            onClose={() => setArsipDetail(null)}
            onSaved={loadArsip}
            onRequestReject={(id, type, originLabel) => setArsipRejectTarget({ id, type, originLabel })}
          />

          <RejectModal
            open={!!arsipRejectTarget}
            targetId={arsipRejectTarget?.id ?? null}
            targetType={arsipRejectTarget?.type ?? null}
            originLabel={arsipRejectTarget?.originLabel ?? ""}
            onClose={() => setArsipRejectTarget(null)}
            onDone={() => {
              setArsipRejectTarget(null);
              loadArsip();
            }}
          />

          <ArsipKoreksiModal
            open={!!arsipKoreksiTarget}
            item={arsipKoreksiTarget}
            onClose={() => setArsipKoreksiTarget(null)}
            onSaved={loadArsip}
          />

          <ArsipStatusHistoryModal open={arsipStatusItemId != null} itemId={arsipStatusItemId} onClose={() => setArsipStatusItemId(null)} />
        </>
      )}

      {activeTab === "atk" && (
        <>
      <div className="card">
        <div className="card-header">
          <h3>Pesanan Kebutuhan Kantor</h3>
        </div>
        <div className="toolbar transactions-page-toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-atk-search">Cari Pesanan</label>
            <input type="text" id="filter-atk-search" placeholder="No Pesanan" value={atkSearchInput} onChange={(e) => handleAtkSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-atk-bulan">Filter Bulan</label>
            <MonthFilterPicker id="filter-atk-bulan" value={atkFilters.bulan} onChange={(v) => updateAtkFilter({ bulan: v })} />
          </div>
          <div className="filter-dropdown-wrap" ref={atkFilterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button type="button" className="btn filter-dropdown-toggle" id="filter-atk-toggle" style={AUTO_WIDTH_STYLE} onClick={() => setAtkFilterOpen((v) => !v)}>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {atkFilterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={FIELD_NO_MARGIN_STYLE}>
                  <label htmlFor="filter-atk-status">Status</label>
                  <SearchableSelect
                    id="filter-atk-status"
                    value={atkFilters.status}
                    onChange={(v) => updateAtkFilter({ status: v as Status | "REJECTED" | "ON_APPROVAL" | "" })}
                    options={["DRAFT", "ON_APPROVAL", "REJECTED", "COMPLETED"]}
                    getLabel={(v) => ({
                      DRAFT: "Draft",
                      ON_APPROVAL: "On-Approval",
                      REJECTED: "Rejected",
                      COMPLETED: "Approved",
                    } as Record<string, string>)[v] || v}
                    clearLabel="Semua Status"
                    placeholder="Semua Status"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-atk-sumber">Sumber Pembelian</label>
                  <SearchableSelect
                    id="filter-atk-sumber"
                    value={atkFilters.sumberPembelian}
                    onChange={(v) => updateAtkFilter({ sumberPembelian: v as SumberPembelian | "" })}
                    options={["KPU", "PADI"]}
                    getLabel={(v) => SUMBER_PEMBELIAN_LABEL[v as SumberPembelian] || v}
                    clearLabel="Semua Sumber"
                    placeholder="Semua Sumber"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-atk-direktorat">Direktorat</label>
                  <SearchableSelect
                    id="filter-atk-direktorat"
                    value={atkFilters.direktorat}
                    onChange={(v) => updateAtkFilter({ direktorat: v, divisi: "", departemen: "" })}
                    options={orgStructure?.direktorat || []}
                    clearLabel="Semua Direktorat"
                    placeholder="Semua Direktorat"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-atk-divisi">Divisi</label>
                  <SearchableSelect
                    id="filter-atk-divisi"
                    value={atkFilters.divisi}
                    onChange={(v) => updateAtkFilter({ divisi: v, departemen: "" })}
                    options={atkDivisiOptions}
                    clearLabel="Semua Divisi"
                    placeholder="Semua Divisi"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-atk-departemen">Departemen</label>
                  <SearchableSelect
                    id="filter-atk-departemen"
                    value={atkFilters.departemen}
                    onChange={(v) => updateAtkFilter({ departemen: v })}
                    options={atkDepartemenOptions}
                    clearLabel="Semua Departemen"
                    placeholder="Semua Departemen"
                  />
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetAtkFilters}>Hapus Filter</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.atkExportPdfUrl(atkExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.atkExportUrl(atkExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            <button
              className="btn btn-bulk-delete"
              disabled={atkBusy || atkTotal === 0}
              onClick={() => askBulkDelete("Office Supplies", "Pesanan", atkTotal, activeFilters([["Cari", atkFilters.search], ["Bulan", bulanText(atkFilters.bulan)], ["Status", statusText(atkFilters.status)], ["Sumber Pembelian", atkFilters.sumberPembelian ? SUMBER_PEMBELIAN_LABEL[atkFilters.sumberPembelian] : ""], ["Direktorat", atkFilters.direktorat], ["Divisi", atkFilters.divisi], ["Departemen", atkFilters.departemen]]), () => api.superAdminBulkDeleteAtk(atkFilters), loadAtk)}
            >
              Hapus Semua
            </button>
            <button className="btn btn-primary" style={AUTO_WIDTH_STYLE} onClick={() => setAtkFormOpen(true)}>+ Pesan Kebutuhan Kantor</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pesanan</th><th>Diajukan</th><th>Tanggal</th><th>Kategori</th>
                <th>Tujuan</th><th>Daftar Barang</th><th>Jumlah Jenis</th><th>Total Kuantitas</th>
                <th>Divisi</th><th>Departemen</th><th>Nama PIC</th><th>No. Telepon PIC</th><th>Catatan</th><th>Sumber Pembelian</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {atkBusy ? (
                <tr><td colSpan={16} className="table-empty">Memuat data...</td></tr>
              ) : atkError ? (
                <tr><td colSpan={16} className="table-empty">{atkError}</td></tr>
              ) : atkItems.length === 0 ? (
                <tr><td colSpan={16} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                atkItems.map((item, index) => {
                  const rowNumber = (atkFilters.page - 1) * atkFilters.limit + index + 1;
                  const barang = atkItemsSummary(item);
                  const totalKuantitas = item.items.reduce((sum, i) => sum + i.jumlah, 0);
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPermintaan || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td>{KATEGORI_ATK_LABEL[item.kategori] || item.kategori}</td>
                      <td title={item.keperluan}>{truncateText(item.keperluan, 25)}</td>
                      <td title={barang}>{truncateText(barang, 35)}</td>
                      <td>{item.items.length}</td>
                      <td>{totalKuantitas}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.namaPemohon}>{truncateText(item.namaPemohon, 18)}</td>
                      <td>{item.noTeleponPemohon}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>{item.sumberPembelian ? SUMBER_PEMBELIAN_LABEL[item.sumberPembelian] : "-"}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <AtkStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} />
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setAtkChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => atkRowMenu.toggle(e, item.id, 180)}>
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
            <div className="field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="filter-atk-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-atk-limit"
                value={String(atkFilters.limit)}
                onChange={(v) => updateAtkFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} Pesanan`}
                placeholder={`${atkFilters.limit} Pesanan`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {atkTotal} Pesanan · Halaman {atkFilters.page} dari {atkTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={atkFilters.page <= 1} onClick={() => goToAtkPage(atkFilters.page - 1)}>‹</button>
              {atkPageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === atkFilters.page ? "active" : ""}`} onClick={() => goToAtkPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={atkFilters.page >= atkTotalPages} onClick={() => goToAtkPage(atkFilters.page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

          <RowMenuDropdown
            position={atkRowMenu.position}
            canEditDelete={
              !!atkRowMenu.menuItem &&
              (isAtkEditableByOrigin(atkRowMenu.menuItem, me) || canGaUpdateAtk(atkRowMenu.menuItem, me) || canKoreksiHargaAtk(atkRowMenu.menuItem, me))
            }
            canDelete={!!atkRowMenu.menuItem && isAtkEditableByOrigin(atkRowMenu.menuItem, me)}
            onDetail={() => {
              const item = atkRowMenu.menuItem;
              atkRowMenu.close();
              if (item) setAtkDetail({ item, mode: "view" });
            }}
            onUpdates={() => {
              const item = atkRowMenu.menuItem;
              atkRowMenu.close();
              if (!item) return;
              if (isAtkEditableByOrigin(item, me)) setAtkDetail({ item, mode: "edit" });
              else if (canGaUpdateAtk(item, me)) setAtkDetail({ item, mode: "ga-edit" });
              else if (canKoreksiHargaAtk(item, me)) setAtkDetail({ item, mode: "kpu-edit" });
            }}
            onStatus={() => {
              const item = atkRowMenu.menuItem;
              atkRowMenu.close();
              if (item) setAtkStatusItemId(item.id);
            }}
            onDelete={() => {
              const item = atkRowMenu.menuItem;
              atkRowMenu.close();
              if (item) handleDeleteAtk(item);
            }}
            pdfUrl={atkRowMenu.menuItem && isAtkPdfAvailable(atkRowMenu.menuItem) ? api.atkPdfUrl(atkRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = atkRowMenu.menuItem;
              atkRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.atkPdfUrl(item.id), `Bukti-Pesanan-Kebutuhan-Kantor-${item.nomorPermintaan || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <AtkChatModal
            open={!!atkChatItem}
            itemId={atkChatItem?.id ?? null}
            itemLabel={atkChatItem ? `${atkChatItem.keperluan} - ${atkChatItem.nomorPermintaan || "-"}` : ""}
            departemen={atkChatItem?.departemen ?? null}
            createdByRole={atkChatItem?.createdByRole ?? null}
            me={me}
            onClose={() => setAtkChatItem(null)}
            onRead={() => loadAtk({ silent: true })}
          />

          <AtkFormModal open={atkFormOpen} me={me} onClose={() => setAtkFormOpen(false)} onCreated={loadAtk} />

          <AtkDetailModal
            open={!!atkDetail}
            mode={atkDetail?.mode || "view"}
            item={atkDetail?.item || null}
            me={me}
            onClose={() => setAtkDetail(null)}
            onSaved={loadAtk}
            onRequestReject={(id, type, originLabel) => setAtkRejectTarget({ id, type, originLabel })}
          />

          <RejectModal
            open={!!atkRejectTarget}
            targetId={atkRejectTarget?.id ?? null}
            targetType={atkRejectTarget?.type ?? null}
            originLabel={atkRejectTarget?.originLabel ?? ""}
            onClose={() => setAtkRejectTarget(null)}
            onDone={() => {
              setAtkRejectTarget(null);
              loadAtk();
            }}
          />

          <AtkStatusHistoryModal open={atkStatusItemId != null} itemId={atkStatusItemId} onClose={() => setAtkStatusItemId(null)} />
        </>
      )}

      {activeTab === "sarana" && (
        <>
      <div className="card">
        <div className="card-header">
          <h3>Pengajuan Perbaikan Sarana</h3>
        </div>
        <div className="toolbar transactions-page-toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-sarana-search">Cari Pengajuan</label>
            <input type="text" id="filter-sarana-search" placeholder="No Pengajuan" value={saranaSearchInput} onChange={(e) => handleSaranaSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-sarana-bulan">Filter Bulan</label>
            <MonthFilterPicker id="filter-sarana-bulan" value={saranaFilters.bulan} onChange={(v) => updateSaranaFilter({ bulan: v })} />
          </div>
          <div className="filter-dropdown-wrap" ref={saranaFilterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button type="button" className="btn filter-dropdown-toggle" id="filter-sarana-toggle" style={AUTO_WIDTH_STYLE} onClick={() => setSaranaFilterOpen((v) => !v)}>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {saranaFilterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={FIELD_NO_MARGIN_STYLE}>
                  <label htmlFor="filter-sarana-status">Status</label>
                  <SearchableSelect
                    id="filter-sarana-status"
                    value={saranaFilters.status}
                    onChange={(v) => updateSaranaFilter({ status: v as BookingStatus | "REJECTED" | "ON_APPROVAL" | "" })}
                    options={["DRAFT", "ON_APPROVAL", "REJECTED", "APPROVED_GA_APPROVAL"]}
                    getLabel={(v) => ({
                      DRAFT: "Draft",
                      ON_APPROVAL: "On-Approval",
                      REJECTED: "Rejected",
                      APPROVED_GA_APPROVAL: "Approved",
                    } as Record<string, string>)[v] || v}
                    clearLabel="Semua Status"
                    placeholder="Semua Status"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-sarana-kategori">Kategori Kerusakan</label>
                  <SearchableSelect
                    id="filter-sarana-kategori"
                    value={saranaFilters.kategori}
                    onChange={(v) => updateSaranaFilter({ kategori: v as KategoriKerusakan | "" })}
                    options={KATEGORI_OPTIONS}
                    getLabel={(v) => KATEGORI_KERUSAKAN_LABEL[v as KategoriKerusakan] || v}
                    clearLabel="Semua Kategori"
                    placeholder="Semua Kategori"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-sarana-direktorat">Direktorat</label>
                  <SearchableSelect
                    id="filter-sarana-direktorat"
                    value={saranaFilters.direktorat}
                    onChange={(v) => updateSaranaFilter({ direktorat: v, divisi: "", departemen: "" })}
                    options={orgStructure?.direktorat || []}
                    clearLabel="Semua Direktorat"
                    placeholder="Semua Direktorat"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-sarana-divisi">Divisi</label>
                  <SearchableSelect
                    id="filter-sarana-divisi"
                    value={saranaFilters.divisi}
                    onChange={(v) => updateSaranaFilter({ divisi: v, departemen: "" })}
                    options={saranaDivisiOptions}
                    clearLabel="Semua Divisi"
                    placeholder="Semua Divisi"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-sarana-departemen">Departemen</label>
                  <SearchableSelect
                    id="filter-sarana-departemen"
                    value={saranaFilters.departemen}
                    onChange={(v) => updateSaranaFilter({ departemen: v })}
                    options={saranaDepartemenOptions}
                    clearLabel="Semua Departemen"
                    placeholder="Semua Departemen"
                  />
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetSaranaFilters}>Hapus Filter</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.saranaExportPdfUrl(saranaExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.saranaExportUrl(saranaExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            <button
              className="btn btn-bulk-delete"
              disabled={saranaBusy || saranaTotal === 0}
              onClick={() => askBulkDelete("Maintenance", "Pengajuan", saranaTotal, activeFilters([["Cari", saranaFilters.search], ["Bulan", bulanText(saranaFilters.bulan)], ["Status", statusText(saranaFilters.status)], ["Kategori", saranaFilters.kategori ? KATEGORI_KERUSAKAN_LABEL[saranaFilters.kategori] : ""], ["Direktorat", saranaFilters.direktorat], ["Divisi", saranaFilters.divisi], ["Departemen", saranaFilters.departemen]]), () => api.superAdminBulkDeleteSarana(saranaFilters), loadSarana)}
            >
              Hapus Semua
            </button>
            <button className="btn btn-primary" style={AUTO_WIDTH_STYLE} onClick={() => setSaranaFormOpen(true)}>+ Ajukan Perbaikan</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Pengajuan</th><th>Diajukan</th><th>Tanggal Pengajuan</th><th>Lokasi</th><th>Kategori Kerusakan</th><th>Deskripsi Kerusakan</th>
                <th>Divisi</th><th>Departemen</th><th>Nama PIC</th><th>No. Telepon PIC</th>
                <th>Catatan</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {saranaBusy ? (
                <tr><td colSpan={13} className="table-empty">Memuat data...</td></tr>
              ) : saranaError ? (
                <tr><td colSpan={13} className="table-empty">{saranaError}</td></tr>
              ) : saranaItems.length === 0 ? (
                <tr><td colSpan={13} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                saranaItems.map((item, index) => {
                  const rowNumber = (saranaFilters.page - 1) * saranaFilters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorPerbaikan || "-"}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td title={item.lokasi}>{truncateText(item.lokasi, 25)}</td>
                      <td>{KATEGORI_KERUSAKAN_LABEL[item.kategori]}</td>
                      <td title={item.deskripsiKerusakan}>{truncateText(item.deskripsiKerusakan, 35)}</td>
                      <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                      <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                      <td title={item.namaPelapor}>{truncateText(item.namaPelapor, 18)}</td>
                      <td>{item.noTeleponPelapor}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>
                        <div className="status-cell">
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} revisable />
                            {item.status === "APPROVED_GA_APPROVAL" && item.executionStage !== "MENUNGGU" && (
                              <span className="badge badge-pending">{EXECUTION_STAGE_LABEL[item.executionStage]}</span>
                            )}
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setSaranaChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => saranaRowMenu.toggle(e, item.id, 180)}>
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
            <div className="field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="filter-sarana-limit">Tampilkan</label>
              <SearchableSelect
                id="filter-sarana-limit"
                value={String(saranaFilters.limit)}
                onChange={(v) => updateSaranaFilter({ limit: Number(v) })}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} Pengajuan`}
                placeholder={`${saranaFilters.limit} Pengajuan`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {saranaTotal} Pengajuan · Halaman {saranaFilters.page} dari {saranaTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={saranaFilters.page <= 1} onClick={() => goToSaranaPage(saranaFilters.page - 1)}>‹</button>
              {saranaPageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === saranaFilters.page ? "active" : ""}`} onClick={() => goToSaranaPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={saranaFilters.page >= saranaTotalPages} onClick={() => goToSaranaPage(saranaFilters.page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

          <RowMenuDropdown
            position={saranaRowMenu.position}
            canEditDelete={
              !!saranaRowMenu.menuItem &&
              (isSaranaEditableByOrigin(saranaRowMenu.menuItem, me) || canGaKoreksiSarana(saranaRowMenu.menuItem, me))
            }
            canDelete={!!saranaRowMenu.menuItem && isSaranaEditableByOrigin(saranaRowMenu.menuItem, me)}
            onDetail={() => {
              const item = saranaRowMenu.menuItem;
              saranaRowMenu.close();
              if (item) setSaranaDetail({ item, mode: "view" });
            }}
            onUpdates={() => {
              const item = saranaRowMenu.menuItem;
              saranaRowMenu.close();
              if (!item) return;
              if (isSaranaEditableByOrigin(item, me)) setSaranaDetail({ item, mode: "edit" });
              else if (canGaKoreksiSarana(item, me)) setSaranaKoreksiTarget(item);
            }}
            onStatus={() => {
              const item = saranaRowMenu.menuItem;
              saranaRowMenu.close();
              if (item) setSaranaStatusItemId(item.id);
            }}
            onDelete={() => {
              const item = saranaRowMenu.menuItem;
              saranaRowMenu.close();
              if (item) handleDeleteSarana(item);
            }}
            pdfUrl={saranaRowMenu.menuItem && isSaranaPdfAvailable(saranaRowMenu.menuItem) ? api.saranaPdfUrl(saranaRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = saranaRowMenu.menuItem;
              saranaRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.saranaPdfUrl(item.id), `Bukti-Pengajuan-Perbaikan-${item.nomorPerbaikan || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <SaranaChatModal
            open={!!saranaChatItem}
            itemId={saranaChatItem?.id ?? null}
            itemLabel={saranaChatItem ? `${saranaChatItem.lokasi} - ${saranaChatItem.nomorPerbaikan || "-"}` : ""}
            departemen={saranaChatItem?.departemen ?? null}
            createdByRole={saranaChatItem?.createdByRole ?? null}
            me={me}
            onClose={() => setSaranaChatItem(null)}
            onRead={() => loadSarana({ silent: true })}
          />

          <SaranaFormModal open={saranaFormOpen} me={me} onClose={() => setSaranaFormOpen(false)} onCreated={loadSarana} />

          <SaranaDetailModal
            open={!!saranaDetail}
            mode={saranaDetail?.mode || "view"}
            item={saranaDetail?.item || null}
            me={me}
            onClose={() => setSaranaDetail(null)}
            onSaved={loadSarana}
            onRequestReject={(id, type, originLabel) => setSaranaRejectTarget({ id, type, originLabel })}
          />

          <SaranaKoreksiModal
            open={!!saranaKoreksiTarget}
            item={saranaKoreksiTarget}
            onClose={() => setSaranaKoreksiTarget(null)}
            onSaved={loadSarana}
          />

          <RejectModal
            open={!!saranaRejectTarget}
            targetId={saranaRejectTarget?.id ?? null}
            targetType={saranaRejectTarget?.type ?? null}
            originLabel={saranaRejectTarget?.originLabel ?? ""}
            onClose={() => setSaranaRejectTarget(null)}
            onDone={() => {
              setSaranaRejectTarget(null);
              loadSarana();
            }}
          />

          <SaranaStatusHistoryModal open={saranaStatusItemId != null} itemId={saranaStatusItemId} onClose={() => setSaranaStatusItemId(null)} />
        </>
      )}

      {activeTab === "organisasi" && <SuperAdminOrgTab />}

      {activeTab === "users" && <SuperAdminUsersTab orgStructure={orgStructure} />}

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

      <BulkDeleteModal target={bulkTarget} onClose={() => setBulkTarget(null)} />
    </>
  );
}

export default function SuperAdminPage() {
  return (
    <Suspense fallback={null}>
      <SuperAdminPageInner />
    </Suspense>
  );
}
