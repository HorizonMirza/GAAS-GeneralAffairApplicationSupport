"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KoreksiPengirimanPayload, Pengiriman } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: Pengiriman | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: Pengiriman): KoreksiPengirimanPayload {
  return {
    namaPengirim: item.namaPengirim,
    noTeleponPengirim: item.noTeleponPengirim,
    alamatPengirim: item.alamatPengirim,
    namaPenerima: item.namaPenerima,
    alamatPenerima: item.alamatPenerima,
    noTeleponPenerima: item.noTeleponPenerima,
    catatan: item.catatan,
  };
}

// Admin/Approval GA's typo-correction tool: fix the sender's/recipient's own contact details (or
// Catatan) without touching the shipment itself - Tujuan, NomorTransmittal, KodeProgram,
// JumlahItem, Asuransi/Packing and every financial field stay the origin creator's own, same
// principle as SaranaKoreksiModal leaving Kategori/DeskripsiKerusakan untouched.
export default function PengirimanKoreksiModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<KoreksiPengirimanPayload | null>(null);
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

  function set<K extends keyof KoreksiPengirimanPayload>(key: K, value: KoreksiPengirimanPayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.koreksiPengiriman(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Data pengirim/penerima berhasil dikoreksi");
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
          <h3>Koreksi Data Pengirim/Penerima {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="pk-nomor-transmittal">Nomor Transmittal</label>
              <input type="text" id="pk-nomor-transmittal" disabled value={item.nomorTransmittal || ""} />
            </div>
            <div className="field">
              <label htmlFor="pk-tanggal">Tanggal</label>
              <input type="text" id="pk-tanggal" disabled value={formatDate(item.tanggal)} />
            </div>
            <div className="field">
              <label htmlFor="pk-tujuan">Tujuan</label>
              <input type="text" id="pk-tujuan" disabled value={item.tujuanPenerimaan} />
            </div>
            <div className="field">
              <label htmlFor="pk-nama-pengirim">Nama Pengirim</label>
              <input type="text" id="pk-nama-pengirim" required maxLength={255} value={form.namaPengirim} onChange={(e) => set("namaPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pk-telepon-pengirim">No. Telepon Pengirim</label>
              <input type="text" id="pk-telepon-pengirim" required maxLength={50} value={form.noTeleponPengirim} onChange={(e) => set("noTeleponPengirim", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pk-alamat-pengirim">Alamat Pengirim</label>
              <input type="text" id="pk-alamat-pengirim" required maxLength={255} value={form.alamatPengirim} onChange={(e) => set("alamatPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pk-nama-penerima">Nama Penerima</label>
              <input type="text" id="pk-nama-penerima" required maxLength={255} value={form.namaPenerima} onChange={(e) => set("namaPenerima", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pk-telepon-penerima">No. Telepon Penerima</label>
              <input type="text" id="pk-telepon-penerima" required maxLength={50} value={form.noTeleponPenerima} onChange={(e) => set("noTeleponPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pk-alamat-penerima">Alamat Penerima</label>
              <input type="text" id="pk-alamat-penerima" required maxLength={255} value={form.alamatPenerima} onChange={(e) => set("alamatPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pk-catatan">Catatan</label>
              <input type="text" id="pk-catatan" maxLength={255} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
