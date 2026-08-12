"use client";

import { useState } from "react";
import { api } from "@/lib/api";
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
  const { showToast } = useToast();

  if (!open) return null;

  function handleClose() {
    setBulan("");
    setFile(null);
    setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!bulan || !file) {
      setError("Lengkapi bulan dan file invoice.");
      return;
    }
    setBusy(true);
    try {
      await api.uploadInvoice(bulan, file);
      showToast("Invoice berhasil dikirim ke Admin General Affair");
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
            <input
              type="file"
              id="invoice-upload-file"
              accept="application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={busy}>Kirim Invoice</button>
          </div>
        </form>
      </div>
    </div>
  );
}
