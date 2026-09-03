import { formatDate } from "./format";
import type { Language } from "./i18n/language-context";
import { translations } from "./i18n/translations";
import type { ArchiveKategori, BookingKendaraan, BookingRuang, BookingStatus, ExecutionStage, KategoriKerusakan, Me, Pengiriman, PerbaikanSarana, PermintaanArsip, PermintaanAtk, RecurrenceFrequency, Role, Status, SumberPembelian, TipeBooking, Urgensi } from "./types";

// Looks up one of the shared word/phrase primitives from lib/i18n/dict/words.ts for the given
// language - the building block every label-composing function below uses instead of a hardcoded
// Indonesian string, so switching language switches every derived label at once.
function w(key: string, lang: Language): string {
  return translations[lang][key] ?? key;
}

function adminWord(lang: Language): string {
  return w("word.admin", lang);
}
function approvalWord(lang: Language): string {
  return w("word.approval", lang);
}
function generalAffairWord(lang: Language): string {
  return w("word.generalAffair", lang);
}
function partnerWord(lang: Language): string {
  return w("word.partner", lang);
}

export function getStatusLabelMap(lang: Language): Record<Status, string> {
  const onApproval = w("word.onApproval", lang);
  const rejected = w("word.rejected", lang);
  const admin = adminWord(lang);
  const approval = approvalWord(lang);
  const ga = generalAffairWord(lang);
  const partner = partnerWord(lang);
  return {
    DRAFT: w("word.draft", lang),
    SUBMITTED: `${onApproval}: ${approval} Departemen/Divisi`,
    REJECTED_L1: `${rejected}: ${approval} Departemen/Divisi`,
    APPROVED_L1: `${onApproval}: ${admin} ${ga}`,
    REJECTED_GA: `${rejected}: ${admin} ${ga}`,
    APPROVED_GA: `${onApproval}: ${approval} GA`,
    REJECTED_GA_APPROVAL: `${rejected}: ${approval} GA`,
    APPROVED_GA_APPROVAL: `${onApproval}: ${partner}`,
    REJECTED_KPU: `${rejected}: ${partner}`,
    COMPLETED: w("word.approved", lang),
  };
}

export function greetingName(me: Me, lang: Language): string {
  return getRoleLabelMap(lang)[me.role] || me.role;
}

export function greetingTimeWord(lang: Language): string {
  const hour = new Date().getHours();
  if (hour < 12) return w("word.morning", lang);
  if (hour < 18) return w("word.afternoon", lang);
  return w("word.evening", lang);
}

export function trackWord(departemen: string | null | undefined, lang: Language): string {
  return departemen ? w("word.department", lang) : w("word.division", lang);
}

// Always derived from the item's own Departemen (never from who created it) - this matches
// exactly who the backend's CanAccessPengiriman actually lets into the chat. Admin/Approval GA
// can now input on behalf of any real Divisi/Departemen (see PengirimanController.EffectiveOwner),
// so a GA-created item's Departemen is no longer necessarily GA's own home unit - keying this off
// createdByRole instead of the item's real Departemen used to silently omit the real
// Departemen/Divisi's own Admin/Approval accounts from the participant list even though they
// could already open and post in the chat.
export function chatParticipantLabels(departemen: string | null | undefined, lang: Language): string[] {
  const track = trackWord(departemen, lang);
  const admin = adminWord(lang);
  const approval = approvalWord(lang);
  return [`${admin} ${track}`, `${approval} ${track}`, `${admin} ${generalAffairWord(lang)}`, `${approval} GA`, partnerWord(lang)];
}

