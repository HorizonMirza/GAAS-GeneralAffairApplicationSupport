"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { MAX_INVOICE_FILE_SIZE_BYTES } from "@/lib/constants";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function InvoiceUploadModal({ open, onClose, onDone }: Props) {
  const [bulan, setBulan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { showToast } = useToast();

  if (!open) return null;

  function handleClose() {
    setBulan("");
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
    if (!bulan || !file) {
      setError("Lengkapi bulan dan file invoice.");
      return;
    }
    if (file.size > MAX_INVOICE_FILE_SIZE_BYTES) {
      setError("File terlalu besar, maksimal 10 MB");
      return;
    }
    setBusy(true);
    try {
      await api.uploadInvoice(bulan, file);
      showToast("Invoice berhasil disimpan sebagai draft");
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
    <div className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Input Invoice</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="invoice-upload-bulan">Bulan Invoice</label>
            <input
              type="month"
              id="invoice-upload-bulan"
              required
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="invoice-upload-file">File Invoice (PDF)</label>
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
                  <>Tarik file ke sini atau <span className="file-dropzone-link">pilih file</span></>
                )}
              </div>
              <input
                type="file"
                id="invoice-upload-file"
                accept="application/pdf"
                required
                className="file-dropzone-input"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </div>
            <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 6 }}>Maksimal 10 MB</div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={busy}>Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
