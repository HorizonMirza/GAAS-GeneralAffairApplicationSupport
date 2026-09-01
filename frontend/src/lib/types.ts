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
  | "APPROVED_GA_APPROVAL"
  | "CANCELLED";

export type RejectTarget = "GA" | "ORIGIN";

export type SumberPembelian = "KPU" | "PADI";

// Maintenance: tahap eksekusi fisik setelah laporan disetujui final - berjalan terpisah dari
// status approval-nya sendiri (lihat backend PerbaikanSarana.cs).
export type ExecutionStage = "MENUNGGU" | "LOKASI_DICEK" | "GAMBAR_DIBUAT" | "SELESAI";

export type TipeBooking = "INTERNAL" | "EXTERNAL";

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

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

// Pushed app-wide (ChatHub.UserGroup) whenever anyone sends a chat message on an item this user
// can access - drives the global top-center notification banner + sound, independent of whether
// the relevant chat thread (or that page at all) is open. `kind` matches chatHub.ts's ChatKind.
export interface ChatNotification {
  kind: "pengiriman" | "booking" | "kendaraan" | "atk" | "sarana";
  itemId: number;
  itemLabel: string;
  senderNama: string;
  preview: string;
  createdAt: string;
}

// Pushed the same way as ChatNotification (ChatHub.UserGroup) but on "ReceiveActivityNotification"
// instead - a workflow event (a new transaction submitted, or an approve/reject step), not a chat
// message. Type distinguishes the two cases the notification banner/sound treats differently.
export interface ActivityNotification {
  type: "created" | "approval";
  kind: "pengiriman" | "booking" | "kendaraan" | "atk" | "sarana";
  itemId: number;
  itemLabel: string;
  actorNama: string;
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
  // Computed server-side (see PengirimanController.GetStats) using the same actionability rules
  // as the approve/reject endpoints themselves - do not re-derive these from countsByStatus.
  waitingL1: number;
  waitingGa: number;
  waitingGaApproval: number;
  waitingKpu: number;
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
  // Admin/Approval GA only: inputs on behalf of another divisi/departemen instead of their own GA
  // home unit - ignored by the backend for every other role, and for GA too when left blank.
  divisi?: string;
  departemen?: string;
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
  uploaderNama: string | null;
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
  // Optional (not just VehicleOption's nama/kapasitas) so RoomCalendarView, shared between Room
  // and Vehicle Booking calendars, keeps accepting a VehicleOption[] as its `rooms` prop.
  lantai?: string;
  fasilitas?: string[];
}

export interface WaitlistEntry {
  id: number;
  namaRuang: string;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
  createdAt: string;
  notifiedAt: string | null;
}

export interface BulkRescheduleItemResult {
  id: number;
  tanggalLama: string;
  tanggalBaru: string | null;
  success: boolean;
  detail: string | null;
}

export interface RoomUtilizationItem {
  namaRuang: string;
  bookedHours: number;
  approvedCount: number;
  rejectedCount: number;
  rejectionRate: number | null;
}

export interface UtilizationResponse {
  rooms: RoomUtilizationItem[];
  busyHours: Record<string, number>;
}

