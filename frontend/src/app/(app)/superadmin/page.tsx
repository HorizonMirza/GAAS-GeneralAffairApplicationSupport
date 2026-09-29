"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ARCHIVE_KATEGORI_LABEL, atkItemsSummary, bookingRoomsLabel, BOOKING_ON_APPROVAL_STATUSES, BOOKING_REJECTED_STATUSES, BOOKING_STATUS_LABEL, bookingStatusBorderClass, canGaKoreksiArsip, canGaKoreksiPengiriman, canGaKoreksiSarana, canGaRescheduleBooking, canGaRescheduleKendaraan, canGaUpdateAtk, canKoreksiHargaAtk, canKoreksiHargaPengiriman, cardStatusBorderClass, EXECUTION_STAGE_LABEL, INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL, isArsipEditableByOrigin, isArsipPdfAvailable, isAtkEditableByOrigin, isAtkPdfAvailable, isBookingCancellableByOrigin, isBookingDeletableByOrigin, isBookingEditableByOrigin, isBookingOriginRole, isBookingPdfAvailable, isEditableByOrigin, isKendaraanCancellableByOrigin, isKendaraanDeletableByOrigin, isKendaraanEditableByOrigin, isKendaraanPdfAvailable, isPengirimanPdfAvailable, isSaranaEditableByOrigin, isSaranaPdfAvailable, KATEGORI_ATK_LABEL, KATEGORI_KERUSAKAN_LABEL, ON_APPROVAL_STATUSES, REJECTED_STATUSES, STATUS_LABEL, SUMBER_PEMBELIAN_LABEL, TIPE_BOOKING_LABELS } from "@/lib/constants";
import { currentYear, currentYearMonth, formatCurrency, formatDate, formatDateTime, formatTimeRange, invoiceBulanLabel, nowWib, todayLocalDate, truncateText } from "@/lib/format";
import { isWholeDayAllowed } from "@/lib/bookingTime";
import { kendaraanAsBookingRuangShape } from "@/lib/kendaraanCalendarAdapter";
import type { ArchiveKategori, BookingKendaraan, BookingKendaraanCreatePayload, BookingRuang, BookingRuangCreatePayload, BookingStatus, Invoice, KategoriKerusakan, PerbaikanSarana, PerbaikanSaranaCatalogItem, Pengiriman, PermintaanArsip, PermintaanArsipCatalogItem, PermintaanAtk, RoomOption, Status, SumberPembelian, VehicleOption } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import { useRowMenu } from "@/lib/useRowMenu";
import StatusBadge from "@/components/StatusBadge";
import Stepper from "@/components/Stepper";
import BookingStatusBadge from "@/components/BookingStatusBadge";
import AtkStatusBadge from "@/components/AtkStatusBadge";
import AtkStepper from "@/components/AtkStepper";
import RoomBookingStepper from "@/components/RoomBookingStepper";
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
import RoomCalendarView, { addDays, addMonths, isWeekend, mondayOf, type CalendarViewMode } from "@/components/RoomCalendarView";
import MiniMonthCalendar from "@/components/MiniMonthCalendar";
import RoomInfoModal from "@/components/RoomInfoModal";
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
import InvoiceUploadModal from "@/components/InvoiceUploadModal";
import InvoiceActionModal from "@/components/InvoiceActionModal";
import InvoiceUpdateModal from "@/components/InvoiceUpdateModal";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import InvoiceHistoryModal from "@/components/InvoiceHistoryModal";
import AtkInvoiceUploadModal from "@/components/AtkInvoiceUploadModal";
import AtkInvoiceActionModal from "@/components/AtkInvoiceActionModal";
import AtkInvoiceUpdateModal from "@/components/AtkInvoiceUpdateModal";
import AtkInvoiceDetailModal from "@/components/AtkInvoiceDetailModal";
import AtkInvoiceHistoryModal from "@/components/AtkInvoiceHistoryModal";
import InvoiceChatModal from "@/components/InvoiceChatModal";
import AtkInvoiceChatModal from "@/components/AtkInvoiceChatModal";
import DashboardStats from "@/components/DashboardStats";
import DashboardContent from "@/components/DashboardContent";
import { WelcomeGreeting } from "@/components/WelcomeGreeting";
import NotificationSoundSettingsCard from "@/components/NotificationSoundSettingsCard";
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

// Labels/icons here mirror AppShell's SUPER_ADMIN_TABS (the sidebar submenu that's the actual
// navigation UI now) - this array itself only validates ?tab= against known keys, since the pill
// bar that used to render these was removed as redundant with that sidebar submenu.
const TABS: { key: SuperAdminTab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Dashboard", icon: <Shield width={16} height={16} /> },
  { key: "ekspedisi", label: "Expedition", icon: <Layers width={16} height={16} /> },
  { key: "booking-ruang", label: "Room Booking", icon: <Calendar width={16} height={16} /> },
  { key: "booking-kendaraan", label: "Vehicle Booking", icon: <Car width={16} height={16} /> },
  { key: "atk", label: "Office Supplies", icon: <ClipboardList width={16} height={16} /> },
  { key: "sarana", label: "Maintenance", icon: <Wrench width={16} height={16} /> },
  { key: "arsip", label: "Archive", icon: <Folder width={16} height={16} /> },
  { key: "organisasi", label: "Organization", icon: <Building2 width={16} height={16} /> },
  { key: "users", label: "Users", icon: <Users width={16} height={16} /> },
];

interface BookingFilterState {
  page: number;
  limit: number;
  tanggal: string;
  bulan: string;
  status: BookingStatus | "REJECTED" | "ON_APPROVAL" | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  namaRuang: string;
  search: string;
}

const EMPTY_BOOKING_FILTERS: BookingFilterState = { page: 1, limit: 10, tanggal: "", bulan: "", status: "", divisi: "", departemen: "", direktorat: "", namaRuang: "", search: "" };

const AUTO_WIDTH_STYLE = { width: "auto" };
const RESET_FILTER_BUTTON_STYLE = { width: "auto", alignSelf: "flex-end" };
const FIELD_NO_MARGIN_STYLE = { marginBottom: 0 };
const FIELD_NO_MARGIN_TOP_SPACED_STYLE = { marginBottom: 0, marginTop: 12 };

interface KendaraanFilterState {
  page: number;
  limit: number;
  tanggal: string;
  bulan: string;
  status: BookingStatus | "REJECTED" | "ON_APPROVAL" | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  namaKendaraan: string;
  search: string;
}

const EMPTY_KENDARAAN_FILTERS: KendaraanFilterState = { page: 1, limit: 10, tanggal: "", bulan: "", status: "", divisi: "", departemen: "", direktorat: "", namaKendaraan: "", search: "" };

// Calendar sub-tab (Room/Vehicle Booking) - mirrors booking-ruang-meeting/calendar and
// booking-kendaraan/calendar's own date-range helpers exactly.
const ALL_ROOMS_VALUE = "__all__";
const ALL_VEHICLES_VALUE = "__all__";
function calPad(n: number): string {
  return String(n).padStart(2, "0");
}
function calTodayIso(): string {
  const d = nowWib();
  return `${d.getFullYear()}-${calPad(d.getMonth() + 1)}-${calPad(d.getDate())}`;
}
function calRangeForView(view: CalendarViewMode, refDate: string): { from: string; to: string } {
  if (view === "week") {
    const monday = mondayOf(refDate);
    return { from: monday, to: addDays(monday, 4) };
  }
  if (view === "month") {
    const d = new Date(refDate + "T00:00:00");
    const firstOfMonth = `${d.getFullYear()}-${calPad(d.getMonth() + 1)}-01`;
    const start = mondayOf(firstOfMonth);
    return { from: start, to: addDays(start, 41) };
  }
  return { from: refDate, to: refDate };
}
function calMonthGridRange(refDate: string): { from: string; to: string } {
  const d = new Date(refDate + "T00:00:00");
  const firstOfMonth = `${d.getFullYear()}-${calPad(d.getMonth() + 1)}-01`;
  const start = mondayOf(firstOfMonth);
  return { from: start, to: addDays(start, 41) };
}

// Room/Vehicle Booking Overview sub-tab - mirrors booking-ruang-meeting/overview and
// booking-kendaraan/overview's own availability-grid helpers exactly (both pages define near-
// identical copies of these; kept here as one shared set instead of duplicating twice more).
const OV_OPEN_MIN = 7 * 60;
const OV_CLOSE_MIN = 18 * 60;

function ovToMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function ovMinutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function ovNowMinutesLocal(): number {
  const now = nowWib();
  return now.getHours() * 60 + now.getMinutes();
}

function roomPhotoUrl(roomName: string): string {
  const slug = roomName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `/assets/rooms/${slug}.png`;
}
const DEMO_ROOM_PHOTOS = [
  "/assets/rooms/ruang-eksternal-receptionist.png",
  "/assets/rooms/ruang-eksternal-besar.png",
  "/assets/rooms/ruang-eksternal-kecil.png",
  "/assets/rooms/ruang-golf.png",
  "/assets/rooms/ruang-open-space.png",
];
function roomPhotoUrls(roomName: string): string[] {
  const own = roomPhotoUrl(roomName);
  return [own, ...DEMO_ROOM_PHOTOS.filter((u) => u !== own)].slice(0, 5);
}

function vehiclePhotoUrl(vehicleName: string): string {
  const slug = vehicleName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `/assets/vehicles/${slug}.png`;
}
const DEMO_VEHICLE_PHOTOS = [
  "/assets/vehicles/toyota-avanza-1.png",
  "/assets/vehicles/toyota-innova.png",
  "/assets/vehicles/honda-hr-v.png",
  "/assets/vehicles/mitsubishi-xpander.png",
  "/assets/vehicles/toyota-fortuner.png",
];
function vehiclePhotoUrls(vehicleName: string): string[] {
  const own = vehiclePhotoUrl(vehicleName);
  return [own, ...DEMO_VEHICLE_PHOTOS.filter((u) => u !== own)].slice(0, 5);
}

function roomFreeSlotsToday(roomName: string, todayEntries: BookingRuang[]): [number, number][] {
  const booked: [number, number][] = [];
  for (const entry of todayEntries) {
    if (entry.status === "DRAFT") continue;
    if (entry.namaRuang !== roomName && !entry.additionalRooms.includes(roomName)) continue;
    if (entry.isWholeDay) { booked.push([OV_OPEN_MIN, OV_CLOSE_MIN]); continue; }
    if (!entry.jamMulai || !entry.jamSelesai) continue;
    const start = Math.max(OV_OPEN_MIN, ovToMinutes(entry.jamMulai));
    const end = Math.min(OV_CLOSE_MIN, ovToMinutes(entry.jamSelesai));
    if (end > start) booked.push([start, end]);
  }
  const now = ovNowMinutesLocal();
  const free: [number, number][] = [];
  for (let h = OV_OPEN_MIN; h < OV_CLOSE_MIN; h += 60) {
    if (h < now) continue;
    const slotEnd = h + 60;
    const isBooked = booked.some(([bs, be]) => bs < slotEnd && be > h);
    if (!isBooked) free.push([h, slotEnd]);
  }
  return free;
}
function isRoomFullyBookedToday(roomName: string, todayEntries: BookingRuang[]): boolean {
  return roomFreeSlotsToday(roomName, todayEntries).length === 0;
}
function getRealRoomCurrentSlot(roomName: string, todayEntries: BookingRuang[], closed: boolean): { jam: string; status: "free" | "booked"; judul: string } {
  if (closed) return { jam: "Tutup", status: "booked", judul: "Tutup" };
  const now = ovNowMinutesLocal();
  if (now >= OV_CLOSE_MIN) return { jam: "18:00", status: "booked", judul: "Tutup" };
  const roomBookings = todayEntries
    .filter((e) => e.status !== "DRAFT" && e.status !== "CANCELLED" && !e.status.startsWith("REJECTED") && (e.namaRuang === roomName || e.additionalRooms?.includes(roomName)))
    .map((e) => {
      const start = e.isWholeDay ? OV_OPEN_MIN : ovToMinutes(e.jamMulai || "07:00");
      const end = e.isWholeDay ? OV_CLOSE_MIN : ovToMinutes(e.jamSelesai || "18:00");
      return { ...e, startMin: start, endMin: end };
    })
    .sort((a, b) => a.startMin - b.startMin);
  const currentHour = now < OV_OPEN_MIN ? Math.floor(OV_OPEN_MIN / 60) : Math.floor(now / 60);
  const startHhmm = `${String(currentHour).padStart(2, "0")}:00`;
  const ongoing = roomBookings.find((b) => b.startMin <= now && b.endMin > now);
  if (ongoing) {
    const jam = ongoing.isWholeDay ? "07:00 - 18:00" : `${ongoing.jamMulai?.slice(0, 5) || "07:00"} - ${ongoing.jamSelesai?.slice(0, 5) || "18:00"}`;
    return { jam, status: "booked", judul: ongoing.namaKegiatan || "Terisi" };
  }
  const upcomingBookings = roomBookings.filter((b) => b.startMin > now);
  const effectiveNow = Math.max(now, OV_OPEN_MIN);
  let cursor = effectiveNow, bestStart = effectiveNow, bestEnd = OV_CLOSE_MIN, bestLen = -1;
  for (const b of upcomingBookings) {
    if (b.startMin > cursor) {
      const len = b.startMin - cursor;
      if (len > bestLen) { bestLen = len; bestStart = cursor; bestEnd = b.startMin; }
    }
    cursor = Math.max(cursor, b.endMin);
  }
  if (OV_CLOSE_MIN > cursor) {
    const len = OV_CLOSE_MIN - cursor;
    if (len > bestLen) { bestLen = len; bestStart = cursor; bestEnd = OV_CLOSE_MIN; }
  }
  if (bestLen <= 0) {
    const next = upcomingBookings[0];
    const jam = next.isWholeDay ? "07:00 - 18:00" : `${next.jamMulai?.slice(0, 5) || "07:00"} - ${next.jamSelesai?.slice(0, 5) || "18:00"}`;
    return { jam, status: "booked", judul: next.namaKegiatan || "Terisi" };
  }
  return { jam: `${bestStart === effectiveNow ? startHhmm : ovMinutesToHHMM(bestStart)} - ${ovMinutesToHHMM(bestEnd)}`, status: "free", judul: "Available" };
}

function vehicleFreeSlotsToday(vehicleName: string, todayEntries: BookingKendaraan[]): [number, number][] {
  const booked: [number, number][] = [];
  for (const entry of todayEntries) {
    if (entry.status === "DRAFT") continue;
    if (entry.namaKendaraan !== vehicleName) continue;
    if (entry.isWholeDay) { booked.push([OV_OPEN_MIN, OV_CLOSE_MIN]); continue; }
    if (!entry.jamMulai || !entry.jamSelesai) continue;
    const start = Math.max(OV_OPEN_MIN, ovToMinutes(entry.jamMulai));
    const end = Math.min(OV_CLOSE_MIN, ovToMinutes(entry.jamSelesai));
    if (end > start) booked.push([start, end]);
  }
  const now = ovNowMinutesLocal();
  const free: [number, number][] = [];
  for (let h = OV_OPEN_MIN; h < OV_CLOSE_MIN; h += 60) {
    if (h < now) continue;
    const slotEnd = h + 60;
    const isBooked = booked.some(([bs, be]) => bs < slotEnd && be > h);
    if (!isBooked) free.push([h, slotEnd]);
  }
  return free;
}
function isVehicleFullyBookedToday(vehicleName: string, todayEntries: BookingKendaraan[]): boolean {
  return vehicleFreeSlotsToday(vehicleName, todayEntries).length === 0;
}
function getRealVehicleCurrentSlot(vehicleName: string, todayEntries: BookingKendaraan[], closed: boolean): { jam: string; status: "free" | "booked"; judul: string } {
  if (closed) return { jam: "Tutup", status: "booked", judul: "Tutup" };
  const now = ovNowMinutesLocal();
  if (now >= OV_CLOSE_MIN) return { jam: "18:00", status: "booked", judul: "Tutup" };
  const vehicleBookings = todayEntries
    .filter((e) => e.status !== "DRAFT" && e.status !== "CANCELLED" && !e.status.startsWith("REJECTED") && e.namaKendaraan === vehicleName)
    .map((e) => {
      const start = e.isWholeDay ? OV_OPEN_MIN : ovToMinutes(e.jamMulai || "07:00");
      const end = e.isWholeDay ? OV_CLOSE_MIN : ovToMinutes(e.jamSelesai || "18:00");
      return { ...e, startMin: start, endMin: end };
    })
    .sort((a, b) => a.startMin - b.startMin);
  const currentHour = now < OV_OPEN_MIN ? Math.floor(OV_OPEN_MIN / 60) : Math.floor(now / 60);
  const startHhmm = `${String(currentHour).padStart(2, "0")}:00`;
  const ongoing = vehicleBookings.find((b) => b.startMin <= now && b.endMin > now);
  if (ongoing) {
    const jam = ongoing.isWholeDay ? "07:00 - 18:00" : `${ongoing.jamMulai?.slice(0, 5) || "07:00"} - ${ongoing.jamSelesai?.slice(0, 5) || "18:00"}`;
    return { jam, status: "booked", judul: ongoing.keperluan || "Terisi" };
  }
  const upcomingBookings = vehicleBookings.filter((b) => b.startMin > now);
  const effectiveNow = Math.max(now, OV_OPEN_MIN);
  let cursor = effectiveNow, bestStart = effectiveNow, bestEnd = OV_CLOSE_MIN, bestLen = -1;
  for (const b of upcomingBookings) {
    if (b.startMin > cursor) {
      const len = b.startMin - cursor;
      if (len > bestLen) { bestLen = len; bestStart = cursor; bestEnd = b.startMin; }
    }
    cursor = Math.max(cursor, b.endMin);
  }
  if (OV_CLOSE_MIN > cursor) {
    const len = OV_CLOSE_MIN - cursor;
    if (len > bestLen) { bestLen = len; bestStart = cursor; bestEnd = OV_CLOSE_MIN; }
  }
  if (bestLen <= 0) {
    const next = upcomingBookings[0];
    const jam = next.isWholeDay ? "07:00 - 18:00" : `${next.jamMulai?.slice(0, 5) || "07:00"} - ${next.jamSelesai?.slice(0, 5) || "18:00"}`;
    return { jam, status: "booked", judul: next.keperluan || "Terisi" };
  }
  return { jam: `${bestStart === effectiveNow ? startHhmm : ovMinutesToHHMM(bestStart)} - ${ovMinutesToHHMM(bestEnd)}`, status: "free", judul: "Available" };
}

interface ArsipFilterState {
  page: number;
  limit: number;
  bulan: string;
  tanggal: string;
  search: string;
  status: BookingStatus | "REJECTED" | "ON_APPROVAL" | "";
  kategori: ArchiveKategori | "";
  divisi: string;
  departemen: string;
  direktorat: string;
}

const EMPTY_ARSIP_FILTERS: ArsipFilterState = { page: 1, limit: 10, bulan: "", tanggal: "", search: "", status: "", kategori: "", divisi: "", departemen: "", direktorat: "" };

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

// Repository (Katalog) - read-only, approved-only view, so no status filter like the Transaction
// tables above (see PermintaanArsipController/PerbaikanSaranaController.GetCatalog).
interface ArsipKatalogFilterState {
  page: number;
  limit: number;
  search: string;
  kategori: ArchiveKategori | "";
  divisi: string;
  departemen: string;
  direktorat: string;
  bulan: string;
  tanggal: string;
}

const EMPTY_ARSIP_KATALOG_FILTERS: ArsipKatalogFilterState = { page: 1, limit: 10, search: "", kategori: "", divisi: "", departemen: "", direktorat: "", bulan: "", tanggal: "" };

