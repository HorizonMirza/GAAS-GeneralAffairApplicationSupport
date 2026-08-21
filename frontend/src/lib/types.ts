export type Role =
  | "ADMIN_DEPARTEMEN"
  | "APPROVAL_DEPARTEMEN"
  | "ADMIN_DIVISI"
  | "APPROVAL_DIVISI"
  | "ADMIN_GA"
  | "APPROVAL_GA"
  | "KPU"
  | "SUPER_ADMIN";

export type Status =
  | "DRAFT"
  | "SUBMITTED"
  | "REJECTED_L1"
  | "APPROVED_L1"
  | "REJECTED_GA"
  | "APPROVED_GA"
  | "REJECTED_GA_APPROVAL"
  | "APPROVED_GA_APPROVAL"
  | "REJECTED_KPU"
  | "COMPLETED";

export type BookingStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REJECTED_L1"
  | "APPROVED_L1"
  | "REJECTED_GA"
  | "APPROVED_GA"
  | "REJECTED_GA_APPROVAL"
  | "APPROVED_GA_APPROVAL";

export type RejectTarget = "GA" | "ORIGIN";

export type Asuransi = "Ya" | "Tidak";

export type InvoiceStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export interface Me {
  id: number;
  username: string;
  nama: string;
  role: Role;
  direktorat: string | null;
  divisi: string | null;
  departemen: string | null;
}

export interface DivisiNode {
  nama: string;
  departemen: string[];
}

export interface DirektoratNode {
  nama: string;
  divisi: DivisiNode[];
}

export interface OrgStructure {
  direktorat: string[];
  divisi: string[];
  departemen: string[];
  direktoratTree: DirektoratNode[];
}

export interface Pengiriman {
  id: number;
  noResi: string | null;
  tanggal: string;
  tujuanPenerimaan: string;
  jumlahItem: number;
  namaPengirim: string;
  noTeleponPengirim: string;
  alamatPengirim: string;
  divisi: string;
  departemen: string | null;
  nomorTransmittal: string;
  kodeProgram: string;
  namaPenerima: string;
  alamatPenerima: string;
  noTeleponPenerima: string;
  asuransiStatus: Asuransi;
  requestPacking: string;
  catatan: string | null;
  beratBarangKg: number | null;
  asuransiHarga: number | null;
  subTotal: number | null;
  total: number | null;
  status: Status;
  rejectReason: string | null;
  rejectTarget: RejectTarget | null;
  createdBy: number;
  createdByRole: Role;
  approvedByL1: number | null;
  approvedByGa: number | null;
  approvedByApprovalGa: number | null;
  approvedByKpu: number | null;
  createdAt: string;
  updatedAt: string;
  approvedL1At: string | null;
  approvedGaAt: string | null;
  approvedApprovalGaAt: string | null;
  approvedKpuAt: string | null;
  unreadChatCount: number;
  hasUnreadMention: boolean;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderNama: string;
  senderRole: Role;
  message: string;
  createdAt: string;
}

export interface PengirimanListResponse {
  items: Pengiriman[];
  total: number;
  page: number;
  limit: number;
  totalBulanIni: number | null;
}

export interface PengirimanStatsResponse {
  countsByStatus: Partial<Record<Status, number>>;
  totalBulanIni: number | null;
}

export interface PengirimanLog {
  id: number;
  action: string;
  actorNama: string | null;
  actorRole: Role | null;
  reason: string | null;
  createdAt: string;
}

export interface PengirimanCreatePayload {
  tanggal: string;
  jumlahItem: number;
  tujuanPenerimaan: string;
  namaPengirim: string;
  noTeleponPengirim: string;
  alamatPengirim: string;
  kodeProgram: string;
  namaPenerima: string;
  noTeleponPenerima: string;
  alamatPenerima: string;
  asuransiStatus: Asuransi;
  requestPacking: string;
  catatan: string | null;
}

export interface ApproveKpuPayload {
  noResi: string;
  beratBarangKg: number;
  asuransiHarga: number;
  subTotal: number;
  total: number;
}

export interface Invoice {
  id: number;
  bulan: string;
  originalFilename: string;
  status: InvoiceStatus;
  catatan: string | null;
  uploadedBy: number;
  reviewedBy: number | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface InvoiceLog {
  id: number;
  action: string;
  actorNama: string | null;
  actorRole: Role | null;
  reason: string | null;
  originalFilename: string | null;
  createdAt: string;
}

export interface RoomOption {
  nama: string;
  kapasitas: number;
}

export interface BookingRuang {
  id: number;
  nomorPemesanan: string | null;
  namaKegiatan: string;
  pic: string | null;
  namaRuang: string;
  kapasitasRuang: number;
  jumlahPeserta: number;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
  catatan: string | null;
  divisi: string;
  departemen: string | null;
  status: BookingStatus;
  rejectReason: string | null;
  rejectTarget: RejectTarget | null;
  createdBy: number;
  createdByRole: Role;
  approvedByL1: number | null;
  approvedByGa: number | null;
  approvedByApprovalGa: number | null;
  createdAt: string;
  updatedAt: string;
  approvedL1At: string | null;
  approvedGaAt: string | null;
  approvedApprovalGaAt: string | null;
  unreadChatCount: number;
  hasUnreadMention: boolean;
}

export interface BookingRuangListResponse {
  items: BookingRuang[];
  total: number;
  page: number;
  limit: number;
}

export interface BookingRuangLog {
  id: number;
  action: string;
  actorNama: string | null;
  actorRole: Role | null;
  reason: string | null;
  createdAt: string;
}

export interface BookingRuangCreatePayload {
  namaKegiatan: string;
  pic: string | null;
  namaRuang: string;
  jumlahPeserta: number;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
  catatan: string | null;
}

// Admin/Approval GA's conflict-resolution tool - deliberately narrower than
// BookingRuangCreatePayload, only the fields that define the room+slot.
export interface BookingRuangReschedulePayload {
  namaRuang: string;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
}
