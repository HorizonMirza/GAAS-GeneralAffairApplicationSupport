import type {
  ApproveKpuPayload,
  ArchiveKategori,
  BookingKendaraan,
  BookingKendaraanCreatePayload,
  BookingKendaraanListResponse,
  BookingKendaraanLog,
  BookingKendaraanReschedulePayload,
  BookingKendaraanStatsResponse,
  BookingRuang,
  BookingRuangActionResult,
  BookingRuangCreatePayload,
  BookingRuangListResponse,
  BookingRuangLog,
  BookingRuangReschedulePayload,
  BulkRescheduleItemResult,
  BookingRuangStatsResponse,
  BookingStatus,
  ChatMessage,
  Invoice,
  KategoriKerusakan,
  Urgensi,
  InvoiceListResponse,
  InvoiceLog,
  Me,
  OrgStructure,
  Pengiriman,
  PengirimanCreatePayload,
  PengirimanListResponse,
  PengirimanLog,
  PengirimanStatsResponse,
  PerbaikanSarana,
  PerbaikanSaranaCreatePayload,
  PerbaikanSaranaListResponse,
  PerbaikanSaranaLog,
  PerbaikanSaranaStatsResponse,
  PermintaanArsip,
  PermintaanArsipCreatePayload,
  PermintaanArsipListResponse,
  PermintaanArsipLog,
  PermintaanArsipStatsResponse,
  PermintaanAtk,
  PermintaanAtkCreatePayload,
  PermintaanAtkListResponse,
  PermintaanAtkLog,
  PermintaanAtkStatsResponse,
  RejectTarget,
  RoomOption,
  Status,
  SumberPembelian,
  UtilizationResponse,
  VehicleOption,
  WaitlistEntry,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | undefined | null>;
  isAuthCall?: boolean;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, isAuthCall = false } = options;
  let url = `${API_BASE}${path}`;
  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    if (query) url += `?${query}`;
  }

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !isAuthCall) {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
    throw new ApiError("Sesi berakhir, silakan login kembali", 401);
  }

  if (!response.ok) {
    let detail = "Terjadi kesalahan";
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) return null as T;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return null as T;
}

// The row-menu's "Download PDF" / "Export Calendar" links used to be plain <a href> tags - fine
// when the request succeeds, but a 403 (e.g. someone outside the booking's own divisi/departemen,
// see CanAccessBookingRuang on the backend) then surfaces as a raw browser error page instead of
// the same clean in-app message Chat/History already show for that exact restriction. Fetching
// the file via JS and triggering the save ourselves lets a failed request throw an ApiError the
// caller can toast instead.
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401) {
    if (typeof window !== "undefined" && window.location.pathname !== "/") window.location.href = "/";
    throw new ApiError("Sesi berakhir, silakan login kembali", 401);
  }
  if (!response.ok) {
    let detail = "Gagal mengunduh file";
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, response.status);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export interface ListInvoiceParams {
  page?: number;
  limit?: number;
  bulan?: string;
  search?: string;
  uploadedBy?: number;
}

export interface ListPengirimanParams {
  page?: number;
  limit?: number;
  bulan?: string;
  sejakBulan?: string;
  nomorTransmittal?: string;
  // "REJECTED" is a synthetic value (not a real Status) meaning "any of the 4 reject-stage
  // statuses" - collapsed into one Status filter dropdown option.
  status?: Status | "REJECTED" | "";
  divisi?: string;
  departemen?: string;
  direktorat?: string;
}

function listParams(p: ListPengirimanParams) {
  return {
    page: p.page,
    limit: p.limit,
    bulan: p.bulan,
    sejakBulan: p.sejakBulan,
    nomor_transmittal: p.nomorTransmittal,
    status: p.status,
    divisi: p.divisi,
    departemen: p.departemen,
    direktorat: p.direktorat,
  };
}