// Same reasoning as chatParticipantLabels above. Room booking's approval chain stops at Approval
// GA (no KPU stage), so it has its own, shorter participant list.
export function bookingChatParticipantLabels(departemen: string | null | undefined, lang: Language): string[] {
  const track = trackWord(departemen, lang);
  const admin = adminWord(lang);
  const approval = approvalWord(lang);
  return [`${admin} ${track}`, `${approval} ${track}`, `${admin} ${generalAffairWord(lang)}`, `${approval} GA`];
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

export function getStatusLabel(status: Status, departemen: string | null | undefined, lang: Language): string {
  const approval = approvalWord(lang);
  if (status === "SUBMITTED") return `${w("word.onApproval", lang)}: ${approval} ${trackWord(departemen, lang)}`;
  if (status === "REJECTED_L1") return `${w("word.rejected", lang)}: ${approval} ${trackWord(departemen, lang)}`;
  return getStatusLabelMap(lang)[status];
}

export function getRoleLabelMap(lang: Language): Record<Role, string> {
  const admin = adminWord(lang);
  const approval = approvalWord(lang);
  const division = w("word.division", lang);
  const department = w("word.department", lang);
  const ga = generalAffairWord(lang);
  return {
    ADMIN_DEPARTEMEN: `${admin} ${department}`,
    APPROVAL_DEPARTEMEN: `${approval} ${department}`,
    ADMIN_DIVISI: `${admin} ${division}`,
    APPROVAL_DIVISI: `${approval} ${division}`,
    ADMIN_GA: `${admin} ${ga}`,
    APPROVAL_GA: `${approval} ${ga}`,
    KPU: partnerWord(lang),
    SUPER_ADMIN: "Super Admin",
  };
}

// Short form matching the chat participant list wording ("Approval GA" not "Approval General
// Affair"), used for the sender pill on chat bubbles.
export function getRoleShortLabelMap(lang: Language): Record<Role, string> {
  const admin = adminWord(lang);
  const approval = approvalWord(lang);
  const division = w("word.division", lang);
  const department = w("word.department", lang);
  return {
    ADMIN_DEPARTEMEN: `${admin} ${department}`,
    APPROVAL_DEPARTEMEN: `${approval} ${department}`,
    ADMIN_DIVISI: `${admin} ${division}`,
    APPROVAL_DIVISI: `${approval} ${division}`,
    ADMIN_GA: `${admin} ${generalAffairWord(lang)}`,
    APPROVAL_GA: `${approval} GA`,
    KPU: partnerWord(lang),
    SUPER_ADMIN: "Super Admin",
  };
}

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
export function originActorLabel(item: Pengiriman, lang: Language): string {
  if (item.createdByRole === "ADMIN_GA") return `${adminWord(lang)} ${generalAffairWord(lang)}`;
  if (item.createdByRole === "APPROVAL_GA") return `${approvalWord(lang)} GA`;
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? approvalWord(lang) : adminWord(lang);
  return `${tier} ${trackWord(item.departemen, lang)}`;
}

export function getWaitingLabel(item: Pengiriman, lang: Language): string | undefined {
  const waiting = w("word.waiting", lang);
  if (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU") {
    return item.rejectTarget === "GA" ? `${waiting}: ${adminWord(lang)} ${generalAffairWord(lang)}` : `${waiting}: ${originActorLabel(item, lang)}`;
  }
  if (item.status === "REJECTED_L1" || item.status === "REJECTED_GA") {
    return `${waiting}: ${originActorLabel(item, lang)}`;
  }
  return undefined;
}

export function getLogActionMeta(lang: Language): Record<string, { label: string; type: "neutral" | "approve" | "reject" }> {
  return {
    CREATED: { label: w("log.CREATED", lang), type: "neutral" },
    REVISED: { label: w("log.REVISED", lang), type: "neutral" },
    SUBMITTED: { label: w("log.SUBMITTED", lang), type: "neutral" },
    APPROVED_L1: { label: w("log.APPROVED_L1", lang), type: "approve" },
    REJECTED_L1: { label: w("log.REJECTED_L1", lang), type: "reject" },
    APPROVED_GA: { label: w("log.APPROVED_GA", lang), type: "approve" },
    REJECTED_GA: { label: w("log.REJECTED_GA", lang), type: "reject" },
    APPROVED_GA_APPROVAL: { label: w("log.APPROVED_GA_APPROVAL", lang), type: "approve" },
    REJECTED_GA_APPROVAL: { label: w("log.REJECTED_GA_APPROVAL", lang), type: "reject" },
    APPROVED_KPU: { label: w("log.APPROVED_KPU", lang), type: "approve" },
    REJECTED_KPU: { label: w("log.REJECTED_KPU", lang), type: "reject" },
    RESCHEDULED: { label: w("log.RESCHEDULED", lang), type: "neutral" },
    // Maintenance: tahap eksekusi fisik setelah disetujui final - lihat ExecutionStage di types.ts.
    LOKASI_DICEK: { label: w("log.LOKASI_DICEK", lang), type: "neutral" },
    GAMBAR_DIBUAT: { label: w("log.GAMBAR_DIBUAT", lang), type: "neutral" },
    SELESAI: { label: w("log.SELESAI", lang), type: "approve" },
  };
}

export function getLogRoleLabelMap(lang: Language): Partial<Record<Role, string>> {
  return getRoleLabelMap(lang);
}

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

export function getInvoiceStatusLabelMap(lang: Language): Record<string, string> {
  const adminGa = `${adminWord(lang)} ${generalAffairWord(lang)}`;
  return {
    DRAFT: w("word.draft", lang),
    PENDING: `${w("word.onApproval", lang)}: ${adminGa}`,
    APPROVED: w("word.approved", lang),
    REJECTED: `${w("word.rejected", lang)}: ${adminGa}`,
  };
}

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

export function getInvoiceLogActionMeta(lang: Language): Record<string, { label: string; type: "neutral" | "approve" | "reject" }> {
  return {
    UPLOADED: { label: w("invoiceLog.UPLOADED", lang), type: "neutral" },
    SUBMITTED: { label: w("invoiceLog.SUBMITTED", lang), type: "neutral" },
    DRAFT_UPDATED: { label: w("invoiceLog.DRAFT_UPDATED", lang), type: "neutral" },
    REVISED: { label: w("invoiceLog.REVISED", lang), type: "neutral" },
    APPROVED: { label: w("invoiceLog.APPROVED", lang), type: "approve" },
    REJECTED: { label: w("invoiceLog.REJECTED", lang), type: "reject" },
  };
}

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

export function getBookingStatusLabelMap(lang: Language): Record<BookingStatus, string> {
  const onApproval = w("word.onApproval", lang);
  const rejected = w("word.rejected", lang);
  const approval = approvalWord(lang);
  return {
    DRAFT: w("word.draft", lang),
    SUBMITTED: `${onApproval}: ${approval} Departemen/Divisi`,
    REJECTED_L1: `${rejected}: ${approval} Departemen/Divisi`,
    APPROVED_L1: `${onApproval}: ${adminWord(lang)} ${generalAffairWord(lang)}`,
    REJECTED_GA: `${rejected}: ${adminWord(lang)} ${generalAffairWord(lang)}`,
    APPROVED_GA: `${onApproval}: ${approval} GA`,
    REJECTED_GA_APPROVAL: `${rejected}: ${approval} GA`,
    APPROVED_GA_APPROVAL: w("word.approved", lang),
    CANCELLED: w("word.cancelled", lang),
  };
}

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

export function getBookingStatusLabel(status: BookingStatus, departemen: string | null | undefined, lang: Language): string {
  const approval = approvalWord(lang);
  if (status === "SUBMITTED") return `${w("word.onApproval", lang)}: ${approval} ${trackWord(departemen, lang)}`;
  if (status === "REJECTED_L1") return `${w("word.rejected", lang)}: ${approval} ${trackWord(departemen, lang)}`;
  return getBookingStatusLabelMap(lang)[status];
}

export function bookingOriginActorLabel(item: BookingRuang, lang: Language): string {
  if (item.createdByRole === "ADMIN_GA") return `${adminWord(lang)} ${generalAffairWord(lang)}`;
  if (item.createdByRole === "APPROVAL_GA") return `${approvalWord(lang)} GA`;
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? approvalWord(lang) : adminWord(lang);
  return `${tier} ${trackWord(item.departemen, lang)}`;
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

export function getRecurrenceFrequencyLabelMap(lang: Language): Record<RecurrenceFrequency, string> {
  return {
    DAILY: w("word.daily", lang),
    WEEKLY: w("word.weekly", lang),
    MONTHLY: w("word.monthly", lang),
  };
}

export function bookingRoomsLabel(item: BookingRuang): string {
  return [item.namaRuang, ...item.additionalRooms].join(", ");
}

export function bookingRecurrenceLabel(item: BookingRuang, lang: Language): string | null {
  if (!item.seriesId || !item.recurrenceFrequency) return null;
  const endText = item.recurrenceEndDate ? ` ${w("word.until", lang)} ${formatDate(item.recurrenceEndDate)}` : "";
  return `${getRecurrenceFrequencyLabelMap(lang)[item.recurrenceFrequency]}${endText}`;
}

export function kendaraanOriginActorLabel(item: BookingKendaraan, lang: Language): string {
  if (item.createdByRole === "ADMIN_GA") return `${adminWord(lang)} ${generalAffairWord(lang)}`;
  if (item.createdByRole === "APPROVAL_GA") return `${approvalWord(lang)} GA`;
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? approvalWord(lang) : adminWord(lang);
  return `${tier} ${trackWord(item.departemen, lang)}`;
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

export function atkOriginActorLabel(item: PermintaanAtk, lang: Language): string {
  if (item.createdByRole === "ADMIN_GA") return `${adminWord(lang)} ${generalAffairWord(lang)}`;
  if (item.createdByRole === "APPROVAL_GA") return `${approvalWord(lang)} GA`;
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? approvalWord(lang) : adminWord(lang);
  return `${tier} ${trackWord(item.departemen, lang)}`;
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

export function getSumberPembelianLabelMap(lang: Language): Record<SumberPembelian, string> {
  return {
    KPU: w("sumberPembelian.KPU", lang),
    PADI: w("sumberPembelian.PADI", lang),
  };
}

// Ringkasan daftar barang untuk sel tabel/kartu: "Pulpen (5 pcs), Kertas A4 (2 rim)".
export function atkItemsSummary(item: PermintaanAtk): string {
  return item.items.map((i) => `${i.namaBarang} (${i.jumlah} ${i.satuan})`).join(", ");
}

// --- Maintenance / Perbaikan Sarana (pola yang sama dengan Booking & ATK di atas) ---

export function getKategoriKerusakanLabelMap(lang: Language): Record<KategoriKerusakan, string> {
  return {
    AC: w("kategoriKerusakan.AC", lang),
    LISTRIK: w("kategoriKerusakan.LISTRIK", lang),
    AIR: w("kategoriKerusakan.AIR", lang),
    FURNITUR: w("kategoriKerusakan.FURNITUR", lang),
    GEDUNG: w("kategoriKerusakan.GEDUNG", lang),
    IT: w("kategoriKerusakan.IT", lang),
    LAINNYA: w("kategoriKerusakan.LAINNYA", lang),
  };
}

export function getUrgensiLabelMap(lang: Language): Record<Urgensi, string> {
  return {
    RENDAH: w("urgensi.RENDAH", lang),
    SEDANG: w("urgensi.SEDANG", lang),
    TINGGI: w("urgensi.TINGGI", lang),
  };
}

// Kelas badge untuk tingkat urgensi - dipetakan ke badge status yang sudah ada di globals.css
// supaya tidak perlu palet warna baru: tinggi = merah (rejected), sedang = oranye (on-approval),
// rendah = abu-abu (draft).
export const URGENSI_BADGE_CLASS: Record<Urgensi, string> = {
  RENDAH: "badge-draft",
  SEDANG: "badge-pending",
  TINGGI: "badge-rejected",
};

export function saranaOriginActorLabel(item: PerbaikanSarana, lang: Language): string {
  if (item.createdByRole === "ADMIN_GA") return `${adminWord(lang)} ${generalAffairWord(lang)}`;
  if (item.createdByRole === "APPROVAL_GA") return `${approvalWord(lang)} GA`;
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? approvalWord(lang) : adminWord(lang);
  return `${tier} ${trackWord(item.departemen, lang)}`;
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

export function getExecutionStageLabelMap(lang: Language): Record<ExecutionStage, string> {
  return {
    MENUNGGU: w("executionStage.MENUNGGU", lang),
    LOKASI_DICEK: w("executionStage.LOKASI_DICEK", lang),
    GAMBAR_DIBUAT: w("executionStage.GAMBAR_DIBUAT", lang),
    SELESAI: w("executionStage.SELESAI", lang),
  };
}

// --- Archive / Permintaan Arsip (pola yang sama dengan Booking & ATK di atas) ---

export function getArchiveKategoriLabelMap(lang: Language): Record<ArchiveKategori, string> {
  return {
    SOP: w("archiveKategori.SOP", lang),
    SURAT: w("archiveKategori.SURAT", lang),
    KONTRAK: w("archiveKategori.KONTRAK", lang),
    LAPORAN: w("archiveKategori.LAPORAN", lang),
    PANDUAN: w("archiveKategori.PANDUAN", lang),
    LAINNYA: w("archiveKategori.LAINNYA", lang),
  };
}

export function arsipOriginActorLabel(item: PermintaanArsip, lang: Language): string {
  if (item.createdByRole === "ADMIN_GA") return `${adminWord(lang)} ${generalAffairWord(lang)}`;
  if (item.createdByRole === "APPROVAL_GA") return `${approvalWord(lang)} GA`;
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? approvalWord(lang) : adminWord(lang);
  return `${tier} ${trackWord(item.departemen, lang)}`;
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
  name: string;
  modules: string[];
  phone: string;
  email: string;
}

// Placeholder email shared by everyone for now until each person's real address is provided.
const TEMP_CONTACT_EMAIL = "purbandonomirza@gmail.com";

// One card per person (not per module) - several people cover more than one module, so the same
// name/number would otherwise repeat across several near-identical cards.
export const CONTACT_PERSONS: ContactPerson[] = [
  { name: "Melda", modules: ["Expedition", "Room Booking", "Office Supplies"], phone: "+62 812-1555-6739", email: TEMP_CONTACT_EMAIL },
  { name: "Ardi", modules: ["Vehicle Booking"], phone: "+62 812-8120-5697", email: TEMP_CONTACT_EMAIL },
  { name: "Ceuta", modules: ["Maintenance"], phone: "+62 811-1814-606", email: TEMP_CONTACT_EMAIL },
  { name: "Wawa", modules: ["Archive"], phone: "+62 812-9790-2368", email: TEMP_CONTACT_EMAIL },
  { name: "Esther", modules: ["General Affair Approval"], phone: "+62 812-8202-9417", email: TEMP_CONTACT_EMAIL },
  { name: "Yosua", modules: ["Department Head General Affair"], phone: "+62 812-8105-8747", email: TEMP_CONTACT_EMAIL },
];

// --- Profile hero banner backgrounds (halaman /profile) ---
// Keys must match AllowedCoverPresets in the backend's ProfileController.
export interface CoverPreset {
  key: string;
  label: string;
  gradient: string;
}

export const COVER_PRESETS: CoverPreset[] = [
  { key: "navy", label: "Navy", gradient: "linear-gradient(135deg, #081328 0%, #1450c9 55%, #4b8dff 100%)" },
  { key: "ocean", label: "Ocean", gradient: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 55%, #38bdf8 100%)" },
  { key: "teal", label: "Teal", gradient: "linear-gradient(135deg, #042f2e 0%, #0d9488 55%, #5eead4 100%)" },
  { key: "emerald", label: "Emerald", gradient: "linear-gradient(135deg, #064e3b 0%, #059669 55%, #34d399 100%)" },
  { key: "gold", label: "Gold", gradient: "linear-gradient(135deg, #451a03 0%, #b45309 55%, #fbbf24 100%)" },
  { key: "sunset", label: "Sunset", gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 55%, #fb923c 100%)" },
  { key: "rose", label: "Rose", gradient: "linear-gradient(135deg, #4c0519 0%, #be123c 55%, #fb7185 100%)" },
  { key: "purple", label: "Purple", gradient: "linear-gradient(135deg, #3b0764 0%, #7e22ce 55%, #c084fc 100%)" },
  { key: "slate", label: "Slate", gradient: "linear-gradient(135deg, #1e293b 0%, #475569 55%, #94a3b8 100%)" },
];