export interface BookingRuang {
  id: number;
  nomorPemesanan: string | null;
  namaKegiatan: string;
  pic: string | null;
  namaRuang: string;
  additionalRooms: string[];
  kapasitasRuang: number;
  jumlahPeserta: number;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
  catatan: string | null;
  divisi: string;
  departemen: string | null;
  tipe: TipeBooking;
  seriesId: string | null;
  recurrenceFrequency: RecurrenceFrequency | null;
  recurrenceEndDate: string | null;
  hasConflict: boolean;
  status: BookingStatus;
  rejectReason: string | null;
  rejectTarget: RejectTarget | null;
  cancelledByName: string | null;
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

export interface BookingRuangStatsResponse {
  countsByStatus: Partial<Record<BookingStatus, number>>;
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
  // Admin/Approval GA only: books on behalf of another divisi/departemen instead of their own GA
  // home unit - ignored by the backend for every other role, and for GA too when left blank.
  divisi?: string;
  departemen?: string;
  namaRuang: string;
  additionalRooms?: string[];
  jumlahPeserta: number;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
  catatan: string | null;
  tipe?: TipeBooking;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency | null;
  recurrenceEndDate?: string | null;
}

// Admin/Approval GA's conflict-resolution tool - deliberately narrower than
// BookingRuangCreatePayload, only the fields that define the room+slot.
export interface BookingRuangReschedulePayload {
  namaRuang: string;
  additionalRooms?: string[];
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
}

// Returned by endpoints that finalize a series (submit self-skip, approve-ga-approval): detail
// is a human-readable summary only present when the item belongs to a multi-occurrence series.
export interface BookingRuangActionResult {
  item: BookingRuang;
  detail: string | null;
}

// --- Archive: penyimpanan dokumen umum, tanpa alur approval ---

export type ArchiveKategori = "SOP" | "SURAT" | "KONTRAK" | "LAPORAN" | "PANDUAN" | "LAINNYA";

export interface ArchiveDocument {
  id: number;
  namaDokumen: string;
  kategori: ArchiveKategori;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  catatan: string | null;
  divisi: string;
  departemen: string | null;
  uploadedBy: number;
  uploaderNama: string | null;
  uploadedByRole: Role;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveDocumentListResponse {
  items: ArchiveDocument[];
  total: number;
  page: number;
  limit: number;
}

// --- Maintenance (Perbaikan Sarana) ---
// Alur approval-nya sama dengan Booking/ATK (BookingStatus, berakhir di APPROVED_GA_APPROVAL).

export type KategoriKerusakan = "AC" | "LISTRIK" | "AIR" | "FURNITUR" | "GEDUNG" | "IT" | "LAINNYA";

export type Urgensi = "RENDAH" | "SEDANG" | "TINGGI";

export interface PerbaikanSarana {
  id: number;
  nomorPerbaikan: string | null;
  tanggal: string;
  lokasi: string;
  kategori: KategoriKerusakan;
  urgensi: Urgensi;
  deskripsiKerusakan: string;
  catatan: string | null;
  divisi: string;
  departemen: string | null;
  status: BookingStatus;
  rejectReason: string | null;
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
  executionStage: ExecutionStage;
  lokasiDicekBy: number | null;
  lokasiDicekAt: string | null;
  gambarDibuatBy: number | null;
  gambarDibuatAt: string | null;
  gambarOriginalFilename: string | null;
  selesaiBy: number | null;
  selesaiAt: string | null;
  unreadChatCount: number;
  hasUnreadMention: boolean;
}

export interface PerbaikanSaranaListResponse {
  items: PerbaikanSarana[];
  total: number;
  page: number;
  limit: number;
}

export interface PerbaikanSaranaStatsResponse {
  countsByStatus: Partial<Record<BookingStatus, number>>;
  // Jumlah laporan urgensi TINGGI yang masih berjalan (sudah dikirim, belum selesai/ditolak).
  urgensiTinggiAktif: number;
}

export interface PerbaikanSaranaLog {
  id: number;
  action: string;
  actorNama: string | null;
  actorRole: Role | null;
  reason: string | null;
  createdAt: string;
}

export interface PerbaikanSaranaCreatePayload {
  tanggal: string;
  lokasi: string;
  kategori: KategoriKerusakan;
  urgensi: Urgensi;
  deskripsiKerusakan: string;
  catatan: string | null;
}

// --- Office Supplies (Permintaan ATK) ---
// Alur approval-nya memakai BookingStatus (berakhir di APPROVED_GA_APPROVAL, tanpa tahap KPU).

export interface PermintaanAtkItem {
  id: number;
  namaBarang: string;
  jumlah: number;
  satuan: string;
}

export interface PermintaanAtk {
  id: number;
  nomorPermintaan: string | null;
  tanggal: string;
  keperluan: string;
  catatan: string | null;
  items: PermintaanAtkItem[];
  divisi: string;
  departemen: string | null;
  status: Status;
  rejectReason: string | null;
  sumberPembelian: SumberPembelian | null;
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

export interface PermintaanAtkListResponse {
  items: PermintaanAtk[];
  total: number;
  page: number;
  limit: number;
}

export interface PermintaanAtkStatsResponse {
  countsByStatus: Partial<Record<Status, number>>;
}

export interface PermintaanAtkLog {
  id: number;
  action: string;
  actorNama: string | null;
  actorRole: Role | null;
  reason: string | null;
  createdAt: string;
}

export interface PermintaanAtkItemPayload {
  namaBarang: string;
  jumlah: number;
  satuan: string;
}

export interface PermintaanAtkCreatePayload {
  tanggal: string;
  keperluan: string;
  catatan: string | null;
  items: PermintaanAtkItemPayload[];
}

export interface VehicleOption {
  nama: string;
  platNomor: string;
  kapasitas: number;
  supir: string;
  merek: string;
  model: string;
  tahun: number;
  warna: string;
  nomorTeleponSupir: string;
  lokasiParkir: string;
}

export interface BookingKendaraan {
  id: number;
  nomorPemesanan: string | null;
  keperluan: string;
  pic: string | null;
  namaKendaraan: string;
  platNomor: string | null;
  kapasitasKendaraan: number;
  supir: string | null;
  jumlahPenumpang: number;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
  catatan: string | null;
  divisi: string;
  departemen: string | null;
  status: BookingStatus;
  rejectReason: string | null;
  cancelledByName: string | null;
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

export interface BookingKendaraanListResponse {
  items: BookingKendaraan[];
  total: number;
  page: number;
  limit: number;
}

export interface BookingKendaraanStatsResponse {
  countsByStatus: Partial<Record<BookingStatus, number>>;
}

export interface BookingKendaraanLog {
  id: number;
  action: string;
  actorNama: string | null;
  actorRole: Role | null;
  reason: string | null;
  createdAt: string;
}

export interface BookingKendaraanCreatePayload {
  keperluan: string;
  pic: string | null;
  divisi?: string;
  departemen?: string;
  namaKendaraan: string;
  jumlahPenumpang: number;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
  catatan: string | null;
}

// Admin/Approval GA's conflict-resolution tool - deliberately narrower than
// BookingKendaraanCreatePayload, only the fields that define the vehicle+slot.
export interface BookingKendaraanReschedulePayload {
  namaKendaraan: string;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
}
