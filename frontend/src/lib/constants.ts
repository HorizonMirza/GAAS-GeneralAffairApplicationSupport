import { formatDate } from "./format";
import type { ArchiveKategori, BookingKendaraan, BookingRuang, BookingStatus, ExecutionStage, KategoriKerusakan, Me, Pengiriman, PerbaikanSarana, PermintaanArsip, PermintaanAtk, RecurrenceFrequency, Role, Status, SumberPembelian, TipeBooking, Urgensi } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  SUBMITTED: "On-Approval: Approval Departemen/Divisi",
  REJECTED_L1: "Rejected: Approval Departemen/Divisi",
  APPROVED_L1: "On-Approval: Admin General Affair",
  REJECTED_GA: "Rejected: Admin General Affair",
  APPROVED_GA: "On-Approval: Approval GA",
  REJECTED_GA_APPROVAL: "Rejected: Approval GA",
  APPROVED_GA_APPROVAL: "On-Approval: Mitra",
  REJECTED_KPU: "Rejected: Mitra",
  COMPLETED: "Approved",
};

export function greetingName(me: Me): string {
  return ROLE_LABEL[me.role] || me.role;
}

export function greetingTimeWord(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function trackWord(departemen: string | null | undefined): "Departemen" | "Divisi" {
  return departemen ? "Departemen" : "Divisi";
}

// Always derived from the item's own Departemen (never from who created it) - this matches
// exactly who the backend's CanAccessPengiriman actually lets into the chat. Admin/Approval GA
// can now input on behalf of any real Divisi/Departemen (see PengirimanController.EffectiveOwner),
// so a GA-created item's Departemen is no longer necessarily GA's own home unit - keying this off
// createdByRole instead of the item's real Departemen used to silently omit the real
// Departemen/Divisi's own Admin/Approval accounts from the participant list even though they
// could already open and post in the chat.
export function chatParticipantLabels(departemen: string | null | undefined): string[] {
  const track = trackWord(departemen);
  return [`Admin ${track}`, `Approval ${track}`, "Admin General Affair", "Approval GA", "Mitra"];
}

// Same reasoning as chatParticipantLabels above. Room booking's approval chain stops at Approval
// GA (no KPU stage), so it has its own, shorter participant list.
export function bookingChatParticipantLabels(departemen: string | null | undefined): string[] {
  const track = trackWord(departemen);
  return [`Admin ${track}`, `Approval ${track}`, "Admin General Affair", "Approval GA"];
}

export const ON_APPROVAL_STATUSES: Status[] = ["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"];
export const REJECTED_STATUSES: Status[] = ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL", "REJECTED_KPU"];

// Card border color by status: draft has none, on-approval is orange, rejected is red, completed is green.
export function cardStatusBorderClass(status: Status): string {
  if (status === "COMPLETED") return "item-row-card-approved";
  if (REJECTED_STATUSES.includes(status)) return "item-row-card-rejected";
  if (ON_APPROVAL_STATUSES.includes(status)) return "item-row-card-onapproval";
  return "";
}

export function getStatusLabel(status: Status, departemen: string | null | undefined): string {
  if (status === "SUBMITTED") return `On-Approval: Approval ${trackWord(departemen)}`;
  if (status === "REJECTED_L1") return `Rejected: Approval ${trackWord(departemen)}`;
  return STATUS_LABEL[status];
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN_DEPARTEMEN: "Admin Departemen",
  APPROVAL_DEPARTEMEN: "Approval Departemen",
  ADMIN_DIVISI: "Admin Divisi",
  APPROVAL_DIVISI: "Approval Divisi",
  ADMIN_GA: "Admin General Affair",
  APPROVAL_GA: "Approval General Affair",
  KPU: "Mitra",
  SUPER_ADMIN: "Super Admin",
};

// Short form matching the chat participant list wording ("Approval GA" not "Approval General
// Affair"), used for the sender pill on chat bubbles.
export const ROLE_SHORT_LABEL: Record<Role, string> = {
  ADMIN_DEPARTEMEN: "Admin Departemen",
  APPROVAL_DEPARTEMEN: "Approval Departemen",
  ADMIN_DIVISI: "Admin Divisi",
  APPROVAL_DIVISI: "Approval Divisi",
  ADMIN_GA: "Admin General Affair",
  APPROVAL_GA: "Approval GA",
  KPU: "Mitra",
  SUPER_ADMIN: "Super Admin",
};

// Per-role accent color for chat sender names/avatars, so a group conversation reads at a
// glance like WhatsApp's per-contact name coloring.
export const ROLE_COLOR: Record<Role, string> = {
  ADMIN_DEPARTEMEN: "#3b82f6",
  APPROVAL_DEPARTEMEN: "#14b8a6",
  ADMIN_DIVISI: "#3b82f6",
  APPROVAL_DIVISI: "#14b8a6",
  ADMIN_GA: "#8b5cf6",
  APPROVAL_GA: "#f59e0b",
  KPU: "#ec4899",
  SUPER_ADMIN: "#6b7280",
};

// Label untuk siapa sebenarnya origin/pembuat data ini - ikut peran pembuat aslinya, bukan
// selalu "Admin". Dipakai baik untuk badge "Waiting" maupun untuk label pilihan target reject.
export function originActorLabel(item: Pengiriman): string {
  if (item.createdByRole === "ADMIN_GA") return "Admin General Affair";
  if (item.createdByRole === "APPROVAL_GA") return "Approval GA";
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

export function getWaitingLabel(item: Pengiriman): string | undefined {
  if (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU") {
    return item.rejectTarget === "GA" ? "Waiting: Admin General Affair" : `Waiting: ${originActorLabel(item)}`;
  }
  if (item.status === "REJECTED_L1" || item.status === "REJECTED_GA") {
    return `Waiting: ${originActorLabel(item)}`;
  }
  return undefined;
}

export const LOG_ACTION_META: Record<string, { label: string; type: "neutral" | "approve" | "reject" }> = {
  CREATED: { label: "Draft Dibuat", type: "neutral" },
  REVISED: { label: "Data Direvisi & Dikirim Ulang", type: "neutral" },
  SUBMITTED: { label: "Dikirim untuk Approval", type: "neutral" },
  APPROVED_L1: { label: "Disetujui Approval Departemen/Divisi", type: "approve" },
  REJECTED_L1: { label: "Ditolak Approval Departemen/Divisi", type: "reject" },
  APPROVED_GA: { label: "Disetujui Admin General Affair", type: "approve" },
  REJECTED_GA: { label: "Ditolak Admin General Affair", type: "reject" },
  APPROVED_GA_APPROVAL: { label: "Disetujui Approval GA", type: "approve" },
  REJECTED_GA_APPROVAL: { label: "Ditolak Approval GA", type: "reject" },
  APPROVED_KPU: { label: "Disetujui Mitra & Resi Diterbitkan", type: "approve" },
  REJECTED_KPU: { label: "Ditolak Mitra", type: "reject" },
  RESCHEDULED: { label: "Ruang/Jadwal Dipindahkan oleh GA", type: "neutral" },
  // Maintenance: tahap eksekusi fisik setelah disetujui final - lihat ExecutionStage di types.ts.
  LOKASI_DICEK: { label: "Lokasi Dicek", type: "neutral" },
  GAMBAR_DIBUAT: { label: "Gambar Rencana Perbaikan Dibuat", type: "neutral" },
  SELESAI: { label: "Eksekusi Perbaikan Selesai", type: "approve" },
};

export const LOG_ROLE_LABEL: Partial<Record<Role, string>> = ROLE_LABEL;

// "Origin" untuk revisi/reject-balik selalu pembuat aslinya - Admin atau Approval
// Departemen/Divisi, siapapun yang menginput data ini pertama kali.
export function isEditableByOrigin(item: Pengiriman, me: Me): boolean {
  if (item.createdBy !== me.id) return false;
  if (item.status === "DRAFT" || item.status === "REJECTED_L1" || item.status === "REJECTED_GA") return true;
  if (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU") {
    return item.rejectTarget === "ORIGIN";
  }
  return false;
}

export function isGaActionable(item: Pengiriman): boolean {
  if (item.status === "APPROVED_L1") return true;
  if (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU") return item.rejectTarget === "GA";
  return false;
}

export const L1_ACTIONABLE_STATUSES: Status[] = ["SUBMITTED"];
export const GA_APPROVAL_ACTIONABLE_STATUSES: Status[] = ["APPROVED_GA"];

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "On-Approval: Admin General Affair",
  APPROVED: "Approved",
  REJECTED: "Rejected: Admin General Affair",
};

export const INVOICE_STATUS_CLASS: Record<string, string> = {
  DRAFT: "badge-draft",
  PENDING: "badge-pending",
  APPROVED: "badge-approved",
  REJECTED: "badge-rejected",
};

// Matches InvoiceController's MaxInvoiceFileSizeBytes - checked here too so an oversized file
// is rejected the instant it's picked, before an upload attempt can fail with a raw connection
// error (the file never even leaves the browser if it's already over Kestrel's own body-size
// cap, which produces an unhelpful "Failed to fetch" instead of a real server error message).
export const MAX_INVOICE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const INVOICE_LOG_ACTION_META: Record<string, { label: string; type: "neutral" | "approve" | "reject" }> = {
  UPLOADED: { label: "Invoice Disimpan sebagai Draft", type: "neutral" },
  SUBMITTED: { label: "Invoice Dikirim untuk Approval", type: "neutral" },
  DRAFT_UPDATED: { label: "Draft Invoice Diperbarui", type: "neutral" },
  REVISED: { label: "Invoice Direvisi & Dikirim Ulang", type: "neutral" },
  APPROVED: { label: "Disetujui Admin General Affair", type: "approve" },
  REJECTED: { label: "Ditolak Admin General Affair", type: "reject" },
};

// --- Booking Ruang Meeting (sama pola dengan versi Pengiriman di atas, tanpa tahap KPU) ---

// Roles that can create/own a Room Booking (as opposed to just approving one) - mirrors the
// backend's OriginRoles in BookingRuangController.cs. Kept as one shared list instead of being
// inlined at every call site so the two never drift apart when a role is added or changed.
export const BOOKING_ORIGIN_ROLES: Role[] = [
  "ADMIN_DEPARTEMEN",
  "APPROVAL_DEPARTEMEN",
  "ADMIN_DIVISI",
  "APPROVAL_DIVISI",
  "ADMIN_GA",
  "APPROVAL_GA",
];

export function isBookingOriginRole(role: Role): boolean {
  return BOOKING_ORIGIN_ROLES.includes(role);
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "On-Approval: Approval Departemen/Divisi",
  REJECTED_L1: "Rejected: Approval Departemen/Divisi",
  APPROVED_L1: "On-Approval: Admin General Affair",
  REJECTED_GA: "Rejected: Admin General Affair",
  APPROVED_GA: "On-Approval: Approval GA",
  REJECTED_GA_APPROVAL: "Rejected: Approval GA",
  APPROVED_GA_APPROVAL: "Approved",
  CANCELLED: "Cancelled",
};

export const BOOKING_ON_APPROVAL_STATUSES: BookingStatus[] = ["SUBMITTED", "APPROVED_L1", "APPROVED_GA"];
export const BOOKING_REJECTED_STATUSES: BookingStatus[] = ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL"];

// Statuses a booking can be cancelled from - anywhere still on-approval through already-Approved,
// but not DRAFT (that's Delete's job) and not already a dead end. Mirrors the backend's
// BookingRuangController/BookingKendaraanController.IsCancellableStatus exactly.
export const BOOKING_CANCELLABLE_STATUSES: BookingStatus[] = ["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"];

// Room/Vehicle Booking's Tanggal/JamMulai come back as plain WIB wall-clock values (never UTC,
// see BookingPdfService's own note on this) - so "now" here is just the browser's local clock,
// same assumption every other date/time display in this app already makes (see format.ts).
function isPastBookingStart(tanggal: string, jamMulai: string | null, isWholeDay: boolean): boolean {
  const start = isWholeDay || !jamMulai ? new Date(`${tanggal}T00:00:00`) : new Date(`${tanggal}T${jamMulai}`);
  return new Date() >= start;
}

export function bookingStatusBorderClass(status: BookingStatus): string {
  if (status === "APPROVED_GA_APPROVAL") return "item-row-card-approved";
  if (BOOKING_REJECTED_STATUSES.includes(status)) return "item-row-card-rejected";
  if (BOOKING_ON_APPROVAL_STATUSES.includes(status)) return "item-row-card-onapproval";
  return "";
}

export function getBookingStatusLabel(status: BookingStatus, departemen: string | null | undefined): string {
  if (status === "SUBMITTED") return `On-Approval: Approval ${trackWord(departemen)}`;
  if (status === "REJECTED_L1") return `Rejected: Approval ${trackWord(departemen)}`;
  return BOOKING_STATUS_LABEL[status];
}

export function bookingOriginActorLabel(item: BookingRuang): string {
  if (item.createdByRole === "ADMIN_GA") return "Admin General Affair";
  if (item.createdByRole === "APPROVAL_GA") return "Approval GA";
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

// A rejected booking is a dead end for everyone, including Admin/Approval GA - there is no
// revision-and-resubmit path in Room Booking at all (unlike Pengiriman). The only thing editable
// by its creator is a never-submitted DRAFT. Mirrors the backend's
// BookingRuangController.IsEditableByOrigin exactly.
export function isBookingEditableByOrigin(item: BookingRuang, me: Me): boolean {
  return item.status === "DRAFT" && item.createdBy === me.id;
}

// Deleting is a step further than editing: a still-DRAFT item follows isBookingEditableByOrigin's
// rule (only its own creator), but once rejected or cancelled - a dead end nobody can edit back
// to life, see isBookingEditableByOrigin's comment - it's still fair game to clear out, either by
// whoever created it or by Admin/Approval GA, who run the approval process it died in. Mirrors
// the backend's BookingRuangController.IsDeletableByOrigin exactly.
export function isBookingDeletableByOrigin(item: BookingRuang, me: Me): boolean {
  if (isBookingEditableByOrigin(item, me)) return true;
  if (!BOOKING_REJECTED_STATUSES.includes(item.status) && item.status !== "CANCELLED") return false;
  return item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
}

// Admin/Approval GA's separate, narrower editing right: while a booking is still live (not yet
// finally approved, not rejected), they can move its room/date/time to resolve a scheduling
// conflict - see RoomBookingRescheduleModal. Mirrors BookingRuangController.IsGaReschedulable.
export function isBookingGaReschedulable(item: BookingRuang): boolean {
  return item.status === "DRAFT" || item.status === "SUBMITTED" || item.status === "APPROVED_L1" || item.status === "APPROVED_GA";
}

// Role + status together: whether the "Updates" row-menu item should open the reschedule form for
// this account on this item (Admin/Approval GA only, and only while the item is still reschedulable).
export function canGaRescheduleBooking(item: BookingRuang, me: Me): boolean {
  return (me.role === "ADMIN_GA" || me.role === "APPROVAL_GA") && isBookingGaReschedulable(item);
}

// A confirmation PDF only exists once a booking reached the final Approved state.
export function isBookingPdfAvailable(item: BookingRuang): boolean {
  return item.status === "APPROVED_GA_APPROVAL";
}

// Whoever created it, or Admin/Approval GA regardless of who created it, can cancel a booking
// that's still on-approval or already Approved - but only up until its own start time. Mirrors
// the backend's BookingRuangController.IsCancellableByOrigin/IsPastCancelDeadline exactly.
export function isBookingCancellableByOrigin(item: BookingRuang, me: Me): boolean {
  if (!BOOKING_CANCELLABLE_STATUSES.includes(item.status)) return false;
  const allowed = item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
  if (!allowed) return false;
  return !isPastBookingStart(item.tanggal, item.jamMulai, item.isWholeDay);
}

export function isBookingGaActionable(item: BookingRuang): boolean {
  return item.status === "APPROVED_L1";
}

// Flat cap across every room (not per-room capacity) - mirrors
// BookingRuangController.MaxJumlahPeserta on the backend.
export const MAX_JUMLAH_PESERTA = 64;

export const BOOKING_L1_ACTIONABLE_STATUSES: BookingStatus[] = ["SUBMITTED"];
export const BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES: BookingStatus[] = ["APPROVED_GA"];

export const TIPE_BOOKING_LABELS: Record<TipeBooking, string> = {
  INTERNAL: "Internal",
  EXTERNAL: "External",
};

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  DAILY: "Harian",
  WEEKLY: "Mingguan",
  MONTHLY: "Bulanan",
};

export function bookingRoomsLabel(item: BookingRuang): string {
  return [item.namaRuang, ...item.additionalRooms].join(", ");
}

export function bookingRecurrenceLabel(item: BookingRuang): string | null {
  if (!item.seriesId || !item.recurrenceFrequency) return null;
  const endText = item.recurrenceEndDate ? ` s/d ${formatDate(item.recurrenceEndDate)}` : "";
  return `${RECURRENCE_FREQUENCY_LABELS[item.recurrenceFrequency]}${endText}`;
}

export function kendaraanOriginActorLabel(item: BookingKendaraan): string {
  if (item.createdByRole === "ADMIN_GA") return "Admin General Affair";
  if (item.createdByRole === "APPROVAL_GA") return "Approval GA";
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

// Same rule as isBookingEditableByOrigin - mirrors the backend's
// BookingKendaraanController.IsEditableByOrigin exactly.
export function isKendaraanEditableByOrigin(item: BookingKendaraan, me: Me): boolean {
  return item.status === "DRAFT" && item.createdBy === me.id;
}

// Same rule as isBookingDeletableByOrigin - mirrors the backend's
// BookingKendaraanController.IsDeletableByOrigin exactly.
export function isKendaraanDeletableByOrigin(item: BookingKendaraan, me: Me): boolean {
  if (isKendaraanEditableByOrigin(item, me)) return true;
  if (!BOOKING_REJECTED_STATUSES.includes(item.status) && item.status !== "CANCELLED") return false;
  return item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
}

// Same rule as isBookingGaReschedulable - mirrors
// BookingKendaraanController.IsGaReschedulable.
export function isKendaraanGaReschedulable(item: BookingKendaraan): boolean {
  return item.status === "DRAFT" || item.status === "SUBMITTED" || item.status === "APPROVED_L1" || item.status === "APPROVED_GA";
}

export function canGaRescheduleKendaraan(item: BookingKendaraan, me: Me): boolean {
  return (me.role === "ADMIN_GA" || me.role === "APPROVAL_GA") && isKendaraanGaReschedulable(item);
}

export function isKendaraanGaActionable(item: BookingKendaraan): boolean {
  return item.status === "APPROVED_L1";
}

// Same rule as isBookingCancellableByOrigin - mirrors
// BookingKendaraanController.IsCancellableByOrigin/IsPastCancelDeadline.
export function isKendaraanCancellableByOrigin(item: BookingKendaraan, me: Me): boolean {
  if (!BOOKING_CANCELLABLE_STATUSES.includes(item.status)) return false;
  const allowed = item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
  if (!allowed) return false;
  return !isPastBookingStart(item.tanggal, item.jamMulai, item.isWholeDay);
}

// --- Office Supplies / Permintaan ATK (approval chain sama seperti Pengiriman - lihat Status di
// bawah, termasuk tahap KPU - tapi reject tetap dead end di setiap tier, sama seperti Room/
// Vehicle Booking) ---

export function atkOriginActorLabel(item: PermintaanAtk): string {
  if (item.createdByRole === "ADMIN_GA") return "Admin General Affair";
  if (item.createdByRole === "APPROVAL_GA") return "Approval GA";
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

// Same rule as isBookingEditableByOrigin - mirrors the backend's
// PermintaanAtkController.IsEditableByOrigin exactly.
export function isAtkEditableByOrigin(item: PermintaanAtk, me: Me): boolean {
  return item.status === "DRAFT" && item.createdBy === me.id;
}

// Same rule as isBookingDeletableByOrigin - mirrors the backend's
// PermintaanAtkController.IsDeletableByOrigin exactly.
export function isAtkDeletableByOrigin(item: PermintaanAtk, me: Me): boolean {
  if (isAtkEditableByOrigin(item, me)) return true;
  if (!REJECTED_STATUSES.includes(item.status)) return false;
  return item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
}

export function isAtkGaActionable(item: PermintaanAtk): boolean {
  return item.status === "APPROVED_L1";
}

export function isAtkKpuActionable(item: PermintaanAtk): boolean {
  return item.status === "APPROVED_GA_APPROVAL";
}

export const SUMBER_PEMBELIAN_LABEL: Record<SumberPembelian, string> = {
  KPU: "KPU",
  PADI: "PaDi (Eksternal)",
};

// Ringkasan daftar barang untuk sel tabel/kartu: "Pulpen (5 pcs), Kertas A4 (2 rim)".
export function atkItemsSummary(item: PermintaanAtk): string {
  return item.items.map((i) => `${i.namaBarang} (${i.jumlah} ${i.satuan})`).join(", ");
}

// --- Maintenance / Perbaikan Sarana (pola yang sama dengan Booking & ATK di atas) ---

export const KATEGORI_KERUSAKAN_LABEL: Record<KategoriKerusakan, string> = {
  AC: "AC / Pendingin",
  LISTRIK: "Listrik",
  AIR: "Air / Saluran",
  FURNITUR: "Furnitur",
  GEDUNG: "Gedung / Bangunan",
  IT: "IT / Jaringan",
  LAINNYA: "Lainnya",
};

export const URGENSI_LABEL: Record<Urgensi, string> = {
  RENDAH: "Rendah",
  SEDANG: "Sedang",
  TINGGI: "Tinggi",
};

// Kelas badge untuk tingkat urgensi - dipetakan ke badge status yang sudah ada di globals.css
// supaya tidak perlu palet warna baru: tinggi = merah (rejected), sedang = oranye (on-approval),
// rendah = abu-abu (draft).
export const URGENSI_BADGE_CLASS: Record<Urgensi, string> = {
  RENDAH: "badge-draft",
  SEDANG: "badge-pending",
  TINGGI: "badge-rejected",
};

export function saranaOriginActorLabel(item: PerbaikanSarana): string {
  if (item.createdByRole === "ADMIN_GA") return "Admin General Affair";
  if (item.createdByRole === "APPROVAL_GA") return "Approval GA";
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

// Same rule as isBookingEditableByOrigin - mirrors the backend's
// PerbaikanSaranaController.IsEditableByOrigin exactly.
export function isSaranaEditableByOrigin(item: PerbaikanSarana, me: Me): boolean {
  return item.status === "DRAFT" && item.createdBy === me.id;
}

// Same rule as isBookingDeletableByOrigin - mirrors the backend's
// PerbaikanSaranaController.IsDeletableByOrigin exactly.
export function isSaranaDeletableByOrigin(item: PerbaikanSarana, me: Me): boolean {
  if (isSaranaEditableByOrigin(item, me)) return true;
  if (!BOOKING_REJECTED_STATUSES.includes(item.status)) return false;
  return item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
}

export function isSaranaGaActionable(item: PerbaikanSarana): boolean {
  return item.status === "APPROVED_L1";
}

// Eksekusi fisik (Cek Lokasi -> Buat Gambar -> Eksekusi) hanya berjalan setelah disetujui final -
// Admin GA dan Approval GA sama-sama bisa menjalankan tahap manapun (lihat
// PerbaikanSaranaController's ExecutionRoles), tidak dibatasi harus orang yang sama.
export function isSaranaExecutionActor(me: Me): boolean {
  return me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
}

export const EXECUTION_STAGE_LABEL: Record<ExecutionStage, string> = {
  MENUNGGU: "Menunggu Eksekusi",
  LOKASI_DICEK: "Lokasi Dicek",
  GAMBAR_DIBUAT: "Gambar Dibuat",
  SELESAI: "Selesai Dieksekusi",
};

// --- Archive / Permintaan Arsip (pola yang sama dengan Booking & ATK di atas) ---

export const ARCHIVE_KATEGORI_LABEL: Record<ArchiveKategori, string> = {
  SOP: "SOP",
  SURAT: "Surat",
  KONTRAK: "Kontrak",
  LAPORAN: "Laporan",
  PANDUAN: "Panduan",
  LAINNYA: "Lainnya",
};

export function arsipOriginActorLabel(item: PermintaanArsip): string {
  if (item.createdByRole === "ADMIN_GA") return "Admin General Affair";
  if (item.createdByRole === "APPROVAL_GA") return "Approval GA";
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

// Same rule as isBookingEditableByOrigin - mirrors the backend's
// PermintaanArsipController.IsEditableByOrigin exactly.
export function isArsipEditableByOrigin(item: PermintaanArsip, me: Me): boolean {
  return item.status === "DRAFT" && item.createdBy === me.id;
}

// Same rule as isBookingDeletableByOrigin - mirrors the backend's
// PermintaanArsipController.IsDeletableByOrigin exactly.
export function isArsipDeletableByOrigin(item: PermintaanArsip, me: Me): boolean {
  if (isArsipEditableByOrigin(item, me)) return true;
  if (!BOOKING_REJECTED_STATUSES.includes(item.status)) return false;
  return item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
}

export function isArsipGaActionable(item: PermintaanArsip): boolean {
  return item.status === "APPROVED_L1";
}

// Ringkasan daftar arsip untuk sel tabel/kartu: "Kontrak Vendor 2018-2019 (5 boks), ...".
export function arsipItemsSummary(item: PermintaanArsip): string {
  return item.items.map((i) => `${i.namaArsip} (${i.jumlah} ${i.satuan})`).join(", ");
}

// --- Contact Person (halaman /contact-person, lihat app/(app)/contact-person/page.tsx) ---

export interface ContactPerson {
  module: string;
  name: string;
  phone: string;
}

export const CONTACT_PERSONS: ContactPerson[] = [
  { module: "Expedition", name: "Melda", phone: "+62 812-1555-6739" },
  { module: "Room Booking", name: "Melda", phone: "+62 812-1555-6739" },
  { module: "Vehicle Booking", name: "Ardi", phone: "+62 812-8120-5697" },
  { module: "Office Supplies", name: "Melda", phone: "+62 812-1555-6739" },
  { module: "Maintenance", name: "Ceuta", phone: "+62 811-1814-606" },
  { module: "Archive", name: "Wawa", phone: "+62 812-9790-2368" },
];
