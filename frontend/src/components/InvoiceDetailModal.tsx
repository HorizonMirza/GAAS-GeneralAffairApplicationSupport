"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { getInvoiceStatusLabelMap } from "@/lib/constants";
import { formatDateTime, invoiceBulanLabel } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Invoice, Me } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
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
  const { language, t } = useLanguage();
  const [error, setError] = useState("");
  const { showToast } = useToast();

  if (!open || !item) return null;

  const canReview = me.role === "ADMIN_GA" && item.status === "PENDING";
  const canSubmitDraft = me.role === "KPU" && item.status === "DRAFT" && item.uploadedBy === me.id;

  async function handleSubmitDraft() {
    if (!item) return;
    try {
      await api.submitInvoice(item.id);
      showToast(t("eks.toastInvoiceSubmitted"));
      onSubmitted();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>{t("eks.detailInvoice")}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="detail-grid">
          <div className="detail-row">
            <span className="detail-label">{t("eks.bulanInvoice")}</span>
            <span className="detail-value">{invoiceBulanLabel(item.bulan)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t("common.status")}</span>
            <span className="detail-value">{getInvoiceStatusLabelMap(language)[item.status] || item.status}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t("eks.diunggah")}</span>
            <span className="detail-value">{formatDateTime(item.uploadedAt)}</span>
          </div>
          {item.reviewedAt && (
            <div className="detail-row">
              <span className="detail-label">{t("eks.ditinjau")}</span>
              <span className="detail-value">{formatDateTime(item.reviewedAt)}</span>
            </div>
          )}
          {item.catatan && (
            <div className="detail-row" style={{ gridColumn: "1 / -1" }}>
              <span className="detail-label">{t("common.notes")}</span>
              <span className="detail-value">{item.catatan}</span>
            </div>
          )}
        </div>
        <div className="error-text">{error}</div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t("common.close")}</button>
          {canReview && (
            <>
              <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => onRequestAction(item.id, "reject")}>{t("common.reject")}</button>
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={() => onRequestAction(item.id, "approve")}>{t("common.approve")}</button>
            </>
          )}
          {canSubmitDraft && (
            <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft}>{t("common.approve")}</button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
