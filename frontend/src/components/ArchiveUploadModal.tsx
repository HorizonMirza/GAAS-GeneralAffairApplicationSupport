"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { ARCHIVE_KATEGORI_LABEL, MAX_ARCHIVE_FILE_SIZE_BYTES } from "@/lib/constants";
import { useAutofocusFirstField } from "@/lib/formNav";
import type { ArchiveKategori } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const KATEGORI_OPTIONS = Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[];

export default function ArchiveUploadModal({ open, onClose, onDone }: Props) {
  const [namaDokumen, setNamaDokumen] = useState("");
  const [kategori, setKategori] = useState<ArchiveKategori>("SOP");
  const [catatan, setCatatan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  if (!open) return null;

  function handleClose() {
    setNamaDokumen("");
    setKategori("SOP");
    setCatatan("");
    setFile(null);
    setError("");
    onClose();
  }

  function handleFileChange(picked: File | null) {
    if (picked && picked.size > MAX_ARCHIVE_FILE_SIZE_BYTES) {
      setError("File terlalu besar, maksimal 20 MB");
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
    if (!namaDokumen.trim() || !file) {
      setError("Lengkapi nama dokumen dan file.");
      return;
    }
    if (file.size > MAX_ARCHIVE_FILE_SIZE_BYTES) {
      setError("File terlalu besar, maksimal 20 MB");
      return;
    }
    setBusy(true);
    try {
      await api.uploadArchive({ namaDokumen: namaDokumen.trim(), kategori, catatan: catatan.trim() || null, file });
      showToast("Dokumen berhasil disimpan ke Archive");
      handleClose();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={handleClose} className="modal-overlay modal-overlay-centered">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Unggah Dokumen</h3>
          <button type="button" className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="archive-upload-nama">Nama Dokumen</label>
            <input
              type="text"
              id="archive-upload-nama"
              required
              placeholder="Contoh: SOP Pengadaan Barang 2026"
              value={namaDokumen}
              onChange={(e) => setNamaDokumen(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="archive-upload-kategori">Kategori</label>
            <SearchableSelect
              id="archive-upload-kategori"
              value={kategori}
              onChange={(v) => setKategori(v as ArchiveKategori)}
              options={KATEGORI_OPTIONS}
              getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
              placeholder="Pilih kategori"
            />
          </div>
          <div className="field">
            <label htmlFor="archive-upload-file">File Dokumen</label>
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
                id="archive-upload-file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                className="file-dropzone-input"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </div>
            <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 6 }}>PDF, Word, Excel, PowerPoint, gambar, atau ZIP - maksimal 20 MB</div>
          </div>
          <div className="field">
            <label htmlFor="archive-upload-catatan">Catatan</label>
            <input type="text" id="archive-upload-catatan" placeholder="Opsional" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={busy}>Simpan</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
