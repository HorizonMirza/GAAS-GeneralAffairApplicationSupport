"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { SUMBER_PEMBELIAN_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KoreksiAtkPayload, PermintaanAtk, SumberPembelian } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const SUMBER_PEMBELIAN_OPTIONS: SumberPembelian[] = ["KPU", "PADI"];

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
    sumberPembelian: item.sumberPembelian,
    catatan: "",
  };
}

// Admin/Approval GA's typo-correction tool: fix the requester's own contact details (or Catatan)
// without touching what's actually being requested - Keperluan, Items and Tanggal stay the
// origin creator's own, same principle as VehicleBookingRescheduleModal leaving Keperluan/PIC
// untouched. Sumber Pembelian is the one exception - it's GA's own pick (not the requester's),
// so it's correctable here too, shown only once GA has actually chosen it.
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
      await api.koreksiAtk(item!.id, { ...form!, sumberPembelian: form!.sumberPembelian || null });
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
          <h3>Form Permintaan ATK {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ka-nomor-permintaan">Nomor Permintaan ATK <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ka-nomor-permintaan" disabled value={item.nomorPermintaan || ""} />
            </div>
            <div className="field">
              <label htmlFor="ka-tanggal">Tanggal Dibutuhkan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <DateFilterPicker id="ka-tanggal" disabled clearable={false} value={item.tanggal} onChange={() => {}} />
            </div>
            <div className="field">
              <label htmlFor="ka-nama-pemohon">Nama Pemohon <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ka-nama-pemohon" required maxLength={255} value={form.namaPemohon} onChange={(e) => set("namaPemohon", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ka-no-telepon-pemohon">No. Telepon Pemohon <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ka-no-telepon-pemohon" required maxLength={50} value={form.noTeleponPemohon} onChange={(e) => set("noTeleponPemohon", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ka-tujuan">Tujuan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ka-tujuan" disabled value={item.keperluan} />
            </div>
            <div className="field full">
              <label>Daftar Barang <Lock className="field-lock-icon" width={12} height={12} /></label>
              <div className="item-row-list">
                <div className="item-row-header">
                  <span className="item-row-col-lg">Nama Barang</span>
                  <span className="item-row-col-sm">Jumlah</span>
                  <span className="item-row-col-md">Satuan</span>
                </div>
                {item.items.map((row, idx) => (
                  <div key={idx} className="item-row">
                    <input type="text" className="item-row-col-lg" aria-label={`Nama barang ${idx + 1}`} disabled value={row.namaBarang} />
                    <input type="text" className="item-row-col-sm" aria-label={`Jumlah barang ${idx + 1}`} disabled value={row.jumlah} />
                    <input type="text" className="item-row-col-md" aria-label={`Satuan barang ${idx + 1}`} disabled value={row.satuan} />
                  </div>
                ))}
              </div>
            </div>
            {item.sumberPembelian && (
              <div className="field full">
                <label htmlFor="ka-sumber-pembelian">Sumber Pembelian <Pencil className="field-edit-icon" width={12} height={12} /></label>
                <SearchableSelect
                  id="ka-sumber-pembelian"
                  value={form.sumberPembelian || ""}
                  onChange={(v) => set("sumberPembelian", v as SumberPembelian)}
                  options={SUMBER_PEMBELIAN_OPTIONS}
                  getLabel={(v) => SUMBER_PEMBELIAN_LABEL[v as SumberPembelian]}
                  placeholder="Pilih Sumber Pembelian"
                />
              </div>
            )}
            <div className="field full">
              <label htmlFor="ka-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ka-catatan" disabled value={item.catatan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="ka-alasan-koreksi">Alasan Koreksi (opsional)</label>
              <textarea
                id="ka-alasan-koreksi"
                maxLength={255}
                placeholder="Contoh: Nama pemohon salah ketik"
                value={form.catatan}
                onChange={(e) => set("catatan", e.target.value)}
              />
            </div>
          </div>
          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL", "COMPLETED"].includes(item.status) && (
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
