import type {
  ApproveKpuPayload,
  BookingRuang,
  BookingRuangActionResult,
  BookingRuangCreatePayload,
  BookingRuangListResponse,
  BookingRuangLog,
  BookingRuangReschedulePayload,
  BookingStatus,
  ChatMessage,
  Invoice,
  InvoiceListResponse,
  InvoiceLog,
  Me,
  OrgStructure,
  PengirimanCreatePayload,
  PengirimanListResponse,
  PengirimanLog,
  PengirimanStatsResponse,
  RejectTarget,
  RoomOption,
  Status,
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

export interface ListInvoiceParams {
  page?: number;
  limit?: number;
  bulan?: string;
  search?: string;
}

export interface ListPengirimanParams {
  page?: number;
  limit?: number;
  bulan?: string;
  nomorTransmittal?: string;
  status?: Status | "";
  divisi?: string;
  departemen?: string;
  direktorat?: string;
}

function listParams(p: ListPengirimanParams) {
  return {
    page: p.page,
    limit: p.limit,
    bulan: p.bulan,
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
  getPengirimanStats: (bulan: string) =>
    apiRequest<PengirimanStatsResponse>("/pengiriman/stats", { params: { bulan } }),
  createPengiriman: (payload: PengirimanCreatePayload) =>
    apiRequest("/pengiriman", { method: "POST", body: payload }),
  updatePengiriman: (id: number, payload: PengirimanCreatePayload) =>
    apiRequest(`/pengiriman/${id}`, { method: "PUT", body: payload }),
  deletePengiriman: (id: number) => apiRequest(`/pengiriman/${id}`, { method: "DELETE" }),
  deleteCompleted: (id: number) => apiRequest(`/pengiriman/${id}/super-admin`, { method: "DELETE" }),
  submitPengiriman: (id: number) => apiRequest(`/pengiriman/${id}/submit`, { method: "PATCH" }),
  nextTransmittal: (tanggal: string) =>
    apiRequest<{ nomorTransmittal: string }>("/pengiriman/next-transmittal", { params: { tanggal } }),
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
    apiRequest<InvoiceListResponse>("/invoice", { params: { page: params.page, limit: params.limit, bulan: params.bulan, search: params.search } }),
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

  listRooms: () => apiRequest<RoomOption[]>("/booking-ruang/rooms"),
  nextBookingNomor: (tanggal: string) =>
    apiRequest<{ nomorPemesanan: string }>("/booking-ruang/next-nomor", { params: { tanggal } }),
  getBookingSchedule: (tanggal: string) =>
    apiRequest<BookingRuang[]>("/booking-ruang/schedule", { params: { tanggal } }),
  getBookingScheduleRange: (tanggalMulai: string, tanggalSelesai: string, namaRuang?: string) =>
    apiRequest<BookingRuang[]>("/booking-ruang/schedule-range", {
      params: { tanggalMulai, tanggalSelesai, nama_ruang: namaRuang },
    }),
  listBooking: (params: ListBookingParams) =>
    apiRequest<BookingRuangListResponse>("/booking-ruang", { params: bookingListParams(params) }),
  // Create always returns a list of occurrences, even a single non-recurring booking (one-item
  // list) - a recurring series comes back as one BookingRuang per occurrence date.
  createBooking: (payload: BookingRuangCreatePayload) =>
    apiRequest<BookingRuang[]>("/booking-ruang", { method: "POST", body: normalizeBookingPayload(payload) }),
  updateBooking: (id: number, payload: BookingRuangCreatePayload) =>
    apiRequest<BookingRuang>(`/booking-ruang/${id}`, { method: "PUT", body: normalizeBookingPayload(payload) }),
  rescheduleBooking: (id: number, payload: BookingRuangReschedulePayload) =>
    apiRequest<BookingRuang>(`/booking-ruang/${id}/reschedule`, { method: "PATCH", body: payload }),
  deleteBooking: (id: number) => apiRequest(`/booking-ruang/${id}`, { method: "DELETE" }),
  superAdminDeleteBooking: (id: number) => apiRequest(`/booking-ruang/${id}/super-admin`, { method: "DELETE" }),
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
};

export interface ListBookingParams {
  page?: number;
  limit?: number;
  status?: BookingStatus | "";
  divisi?: string;
  departemen?: string;
  namaRuang?: string;
  tanggal?: string;
  bulan?: string;
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
    bulan: p.bulan,
  };
}
