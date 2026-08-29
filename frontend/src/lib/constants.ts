import { formatDate } from "./format";
import type { ArchiveDocument, ArchiveKategori, BookingKendaraan, BookingRuang, BookingStatus, KategoriKerusakan, Me, Pengiriman, PerbaikanSarana, PermintaanAtk, RecurrenceFrequency, Role, Status, TipeBooking, Urgensi } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  SUBMITTED: "On-Approval: Approval Departemen/Divisi",
  REJECTED_L1: "Rejected: Approval Departemen/Divisi",
  APPROVED_L1: "On-Approval: Admin General Affair",
  REJECTED_GA: "Rejected: Admin General Affair",
  APPROVED_GA: "On-Approval: Approval GA",
  REJECTED_GA_APPROVAL: "Rejected: Approval GA",
  APPROVED_GA_APPROVAL: "On-Approval: KPU",
  REJECTED_KPU: "Rejected: KPU",
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
  return [`Admin ${track}`, `Approval ${track}`, "Admin General Affair", "Approval GA", "KPU"];
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
  KPU: "KPU",
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
  KPU: "KPU",
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
  APPROVED_KPU: { label: "Disetujui KPU & Resi Diterbitkan", type: "approve" },
  REJECTED_KPU: { label: "Ditolak KPU", type: "reject" },
  RESCHEDULED: { label: "Ruang/Jadwal Dipindahkan oleh GA", type: "neutral" },
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
};

export const BOOKING_ON_APPROVAL_STATUSES: BookingStatus[] = ["SUBMITTED", "APPROVED_L1", "APPROVED_GA"];
export const BOOKING_REJECTED_STATUSES: BookingStatus[] = ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL"];

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
// rule (only its own creator), but once rejected - a dead end nobody can edit back to life, see
// isBookingEditableByOrigin's comment - it's still fair game to clear out, either by whoever
// created it or by Admin/Approval GA, who run the approval process it died in. Mirrors the
// backend's BookingRuangController.IsDeletableByOrigin exactly.
export function isBookingDeletableByOrigin(item: BookingRuang, me: Me): boolean {
  if (isBookingEditableByOrigin(item, me)) return true;
  if (!BOOKING_REJECTED_STATUSES.includes(item.status)) return false;
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
  if (!BOOKING_REJECTED_STATUSES.includes(item.status)) return false;
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

// --- Office Supplies / Permintaan ATK (pola yang sama dengan Booking di atas) ---

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
  if (!BOOKING_REJECTED_STATUSES.includes(item.status)) return false;
  return item.createdBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";
}

export function isAtkGaActionable(item: PermintaanAtk): boolean {
  return item.status === "APPROVED_L1";
}

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

// --- Archive ---

export const ARCHIVE_KATEGORI_LABEL: Record<ArchiveKategori, string> = {
  SOP: "SOP",
  SURAT: "Surat",
  KONTRAK: "Kontrak",
  LAPORAN: "Laporan",
  PANDUAN: "Panduan",
  LAINNYA: "Lainnya",
};

// Matches ArchiveController's MaxArchiveFileSizeBytes - checked here too so an oversized file is
// rejected the instant it's picked, before an upload attempt can fail with a raw connection error.
export const MAX_ARCHIVE_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// Mirrors ArchiveController.CanManage exactly - the uploader manages their own document,
// Admin/Approval GA and Super Admin manage every document.
export function canManageArchiveDocument(item: ArchiveDocument, me: Me): boolean {
  return item.uploadedBy === me.id || me.role === "ADMIN_GA" || me.role === "APPROVAL_GA" || me.role === "SUPER_ADMIN";
}
