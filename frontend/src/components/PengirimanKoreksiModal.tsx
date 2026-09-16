"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KoreksiPengirimanPayload, Pengiriman } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
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
    catatan: "",
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
      await api.koreksiPengiriman(item!.id, form!);
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
          <h3>Form Data Barang {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="pk-nomor-transmittal">Nomor Transmittal <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="pk-nomor-transmittal" disabled value={item.nomorTransmittal || ""} />
            </div>
            <div className="field">
              <label htmlFor="pk-tanggal">Tanggal <Lock className="field-lock-icon" width={12} height={12} /></label>
              <DateFilterPicker id="pk-tanggal" disabled clearable={false} value={item.tanggal} onChange={() => {}} />
            </div>
            <div className="field">
              <label htmlFor="pk-jumlah-item">Jumlah Barang <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="pk-jumlah-item" disabled value={item.jumlahItem} />
            </div>
            <div className="field">
              <label htmlFor="pk-nama-pengirim">Nama Pengirim <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input
                type="text"
                id="pk-nama-pengirim"
                required
                maxLength={255}
                value={form.namaPengirim}
                onChange={(e) => set("namaPengirim", e.target.value.replace(/[^A-Za-z\s.'-]/g, ""))}
              />
            </div>
            <div className="field">
              <label htmlFor="pk-telepon-pengirim">No. Telepon Pengirim <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input
                type="text"
                id="pk-telepon-pengirim"
                inputMode="tel"
                required
                maxLength={50}
                value={form.noTeleponPengirim}
                onChange={(e) => set("noTeleponPengirim", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="pk-alamat-pengirim">Alamat Pengirim <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <textarea id="pk-alamat-pengirim" required maxLength={255} value={form.alamatPengirim} onChange={(e) => set("alamatPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pk-nama-penerima">Nama Penerima <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input
                type="text"
                id="pk-nama-penerima"
                required
                maxLength={255}
                value={form.namaPenerima}
                onChange={(e) => set("namaPenerima", e.target.value.replace(/[^A-Za-z\s.'-]/g, ""))}
              />
            </div>
            <div className="field">
              <label htmlFor="pk-telepon-penerima">No. Telepon Penerima <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input
                type="text"
                id="pk-telepon-penerima"
                inputMode="tel"
                required
                maxLength={50}
                value={form.noTeleponPenerima}
                onChange={(e) => set("noTeleponPenerima", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="pk-alamat-penerima">Alamat Penerima <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <textarea id="pk-alamat-penerima" required maxLength={255} value={form.alamatPenerima} onChange={(e) => set("alamatPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pk-tujuan">Tujuan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="pk-tujuan" disabled value={item.tujuanPenerimaan} />
            </div>
            <div className="field full">
              <label htmlFor="pk-kode-program">Kode Program <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="pk-kode-program" disabled value={item.kodeProgram} />
            </div>
            <div className="field">
              <label htmlFor="pk-asuransi">Asuransi <Lock className="field-lock-icon" width={12} height={12} /></label>
              <SearchableSelect id="pk-asuransi" disabled value={item.asuransiStatus} onChange={() => {}} options={["Tidak", "Ya"]} placeholder="Tidak" />
            </div>
            <div className="field">
              <label htmlFor="pk-packing">Pengemasan Tambahan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <SearchableSelect id="pk-packing" disabled value={item.requestPacking} onChange={() => {}} options={["Tidak", "Tambahan Kayu"]} placeholder="Tidak" />
            </div>
            <div className="field full">
              <label htmlFor="pk-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="pk-catatan" disabled value={item.catatan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="pk-alasan-koreksi">Alasan Koreksi (opsional)</label>
              <textarea
                id="pk-alasan-koreksi"
                maxLength={255}
                placeholder="Contoh: Nama penerima salah ketik"
                value={form.catatan}
                onChange={(e) => set("catatan", e.target.value)}
              />
            </div>
          </div>
          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL", "APPROVED_KPU", "COMPLETED"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 12 }}>
              <strong>Diajukan:</strong> {formatDateTime(item.createdAt)}
            </div>
          )}
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
