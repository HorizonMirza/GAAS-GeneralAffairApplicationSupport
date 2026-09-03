"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  invoiceId: number | null;
  type: "approve" | "reject" | null;
  onClose: () => void;
  onDone: () => void;
}

export default function InvoiceActionModal({ open, invoiceId, type, onClose, onDone }: Props) {
  const { t } = useLanguage();
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  useAutofocusFirstField(containerRef, `${open}-${invoiceId}-${type}`);

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
        showToast(t("eks.toastInvoiceApproved"));
      } else {
        await api.rejectInvoice(invoiceId, value);
        showToast(t("eks.toastInvoiceRejected"));
      }
      reset();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ModalOverlay open={open} onClose={handleClose} className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 420 }} ref={containerRef}>
        <div className="modal-header">
          <h3>{type === "approve" ? t("eks.approveInvoiceTitle") : t("eks.rejectInvoiceTitle")}</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="field">
          <label htmlFor="invoice-action-catatan">{t("eks.catatanOpsional")}</label>
          <textarea
            id="invoice-action-catatan"
            placeholder={t("eks.contohInvoiceSesuai")}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </div>
        <div className="error-text">{error}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>{t("common.cancel")}</button>
          <button
            type="button"
            className={type === "approve" ? "btn btn-confirm-approve" : "btn btn-confirm-danger"}
            style={{ width: "auto" }}
            onClick={handleConfirm}
          >
            {type === "approve" ? t("common.approve") : t("common.reject")}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
