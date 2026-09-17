"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Trash2, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { MAX_INVOICE_FILE_SIZE_BYTES } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import { useAutofocusFirstField } from "@/lib/formNav";
import type { Invoice } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: Invoice | null;
  onClose: () => void;
  onDone: () => void;
}

export default function InvoiceUpdateModal({ open, item, onClose, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}`);

  if (!open || !item) return null;

  const isDraft = item.status === "DRAFT";

  function handleClose() {
    setFile(null);
    setError("");
    onClose();
  }

  function handleFileChange(picked: File | null) {
    if (picked && picked.size > MAX_INVOICE_FILE_SIZE_BYTES) {
      setError("File terlalu besar, maksimal 10 MB");
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
    if (!file || !item) {
      setError("Pilih file Invoice yang baru.");
      return;
    }
    if (file.size > MAX_INVOICE_FILE_SIZE_BYTES) {
      setError("File terlalu besar, maksimal 10 MB");
      return;
    }
    setBusy(true);
    try {
      await api.updateInvoice(item.id, file);
      showToast(isDraft ? "Draft Invoice berhasil diperbarui" : "Revisi Invoice tersimpan sebagai draft, kirim kembali lewat Detail");
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
          <h3>Update Invoice</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="invoice-update-file">File Invoice Baru (PDF)</label>
            <div
              className={`file-dropzone${dragging ? " file-dropzone-dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <UploadCloud width={32} height={32} />
              <div className="photo-drop-title">Pilih file atau Drag and Drop disini.</div>
              <div className="photo-drop-caption">Format PDF, Max 10 MB</div>
              <input
                type="file"
                id="invoice-update-file"
                accept="application/pdf"
                className="file-dropzone-input"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </div>
            {file && (
              <div className="photo-drop-list">
                <div className="photo-drop-item">
                  <div className="photo-drop-item-thumb">
                    <FileText width={18} height={18} />
                  </div>
                  <div className="photo-drop-item-info">
                    <span className="photo-drop-item-name">{file.name}</span>
                    <span className="photo-drop-item-size">{formatFileSize(file.size)}</span>
                  </div>
                  <CheckCircle2 width={18} height={18} className="photo-drop-item-check" />
                  <button type="button" className="photo-drop-item-remove" aria-label="Hapus file" onClick={() => handleFileChange(null)}>
                    <Trash2 width={14} height={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
