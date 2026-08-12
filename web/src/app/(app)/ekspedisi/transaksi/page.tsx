"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  INVOICE_STATUS_CLASS,
  INVOICE_STATUS_LABEL,
  isEditableByOrigin,
} from "@/lib/constants";
import { formatCurrency, formatDate, invoiceBulanLabel, truncateText } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Invoice, Pengiriman, Status } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import PengirimanFormModal from "@/components/PengirimanFormModal";
import PengirimanDetailModal from "@/components/PengirimanDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import StatusHistoryModal from "@/components/StatusHistoryModal";
import InvoiceActionModal from "@/components/InvoiceActionModal";
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
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceFilterBulan, setInvoiceFilterBulan] = useState("");
  const [invoiceBulan, setInvoiceBulan] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUploadError, setInvoiceUploadError] = useState("");
  const [invoiceAction, setInvoiceAction] = useState<{ id: number; type: "approve" | "reject" } | null>(null);

  const rowMenu = useRowMenu(items);
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

  const invoiceMonths = useMemo(() => {
    if (!invoices) return [];
    return Array.from(new Set(invoices.map((inv) => inv.bulan))).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [invoices]);

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
    confirm("Yakin ingin menghapus data pengiriman ini?", async () => {
      try {
        await api.deletePengiriman(item.id);
        showToast("Data berhasil dihapus");
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  async function handleInvoiceUpload(e: React.FormEvent) {
    e.preventDefault();
    setInvoiceUploadError("");
    if (!invoiceBulan || !invoiceFile) {
      setInvoiceUploadError("Lengkapi bulan dan file invoice.");
      return;
    }
    try {
      await api.uploadInvoice(invoiceBulan, invoiceFile);
      showToast("Invoice berhasil dikirim ke Admin General Affair");
      setInvoiceBulan("");
      setInvoiceFile(null);
      loadInvoices();
    } catch (err) {
      setInvoiceUploadError((err as Error).message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.max(1, filters.page - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const showOrgFilters = [
    "ADMIN_DEPARTEMEN",
    "APPROVAL_DEPARTEMEN",
    "ADMIN_DIVISI",
    "APPROVAL_DIVISI",
    "ADMIN_GA",
    "APPROVAL_GA",
    "KPU",
  ].includes(me.role);

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
                      <select id="filter-direktorat" value={filters.direktorat} onChange={(e) => updateFilter({ direktorat: e.target.value })}>
                        <option value="">Semua Direktorat</option>
                        {(orgStructure?.direktorat || []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-divisi">Divisi</label>
                      <select id="filter-divisi" value={filters.divisi} onChange={(e) => updateFilter({ divisi: e.target.value })}>
                        <option value="">Semua Divisi</option>
                        {(orgStructure?.divisi || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label htmlFor="filter-departemen">Departemen</label>
                      <select id="filter-departemen" value={filters.departemen} onChange={(e) => updateFilter({ departemen: e.target.value })}>
                        <option value="">Semua Departemen</option>
                        {(orgStructure?.departemen || []).map((d) => (
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
                          <button type="button" className="row-menu-btn" aria-label="Aksi" onClick={(e) => rowMenu.toggle(e, item.id)}>
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

          <div className="invoice-toolbar">
            {me.role === "KPU" && (
              <form className="invoice-upload-row" onSubmit={handleInvoiceUpload}>
                <div className="field">
                  <label htmlFor="invoice-bulan">Bulan Invoice</label>
                  <input type="month" id="invoice-bulan" required value={invoiceBulan} onChange={(e) => setInvoiceBulan(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="invoice-file">File Invoice (PDF)</label>
                  <input type="file" id="invoice-file" accept="application/pdf" required onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Kirim Invoice</button>
                </div>
              </form>
            )}
            <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
              <label htmlFor="invoice-filter-bulan">Filter Bulan</label>
              <select
                id="invoice-filter-bulan"
                value={invoiceFilterBulan}
                onChange={(e) => setInvoiceFilterBulan(e.target.value)}
              >
                <option value="">Semua Bulan</option>
                {invoiceMonths.map((m) => (
                  <option key={m} value={m}>{invoiceBulanLabel(m)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="error-text">{invoiceUploadError}</div>

          <div className="invoice-list">
            {invoiceError ? (
              <p className="text-secondary">{invoiceError}</p>
            ) : invoices == null ? (
              <p className="text-secondary">Memuat data invoice...</p>
            ) : invoices.length === 0 ? (
              <p className="text-secondary">Belum ada invoice.</p>
            ) : invoices.filter((inv) => !invoiceFilterBulan || inv.bulan === invoiceFilterBulan).length === 0 ? (
              <p className="text-secondary">Tidak ada invoice untuk bulan ini.</p>
            ) : (
              invoices
                .filter((inv) => !invoiceFilterBulan || inv.bulan === invoiceFilterBulan)
                .map((inv) => {
                const canReview = me.role === "ADMIN_GA" && inv.status === "PENDING";
                return (
                  <div className="invoice-row" key={inv.id}>
                    <div className="invoice-row-main">
                      <div className="invoice-file-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                      </div>
                      <div className="invoice-row-info">
                        <div className="invoice-row-title">Invoice {invoiceBulanLabel(inv.bulan)}</div>
                        <div className="invoice-row-meta">{inv.originalFilename} · Diunggah {formatDate(inv.uploadedAt)}</div>
                        {inv.reviewedAt && <div className="invoice-row-meta">Ditinjau: {formatDate(inv.reviewedAt)}</div>}
                        {inv.catatan && <div className="invoice-row-note"><strong>Catatan:</strong> {inv.catatan}</div>}
                      </div>
                    </div>
                    <div className="invoice-row-actions">
                      <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                      <a className="btn btn-secondary btn-sm" style={{ width: "auto" }} href={api.invoiceFileUrl(inv.id)} target="_blank" rel="noopener noreferrer">Lihat PDF</a>
                      <a className="btn btn-secondary btn-sm" style={{ width: "auto" }} href={api.invoiceDownloadUrl(inv.id)}>Download PDF</a>
                      {canReview && (
                        <>
                          <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => setInvoiceAction({ id: inv.id, type: "reject" })}>Reject</button>
                          <button type="button" className="btn btn-approve btn-sm" style={{ width: "auto" }} onClick={() => setInvoiceAction({ id: inv.id, type: "approve" })}>Approve</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

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

      <InvoiceActionModal
        open={!!invoiceAction}
        invoiceId={invoiceAction?.id ?? null}
        type={invoiceAction?.type ?? null}
        onClose={() => setInvoiceAction(null)}
        onDone={() => {
          setInvoiceAction(null);
          loadInvoices();
        }}
      />
    </>
  );
}
