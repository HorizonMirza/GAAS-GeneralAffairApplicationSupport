"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatDateTime, invoiceBulanLabel } from "@/lib/format";
import { useRowMenu } from "@/lib/useRowMenu";
import type { Invoice } from "@/lib/types";
import InvoiceActionModal from "@/components/InvoiceActionModal";
import InvoiceUploadModal from "@/components/InvoiceUploadModal";
import InvoiceUpdateModal from "@/components/InvoiceUpdateModal";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import InvoiceHistoryModal from "@/components/InvoiceHistoryModal";
import InvoiceRowMenuDropdown from "@/components/InvoiceRowMenuDropdown";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";

// Invoice pembiayaan history is only relevant to the 3 roles that ever touch it: Admin GA
// uploads, Approval GA reviews, KPU is the final approver.
const INVOICE_HISTORY_ROLES = ["ADMIN_GA", "APPROVAL_GA", "KPU"];

export default function InvoiceHistoryPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceSearchInput, setInvoiceSearchInput] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceFilterBulan, setInvoiceFilterBulan] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceLimit, setInvoiceLimit] = useState(10);
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false);
  const [invoiceAction, setInvoiceAction] = useState<{ id: number; type: "approve" | "reject" } | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [invoiceUpdateTarget, setInvoiceUpdateTarget] = useState<Invoice | null>(null);
  const [invoiceHistoryId, setInvoiceHistoryId] = useState<number | null>(null);

  const invoiceRowMenu = useRowMenu(invoices ?? []);
  const invoiceBulanInputRef = useRef<HTMLInputElement>(null);
  const invoiceReqIdRef = useRef(0);
  const invoiceSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInvoiceSearchChange(value: string) {
    setInvoiceSearchInput(value);
    if (invoiceSearchDebounce.current) clearTimeout(invoiceSearchDebounce.current);
    invoiceSearchDebounce.current = setTimeout(() => {
      setInvoiceSearch(value.trim());
      setInvoicePage(1);
    }, 350);
  }

  // Some browsers restore a previously-typed value into this input on page reload without
  // firing onChange, leaving it visually filled while React's state (the actual source of
  // truth for the API call) stays empty. Force the DOM back in sync with state on mount.
  useEffect(() => {
    if (invoiceBulanInputRef.current) invoiceBulanInputRef.current.value = invoiceFilterBulan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && me && !INVOICE_HISTORY_ROLES.includes(me.role)) router.replace("/ekspedisi/overview");
  }, [loading, me, router]);

  const loadInvoices = useCallback(async () => {
    const reqId = ++invoiceReqIdRef.current;
    try {
      const result = await api.listInvoice({ page: invoicePage, limit: invoiceLimit, bulan: invoiceFilterBulan, search: invoiceSearch });
      // A slower earlier request (e.g. the initial unfiltered load) can resolve after a newer
      // one triggered by changing the filter - ignore it so it doesn't clobber fresher results.
      if (reqId !== invoiceReqIdRef.current) return;
      const invoiceItems = result?.items ?? [];
      const invoiceTotalCount = result?.total ?? 0;
      if (invoiceItems.length === 0 && invoiceTotalCount > 0 && invoicePage > 1) {
        setInvoicePage((p) => p - 1);
        return;
      }
      setInvoices(invoiceItems);
      setInvoiceTotal(invoiceTotalCount);
    } catch (err) {
      if (reqId !== invoiceReqIdRef.current) return;
      setInvoiceError((err as Error).message);
    }
  }, [invoicePage, invoiceLimit, invoiceFilterBulan, invoiceSearch]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  if (!me || !INVOICE_HISTORY_ROLES.includes(me.role)) return null;

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

  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotal / invoiceLimit));
  const invoicePageStart = Math.max(1, invoicePage - 2);
  const invoicePageEnd = Math.min(invoiceTotalPages, invoicePageStart + 4);
  const invoicePageButtons: number[] = [];
  for (let p = invoicePageStart; p <= invoicePageEnd; p++) invoicePageButtons.push(p);

  return (
    <>
      <div className="card">
        <div className="invoice-toolbar-slim invoices-page-toolbar">
          <div className="field invoice-search-field" style={{ marginBottom: 0 }}>
            <label htmlFor="invoice-filter-search">Cari Invoice</label>
            <input
              type="text"
              id="invoice-filter-search"
              placeholder="Nama File"
              value={invoiceSearchInput}
              onChange={(e) => handleInvoiceSearchChange(e.target.value)}
            />
          </div>
          <div className="field invoice-filter-field" style={{ marginBottom: 0 }}>
            <label htmlFor="invoice-filter-bulan">Filter Bulan</label>
            <input
              type="month"
              id="invoice-filter-bulan"
              autoComplete="off"
              ref={invoiceBulanInputRef}
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
              onClick={() => { setInvoiceSearchInput(""); setInvoiceSearch(""); setInvoiceFilterBulan(""); setInvoicePage(1); }}
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
            <p className="text-secondary">{invoiceFilterBulan ? "Tidak ada invoice untuk filter ini." : "Belum ada invoice."}</p>
          ) : (
            invoices.map((inv) => (
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
                  {inv.status === "REJECTED" ? (
                    <div className="badge-stack">
                      <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                      <span className="badge badge-waiting">Waiting: KPU</span>
                    </div>
                  ) : (
                    <span className={`badge ${INVOICE_STATUS_CLASS[inv.status] || ""}`}>{INVOICE_STATUS_LABEL[inv.status] || inv.status}</span>
                  )}
                  <button type="button" className="row-menu-btn" aria-label="Aksi" onClick={(e) => invoiceRowMenu.toggle(e, inv.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

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
            <span className="text-secondary">Total {invoiceTotal} invoice · Halaman {invoicePage} dari {invoiceTotalPages}</span>
            <div className="pages">
              <button className="page-btn" disabled={invoicePage <= 1} onClick={() => setInvoicePage(invoicePage - 1)}>‹</button>
              {invoicePageButtons.map((p) => (
                <button key={p} className={`page-btn ${p === invoicePage ? "active" : ""}`} onClick={() => setInvoicePage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={invoicePage >= invoiceTotalPages} onClick={() => setInvoicePage(invoicePage + 1)}>›</button>
            </div>
          </div>
        </div>
      </div>

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
