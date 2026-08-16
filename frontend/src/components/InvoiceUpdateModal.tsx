"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { invoiceBulanLabel } from "@/lib/format";
import type { Invoice } from "@/lib/types";
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
  const { showToast } = useToast();

  if (!open || !item) return null;

  const isDraft = item.status === "DRAFT";

  function handleClose() {
    setFile(null);
    setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file || !item) {
      setError("Pilih file invoice yang baru.");
      return;
    }
    setBusy(true);
    try {
      await api.updateInvoice(item.id, file);
      showToast(isDraft ? "Draft invoice berhasil diperbarui" : "Revisi invoice tersimpan sebagai draft, kirim kembali lewat Detail");
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
          <h3>Update Invoice</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <p className="text-secondary" style={{ marginTop: -8, marginBottom: 16 }}>
          {isDraft ? (
            <>Ubah file invoice draft untuk <strong>{invoiceBulanLabel(item.bulan)}</strong> sebelum dikirim.</>
          ) : (
            <>Perbarui file invoice untuk <strong>{invoiceBulanLabel(item.bulan)}</strong> setelah direvisi. Invoice akan tersimpan sebagai draft, kirim kembali lewat Detail.</>
          )}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="invoice-update-file">File Invoice Baru (PDF)</label>
            <div className="file-dropzone">
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
                id="invoice-update-file"
                accept="application/pdf"
                required
                className="file-dropzone-input"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
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