interface SaranaKatalogFilterState {
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

const EMPTY_SARANA_KATALOG_FILTERS: SaranaKatalogFilterState = { page: 1, limit: 10, search: "", kategori: "", divisi: "", departemen: "", direktorat: "", bulan: "", tanggal: "" };

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
  // Sidebar submenu links navigate with a plain <Link>, which changes searchParams without
  // unmounting this page - sync activeTab from the URL whenever that happens (a direct link,
  // browser back/forward, or the sidebar's own navigation).
  useEffect(() => {
    const fromUrl = searchParams.get("tab") as SuperAdminTab | null;
    if (fromUrl && TABS.some((t) => t.key === fromUrl) && fromUrl !== activeTab) setActiveTabState(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [ekspedisiSubtab, setEkspedisiSubtab] = useState<"overview" | "pengiriman" | "invoice">("overview");

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

  // Overview sub-tab - separate state from the Transaction table above since it's a wholly
  // different view (stat tiles + current-month card list with Stepper), mirroring
  // ekspedisi/overview/page.tsx exactly.
  const [ekspedisiOvItems, setEkspedisiOvItems] = useState<Pengiriman[]>([]);
  const [ekspedisiOvStats, setEkspedisiOvStats] = useState<{
    waitingL1: number; waitingGa: number; waitingGaApproval: number; waitingKpu: number; completed: number;
  } | null>(null);
  const [ekspedisiOvBusy, setEkspedisiOvBusy] = useState(true);
  const [ekspedisiOvStatusFilter, setEkspedisiOvStatusFilter] = useState<"ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [ekspedisiOvFormOpen, setEkspedisiOvFormOpen] = useState(false);
  const [ekspedisiOvDetail, setEkspedisiOvDetail] = useState<{ item: Pengiriman; mode: "view" | "edit" | "kpu-edit" } | null>(null);
  const [ekspedisiOvStatusItemId, setEkspedisiOvStatusItemId] = useState<number | null>(null);
  const [ekspedisiOvChatItem, setEkspedisiOvChatItem] = useState<Pengiriman | null>(null);
  const [ekspedisiOvRejectTarget, setEkspedisiOvRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string; createdByRole: string } | null>(null);
  const [ekspedisiOvKoreksiTarget, setEkspedisiOvKoreksiTarget] = useState<Pengiriman | null>(null);
  const ekspedisiOvRowMenu = useRowMenu(ekspedisiOvItems);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceSearchInput, setInvoiceSearchInput] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceFilterBulan, setInvoiceFilterBulan] = useState("");
  const [invoiceUploaders, setInvoiceUploaders] = useState<{ id: number; nama: string }[]>([]);
  const [invoiceFilterUploader, setInvoiceFilterUploader] = useState<number | "">("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(10);
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false);
  const [invoiceRejectId, setInvoiceRejectId] = useState<number | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [invoiceUpdateTarget, setInvoiceUpdateTarget] = useState<Invoice | null>(null);
  const [invoiceHistoryId, setInvoiceHistoryId] = useState<number | null>(null);
  const [invoiceChatItem, setInvoiceChatItem] = useState<Invoice | null>(null);
  const invoiceSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleInvoiceSearchChange(value: string) {
    setInvoiceSearchInput(value);
    if (invoiceSearchDebounce.current) clearTimeout(invoiceSearchDebounce.current);
    invoiceSearchDebounce.current = setTimeout(() => {
      setInvoiceSearch(value.trim());
      setInvoicePage(1);
    }, 350);
  }
  const [bookingFilters, setBookingFilters] = useState<BookingFilterState>(EMPTY_BOOKING_FILTERS);
  const [bookingSearchInput, setBookingSearchInput] = useState("");
  const [bookingItems, setBookingItems] = useState<BookingRuang[]>([]);
  const [bookingTotal, setBookingTotal] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(true);
  const [bookingError, setBookingError] = useState("");
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  // "Ruang Meeting" (roster management, formerly its own top-level tab) folded in as a sub-tab
  // here instead - it's the room-side counterpart to this tab's own booking transactions.
  const [bookingRuangSubtab, setBookingRuangSubtab] = useState<"overview" | "transaksi" | "roster" | "calendar">("overview");
  // Room Booking tab's interactive-replica state - same idea as the Ekspedisi tab's above, but
  // mirroring booking-ruang-meeting/transaksi's own modals (Reschedule/Cancel, no Koreksi).
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingDetail, setBookingDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [bookingRescheduleTarget, setBookingRescheduleTarget] = useState<BookingRuang | null>(null);
  const [bookingStatusItemId, setBookingStatusItemId] = useState<number | null>(null);
  const [bookingChatItem, setBookingChatItem] = useState<BookingRuang | null>(null);
  const [bookingRejectTarget, setBookingRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [bookingCancelTargetId, setBookingCancelTargetId] = useState<number | null>(null);
  const bookingRowMenu = useRowMenu(bookingItems);

  // Overview sub-tab - mirrors booking-ruang-meeting/overview/page.tsx (room availability grid +
  // current-month queue), separate state from the Transaksi table above.
  const [bookingOvItems, setBookingOvItems] = useState<BookingRuang[]>([]);
  const [bookingOvTodayEntries, setBookingOvTodayEntries] = useState<BookingRuang[]>([]);
  const [bookingOvBusy, setBookingOvBusy] = useState(true);
  const [bookingOvStatusFilter, setBookingOvStatusFilter] = useState<"ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [bookingOvFormOpen, setBookingOvFormOpen] = useState(false);
  const [bookingOvFormInitial, setBookingOvFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [bookingOvInfoRoom, setBookingOvInfoRoom] = useState<RoomOption | null>(null);
  const [bookingOvDetail, setBookingOvDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [bookingOvRescheduleTarget, setBookingOvRescheduleTarget] = useState<BookingRuang | null>(null);
  const [bookingOvStatusItemId, setBookingOvStatusItemId] = useState<number | null>(null);
  const [bookingOvChatItem, setBookingOvChatItem] = useState<BookingRuang | null>(null);
  const [bookingOvRejectTarget, setBookingOvRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [bookingOvCancelTargetId, setBookingOvCancelTargetId] = useState<number | null>(null);
  const [, setBookingOvClockTick] = useState(0);
  const bookingOvRowMenu = useRowMenu(bookingOvItems);

  // Calendar sub-tab - separate state from the Transaksi table above since it's a wholly
  // different view (day/week/month grid + cross-room availability), mirroring
  // booking-ruang-meeting/calendar/page.tsx exactly.
  const [bookingCalView, setBookingCalView] = useState<CalendarViewMode>("avail");
  const [bookingCalRefDate, setBookingCalRefDate] = useState<string>(calTodayIso());
  const [bookingCalSelectedRoom, setBookingCalSelectedRoom] = useState("");
  const [bookingCalEntries, setBookingCalEntries] = useState<BookingRuang[]>([]);
  const [bookingCalAvailEntries, setBookingCalAvailEntries] = useState<BookingRuang[]>([]);
  const [bookingCalAvailBusy, setBookingCalAvailBusy] = useState(true);
  const [bookingCalScheduleBusy, setBookingCalScheduleBusy] = useState(true);
  const [bookingCalSearch, setBookingCalSearch] = useState("");
  const [bookingCalFormOpen, setBookingCalFormOpen] = useState(false);
  const [bookingCalFormInitial, setBookingCalFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [bookingCalDetail, setBookingCalDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [bookingCalRescheduleTarget, setBookingCalRescheduleTarget] = useState<BookingRuang | null>(null);
  const [bookingCalStatusItemId, setBookingCalStatusItemId] = useState<number | null>(null);
  const [bookingCalChatItem, setBookingCalChatItem] = useState<BookingRuang | null>(null);
  const [bookingCalRejectTarget, setBookingCalRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [bookingCalCancelTargetId, setBookingCalCancelTargetId] = useState<number | null>(null);
  const bookingCalRowMenu = useRowMenu(bookingCalView === "avail" ? bookingCalAvailEntries : bookingCalEntries);
  const bookingCalSidebarRef = useRef<HTMLDivElement>(null);
  const [bookingCalSidebarHeight, setBookingCalSidebarHeight] = useState<number | undefined>(undefined);

  const [kendaraanFilters, setKendaraanFilters] = useState<KendaraanFilterState>(EMPTY_KENDARAAN_FILTERS);
  const [kendaraanSearchInput, setKendaraanSearchInput] = useState("");
  const [kendaraanItems, setKendaraanItems] = useState<BookingKendaraan[]>([]);
  const [kendaraanTotal, setKendaraanTotal] = useState(0);
  const [kendaraanBusy, setKendaraanBusy] = useState(true);
  const [kendaraanError, setKendaraanError] = useState("");
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  // "Kendaraan" (roster management, formerly its own top-level tab) folded in as a sub-tab here
  // instead - it's the vehicle-side counterpart to this tab's own booking transactions.
  const [kendaraanSubtab, setKendaraanSubtab] = useState<"overview" | "transaksi" | "roster" | "calendar">("overview");
  // Vehicle Booking tab's interactive-replica state - mirrors booking-kendaraan/transaksi's own
  // modals (Reschedule/Cancel, no Koreksi).
  const [kendaraanFormOpen, setKendaraanFormOpen] = useState(false);
  const [kendaraanDetail, setKendaraanDetail] = useState<{ item: BookingKendaraan; mode: "view" | "edit" } | null>(null);
  const [kendaraanRescheduleTarget, setKendaraanRescheduleTarget] = useState<BookingKendaraan | null>(null);
  const [kendaraanStatusItemId, setKendaraanStatusItemId] = useState<number | null>(null);
  const [kendaraanChatItem, setKendaraanChatItem] = useState<BookingKendaraan | null>(null);
  const [kendaraanRejectTarget, setKendaraanRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [kendaraanCancelTargetId, setKendaraanCancelTargetId] = useState<number | null>(null);
  const kendaraanRowMenu = useRowMenu(kendaraanItems);

  // Overview sub-tab - mirrors booking-kendaraan/overview/page.tsx (vehicle availability grid +
  // current-month queue), separate state from the Transaksi table above.
  const [kendaraanOvItems, setKendaraanOvItems] = useState<BookingKendaraan[]>([]);
  const [kendaraanOvTodayEntries, setKendaraanOvTodayEntries] = useState<BookingKendaraan[]>([]);
  const [kendaraanOvBusy, setKendaraanOvBusy] = useState(true);
  const [kendaraanOvStatusFilter, setKendaraanOvStatusFilter] = useState<"ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [kendaraanOvFormOpen, setKendaraanOvFormOpen] = useState(false);
  const [kendaraanOvFormInitial, setKendaraanOvFormInitial] = useState<Partial<BookingKendaraanCreatePayload> | undefined>(undefined);
  const [kendaraanOvInfoVehicle, setKendaraanOvInfoVehicle] = useState<VehicleOption | null>(null);
  const [kendaraanOvDetail, setKendaraanOvDetail] = useState<{ item: BookingKendaraan; mode: "view" | "edit" } | null>(null);
  const [kendaraanOvRescheduleTarget, setKendaraanOvRescheduleTarget] = useState<BookingKendaraan | null>(null);
  const [kendaraanOvStatusItemId, setKendaraanOvStatusItemId] = useState<number | null>(null);
  const [kendaraanOvChatItem, setKendaraanOvChatItem] = useState<BookingKendaraan | null>(null);
  const [kendaraanOvRejectTarget, setKendaraanOvRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [kendaraanOvCancelTargetId, setKendaraanOvCancelTargetId] = useState<number | null>(null);
  const kendaraanOvRowMenu = useRowMenu(kendaraanOvItems);

  // Calendar sub-tab - separate state from the Transaksi table above, mirroring
  // booking-kendaraan/calendar/page.tsx exactly.
  const [kendaraanCalView, setKendaraanCalView] = useState<CalendarViewMode>("avail");
  const [kendaraanCalRefDate, setKendaraanCalRefDate] = useState<string>(calTodayIso());
  const [kendaraanCalSelectedVehicle, setKendaraanCalSelectedVehicle] = useState("");
  const [kendaraanCalRawEntries, setKendaraanCalRawEntries] = useState<BookingKendaraan[]>([]);
  const [kendaraanCalRawAvailEntries, setKendaraanCalRawAvailEntries] = useState<BookingKendaraan[]>([]);
  const [kendaraanCalAvailBusy, setKendaraanCalAvailBusy] = useState(true);
  const [kendaraanCalScheduleBusy, setKendaraanCalScheduleBusy] = useState(true);
  const [kendaraanCalSearch, setKendaraanCalSearch] = useState("");
  const [kendaraanCalMiniEntries, setKendaraanCalMiniEntries] = useState<BookingRuang[]>([]);
  const [kendaraanCalFormOpen, setKendaraanCalFormOpen] = useState(false);
  const [kendaraanCalFormInitial, setKendaraanCalFormInitial] = useState<Partial<BookingKendaraanCreatePayload> | undefined>(undefined);
  const [kendaraanCalDetail, setKendaraanCalDetail] = useState<{ item: BookingKendaraan; mode: "view" | "edit" } | null>(null);
  const [kendaraanCalRescheduleTarget, setKendaraanCalRescheduleTarget] = useState<BookingKendaraan | null>(null);
  const [kendaraanCalStatusItemId, setKendaraanCalStatusItemId] = useState<number | null>(null);
  const [kendaraanCalChatItem, setKendaraanCalChatItem] = useState<BookingKendaraan | null>(null);
  const [kendaraanCalRejectTarget, setKendaraanCalRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [kendaraanCalCancelTargetId, setKendaraanCalCancelTargetId] = useState<number | null>(null);
  const kendaraanCalRowMenu = useRowMenu(kendaraanCalView === "avail" ? kendaraanCalRawAvailEntries : kendaraanCalRawEntries);
  const kendaraanCalSidebarRef = useRef<HTMLDivElement>(null);
  const [kendaraanCalSidebarHeight, setKendaraanCalSidebarHeight] = useState<number | undefined>(undefined);

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
  // Archive tab now switches between Overview/Transaction/Repository via sub-tab buttons, same
  // pattern as Ekspedisi/ATK/Room/Vehicle Booking, instead of stacking both cards unconditionally.
  const [arsipSubtab, setArsipSubtab] = useState<"overview" | "transaksi" | "katalog">("overview");

  // Overview sub-tab - mirrors arsip/overview/page.tsx exactly.
  const [arsipOvItems, setArsipOvItems] = useState<PermintaanArsip[]>([]);
  const [arsipOvStats, setArsipOvStats] = useState<{
    waitingL1: number; waitingGa: number; waitingGaApproval: number; approved: number;
  } | null>(null);
  const [arsipOvBusy, setArsipOvBusy] = useState(true);
  const [arsipOvStatusFilter, setArsipOvStatusFilter] = useState<"ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [arsipOvFormOpen, setArsipOvFormOpen] = useState(false);
  const [arsipOvDetail, setArsipOvDetail] = useState<{ item: PermintaanArsip; mode: "view" | "edit" } | null>(null);
  const [arsipOvStatusItemId, setArsipOvStatusItemId] = useState<number | null>(null);
  const [arsipOvChatItem, setArsipOvChatItem] = useState<PermintaanArsip | null>(null);
  const [arsipOvRejectTarget, setArsipOvRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [arsipOvKoreksiTarget, setArsipOvKoreksiTarget] = useState<PermintaanArsip | null>(null);
  const arsipOvRowMenu = useRowMenu(arsipOvItems);

  // Repository (Katalog) tab - separate state from the Transaction table above since it's a
  // wholly different read-only endpoint/filter shape (see arsip/katalog/page.tsx).
  const [arsipKatalogFilters, setArsipKatalogFilters] = useState<ArsipKatalogFilterState>(EMPTY_ARSIP_KATALOG_FILTERS);
  const [arsipKatalogSearchInput, setArsipKatalogSearchInput] = useState("");
  const [arsipKatalogItems, setArsipKatalogItems] = useState<PermintaanArsipCatalogItem[]>([]);
  const [arsipKatalogTotal, setArsipKatalogTotal] = useState(0);
  const [arsipKatalogBusy, setArsipKatalogBusy] = useState(true);
  const [arsipKatalogError, setArsipKatalogError] = useState("");
  const [arsipKatalogFilterOpen, setArsipKatalogFilterOpen] = useState(false);
  const [arsipKatalogDetail, setArsipKatalogDetail] = useState<PermintaanArsip | null>(null);
  const [arsipKatalogStatusItemId, setArsipKatalogStatusItemId] = useState<number | null>(null);
  const [arsipKatalogChatItem, setArsipKatalogChatItem] = useState<PermintaanArsipCatalogItem | null>(null);
  const arsipKatalogRowMenu = useRowMenu(arsipKatalogItems);

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
  const [atkSubtab, setAtkSubtab] = useState<"overview" | "pesanan" | "invoice">("overview");

  // Overview sub-tab - mirrors office-supplies/overview/page.tsx exactly.
  const [atkOvItems, setAtkOvItems] = useState<PermintaanAtk[]>([]);
  const [atkOvStats, setAtkOvStats] = useState<{
    waitingL1: number; waitingGa: number; waitingGaApproval: number; waitingKpu: number; approved: number;
  } | null>(null);
  const [atkOvBusy, setAtkOvBusy] = useState(true);
  const [atkOvStatusFilter, setAtkOvStatusFilter] = useState<"ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [atkOvFormOpen, setAtkOvFormOpen] = useState(false);
  const [atkOvDetail, setAtkOvDetail] = useState<{ item: PermintaanAtk; mode: "view" | "edit" | "ga-edit" | "kpu-edit" } | null>(null);
  const [atkOvStatusItemId, setAtkOvStatusItemId] = useState<number | null>(null);
  const [atkOvChatItem, setAtkOvChatItem] = useState<PermintaanAtk | null>(null);
  const [atkOvRejectTarget, setAtkOvRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const atkOvRowMenu = useRowMenu(atkOvItems);
  const [atkInvoices, setAtkInvoices] = useState<Invoice[] | null>(null);
  const [atkInvoiceTotal, setAtkInvoiceTotal] = useState(0);
  const [atkInvoiceError, setAtkInvoiceError] = useState("");
  const [atkInvoiceSearchInput, setAtkInvoiceSearchInput] = useState("");
  const [atkInvoiceSearch, setAtkInvoiceSearch] = useState("");
  const [atkInvoiceFilterBulan, setAtkInvoiceFilterBulan] = useState("");
  const [atkInvoiceUploaders, setAtkInvoiceUploaders] = useState<{ id: number; nama: string }[]>([]);
  const [atkInvoiceFilterUploader, setAtkInvoiceFilterUploader] = useState<number | "">("");
  const [atkInvoicePage, setAtkInvoicePage] = useState(1);
  const [atkInvoiceLimit, setAtkInvoiceLimit] = useState(10);
  const [atkInvoiceUploadOpen, setAtkInvoiceUploadOpen] = useState(false);
  const [atkInvoiceRejectId, setAtkInvoiceRejectId] = useState<number | null>(null);
  const [atkInvoiceDetail, setAtkInvoiceDetail] = useState<Invoice | null>(null);
  const [atkInvoiceUpdateTarget, setAtkInvoiceUpdateTarget] = useState<Invoice | null>(null);
  const [atkInvoiceHistoryId, setAtkInvoiceHistoryId] = useState<number | null>(null);
  const [atkInvoiceChatItem, setAtkInvoiceChatItem] = useState<Invoice | null>(null);
  const atkInvoiceRowMenu = useRowMenu(atkInvoices ?? []);
  const atkInvoiceSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleAtkInvoiceSearchChange(value: string) {
    setAtkInvoiceSearchInput(value);
    if (atkInvoiceSearchDebounce.current) clearTimeout(atkInvoiceSearchDebounce.current);
    atkInvoiceSearchDebounce.current = setTimeout(() => {
      setAtkInvoiceSearch(value.trim());
      setAtkInvoicePage(1);
    }, 350);
  }

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
  // Maintenance tab now switches between Overview/Transaction/Repository via sub-tab buttons,
  // same pattern as Ekspedisi/ATK/Room/Vehicle Booking.
  const [saranaSubtab, setSaranaSubtab] = useState<"overview" | "transaksi" | "katalog">("overview");

  // Pressing a module in the sidebar always lands on that module's own Overview sub-tab, even if
  // a previous visit had left it on Transaction/Calendar/etc. - this only fires on an actual
  // module switch (activeTab changing), not on re-renders while already on the module.
  useEffect(() => {
    if (activeTab === "ekspedisi") setEkspedisiSubtab("overview");
    else if (activeTab === "booking-ruang") setBookingRuangSubtab("overview");
    else if (activeTab === "booking-kendaraan") setKendaraanSubtab("overview");
    else if (activeTab === "atk") setAtkSubtab("overview");
    else if (activeTab === "sarana") setSaranaSubtab("overview");
    else if (activeTab === "arsip") setArsipSubtab("overview");
  }, [activeTab]);

  // Overview sub-tab - mirrors maintenance/overview/page.tsx exactly.
  const [saranaOvItems, setSaranaOvItems] = useState<PerbaikanSarana[]>([]);
  const [saranaOvStats, setSaranaOvStats] = useState<{
    waitingL1: number; waitingGa: number; waitingGaApproval: number; approved: number;
    execMenunggu: number; execLokasiDicek: number; execGambarDibuat: number;
  } | null>(null);
  const [saranaOvBusy, setSaranaOvBusy] = useState(true);
  const [saranaOvStatusFilter, setSaranaOvStatusFilter] = useState<"ALL" | "DRAFT" | "ON_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [saranaOvFormOpen, setSaranaOvFormOpen] = useState(false);
  const [saranaOvDetail, setSaranaOvDetail] = useState<{ item: PerbaikanSarana; mode: "view" | "edit" } | null>(null);
  const [saranaOvStatusItemId, setSaranaOvStatusItemId] = useState<number | null>(null);
  const [saranaOvChatItem, setSaranaOvChatItem] = useState<PerbaikanSarana | null>(null);
  const [saranaOvRejectTarget, setSaranaOvRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [saranaOvKoreksiTarget, setSaranaOvKoreksiTarget] = useState<PerbaikanSarana | null>(null);
  const saranaOvRowMenu = useRowMenu(saranaOvItems);

  // Repository (Katalog) tab - separate state from the Transaction table above since it's a
  // wholly different read-only endpoint/filter shape (see maintenance/katalog/page.tsx).
  const [saranaKatalogFilters, setSaranaKatalogFilters] = useState<SaranaKatalogFilterState>(EMPTY_SARANA_KATALOG_FILTERS);
  const [saranaKatalogSearchInput, setSaranaKatalogSearchInput] = useState("");
  const [saranaKatalogItems, setSaranaKatalogItems] = useState<PerbaikanSaranaCatalogItem[]>([]);
  const [saranaKatalogTotal, setSaranaKatalogTotal] = useState(0);
  const [saranaKatalogBusy, setSaranaKatalogBusy] = useState(true);
  const [saranaKatalogError, setSaranaKatalogError] = useState("");
  const [saranaKatalogFilterOpen, setSaranaKatalogFilterOpen] = useState(false);
  const [saranaKatalogDetail, setSaranaKatalogDetail] = useState<PerbaikanSarana | null>(null);
  const [saranaKatalogStatusItemId, setSaranaKatalogStatusItemId] = useState<number | null>(null);
  const [saranaKatalogChatItem, setSaranaKatalogChatItem] = useState<PerbaikanSaranaCatalogItem | null>(null);
  const saranaKatalogRowMenu = useRowMenu(saranaKatalogItems);

  const invoiceRowMenu = useRowMenu(invoices ?? []);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const atkFilterWrapRef = useRef<HTMLDivElement>(null);
  const saranaFilterWrapRef = useRef<HTMLDivElement>(null);
  const bookingFilterWrapRef = useRef<HTMLDivElement>(null);
  const kendaraanFilterWrapRef = useRef<HTMLDivElement>(null);
  const [atkFilterOpen, setAtkFilterOpen] = useState(false);
  const [saranaFilterOpen, setSaranaFilterOpen] = useState(false);
  const [bookingFilterOpen, setBookingFilterOpen] = useState(false);
  const [kendaraanFilterOpen, setKendaraanFilterOpen] = useState(false);
  const [arsipFilterOpen, setArsipFilterOpen] = useState(false);
  useExclusivePanel(arsipFilterOpen, () => setArsipFilterOpen(false));
  useExclusivePanel(atkFilterOpen, () => setAtkFilterOpen(false));
  useExclusivePanel(saranaFilterOpen, () => setSaranaFilterOpen(false));
  useExclusivePanel(bookingFilterOpen, () => setBookingFilterOpen(false));
  useExclusivePanel(kendaraanFilterOpen, () => setKendaraanFilterOpen(false));
  useExclusivePanel(arsipKatalogFilterOpen, () => setArsipKatalogFilterOpen(false));
  useExclusivePanel(saranaKatalogFilterOpen, () => setSaranaKatalogFilterOpen(false));
  const tableReqIdRef = useRef(0);
  const invoiceReqIdRef = useRef(0);
  const atkInvoiceReqIdRef = useRef(0);
  const bookingReqIdRef = useRef(0);
  const kendaraanReqIdRef = useRef(0);
  const arsipSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arsipReqIdRef = useRef(0);
  const arsipFilterWrapRef = useRef<HTMLDivElement>(null);
  const arsipKatalogFilterWrapRef = useRef<HTMLDivElement>(null);
  const arsipKatalogSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arsipKatalogReqIdRef = useRef(0);
  const atkSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atkReqIdRef = useRef(0);
  const bookingSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kendaraanSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saranaSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saranaReqIdRef = useRef(0);
  const saranaKatalogFilterWrapRef = useRef<HTMLDivElement>(null);
  const saranaKatalogSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saranaKatalogReqIdRef = useRef(0);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);
  useClickOutside([bookingFilterWrapRef], () => setBookingFilterOpen(false), bookingFilterOpen);
  useClickOutside([kendaraanFilterWrapRef], () => setKendaraanFilterOpen(false), kendaraanFilterOpen);
  useClickOutside([atkFilterWrapRef], () => setAtkFilterOpen(false), atkFilterOpen);
  useClickOutside([saranaFilterWrapRef], () => setSaranaFilterOpen(false), saranaFilterOpen);
  useClickOutside([arsipFilterWrapRef], () => setArsipFilterOpen(false), arsipFilterOpen);
  useClickOutside([arsipKatalogFilterWrapRef], () => setArsipKatalogFilterOpen(false), arsipKatalogFilterOpen);
  useClickOutside([saranaKatalogFilterWrapRef], () => setSaranaKatalogFilterOpen(false), saranaKatalogFilterOpen);

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

  // Overview sub-tab - loads only while that sub-tab is active, mirroring
  // ekspedisi/overview/page.tsx's own load() (current month's queue + this year's stat tiles).
  const loadEkspedisiOverview = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "ekspedisi" || ekspedisiSubtab !== "overview") return;
    if (!opts?.silent) setEkspedisiOvBusy(true);
    try {
      const bulan = currentYearMonth();
      const [queue, statsResp] = await Promise.all([
        api.listPengiriman({ limit: 1000, page: 1, bulan }).then((r) => r.items),
        api.getPengirimanStats(currentYear()),
      ]);
      const counts = statsResp.countsByStatus;
      setEkspedisiOvItems(queue);
      setEkspedisiOvStats({
        waitingL1: statsResp.waitingL1,
        waitingGa: statsResp.waitingGa,
        waitingGaApproval: statsResp.waitingGaApproval,
        waitingKpu: statsResp.waitingKpu,
        completed: counts.COMPLETED ?? 0,
      });
    } finally {
      if (!opts?.silent) setEkspedisiOvBusy(false);
    }
  }, [activeTab, ekspedisiSubtab]);

  useEffect(() => {
    loadEkspedisiOverview();
  }, [loadEkspedisiOverview]);

  const ekspedisiOvFilteredItems = (() => {
    if (ekspedisiOvStatusFilter === "ALL") return ekspedisiOvItems;
    if (ekspedisiOvStatusFilter === "DRAFT") return ekspedisiOvItems.filter((i) => i.status === "DRAFT");
    if (ekspedisiOvStatusFilter === "APPROVED") return ekspedisiOvItems.filter((i) => i.status === "COMPLETED");
    if (ekspedisiOvStatusFilter === "ON_APPROVAL") return ekspedisiOvItems.filter((i) => ON_APPROVAL_STATUSES.includes(i.status));
    return ekspedisiOvItems.filter((i) => REJECTED_STATUSES.includes(i.status));
  })();

  function ekspedisiOvHandleDelete(item: Pengiriman) {
    confirm("Hapus data pengiriman ini secara permanen?", async () => {
      try {
        await api.deletePengiriman(item.id);
        showToast("Data berhasil dihapus");
        loadEkspedisiOverview();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const loadInvoices = useCallback(async () => {
    const reqId = ++invoiceReqIdRef.current;
    try {
      const result = await api.listInvoice({
        page: invoicePage,
        limit: invoiceLimit,
        bulan: invoiceFilterBulan,
        search: invoiceSearch,
        uploadedBy: invoiceFilterUploader === "" ? undefined : invoiceFilterUploader,
      });
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
  }, [invoicePage, invoiceLimit, invoiceFilterBulan, invoiceSearch, invoiceFilterUploader]);

  useEffect(() => {
    if (activeTab !== "ekspedisi") return;
    api.listInvoiceUploaders().then(setInvoiceUploaders).catch(() => setInvoiceUploaders([]));
  }, [activeTab]);

  const loadAtkInvoices = useCallback(async () => {
    const reqId = ++atkInvoiceReqIdRef.current;
    try {
      const result = await api.listAtkInvoice({
        page: atkInvoicePage,
        limit: atkInvoiceLimit,
        bulan: atkInvoiceFilterBulan,
        search: atkInvoiceSearch,
        uploadedBy: atkInvoiceFilterUploader === "" ? undefined : atkInvoiceFilterUploader,
      });
      if (reqId !== atkInvoiceReqIdRef.current) return;
      const invoiceItems = result?.items ?? [];
      const invoiceTotalCount = result?.total ?? 0;
      if (invoiceItems.length === 0 && invoiceTotalCount > 0 && atkInvoicePage > 1) {
        setAtkInvoicePage((p) => p - 1);
        return;
      }
      setAtkInvoices(invoiceItems);
      setAtkInvoiceTotal(invoiceTotalCount);
    } catch (err) {
      if (reqId !== atkInvoiceReqIdRef.current) return;
      setAtkInvoiceError((err as Error).message);
    }
  }, [atkInvoicePage, atkInvoiceLimit, atkInvoiceFilterBulan, atkInvoiceSearch, atkInvoiceFilterUploader]);

  useEffect(() => {
    if (activeTab !== "atk") return;
    api.listAtkInvoiceUploaders().then(setAtkInvoiceUploaders).catch(() => setAtkInvoiceUploaders([]));
  }, [activeTab]);

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
        bulan: bookingFilters.bulan,
        status: bookingFilters.status,
        divisi: bookingFilters.divisi,
        departemen: bookingFilters.departemen,
        direktorat: bookingFilters.direktorat,
        namaRuang: bookingFilters.namaRuang,
        search: bookingFilters.search,
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

  // Overview sub-tab - mirrors booking-ruang-meeting/overview/page.tsx's load() (current+future
  // month queue + today's schedule for the room availability grid).
  const loadBookingOverview = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "booking-ruang" || bookingRuangSubtab !== "overview") return;
    if (!opts?.silent) setBookingOvBusy(true);
    try {
      const queue = await api.listBooking({ limit: 1000, page: 1, sejakBulan: currentYearMonth() }).then((r) => r.items);
      setBookingOvItems(queue);
      const today = await api.getBookingSchedule(todayLocalDate()).catch(() => []);
      setBookingOvTodayEntries(today);
    } finally {
      if (!opts?.silent) setBookingOvBusy(false);
    }
  }, [activeTab, bookingRuangSubtab]);

  useEffect(() => {
    loadBookingOverview();
  }, [loadBookingOverview]);

  useEffect(() => {
    const id = setInterval(() => setBookingOvClockTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const bookingOvFilteredItems = (() => {
    if (bookingOvStatusFilter === "ALL") return bookingOvItems;
    if (bookingOvStatusFilter === "DRAFT") return bookingOvItems.filter((i) => i.status === "DRAFT");
    if (bookingOvStatusFilter === "APPROVED") return bookingOvItems.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (bookingOvStatusFilter === "ON_APPROVAL") return bookingOvItems.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    return bookingOvItems.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status) || i.status === "CANCELLED");
  })();

  function bookingOvHandleDelete(item: BookingRuang) {
    const message = item.seriesId
      ? "Booking ini bagian dari jadwal berulang\nmenghapusnya akan menghapus seluruh jadwal"
      : "Hapus booking ruangan ini secara permanen?";
    confirm(message, async () => {
      try {
        await api.deleteBooking(item.id);
        showToast("Booking berhasil dihapus");
        loadBookingOverview();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

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
        bulan: kendaraanFilters.bulan,
        status: kendaraanFilters.status,
        divisi: kendaraanFilters.divisi,
        departemen: kendaraanFilters.departemen,
        direktorat: kendaraanFilters.direktorat,
        namaKendaraan: kendaraanFilters.namaKendaraan,
        search: kendaraanFilters.search,
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

  // Overview sub-tab - mirrors booking-kendaraan/overview/page.tsx's load().
  const loadKendaraanOverview = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "booking-kendaraan" || kendaraanSubtab !== "overview") return;
    if (!opts?.silent) setKendaraanOvBusy(true);
    try {
      const queue = await api.listKendaraanBooking({ limit: 1000, page: 1, sejakBulan: currentYearMonth() }).then((r) => r.items);
      setKendaraanOvItems(queue);
      const today = await api.getKendaraanSchedule(todayLocalDate()).catch(() => []);
      setKendaraanOvTodayEntries(today);
    } finally {
      if (!opts?.silent) setKendaraanOvBusy(false);
    }
  }, [activeTab, kendaraanSubtab]);

  useEffect(() => {
    loadKendaraanOverview();
  }, [loadKendaraanOverview]);

  const kendaraanOvFilteredItems = (() => {
    if (kendaraanOvStatusFilter === "ALL") return kendaraanOvItems;
    if (kendaraanOvStatusFilter === "DRAFT") return kendaraanOvItems.filter((i) => i.status === "DRAFT");
    if (kendaraanOvStatusFilter === "APPROVED") return kendaraanOvItems.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (kendaraanOvStatusFilter === "ON_APPROVAL") return kendaraanOvItems.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    return kendaraanOvItems.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status) || i.status === "CANCELLED");
  })();

  function kendaraanOvHandleDelete(item: BookingKendaraan) {
    confirm("Hapus booking kendaraan ini secara permanen?", async () => {
      try {
        await api.deleteKendaraanBooking(item.id);
        showToast("Booking berhasil dihapus");
        loadKendaraanOverview();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  // Room Booking Calendar sub-tab - loads only while that sub-tab is active, mirroring
  // booking-ruang-meeting/calendar/page.tsx's loadSchedule/loadAvail.
  const loadBookingCalSchedule = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "booking-ruang" || bookingRuangSubtab !== "calendar") return;
    if (!bookingCalSelectedRoom || bookingCalView === "avail") return;
    if (!opts?.silent) setBookingCalScheduleBusy(true);
    try {
      const { from, to } = calRangeForView(bookingCalView, bookingCalRefDate);
      const data = await api.getBookingScheduleRange(from, to, bookingCalSelectedRoom);
      setBookingCalEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBookingCalScheduleBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, bookingRuangSubtab, bookingCalView, bookingCalRefDate, bookingCalSelectedRoom]);

  useEffect(() => {
    loadBookingCalSchedule();
  }, [loadBookingCalSchedule]);

  const loadBookingCalAvail = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "booking-ruang" || bookingRuangSubtab !== "calendar" || bookingCalView !== "avail") return;
    if (!opts?.silent) setBookingCalAvailBusy(true);
    try {
      const data = await api.getBookingSchedule(bookingCalRefDate);
      setBookingCalAvailEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBookingCalAvailBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, bookingRuangSubtab, bookingCalView, bookingCalRefDate]);

  useEffect(() => {
    loadBookingCalAvail();
  }, [loadBookingCalAvail]);

  useEffect(() => {
    if (bookingRuangSubtab === "calendar" && !bookingCalSelectedRoom && rooms.length > 0) {
      setBookingCalSelectedRoom(rooms[0].nama);
    }
  }, [bookingRuangSubtab, bookingCalSelectedRoom, rooms]);

  useEffect(() => {
    const el = bookingCalSidebarRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBookingCalSidebarHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bookingCalReload = bookingCalView === "avail" ? loadBookingCalAvail : loadBookingCalSchedule;

  // Vehicle Booking Calendar sub-tab - mirrors booking-kendaraan/calendar/page.tsx's
  // loadSchedule/loadAvail/loadMiniEntries.
  const loadKendaraanCalSchedule = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "booking-kendaraan" || kendaraanSubtab !== "calendar") return;
    if (!kendaraanCalSelectedVehicle || kendaraanCalView === "avail") return;
    if (!opts?.silent) setKendaraanCalScheduleBusy(true);
    try {
      const { from, to } = calRangeForView(kendaraanCalView, kendaraanCalRefDate);
      const data = await api.getKendaraanScheduleRange(from, to, kendaraanCalSelectedVehicle);
      setKendaraanCalRawEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setKendaraanCalScheduleBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, kendaraanSubtab, kendaraanCalView, kendaraanCalRefDate, kendaraanCalSelectedVehicle]);

  useEffect(() => {
    loadKendaraanCalSchedule();
  }, [loadKendaraanCalSchedule]);

  const loadKendaraanCalAvail = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "booking-kendaraan" || kendaraanSubtab !== "calendar" || kendaraanCalView !== "avail") return;
    if (!opts?.silent) setKendaraanCalAvailBusy(true);
    try {
      const data = await api.getKendaraanSchedule(kendaraanCalRefDate);
      setKendaraanCalRawAvailEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setKendaraanCalAvailBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, kendaraanSubtab, kendaraanCalView, kendaraanCalRefDate]);

  useEffect(() => {
    loadKendaraanCalAvail();
  }, [loadKendaraanCalAvail]);

  const loadKendaraanCalMiniEntries = useCallback(async () => {
    if (activeTab !== "booking-kendaraan" || kendaraanSubtab !== "calendar" || !kendaraanCalSelectedVehicle) return;
    try {
      const { from, to } = calMonthGridRange(kendaraanCalRefDate);
      const data = await api.getKendaraanScheduleRange(from, to, kendaraanCalSelectedVehicle);
      setKendaraanCalMiniEntries(data.map(kendaraanAsBookingRuangShape));
    } catch {
      setKendaraanCalMiniEntries([]);
    }
  }, [activeTab, kendaraanSubtab, kendaraanCalRefDate, kendaraanCalSelectedVehicle]);

  useEffect(() => {
    loadKendaraanCalMiniEntries();
  }, [loadKendaraanCalMiniEntries]);

  useEffect(() => {
    if (kendaraanSubtab === "calendar" && !kendaraanCalSelectedVehicle && vehicles.length > 0) {
      setKendaraanCalSelectedVehicle(vehicles[0].nama);
    }
  }, [kendaraanSubtab, kendaraanCalSelectedVehicle, vehicles]);

  useEffect(() => {
    const el = kendaraanCalSidebarRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setKendaraanCalSidebarHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function kendaraanCalReloadAll(opts?: { silent?: boolean }) {
    if (kendaraanCalView === "avail") loadKendaraanCalAvail(opts);
    else loadKendaraanCalSchedule(opts);
    if (!opts?.silent) loadKendaraanCalMiniEntries();
  }

  const kendaraanCalEntries = kendaraanCalRawEntries.map(kendaraanAsBookingRuangShape);
  const kendaraanCalAvailEntries = kendaraanCalRawAvailEntries.map(kendaraanAsBookingRuangShape);

  const bookingCalFilteredEntries = (() => {
    const q = bookingCalSearch.trim().toLowerCase();
    const list = bookingCalEntries;
    if (!q) return list;
    return list.filter((e) =>
      (e.nomorPemesanan || "").toLowerCase().includes(q)
      || e.namaKegiatan.toLowerCase().includes(q)
      || (e.departemen || "").toLowerCase().includes(q)
      || (e.divisi || "").toLowerCase().includes(q)
    );
  })();

  const bookingCalFilteredAvailEntries = (() => {
    const q = bookingCalSearch.trim().toLowerCase();
    const list = bookingCalAvailEntries;
    if (!q) return list;
    return list.filter((e) =>
      (e.nomorPemesanan || "").toLowerCase().includes(q)
      || e.namaKegiatan.toLowerCase().includes(q)
      || (e.departemen || "").toLowerCase().includes(q)
      || (e.divisi || "").toLowerCase().includes(q)
    );
  })();

  const kendaraanCalFilteredEntries = (() => {
    const q = kendaraanCalSearch.trim().toLowerCase();
    const list = kendaraanCalEntries;
    if (!q) return list;
    return list.filter((e) =>
      (e.nomorPemesanan || "").toLowerCase().includes(q)
      || e.namaKegiatan.toLowerCase().includes(q)
      || (e.departemen || "").toLowerCase().includes(q)
      || (e.divisi || "").toLowerCase().includes(q)
    );
  })();

  const kendaraanCalFilteredAvailEntries = (() => {
    const q = kendaraanCalSearch.trim().toLowerCase();
    const list = kendaraanCalAvailEntries;
    if (!q) return list;
    return list.filter((e) =>
      (e.nomorPemesanan || "").toLowerCase().includes(q)
      || e.namaKegiatan.toLowerCase().includes(q)
      || (e.departemen || "").toLowerCase().includes(q)
      || (e.divisi || "").toLowerCase().includes(q)
    );
  })();

  function bookingCalGoToday() { setBookingCalRefDate(calTodayIso()); }
  function bookingCalGoPrev() {
    if (bookingCalView === "week") setBookingCalRefDate((d) => addDays(d, -7));
    else if (bookingCalView === "month") setBookingCalRefDate((d) => addMonths(d, -1));
    else setBookingCalRefDate((d) => addDays(d, -1));
  }
  function bookingCalGoNext() {
    if (bookingCalView === "week") setBookingCalRefDate((d) => addDays(d, 7));
    else if (bookingCalView === "month") setBookingCalRefDate((d) => addMonths(d, 1));
    else setBookingCalRefDate((d) => addDays(d, 1));
  }
  function bookingCalOpenCreateForm() {
    setBookingCalFormInitial({ namaRuang: bookingCalSelectedRoom, tanggal: bookingCalRefDate });
    setBookingCalFormOpen(true);
  }
  function bookingCalHandleDelete(item: BookingRuang) {
    const message = item.seriesId
      ? "Booking ini bagian dari jadwal berulang\nmenghapusnya akan menghapus seluruh jadwal"
      : "Hapus booking ruangan ini secara permanen?";
    confirm(message, async () => {
      try {
        await api.deleteBooking(item.id);
        showToast("Booking berhasil dihapus");
        bookingCalReload();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  function kendaraanCalGoToday() { setKendaraanCalRefDate(calTodayIso()); }
  function kendaraanCalGoPrev() {
    if (kendaraanCalView === "week") setKendaraanCalRefDate((d) => addDays(d, -7));
    else if (kendaraanCalView === "month") setKendaraanCalRefDate((d) => addMonths(d, -1));
    else setKendaraanCalRefDate((d) => addDays(d, -1));
  }
  function kendaraanCalGoNext() {
    if (kendaraanCalView === "week") setKendaraanCalRefDate((d) => addDays(d, 7));
    else if (kendaraanCalView === "month") setKendaraanCalRefDate((d) => addMonths(d, 1));
    else setKendaraanCalRefDate((d) => addDays(d, 1));
  }
  function kendaraanCalOpenCreateForm() {
    setKendaraanCalFormInitial({ namaKendaraan: kendaraanCalSelectedVehicle, tanggal: kendaraanCalRefDate });
    setKendaraanCalFormOpen(true);
  }
  function kendaraanCalHandleDelete(item: BookingKendaraan) {
    confirm("Hapus booking kendaraan ini secara permanen?", async () => {
      try {
        await api.deleteKendaraanBooking(item.id);
        showToast("Booking berhasil dihapus");
        kendaraanCalReloadAll();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

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
        tanggal: arsipFilters.tanggal,
        status: arsipFilters.status,
        kategori: arsipFilters.kategori,
        divisi: arsipFilters.divisi,
        departemen: arsipFilters.departemen,
        direktorat: arsipFilters.direktorat,
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

  // Overview sub-tab - mirrors arsip/overview/page.tsx's load().
  const loadArsipOverview = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "arsip" || arsipSubtab !== "overview") return;
    if (!opts?.silent) setArsipOvBusy(true);
    try {
      const bulan = currentYearMonth();
      const [queue, statsResp] = await Promise.all([
        api.listArsip({ limit: 1000, page: 1, bulan }).then((r) => r.items),
        api.getArsipStats(currentYear()),
      ]);
      const counts = statsResp.countsByStatus;
      setArsipOvItems(queue);
      setArsipOvStats({
        waitingL1: counts.SUBMITTED ?? 0,
        waitingGa: counts.APPROVED_L1 ?? 0,
        waitingGaApproval: counts.APPROVED_GA ?? 0,
        approved: counts.APPROVED_GA_APPROVAL ?? 0,
      });
    } finally {
      if (!opts?.silent) setArsipOvBusy(false);
    }
  }, [activeTab, arsipSubtab]);

  useEffect(() => {
    loadArsipOverview();
  }, [loadArsipOverview]);

  const arsipOvFilteredItems = (() => {
    if (arsipOvStatusFilter === "ALL") return arsipOvItems;
    if (arsipOvStatusFilter === "DRAFT") return arsipOvItems.filter((i) => i.status === "DRAFT");
    if (arsipOvStatusFilter === "APPROVED") return arsipOvItems.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (arsipOvStatusFilter === "ON_APPROVAL") return arsipOvItems.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    return arsipOvItems.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status));
  })();

  function arsipOvHandleDelete(item: PermintaanArsip) {
    confirm("Hapus Pemindahan Arsip ini secara permanen?", async () => {
      try {
        await api.deleteArsip(item.id);
        showToast("Pemindahan berhasil dihapus");
        loadArsipOverview();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const loadArsipKatalog = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++arsipKatalogReqIdRef.current;
    if (!opts?.silent) {
      setArsipKatalogBusy(true);
      setArsipKatalogError("");
    }
    try {
      const result = await api.getArsipCatalog({
        page: arsipKatalogFilters.page,
        limit: arsipKatalogFilters.limit,
        search: arsipKatalogFilters.search,
        kategori: arsipKatalogFilters.kategori,
        divisi: arsipKatalogFilters.divisi,
        departemen: arsipKatalogFilters.departemen,
        direktorat: arsipKatalogFilters.direktorat,
        bulan: arsipKatalogFilters.bulan,
        tanggal: arsipKatalogFilters.tanggal,
      });
      if (reqId !== arsipKatalogReqIdRef.current) return;
      const itemsResult = result?.items ?? [];
      const totalResult = result?.total ?? 0;
      if (itemsResult.length === 0 && totalResult > 0 && arsipKatalogFilters.page > 1) {
        setArsipKatalogFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setArsipKatalogItems(itemsResult);
      setArsipKatalogTotal(totalResult);
    } catch (err) {
      if (reqId !== arsipKatalogReqIdRef.current) return;
      if (!opts?.silent) setArsipKatalogError((err as Error).message);
    } finally {
      if (reqId === arsipKatalogReqIdRef.current && !opts?.silent) setArsipKatalogBusy(false);
    }
  }, [arsipKatalogFilters]);

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

  // Overview sub-tab - mirrors office-supplies/overview/page.tsx's load().
  const loadAtkOverview = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "atk" || atkSubtab !== "overview") return;
    if (!opts?.silent) setAtkOvBusy(true);
    try {
      const bulan = currentYearMonth();
      const [queue, statsResp] = await Promise.all([
        api.listAtk({ limit: 1000, page: 1, bulan }).then((r) => r.items),
        api.getAtkStats(currentYear()),
      ]);
      const counts = statsResp.countsByStatus;
      setAtkOvItems(queue);
      setAtkOvStats({
        waitingL1: counts.SUBMITTED ?? 0,
        waitingGa: counts.APPROVED_L1 ?? 0,
        waitingGaApproval: counts.APPROVED_GA ?? 0,
        waitingKpu: counts.APPROVED_GA_APPROVAL ?? 0,
        approved: counts.COMPLETED ?? 0,
      });
    } finally {
      if (!opts?.silent) setAtkOvBusy(false);
    }
  }, [activeTab, atkSubtab]);

  useEffect(() => {
    loadAtkOverview();
  }, [loadAtkOverview]);

  const atkOvFilteredItems = (() => {
    if (atkOvStatusFilter === "ALL") return atkOvItems;
    if (atkOvStatusFilter === "DRAFT") return atkOvItems.filter((i) => i.status === "DRAFT");
    if (atkOvStatusFilter === "APPROVED") return atkOvItems.filter((i) => i.status === "COMPLETED");
    if (atkOvStatusFilter === "ON_APPROVAL") return atkOvItems.filter((i) => ON_APPROVAL_STATUSES.includes(i.status));
    return atkOvItems.filter((i) => REJECTED_STATUSES.includes(i.status));
  })();

  function atkOvHandleDelete(item: PermintaanAtk) {
    confirm("Hapus Pesanan Kebutuhan Kantor ini secara permanen?", async () => {
      try {
        await api.deleteAtk(item.id);
        showToast("Pesanan berhasil dihapus");
        loadAtkOverview();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

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

  // Overview sub-tab - mirrors maintenance/overview/page.tsx's load() (merges the current
  // month's queue with any still-executing approved report from an earlier month).
  const loadSaranaOverview = useCallback(async (opts?: { silent?: boolean }) => {
    if (activeTab !== "sarana" || saranaSubtab !== "overview") return;
    if (!opts?.silent) setSaranaOvBusy(true);
    try {
      const bulan = currentYearMonth();
      const [queue, activeExecuting, statsResp] = await Promise.all([
        api.listSarana({ limit: 1000, page: 1, bulan }).then((r) => r.items),
        api.listSarana({ limit: 1000, page: 1, status: "APPROVED_GA_APPROVAL" }).then((r) => r.items.filter((i) => i.executionStage !== "SELESAI")),
        api.getSaranaStats(currentYear()),
      ]);
      const merged = new Map<number, PerbaikanSarana>();
      for (const item of queue) merged.set(item.id, item);
      for (const item of activeExecuting) merged.set(item.id, item);
      const combined = Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const counts = statsResp.countsByStatus;
      const execCounts = statsResp.executionStageCounts;
      setSaranaOvItems(combined);
      setSaranaOvStats({
        waitingL1: counts.SUBMITTED ?? 0,
        waitingGa: counts.APPROVED_L1 ?? 0,
        waitingGaApproval: counts.APPROVED_GA ?? 0,
        approved: counts.APPROVED_GA_APPROVAL ?? 0,
        execMenunggu: execCounts.MENUNGGU ?? 0,
        execLokasiDicek: execCounts.LOKASI_DICEK ?? 0,
        execGambarDibuat: execCounts.GAMBAR_DIBUAT ?? 0,
      });
    } finally {
      if (!opts?.silent) setSaranaOvBusy(false);
    }
  }, [activeTab, saranaSubtab]);

  useEffect(() => {
    loadSaranaOverview();
  }, [loadSaranaOverview]);

  const saranaOvFilteredItems = (() => {
    if (saranaOvStatusFilter === "ALL") return saranaOvItems;
    if (saranaOvStatusFilter === "DRAFT") return saranaOvItems.filter((i) => i.status === "DRAFT");
    if (saranaOvStatusFilter === "APPROVED") return saranaOvItems.filter((i) => i.status === "APPROVED_GA_APPROVAL");
    if (saranaOvStatusFilter === "ON_APPROVAL") return saranaOvItems.filter((i) => BOOKING_ON_APPROVAL_STATUSES.includes(i.status));
    return saranaOvItems.filter((i) => BOOKING_REJECTED_STATUSES.includes(i.status));
  })();

  function saranaOvHandleDelete(item: PerbaikanSarana) {
    confirm("Hapus Pengajuan Perbaikan ini secara permanen?", async () => {
      try {
        await api.deleteSarana(item.id);
        showToast("Pengajuan berhasil dihapus");
        loadSaranaOverview();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const loadSaranaKatalog = useCallback(async (opts?: { silent?: boolean }) => {
    const reqId = ++saranaKatalogReqIdRef.current;
    if (!opts?.silent) {
      setSaranaKatalogBusy(true);
      setSaranaKatalogError("");
    }
    try {
      const result = await api.getSaranaCatalog({
        page: saranaKatalogFilters.page,
        limit: saranaKatalogFilters.limit,
        search: saranaKatalogFilters.search,
        kategori: saranaKatalogFilters.kategori,
        divisi: saranaKatalogFilters.divisi,
        departemen: saranaKatalogFilters.departemen,
        direktorat: saranaKatalogFilters.direktorat,
        bulan: saranaKatalogFilters.bulan,
        tanggal: saranaKatalogFilters.tanggal,
      });
      if (reqId !== saranaKatalogReqIdRef.current) return;
      const itemsResult = result?.items ?? [];
      const totalResult = result?.total ?? 0;
      if (itemsResult.length === 0 && totalResult > 0 && saranaKatalogFilters.page > 1) {
        setSaranaKatalogFilters((f) => ({ ...f, page: f.page - 1 }));
        return;
      }
      setSaranaKatalogItems(itemsResult);
      setSaranaKatalogTotal(totalResult);
    } catch (err) {
      if (reqId !== saranaKatalogReqIdRef.current) return;
      if (!opts?.silent) setSaranaKatalogError((err as Error).message);
    } finally {
      if (reqId === saranaKatalogReqIdRef.current && !opts?.silent) setSaranaKatalogBusy(false);
    }
  }, [saranaKatalogFilters]);

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
    if (activeTab === "arsip") {
      loadArsipKatalog();
    }
  }, [activeTab, loadArsipKatalog]);

  useEffect(() => {
    if (activeTab === "atk") {
      loadAtk();
    }
  }, [activeTab, loadAtk]);

  useEffect(() => {
    if (activeTab === "atk" && me?.role === "SUPER_ADMIN") {
      loadAtkInvoices();
    }
  }, [activeTab, me, loadAtkInvoices]);

  useEffect(() => {
    if (activeTab === "sarana") {
      loadSarana();
    }
  }, [activeTab, loadSarana]);

  useEffect(() => {
    if (activeTab === "sarana") {
      loadSaranaKatalog();
    }
  }, [activeTab, loadSaranaKatalog]);

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
      tanggal: arsipFilters.tanggal,
      status: arsipFilters.status,
      kategori: arsipFilters.kategori,
      divisi: arsipFilters.divisi,
      departemen: arsipFilters.departemen,
      direktorat: arsipFilters.direktorat,
      search: arsipFilters.search,
    };
  }

  function bookingExportParams() {
    return {
      bulan: bookingFilters.bulan,
      tanggal: bookingFilters.tanggal,
      status: bookingFilters.status,
      divisi: bookingFilters.divisi,
      departemen: bookingFilters.departemen,
      direktorat: bookingFilters.direktorat,
      nama_ruang: bookingFilters.namaRuang,
      search: bookingFilters.search,
    };
  }

  function kendaraanExportParams() {
    return {
      bulan: kendaraanFilters.bulan,
      tanggal: kendaraanFilters.tanggal,
      status: kendaraanFilters.status,
      divisi: kendaraanFilters.divisi,
      departemen: kendaraanFilters.departemen,
      direktorat: kendaraanFilters.direktorat,
      nama_kendaraan: kendaraanFilters.namaKendaraan,
      search: kendaraanFilters.search,
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

  function handleDeleteAtkInvoice(inv: Invoice) {
    confirm("Yakin ingin menghapus Invoice ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.deleteAtkInvoice(inv.id);
        showToast("Invoice berhasil dihapus permanen");
        loadAtkInvoices();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  function updateBookingFilter(patch: Partial<BookingFilterState>) {
    setBookingFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleBookingSearchChange(value: string) {
    setBookingSearchInput(value);
    if (bookingSearchDebounce.current) clearTimeout(bookingSearchDebounce.current);
    bookingSearchDebounce.current = setTimeout(() => {
      updateBookingFilter({ search: value.trim() });
    }, 350);
  }

  function resetBookingFilters() {
    setBookingSearchInput("");
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

  function handleKendaraanSearchChange(value: string) {
    setKendaraanSearchInput(value);
    if (kendaraanSearchDebounce.current) clearTimeout(kendaraanSearchDebounce.current);
    kendaraanSearchDebounce.current = setTimeout(() => {
      updateKendaraanFilter({ search: value.trim() });
    }, 350);
  }

  function resetKendaraanFilters() {
    setKendaraanSearchInput("");
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

  function updateArsipKatalogFilter(patch: Partial<ArsipKatalogFilterState>) {
    setArsipKatalogFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleArsipKatalogSearchChange(value: string) {
    setArsipKatalogSearchInput(value);
    if (arsipKatalogSearchDebounce.current) clearTimeout(arsipKatalogSearchDebounce.current);
    arsipKatalogSearchDebounce.current = setTimeout(() => {
      updateArsipKatalogFilter({ search: value.trim() });
    }, 350);
  }

  function resetArsipKatalogFilters() {
    setArsipKatalogSearchInput("");
    setArsipKatalogFilters(EMPTY_ARSIP_KATALOG_FILTERS);
  }

  function goToArsipKatalogPage(page: number) {
    if (page < 1) return;
    setArsipKatalogFilters((f) => ({ ...f, page }));
  }

  function currentArsipKatalogExportParams() {
    return {
      search: arsipKatalogFilters.search,
      kategori: arsipKatalogFilters.kategori,
      divisi: arsipKatalogFilters.divisi,
      departemen: arsipKatalogFilters.departemen,
      direktorat: arsipKatalogFilters.direktorat,
      bulan: arsipKatalogFilters.bulan,
      tanggal: arsipKatalogFilters.tanggal,
    };
  }

  async function openArsipKatalogDetail(id: number) {
    try {
      const item = await api.getArsip(id);
      setArsipKatalogDetail(item);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
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

  function updateSaranaKatalogFilter(patch: Partial<SaranaKatalogFilterState>) {
    setSaranaKatalogFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleSaranaKatalogSearchChange(value: string) {
    setSaranaKatalogSearchInput(value);
    if (saranaKatalogSearchDebounce.current) clearTimeout(saranaKatalogSearchDebounce.current);
    saranaKatalogSearchDebounce.current = setTimeout(() => {
      updateSaranaKatalogFilter({ search: value.trim() });
    }, 350);
  }

  function resetSaranaKatalogFilters() {
    setSaranaKatalogSearchInput("");
    setSaranaKatalogFilters(EMPTY_SARANA_KATALOG_FILTERS);
  }

  function goToSaranaKatalogPage(page: number) {
    if (page < 1) return;
    setSaranaKatalogFilters((f) => ({ ...f, page }));
  }

  function currentSaranaKatalogExportParams() {
    return {
      search: saranaKatalogFilters.search,
      kategori: saranaKatalogFilters.kategori,
      divisi: saranaKatalogFilters.divisi,
      departemen: saranaKatalogFilters.departemen,
      direktorat: saranaKatalogFilters.direktorat,
      bulan: saranaKatalogFilters.bulan,
      tanggal: saranaKatalogFilters.tanggal,
    };
  }

  async function openSaranaKatalogDetail(id: number) {
    try {
      const item = await api.getSarana(id);
      setSaranaKatalogDetail(item);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
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

  const atkInvoiceTotalPages = Math.max(1, Math.ceil(atkInvoiceTotal / atkInvoiceLimit));
  const atkInvoicePageStart = Math.min(Math.max(1, atkInvoicePage), atkInvoiceTotalPages);
  const atkInvoicePageEnd = Math.min(atkInvoiceTotalPages, atkInvoicePageStart + 1);
  const atkInvoicePageButtons: number[] = [];
  for (let p = atkInvoicePageStart; p <= atkInvoicePageEnd; p++) atkInvoicePageButtons.push(p);

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

  const bookingSelectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === bookingFilters.direktorat) || null;
  const bookingDivisiOptions = bookingSelectedDirektoratNode
    ? bookingSelectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const bookingSelectedDivisiNode = bookingFilters.divisi
    ? (bookingSelectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === bookingFilters.divisi
      )
    : null;
  const bookingDepartemenOptions = bookingSelectedDivisiNode
    ? bookingSelectedDivisiNode.departemen
    : bookingSelectedDirektoratNode
      ? bookingSelectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  const kendaraanTotalPages = Math.max(1, Math.ceil(kendaraanTotal / kendaraanFilters.limit));
  const kendaraanPageStart = Math.min(Math.max(1, kendaraanFilters.page), kendaraanTotalPages);
  const kendaraanPageEnd = Math.min(kendaraanTotalPages, kendaraanPageStart + 1);
  const kendaraanPageButtons: number[] = [];
  for (let p = kendaraanPageStart; p <= kendaraanPageEnd; p++) kendaraanPageButtons.push(p);

  const kendaraanSelectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === kendaraanFilters.direktorat) || null;
  const kendaraanDivisiOptions = kendaraanSelectedDirektoratNode
    ? kendaraanSelectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const kendaraanSelectedDivisiNode = kendaraanFilters.divisi
    ? (kendaraanSelectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === kendaraanFilters.divisi
      )
    : null;
  const kendaraanDepartemenOptions = kendaraanSelectedDivisiNode
    ? kendaraanSelectedDivisiNode.departemen
    : kendaraanSelectedDirektoratNode
      ? kendaraanSelectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  const arsipTotalPages = Math.max(1, Math.ceil(arsipTotal / arsipFilters.limit));
  const arsipPageStart = Math.min(Math.max(1, arsipFilters.page), arsipTotalPages);
  const arsipPageEnd = Math.min(arsipTotalPages, arsipPageStart + 1);
  const arsipPageButtons: number[] = [];
  for (let p = arsipPageStart; p <= arsipPageEnd; p++) arsipPageButtons.push(p);

  const arsipSelectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === arsipFilters.direktorat) || null;
  const arsipDivisiOptions = arsipSelectedDirektoratNode
    ? arsipSelectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const arsipSelectedDivisiNode = arsipFilters.divisi
    ? (arsipSelectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === arsipFilters.divisi
      )
    : null;
  const arsipDepartemenOptions = arsipSelectedDivisiNode
    ? arsipSelectedDivisiNode.departemen
    : arsipSelectedDirektoratNode
      ? arsipSelectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  const arsipKatalogTotalPages = Math.max(1, Math.ceil(arsipKatalogTotal / arsipKatalogFilters.limit));
  const arsipKatalogPageStart = Math.min(Math.max(1, arsipKatalogFilters.page), arsipKatalogTotalPages);
  const arsipKatalogPageEnd = Math.min(arsipKatalogTotalPages, arsipKatalogPageStart + 1);
  const arsipKatalogPageButtons: number[] = [];
  for (let p = arsipKatalogPageStart; p <= arsipKatalogPageEnd; p++) arsipKatalogPageButtons.push(p);

  const arsipKatalogSelectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === arsipKatalogFilters.direktorat) || null;
  const arsipKatalogDivisiOptions = arsipKatalogSelectedDirektoratNode
    ? arsipKatalogSelectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const arsipKatalogSelectedDivisiNode = arsipKatalogFilters.divisi
    ? (arsipKatalogSelectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === arsipKatalogFilters.divisi
      )
    : null;
  const arsipKatalogDepartemenOptions = arsipKatalogSelectedDivisiNode
    ? arsipKatalogSelectedDivisiNode.departemen
    : arsipKatalogSelectedDirektoratNode
      ? arsipKatalogSelectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

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

  const saranaKatalogTotalPages = Math.max(1, Math.ceil(saranaKatalogTotal / saranaKatalogFilters.limit));
  const saranaKatalogPageStart = Math.min(Math.max(1, saranaKatalogFilters.page), saranaKatalogTotalPages);
  const saranaKatalogPageEnd = Math.min(saranaKatalogTotalPages, saranaKatalogPageStart + 1);
  const saranaKatalogPageButtons: number[] = [];
  for (let p = saranaKatalogPageStart; p <= saranaKatalogPageEnd; p++) saranaKatalogPageButtons.push(p);

  const saranaKatalogSelectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === saranaKatalogFilters.direktorat) || null;
  const saranaKatalogDivisiOptions = saranaKatalogSelectedDirektoratNode
    ? saranaKatalogSelectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const saranaKatalogSelectedDivisiNode = saranaKatalogFilters.divisi
    ? (saranaKatalogSelectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === saranaKatalogFilters.divisi
      )
    : null;
  const saranaKatalogDepartemenOptions = saranaKatalogSelectedDivisiNode
    ? saranaKatalogSelectedDivisiNode.departemen
    : saranaKatalogSelectedDirektoratNode
      ? saranaKatalogSelectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  const KATEGORI_OPTIONS = Object.keys(KATEGORI_KERUSAKAN_LABEL) as KategoriKerusakan[];

  return (
    <>
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
              className={`superadmin-subtab-btn ${ekspedisiSubtab === "overview" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setEkspedisiSubtab("overview")}
            >
              Overview ({ekspedisiOvItems.length})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${ekspedisiSubtab === "pengiriman" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setEkspedisiSubtab("pengiriman")}
            >
              Transaction ({total})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${ekspedisiSubtab === "invoice" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setEkspedisiSubtab("invoice")}
            >
              Invoices ({invoiceTotal})
            </button>
          </div>

          {ekspedisiSubtab === "overview" && (
            <>
              <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
                <WelcomeGreeting me={me} />
                <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setEkspedisiOvFormOpen(true)}>
                  + Input Data Barang
                </button>
              </div>

              {ekspedisiOvStats && (
                <div className="stat-grid">
                  <div className="stat-tile"><div className="value">{ekspedisiOvStats.waitingL1}</div><div className="label">Approval Departemen/Divisi</div></div>
                  <div className="stat-tile"><div className="value">{ekspedisiOvStats.waitingGa}</div><div className="label">Admin General Affair</div></div>
                  <div className="stat-tile"><div className="value">{ekspedisiOvStats.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
                  <div className="stat-tile"><div className="value">{ekspedisiOvStats.waitingKpu}</div><div className="label">Mitra</div></div>
                  <div className="stat-tile"><div className="value">{ekspedisiOvStats.completed}</div><div className="label">Approved</div></div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Transaksi Terbaru</h3>
                <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
                  <SearchableSelect
                    id="sa-ekspedisi-overview-status-filter"
                    value={ekspedisiOvStatusFilter}
                    onChange={(v) => setEkspedisiOvStatusFilter(v as typeof ekspedisiOvStatusFilter)}
                    options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
                    getLabel={(v) =>
                      ({
                        ALL: "Semua Status",
                        DRAFT: "Draft",
                        ON_APPROVAL: "On-Approval",
                        APPROVED: "Approved",
                        REJECTED: "Rejected",
                      } as Record<string, string>)[v] || v
                    }
                    placeholder="Semua Status"
                  />
                </div>
              </div>

              {ekspedisiOvBusy ? (
                <p className="text-secondary">Memuat data...</p>
              ) : ekspedisiOvFilteredItems.length === 0 ? (
                <div className="card table-empty">Tidak Ada Data</div>
              ) : (
                ekspedisiOvFilteredItems.map((item) => {
                  const borderClass = cardStatusBorderClass(item.status);
                  return (
                    <div className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`} style={{ marginBottom: 14 }} key={item.id}>
                      <div className="card-header">
                        <div className="card-header-title">
                          <strong>{item.tujuanPenerimaan} - {item.nomorTransmittal}</strong>
                          <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                            {formatDate(item.tanggal)} · {item.departemen || item.divisi}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setEkspedisiOvChatItem(item)}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => ekspedisiOvRowMenu.toggle(e, item.id, 180)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </div>
                      <Stepper status={item.status} departemen={item.departemen} rejectTarget={item.rejectTarget} createdByRole={item.createdByRole} />
                      {item.rejectReason && (
                        <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                          <strong>Catatan Penolakan:</strong> {item.rejectReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <RowMenuDropdown
                position={ekspedisiOvRowMenu.position}
                canEditDelete={
                  !!ekspedisiOvRowMenu.menuItem &&
                  (isEditableByOrigin(ekspedisiOvRowMenu.menuItem, me!) || canGaKoreksiPengiriman(ekspedisiOvRowMenu.menuItem, me!) || canKoreksiHargaPengiriman(ekspedisiOvRowMenu.menuItem, me!))
                }
                canDelete={!!ekspedisiOvRowMenu.menuItem && isEditableByOrigin(ekspedisiOvRowMenu.menuItem, me!)}
                onDetail={() => {
                  const item = ekspedisiOvRowMenu.menuItem;
                  ekspedisiOvRowMenu.close();
                  if (item) setEkspedisiOvDetail({ item, mode: "view" });
                }}
                onUpdates={() => {
                  const item = ekspedisiOvRowMenu.menuItem;
                  ekspedisiOvRowMenu.close();
                  if (!item || !me) return;
                  if (isEditableByOrigin(item, me)) setEkspedisiOvDetail({ item, mode: "edit" });
                  else if (canGaKoreksiPengiriman(item, me)) setEkspedisiOvKoreksiTarget(item);
                  else if (canKoreksiHargaPengiriman(item, me)) setEkspedisiOvDetail({ item, mode: "kpu-edit" });
                }}
                onStatus={() => {
                  const item = ekspedisiOvRowMenu.menuItem;
                  ekspedisiOvRowMenu.close();
                  if (item) setEkspedisiOvStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = ekspedisiOvRowMenu.menuItem;
                  ekspedisiOvRowMenu.close();
                  if (item) ekspedisiOvHandleDelete(item);
                }}
                pdfUrl={ekspedisiOvRowMenu.menuItem && isPengirimanPdfAvailable(ekspedisiOvRowMenu.menuItem) ? api.pengirimanPdfUrl(ekspedisiOvRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = ekspedisiOvRowMenu.menuItem;
                  ekspedisiOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.pengirimanPdfUrl(item.id), `Bukti-Pengiriman-${item.nomorTransmittal || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <PengirimanFormModal open={ekspedisiOvFormOpen} me={me} onClose={() => setEkspedisiOvFormOpen(false)} onCreated={loadEkspedisiOverview} />
              )}

              {me && (
                <PengirimanDetailModal
                  open={!!ekspedisiOvDetail}
                  mode={ekspedisiOvDetail?.mode || "view"}
                  item={ekspedisiOvDetail?.item || null}
                  me={me}
                  onClose={() => setEkspedisiOvDetail(null)}
                  onSaved={loadEkspedisiOverview}
                  onRequestReject={(id, type, originLabel, createdByRole) => setEkspedisiOvRejectTarget({ id, type, originLabel, createdByRole })}
                />
              )}

              <PengirimanKoreksiModal
                open={!!ekspedisiOvKoreksiTarget}
                item={ekspedisiOvKoreksiTarget}
                onClose={() => setEkspedisiOvKoreksiTarget(null)}
                onSaved={loadEkspedisiOverview}
              />

              <RejectModal
                open={!!ekspedisiOvRejectTarget}
                targetId={ekspedisiOvRejectTarget?.id ?? null}
                targetType={ekspedisiOvRejectTarget?.type ?? null}
                originLabel={ekspedisiOvRejectTarget?.originLabel ?? ""}
                createdByRole={ekspedisiOvRejectTarget?.createdByRole ?? null}
                onClose={() => setEkspedisiOvRejectTarget(null)}
                onDone={() => {
                  setEkspedisiOvRejectTarget(null);
                  loadEkspedisiOverview();
                }}
              />

              <StatusHistoryModal open={ekspedisiOvStatusItemId != null} itemId={ekspedisiOvStatusItemId} onClose={() => setEkspedisiOvStatusItemId(null)} />

              {me && (
                <ChatModal
                  open={!!ekspedisiOvChatItem}
                  itemId={ekspedisiOvChatItem?.id ?? null}
                  itemLabel={ekspedisiOvChatItem ? `${ekspedisiOvChatItem.tujuanPenerimaan} - ${ekspedisiOvChatItem.nomorTransmittal}` : ""}
                  departemen={ekspedisiOvChatItem?.departemen ?? null}
                  createdByRole={ekspedisiOvChatItem?.createdByRole ?? null}
                  me={me}
                  onClose={() => setEkspedisiOvChatItem(null)}
                  onRead={() => loadEkspedisiOverview({ silent: true })}
                />
              )}
            </>
          )}

          {ekspedisiSubtab === "pengiriman" && (
            <div className="card">
        <div className="toolbar transactions-page-toolbar">
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
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetFilters}>Semua Transaksi</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.pdfUrl(ekspedisiExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.exportUrl(ekspedisiExportParams()), "_blank")}>
              ⬇ Download Excel
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
        <div className="invoice-toolbar-slim invoices-page-toolbar">
          <div className="field invoice-search-field" style={FIELD_NO_MARGIN_STYLE}>
            <label htmlFor="invoice-filter-search">Cari Invoice</label>
            <input
              type="text"
              id="invoice-filter-search"
              placeholder="Nama Invoice"
              value={invoiceSearchInput}
              onChange={(e) => handleInvoiceSearchChange(e.target.value)}
            />
          </div>
          <div className="field invoice-filter-field" style={FIELD_NO_MARGIN_STYLE}>
            <label htmlFor="invoice-filter-bulan">Filter Bulan</label>
            <MonthFilterPicker
              id="invoice-filter-bulan"
              value={invoiceFilterBulan}
              onChange={(v) => { setInvoiceFilterBulan(v); setInvoicePage(1); }}
            />
          </div>
          {invoiceUploaders.length > 1 && (
            <div className="field invoice-filter-field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="invoice-filter-uploader">Diunggah Oleh</label>
              <SearchableSelect
                id="invoice-filter-uploader"
                value={String(invoiceFilterUploader)}
                onChange={(v) => { setInvoiceFilterUploader(v === "" ? "" : Number(v)); setInvoicePage(1); }}
                options={invoiceUploaders.map((u) => String(u.id))}
                getLabel={(v) => invoiceUploaders.find((u) => String(u.id) === v)?.nama || v}
                clearLabel="Semua Mitra"
                placeholder="Semua Mitra"
              />
            </div>
          )}
          <div className="field" style={FIELD_NO_MARGIN_STYLE}>
            <span className="field-label-spacer">Semua Invoice</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={AUTO_WIDTH_STYLE}
              onClick={() => { setInvoiceSearchInput(""); setInvoiceSearch(""); setInvoiceFilterBulan(""); setInvoiceFilterUploader(""); setInvoicePage(1); }}
            >
              Semua Invoice
            </button>
          </div>
          <button type="button" className="btn btn-primary invoice-input-btn" style={AUTO_WIDTH_STYLE} onClick={() => setInvoiceUploadOpen(true)}>
            + Input Invoice
          </button>
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
                    <div className="invoice-row-meta">
                      Diunggah: {formatDateTime(inv.uploadedAt)}
                      {invoiceUploaders.length > 1 && inv.uploaderNama ? ` oleh ${inv.uploaderNama}` : ""}
                    </div>
                    {inv.reviewedAt && <div className="invoice-row-meta">Ditinjau: {formatDateTime(inv.reviewedAt)}</div>}
                    {inv.catatan && <div className="invoice-row-note"><strong>Catatan:</strong> {inv.catatan}</div>}
                  </div>
                </div>
                <div className="invoice-row-actions">
                  {inv.status === "REJECTED" ? (
                    <div className="badge-stack">
                      <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                      <span className="badge badge-waiting">Waiting: Mitra</span>
                    </div>
                  ) : (
                    <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                  )}
                  <button
                    type="button"
                    className={`card-icon-btn${inv.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}`}
                    aria-label="Chat"
                    onClick={() => setInvoiceChatItem(inv)}
                  >
                    <MessageSquare width="17" height="17" />
                    {inv.unreadChatCount > 0 && (
                      <span className="chat-count-badge">{inv.unreadChatCount > 9 ? "9+" : inv.unreadChatCount}</span>
                    )}
                  </button>
                  <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => invoiceRowMenu.toggle(e, inv.id)}>
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
              className={`superadmin-subtab-btn ${bookingRuangSubtab === "overview" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setBookingRuangSubtab("overview")}
            >
              Overview ({bookingOvItems.length})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${bookingRuangSubtab === "calendar" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setBookingRuangSubtab("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${bookingRuangSubtab === "transaksi" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setBookingRuangSubtab("transaksi")}
            >
              Booking ({bookingTotal})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${bookingRuangSubtab === "roster" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setBookingRuangSubtab("roster")}
            >
              Settings
            </button>
          </div>

          {bookingRuangSubtab === "overview" && (
            <>
              <div className="card-header dashboard-welcome-header" style={{ marginBottom: 12 }}>
                <WelcomeGreeting me={me} />
                <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setBookingOvFormOpen(true)}>
                  + Booking Ruang Meeting
                </button>
              </div>

              {rooms.length > 0 && (
                <div className="room-grid" style={{ "--grid-cols": Math.ceil(rooms.length / 2) } as React.CSSProperties}>
                  {rooms.map((r) => {
                    const isWeekendToday = isWeekend(todayLocalDate());
                    const isPastClosingToday = ovNowMinutesLocal() >= OV_CLOSE_MIN;
                    const closedToday = isWeekendToday || isPastClosingToday;
                    const availability: "available" | "full" | "closed" = closedToday
                      ? "closed"
                      : isRoomFullyBookedToday(r.nama, bookingOvTodayEntries)
                      ? "full"
                      : "available";
                    const availLabel = availability === "closed" ? "Close" : availability === "full" ? "Full" : "Available";
                    const availTitle =
                      availability === "closed"
                        ? isWeekendToday ? "Close (akhir pekan)" : "Close (di luar jam operasional)"
                        : availability === "full" ? "Full hari ini" : "Available hari ini";
                    const slot = getRealRoomCurrentSlot(r.nama, bookingOvTodayEntries, closedToday);
                    return (
                      <div
                        key={r.nama}
                        onClick={() => setBookingOvInfoRoom(r)}
                        className="room-card"
                        title={availTitle}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBookingOvInfoRoom(r); } }}
                      >
                        <div className="room-card-photo-banner">
                          <img src={roomPhotoUrl(r.nama)} alt={r.nama} />
                          <div className="room-card-photo-overlay" />
                          <div className="room-card-photo-footer">
                            <span className="room-title">{r.nama}</span>
                            <span className={`room-badge ${availability === "closed" ? "badge-closed" : availability === "full" ? "badge-full" : "badge-available"}`}>
                              {availLabel}
                            </span>
                          </div>
                        </div>
                        <div className="room-card-body-exact">
                          {availability !== "closed" ? (
                            <div className="room-card-slots-exact">
                              <div className={`room-card-slot-row-exact ${slot.status === "free" ? "slot-free" : "slot-booked"}`}>
                                <span className="slot-time">{slot.jam}</span>
                                <span className="slot-status">{slot.status === "free" ? "Available" : slot.judul || "Terisi"}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="room-card-slots-exact" style={{ minHeight: 22 }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 10px", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Pesanan Terbaru</h3>
                <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
                  <SearchableSelect
                    id="sa-booking-overview-status-filter"
                    value={bookingOvStatusFilter}
                    onChange={(v) => setBookingOvStatusFilter(v as typeof bookingOvStatusFilter)}
                    options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
                    getLabel={(v) => ({
                      ALL: "Semua Status", DRAFT: "Draft", ON_APPROVAL: "On-Approval", APPROVED: "Approved", REJECTED: "Rejected",
                    } as Record<string, string>)[v] || v}
                    placeholder="Semua Status"
                    searchable={false}
                  />
                </div>
              </div>

              {bookingOvBusy ? (
                <p className="text-secondary">Memuat data...</p>
              ) : bookingOvFilteredItems.length === 0 ? (
                <div className="card table-empty">Tidak Ada Data</div>
              ) : (
                bookingOvFilteredItems.map((item) => {
                  const borderClass = bookingStatusBorderClass(item.status);
                  const isDraft = item.status === "DRAFT";
                  return (
                    <div
                      className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`}
                      style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
                      onClick={isDraft ? () => setBookingOvDetail({ item, mode: "view" }) : undefined}
                      key={item.id}
                    >
                      <div className="card-header">
                        <div className="card-header-title">
                          <strong>{item.namaKegiatan} - {item.nomorPemesanan || "-"}</strong>
                          {(() => {
                            const orgUnit = item.departemen || item.divisi;
                            const subtitle = `${formatDate(item.tanggal)}${orgUnit ? ` · ${orgUnit}` : ""} · ${bookingRoomsLabel(item)}`;
                            return <div className="text-secondary" style={{ fontSize: "0.82rem" }} title={subtitle}>{subtitle}</div>;
                          })()}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span className="badge-stack">
                            <BookingStatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} cancelledByRole={item.cancelledByRole} isRoom />
                            {item.hasConflict && <span className="badge badge-rejected">Bentrok</span>}
                          </span>
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={(e) => { e.stopPropagation(); setBookingOvChatItem(item); }}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); bookingOvRowMenu.toggle(e, item.id, 180); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </div>
                      <RoomBookingStepper
                        status={item.status}
                        departemen={item.departemen}
                        rejectTarget={item.rejectTarget}
                        createdByRole={item.createdByRole}
                        cancelledByRole={item.cancelledByRole}
                        approvedByL1={item.approvedByL1}
                        approvedByGa={item.approvedByGa}
                        approvedByApprovalGa={item.approvedByApprovalGa}
                      />
                      {item.rejectReason && (
                        <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                          <strong>Catatan Penolakan:</strong> {item.rejectReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <RowMenuDropdown
                position={bookingOvRowMenu.position}
                canEditDelete={
                  !!bookingOvRowMenu.menuItem &&
                  (isBookingEditableByOrigin(bookingOvRowMenu.menuItem, me!) || canGaRescheduleBooking(bookingOvRowMenu.menuItem, me!))
                }
                canDelete={!!bookingOvRowMenu.menuItem && isBookingDeletableByOrigin(bookingOvRowMenu.menuItem, me!)}
                canCancel={!!bookingOvRowMenu.menuItem && isBookingCancellableByOrigin(bookingOvRowMenu.menuItem, me!)}
                onCancel={() => {
                  const item = bookingOvRowMenu.menuItem;
                  bookingOvRowMenu.close();
                  if (item) setBookingOvCancelTargetId(item.id);
                }}
                onDetail={() => {
                  const item = bookingOvRowMenu.menuItem;
                  bookingOvRowMenu.close();
                  if (item) setBookingOvDetail({ item, mode: "view" });
                }}
                onUpdates={() => {
                  const item = bookingOvRowMenu.menuItem;
                  bookingOvRowMenu.close();
                  if (!item || !me) return;
                  if (isBookingEditableByOrigin(item, me)) setBookingOvDetail({ item, mode: "edit" });
                  else if (canGaRescheduleBooking(item, me)) setBookingOvRescheduleTarget(item);
                }}
                onStatus={() => {
                  const item = bookingOvRowMenu.menuItem;
                  bookingOvRowMenu.close();
                  if (item) setBookingOvStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = bookingOvRowMenu.menuItem;
                  bookingOvRowMenu.close();
                  if (item) bookingOvHandleDelete(item);
                }}
                pdfUrl={bookingOvRowMenu.menuItem && isBookingPdfAvailable(bookingOvRowMenu.menuItem) ? api.bookingPdfUrl(bookingOvRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = bookingOvRowMenu.menuItem;
                  bookingOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.bookingPdfUrl(item.id), `Bukti-Booking-${item.nomorPemesanan || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
                icsUrl={bookingOvRowMenu.menuItem && isBookingPdfAvailable(bookingOvRowMenu.menuItem) ? api.bookingIcsUrl(bookingOvRowMenu.menuItem.id) : undefined}
                onIcsClick={async () => {
                  const item = bookingOvRowMenu.menuItem;
                  bookingOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.bookingIcsUrl(item.id), `Booking-${item.nomorPemesanan || item.id}.ics`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <RoomBookingFormModal
                  open={bookingOvFormOpen}
                  me={me}
                  initial={bookingOvFormInitial}
                  onClose={() => { setBookingOvFormOpen(false); setBookingOvFormInitial(undefined); }}
                  onCreated={loadBookingOverview}
                />
              )}

              <RoomInfoModal
                open={!!bookingOvInfoRoom}
                nama={bookingOvInfoRoom?.nama ?? null}
                kapasitas={bookingOvInfoRoom?.kapasitas ?? null}
                extraDetails={bookingOvInfoRoom ? [{ label: "Lantai", value: bookingOvInfoRoom.lantai ?? "-" }] : []}
                facilities={bookingOvInfoRoom ? bookingOvInfoRoom.fasilitas ?? [] : []}
                photoUrls={bookingOvInfoRoom ? roomPhotoUrls(bookingOvInfoRoom.nama) : []}
                availability={bookingOvInfoRoom ? (ovNowMinutesLocal() >= OV_CLOSE_MIN || isWeekend(todayLocalDate()) ? "closed" : isRoomFullyBookedToday(bookingOvInfoRoom.nama, bookingOvTodayEntries) ? "full" : "available") : "available"}
                availLabel={
                  bookingOvInfoRoom
                    ? (isWeekend(todayLocalDate()) || ovNowMinutesLocal() >= OV_CLOSE_MIN)
                      ? "Close"
                      : isRoomFullyBookedToday(bookingOvInfoRoom.nama, bookingOvTodayEntries) ? "Full" : "Available"
                    : ""
                }
                freeSlotsToday={
                  bookingOvInfoRoom && ovNowMinutesLocal() < OV_CLOSE_MIN && !isWeekend(todayLocalDate())
                    ? roomFreeSlotsToday(bookingOvInfoRoom.nama, bookingOvTodayEntries).map(([s, e]) => `${ovMinutesToHHMM(s)}–${ovMinutesToHHMM(e)}`)
                    : []
                }
                closedLabel={
                  isWeekend(todayLocalDate()) ? "Tutup (akhir pekan)" : ovNowMinutesLocal() >= OV_CLOSE_MIN ? "Tutup (di luar jam operasional)" : undefined
                }
                fullyOpenLabel={
                  bookingOvInfoRoom && ovNowMinutesLocal() < OV_CLOSE_MIN && !isWeekend(todayLocalDate())
                    ? getRealRoomCurrentSlot(bookingOvInfoRoom.nama, bookingOvTodayEntries, false).jam
                    : undefined
                }
                bookLabel="Booking"
                onClose={() => setBookingOvInfoRoom(null)}
                onBook={() => {
                  if (!bookingOvInfoRoom) return;
                  const nama = bookingOvInfoRoom.nama;
                  setBookingOvInfoRoom(null);
                  router.push(`/booking-ruang-meeting/calendar?ruang=${encodeURIComponent(nama)}`);
                }}
              />

              {me && (
                <RoomBookingDetailModal
                  open={!!bookingOvDetail}
                  mode={bookingOvDetail?.mode || "view"}
                  item={bookingOvDetail?.item || null}
                  me={me}
                  onClose={() => setBookingOvDetail(null)}
                  onSaved={loadBookingOverview}
                  onRequestReject={(id, type, originLabel) => setBookingOvRejectTarget({ id, type, originLabel })}
                />
              )}

              <CancelBookingModal
                open={bookingOvCancelTargetId != null}
                targetId={bookingOvCancelTargetId}
                targetType="room"
                onClose={() => setBookingOvCancelTargetId(null)}
                onDone={() => { setBookingOvCancelTargetId(null); loadBookingOverview(); }}
              />

              <RoomBookingRescheduleModal
                open={!!bookingOvRescheduleTarget}
                item={bookingOvRescheduleTarget}
                onClose={() => setBookingOvRescheduleTarget(null)}
                onSaved={loadBookingOverview}
              />

              <RejectModal
                open={!!bookingOvRejectTarget}
                targetId={bookingOvRejectTarget?.id ?? null}
                targetType={bookingOvRejectTarget?.type ?? null}
                originLabel={bookingOvRejectTarget?.originLabel ?? ""}
                onClose={() => setBookingOvRejectTarget(null)}
                onDone={() => { setBookingOvRejectTarget(null); loadBookingOverview(); }}
              />

              <BookingStatusHistoryModal open={bookingOvStatusItemId != null} itemId={bookingOvStatusItemId} onClose={() => setBookingOvStatusItemId(null)} />

              {me && (
                <RoomBookingChatModal
                  open={!!bookingOvChatItem}
                  itemId={bookingOvChatItem?.id ?? null}
                  itemLabel={bookingOvChatItem ? `${bookingOvChatItem.namaKegiatan} - ${bookingRoomsLabel(bookingOvChatItem)} - ${bookingOvChatItem.nomorPemesanan || "-"}` : ""}
                  departemen={bookingOvChatItem?.departemen ?? null}
                  me={me}
                  onClose={() => setBookingOvChatItem(null)}
                  onRead={() => loadBookingOverview({ silent: true })}
                />
              )}
            </>
          )}

          {bookingRuangSubtab === "roster" && <SuperAdminMeetingRoomTab />}

          {bookingRuangSubtab === "transaksi" && (
        <>
      <div className="card">
        <div className="toolbar transactions-page-toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-booking-search">Cari Pesanan</label>
            <input type="text" id="filter-booking-search" placeholder="No Pesanan" value={bookingSearchInput} onChange={(e) => handleBookingSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-booking-bulan">Filter Periode</label>
            <PeriodFilterPicker id="filter-booking-bulan" bulan={bookingFilters.bulan} tanggal={bookingFilters.tanggal} onChangeBulan={(v) => updateBookingFilter({ bulan: v, tanggal: "" })} onChangeTanggal={(v) => updateBookingFilter({ tanggal: v, bulan: "" })} />
          </div>
          <div className="filter-dropdown-wrap" ref={bookingFilterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button type="button" className="btn filter-dropdown-toggle" id="filter-booking-toggle" style={AUTO_WIDTH_STYLE} onClick={() => setBookingFilterOpen((v) => !v)}>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {bookingFilterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={FIELD_NO_MARGIN_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-booking-direktorat">Direktorat</label>
                  <SearchableSelect
                    id="filter-booking-direktorat"
                    value={bookingFilters.direktorat}
                    onChange={(v) => updateBookingFilter({ direktorat: v, divisi: "", departemen: "" })}
                    options={orgStructure?.direktorat || []}
                    clearLabel="Semua Direktorat"
                    placeholder="Semua Direktorat"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetBookingFilters}>Semua Pesanan</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.bookingExportPdfUrl(bookingExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.bookingExportUrl(bookingExportParams()), "_blank")}>
              ⬇ Download Excel
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
            onClose={() => setBookingFormOpen(false)}
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

          {bookingRuangSubtab === "calendar" && (
            <>
              <div className="calendar-shell">
                <div className="calendar-sidebar" ref={bookingCalSidebarRef}>
                  {isBookingOriginRole(me?.role ?? "KPU") && (
                    <button type="button" className="btn btn-primary btn-header-action calendar-sidebar-create-btn" onClick={bookingCalOpenCreateForm}>
                      + Booking Ruang Meeting
                    </button>
                  )}
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="sa-calendar-room-select">Ruangan</label>
                    <SearchableSelect
                      id="sa-calendar-room-select"
                      value={bookingCalView === "avail" ? ALL_ROOMS_VALUE : bookingCalSelectedRoom}
                      onChange={(v) => {
                        if (v === ALL_ROOMS_VALUE) {
                          setBookingCalView("avail");
                        } else {
                          setBookingCalSelectedRoom(v);
                          if (bookingCalView === "avail") setBookingCalView("day");
                        }
                      }}
                      options={[ALL_ROOMS_VALUE, ...rooms.map((r) => r.nama)]}
                      getLabel={(v) => (v === ALL_ROOMS_VALUE ? "Ketersediaan Ruang" : v)}
                      placeholder="Ketersediaan Ruang"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="sa-calendar-date-input">Tanggal</label>
                    <DateFilterPicker
                      id="sa-calendar-date-input"
                      value={bookingCalRefDate}
                      onChange={(v) => { if (v) setBookingCalRefDate(v); }}
                      clearable={false}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="sa-calendar-search-input">Cari Pesanan</label>
                    <input
                      type="text"
                      id="sa-calendar-search-input"
                      className="calendar-search-input"
                      placeholder="No Pesanan"
                      value={bookingCalSearch}
                      onChange={(e) => setBookingCalSearch(e.target.value)}
                    />
                  </div>
                  <MiniMonthCalendar
                    selectedDate={bookingCalRefDate}
                    onSelect={setBookingCalRefDate}
                    namaRuang={bookingCalView === "avail" ? undefined : bookingCalSelectedRoom}
                    entries={bookingCalView === "month" ? bookingCalEntries : undefined}
                  />
                </div>

                <div
                  className={`calendar-main${bookingCalView === "month" ? " calendar-main-month" : ""}`}
                  style={bookingCalView === "month" && bookingCalSidebarHeight ? { minHeight: bookingCalSidebarHeight } : undefined}
                >
                  <div className="calendar-topbar">
                    <div className="calendar-topbar-left">
                      <button type="button" className="btn btn-secondary btn-sm" style={{ width: "auto" }} onClick={bookingCalGoToday}>Hari Ini</button>
                      <div className="calendar-nav-arrows" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <button
                          className="page-btn"
                          onClick={bookingCalGoPrev}
                          aria-label="Sebelumnya"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <button
                          className="page-btn"
                          onClick={bookingCalGoNext}
                          aria-label="Berikutnya"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                      <div className="calendar-topbar-room">{bookingCalView === "avail" ? "Ketersediaan Ruang" : bookingCalSelectedRoom}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="calendar-view-toggle">
                        {(["day", "week", "month"] as CalendarViewMode[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={`calendar-view-btn${bookingCalView === v ? " calendar-view-btn-active" : ""}`}
                            onClick={() => setBookingCalView(v)}
                          >
                            {v === "day" ? "Harian" : v === "week" ? "Mingguan" : "Bulanan"}
                          </button>
                        ))}
                      </div>
                      <div className="calendar-view-toggle">
                        <button
                          type="button"
                          className={`calendar-view-btn${bookingCalView === "avail" ? " calendar-view-btn-active" : ""}`}
                          onClick={() => setBookingCalView("avail")}
                        >
                          Ketersediaan
                        </button>
                      </div>
                    </div>
                  </div>

                  {(bookingCalView === "avail" ? bookingCalAvailBusy : bookingCalScheduleBusy) ? (
                    <p className="text-secondary">Memuat jadwal...</p>
                  ) : (
                    <RoomCalendarView
                      view={bookingCalView}
                      refDate={bookingCalRefDate}
                      entries={bookingCalView === "avail" ? bookingCalFilteredAvailEntries : bookingCalFilteredEntries}
                      rooms={rooms}
                      canCreate={isBookingOriginRole(me?.role ?? "KPU")}
                      onSlotSelect={(date, startHour, endHour, room, additionalRooms) => {
                        if (!isBookingOriginRole(me?.role ?? "KPU")) return;
                        const isFullDay = startHour === 7 && endHour === 18 && isWholeDayAllowed(date);
                        setBookingCalFormInitial({
                          namaRuang: room || bookingCalSelectedRoom,
                          additionalRooms: additionalRooms && additionalRooms.length > 0 ? additionalRooms : undefined,
                          tanggal: date,
                          jamMulai: `${String(startHour).padStart(2, "0")}:00`,
                          jamSelesai: `${String(endHour).padStart(2, "0")}:00`,
                          isWholeDay: isFullDay,
                        });
                        setBookingCalFormOpen(true);
                      }}
                      onEntryMenuClick={(event, entry) => bookingCalRowMenu.toggle(event, entry.id, 220)}
                      onJumpToDay={(date) => { setBookingCalRefDate(date); setBookingCalView("day"); }}
                      onJumpToRoom={(room) => { setBookingCalSelectedRoom(room); setBookingCalView("day"); }}
                    />
                  )}
                </div>
              </div>

              <RowMenuDropdown
                position={bookingCalRowMenu.position}
                canEditDelete={
                  !!bookingCalRowMenu.menuItem &&
                  ((isBookingOriginRole(me?.role ?? "KPU") && isBookingEditableByOrigin(bookingCalRowMenu.menuItem, me!)) || canGaRescheduleBooking(bookingCalRowMenu.menuItem, me!))
                }
                canDelete={!!bookingCalRowMenu.menuItem && isBookingOriginRole(me?.role ?? "KPU") && isBookingDeletableByOrigin(bookingCalRowMenu.menuItem, me!)}
                canCancel={!!bookingCalRowMenu.menuItem && isBookingCancellableByOrigin(bookingCalRowMenu.menuItem, me!)}
                onCancel={() => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (item) setBookingCalCancelTargetId(item.id);
                }}
                onDetail={() => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (item) setBookingCalDetail({ item, mode: "view" });
                }}
                onChat={() => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (item) setBookingCalChatItem(item);
                }}
                unreadChatCount={bookingCalRowMenu.menuItem?.unreadChatCount}
                hasUnreadMention={bookingCalRowMenu.menuItem?.hasUnreadMention}
                onUpdates={() => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (!item || !me) return;
                  if (isBookingOriginRole(me.role) && isBookingEditableByOrigin(item, me)) setBookingCalDetail({ item, mode: "edit" });
                  else if (canGaRescheduleBooking(item, me)) setBookingCalRescheduleTarget(item);
                }}
                onStatus={() => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (item) setBookingCalStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (item) bookingCalHandleDelete(item);
                }}
                pdfUrl={bookingCalRowMenu.menuItem && isBookingPdfAvailable(bookingCalRowMenu.menuItem) ? api.bookingPdfUrl(bookingCalRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.bookingPdfUrl(item.id), `Bukti-Booking-${item.nomorPemesanan || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
                icsUrl={bookingCalRowMenu.menuItem && isBookingPdfAvailable(bookingCalRowMenu.menuItem) ? api.bookingIcsUrl(bookingCalRowMenu.menuItem.id) : undefined}
                onIcsClick={async () => {
                  const item = bookingCalRowMenu.menuItem;
                  bookingCalRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.bookingIcsUrl(item.id), `Booking-${item.nomorPemesanan || item.id}.ics`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <RoomBookingFormModal
                  open={bookingCalFormOpen}
                  me={me}
                  initial={bookingCalFormInitial}
                  onClose={() => { setBookingCalFormOpen(false); setBookingCalFormInitial(undefined); }}
                  onCreated={bookingCalReload}
                />
              )}

              {me && (
                <RoomBookingDetailModal
                  open={!!bookingCalDetail}
                  mode={bookingCalDetail?.mode || "view"}
                  item={bookingCalDetail?.item || null}
                  me={me}
                  onClose={() => setBookingCalDetail(null)}
                  onSaved={bookingCalReload}
                  onRequestReject={(id, type, originLabel) => setBookingCalRejectTarget({ id, type, originLabel })}
                />
              )}

              <CancelBookingModal
                open={bookingCalCancelTargetId != null}
                targetId={bookingCalCancelTargetId}
                targetType="room"
                onClose={() => setBookingCalCancelTargetId(null)}
                onDone={() => { setBookingCalCancelTargetId(null); bookingCalReload(); }}
              />

              <RoomBookingRescheduleModal
                open={!!bookingCalRescheduleTarget}
                item={bookingCalRescheduleTarget}
                onClose={() => setBookingCalRescheduleTarget(null)}
                onSaved={bookingCalReload}
              />

              <RejectModal
                open={!!bookingCalRejectTarget}
                targetId={bookingCalRejectTarget?.id ?? null}
                targetType={bookingCalRejectTarget?.type ?? null}
                originLabel={bookingCalRejectTarget?.originLabel ?? ""}
                onClose={() => setBookingCalRejectTarget(null)}
                onDone={() => { setBookingCalRejectTarget(null); bookingCalReload(); }}
              />

              <BookingStatusHistoryModal open={bookingCalStatusItemId != null} itemId={bookingCalStatusItemId} onClose={() => setBookingCalStatusItemId(null)} />

              {me && (
                <RoomBookingChatModal
                  open={!!bookingCalChatItem}
                  itemId={bookingCalChatItem?.id ?? null}
                  itemLabel={bookingCalChatItem ? `${bookingCalChatItem.namaKegiatan} - ${bookingRoomsLabel(bookingCalChatItem)} - ${bookingCalChatItem.nomorPemesanan || "-"}` : ""}
                  departemen={bookingCalChatItem?.departemen ?? null}
                  me={me}
                  onClose={() => setBookingCalChatItem(null)}
                  onRead={() => bookingCalReload({ silent: true })}
                />
              )}
            </>
          )}
        </>
      )}

      {activeTab === "booking-kendaraan" && (
        <>
          <div className="superadmin-subtabs">
            <button
              type="button"
              className={`superadmin-subtab-btn ${kendaraanSubtab === "overview" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setKendaraanSubtab("overview")}
            >
              Overview ({kendaraanOvItems.length})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${kendaraanSubtab === "calendar" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setKendaraanSubtab("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${kendaraanSubtab === "transaksi" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setKendaraanSubtab("transaksi")}
            >
              Booking ({kendaraanTotal})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${kendaraanSubtab === "roster" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setKendaraanSubtab("roster")}
            >
              Settings
            </button>
          </div>

          {kendaraanSubtab === "overview" && (
            <>
              <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
                <WelcomeGreeting me={me} />
                <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setKendaraanOvFormOpen(true)}>
                  + Booking Kendaraan
                </button>
              </div>

              {vehicles.length > 0 && (
                <div className="room-grid" style={{ "--grid-cols": Math.ceil(vehicles.length / 2) } as React.CSSProperties}>
                  {vehicles.map((v) => {
                    const isPastClosingToday = ovNowMinutesLocal() >= OV_CLOSE_MIN;
                    const availability: "available" | "full" | "closed" = isPastClosingToday
                      ? "closed"
                      : isVehicleFullyBookedToday(v.nama, kendaraanOvTodayEntries)
                      ? "full"
                      : "available";
                    const availLabel = availability === "closed" ? "Close" : availability === "full" ? "Full" : "Available";
                    const availTitle = availability === "closed" ? "Close (di luar jam operasional)" : availability === "full" ? "Full hari ini" : "Available hari ini";
                    const slot = getRealVehicleCurrentSlot(v.nama, kendaraanOvTodayEntries, isPastClosingToday);
                    return (
                      <div
                        key={v.nama}
                        onClick={() => setKendaraanOvInfoVehicle(v)}
                        className="room-card"
                        title={availTitle}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setKendaraanOvInfoVehicle(v); } }}
                      >
                        <div className="room-card-photo-banner">
                          <img src={vehiclePhotoUrl(v.nama)} alt={v.nama} />
                          <div className="room-card-photo-overlay" />
                          <div className="room-card-photo-footer">
                            <span className="room-title">{v.nama}</span>
                            <span className={`room-badge ${availability === "closed" ? "badge-closed" : availability === "full" ? "badge-full" : "badge-available"}`}>
                              {availLabel}
                            </span>
                          </div>
                        </div>
                        <div className="room-card-body-exact">
                          {availability !== "closed" ? (
                            <div className="room-card-slots-exact">
                              <div className={`room-card-slot-row-exact ${slot.status === "free" ? "slot-free" : "slot-booked"}`}>
                                <span className="slot-time">{slot.jam}</span>
                                <span className="slot-status">{slot.status === "free" ? "Available" : slot.judul || "Terisi"}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="room-card-slots-exact" style={{ minHeight: 22 }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Pesanan Terbaru</h3>
                <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
                  <SearchableSelect
                    id="sa-kendaraan-overview-status-filter"
                    value={kendaraanOvStatusFilter}
                    onChange={(v) => setKendaraanOvStatusFilter(v as typeof kendaraanOvStatusFilter)}
                    options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
                    getLabel={(v) => ({
                      ALL: "Semua Status", DRAFT: "Draft", ON_APPROVAL: "On-Approval", APPROVED: "Approved", REJECTED: "Rejected",
                    } as Record<string, string>)[v] || v}
                    placeholder="Semua Status"
                    searchable={false}
                  />
                </div>
              </div>

              {kendaraanOvBusy ? (
                <p className="text-secondary">Memuat data...</p>
              ) : kendaraanOvFilteredItems.length === 0 ? (
                <div className="card table-empty">Tidak Ada Data</div>
              ) : (
                kendaraanOvFilteredItems.map((item) => {
                  const isDraft = item.status === "DRAFT";
                  const borderClass = bookingStatusBorderClass(item.status);
                  return (
                    <div
                      className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`}
                      style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
                      onClick={isDraft ? () => setKendaraanOvDetail({ item, mode: "view" }) : undefined}
                      key={item.id}
                    >
                      <div className="card-header">
                        <div className="card-header-title">
                          <strong>{item.keperluan} - {item.nomorPemesanan || "-"}</strong>
                          {(() => {
                            const orgUnit = item.departemen || item.divisi;
                            const subtitle = `${formatDate(item.tanggal)}${orgUnit ? ` · ${orgUnit}` : ""} · ${item.namaKendaraan}`;
                            return <div className="text-secondary" style={{ fontSize: "0.82rem" }} title={subtitle}>{subtitle}</div>;
                          })()}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <BookingStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} cancelledByName={item.cancelledByName} cancelledByRole={item.cancelledByRole} isKendaraan />
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={(e) => { e.stopPropagation(); setKendaraanOvChatItem(item); }}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); kendaraanOvRowMenu.toggle(e, item.id, 180); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </div>
                      <RoomBookingStepper
                        status={item.status}
                        departemen={item.departemen}
                        createdByRole={item.createdByRole}
                        cancelledByRole={item.cancelledByRole}
                        approvedByL1={item.approvedByL1}
                        approvedByGa={item.approvedByGa}
                        approvedByApprovalGa={item.approvedByApprovalGa}
                      />
                      {item.rejectReason && (
                        <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                          <strong>Catatan Penolakan:</strong> {item.rejectReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <RowMenuDropdown
                position={kendaraanOvRowMenu.position}
                canEditDelete={
                  !!kendaraanOvRowMenu.menuItem &&
                  (isKendaraanEditableByOrigin(kendaraanOvRowMenu.menuItem, me!) || canGaRescheduleKendaraan(kendaraanOvRowMenu.menuItem, me!))
                }
                canDelete={!!kendaraanOvRowMenu.menuItem && isKendaraanDeletableByOrigin(kendaraanOvRowMenu.menuItem, me!)}
                canCancel={!!kendaraanOvRowMenu.menuItem && isKendaraanCancellableByOrigin(kendaraanOvRowMenu.menuItem, me!)}
                onCancel={() => {
                  const item = kendaraanOvRowMenu.menuItem;
                  kendaraanOvRowMenu.close();
                  if (item) setKendaraanOvCancelTargetId(item.id);
                }}
                onDetail={() => {
                  const item = kendaraanOvRowMenu.menuItem;
                  kendaraanOvRowMenu.close();
                  if (item) setKendaraanOvDetail({ item, mode: "view" });
                }}
                onUpdates={() => {
                  const item = kendaraanOvRowMenu.menuItem;
                  kendaraanOvRowMenu.close();
                  if (!item || !me) return;
                  if (isKendaraanEditableByOrigin(item, me)) setKendaraanOvDetail({ item, mode: "edit" });
                  else if (canGaRescheduleKendaraan(item, me)) setKendaraanOvRescheduleTarget(item);
                }}
                onStatus={() => {
                  const item = kendaraanOvRowMenu.menuItem;
                  kendaraanOvRowMenu.close();
                  if (item) setKendaraanOvStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = kendaraanOvRowMenu.menuItem;
                  kendaraanOvRowMenu.close();
                  if (item) kendaraanOvHandleDelete(item);
                }}
                pdfUrl={kendaraanOvRowMenu.menuItem && isKendaraanPdfAvailable(kendaraanOvRowMenu.menuItem) ? api.kendaraanPdfUrl(kendaraanOvRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = kendaraanOvRowMenu.menuItem;
                  kendaraanOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.kendaraanPdfUrl(item.id), `Bukti-Booking-Kendaraan-${item.nomorPemesanan || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
                icsUrl={kendaraanOvRowMenu.menuItem && isKendaraanPdfAvailable(kendaraanOvRowMenu.menuItem) ? api.kendaraanIcsUrl(kendaraanOvRowMenu.menuItem.id) : undefined}
                onIcsClick={async () => {
                  const item = kendaraanOvRowMenu.menuItem;
                  kendaraanOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.kendaraanIcsUrl(item.id), `Booking-Kendaraan-${item.nomorPemesanan || item.id}.ics`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <VehicleBookingFormModal
                  open={kendaraanOvFormOpen}
                  me={me}
                  initial={kendaraanOvFormInitial}
                  onClose={() => { setKendaraanOvFormOpen(false); setKendaraanOvFormInitial(undefined); }}
                  onCreated={loadKendaraanOverview}
                />
              )}

              <RoomInfoModal
                open={!!kendaraanOvInfoVehicle}
                nama={kendaraanOvInfoVehicle?.nama ?? null}
                kapasitas={null}
                extraDetails={
                  kendaraanOvInfoVehicle
                    ? [
                        { label: "Merek", value: kendaraanOvInfoVehicle.merek || "-" },
                        { label: "Model", value: kendaraanOvInfoVehicle.model || "-" },
                        { label: "Warna", value: kendaraanOvInfoVehicle.warna || "-" },
                        { label: "Tahun", value: kendaraanOvInfoVehicle.tahun ? String(kendaraanOvInfoVehicle.tahun) : "-" },
                        { label: "Kapasitas", value: `${kendaraanOvInfoVehicle.kapasitas} orang` },
                        { label: "Plat Nomor", value: kendaraanOvInfoVehicle.platNomor || "-" },
                        { label: "Nama Pengemudi", value: kendaraanOvInfoVehicle.supir || "-" },
                        { label: "No Telepon Pengemudi", value: kendaraanOvInfoVehicle.nomorTeleponSupir || "-" },
                      ]
                    : []
                }
                photoUrls={kendaraanOvInfoVehicle ? vehiclePhotoUrls(kendaraanOvInfoVehicle.nama) : []}
                availability={
                  kendaraanOvInfoVehicle
                    ? ovNowMinutesLocal() >= OV_CLOSE_MIN
                      ? "closed"
                      : isVehicleFullyBookedToday(kendaraanOvInfoVehicle.nama, kendaraanOvTodayEntries) ? "full" : "available"
                    : "available"
                }
                availLabel={
                  kendaraanOvInfoVehicle
                    ? ovNowMinutesLocal() >= OV_CLOSE_MIN
                      ? "Close"
                      : isVehicleFullyBookedToday(kendaraanOvInfoVehicle.nama, kendaraanOvTodayEntries) ? "Full" : "Available"
                    : ""
                }
                freeSlotsToday={
                  kendaraanOvInfoVehicle && ovNowMinutesLocal() < OV_CLOSE_MIN
                    ? vehicleFreeSlotsToday(kendaraanOvInfoVehicle.nama, kendaraanOvTodayEntries).map(([s, e]) => `${ovMinutesToHHMM(s)}–${ovMinutesToHHMM(e)}`)
                    : []
                }
                closedLabel={ovNowMinutesLocal() >= OV_CLOSE_MIN ? "Tutup (di luar jam operasional)" : undefined}
                fullyOpenLabel={
                  kendaraanOvInfoVehicle && ovNowMinutesLocal() < OV_CLOSE_MIN && isVehicleFullyBookedToday(kendaraanOvInfoVehicle.nama, kendaraanOvTodayEntries) === false && vehicleFreeSlotsToday(kendaraanOvInfoVehicle.nama, kendaraanOvTodayEntries).length > 0
                    ? "Tersedia"
                    : undefined
                }
                bookLabel="Booking"
                onClose={() => setKendaraanOvInfoVehicle(null)}
                onBook={() => {
                  if (!kendaraanOvInfoVehicle) return;
                  const nama = kendaraanOvInfoVehicle.nama;
                  setKendaraanOvInfoVehicle(null);
                  router.push(`/booking-kendaraan/calendar?kendaraan=${encodeURIComponent(nama)}`);
                }}
              />

              {me && (
                <VehicleBookingDetailModal
                  open={!!kendaraanOvDetail}
                  mode={kendaraanOvDetail?.mode || "view"}
                  item={kendaraanOvDetail?.item || null}
                  me={me}
                  onClose={() => setKendaraanOvDetail(null)}
                  onSaved={loadKendaraanOverview}
                  onRequestReject={(id, type, originLabel) => setKendaraanOvRejectTarget({ id, type, originLabel })}
                />
              )}

              <CancelBookingModal
                open={kendaraanOvCancelTargetId != null}
                targetId={kendaraanOvCancelTargetId}
                targetType="kendaraan"
                onClose={() => setKendaraanOvCancelTargetId(null)}
                onDone={() => { setKendaraanOvCancelTargetId(null); loadKendaraanOverview(); }}
              />

              <VehicleBookingRescheduleModal
                open={!!kendaraanOvRescheduleTarget}
                item={kendaraanOvRescheduleTarget}
                onClose={() => setKendaraanOvRescheduleTarget(null)}
                onSaved={loadKendaraanOverview}
              />

              <RejectModal
                open={!!kendaraanOvRejectTarget}
                targetId={kendaraanOvRejectTarget?.id ?? null}
                targetType={kendaraanOvRejectTarget?.type ?? null}
                originLabel={kendaraanOvRejectTarget?.originLabel ?? ""}
                onClose={() => setKendaraanOvRejectTarget(null)}
                onDone={() => { setKendaraanOvRejectTarget(null); loadKendaraanOverview(); }}
              />

              <VehicleBookingStatusHistoryModal open={kendaraanOvStatusItemId != null} itemId={kendaraanOvStatusItemId} onClose={() => setKendaraanOvStatusItemId(null)} />

              {me && (
                <VehicleBookingChatModal
                  open={!!kendaraanOvChatItem}
                  itemId={kendaraanOvChatItem?.id ?? null}
                  itemLabel={kendaraanOvChatItem ? `${kendaraanOvChatItem.keperluan} - ${kendaraanOvChatItem.namaKendaraan} - ${kendaraanOvChatItem.nomorPemesanan || "-"}` : ""}
                  departemen={kendaraanOvChatItem?.departemen ?? null}
                  me={me}
                  onClose={() => setKendaraanOvChatItem(null)}
                  onRead={() => loadKendaraanOverview({ silent: true })}
                />
              )}
            </>
          )}

          {kendaraanSubtab === "roster" && <SuperAdminVehicleTab />}

          {kendaraanSubtab === "transaksi" && (
        <>
      <div className="card">
        <div className="toolbar transactions-page-toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-kendaraan-search">Cari Pesanan</label>
            <input type="text" id="filter-kendaraan-search" placeholder="No Pesanan" value={kendaraanSearchInput} onChange={(e) => handleKendaraanSearchChange(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filter-kendaraan-bulan">Filter Periode</label>
            <PeriodFilterPicker id="filter-kendaraan-bulan" bulan={kendaraanFilters.bulan} tanggal={kendaraanFilters.tanggal} onChangeBulan={(v) => updateKendaraanFilter({ bulan: v, tanggal: "" })} onChangeTanggal={(v) => updateKendaraanFilter({ tanggal: v, bulan: "" })} />
          </div>
          <div className="filter-dropdown-wrap" ref={kendaraanFilterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button type="button" className="btn filter-dropdown-toggle" id="filter-kendaraan-toggle" style={AUTO_WIDTH_STYLE} onClick={() => setKendaraanFilterOpen((v) => !v)}>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {kendaraanFilterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={FIELD_NO_MARGIN_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
                  <label htmlFor="filter-kendaraan-direktorat">Direktorat</label>
                  <SearchableSelect
                    id="filter-kendaraan-direktorat"
                    value={kendaraanFilters.direktorat}
                    onChange={(v) => updateKendaraanFilter({ direktorat: v, divisi: "", departemen: "" })}
                    options={orgStructure?.direktorat || []}
                    clearLabel="Semua Direktorat"
                    placeholder="Semua Direktorat"
                  />
                </div>
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
                <div className="field" style={FIELD_NO_MARGIN_TOP_SPACED_STYLE}>
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
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetKendaraanFilters}>Semua Pesanan</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.kendaraanExportPdfUrl(kendaraanExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.kendaraanExportUrl(kendaraanExportParams()), "_blank")}>
              ⬇ Download Excel
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
            onClose={() => setKendaraanFormOpen(false)}
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

          {kendaraanSubtab === "calendar" && (
            <>
              <div className="calendar-shell">
                <div className="calendar-sidebar" ref={kendaraanCalSidebarRef}>
                  {isBookingOriginRole(me?.role ?? "KPU") && (
                    <button type="button" className="btn btn-primary btn-header-action calendar-sidebar-create-btn" onClick={kendaraanCalOpenCreateForm}>
                      + Booking Kendaraan
                    </button>
                  )}
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="sa-calendar-kendaraan-select">Kendaraan</label>
                    <SearchableSelect
                      id="sa-calendar-kendaraan-select"
                      value={kendaraanCalView === "avail" ? ALL_VEHICLES_VALUE : kendaraanCalSelectedVehicle}
                      onChange={(v) => {
                        if (v === ALL_VEHICLES_VALUE) {
                          setKendaraanCalView("avail");
                        } else {
                          setKendaraanCalSelectedVehicle(v);
                          if (kendaraanCalView === "avail") setKendaraanCalView("day");
                        }
                      }}
                      options={[ALL_VEHICLES_VALUE, ...vehicles.map((v) => v.nama)]}
                      getLabel={(v) => (v === ALL_VEHICLES_VALUE ? "Ketersediaan Kendaraan" : v)}
                      placeholder="Ketersediaan Kendaraan"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="sa-calendar-kendaraan-date-input">Tanggal</label>
                    <DateFilterPicker
                      id="sa-calendar-kendaraan-date-input"
                      value={kendaraanCalRefDate}
                      onChange={(v) => { if (v) setKendaraanCalRefDate(v); }}
                      clearable={false}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="sa-calendar-kendaraan-search-input">Cari Pesanan</label>
                    <input
                      type="text"
                      id="sa-calendar-kendaraan-search-input"
                      className="calendar-search-input"
                      placeholder="No Pesanan"
                      value={kendaraanCalSearch}
                      onChange={(e) => setKendaraanCalSearch(e.target.value)}
                    />
                  </div>
                  <MiniMonthCalendar
                    selectedDate={kendaraanCalRefDate}
                    onSelect={setKendaraanCalRefDate}
                    entries={kendaraanCalMiniEntries}
                  />
                </div>

                <div
                  className={`calendar-main${kendaraanCalView === "month" ? " calendar-main-month" : ""}`}
                  style={kendaraanCalView === "month" && kendaraanCalSidebarHeight ? { minHeight: kendaraanCalSidebarHeight } : undefined}
                >
                  <div className="calendar-topbar">
                    <div className="calendar-topbar-left">
                      <button type="button" className="btn btn-secondary btn-sm" style={{ width: "auto" }} onClick={kendaraanCalGoToday}>Hari Ini</button>
                      <div className="calendar-nav-arrows" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <button
                          className="page-btn"
                          onClick={kendaraanCalGoPrev}
                          aria-label="Sebelumnya"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <button
                          className="page-btn"
                          onClick={kendaraanCalGoNext}
                          aria-label="Berikutnya"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                      <div className="calendar-topbar-room">{kendaraanCalView === "avail" ? "Ketersediaan Kendaraan" : kendaraanCalSelectedVehicle}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="calendar-view-toggle">
                        {(["day", "week", "month"] as CalendarViewMode[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={`calendar-view-btn${kendaraanCalView === v ? " calendar-view-btn-active" : ""}`}
                            onClick={() => setKendaraanCalView(v)}
                          >
                            {v === "day" ? "Harian" : v === "week" ? "Mingguan" : "Bulanan"}
                          </button>
                        ))}
                      </div>
                      <div className="calendar-view-toggle">
                        <button
                          type="button"
                          className={`calendar-view-btn${kendaraanCalView === "avail" ? " calendar-view-btn-active" : ""}`}
                          onClick={() => setKendaraanCalView("avail")}
                        >
                          Ketersediaan
                        </button>
                      </div>
                    </div>
                  </div>

                  {(kendaraanCalView === "avail" ? kendaraanCalAvailBusy : kendaraanCalScheduleBusy) ? (
                    <p className="text-secondary">Memuat jadwal...</p>
                  ) : (
                    <RoomCalendarView
                      view={kendaraanCalView}
                      refDate={kendaraanCalRefDate}
                      entries={kendaraanCalView === "avail" ? kendaraanCalFilteredAvailEntries : kendaraanCalFilteredEntries}
                      rooms={vehicles}
                      canCreate={isBookingOriginRole(me?.role ?? "KPU")}
                      onSlotSelect={(date, startHour, endHour, kendaraan) => {
                        if (!isBookingOriginRole(me?.role ?? "KPU")) return;
                        const isFullDay = startHour === 7 && endHour === 18 && isWholeDayAllowed(date);
                        setKendaraanCalFormInitial({
                          namaKendaraan: kendaraan || kendaraanCalSelectedVehicle,
                          tanggal: date,
                          jamMulai: `${String(startHour).padStart(2, "0")}:00`,
                          jamSelesai: `${String(endHour).padStart(2, "0")}:00`,
                          isWholeDay: isFullDay,
                        });
                        setKendaraanCalFormOpen(true);
                      }}
                      onEntryMenuClick={(event, entry) => kendaraanCalRowMenu.toggle(event, entry.id, 220)}
                      onJumpToDay={(date) => { setKendaraanCalRefDate(date); setKendaraanCalView("day"); }}
                      onJumpToRoom={(kendaraan) => { setKendaraanCalSelectedVehicle(kendaraan); setKendaraanCalView("day"); }}
                    />
                  )}
                </div>
              </div>

              <RowMenuDropdown
                position={kendaraanCalRowMenu.position}
                canEditDelete={
                  !!kendaraanCalRowMenu.menuItem &&
                  ((isBookingOriginRole(me?.role ?? "KPU") && isKendaraanEditableByOrigin(kendaraanCalRowMenu.menuItem, me!)) || canGaRescheduleKendaraan(kendaraanCalRowMenu.menuItem, me!))
                }
                canDelete={!!kendaraanCalRowMenu.menuItem && isBookingOriginRole(me?.role ?? "KPU") && isKendaraanDeletableByOrigin(kendaraanCalRowMenu.menuItem, me!)}
                canCancel={!!kendaraanCalRowMenu.menuItem && isKendaraanCancellableByOrigin(kendaraanCalRowMenu.menuItem, me!)}
                onCancel={() => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (item) setKendaraanCalCancelTargetId(item.id);
                }}
                onDetail={() => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (item) setKendaraanCalDetail({ item, mode: "view" });
                }}
                onChat={() => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (item) setKendaraanCalChatItem(item);
                }}
                unreadChatCount={kendaraanCalRowMenu.menuItem?.unreadChatCount}
                hasUnreadMention={kendaraanCalRowMenu.menuItem?.hasUnreadMention}
                onUpdates={() => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (!item || !me) return;
                  if (isBookingOriginRole(me.role) && isKendaraanEditableByOrigin(item, me)) setKendaraanCalDetail({ item, mode: "edit" });
                  else if (canGaRescheduleKendaraan(item, me)) setKendaraanCalRescheduleTarget(item);
                }}
                onStatus={() => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (item) setKendaraanCalStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (item) kendaraanCalHandleDelete(item);
                }}
                pdfUrl={kendaraanCalRowMenu.menuItem && isKendaraanPdfAvailable(kendaraanCalRowMenu.menuItem) ? api.kendaraanPdfUrl(kendaraanCalRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.kendaraanPdfUrl(item.id), `Bukti-Booking-Kendaraan-${item.nomorPemesanan || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
                icsUrl={kendaraanCalRowMenu.menuItem && isKendaraanPdfAvailable(kendaraanCalRowMenu.menuItem) ? api.kendaraanIcsUrl(kendaraanCalRowMenu.menuItem.id) : undefined}
                onIcsClick={async () => {
                  const item = kendaraanCalRowMenu.menuItem;
                  kendaraanCalRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.kendaraanIcsUrl(item.id), `Booking-Kendaraan-${item.nomorPemesanan || item.id}.ics`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <VehicleBookingFormModal
                  open={kendaraanCalFormOpen}
                  me={me}
                  initial={kendaraanCalFormInitial}
                  onClose={() => setKendaraanCalFormOpen(false)}
                  onCreated={kendaraanCalReloadAll}
                />
              )}

              {me && (
                <VehicleBookingDetailModal
                  open={!!kendaraanCalDetail}
                  mode={kendaraanCalDetail?.mode || "view"}
                  item={kendaraanCalDetail?.item || null}
                  me={me}
                  onClose={() => setKendaraanCalDetail(null)}
                  onSaved={kendaraanCalReloadAll}
                  onRequestReject={(id, type, originLabel) => setKendaraanCalRejectTarget({ id, type, originLabel })}
                />
              )}

              <CancelBookingModal
                open={kendaraanCalCancelTargetId != null}
                targetId={kendaraanCalCancelTargetId}
                targetType="kendaraan"
                onClose={() => setKendaraanCalCancelTargetId(null)}
                onDone={() => { setKendaraanCalCancelTargetId(null); kendaraanCalReloadAll(); }}
              />

              <VehicleBookingRescheduleModal
                open={!!kendaraanCalRescheduleTarget}
                item={kendaraanCalRescheduleTarget}
                onClose={() => setKendaraanCalRescheduleTarget(null)}
                onSaved={kendaraanCalReloadAll}
              />

              <RejectModal
                open={!!kendaraanCalRejectTarget}
                targetId={kendaraanCalRejectTarget?.id ?? null}
                targetType={kendaraanCalRejectTarget?.type ?? null}
                originLabel={kendaraanCalRejectTarget?.originLabel ?? ""}
                onClose={() => setKendaraanCalRejectTarget(null)}
                onDone={() => { setKendaraanCalRejectTarget(null); kendaraanCalReloadAll(); }}
              />

              <VehicleBookingStatusHistoryModal open={kendaraanCalStatusItemId != null} itemId={kendaraanCalStatusItemId} onClose={() => setKendaraanCalStatusItemId(null)} />

              {me && (
                <VehicleBookingChatModal
                  open={!!kendaraanCalChatItem}
                  itemId={kendaraanCalChatItem?.id ?? null}
                  itemLabel={kendaraanCalChatItem ? `${kendaraanCalChatItem.keperluan} - ${kendaraanCalChatItem.namaKendaraan} - ${kendaraanCalChatItem.nomorPemesanan || "-"}` : ""}
                  departemen={kendaraanCalChatItem?.departemen ?? null}
                  me={me}
                  onClose={() => setKendaraanCalChatItem(null)}
                  onRead={() => kendaraanCalReloadAll({ silent: true })}
                />
              )}
            </>
          )}
        </>
      )}

      {activeTab === "arsip" && (
        <>
          <div className="superadmin-subtabs">
            <button
              type="button"
              className={`superadmin-subtab-btn ${arsipSubtab === "overview" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setArsipSubtab("overview")}
            >
              Overview ({arsipOvItems.length})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${arsipSubtab === "transaksi" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setArsipSubtab("transaksi")}
            >
              Transaction ({arsipTotal})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${arsipSubtab === "katalog" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setArsipSubtab("katalog")}
            >
              Repository ({arsipKatalogTotal})
            </button>
          </div>

          {arsipSubtab === "overview" && (
            <>
              <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
                <WelcomeGreeting me={me} />
                <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setArsipOvFormOpen(true)}>
                  + Pemindahan Arsip
                </button>
              </div>

              {arsipOvStats && (
                <div className="stat-grid">
                  <div className="stat-tile"><div className="value">{arsipOvStats.waitingL1}</div><div className="label">Approval Departemen/Divisi</div></div>
                  <div className="stat-tile"><div className="value">{arsipOvStats.waitingGa}</div><div className="label">Admin General Affair</div></div>
                  <div className="stat-tile"><div className="value">{arsipOvStats.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
                  <div className="stat-tile"><div className="value">{arsipOvStats.approved}</div><div className="label">Approved</div></div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Pemindahan Arsip Terbaru</h3>
                <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
                  <SearchableSelect
                    id="sa-arsip-overview-status-filter"
                    value={arsipOvStatusFilter}
                    onChange={(v) => setArsipOvStatusFilter(v as typeof arsipOvStatusFilter)}
                    options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
                    getLabel={(v) => ({
                      ALL: "Semua Status", DRAFT: "Draft", ON_APPROVAL: "On-Approval", APPROVED: "Approved", REJECTED: "Rejected",
                    } as Record<string, string>)[v] || v}
                    placeholder="Semua Status"
                  />
                </div>
              </div>

              {arsipOvBusy ? (
                <p className="text-secondary">Memuat data...</p>
              ) : arsipOvFilteredItems.length === 0 ? (
                <div className="card table-empty">Tidak Ada Data</div>
              ) : (
                arsipOvFilteredItems.map((item) => {
                  const isDraft = item.status === "DRAFT";
                  const borderClass = bookingStatusBorderClass(item.status);
                  return (
                    <div
                      className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`}
                      style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
                      onClick={isDraft ? () => setArsipOvDetail({ item, mode: "view" }) : undefined}
                      key={item.id}
                    >
                      <div className="card-header">
                        <div className="card-header-title">
                          <strong>{item.namaArsip} - {item.nomorArsip || "-"}</strong>
                          <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                            {formatDate(item.tanggal)} · {item.departemen || item.divisi}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <BookingStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} revisable />
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={(e) => { e.stopPropagation(); setArsipOvChatItem(item); }}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); arsipOvRowMenu.toggle(e, item.id, 180); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </div>
                      <RoomBookingStepper status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} />
                      {item.rejectReason && (
                        <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                          <strong>Catatan Penolakan:</strong> {item.rejectReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <RowMenuDropdown
                position={arsipOvRowMenu.position}
                canEditDelete={
                  !!arsipOvRowMenu.menuItem &&
                  (isArsipEditableByOrigin(arsipOvRowMenu.menuItem, me!) || canGaKoreksiArsip(arsipOvRowMenu.menuItem, me!))
                }
                canDelete={!!arsipOvRowMenu.menuItem && isArsipEditableByOrigin(arsipOvRowMenu.menuItem, me!)}
                onDetail={() => {
                  const item = arsipOvRowMenu.menuItem;
                  arsipOvRowMenu.close();
                  if (item) setArsipOvDetail({ item, mode: "view" });
                }}
                onUpdates={() => {
                  const item = arsipOvRowMenu.menuItem;
                  arsipOvRowMenu.close();
                  if (!item || !me) return;
                  if (isArsipEditableByOrigin(item, me)) setArsipOvDetail({ item, mode: "edit" });
                  else if (canGaKoreksiArsip(item, me)) setArsipOvKoreksiTarget(item);
                }}
                onStatus={() => {
                  const item = arsipOvRowMenu.menuItem;
                  arsipOvRowMenu.close();
                  if (item) setArsipOvStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = arsipOvRowMenu.menuItem;
                  arsipOvRowMenu.close();
                  if (item) arsipOvHandleDelete(item);
                }}
                pdfUrl={arsipOvRowMenu.menuItem && isArsipPdfAvailable(arsipOvRowMenu.menuItem) ? api.arsipPdfUrl(arsipOvRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = arsipOvRowMenu.menuItem;
                  arsipOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.arsipPdfUrl(item.id), `Bukti-Pemindahan-Arsip-${item.nomorArsip || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <ArsipFormModal open={arsipOvFormOpen} me={me} onClose={() => setArsipOvFormOpen(false)} onCreated={loadArsipOverview} />
              )}

              {me && (
                <ArsipDetailModal
                  open={!!arsipOvDetail}
                  mode={arsipOvDetail?.mode || "view"}
                  item={arsipOvDetail?.item || null}
                  me={me}
                  onClose={() => setArsipOvDetail(null)}
                  onSaved={loadArsipOverview}
                  onRequestReject={(id, type, originLabel) => setArsipOvRejectTarget({ id, type, originLabel })}
                />
              )}

              <RejectModal
                open={!!arsipOvRejectTarget}
                targetId={arsipOvRejectTarget?.id ?? null}
                targetType={arsipOvRejectTarget?.type ?? null}
                originLabel={arsipOvRejectTarget?.originLabel ?? ""}
                onClose={() => setArsipOvRejectTarget(null)}
                onDone={() => { setArsipOvRejectTarget(null); loadArsipOverview(); }}
              />

              <ArsipKoreksiModal
                open={!!arsipOvKoreksiTarget}
                item={arsipOvKoreksiTarget}
                onClose={() => setArsipOvKoreksiTarget(null)}
                onSaved={loadArsipOverview}
              />

              <ArsipStatusHistoryModal open={arsipOvStatusItemId != null} itemId={arsipOvStatusItemId} onClose={() => setArsipOvStatusItemId(null)} />

              {me && (
                <ArsipChatModal
                  open={!!arsipOvChatItem}
                  itemId={arsipOvChatItem?.id ?? null}
                  itemLabel={arsipOvChatItem ? `${arsipOvChatItem.namaArsip} - ${arsipOvChatItem.nomorArsip || "-"}` : ""}
                  departemen={arsipOvChatItem?.departemen ?? null}
                  createdByRole={arsipOvChatItem?.createdByRole ?? null}
                  me={me}
                  onClose={() => setArsipOvChatItem(null)}
                  onRead={loadArsipOverview}
                />
              )}
            </>
          )}

          {arsipSubtab === "transaksi" && (
      <>
      <div className="card">
        <div className="toolbar transactions-page-toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-arsip-search">Cari Arsip</label>
            <input type="text" id="filter-arsip-search" placeholder="No Pemindahan" value={arsipSearchInput} onChange={(e) => handleArsipSearchChange(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="filter-arsip-bulan">Filter Periode</label>
            <PeriodFilterPicker id="filter-arsip-bulan" bulan={arsipFilters.bulan} tanggal={arsipFilters.tanggal} onChangeBulan={(v) => updateArsipFilter({ bulan: v, tanggal: "" })} onChangeTanggal={(v) => updateArsipFilter({ tanggal: v, bulan: "" })} />
          </div>

          <div className="filter-dropdown-wrap" ref={arsipFilterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button type="button" className="btn filter-dropdown-toggle" id="filter-arsip-toggle" style={{ width: "auto" }} onClick={() => setArsipFilterOpen((v) => !v)}>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {arsipFilterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={{ marginBottom: 0 }}>
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
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
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
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="filter-arsip-direktorat">Direktorat</label>
                  <SearchableSelect
                    id="filter-arsip-direktorat"
                    value={arsipFilters.direktorat}
                    onChange={(v) => updateArsipFilter({ direktorat: v, divisi: "", departemen: "" })}
                    options={orgStructure?.direktorat || []}
                    clearLabel="Semua Direktorat"
                    placeholder="Semua Direktorat"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
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
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
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
              </div>
            )}
          </div>

          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetArsipFilters}>Semua Arsip</button>

          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.arsipExportPdfUrl(arsipExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.arsipExportUrl(arsipExportParams()), "_blank")}>
              ⬇ Download Excel
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

          {arsipSubtab === "katalog" && (
            <>
          <div className="card">
            <div className="toolbar transactions-page-toolbar">
              <div className="field toolbar-search-field">
                <label htmlFor="filter-arsip-katalog-search">Cari Arsip</label>
                <input type="text" id="filter-arsip-katalog-search" placeholder="Nama Arsip" value={arsipKatalogSearchInput} onChange={(e) => handleArsipKatalogSearchChange(e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="filter-arsip-katalog-bulan">Filter Periode</label>
                <PeriodFilterPicker id="filter-arsip-katalog-bulan" bulan={arsipKatalogFilters.bulan} tanggal={arsipKatalogFilters.tanggal} onChangeBulan={(v) => updateArsipKatalogFilter({ bulan: v, tanggal: "" })} onChangeTanggal={(v) => updateArsipKatalogFilter({ tanggal: v, bulan: "" })} />
              </div>

              <div className="filter-dropdown-wrap" ref={arsipKatalogFilterWrapRef}>
                <label className="filter-dropdown-label">Filter Lainnya</label>
                <button type="button" className="btn filter-dropdown-toggle" id="filter-arsip-katalog-toggle" style={{ width: "auto" }} onClick={() => setArsipKatalogFilterOpen((v) => !v)}>
                  Semua Filter
                  <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {arsipKatalogFilterOpen && (
                  <div className="filter-dropdown-panel">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="filter-arsip-katalog-kategori">Kategori</label>
                      <SearchableSelect
                        id="filter-arsip-katalog-kategori"
                        value={arsipKatalogFilters.kategori}
                        onChange={(v) => updateArsipKatalogFilter({ kategori: v as ArchiveKategori | "" })}
                        options={Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[]}
                        getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
                        clearLabel="Semua Kategori"
                        placeholder="Semua Kategori"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-arsip-katalog-direktorat">Direktorat</label>
                      <SearchableSelect
                        id="filter-arsip-katalog-direktorat"
                        value={arsipKatalogFilters.direktorat}
                        onChange={(v) => updateArsipKatalogFilter({ direktorat: v, divisi: "", departemen: "" })}
                        options={orgStructure?.direktorat || []}
                        clearLabel="Semua Direktorat"
                        placeholder="Semua Direktorat"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-arsip-katalog-divisi">Divisi</label>
                      <SearchableSelect
                        id="filter-arsip-katalog-divisi"
                        value={arsipKatalogFilters.divisi}
                        onChange={(v) => updateArsipKatalogFilter({ divisi: v, departemen: "" })}
                        options={arsipKatalogDivisiOptions}
                        clearLabel="Semua Divisi"
                        placeholder="Semua Divisi"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-arsip-katalog-departemen">Departemen</label>
                      <SearchableSelect
                        id="filter-arsip-katalog-departemen"
                        value={arsipKatalogFilters.departemen}
                        onChange={(v) => updateArsipKatalogFilter({ departemen: v })}
                        options={arsipKatalogDepartemenOptions}
                        clearLabel="Semua Departemen"
                        placeholder="Semua Departemen"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetArsipKatalogFilters}>Semua Arsip</button>

              <div className="toolbar-actions">
                <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.arsipKatalogExportPdfUrl(currentArsipKatalogExportParams()), "_blank")}>
                  ⬇ Download PDF
                </button>
                <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.arsipKatalogExportUrl(currentArsipKatalogExportParams()), "_blank")}>
                  ⬇ Download Excel
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No</th><th>No Pemindahan</th><th>Tanggal</th><th>Jumlah Arsip</th>
                    <th>Nama Arsip</th><th>Kategori</th><th>Tahun</th>
                    <th>Lokasi Penyimpanan Saat Ini</th><th>Divisi</th><th>Departemen</th>
                    <th>Nama PIC</th><th>No. Telepon PIC</th><th>Catatan</th><th>Tanggal Disetujui</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {arsipKatalogBusy ? (
                    <tr><td colSpan={15} className="table-empty">Memuat data...</td></tr>
                  ) : arsipKatalogError ? (
                    <tr><td colSpan={15} className="table-empty">{arsipKatalogError}</td></tr>
                  ) : arsipKatalogItems.length === 0 ? (
                    <tr><td colSpan={15} className="table-empty">Tidak Ada Data</td></tr>
                  ) : (
                    arsipKatalogItems.map((item, index) => (
                      <tr key={item.id}>
                        <td>{(arsipKatalogFilters.page - 1) * arsipKatalogFilters.limit + index + 1}</td>
                        <td>{item.nomorArsip || "-"}</td>
                        <td>{formatDate(item.tanggal)}</td>
                        <td>{item.jumlahArsip}</td>
                        <td title={item.namaArsip}>{truncateText(item.namaArsip, 30)}</td>
                        <td>{ARCHIVE_KATEGORI_LABEL[item.kategori]}</td>
                        <td>{item.tahunArsip}</td>
                        <td title={item.lokasiPenyimpanan}>{truncateText(item.lokasiPenyimpanan, 25)}</td>
                        <td title={item.divisi}>{truncateText(item.divisi, 18)}</td>
                        <td title={item.departemen || ""}>{truncateText(item.departemen, 18)}</td>
                        <td title={item.namaPic || ""}>{truncateText(item.namaPic, 15)}</td>
                        <td>{item.noTeleponPic || "-"}</td>
                        <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                        <td>{item.approvedApprovalGaAt ? formatDate(item.approvedApprovalGaAt) : "-"}</td>
                        <td>
                          <div className="status-cell">
                            <span className="badge badge-approved">Approved</span>
                            <button
                              type="button"
                              className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}`}
                              aria-label="Chat"
                              onClick={() => setArsipKatalogChatItem(item)}
                            >
                              <MessageSquare width="17" height="17" />
                              {item.unreadChatCount > 0 && (
                                <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                              )}
                            </button>
                            <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => arsipKatalogRowMenu.toggle(e, item.id, 120)}>
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
                  <label htmlFor="filter-arsip-katalog-limit">Tampilkan</label>
                  <SearchableSelect
                    id="filter-arsip-katalog-limit"
                    value={String(arsipKatalogFilters.limit)}
                    onChange={(v) => updateArsipKatalogFilter({ limit: Number(v) })}
                    options={["5", "10", "20", "50"]}
                    getLabel={(v) => `${v} Arsip`}
                    placeholder={`${arsipKatalogFilters.limit} Arsip`}
                  />
                </div>
              </div>
              <div className="pagination-right">
                <span className="text-secondary">Total {arsipKatalogTotal} Arsip · Halaman {arsipKatalogFilters.page} dari {arsipKatalogTotalPages}</span>
                <div className="pages">
                  <button className="page-btn" disabled={arsipKatalogFilters.page <= 1} onClick={() => goToArsipKatalogPage(arsipKatalogFilters.page - 1)}>‹</button>
                  {arsipKatalogPageButtons.map((p) => (
                    <button key={p} className={`page-btn ${p === arsipKatalogFilters.page ? "active" : ""}`} onClick={() => goToArsipKatalogPage(p)}>{p}</button>
                  ))}
                  <button className="page-btn" disabled={arsipKatalogFilters.page >= arsipKatalogTotalPages} onClick={() => goToArsipKatalogPage(arsipKatalogFilters.page + 1)}>›</button>
                </div>
              </div>
            </div>
          </div>

          <RowMenuDropdown
            position={arsipKatalogRowMenu.position}
            canEditDelete={false}
            canDelete={false}
            onDetail={() => {
              const item = arsipKatalogRowMenu.menuItem;
              arsipKatalogRowMenu.close();
              if (item) openArsipKatalogDetail(item.id);
            }}
            onUpdates={() => {}}
            onStatus={() => {
              const item = arsipKatalogRowMenu.menuItem;
              arsipKatalogRowMenu.close();
              if (item) setArsipKatalogStatusItemId(item.id);
            }}
            onDelete={() => {}}
            pdfUrl={arsipKatalogRowMenu.menuItem ? api.arsipPdfUrl(arsipKatalogRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = arsipKatalogRowMenu.menuItem;
              arsipKatalogRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.arsipPdfUrl(item.id), `Bukti-Pemindahan-Arsip-${item.nomorArsip || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <ArsipDetailModal
            open={!!arsipKatalogDetail}
            mode="view"
            item={arsipKatalogDetail}
            me={me}
            onClose={() => setArsipKatalogDetail(null)}
            onSaved={() => {}}
            onRequestReject={() => {}}
          />

          <ArsipStatusHistoryModal open={arsipKatalogStatusItemId != null} itemId={arsipKatalogStatusItemId} onClose={() => setArsipKatalogStatusItemId(null)} />

          <ArsipChatModal
            open={!!arsipKatalogChatItem}
            itemId={arsipKatalogChatItem?.id ?? null}
            itemLabel={arsipKatalogChatItem ? `${arsipKatalogChatItem.namaArsip} - ${arsipKatalogChatItem.nomorArsip || "-"}` : ""}
            departemen={arsipKatalogChatItem?.departemen ?? null}
            me={me}
            onClose={() => setArsipKatalogChatItem(null)}
            onRead={loadArsipKatalog}
          />
            </>
          )}
        </>
      )}

      {activeTab === "atk" && (
        <>
          <div className="superadmin-subtabs">
            <button
              type="button"
              className={`superadmin-subtab-btn ${atkSubtab === "overview" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setAtkSubtab("overview")}
            >
              Overview ({atkOvItems.length})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${atkSubtab === "pesanan" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setAtkSubtab("pesanan")}
            >
              Transaction ({atkTotal})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${atkSubtab === "invoice" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setAtkSubtab("invoice")}
            >
              Invoice ({atkInvoiceTotal})
            </button>
          </div>

          {atkSubtab === "overview" && (
            <>
              <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
                <WelcomeGreeting me={me} />
                <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setAtkOvFormOpen(true)}>
                  + Pesan Kebutuhan Kantor
                </button>
              </div>

              {atkOvStats && (
                <div className="stat-grid">
                  <div className="stat-tile"><div className="value">{atkOvStats.waitingL1}</div><div className="label">Approval Departemen/Divisi</div></div>
                  <div className="stat-tile"><div className="value">{atkOvStats.waitingGa}</div><div className="label">Admin General Affair</div></div>
                  <div className="stat-tile"><div className="value">{atkOvStats.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
                  <div className="stat-tile"><div className="value">{atkOvStats.waitingKpu}</div><div className="label">Mitra</div></div>
                  <div className="stat-tile"><div className="value">{atkOvStats.approved}</div><div className="label">Approved</div></div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Pesanan Terbaru</h3>
                <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
                  <SearchableSelect
                    id="sa-atk-overview-status-filter"
                    value={atkOvStatusFilter}
                    onChange={(v) => setAtkOvStatusFilter(v as typeof atkOvStatusFilter)}
                    options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
                    getLabel={(v) => ({
                      ALL: "Semua Status", DRAFT: "Draft", ON_APPROVAL: "On-Approval", APPROVED: "Approved", REJECTED: "Rejected",
                    } as Record<string, string>)[v] || v}
                    placeholder="Semua Status"
                  />
                </div>
              </div>

              {atkOvBusy ? (
                <p className="text-secondary">Memuat data...</p>
              ) : atkOvFilteredItems.length === 0 ? (
                <div className="card table-empty">Tidak Ada Data</div>
              ) : (
                atkOvFilteredItems.map((item) => {
                  const isDraft = item.status === "DRAFT";
                  const borderClass = cardStatusBorderClass(item.status);
                  return (
                    <div
                      className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`}
                      style={{ marginBottom: 14, cursor: isDraft ? "pointer" : undefined }}
                      onClick={isDraft ? () => setAtkOvDetail({ item, mode: "view" }) : undefined}
                      key={item.id}
                    >
                      <div className="card-header">
                        <div className="card-header-title">
                          <strong>{item.keperluan} - {item.nomorPermintaan || "-"}</strong>
                          <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                            {formatDate(item.tanggal)} · {item.departemen || item.divisi}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <AtkStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} />
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={(e) => { e.stopPropagation(); setAtkOvChatItem(item); }}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); atkOvRowMenu.toggle(e, item.id, 180); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </div>
                      <AtkStepper status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} />
                      {item.rejectReason && (
                        <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                          <strong>Catatan Penolakan:</strong> {item.rejectReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <RowMenuDropdown
                position={atkOvRowMenu.position}
                canEditDelete={
                  !!atkOvRowMenu.menuItem &&
                  (isAtkEditableByOrigin(atkOvRowMenu.menuItem, me!) || canGaUpdateAtk(atkOvRowMenu.menuItem, me!) || canKoreksiHargaAtk(atkOvRowMenu.menuItem, me!))
                }
                canDelete={!!atkOvRowMenu.menuItem && isAtkEditableByOrigin(atkOvRowMenu.menuItem, me!)}
                onDetail={() => {
                  const item = atkOvRowMenu.menuItem;
                  atkOvRowMenu.close();
                  if (item) setAtkOvDetail({ item, mode: "view" });
                }}
                onUpdates={() => {
                  const item = atkOvRowMenu.menuItem;
                  atkOvRowMenu.close();
                  if (!item || !me) return;
                  if (isAtkEditableByOrigin(item, me)) setAtkOvDetail({ item, mode: "edit" });
                  else if (canGaUpdateAtk(item, me)) setAtkOvDetail({ item, mode: "ga-edit" });
                  else if (canKoreksiHargaAtk(item, me)) setAtkOvDetail({ item, mode: "kpu-edit" });
                }}
                onStatus={() => {
                  const item = atkOvRowMenu.menuItem;
                  atkOvRowMenu.close();
                  if (item) setAtkOvStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = atkOvRowMenu.menuItem;
                  atkOvRowMenu.close();
                  if (item) atkOvHandleDelete(item);
                }}
                pdfUrl={atkOvRowMenu.menuItem && isAtkPdfAvailable(atkOvRowMenu.menuItem) ? api.atkPdfUrl(atkOvRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = atkOvRowMenu.menuItem;
                  atkOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.atkPdfUrl(item.id), `Bukti-Pesanan-Kebutuhan-Kantor-${item.nomorPermintaan || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <AtkFormModal open={atkOvFormOpen} me={me} onClose={() => setAtkOvFormOpen(false)} onCreated={loadAtkOverview} />
              )}

              {me && (
                <AtkDetailModal
                  open={!!atkOvDetail}
                  mode={atkOvDetail?.mode || "view"}
                  item={atkOvDetail?.item || null}
                  me={me}
                  onClose={() => setAtkOvDetail(null)}
                  onSaved={loadAtkOverview}
                  onRequestReject={(id, type, originLabel) => setAtkOvRejectTarget({ id, type, originLabel })}
                />
              )}

              <RejectModal
                open={!!atkOvRejectTarget}
                targetId={atkOvRejectTarget?.id ?? null}
                targetType={atkOvRejectTarget?.type ?? null}
                originLabel={atkOvRejectTarget?.originLabel ?? ""}
                onClose={() => setAtkOvRejectTarget(null)}
                onDone={() => { setAtkOvRejectTarget(null); loadAtkOverview(); }}
              />

              <AtkStatusHistoryModal open={atkOvStatusItemId != null} itemId={atkOvStatusItemId} onClose={() => setAtkOvStatusItemId(null)} />

              {me && (
                <AtkChatModal
                  open={!!atkOvChatItem}
                  itemId={atkOvChatItem?.id ?? null}
                  itemLabel={atkOvChatItem ? `${atkOvChatItem.keperluan} - ${atkOvChatItem.nomorPermintaan || "-"}` : ""}
                  departemen={atkOvChatItem?.departemen ?? null}
                  createdByRole={atkOvChatItem?.createdByRole ?? null}
                  me={me}
                  onClose={() => setAtkOvChatItem(null)}
                  onRead={loadAtkOverview}
                />
              )}
            </>
          )}

          {atkSubtab === "pesanan" && (
      <>
      <div className="card">
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
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetAtkFilters}>Semua Pesanan</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.atkExportPdfUrl(atkExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.atkExportUrl(atkExportParams()), "_blank")}>
              ⬇ Download Excel
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

          {atkSubtab === "invoice" && (
      <div className="card">
        <div className="invoice-toolbar-slim invoices-page-toolbar">
          <div className="field invoice-search-field" style={FIELD_NO_MARGIN_STYLE}>
            <label htmlFor="atk-invoice-filter-search">Cari Invoice</label>
            <input
              type="text"
              id="atk-invoice-filter-search"
              placeholder="Nama Invoice"
              value={atkInvoiceSearchInput}
              onChange={(e) => handleAtkInvoiceSearchChange(e.target.value)}
            />
          </div>
          <div className="field invoice-filter-field" style={FIELD_NO_MARGIN_STYLE}>
            <label htmlFor="atk-invoice-filter-bulan">Filter Bulan</label>
            <MonthFilterPicker
              id="atk-invoice-filter-bulan"
              value={atkInvoiceFilterBulan}
              onChange={(v) => { setAtkInvoiceFilterBulan(v); setAtkInvoicePage(1); }}
            />
          </div>
          {atkInvoiceUploaders.length > 1 && (
            <div className="field invoice-filter-field" style={FIELD_NO_MARGIN_STYLE}>
              <label htmlFor="atk-invoice-filter-uploader">Diunggah Oleh</label>
              <SearchableSelect
                id="atk-invoice-filter-uploader"
                value={String(atkInvoiceFilterUploader)}
                onChange={(v) => { setAtkInvoiceFilterUploader(v === "" ? "" : Number(v)); setAtkInvoicePage(1); }}
                options={atkInvoiceUploaders.map((u) => String(u.id))}
                getLabel={(v) => atkInvoiceUploaders.find((u) => String(u.id) === v)?.nama || v}
                clearLabel="Semua Mitra"
                placeholder="Semua Mitra"
              />
            </div>
          )}
          <div className="field" style={FIELD_NO_MARGIN_STYLE}>
            <span className="field-label-spacer">Semua Invoice</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={AUTO_WIDTH_STYLE}
              onClick={() => { setAtkInvoiceSearchInput(""); setAtkInvoiceSearch(""); setAtkInvoiceFilterBulan(""); setAtkInvoiceFilterUploader(""); setAtkInvoicePage(1); }}
            >
              Semua Invoice
            </button>
          </div>
          <button type="button" className="btn btn-primary invoice-input-btn" style={AUTO_WIDTH_STYLE} onClick={() => setAtkInvoiceUploadOpen(true)}>
            + Input Invoice
          </button>
        </div>

        <div className="invoice-list">
          {atkInvoiceError ? (
            <p className="text-secondary">{atkInvoiceError}</p>
          ) : atkInvoices == null ? (
            <p className="text-secondary">Memuat data invoice...</p>
          ) : atkInvoices.length === 0 ? (
            <p className="text-secondary">{atkInvoiceFilterBulan ? "Tidak ada invoice untuk filter ini." : "Belum ada invoice."}</p>
          ) : (
            atkInvoices.map((inv) => (
              <div className="invoice-row" key={inv.id}>
                <div className="invoice-row-main">
                  <div className="invoice-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div className="invoice-row-info">
                    <div className="invoice-row-title">Invoice {invoiceBulanLabel(inv.bulan)} - {inv.nama}</div>
                    <div className="invoice-row-meta">
                      Diunggah: {formatDateTime(inv.uploadedAt)}
                      {atkInvoiceUploaders.length > 1 && inv.uploaderNama ? ` oleh ${inv.uploaderNama}` : ""}
                    </div>
                    {inv.reviewedAt && <div className="invoice-row-meta">Ditinjau: {formatDateTime(inv.reviewedAt)}</div>}
                    {inv.catatan && <div className="invoice-row-note"><strong>Catatan:</strong> {inv.catatan}</div>}
                  </div>
                </div>
                <div className="invoice-row-actions">
                  {inv.status === "REJECTED" ? (
                    <div className="badge-stack">
                      <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                      <span className="badge badge-waiting">Waiting: Mitra</span>
                    </div>
                  ) : (
                    <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                  )}
                  <button
                    type="button"
                    className={`card-icon-btn${inv.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}`}
                    aria-label="Chat"
                    onClick={() => setAtkInvoiceChatItem(inv)}
                  >
                    <MessageSquare width="17" height="17" />
                    {inv.unreadChatCount > 0 && (
                      <span className="chat-count-badge">{inv.unreadChatCount > 9 ? "9+" : inv.unreadChatCount}</span>
                    )}
                  </button>
                  <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => atkInvoiceRowMenu.toggle(e, inv.id)}>
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
              <label htmlFor="atk-invoice-limit">Tampilkan</label>
              <SearchableSelect
                id="atk-invoice-limit"
                value={String(atkInvoiceLimit)}
                onChange={(v) => { setAtkInvoiceLimit(Number(v)); setAtkInvoicePage(1); }}
                options={["5", "10", "20", "50"]}
                getLabel={(v) => `${v} Invoice`}
                placeholder={`${atkInvoiceLimit} Invoice`}
              />
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {atkInvoiceTotal} Invoice · Halaman {atkInvoicePage} dari {atkInvoiceTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={atkInvoicePage <= 1} onClick={() => setAtkInvoicePage(atkInvoicePage - 1)}>‹</button>
              {atkInvoicePageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === atkInvoicePage ? "active" : ""}`} onClick={() => setAtkInvoicePage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={atkInvoicePage >= atkInvoiceTotalPages} onClick={() => setAtkInvoicePage(atkInvoicePage + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>
          )}
        </>
      )}

      {activeTab === "sarana" && (
        <>
          <div className="superadmin-subtabs">
            <button
              type="button"
              className={`superadmin-subtab-btn ${saranaSubtab === "overview" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setSaranaSubtab("overview")}
            >
              Overview ({saranaOvItems.length})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${saranaSubtab === "transaksi" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setSaranaSubtab("transaksi")}
            >
              Transaction ({saranaTotal})
            </button>
            <button
              type="button"
              className={`superadmin-subtab-btn ${saranaSubtab === "katalog" ? "superadmin-subtab-btn-active" : ""}`}
              onClick={() => setSaranaSubtab("katalog")}
            >
              Repository ({saranaKatalogTotal})
            </button>
          </div>

          {saranaSubtab === "overview" && (
            <>
              <div className="card-header dashboard-welcome-header" style={{ marginBottom: 18 }}>
                <WelcomeGreeting me={me} />
                <button className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={() => setSaranaOvFormOpen(true)}>
                  + Ajukan Perbaikan
                </button>
              </div>

              {saranaOvStats && (
                <div className="stat-grid">
                  <div className="stat-tile"><div className="value">{saranaOvStats.waitingL1}</div><div className="label">Approval Departemen/Divisi</div></div>
                  <div className="stat-tile"><div className="value">{saranaOvStats.waitingGa}</div><div className="label">Admin General Affair</div></div>
                  <div className="stat-tile"><div className="value">{saranaOvStats.waitingGaApproval}</div><div className="label">Approval General Affair</div></div>
                  <div className="stat-tile"><div className="value">{saranaOvStats.approved}</div><div className="label">Approved</div></div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 12px", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Pengajuan Terbaru</h3>
                <div className="field overview-status-filter-field" style={{ marginBottom: 0, width: 160 }}>
                  <SearchableSelect
                    id="sa-sarana-overview-status-filter"
                    value={saranaOvStatusFilter}
                    onChange={(v) => setSaranaOvStatusFilter(v as typeof saranaOvStatusFilter)}
                    options={["ALL", "DRAFT", "ON_APPROVAL", "APPROVED", "REJECTED"]}
                    getLabel={(v) => ({
                      ALL: "Semua Status", DRAFT: "Draft", ON_APPROVAL: "On-Approval", APPROVED: "Approved", REJECTED: "Rejected",
                    } as Record<string, string>)[v] || v}
                    placeholder="Semua Status"
                  />
                </div>
              </div>

              {saranaOvBusy ? (
                <p className="text-secondary">Memuat data...</p>
              ) : saranaOvFilteredItems.length === 0 ? (
                <div className="card table-empty">Tidak Ada Data</div>
              ) : (
                saranaOvFilteredItems.map((item) => {
                  const borderClass = bookingStatusBorderClass(item.status);
                  return (
                    <div className={`card item-row-card${borderClass ? ` ${borderClass}` : ""}`} style={{ marginBottom: 14 }} key={item.id}>
                      <div className="card-header">
                        <div className="card-header-title">
                          <strong>{item.lokasi} - {item.nomorPerbaikan || "-"}</strong>
                          <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                            {formatDate(item.tanggal)} · {item.departemen || item.divisi}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <BookingStatusBadge status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} revisable />
                          {item.status === "APPROVED_GA_APPROVAL" && item.executionStage !== "MENUNGGU" && (
                            <span className="badge badge-pending">{EXECUTION_STAGE_LABEL[item.executionStage]}</span>
                          )}
                          <button
                            type="button"
                            className={`card-icon-btn${item.unreadChatCount > 0 ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={(e) => { e.stopPropagation(); setSaranaOvChatItem(item); }}
                          >
                            <MessageSquare width="17" height="17" />
                            {item.unreadChatCount > 0 && (
                              <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                            )}
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => { e.stopPropagation(); saranaOvRowMenu.toggle(e, item.id, 180); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </div>
                      <RoomBookingStepper status={item.status} departemen={item.departemen} createdByRole={item.createdByRole} />
                      {item.rejectReason && (
                        <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
                          <strong>Catatan Penolakan:</strong> {item.rejectReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <RowMenuDropdown
                position={saranaOvRowMenu.position}
                canEditDelete={
                  !!saranaOvRowMenu.menuItem &&
                  (isSaranaEditableByOrigin(saranaOvRowMenu.menuItem, me!) || canGaKoreksiSarana(saranaOvRowMenu.menuItem, me!))
                }
                canDelete={!!saranaOvRowMenu.menuItem && isSaranaEditableByOrigin(saranaOvRowMenu.menuItem, me!)}
                onDetail={() => {
                  const item = saranaOvRowMenu.menuItem;
                  saranaOvRowMenu.close();
                  if (item) setSaranaOvDetail({ item, mode: "view" });
                }}
                onUpdates={() => {
                  const item = saranaOvRowMenu.menuItem;
                  saranaOvRowMenu.close();
                  if (!item || !me) return;
                  if (isSaranaEditableByOrigin(item, me)) setSaranaOvDetail({ item, mode: "edit" });
                  else if (canGaKoreksiSarana(item, me)) setSaranaOvKoreksiTarget(item);
                }}
                onStatus={() => {
                  const item = saranaOvRowMenu.menuItem;
                  saranaOvRowMenu.close();
                  if (item) setSaranaOvStatusItemId(item.id);
                }}
                onDelete={() => {
                  const item = saranaOvRowMenu.menuItem;
                  saranaOvRowMenu.close();
                  if (item) saranaOvHandleDelete(item);
                }}
                pdfUrl={saranaOvRowMenu.menuItem && isSaranaPdfAvailable(saranaOvRowMenu.menuItem) ? api.saranaPdfUrl(saranaOvRowMenu.menuItem.id) : undefined}
                onPdfClick={async () => {
                  const item = saranaOvRowMenu.menuItem;
                  saranaOvRowMenu.close();
                  if (!item) return;
                  try {
                    await downloadFile(api.saranaPdfUrl(item.id), `Bukti-Pengajuan-Perbaikan-${item.nomorPerbaikan || item.id}.pdf`);
                  } catch (err) {
                    showToast((err as Error).message, "error");
                  }
                }}
              />

              {me && (
                <SaranaFormModal open={saranaOvFormOpen} me={me} onClose={() => setSaranaOvFormOpen(false)} onCreated={loadSaranaOverview} />
              )}

              {me && (
                <SaranaDetailModal
                  open={!!saranaOvDetail}
                  mode={saranaOvDetail?.mode || "view"}
                  item={saranaOvDetail?.item || null}
                  me={me}
                  onClose={() => setSaranaOvDetail(null)}
                  onSaved={loadSaranaOverview}
                  onRequestReject={(id, type, originLabel) => setSaranaOvRejectTarget({ id, type, originLabel })}
                />
              )}

              <SaranaKoreksiModal
                open={!!saranaOvKoreksiTarget}
                item={saranaOvKoreksiTarget}
                onClose={() => setSaranaOvKoreksiTarget(null)}
                onSaved={loadSaranaOverview}
              />

              <RejectModal
                open={!!saranaOvRejectTarget}
                targetId={saranaOvRejectTarget?.id ?? null}
                targetType={saranaOvRejectTarget?.type ?? null}
                originLabel={saranaOvRejectTarget?.originLabel ?? ""}
                onClose={() => setSaranaOvRejectTarget(null)}
                onDone={() => { setSaranaOvRejectTarget(null); loadSaranaOverview(); }}
              />

              <SaranaStatusHistoryModal open={saranaOvStatusItemId != null} itemId={saranaOvStatusItemId} onClose={() => setSaranaOvStatusItemId(null)} />

              {me && (
                <SaranaChatModal
                  open={!!saranaOvChatItem}
                  itemId={saranaOvChatItem?.id ?? null}
                  itemLabel={saranaOvChatItem ? `${saranaOvChatItem.lokasi} - ${saranaOvChatItem.nomorPerbaikan || "-"}` : ""}
                  departemen={saranaOvChatItem?.departemen ?? null}
                  createdByRole={saranaOvChatItem?.createdByRole ?? null}
                  me={me}
                  onClose={() => setSaranaOvChatItem(null)}
                  onRead={loadSaranaOverview}
                />
              )}
            </>
          )}

          {saranaSubtab === "transaksi" && (
      <>
      <div className="card">
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
          <button className="btn btn-secondary" style={RESET_FILTER_BUTTON_STYLE} onClick={resetSaranaFilters}>Semua Pengajuan</button>
          <div className="toolbar-actions">
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.saranaExportPdfUrl(saranaExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-secondary" style={AUTO_WIDTH_STYLE} onClick={() => window.open(api.saranaExportUrl(saranaExportParams()), "_blank")}>
              ⬇ Download Excel
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

          {saranaSubtab === "katalog" && (
            <>
          <div className="card">
            <div className="toolbar transactions-page-toolbar">
              <div className="field toolbar-search-field">
                <label htmlFor="filter-sarana-katalog-search">Cari Laporan</label>
                <input type="text" id="filter-sarana-katalog-search" placeholder="Nama Laporan" value={saranaKatalogSearchInput} onChange={(e) => handleSaranaKatalogSearchChange(e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="filter-sarana-katalog-bulan">Filter Periode</label>
                <PeriodFilterPicker id="filter-sarana-katalog-bulan" bulan={saranaKatalogFilters.bulan} tanggal={saranaKatalogFilters.tanggal} onChangeBulan={(v) => updateSaranaKatalogFilter({ bulan: v, tanggal: "" })} onChangeTanggal={(v) => updateSaranaKatalogFilter({ tanggal: v, bulan: "" })} />
              </div>

              <div className="filter-dropdown-wrap" ref={saranaKatalogFilterWrapRef}>
                <label className="filter-dropdown-label">Filter Lainnya</label>
                <button type="button" className="btn filter-dropdown-toggle" id="filter-sarana-katalog-toggle" style={{ width: "auto" }} onClick={() => setSaranaKatalogFilterOpen((v) => !v)}>
                  Semua Filter
                  <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {saranaKatalogFilterOpen && (
                  <div className="filter-dropdown-panel">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="filter-sarana-katalog-kategori">Kategori</label>
                      <SearchableSelect
                        id="filter-sarana-katalog-kategori"
                        value={saranaKatalogFilters.kategori}
                        onChange={(v) => updateSaranaKatalogFilter({ kategori: v as KategoriKerusakan | "" })}
                        options={KATEGORI_OPTIONS}
                        getLabel={(v) => KATEGORI_KERUSAKAN_LABEL[v as KategoriKerusakan] || v}
                        clearLabel="Semua Kategori"
                        placeholder="Semua Kategori"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-sarana-katalog-direktorat">Direktorat</label>
                      <SearchableSelect
                        id="filter-sarana-katalog-direktorat"
                        value={saranaKatalogFilters.direktorat}
                        onChange={(v) => updateSaranaKatalogFilter({ direktorat: v, divisi: "", departemen: "" })}
                        options={orgStructure?.direktorat || []}
                        clearLabel="Semua Direktorat"
                        placeholder="Semua Direktorat"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-sarana-katalog-divisi">Divisi</label>
                      <SearchableSelect
                        id="filter-sarana-katalog-divisi"
                        value={saranaKatalogFilters.divisi}
                        onChange={(v) => updateSaranaKatalogFilter({ divisi: v, departemen: "" })}
                        options={saranaKatalogDivisiOptions}
                        clearLabel="Semua Divisi"
                        placeholder="Semua Divisi"
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-sarana-katalog-departemen">Departemen</label>
                      <SearchableSelect
                        id="filter-sarana-katalog-departemen"
                        value={saranaKatalogFilters.departemen}
                        onChange={(v) => updateSaranaKatalogFilter({ departemen: v })}
                        options={saranaKatalogDepartemenOptions}
                        clearLabel="Semua Departemen"
                        placeholder="Semua Departemen"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetSaranaKatalogFilters}>Semua Laporan</button>

              <div className="toolbar-actions">
                <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.saranaKatalogExportPdfUrl(currentSaranaKatalogExportParams()), "_blank")}>
                  ⬇ Download PDF
                </button>
                <button className="btn btn-secondary" style={{ width: "auto" }} onClick={() => window.open(api.saranaKatalogExportUrl(currentSaranaKatalogExportParams()), "_blank")}>
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
                  {saranaKatalogBusy ? (
                    <tr><td colSpan={13} className="table-empty">Memuat data...</td></tr>
                  ) : saranaKatalogError ? (
                    <tr><td colSpan={13} className="table-empty">{saranaKatalogError}</td></tr>
                  ) : saranaKatalogItems.length === 0 ? (
                    <tr><td colSpan={13} className="table-empty">Tidak Ada Data</td></tr>
                  ) : (
                    saranaKatalogItems.map((item, index) => (
                      <tr key={item.id}>
                        <td>{(saranaKatalogFilters.page - 1) * saranaKatalogFilters.limit + index + 1}</td>
                        <td>{item.nomorPerbaikan || "-"}</td>
                        <td>{formatDate(item.tanggal)}</td>
                        <td title={item.lokasi}>{truncateText(item.lokasi, 25)}</td>
                        <td>{KATEGORI_KERUSAKAN_LABEL[item.kategori]}</td>
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
                              onClick={() => setSaranaKatalogChatItem(item)}
                            >
                              <MessageSquare width="17" height="17" />
                              {item.unreadChatCount > 0 && (
                                <span className="chat-count-badge">{item.unreadChatCount > 9 ? "9+" : item.unreadChatCount}</span>
                              )}
                            </button>
                            <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => saranaKatalogRowMenu.toggle(e, item.id, 120)}>
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
                    value={String(saranaKatalogFilters.limit)}
                    onChange={(v) => updateSaranaKatalogFilter({ limit: Number(v) })}
                    options={["5", "10", "20", "50"]}
                    getLabel={(v) => `${v} Laporan`}
                    placeholder={`${saranaKatalogFilters.limit} Laporan`}
                  />
                </div>
              </div>
              <div className="pagination-right">
                <span className="text-secondary">Total {saranaKatalogTotal} Laporan · Halaman {saranaKatalogFilters.page} dari {saranaKatalogTotalPages}</span>
                <div className="pages">
                  <button className="page-btn" disabled={saranaKatalogFilters.page <= 1} onClick={() => goToSaranaKatalogPage(saranaKatalogFilters.page - 1)}>‹</button>
                  {saranaKatalogPageButtons.map((p) => (
                    <button key={p} className={`page-btn ${p === saranaKatalogFilters.page ? "active" : ""}`} onClick={() => goToSaranaKatalogPage(p)}>{p}</button>
                  ))}
                  <button className="page-btn" disabled={saranaKatalogFilters.page >= saranaKatalogTotalPages} onClick={() => goToSaranaKatalogPage(saranaKatalogFilters.page + 1)}>›</button>
                </div>
              </div>
            </div>
          </div>

          <RowMenuDropdown
            position={saranaKatalogRowMenu.position}
            canEditDelete={false}
            canDelete={false}
            onDetail={() => {
              const item = saranaKatalogRowMenu.menuItem;
              saranaKatalogRowMenu.close();
              if (item) openSaranaKatalogDetail(item.id);
            }}
            onUpdates={() => {}}
            onStatus={() => {
              const item = saranaKatalogRowMenu.menuItem;
              saranaKatalogRowMenu.close();
              if (item) setSaranaKatalogStatusItemId(item.id);
            }}
            onDelete={() => {}}
            pdfUrl={saranaKatalogRowMenu.menuItem ? api.saranaPdfUrl(saranaKatalogRowMenu.menuItem.id) : undefined}
            onPdfClick={async () => {
              const item = saranaKatalogRowMenu.menuItem;
              saranaKatalogRowMenu.close();
              if (!item) return;
              try {
                await downloadFile(api.saranaPdfUrl(item.id), `Bukti-Perbaikan-Sarana-${item.nomorPerbaikan || item.id}.pdf`);
              } catch (err) {
                showToast((err as Error).message, "error");
              }
            }}
          />

          <SaranaDetailModal
            open={!!saranaKatalogDetail}
            mode="view"
            item={saranaKatalogDetail}
            me={me}
            onClose={() => setSaranaKatalogDetail(null)}
            onSaved={() => {}}
            onRequestReject={() => {}}
          />

          <SaranaStatusHistoryModal open={saranaKatalogStatusItemId != null} itemId={saranaKatalogStatusItemId} onClose={() => setSaranaKatalogStatusItemId(null)} />

          <SaranaChatModal
            open={!!saranaKatalogChatItem}
            itemId={saranaKatalogChatItem?.id ?? null}
            itemLabel={saranaKatalogChatItem ? `${saranaKatalogChatItem.lokasi} - ${saranaKatalogChatItem.nomorPerbaikan || "-"}` : ""}
            departemen={saranaKatalogChatItem?.departemen ?? null}
            me={me}
            onClose={() => setSaranaKatalogChatItem(null)}
            onRead={loadSaranaKatalog}
          />
            </>
          )}
        </>
      )}

      {activeTab === "organisasi" && <SuperAdminOrgTab />}

      {activeTab === "users" && <SuperAdminUsersTab orgStructure={orgStructure} />}

      <InvoiceRowMenuDropdown
        position={invoiceRowMenu.position}
        // Updates re-uses InvoiceController.UpdateInvoice, whose own item.UploadedBy === user.Id
        // ownership check has no Super Admin exception (me.role is always SUPER_ADMIN on this
        // page) - so this only actually succeeds for an invoice Super Admin uploaded themselves.
        showUpdates={!!invoiceRowMenu.menuItem && !!me && invoiceRowMenu.menuItem.uploadedBy === me.id && (invoiceRowMenu.menuItem.status === "REJECTED" || invoiceRowMenu.menuItem.status === "DRAFT")}
        // Unlike Updates, DeleteInvoice on the backend does special-case Super Admin (deletes any
        // invoice regardless of owner/status, logged as an audited deletion) - so this bypasses
        // unconditionally.
        showDelete={!!invoiceRowMenu.menuItem}
        pdfViewUrl={invoiceRowMenu.menuItem ? api.invoiceFileUrl(invoiceRowMenu.menuItem.id) : "#"}
        pdfDownloadUrl={invoiceRowMenu.menuItem ? api.invoiceDownloadUrl(invoiceRowMenu.menuItem.id) : "#"}
        onDetail={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) setInvoiceDetail(item);
        }}
        onUpdates={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) setInvoiceUpdateTarget(item);
        }}
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

      <InvoiceUploadModal
        open={invoiceUploadOpen}
        onClose={() => setInvoiceUploadOpen(false)}
        onDone={() => {
          setInvoiceUploadOpen(false);
          loadInvoices();
        }}
      />

      <InvoiceDetailModal
        open={!!invoiceDetail}
        item={invoiceDetail}
        me={me}
        onClose={() => setInvoiceDetail(null)}
        onRequestAction={(id) => setInvoiceRejectId(id)}
        onSubmitted={() => {
          setInvoiceDetail(null);
          loadInvoices();
        }}
      />

      <InvoiceActionModal
        open={invoiceRejectId != null}
        invoiceId={invoiceRejectId}
        onClose={() => setInvoiceRejectId(null)}
        onDone={() => {
          setInvoiceRejectId(null);
          setInvoiceDetail(null);
          loadInvoices();
        }}
      />

      <InvoiceUpdateModal
        open={!!invoiceUpdateTarget}
        item={invoiceUpdateTarget}
        onClose={() => setInvoiceUpdateTarget(null)}
        onDone={() => {
          setInvoiceUpdateTarget(null);
          loadInvoices();
        }}
      />

      <InvoiceHistoryModal
        open={invoiceHistoryId != null}
        invoiceId={invoiceHistoryId}
        onClose={() => setInvoiceHistoryId(null)}
      />

      <InvoiceChatModal
        open={!!invoiceChatItem}
        itemId={invoiceChatItem?.id ?? null}
        itemLabel={invoiceChatItem ? `Invoice ${invoiceBulanLabel(invoiceChatItem.bulan)} - ${invoiceChatItem.nama}` : ""}
        me={me}
        onClose={() => setInvoiceChatItem(null)}
        onRead={() => loadInvoices()}
      />

      <InvoiceRowMenuDropdown
        position={atkInvoiceRowMenu.position}
        showUpdates={!!atkInvoiceRowMenu.menuItem && !!me && atkInvoiceRowMenu.menuItem.uploadedBy === me.id && (atkInvoiceRowMenu.menuItem.status === "REJECTED" || atkInvoiceRowMenu.menuItem.status === "DRAFT")}
        showDelete={!!atkInvoiceRowMenu.menuItem}
        pdfViewUrl={atkInvoiceRowMenu.menuItem ? api.atkInvoiceFileUrl(atkInvoiceRowMenu.menuItem.id) : "#"}
        pdfDownloadUrl={atkInvoiceRowMenu.menuItem ? api.atkInvoiceDownloadUrl(atkInvoiceRowMenu.menuItem.id) : "#"}
        onDetail={() => {
          const item = atkInvoiceRowMenu.menuItem;
          atkInvoiceRowMenu.close();
          if (item) setAtkInvoiceDetail(item);
        }}
        onUpdates={() => {
          const item = atkInvoiceRowMenu.menuItem;
          atkInvoiceRowMenu.close();
          if (item) setAtkInvoiceUpdateTarget(item);
        }}
        onRiwayat={() => {
          const item = atkInvoiceRowMenu.menuItem;
          atkInvoiceRowMenu.close();
          if (item) setAtkInvoiceHistoryId(item.id);
        }}
        onDelete={() => {
          const item = atkInvoiceRowMenu.menuItem;
          atkInvoiceRowMenu.close();
          if (item) handleDeleteAtkInvoice(item);
        }}
        onLinkClick={() => atkInvoiceRowMenu.close()}
      />

      <AtkInvoiceUploadModal
        open={atkInvoiceUploadOpen}
        onClose={() => setAtkInvoiceUploadOpen(false)}
        onDone={() => {
          setAtkInvoiceUploadOpen(false);
          loadAtkInvoices();
        }}
      />

      <AtkInvoiceDetailModal
        open={!!atkInvoiceDetail}
        item={atkInvoiceDetail}
        me={me}
        onClose={() => setAtkInvoiceDetail(null)}
        onRequestAction={(id) => setAtkInvoiceRejectId(id)}
        onSubmitted={() => {
          setAtkInvoiceDetail(null);
          loadAtkInvoices();
        }}
      />

      <AtkInvoiceActionModal
        open={atkInvoiceRejectId != null}
        invoiceId={atkInvoiceRejectId}
        onClose={() => setAtkInvoiceRejectId(null)}
        onDone={() => {
          setAtkInvoiceRejectId(null);
          setAtkInvoiceDetail(null);
          loadAtkInvoices();
        }}
      />

      <AtkInvoiceUpdateModal
        open={!!atkInvoiceUpdateTarget}
        item={atkInvoiceUpdateTarget}
        onClose={() => setAtkInvoiceUpdateTarget(null)}
        onDone={() => {
          setAtkInvoiceUpdateTarget(null);
          loadAtkInvoices();
        }}
      />

      <AtkInvoiceHistoryModal
        open={atkInvoiceHistoryId != null}
        invoiceId={atkInvoiceHistoryId}
        onClose={() => setAtkInvoiceHistoryId(null)}
      />

      <AtkInvoiceChatModal
        open={!!atkInvoiceChatItem}
        itemId={atkInvoiceChatItem?.id ?? null}
        itemLabel={atkInvoiceChatItem ? `Invoice ${invoiceBulanLabel(atkInvoiceChatItem.bulan)} - ${atkInvoiceChatItem.nama}` : ""}
        me={me}
        onClose={() => setAtkInvoiceChatItem(null)}
        onRead={() => loadAtkInvoices()}
      />
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
