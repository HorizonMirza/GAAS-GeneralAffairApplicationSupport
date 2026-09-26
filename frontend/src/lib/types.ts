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
  noHp: string | null;
  email: string | null;
  hasPhoto: boolean;
  hasCoverPhoto: boolean;
  coverPreset: string | null;
  // Set by Super Admin on account creation/password reset (see UsersAdminController) - true blocks
  // every page behind the forced change-password screen ((app)/layout.tsx) until a real password
  // replaces it, which clears this the same way it always has (ProfileController.ChangePassword).
  mustChangePassword: boolean;
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
  kind: "pengiriman" | "booking" | "kendaraan" | "atk" | "sarana" | "arsip";
  itemId: number;
  itemLabel: string;
  senderId: number;
  senderNama: string;
  senderRole: Role;
  preview: string;
  createdAt: string;
}

// Pushed the same way as ChatNotification (ChatHub.UserGroup) but on "ReceiveActivityNotification"
// instead - a workflow event (a new transaction submitted, or an approve/reject step), not a chat
// message. Type distinguishes the color/urgency the notification banner shows: "created"/"approval"
// (still in progress, orange), "approved" (final tier reached, green), "rejected" (red).
export interface ActivityNotification {
  type: "created" | "approval" | "approved" | "rejected";
  kind: "pengiriman" | "booking" | "kendaraan" | "atk" | "sarana" | "arsip";
  itemId: number;
  itemLabel: string;
  actorId: number;
  actorNama: string;
  actorRole: Role;
  message: string;
  createdAt: string;
}

