"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatDateTime, invoiceBulanLabel } from "@/lib/format";
import type { Invoice, Me } from "@/lib/types";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: Invoice | null;
  me: Me;
  onClose: () => void;
  onRequestAction: (id: number, type: "approve" | "reject") => void;
  onSubmitted: () => void;
}

export default function InvoiceDetailModal({ open, item, me, onClose, onRequestAction, onSubmitted }: Props) {
  const [error, setError] = useState("");
  const { showToast } = useToast();

  if (!open || !item) return null;

  const canReview = me.role === "ADMIN_GA" && item.status === "PENDING";
  const canSubmitDraft = me.role === "KPU" && item.status === "DRAFT" && item.uploadedBy === me.id;

  async function handleSubmitDraft() {
    if (!item) return;
    try {
      await api.submitInvoice(item.id);
      showToast("Invoice berhasil dikirim untuk approval");
      onSubmitted();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Detail Invoice</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="detail-grid">
          <div className="detail-row">
            <span className="detail-label">Bulan Invoice</span>
            <span className="detail-value">{invoiceBulanLabel(item.bulan)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span className="detail-value">{INVOICE_STATUS_LABEL[item.status] || item.status}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Diunggah</span>
            <span className="detail-value">{formatDateTime(item.uploadedAt)}</span>
          </div>
          {item.reviewedAt && (
            <div className="detail-row">
              <span className="detail-label">Ditinjau</span>
              <span className="detail-value">{formatDateTime(item.reviewedAt)}</span>
            </div>
          )}
          {item.catatan && (
            <div className="detail-row" style={{ gridColumn: "1 / -1" }}>
              <span className="detail-label">Catatan</span>
              <span className="detail-value">{item.catatan}</span>
            </div>
          )}
        </div>
        <div className="error-text">{error}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Tutup</button>
          {canReview && (
            <>
              <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => onRequestAction(item.id, "reject")}>Reject</button>
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={() => onRequestAction(item.id, "approve")}>Approve</button>
            </>
          )}
          {canSubmitDraft && (
            <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft}>Approved</button>
          )}
        </div>
      </div>
    </div>
  );
}
