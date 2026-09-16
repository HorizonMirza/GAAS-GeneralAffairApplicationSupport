"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { ARCHIVE_KATEGORI_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { ArchiveKategori, KoreksiArsipPayload, PermintaanArsip } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const KATEGORI_OPTIONS = Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[];

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
    catatan: "",
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
      await api.koreksiArsip(item!.id, form!);
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
          <h3>Form Pemindahan Arsip {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ak-nomor-arsip">Nomor Pemindahan Arsip <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ak-nomor-arsip" disabled value={item.nomorArsip || ""} />
            </div>
            <div className="field">
              <label htmlFor="ak-tanggal">Tanggal <Lock className="field-lock-icon" width={12} height={12} /></label>
              <DateFilterPicker id="ak-tanggal" disabled clearable={false} value={item.tanggal} onChange={() => {}} />
            </div>
            <div className="field">
              <label htmlFor="ak-jumlah-arsip">Jumlah Arsip <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ak-jumlah-arsip" disabled value={item.jumlahArsip ? String(item.jumlahArsip) : ""} />
            </div>
            <div className="field">
              <label htmlFor="ak-nama-pic">Nama PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ak-nama-pic" required maxLength={255} value={form.namaPic} onChange={(e) => set("namaPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ak-telepon-pic">No. Telepon PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ak-telepon-pic" required maxLength={50} value={form.noTeleponPic} onChange={(e) => set("noTeleponPic", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="ak-lokasi">Lokasi Penyimpanan Saat Ini <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ak-lokasi" required maxLength={255} value={form.lokasiPenyimpanan} onChange={(e) => set("lokasiPenyimpanan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="ak-nama-arsip">Nama Arsip <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ak-nama-arsip" disabled value={item.namaArsip} />
            </div>
            <div className="field">
              <label htmlFor="ak-kategori">Kategori <Lock className="field-lock-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="ak-kategori"
                disabled
                value={item.kategori}
                onChange={() => {}}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
                placeholder="Kategori"
              />
            </div>
            <div className="field">
              <label htmlFor="ak-tahun">Tahun <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ak-tahun" disabled value={item.tahunArsip} />
            </div>
            <div className="field full">
              <label htmlFor="ak-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ak-catatan" disabled value={item.catatan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="ak-alasan-koreksi">Alasan Koreksi (opsional)</label>
              <textarea
                id="ak-alasan-koreksi"
                maxLength={255}
                placeholder="Contoh: Lokasi penyimpanan salah ketik"
                value={form.catatan}
                onChange={(e) => set("catatan", e.target.value)}
              />
            </div>
          </div>
          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"].includes(item.status) && (
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
