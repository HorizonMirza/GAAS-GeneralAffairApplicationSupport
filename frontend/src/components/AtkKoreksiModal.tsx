"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KoreksiAtkPayload, PermintaanAtk } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: PermintaanAtk | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: PermintaanAtk): KoreksiAtkPayload {
  return {
    namaPemohon: item.namaPemohon,
    noTeleponPemohon: item.noTeleponPemohon,
    catatan: item.catatan,
  };
}

// Admin/Approval GA's typo-correction tool: fix the requester's own contact details (or Catatan)
// without touching what's actually being requested - Keperluan, Items and Tanggal stay the
// origin creator's own, same principle as VehicleBookingRescheduleModal leaving Keperluan/PIC
// untouched.
export default function AtkKoreksiModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<KoreksiAtkPayload | null>(null);
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

  function set<K extends keyof KoreksiAtkPayload>(key: K, value: KoreksiAtkPayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.koreksiAtk(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Data pemohon berhasil dikoreksi");
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
          <h3>Koreksi Data Pemohon {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ka-nomor-permintaan">Nomor Permintaan ATK</label>
              <input type="text" id="ka-nomor-permintaan" disabled value={item.nomorPermintaan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="ka-tujuan">Tujuan</label>
              <input type="text" id="ka-tujuan" disabled value={item.keperluan} />
            </div>
            <div className="field full">
              <label htmlFor="ka-tanggal">Tanggal Dibutuhkan</label>
              <input type="text" id="ka-tanggal" disabled value={formatDate(item.tanggal)} />
            </div>
            <div className="field">
              <label htmlFor="ka-nama-pemohon">Nama Pemohon</label>
              <input type="text" id="ka-nama-pemohon" required maxLength={255} value={form.namaPemohon} onChange={(e) => set("namaPemohon", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ka-no-telepon-pemohon">No. Telepon Pemohon</label>
              <input type="text" id="ka-no-telepon-pemohon" required maxLength={50} value={form.noTeleponPemohon} onChange={(e) => set("noTeleponPemohon", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="ka-catatan">Catatan</label>
              <input type="text" id="ka-catatan" maxLength={255} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
