"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { KATEGORI_KERUSAKAN_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KoreksiSaranaPayload, PerbaikanSarana } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: PerbaikanSarana | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: PerbaikanSarana): KoreksiSaranaPayload {
  return {
    namaPelapor: item.namaPelapor,
    noTeleponPelapor: item.noTeleponPelapor,
    lokasi: item.lokasi,
    catatan: item.catatan,
  };
}

// Admin/Approval GA's typo-correction tool: fix the reporter's contact details or physical
// location without touching the report itself - Kategori, DeskripsiKerusakan and FotoKerusakan
// stay the origin creator's own, same principle as VehicleBookingRescheduleModal leaving
// Keperluan/PIC untouched.
export default function SaranaKoreksiModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<KoreksiSaranaPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}`);

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
  }, [open, item]);

  if (!open || !item || !form) return null;

  function set<K extends keyof KoreksiSaranaPayload>(key: K, value: KoreksiSaranaPayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.koreksiSarana(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Data pelapor berhasil dikoreksi");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Koreksi Data Pelapor {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ks-nomor-perbaikan">Nomor Pengajuan Perbaikan</label>
              <input type="text" id="ks-nomor-perbaikan" disabled value={item.nomorPerbaikan || ""} />
            </div>
            <div className="field">
              <label htmlFor="ks-tanggal">Tanggal Pengajuan</label>
              <input type="text" id="ks-tanggal" disabled value={formatDate(item.tanggal)} />
            </div>
            <div className="field">
              <label htmlFor="ks-kategori">Kategori Kerusakan</label>
              <input type="text" id="ks-kategori" disabled value={KATEGORI_KERUSAKAN_LABEL[item.kategori] || item.kategori} />
            </div>
            <div className="field full">
              <label htmlFor="ks-deskripsi">Deskripsi Kerusakan</label>
              <input type="text" id="ks-deskripsi" disabled value={item.deskripsiKerusakan} />
            </div>
            <div className="field full">
              <label htmlFor="ks-lokasi">Lokasi</label>
              <input type="text" id="ks-lokasi" required maxLength={255} value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ks-nama-pelapor">Nama Pelapor</label>
              <input type="text" id="ks-nama-pelapor" required maxLength={255} value={form.namaPelapor} onChange={(e) => set("namaPelapor", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ks-no-telepon-pelapor">No. Telepon Pelapor</label>
              <input type="text" id="ks-no-telepon-pelapor" required maxLength={50} value={form.noTeleponPelapor} onChange={(e) => set("noTeleponPelapor", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="ks-catatan">Catatan</label>
              <input type="text" id="ks-catatan" maxLength={255} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
