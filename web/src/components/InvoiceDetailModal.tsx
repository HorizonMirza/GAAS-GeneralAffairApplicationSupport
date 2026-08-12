"use client";

import { INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL } from "@/lib/constants";
import { formatDateTime, invoiceBulanLabel } from "@/lib/format";
import type { Invoice, Me } from "@/lib/types";

interface Props {
  open: boolean;
  item: Invoice | null;
  me: Me;
  onClose: () => void;
  onRequestAction: (id: number, type: "approve" | "reject") => void;
}

export default function InvoiceDetailModal({ open, item, me, onClose, onRequestAction }: Props) {
  if (!open || !item) return null;

  const canReview = me.role === "ADMIN_GA" && item.status === "PENDING";

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
            <span className="detail-label">Nama File</span>
            <span className="detail-value">{item.originalFilename}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span className="detail-value">
              <span className={`badge ${INVOICE_STATUS_CLASS[item.status] || ""}`}>{INVOICE_STATUS_LABEL[item.status] || item.status}</span>
            </span>
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
            <div className="detail-row">
              <span className="detail-label">Catatan</span>
              <span className="detail-value">{item.catatan}</span>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Tutup</button>
          {canReview && (
            <>
              <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => onRequestAction(item.id, "reject")}>Reject</button>
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={() => onRequestAction(item.id, "approve")}>Approve</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
