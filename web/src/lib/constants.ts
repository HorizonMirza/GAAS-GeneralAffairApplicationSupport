import type { Me, Pengiriman, Role, Status } from "./types";

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

export function getWaitingLabel(item: Pengiriman): string | undefined {
  if (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU") {
    return item.rejectTarget === "GA" ? "Waiting: Admin GA" : `Waiting: Admin ${trackWord(item.departemen)}`;
  }
  if (item.status === "REJECTED_L1" || item.status === "REJECTED_GA") {
    return `Waiting: Admin ${trackWord(item.departemen)}`;
  }
  return undefined;
}

export function effectiveStatus(item: Pengiriman): Status {
  if (item.status === "DRAFT" && item.rejectReason) return "REJECTED_L1";
  return item.status;
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

// "Origin" untuk revisi/reject-balik selalu Admin Departemen/Divisi dari unit item ini -
// bukan pembuat aslinya, karena Approval Departemen/Divisi juga bisa input data langsung
// tapi tidak pernah menerima data itu balik (reject Admin GA / Approval GA-KPU-ke-origin
// selalu ke Admin, bukan ke Approval).
function isUnitAdmin(item: Pengiriman, me: Me): boolean {
  return item.departemen != null
    ? me.role === "ADMIN_DEPARTEMEN" && me.departemen === item.departemen
    : me.role === "ADMIN_DIVISI" && me.divisi === item.divisi;
}

export function isEditableByOrigin(item: Pengiriman, me: Me): boolean {
  if (item.status === "DRAFT") return item.createdBy === me.id;
  if (item.status === "REJECTED_L1" || item.status === "REJECTED_GA") return isUnitAdmin(item, me);
  if (item.status === "REJECTED_GA_APPROVAL" || item.status === "REJECTED_KPU") {
    return item.rejectTarget === "ORIGIN" && isUnitAdmin(item, me);
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
  PENDING: "Menunggu Review",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export const INVOICE_STATUS_CLASS: Record<string, string> = {
  PENDING: "badge-pending",
  APPROVED: "badge-approved",
  REJECTED: "badge-rejected",
};