// Global sound choice for each notification type (see NotificationSettingsController) - GET by
// any logged-in user, PUT by Superadmin only.
export interface NotificationSoundSettings {
  chatSoundId: string;
  activitySoundId: string;
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

export interface KoreksiPengirimanPayload {
  namaPengirim: string;
  noTeleponPengirim: string;
  alamatPengirim: string;
  namaPenerima: string;
  alamatPenerima: string;
  noTeleponPenerima: string;
  // Optional - the GA's own explanation for the correction, appended to the auto-generated
  // summary in History rather than replacing it.
  catatan: string;
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
  nama: string;
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

export interface BulkRescheduleItemResult {
  id: number;
  tanggalLama: string;
  tanggalBaru: string | null;
  success: boolean;
  detail: string | null;
}

export interface BookingRuang {
  id: number;
  nomorPemesanan: string | null;
  namaKegiatan: string;
  pic: string | null;
  noTeleponPic: string | null;
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
  cancelledByRole: Role | null;
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
  noTeleponPic: string | null;
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
  jumlahPeserta?: number;
  pic: string;
  noTeleponPic: string;
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

// --- Archive: permintaan pemindahan arsip aktif (dipegang divisi/departemen) ke inaktif
// (dipegang Admin/Approval GA), lewat alur approval yang sama dengan Office Supplies/Maintenance ---

export type ArchiveKategori = "SOP" | "SURAT" | "KONTRAK" | "LAPORAN" | "PANDUAN" | "LAINNYA";

export interface PermintaanArsip {
  id: number;
  nomorArsip: string | null;
  tanggal: string;
  jumlahArsip: number;
  namaArsip: string;
  kategori: ArchiveKategori;
  tahunArsip: string;
  lokasiPenyimpanan: string;
  namaPic: string | null;
  noTeleponPic: string | null;
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
  unreadChatCount: number;
  hasUnreadMention: boolean;
}

export interface PermintaanArsipListResponse {
  items: PermintaanArsip[];
  total: number;
  page: number;
  limit: number;
}

export interface PermintaanArsipStatsResponse {
  countsByStatus: Partial<Record<BookingStatus, number>>;
}

export interface PermintaanArsipCatalogItem {
  id: number;
  nomorArsip: string | null;
  tanggal: string;
  jumlahArsip: number;
  namaArsip: string;
  kategori: ArchiveKategori;
  tahunArsip: string;
  lokasiPenyimpanan: string;
  namaPic: string | null;
  noTeleponPic: string | null;
  divisi: string;
  departemen: string | null;
  catatan: string | null;
  approvedApprovalGaAt: string | null;
}

export interface PermintaanArsipCatalogResponse {
  items: PermintaanArsipCatalogItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PermintaanArsipLog {
  id: number;
  action: string;
  actorNama: string | null;
  actorRole: Role | null;
  reason: string | null;
  createdAt: string;
}

export interface PermintaanArsipCreatePayload {
  // Admin/Approval GA only: requests on behalf of another divisi/departemen instead of their own
  // GA home unit - ignored by the backend for every other role, and for GA too when left blank.
  divisi?: string;
  departemen?: string;
  tanggal: string;
  jumlahArsip: number;
  namaArsip: string;
  kategori: ArchiveKategori;
  tahunArsip: string;
  lokasiPenyimpanan: string;
  namaPic: string;
  noTeleponPic: string;
  catatan: string | null;
}

export interface KoreksiArsipPayload {
  lokasiPenyimpanan: string;
  namaPic: string;
  noTeleponPic: string;
  catatan: string;
}

// --- Maintenance (Perbaikan Sarana) ---
// Alur approval-nya sama dengan Booking/ATK (BookingStatus, berakhir di APPROVED_GA_APPROVAL).

export type KategoriKerusakan = "AC" | "LISTRIK" | "AIR" | "FURNITUR" | "GEDUNG" | "IT" | "LAINNYA";

export interface PerbaikanSaranaFotoKerusakan {
  id: number;
  originalFilename: string;
}

export interface PerbaikanSarana {
  id: number;
  nomorPerbaikan: string | null;
  tanggal: string;
  lokasi: string;
  kategori: KategoriKerusakan;
  deskripsiKerusakan: string;
  catatan: string | null;
  namaPelapor: string;
  noTeleponPelapor: string;
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
  fotoSelesaiOriginalFilename: string | null;
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
  // Breakdown ExecutionStage, hanya di antara laporan yang sudah Approved final.
  executionStageCounts: Partial<Record<ExecutionStage, number>>;
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
  // Admin/Approval GA only: requests on behalf of another divisi/departemen instead of their own
  // GA home unit - ignored by the backend for every other role, and for GA too when left blank.
  divisi?: string;
  departemen?: string;
  tanggal: string;
  lokasi: string;
  kategori: KategoriKerusakan;
  deskripsiKerusakan: string;
  catatan: string | null;
  namaPelapor: string;
  noTeleponPelapor: string;
}

// Admin/Approval GA's narrow correction payload - see PerbaikanSaranaController.Koreksi.
export interface KoreksiSaranaPayload {
  namaPelapor: string;
  noTeleponPelapor: string;
  lokasi: string;
  catatan: string;
}

// --- Office Supplies (Permintaan ATK) ---
// Alur approval-nya memakai BookingStatus (berakhir di APPROVED_GA_APPROVAL, tanpa tahap KPU).

export type AtkKategori =
  | "ALAT_TULIS"
  | "KERTAS_CETAK"
  | "PERLENGKAPAN_KANTOR"
  | "MAP_FILING"
  | "ELEKTRONIK_KOMPUTER"
  | "KEBERSIHAN_PANTRY"
  | "PERLENGKAPAN_RAPAT"
  | "LAINNYA";

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
  kategori: AtkKategori;
  keperluan: string;
  catatan: string | null;
  items: PermintaanAtkItem[];
  divisi: string;
  departemen: string | null;
  namaPemohon: string;
  noTeleponPemohon: string;
  status: Status;
  rejectReason: string | null;
  sumberPembelian: SumberPembelian | null;
  totalHargaBarang: number | null;
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
  totalBulanIni: number | null;
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
  // Admin/Approval GA only: requests on behalf of another divisi/departemen instead of their own
  // GA home unit - ignored by the backend for every other role, and for GA too when left blank.
  divisi?: string;
  departemen?: string;
  tanggal: string;
  kategori: AtkKategori;
  keperluan: string;
  namaPemohon: string;
  noTeleponPemohon: string;
  catatan: string | null;
  items: PermintaanAtkItemPayload[];
  // Only honored by the backend when Admin/Approval GA revises a request that already has a
  // SumberPembelian on it (e.g. fixing a wrong pick after Approval GA/Mitra rejects it).
  sumberPembelian?: SumberPembelian;
}

// Admin/Approval GA's own edit payload - see PermintaanAtkController.UpdateByGa.
export interface AtkGaUpdatePayload {
  namaPemohon: string;
  noTeleponPemohon: string;
  keperluan: string;
  items: PermintaanAtkItemPayload[];
  sumberPembelian?: SumberPembelian;
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
  noTeleponPic: string | null;
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
  cancelledByRole: Role | null;
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
  noTeleponPic: string | null;
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

// Admin/Approval GA's single in-flight edit tool - the vehicle+slot, jumlahPenumpang (switching
// vehicle can change the capacity it has to fit within), and the PIC's name/phone (e.g. fixing a
// typo). keperluan/catatan stay the origin creator's own and aren't part of this payload.
export interface BookingKendaraanReschedulePayload {
  namaKendaraan: string;
  jumlahPenumpang: number;
  pic: string;
  noTeleponPic: string;
  tanggal: string;
  isWholeDay: boolean;
  jamMulai: string | null;
  jamSelesai: string | null;
}

// ---------------------------------------------------------------------------
// Riwayat Aktivitas (Super Admin)
// ---------------------------------------------------------------------------

// Each module writes its own *_logs table, and each one is only readable through
// that module's {id}/logs endpoint. The backend UNIONs all seven into one stream
// so Super Admin can ask "what did this person do last week" across the app.
export type RiwayatModul =
  | "ekspedisi"
  | "booking-ruang"
  | "booking-kendaraan"
  | "permintaan-atk"
  | "perbaikan-sarana"
  | "permintaan-arsip"
  | "invoice"
  // 8th source (see backend's RiwayatAktivitasController) - a Super Admin delete, sourced
  // straight from deletion_log instead of one of the other seven modules' own *_logs table.
  | "deleted";

export interface RiwayatAktivitas {
  modul: RiwayatModul;
  itemId: number;
  // The parent's human-readable number, or the invoice's Bulan. Null when the
  // record never got one (an unsubmitted draft).
  nomor: string | null;
  action: string;
  reason: string | null;
  actorId: number | null;
  actorNama: string | null;
  actorRole: string | null;
  createdAt: string;
}

export interface RiwayatAktivitasListResponse {
  items: RiwayatAktivitas[];
  total: number;
  page: number;
  limit: number;
}

export interface RiwayatAktor {
  id: number;
  nama: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Organisasi (Super Admin org-admin endpoints) - see backend's OrgAdminController and
// Services/OrgTree.cs. Distinct from OrgStructure above (which every role reads, name-only, to
// populate dropdowns) - these carry the row ids Super Admin's editor needs to rename/delete a
// specific node.
// ---------------------------------------------------------------------------

export interface OrgDepartemenNode {
  id: number;
  nama: string;
}

export interface OrgDivisiNode {
  id: number;
  nama: string;
  kodeSatuanKerja: string;
  departemen: OrgDepartemenNode[];
}

export interface OrgDirektoratNode {
  id: number;
  nama: string;
  divisi: OrgDivisiNode[];
}

export interface OrgTreeResponse {
  direktorat: OrgDirektoratNode[];
}

// A one-time plaintext password - only ever present in the direct response of the create/reset
// call that generated it, never stored or retrievable again afterward.
export interface ProvisionedAccountCredential {
  username: string;
  nama: string;
  role: Role;
  password: string;
}

export interface CreateDivisiResult {
  divisi: OrgDivisiNode;
  accounts: ProvisionedAccountCredential[];
}

export interface CreateDepartemenResult {
  departemen: OrgDepartemenNode;
  accounts: ProvisionedAccountCredential[];
}

// ---------------------------------------------------------------------------
// Meeting Room / Vehicle Admin (Super Admin meeting-room-admin/vehicle-admin endpoints) - see
// backend's MeetingRoomAdminController/VehicleAdminController.
// ---------------------------------------------------------------------------

export interface MeetingRoomItem {
  id: number;
  nama: string;
  kapasitas: number;
  lantai: string;
  fasilitas: string[];
}

export interface MeetingRoomListResult {
  rooms: MeetingRoomItem[];
}

export interface VehicleItem {
  id: number;
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

export interface VehicleListResult {
  vehicles: VehicleItem[];
}

// ---------------------------------------------------------------------------
// Users Admin (Super Admin users-admin endpoints) - see backend's UsersAdminController.
// ---------------------------------------------------------------------------

export interface AdminUserListItem {
  id: number;
  username: string;
  nama: string;
  role: Role;
  direktorat: string | null;
  divisi: string | null;
  departemen: string | null;
  email: string | null;
  noHp: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserPayload {
  username: string;
  nama: string;
  role: Role;
  direktorat?: string | null;
  divisi?: string | null;
  departemen?: string | null;
  email?: string | null;
  noHp?: string | null;
}

// Partial update - a field left out is left untouched server-side (see UsersAdminController.
// Update's own comment), so callers only ever send the fields the Edit form actually changed.
// divisi/departemen can't use "send null to clear" like the rest, since null there is also a
// valid value (no unit) - set clearDivisi/clearDepartemen instead to actually unassign one.
export interface UpdateUserPayload {
  nama?: string;
  email?: string | null;
  noHp?: string | null;
  role?: Role;
  divisi?: string | null;
  departemen?: string | null;
  clearDivisi?: boolean;
  clearDepartemen?: boolean;
}

export interface CreatedUserResult {
  user: AdminUserListItem;
  password: string;
}

export interface ResetPasswordResult {
  password: string;
}
