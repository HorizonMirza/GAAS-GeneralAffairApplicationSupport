"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAutofocusFirstField } from "@/lib/formNav";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  invoiceId: number | null;
  onClose: () => void;
  onDone: () => void;
}

// Approve has no notes step (see InvoiceDetailModal.handleApprove) - this modal now only handles
// Reject, which keeps a reason since a rejection needs to explain what's wrong.
export default function InvoiceActionModal({ open, invoiceId, onClose, onDone }: Props) {
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  useAutofocusFirstField(containerRef, `${open}-${invoiceId}`);

  if (!open) return null;

  function reset() {
    setCatatan("");
    setError("");
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (invoiceId == null) return;
    const value = catatan.trim() || null;
    setBusy(true);
    try {
      await api.rejectInvoice(invoiceId, value);
      showToast("Invoice ditolak");
      reset();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={handleClose} className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 420 }} ref={containerRef}>
        <div className="modal-header">
          <h3>Reject Invoice</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="field">
          <label htmlFor="invoice-action-catatan">Catatan (opsional)</label>
          <textarea
            id="invoice-action-catatan"
            placeholder="Contoh: Invoice sudah sesuai"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.stopPropagation();
              if (!e.shiftKey) {
                e.preventDefault();
                if (!busy) handleConfirm();
              }
            }}
          />
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-confirm-danger"
            style={{ width: "auto" }}
            onClick={handleConfirm}
            disabled={busy}
          >
            Reject
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
