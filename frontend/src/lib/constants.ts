import type { BookingRuang, BookingStatus, Me, Pengiriman, Role, Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  SUBMITTED: "On-Approval: Approval Departemen/Divisi",
  REJECTED_L1: "Rejected: Approval Departemen/Divisi",
  APPROVED_L1: "On-Approval: Admin GA",
  REJECTED_GA: "Rejected: Admin GA",
  APPROVED_GA: "On-Approval: Approval GA",
  REJECTED_GA_APPROVAL: "Rejected: Approval GA",
  APPROVED_GA_APPROVAL: "On-Approval: KPU",
  REJECTED_KPU: "Rejected: KPU",
  COMPLETED: "Approved",
};

export function greetingName(me: Me): string {
  const unit = me.departemen || me.divisi;
  const role = ROLE_LABEL[me.role] || me.role;
  return unit ? `${role} ${unit}` : role;
}

export function trackWord(departemen: string | null | undefined): "Departemen" | "Divisi" {
  return departemen ? "Departemen" : "Divisi";
}

export function chatParticipantLabels(departemen: string | null | undefined, createdByRole?: Role | null): string[] {
  // Admin/Approval GA-input items skip the Departemen/Divisi tier entirely (see
  // originActorLabel), so those roles were never actually part of this item's flow and
  // shouldn't be listed as chat participants either.
  if (createdByRole === "ADMIN_GA" || createdByRole === "APPROVAL_GA") return ["Admin GA", "Approval GA", "KPU"];
  const track = trackWord(departemen);
  return [`Admin ${track}`, `Approval ${track}`, "Admin GA", "Approval GA", "KPU"];
}

// Room booking's approval chain stops at Approval GA (no KPU stage), so it has its own,
// shorter participant list.
export function bookingChatParticipantLabels(departemen: string | null | undefined): string[] {
  const track = trackWord(departemen);
  return [`Admin ${track}`, `Approval ${track}`, "Admin GA", "Approval GA"];
}

const ON_APPROVAL_STATUSES: Status[] = ["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"];
const REJECTED_STATUSES: Status[] = ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL", "REJECTED_KPU"];

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

// Short form matching the chat participant list wording ("Admin GA" not "Admin General
// Affair"), used for the sender pill on chat bubbles.
export const ROLE_SHORT_LABEL: Record<Role, string> = {
  ADMIN_DEPARTEMEN: "Admin Departemen",
  APPROVAL_DEPARTEMEN: "Approval Departemen",
  ADMIN_DIVISI: "Admin Divisi",
  APPROVAL_DIVISI: "Approval Divisi",
  ADMIN_GA: "Admin GA",
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
  if (item.createdByRole === "ADMIN_GA") return "Admin GA";
  if (item.createdByRole === "APPROVAL_GA") return "Approval GA";
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

export function getWaitingLabel(item: Pengiriman): string | undefined {
  if (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU") {
    return item.rejectTarget === "GA" ? "Waiting: Admin GA" : `Waiting: ${originActorLabel(item)}`;
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
  APPROVED_GA: { label: "Disetujui Admin GA", type: "approve" },
  REJECTED_GA: { label: "Ditolak Admin GA", type: "reject" },
  APPROVED_GA_APPROVAL: { label: "Disetujui Approval GA", type: "approve" },
  REJECTED_GA_APPROVAL: { label: "Ditolak Approval GA", type: "reject" },
  APPROVED_KPU: { label: "Disetujui KPU & Resi Diterbitkan", type: "approve" },
  REJECTED_KPU: { label: "Ditolak KPU", type: "reject" },
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

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "On-Approval: Approval Departemen/Divisi",
  REJECTED_L1: "Rejected: Approval Departemen/Divisi",
  APPROVED_L1: "On-Approval: Admin GA",
  REJECTED_GA: "Rejected: Admin GA",
  APPROVED_GA: "On-Approval: Approval GA",
  REJECTED_GA_APPROVAL: "Rejected: Approval GA",
  APPROVED_GA_APPROVAL: "Approved",
};

const BOOKING_ON_APPROVAL_STATUSES: BookingStatus[] = ["SUBMITTED", "APPROVED_L1", "APPROVED_GA"];
const BOOKING_REJECTED_STATUSES: BookingStatus[] = ["REJECTED_L1", "REJECTED_GA", "REJECTED_GA_APPROVAL"];

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
  const tier = item.createdByRole === "APPROVAL_DEPARTEMEN" || item.createdByRole === "APPROVAL_DIVISI" ? "Approval" : "Admin";
  return `${tier} ${trackWord(item.departemen)}`;
}

export function getBookingWaitingLabel(item: BookingRuang): string | undefined {
  if (item.status === "REJECTED_GA_APPROVAL") {
    return item.rejectTarget === "GA" ? "Waiting: Admin GA" : `Waiting: ${bookingOriginActorLabel(item)}`;
  }
  if (item.status === "REJECTED_L1" || item.status === "REJECTED_GA") {
    return `Waiting: ${bookingOriginActorLabel(item)}`;
  }
  return undefined;
}

export function isBookingEditableByOrigin(item: BookingRuang, me: Me): boolean {
  if (item.createdBy !== me.id) return false;
  if (item.status === "DRAFT" || item.status === "REJECTED_L1" || item.status === "REJECTED_GA") return true;
  if (item.status === "REJECTED_GA_APPROVAL") return item.rejectTarget === "ORIGIN";
  return false;
}

export function isBookingGaActionable(item: BookingRuang): boolean {
  if (item.status === "APPROVED_L1") return true;
  if (item.status === "REJECTED_GA_APPROVAL") return item.rejectTarget === "GA";
  return false;
}

export const BOOKING_L1_ACTIONABLE_STATUSES: BookingStatus[] = ["SUBMITTED"];
export const BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES: BookingStatus[] = ["APPROVED_GA"];
