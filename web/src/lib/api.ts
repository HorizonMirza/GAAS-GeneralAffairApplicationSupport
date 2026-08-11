import type {
  ApproveKpuPayload,
  Invoice,
  Me,
  OrgStructure,
  PengirimanCreatePayload,
  PengirimanListResponse,
  PengirimanLog,
  RejectTarget,
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

  listInvoice: () => apiRequest<Invoice[]>("/invoice"),
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
  approveInvoice: (id: number, catatan: string | null) =>
    apiRequest(`/invoice/${id}/approve`, { method: "PATCH", body: { catatan } }),
  rejectInvoice: (id: number, catatan: string | null) =>
    apiRequest(`/invoice/${id}/reject`, { method: "PATCH", body: { catatan } }),
  deleteInvoice: (id: number) => apiRequest(`/invoice/${id}`, { method: "DELETE" }),
  invoiceFileUrl: (id: number) => `${API_BASE}/invoice/${id}/file`,
  invoiceDownloadUrl: (id: number) => `${API_BASE}/invoice/${id}/file?download=true`,
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
};
