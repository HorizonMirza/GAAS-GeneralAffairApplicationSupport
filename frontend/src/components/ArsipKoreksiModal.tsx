"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ARCHIVE_KATEGORI_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KoreksiArsipPayload, PermintaanArsip } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: PermintaanArsip | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: PermintaanArsip): KoreksiArsipPayload {
  return {
    lokasiPenyimpanan: item.lokasiPenyimpanan,
    namaPic: item.namaPic || "",
    noTeleponPic: item.noTeleponPic || "",
    catatan: item.catatan,
  };
}

// Admin/Approval GA's typo-correction tool: fix the PIC's own contact details or the physical
// storage location without touching the archive itself - NamaArsip, Kategori, TahunArsip and
// JumlahArsip stay the origin creator's own, same principle as SaranaKoreksiModal leaving
// Kategori/DeskripsiKerusakan untouched.
export default function ArsipKoreksiModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<KoreksiArsipPayload | null>(null);
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

  function set<K extends keyof KoreksiArsipPayload>(key: K, value: KoreksiArsipPayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.koreksiArsip(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Data lokasi/PIC berhasil dikoreksi");
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
          <h3>Koreksi Data Lokasi/PIC {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ak-nomor-arsip">Nomor Pemindahan Arsip</label>
              <input type="text" id="ak-nomor-arsip" disabled value={item.nomorArsip || ""} />
            </div>
            <div className="field">
              <label htmlFor="ak-tanggal">Tanggal</label>
              <input type="text" id="ak-tanggal" disabled value={formatDate(item.tanggal)} />
            </div>
            <div className="field">
              <label htmlFor="ak-kategori">Kategori</label>
              <input type="text" id="ak-kategori" disabled value={ARCHIVE_KATEGORI_LABEL[item.kategori] || item.kategori} />
            </div>
            <div className="field full">
              <label htmlFor="ak-nama-arsip">Nama Arsip</label>
              <input type="text" id="ak-nama-arsip" disabled value={item.namaArsip} />
            </div>
            <div className="field full">
              <label htmlFor="ak-lokasi">Lokasi Penyimpanan Saat Ini</label>
              <input type="text" id="ak-lokasi" required maxLength={255} value={form.lokasiPenyimpanan} onChange={(e) => set("lokasiPenyimpanan", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ak-nama-pic">Nama PIC</label>
              <input type="text" id="ak-nama-pic" required maxLength={255} value={form.namaPic} onChange={(e) => set("namaPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ak-telepon-pic">No. Telepon PIC</label>
              <input type="text" id="ak-telepon-pic" required maxLength={50} value={form.noTeleponPic} onChange={(e) => set("noTeleponPic", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="ak-catatan">Catatan</label>
              <input type="text" id="ak-catatan" maxLength={255} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
