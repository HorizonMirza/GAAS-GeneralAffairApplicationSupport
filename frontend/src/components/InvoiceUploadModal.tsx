"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { MAX_INVOICE_FILE_SIZE_BYTES } from "@/lib/constants";
import { useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function InvoiceUploadModal({ open, onClose, onDone }: Props) {
  const { t } = useLanguage();
  const [bulan, setBulan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  if (!open) return null;

  function handleClose() {
    setBulan("");
    setFile(null);
    setError("");
    onClose();
  }

  function handleFileChange(picked: File | null) {
    if (picked && picked.size > MAX_INVOICE_FILE_SIZE_BYTES) {
      setError(t("common.fileTooLarge"));
      setFile(null);
      return;
    }
    setError("");
    setFile(picked);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFileChange(e.dataTransfer.files?.[0] || null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!bulan || !file) {
      setError(t("eks.errLengkapiBulanFile"));
      return;
    }
    if (file.size > MAX_INVOICE_FILE_SIZE_BYTES) {
      setError(t("common.fileTooLarge"));
      return;
    }
    setBusy(true);
    try {
      await api.uploadInvoice(bulan, file);
      showToast(t("eks.toastInvoiceSavedDraft"));
      setBulan("");
      setFile(null);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={handleClose} className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>{t("eks.inputInvoiceTitle")}</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="invoice-upload-bulan">{t("eks.bulanInvoice")}</label>
            <input
              type="month"
              id="invoice-upload-bulan"
              required
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="invoice-upload-file">{t("eks.fileInvoice")}</label>
            <div
              className={`file-dropzone${dragging ? " file-dropzone-dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <div className="file-dropzone-text">
                {file ? (
                  <strong>{file.name}</strong>
                ) : (
                  <>{t("common.dragFileHere")} <span className="file-dropzone-link">{t("common.chooseFile")}</span></>
                )}
              </div>
              <input
                type="file"
                id="invoice-upload-file"
                accept="application/pdf"
                className="file-dropzone-input"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </div>
            <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 6 }}>{t("common.maxSize10mb")}</div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={busy}>{t("common.save")}</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
