"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatCurrency, formatDate, invoiceBulanLabel, truncateText } from "@/lib/format";
import type { Invoice, Pengiriman, Status } from "@/lib/types";
import { useClickOutside } from "@/lib/useClickOutside";
import StatusBadge from "@/components/StatusBadge";
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

export default function SuperAdminPage() {
  const { me, orgStructure, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<Pengiriman[]>([]);
  const [total, setTotal] = useState(0);
  const [tableBusy, setTableBusy] = useState(true);
  const [tableError, setTableError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceError, setInvoiceError] = useState("");

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);

  useEffect(() => {
    if (!loading && me && me.role !== "SUPER_ADMIN") router.replace("/home");
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
    } catch (err) {
      setTableError((err as Error).message);
    } finally {
      setTableBusy(false);
    }
  }, [filters]);

  const loadInvoices = useCallback(async () => {
    try {
      const result = await api.listInvoice();
      setInvoices(result);
    } catch (err) {
      setInvoiceError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    if (me?.role === "SUPER_ADMIN") loadInvoices();
  }, [me, loadInvoices]);

  if (!me || me.role !== "SUPER_ADMIN") return null;

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => updateFilter({ search: value.trim() }), 350);
  }

  function resetFilters() {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
  }

  function goToPage(page: number) {
    if (page < 1) return;
    setFilters((f) => ({ ...f, page }));
  }

  function handleDelete(item: Pengiriman) {
    confirm("Yakin ingin menghapus data ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.deleteCompleted(item.id);
        showToast("Data berhasil dihapus permanen");
        loadTable();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  function handleDeleteInvoice(inv: Invoice) {
    confirm("Yakin ingin menghapus invoice ini secara permanen? Tindakan ini tidak dapat dibatalkan.", async () => {
      try {
        await api.deleteInvoice(inv.id);
        showToast("Invoice berhasil dihapus permanen");
        loadInvoices();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Delete Permanent");
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.max(1, filters.page - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

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
            <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setFilterOpen((v) => !v)}>
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
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={{ width: "auto", alignSelf: "flex-end" }} onClick={resetFilters}>Hapus Filter</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th><th>No Transmittal</th><th>No Resi</th><th>Tanggal</th><th>Tujuan</th><th>Item</th><th>Divisi</th><th>Departemen</th>
                <th>Pengirim</th><th>Telp. Pengirim</th><th>Penerima</th><th>Telp. Penerima</th>
                <th>Kode Program</th><th>Asuransi</th><th>Packing</th><th>Catatan</th>
                <th>Berat (Kg)</th><th>Ongkos Kirim (Harga)</th><th>Total</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tableBusy ? (
                <tr><td colSpan={21} className="table-empty">Memuat data...</td></tr>
              ) : tableError ? (
                <tr><td colSpan={21} className="table-empty">{tableError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={21} className="table-empty">Tidak ada data untuk filter ini.</td></tr>
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
                      <td><StatusBadge status={item.status} rejectTarget={item.rejectTarget} departemen={item.departemen} createdByRole={item.createdByRole} /></td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => handleDelete(item)}>Delete</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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

      <div className="card">
        <div className="card-header">
          <h3>History Invoice Pembiayaan</h3>
        </div>
        <div className="invoice-list">
          {invoiceError ? (
            <p className="text-secondary">{invoiceError}</p>
          ) : invoices == null ? (
            <p className="text-secondary">Memuat data invoice...</p>
          ) : invoices.length === 0 ? (
            <p className="text-secondary">Belum ada invoice.</p>
          ) : (
            invoices.map((inv) => (
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
                  <button type="button" className="btn btn-danger btn-sm" style={{ width: "auto" }} onClick={() => handleDeleteInvoice(inv)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
