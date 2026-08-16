"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  INVOICE_STATUS_CLASS,
  INVOICE_STATUS_LABEL,
  isEditableByOrigin,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, invoiceBulanLabel, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Invoice, Pengiriman, Status } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import PengirimanFormModal from "@/components/PengirimanFormModal";
import PengirimanDetailModal from "@/components/PengirimanDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import StatusHistoryModal from "@/components/StatusHistoryModal";
import ChatModal from "@/components/ChatModal";
import InvoiceActionModal from "@/components/InvoiceActionModal";
import InvoiceUploadModal from "@/components/InvoiceUploadModal";
import InvoiceUpdateModal from "@/components/InvoiceUpdateModal";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import InvoiceHistoryModal from "@/components/InvoiceHistoryModal";
import InvoiceRowMenuDropdown from "@/components/InvoiceRowMenuDropdown";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

interface FilterState {
  page: number;
  limit: number;
  bulan: string;
  search: string;
  status: Status | "";
  divisi: string;
  departemen: string;
  direktorat: string;
}

const EMPTY_FILTERS: FilterState = { page: 1, limit: 10, bulan: "", search: "", status: "", divisi: "", departemen: "", direktorat: "" };

export default function TransaksiPage() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<Pengiriman[]>([]);
  const [total, setTotal] = useState(0);
  const [totalBulanIni, setTotalBulanIni] = useState<number | null>(null);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ item: Pengiriman; mode: "view" | "edit" } | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<Pengiriman | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceFilterBulan, setInvoiceFilterBulan] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(10);
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false);
  const [invoiceAction, setInvoiceAction] = useState<{ id: number; type: "approve" | "reject" } | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [invoiceUpdateTarget, setInvoiceUpdateTarget] = useState<Invoice | null>(null);
  const [invoiceHistoryId, setInvoiceHistoryId] = useState<number | null>(null);

  const rowMenu = useRowMenu(items);
  const invoiceRowMenu = useRowMenu(invoices ?? []);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  const loadTable = useCallback(async () => {
    setTableBusy(true);
    setTableError("");
    try {
      const result = await api.listPengiriman({
        page: filters.page,
        limit: filters.limit,
        bulan: filters.bulan,
        nomorTransmittal: filters.search,
        status: filters.status,
        divisi: filters.divisi,
        departemen: filters.departemen,
        direktorat: filters.direktorat,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalBulanIni(result.totalBulanIni);
    } catch (err) {
      setTableError((err as Error).message);
    } finally {
      setTableBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI"].includes(me.role)
    : false;
  const canSeeInvoice = me ? ["ADMIN_GA", "APPROVAL_GA", "KPU"].includes(me.role) : false;

  const loadInvoices = useCallback(async () => {
    try {
      const result = await api.listInvoice();
      setInvoices(result);
    } catch (err) {
      setInvoiceError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (canSeeInvoice) loadInvoices();
  }, [canSeeInvoice, loadInvoices]);

  if (!me || me.role === "SUPER_ADMIN") return null;

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      updateFilter({ search: value.trim() });
    }, 350);
  }

  function resetFilters() {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function currentExportParams() {
    return {
      bulan: filters.bulan,
      status: filters.status,
      divisi: filters.divisi,
      departemen: filters.departemen,
      direktorat: filters.direktorat,
      nomor_transmittal: filters.search,
    };
  }

  function handleDelete(item: Pengiriman) {
    confirm("Hapus data pengiriman ini secara permanen?", async () => {
      try {
        await api.deletePengiriman(item.id);
        showToast("Data berhasil dihapus");
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  function handleDeleteInvoice(inv: Invoice) {
    confirm("Yakin ingin menghapus invoice ini?", async () => {
      try {
        await api.deleteInvoice(inv.id);
        showToast("Invoice berhasil dihapus");
        loadInvoices();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.max(1, filters.page - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const filteredInvoices = (invoices ?? []).filter(
    (inv) => !invoiceFilterBulan || inv.bulan === invoiceFilterBulan
  );
  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / invoiceLimit));
  const invoicePageClamped = Math.min(invoicePage, invoiceTotalPages);
  const invoicePageStart = Math.max(1, invoicePageClamped - 2);
  const invoicePageEnd = Math.min(invoiceTotalPages, invoicePageStart + 4);
  const invoicePageButtons: number[] = [];
  for (let p = invoicePageStart; p <= invoicePageEnd; p++) invoicePageButtons.push(p);
  const pagedInvoices = filteredInvoices.slice((invoicePageClamped - 1) * invoiceLimit, invoicePageClamped * invoiceLimit);

  const showOrgFilters = [
    "ADMIN_DEPARTEMEN",
    "APPROVAL_DEPARTEMEN",
    "ADMIN_DIVISI",
    "APPROVAL_DIVISI",
    "ADMIN_GA",
    "APPROVAL_GA",
    "KPU",
  ].includes(me.role);

  const selectedDirektoratNode = orgStructure?.direktoratTree.find((d) => d.nama === filters.direktorat) || null;
  const divisiOptions = selectedDirektoratNode
    ? selectedDirektoratNode.divisi.map((v) => v.nama)
    : orgStructure?.divisi || [];
  const selectedDivisiNode = filters.divisi
    ? (selectedDirektoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find(
        (v) => v.nama === filters.divisi
      )
    : null;
  const departemenOptions = selectedDivisiNode
    ? selectedDivisiNode.departemen
    : selectedDirektoratNode
      ? selectedDirektoratNode.divisi.flatMap((v) => v.departemen)
      : orgStructure?.departemen || [];

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="filter-search">Cari Transaksi</label>
            <input type="text" id="filter-search" placeholder="Cari nomor transmittal..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="filter-bulan">Filter Bulan</label>
            <input type="month" id="filter-bulan" value={filters.bulan} onChange={(e) => updateFilter({ bulan: e.target.value })} />
          </div>

          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="field-label-spacer">Filter</label>
            <button type="button" className="btn btn-secondary" id="filter-toggle" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field">
                  <label htmlFor="filter-status">Status</label>
                  <select id="filter-status" value={filters.status} onChange={(e) => updateFilter({ status: e.target.value as Status | "" })}>
                    <option value="">Semua Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">On-Approval: Approval Departemen/Divisi</option>
                    <option value="REJECTED_L1">Rejected: Approval Departemen/Divisi</option>
                    <option value="APPROVED_L1">On-Approval: Admin GA</option>
                    <option value="REJECTED_GA">Rejected: Admin GA</option>
                    <option value="APPROVED_GA">On-Approval: Approval GA</option>
                    <option value="REJECTED_GA_APPROVAL">Rejected: Approval GA</option>
                    <option value="APPROVED_GA_APPROVAL">On-Approval: KPU</option>
                    <option value="REJECTED_KPU">Rejected: KPU</option>
                    <option value="COMPLETED">Approved</option>
                  </select>
                </div>
                {showOrgFilters && (
                  <>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-direktorat">Direktorat</label>
                      <select
                        id="filter-direktorat"
                        value={filters.direktorat}
                        onChange={(e) => updateFilter({ direktorat: e.target.value, divisi: "", departemen: "" })}
                      >
                        <option value="">Semua Direktorat</option>
                        {(orgStructure?.direktorat || []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-divisi">Divisi</label>
                      <select
                        id="filter-divisi"
                        value={filters.divisi}
                        onChange={(e) => updateFilter({ divisi: e.target.value, departemen: "" })}
                      >
                        <option value="">Semua Divisi</option>
                        {divisiOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-departemen">Departemen</label>
                      <select id="filter-departemen" value={filters.departemen} onChange={(e) => updateFilter({ departemen: e.target.value })}>
                        <option value="">Semua Departemen</option>
                        {departemenOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Hapus Filter</button>

          <div className="toolbar-actions">
            <button className="btn btn-pdf-glossy btn-sm" style={{ width: "auto" }} onClick={() => window.open(api.pdfUrl(currentExportParams()), "_blank")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn-export-glossy btn-sm" style={{ width: "auto" }} onClick={() => window.open(api.exportUrl(currentExportParams()), "_blank")}>
              ⬇ Download Excel
            </button>
            {isOrigin && (
              <button className="btn btn-primary btn-sm" style={{ width: "auto" }} onClick={() => setFormOpen(true)}>+ Input Data Barang</button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Transmittal</th><th>No Resi</th><th>Tanggal</th><th>Tujuan</th><th>Item</th><th>Divisi</th><th>Departemen</th>
                <th>Pengirim</th><th>Telp. Pengirim</th><th>Penerima</th><th>Telp. Penerima</th>
                <th>Kode Program</th><th>Asuransi</th><th>Packing</th><th>Catatan</th>
                <th>Berat (Kg)</th><th>Ongkos Kirim (Harga)</th><th>Total</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={20} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={20} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={20} className="table-empty">Tidak ada data untuk filter ini.</td></tr>
              ) : (
                items.map((item, index) => {
                  const rowNumber = (filters.page - 1) * filters.limit + index + 1;
                  return (
                    <tr key={item.id}>
                      <td>{rowNumber}</td>
                      <td>{item.nomorTransmittal}</td>
                      <td>{item.noResi || "-"}</td>
                      <td>{formatDate(item.tanggal)}</td>
                      <td title={item.tujuanPenerimaan}>{truncateText(item.tujuanPenerimaan, 15)}</td>
                      <td>{item.jumlahItem}</td>
                      <td>{item.divisi}</td>
                      <td>{item.departemen || "-"}</td>
                      <td>{item.namaPengirim}</td>
                      <td>{item.noTeleponPengirim}</td>
                      <td>{item.namaPenerima}</td>
                      <td>{item.noTeleponPenerima}</td>
                      <td>{item.kodeProgram}</td>
                      <td>{item.asuransiStatus}</td>
                      <td>{item.requestPacking || "-"}</td>
                      <td title={item.catatan || ""}>{truncateText(item.catatan, 20)}</td>
                      <td>{item.beratBarangKg ?? "-"}</td>
                      <td>{item.subTotal ? formatCurrency(item.subTotal) : "-"}</td>
                      <td>{item.total ? formatCurrency(item.total) : "-"}</td>
                      <td>
                        <div className="status-cell">
                          <StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} />
                          <button
                            type="button"
                            className={`card-icon-btn${item.hasUnreadChat ? " card-chat-btn-unread" : ""}${item.hasUnreadMention ? " card-chat-btn-mentioned" : ""}`}
                            aria-label="Chat"
                            onClick={() => setChatItem(item)}
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                          </button>
                          <button type="button" className="card-icon-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id, 180)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA", "KPU"].includes(me.role) && totalBulanIni != null && (
          <div style={{ marginTop: 16, textAlign: "right", fontWeight: 700, fontSize: "1.05rem" }}>
            Total Akumulasi Biaya: <span>{formatCurrency(totalBulanIni)}</span>
          </div>
        )}

        <div className="pagination">
          <div className="pagination-left">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="filter-limit">Tampilkan</label>
              <select id="filter-limit" value={filters.limit} onChange={(e) => updateFilter({ limit: Number(e.target.value) })}>
                <option value={5}>5 transaksi</option>
                <option value={10}>10 transaksi</option>
                <option value={20}>20 transaksi</option>
                <option value={50}>50 transaksi</option>
              </select>
            </div>
          </div>
          <div className="pagination-right">
            <span className="text-secondary">Total {total} transaksi · Halaman {filters.page} dari {totalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={filters.page <= 1} onClick={() => goToPage(filters.page - 1)}>‹</button>
              {pageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === filters.page ? "active" : ""}`} onClick={() => goToPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={filters.page >= totalPages} onClick={() => goToPage(filters.page + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

      {canSeeInvoice && (
        <div className="card">
          <div className="card-header">
            <h3>History Invoice Pembiayaan</h3>
          </div>

          <div className="invoice-toolbar-slim">
            <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
              <label htmlFor="invoice-filter-bulan">Filter Bulan</label>
              <input
                type="month"
                id="invoice-filter-bulan"
                value={invoiceFilterBulan}
                onChange={(e) => { setInvoiceFilterBulan(e.target.value); setInvoicePage(1); }}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="field-label-spacer">Semua Invoice</span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "auto" }}
                onClick={() => { setInvoiceFilterBulan(""); setInvoicePage(1); }}
              >
                Semua Invoice
              </button>
            </div>
            {me.role === "KPU" && (
              <button type="button" className="btn btn-primary invoice-input-btn" style={{ width: "auto" }} onClick={() => setInvoiceUploadOpen(true)}>
                + Input Invoice
              </button>
            )}
          </div>

          <div className="invoice-list">
            {invoiceError ? (
              <p className="text-secondary">{invoiceError}</p>
            ) : invoices == null ? (
              <p className="text-secondary">Memuat data invoice...</p>
            ) : invoices.length === 0 ? (
              <p className="text-secondary">Belum ada invoice.</p>
            ) : filteredInvoices.length === 0 ? (
              <p className="text-secondary">Tidak ada invoice untuk filter ini.</p>
            ) : (
              pagedInvoices.map((inv) => (
                <div className="invoice-row" key={inv.id}>
                  <div className="invoice-row-main">
                    <div className="invoice-file-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div className="invoice-row-info">
                      <div className="invoice-row-title">Invoice {invoiceBulanLabel(inv.bulan)}</div>
                      <div className="invoice-row-meta">{inv.originalFilename} · Diunggah {formatDateTime(inv.uploadedAt)}</div>
                      {inv.reviewedAt && <div className="invoice-row-meta">Ditinjau: {formatDateTime(inv.reviewedAt)}</div>}
                      {inv.catatan && <div className="invoice-row-note"><strong>Catatan:</strong> {inv.catatan}</div>}
                    </div>
                  </div>
                  <div className="invoice-row-actions">
                    <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                    <button type="button" className="row-menu-btn" aria-label="Aksi" onClick={(e) => invoiceRowMenu.toggle(e, inv.id)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {filteredInvoices.length > 0 && (
            <div className="pagination">
              <div className="pagination-left">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="invoice-limit">Tampilkan</label>
                  <select id="invoice-limit" value={invoiceLimit} onChange={(e) => { setInvoiceLimit(Number(e.target.value)); setInvoicePage(1); }}>
                    <option value={5}>5 invoice</option>
                    <option value={10}>10 invoice</option>
                    <option value={20}>20 invoice</option>
                    <option value={50}>50 invoice</option>
                  </select>
                </div>
              </div>
              <div className="pagination-right">
                <span className="text-secondary">Total {filteredInvoices.length} invoice · Halaman {invoicePageClamped} dari {invoiceTotalPages}</span>
                <div className="pages">
                  <button className="page-btn" disabled={invoicePageClamped <= 1} onClick={() => setInvoicePage(invoicePageClamped - 1)}>‹</button>
                  {invoicePageButtons.map((p) => (
                    <button key={p} className={`page-btn ${p === invoicePageClamped ? "active" : ""}`} onClick={() => setInvoicePage(p)}>{p}</button>
                  ))}
                  <button className="page-btn" disabled={invoicePageClamped >= invoiceTotalPages} onClick={() => setInvoicePage(invoicePageClamped + 1)}>›</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <InvoiceRowMenuDropdown
        position={invoiceRowMenu.position}
        showUpdates={!!invoiceRowMenu.menuItem && me.role === "KPU" && (invoiceRowMenu.menuItem.status === "REJECTED" || invoiceRowMenu.menuItem.status === "DRAFT")}
        showDelete={!!invoiceRowMenu.menuItem && me.role === "KPU" && (invoiceRowMenu.menuItem.status === "DRAFT" || invoiceRowMenu.menuItem.status === "REJECTED")}
        pdfViewUrl={invoiceRowMenu.menuItem ? api.invoiceFileUrl(invoiceRowMenu.menuItem.id) : "#"}
        pdfDownloadUrl={invoiceRowMenu.menuItem ? api.invoiceDownloadUrl(invoiceRowMenu.menuItem.id) : "#"}
        onDetail={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) setInvoiceDetail(item);
        }}
        onUpdates={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) setInvoiceUpdateTarget(item);
        }}
        onRiwayat={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) setInvoiceHistoryId(item.id);
        }}
        onDelete={() => {
          const item = invoiceRowMenu.menuItem;
          invoiceRowMenu.close();
          if (item) handleDeleteInvoice(item);
        }}
        onLinkClick={() => invoiceRowMenu.close()}
      />

      <RowMenuDropdown
        position={rowMenu.position}
        canEditDelete={!!rowMenu.menuItem && isOrigin && isEditableByOrigin(rowMenu.menuItem, me)}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "edit" });
        }}
        onStatus={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setStatusItemId(item.id);
        }}
        onDelete={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) handleDelete(item);
        }}
      />

      <ChatModal
        open={!!chatItem}
        itemId={chatItem?.id ?? null}
        itemLabel={chatItem ? `${chatItem.tujuanPenerimaan} - ${chatItem.nomorTransmittal}` : ""}
        departemen={chatItem?.departemen ?? null}
        me={me}
        onClose={() => setChatItem(null)}
        onRead={loadTable}
      />

      <PengirimanFormModal open={formOpen} me={me} onClose={() => setFormOpen(false)} onCreated={loadTable} />

      <PengirimanDetailModal
        open={!!detail}
        mode={detail?.mode || "view"}
        item={detail?.item || null}
        me={me}
        onClose={() => setDetail(null)}
        onSaved={loadTable}
        onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
      />

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          loadTable();
        }}
      />

      <StatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      <InvoiceUploadModal
        open={invoiceUploadOpen}
        onClose={() => setInvoiceUploadOpen(false)}
        onDone={() => {
          setInvoiceUploadOpen(false);
          loadInvoices();
        }}
      />

      <InvoiceDetailModal
        open={!!invoiceDetail}
        item={invoiceDetail}
        me={me}
        onClose={() => setInvoiceDetail(null)}
        onRequestAction={(id, type) => setInvoiceAction({ id, type })}
        onSubmitted={() => {
          setInvoiceDetail(null);
          loadInvoices();
        }}
      />

      <InvoiceActionModal
        open={!!invoiceAction}
        invoiceId={invoiceAction?.id ?? null}
        type={invoiceAction?.type ?? null}
        onClose={() => setInvoiceAction(null)}
        onDone={() => {
          setInvoiceAction(null);
          setInvoiceDetail(null);
          loadInvoices();
        }}
      />

      <InvoiceUpdateModal
        open={!!invoiceUpdateTarget}
        item={invoiceUpdateTarget}
        onClose={() => setInvoiceUpdateTarget(null)}
        onDone={() => {
          setInvoiceUpdateTarget(null);
          loadInvoices();
        }}
      />

      <InvoiceHistoryModal
        open={invoiceHistoryId != null}
        invoiceId={invoiceHistoryId}
        onClose={() => setInvoiceHistoryId(null)}
      />
    </>
  );
}
