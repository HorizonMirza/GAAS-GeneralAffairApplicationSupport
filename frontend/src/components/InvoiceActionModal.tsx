"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  invoiceId: number | null;
  type: "approve" | "reject" | null;
  onClose: () => void;
  onDone: () => void;
}

export default function InvoiceActionModal({ open, invoiceId, type, onClose, onDone }: Props) {
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const { showToast } = useToast();

  if (!open || !type) return null;

  function reset() {
    setCatatan("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (invoiceId == null || !type) return;
    const value = catatan.trim() || null;
    try {
      if (type === "approve") {
        await api.approveInvoice(invoiceId, value);
        showToast("Invoice disetujui");
      } else {
        await api.rejectInvoice(invoiceId, value);
        showToast("Invoice ditolak");
      }
      reset();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>{type === "approve" ? "Approve Invoice" : "Reject Invoice"}</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="field">
          <label htmlFor="invoice-action-catatan">Catatan (opsional)</label>
          <textarea
            id="invoice-action-catatan"
            placeholder="Contoh: Invoice sudah sesuai"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>
        <div className="error-text">{error}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>Batal</button>
          <button
            type="button"
            className={type === "approve" ? "btn btn-confirm-approve" : "btn btn-confirm-danger"}
            style={{ width: "auto" }}
            onClick={handleConfirm}
          >
            {type === "approve" ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