export const api = {
  login: (username: string, password: string) =>
    apiRequest<{ message: string; role: string }>("/auth/login", {
      method: "POST",
      body: { username, password },
      isAuthCall: true,
    }),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
  me: () => apiRequest<Me>("/me"),
  orgStructure: () => apiRequest<OrgStructure>("/org-structure"),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest("/profile/password", {
      method: "PUT",
      body: { currentPassword, newPassword },
    }),

  listPengiriman: (params: ListPengirimanParams) =>
    apiRequest<PengirimanListResponse>("/pengiriman", { params: listParams(params) }),
  getPengiriman: (id: number) => apiRequest<Pengiriman>(`/pengiriman/${id}`),
  getPengirimanStats: (bulan: string) =>
    apiRequest<PengirimanStatsResponse>("/pengiriman/stats", { params: { bulan } }),
  createPengiriman: (payload: PengirimanCreatePayload) =>
    apiRequest("/pengiriman", { method: "POST", body: payload }),
  updatePengiriman: (id: number, payload: PengirimanCreatePayload) =>
    apiRequest(`/pengiriman/${id}`, { method: "PUT", body: payload }),
  deletePengiriman: (id: number) => apiRequest(`/pengiriman/${id}`, { method: "DELETE" }),
  deleteCompleted: (id: number) => apiRequest(`/pengiriman/${id}/super-admin`, { method: "DELETE" }),
  submitPengiriman: (id: number) => apiRequest(`/pengiriman/${id}/submit`, { method: "PATCH" }),
  nextTransmittal: (tanggal: string, divisi?: string) =>
    apiRequest<{ nomorTransmittal: string }>("/pengiriman/next-transmittal", { params: { tanggal, divisi } }),
  approveL1: (id: number) => apiRequest(`/pengiriman/${id}/approve-l1`, { method: "PATCH" }),
  rejectL1: (id: number, reason: string | null) =>
    apiRequest(`/pengiriman/${id}/reject-l1`, { method: "PATCH", body: { reason } }),
  approveGa: (id: number) => apiRequest(`/pengiriman/${id}/approve-ga`, { method: "PATCH" }),
  rejectGa: (id: number, reason: string | null) =>
    apiRequest(`/pengiriman/${id}/reject-ga`, { method: "PATCH", body: { reason } }),
  approveGaApproval: (id: number) => apiRequest(`/pengiriman/${id}/approve-ga-approval`, { method: "PATCH" }),
  rejectGaApproval: (id: number, reason: string | null, target: RejectTarget) =>
    apiRequest(`/pengiriman/${id}/reject-ga-approval`, { method: "PATCH", body: { reason, target } }),
  approveKpu: (id: number, payload: ApproveKpuPayload) =>
    apiRequest(`/pengiriman/${id}/approve-kpu`, { method: "PATCH", body: payload }),
  rejectKpu: (id: number, reason: string | null, target: RejectTarget) =>
    apiRequest(`/pengiriman/${id}/reject-kpu`, { method: "PATCH", body: { reason, target } }),
  getPengirimanLogs: (id: number) => apiRequest<PengirimanLog[]>(`/pengiriman/${id}/logs`),
  getChatMessages: (id: number) => apiRequest<ChatMessage[]>(`/pengiriman/${id}/chat`),
  sendChatMessage: (id: number, message: string) =>
    apiRequest<ChatMessage>(`/pengiriman/${id}/chat`, { method: "POST", body: { message } }),

  listInvoice: (params: ListInvoiceParams = {}) =>
    apiRequest<InvoiceListResponse>("/invoice", { params: { page: params.page, limit: params.limit, bulan: params.bulan, search: params.search, uploadedBy: params.uploadedBy } }),
  listInvoiceUploaders: () => apiRequest<{ id: number; nama: string }[]>("/invoice/uploaders"),
  getMissingInvoiceMonths: (monthsBack?: number) =>
    apiRequest<string[]>("/invoice/missing-months", { params: { monthsBack } }),
  uploadInvoice: async (bulan: string, file: File) => {
    const formData = new FormData();
    formData.append("bulan", bulan);
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/invoice`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      let detail = "Gagal mengunggah invoice";
      try {
        const data = await response.json();
        detail = data.detail || detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, response.status);
    }
    return response.json();
  },
  updateInvoice: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/invoice/${id}`, {
      method: "PATCH",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      let detail = "Gagal mengirim ulang invoice";
      try {
        const data = await response.json();
        detail = data.detail || detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, response.status);
    }
    return response.json();
  },
  submitInvoice: (id: number) => apiRequest(`/invoice/${id}/submit`, { method: "PATCH" }),
  approveInvoice: (id: number, catatan: string | null) =>
    apiRequest(`/invoice/${id}/approve`, { method: "PATCH", body: { catatan } }),
  rejectInvoice: (id: number, catatan: string | null) =>
    apiRequest(`/invoice/${id}/reject`, { method: "PATCH", body: { catatan } }),
  deleteInvoice: (id: number) => apiRequest(`/invoice/${id}`, { method: "DELETE" }),
  invoiceFileUrl: (id: number) => `${API_BASE}/invoice/${id}/file`,
  invoiceDownloadUrl: (id: number) => `${API_BASE}/invoice/${id}/file?download=true`,
  getInvoiceLogs: (id: number) => apiRequest<InvoiceLog[]>(`/invoice/${id}/logs`),
  invoiceLogFileUrl: (id: number, logId: number) => `${API_BASE}/invoice/${id}/logs/${logId}/file`,
  invoiceLogDownloadUrl: (id: number, logId: number) => `${API_BASE}/invoice/${id}/logs/${logId}/file?download=true`,
  exportUrl: (params: Record<string, string | undefined | null>) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return `${API_BASE}/pengiriman/export${query ? `?${query}` : ""}`;
  },
  pdfUrl: (params: Record<string, string | undefined | null>) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return `${API_BASE}/pengiriman/export-pdf${query ? `?${query}` : ""}`;
  },

  bookingExportUrl: (params: Record<string, string | undefined | null>) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return `${API_BASE}/booking-ruang/export${query ? `?${query}` : ""}`;
  },
  bookingExportPdfUrl: (params: Record<string, string | undefined | null>) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return `${API_BASE}/booking-ruang/export-pdf${query ? `?${query}` : ""}`;
  },

  listRooms: () => apiRequest<RoomOption[]>("/booking-ruang/rooms"),
  getRoomFeedUrl: (roomName: string) =>
    apiRequest<{ url: string; webcalUrl: string }>(`/booking-ruang/rooms/${encodeURIComponent(roomName)}/feed-url`),
  getRoomUtilization: (dateFrom: string, dateTo: string) =>
    apiRequest<UtilizationResponse>("/booking-ruang/utilization", { params: { dateFrom, dateTo } }),
  joinWaitlist: (payload: { namaRuang: string; tanggal: string; isWholeDay: boolean; jamMulai?: string | null; jamSelesai?: string | null }) =>
    apiRequest<WaitlistEntry>("/booking-ruang/waitlist", { method: "POST", body: payload }),
  myWaitlist: () => apiRequest<WaitlistEntry[]>("/booking-ruang/waitlist/mine"),
  leaveWaitlist: (id: number) => apiRequest(`/booking-ruang/waitlist/${id}`, { method: "DELETE" }),
  nextBookingNomor: (tanggal: string, divisi?: string) =>
    apiRequest<{ nomorPemesanan: string }>("/booking-ruang/next-nomor", { params: { tanggal, divisi } }),
  getBookingSchedule: (tanggal: string) =>
    apiRequest<BookingRuang[]>("/booking-ruang/schedule", { params: { tanggal } }),
  getBookingScheduleRange: (tanggalMulai: string, tanggalSelesai: string, namaRuang?: string) =>
    apiRequest<BookingRuang[]>("/booking-ruang/schedule-range", {
      params: { tanggalMulai, tanggalSelesai, nama_ruang: namaRuang },
    }),
  listBooking: (params: ListBookingParams) =>
    apiRequest<BookingRuangListResponse>("/booking-ruang", { params: bookingListParams(params) }),
  // Single-item fetch independent of List's pagination/filters - used to deep-link a notification
  // banner click straight to an item's chat even when it isn't on whatever page is loaded.
  getBooking: (id: number) => apiRequest<BookingRuang>(`/booking-ruang/${id}`),
  getBookingStats: (bulan: string) =>
    apiRequest<BookingRuangStatsResponse>("/booking-ruang/stats", { params: { bulan } }),
  // Create always returns a list of occurrences, even a single non-recurring booking (one-item
  // list) - a recurring series comes back as one BookingRuang per occurrence date.
  createBooking: (payload: BookingRuangCreatePayload) =>
    apiRequest<BookingRuang[]>("/booking-ruang", { method: "POST", body: normalizeBookingPayload(payload) }),
  updateBooking: (id: number, payload: BookingRuangCreatePayload) =>
    apiRequest<BookingRuang>(`/booking-ruang/${id}`, { method: "PUT", body: normalizeBookingPayload(payload) }),
  rescheduleBooking: (id: number, payload: BookingRuangReschedulePayload) =>
    apiRequest<BookingRuang>(`/booking-ruang/${id}/reschedule`, {
      method: "PATCH",
      body: { ...payload, jamMulai: normalizeTime(payload.jamMulai), jamSelesai: normalizeTime(payload.jamSelesai) },
    }),
  bulkRescheduleSeries: (seriesId: string, dayShift: number) =>
    apiRequest<BulkRescheduleItemResult[]>(`/booking-ruang/series/${seriesId}/bulk-reschedule`, {
      method: "PATCH",
      body: { dayShift },
    }),
  deleteBooking: (id: number) => apiRequest(`/booking-ruang/${id}`, { method: "DELETE" }),
  superAdminDeleteBooking: (id: number) => apiRequest(`/booking-ruang/${id}/super-admin`, { method: "DELETE" }),
  cancelBooking: (id: number, reason: string | null) =>
    apiRequest<BookingRuang>(`/booking-ruang/${id}/cancel`, { method: "PATCH", body: { reason } }),
  // The backend only wraps the response in {item, detail} when finalizing a series (submit's
  // Approval-GA self-skip branch, approve-ga-approval); every other branch/endpoint returns a
  // bare BookingRuang. Normalize all three to BookingRuangActionResult here so callers never have
  // to know which branch fired.
  submitBooking: async (id: number) =>
    normalizeActionResult(
      await apiRequest<BookingRuang | BookingRuangActionResult>(`/booking-ruang/${id}/submit`, { method: "PATCH" })
    ),
  approveBookingL1: (id: number) => apiRequest<BookingRuang>(`/booking-ruang/${id}/approve-l1`, { method: "PATCH" }),
  rejectBookingL1: (id: number, reason: string | null) =>
    apiRequest<BookingRuang>(`/booking-ruang/${id}/reject-l1`, { method: "PATCH", body: { reason } }),
  approveBookingGa: (id: number) => apiRequest<BookingRuang>(`/booking-ruang/${id}/approve-ga`, { method: "PATCH" }),
  rejectBookingGa: (id: number, reason: string | null) =>
    apiRequest<BookingRuang>(`/booking-ruang/${id}/reject-ga`, { method: "PATCH", body: { reason } }),
  approveBookingGaApproval: async (id: number) =>
    normalizeActionResult(
      await apiRequest<BookingRuang | BookingRuangActionResult>(`/booking-ruang/${id}/approve-ga-approval`, { method: "PATCH" })
    ),
  rejectBookingGaApproval: async (id: number, reason: string | null) =>
    normalizeActionResult(
      await apiRequest<BookingRuang | BookingRuangActionResult>(`/booking-ruang/${id}/reject-ga-approval`, {
        method: "PATCH",
        body: { reason },
      })
    ),
  getBookingLogs: (id: number) => apiRequest<BookingRuangLog[]>(`/booking-ruang/${id}/logs`),
  getBookingChatMessages: (id: number) => apiRequest<ChatMessage[]>(`/booking-ruang/${id}/chat`),
  sendBookingChatMessage: (id: number, message: string) =>
    apiRequest<ChatMessage>(`/booking-ruang/${id}/chat`, { method: "POST", body: { message } }),
  bookingPdfUrl: (id: number) => `${API_BASE}/booking-ruang/${id}/pdf`,
  bookingIcsUrl: (id: number) => `${API_BASE}/booking-ruang/${id}/ics`,

  listVehicles: () => apiRequest<VehicleOption[]>("/booking-kendaraan/vehicles"),
  nextKendaraanNomor: (tanggal: string, divisi?: string) =>
    apiRequest<{ nomorPemesanan: string }>("/booking-kendaraan/next-nomor", { params: { tanggal, divisi } }),
  getKendaraanSchedule: (tanggal: string) =>
    apiRequest<BookingKendaraan[]>("/booking-kendaraan/schedule", { params: { tanggal } }),
  getKendaraanScheduleRange: (tanggalMulai: string, tanggalSelesai: string, namaKendaraan?: string) =>
    apiRequest<BookingKendaraan[]>("/booking-kendaraan/schedule-range", {
      params: { tanggalMulai, tanggalSelesai, nama_kendaraan: namaKendaraan },
    }),
  listKendaraanBooking: (params: ListKendaraanBookingParams) =>
    apiRequest<BookingKendaraanListResponse>("/booking-kendaraan", { params: kendaraanListParams(params) }),
  getKendaraanBooking: (id: number) => apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}`),
  getKendaraanStats: (bulan: string) =>
    apiRequest<BookingKendaraanStatsResponse>("/booking-kendaraan/stats", { params: { bulan } }),
  createKendaraanBooking: (payload: BookingKendaraanCreatePayload) =>
    apiRequest<BookingKendaraan>("/booking-kendaraan", { method: "POST", body: normalizeKendaraanPayload(payload) }),
  updateKendaraanBooking: (id: number, payload: BookingKendaraanCreatePayload) =>
    apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}`, { method: "PUT", body: normalizeKendaraanPayload(payload) }),
  rescheduleKendaraanBooking: (id: number, payload: BookingKendaraanReschedulePayload) =>
    apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/reschedule`, {
      method: "PATCH",
      body: { ...payload, jamMulai: normalizeTime(payload.jamMulai), jamSelesai: normalizeTime(payload.jamSelesai) },
    }),
  deleteKendaraanBooking: (id: number) => apiRequest(`/booking-kendaraan/${id}`, { method: "DELETE" }),
  superAdminDeleteKendaraanBooking: (id: number) => apiRequest(`/booking-kendaraan/${id}/super-admin`, { method: "DELETE" }),
  cancelKendaraanBooking: (id: number, reason: string | null) =>
    apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/cancel`, { method: "PATCH", body: { reason } }),
  submitKendaraanBooking: (id: number) => apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/submit`, { method: "PATCH" }),
  approveKendaraanL1: (id: number) => apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/approve-l1`, { method: "PATCH" }),
  rejectKendaraanL1: (id: number, reason: string | null) =>
    apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/reject-l1`, { method: "PATCH", body: { reason } }),
  approveKendaraanGa: (id: number) => apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/approve-ga`, { method: "PATCH" }),
  rejectKendaraanGa: (id: number, reason: string | null) =>
    apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/reject-ga`, { method: "PATCH", body: { reason } }),
  approveKendaraanGaApproval: (id: number) =>
    apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/approve-ga-approval`, { method: "PATCH" }),
  rejectKendaraanGaApproval: (id: number, reason: string | null) =>
    apiRequest<BookingKendaraan>(`/booking-kendaraan/${id}/reject-ga-approval`, { method: "PATCH", body: { reason } }),
  getKendaraanLogs: (id: number) => apiRequest<BookingKendaraanLog[]>(`/booking-kendaraan/${id}/logs`),
  getKendaraanChatMessages: (id: number) => apiRequest<ChatMessage[]>(`/booking-kendaraan/${id}/chat`),
  sendKendaraanChatMessage: (id: number, message: string) =>
    apiRequest<ChatMessage>(`/booking-kendaraan/${id}/chat`, { method: "POST", body: { message } }),

  nextAtkNomor: (tanggal: string) =>
    apiRequest<{ nomorPermintaan: string }>("/permintaan-atk/next-nomor", { params: { tanggal } }),
  listAtk: (params: ListAtkParams) =>
    apiRequest<PermintaanAtkListResponse>("/permintaan-atk", { params: atkListParams(params) }),
  getAtk: (id: number) => apiRequest<PermintaanAtk>(`/permintaan-atk/${id}`),
  getAtkStats: (bulan: string) =>
    apiRequest<PermintaanAtkStatsResponse>("/permintaan-atk/stats", { params: { bulan } }),
  createAtk: (payload: PermintaanAtkCreatePayload) =>
    apiRequest<PermintaanAtk>("/permintaan-atk", { method: "POST", body: payload }),
  updateAtk: (id: number, payload: PermintaanAtkCreatePayload) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}`, { method: "PUT", body: payload }),
  deleteAtk: (id: number) => apiRequest(`/permintaan-atk/${id}`, { method: "DELETE" }),
  superAdminDeleteAtk: (id: number) => apiRequest(`/permintaan-atk/${id}/super-admin`, { method: "DELETE" }),
  // sumberPembelian is only actually required by the backend when Submit's own self-skip logic
  // lands the item past the Admin GA tier (an Admin/Approval GA submitting their own draft) -
  // every other caller passes null and the backend ignores it.
  submitAtk: (id: number, sumberPembelian: SumberPembelian | null = null) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/submit`, { method: "PATCH", body: { sumberPembelian } }),
  approveAtkL1: (id: number) => apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/approve-l1`, { method: "PATCH" }),
  rejectAtkL1: (id: number, reason: string | null) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/reject-l1`, { method: "PATCH", body: { reason } }),
  approveAtkGa: (id: number, sumberPembelian: SumberPembelian) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/approve-ga`, { method: "PATCH", body: { sumberPembelian } }),
  rejectAtkGa: (id: number, reason: string | null) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/reject-ga`, { method: "PATCH", body: { reason } }),
  approveAtkGaApproval: (id: number) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/approve-ga-approval`, { method: "PATCH" }),
  rejectAtkGaApproval: (id: number, reason: string | null) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/reject-ga-approval`, { method: "PATCH", body: { reason } }),
  approveAtkKpu: (id: number) => apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/approve-kpu`, { method: "PATCH" }),
  rejectAtkKpu: (id: number, reason: string | null) =>
    apiRequest<PermintaanAtk>(`/permintaan-atk/${id}/reject-kpu`, { method: "PATCH", body: { reason } }),
  getAtkLogs: (id: number) => apiRequest<PermintaanAtkLog[]>(`/permintaan-atk/${id}/logs`),
  getAtkChatMessages: (id: number) => apiRequest<ChatMessage[]>(`/permintaan-atk/${id}/chat`),
  sendAtkChatMessage: (id: number, message: string) =>
    apiRequest<ChatMessage>(`/permintaan-atk/${id}/chat`, { method: "POST", body: { message } }),

  nextSaranaNomor: (tanggal: string) =>
    apiRequest<{ nomorPerbaikan: string }>("/perbaikan-sarana/next-nomor", { params: { tanggal } }),
  listSarana: (params: ListSaranaParams) =>
    apiRequest<PerbaikanSaranaListResponse>("/perbaikan-sarana", { params: saranaListParams(params) }),
  getSarana: (id: number) => apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}`),
  getSaranaStats: (bulan: string) =>
    apiRequest<PerbaikanSaranaStatsResponse>("/perbaikan-sarana/stats", { params: { bulan } }),
  createSarana: (payload: PerbaikanSaranaCreatePayload) =>
    apiRequest<PerbaikanSarana>("/perbaikan-sarana", { method: "POST", body: payload }),
  updateSarana: (id: number, payload: PerbaikanSaranaCreatePayload) =>
    apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}`, { method: "PUT", body: payload }),
  deleteSarana: (id: number) => apiRequest(`/perbaikan-sarana/${id}`, { method: "DELETE" }),
  superAdminDeleteSarana: (id: number) => apiRequest(`/perbaikan-sarana/${id}/super-admin`, { method: "DELETE" }),
  submitSarana: (id: number) => apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/submit`, { method: "PATCH" }),
  approveSaranaL1: (id: number) => apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/approve-l1`, { method: "PATCH" }),
  rejectSaranaL1: (id: number, reason: string | null) =>
    apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/reject-l1`, { method: "PATCH", body: { reason } }),
  approveSaranaGa: (id: number) => apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/approve-ga`, { method: "PATCH" }),
  rejectSaranaGa: (id: number, reason: string | null) =>
    apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/reject-ga`, { method: "PATCH", body: { reason } }),
  approveSaranaGaApproval: (id: number) =>
    apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/approve-ga-approval`, { method: "PATCH" }),
  rejectSaranaGaApproval: (id: number, reason: string | null) =>
    apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/reject-ga-approval`, { method: "PATCH", body: { reason } }),
  getSaranaLogs: (id: number) => apiRequest<PerbaikanSaranaLog[]>(`/perbaikan-sarana/${id}/logs`),
  getSaranaChatMessages: (id: number) => apiRequest<ChatMessage[]>(`/perbaikan-sarana/${id}/chat`),
  sendSaranaChatMessage: (id: number, message: string) =>
    apiRequest<ChatMessage>(`/perbaikan-sarana/${id}/chat`, { method: "POST", body: { message } }),
  cekLokasiSarana: (id: number, catatan: string | null) =>
    apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/cek-lokasi`, { method: "PATCH", body: { catatan } }),
  uploadGambarSarana: async (id: number, file: File, catatan: string | null) => {
    const formData = new FormData();
    formData.append("file", file);
    if (catatan) formData.append("catatan", catatan);
    const response = await fetch(`${API_BASE}/perbaikan-sarana/${id}/gambar`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      let detail = "Gagal mengunggah gambar";
      try {
        const data = await response.json();
        detail = data.detail || detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, response.status);
    }
    return response.json() as Promise<PerbaikanSarana>;
  },
  eksekusiSarana: (id: number, catatan: string | null) =>
    apiRequest<PerbaikanSarana>(`/perbaikan-sarana/${id}/eksekusi`, { method: "PATCH", body: { catatan } }),
  saranaGambarUrl: (id: number) => `${API_BASE}/perbaikan-sarana/${id}/gambar`,

  nextArsipNomor: (tanggal: string) =>
    apiRequest<{ nomorArsip: string }>("/permintaan-arsip/next-nomor", { params: { tanggal } }),
  listArsip: (params: ListArsipParams) =>
    apiRequest<PermintaanArsipListResponse>("/permintaan-arsip", { params: arsipListParams(params) }),
  getArsip: (id: number) => apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}`),
  getArsipStats: (bulan: string) =>
    apiRequest<PermintaanArsipStatsResponse>("/permintaan-arsip/stats", { params: { bulan } }),
  createArsip: (payload: PermintaanArsipCreatePayload) =>
    apiRequest<PermintaanArsip>("/permintaan-arsip", { method: "POST", body: payload }),
  updateArsip: (id: number, payload: PermintaanArsipCreatePayload) =>
    apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}`, { method: "PUT", body: payload }),
  deleteArsip: (id: number) => apiRequest(`/permintaan-arsip/${id}`, { method: "DELETE" }),
  superAdminDeleteArsip: (id: number) => apiRequest(`/permintaan-arsip/${id}/super-admin`, { method: "DELETE" }),
  submitArsip: (id: number) => apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}/submit`, { method: "PATCH" }),
  approveArsipL1: (id: number) => apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}/approve-l1`, { method: "PATCH" }),
  rejectArsipL1: (id: number, reason: string | null) =>
    apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}/reject-l1`, { method: "PATCH", body: { reason } }),
  approveArsipGa: (id: number) => apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}/approve-ga`, { method: "PATCH" }),
  rejectArsipGa: (id: number, reason: string | null) =>
    apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}/reject-ga`, { method: "PATCH", body: { reason } }),
  approveArsipGaApproval: (id: number) =>
    apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}/approve-ga-approval`, { method: "PATCH" }),
  rejectArsipGaApproval: (id: number, reason: string | null) =>
    apiRequest<PermintaanArsip>(`/permintaan-arsip/${id}/reject-ga-approval`, { method: "PATCH", body: { reason } }),
  getArsipLogs: (id: number) => apiRequest<PermintaanArsipLog[]>(`/permintaan-arsip/${id}/logs`),
  getArsipChatMessages: (id: number) => apiRequest<ChatMessage[]>(`/permintaan-arsip/${id}/chat`),
  sendArsipChatMessage: (id: number, message: string) =>
    apiRequest<ChatMessage>(`/permintaan-arsip/${id}/chat`, { method: "POST", body: { message } }),
};

export interface ListArsipParams {
  page?: number;
  limit?: number;
  status?: BookingStatus | "REJECTED" | "";
  divisi?: string;
  departemen?: string;
  direktorat?: string;
  bulan?: string;
  search?: string;
}

function arsipListParams(p: ListArsipParams) {
  return {
    page: p.page,
    limit: p.limit,
    status: p.status,
    divisi: p.divisi,
    departemen: p.departemen,
    direktorat: p.direktorat,
    bulan: p.bulan,
    search: p.search,
  };
}

export interface ListSaranaParams {
  page?: number;
  limit?: number;
  status?: BookingStatus | "REJECTED" | "";
  kategori?: KategoriKerusakan | "";
  urgensi?: Urgensi | "";
  divisi?: string;
  departemen?: string;
  direktorat?: string;
  bulan?: string;
  search?: string;
}

function saranaListParams(p: ListSaranaParams) {
  return {
    page: p.page,
    limit: p.limit,
    status: p.status,
    kategori: p.kategori,
    urgensi: p.urgensi,
    divisi: p.divisi,
    departemen: p.departemen,
    direktorat: p.direktorat,
    bulan: p.bulan,
    search: p.search,
  };
}

export interface ListAtkParams {
  page?: number;
  limit?: number;
  status?: Status | "REJECTED" | "";
  divisi?: string;
  departemen?: string;
  direktorat?: string;
  bulan?: string;
  search?: string;
}

function atkListParams(p: ListAtkParams) {
  return {
    page: p.page,
    limit: p.limit,
    status: p.status,
    divisi: p.divisi,
    departemen: p.departemen,
    direktorat: p.direktorat,
    bulan: p.bulan,
    search: p.search,
  };
}

export interface ListBookingParams {
  page?: number;
  limit?: number;
  // "REJECTED" is a synthetic value (not a real BookingStatus) meaning "any of the 3
  // reject-stage statuses" - collapsed into one Status filter dropdown option.
  status?: BookingStatus | "REJECTED" | "";
  divisi?: string;
  departemen?: string;
  namaRuang?: string;
  tanggal?: string;
  direktorat?: string;
  bulan?: string;
  search?: string;
  sejakBulan?: string;
}

// <input type="time"> gives "HH:mm" with no seconds, but .NET's TimeOnly JSON converter only
// accepts the full "HH:mm:ss" form - pad it here so every caller doesn't have to remember to.
function normalizeTime(t: string | null): string | null {
  if (!t) return null;
  return t.length === 5 ? `${t}:00` : t;
}

function normalizeBookingPayload(payload: BookingRuangCreatePayload): BookingRuangCreatePayload {
  return { ...payload, jamMulai: normalizeTime(payload.jamMulai), jamSelesai: normalizeTime(payload.jamSelesai) };
}

function normalizeActionResult(res: BookingRuang | BookingRuangActionResult): BookingRuangActionResult {
  return "item" in res ? res : { item: res, detail: null };
}

function bookingListParams(p: ListBookingParams) {
  return {
    page: p.page,
    limit: p.limit,
    status: p.status,
    divisi: p.divisi,
    departemen: p.departemen,
    nama_ruang: p.namaRuang,
    tanggal: p.tanggal,
    direktorat: p.direktorat,
    bulan: p.bulan,
    search: p.search,
    sejakBulan: p.sejakBulan,
  };
}

export interface ListKendaraanBookingParams {
  page?: number;
  limit?: number;
  status?: BookingStatus | "REJECTED" | "";
  divisi?: string;
  departemen?: string;
  namaKendaraan?: string;
  tanggal?: string;
  direktorat?: string;
  bulan?: string;
  search?: string;
  sejakBulan?: string;
}

function normalizeKendaraanPayload(payload: BookingKendaraanCreatePayload): BookingKendaraanCreatePayload {
  return { ...payload, jamMulai: normalizeTime(payload.jamMulai), jamSelesai: normalizeTime(payload.jamSelesai) };
}

function kendaraanListParams(p: ListKendaraanBookingParams) {
  return {
    page: p.page,
    limit: p.limit,
    status: p.status,
    divisi: p.divisi,
    departemen: p.departemen,
    nama_kendaraan: p.namaKendaraan,
    tanggal: p.tanggal,
    direktorat: p.direktorat,
    bulan: p.bulan,
    search: p.search,
    sejakBulan: p.sejakBulan,
  };
}
