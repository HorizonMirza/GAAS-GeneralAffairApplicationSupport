"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { KATEGORI_KERUSAKAN_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KategoriKerusakan, KoreksiSaranaPayload, PerbaikanSarana, PerbaikanSaranaFotoKerusakan } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const KATEGORI_OPTIONS = Object.keys(KATEGORI_KERUSAKAN_LABEL) as KategoriKerusakan[];

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
    catatan: "",
  };
}

// Admin/Approval GA's typo-correction tool: fix the reporter's contact details or physical
// location without touching the report itself - Kategori, DeskripsiKerusakan and FotoKerusakan
// stay the origin creator's own, same principle as VehicleBookingRescheduleModal leaving
// Keperluan/PIC untouched. Field order mirrors SaranaFormModal/SaranaDetailModal (the full
// report) rather than only listing the editable subset, with a lock/pencil icon on each label
// so it's obvious at a glance which ones will actually save.
export default function SaranaKoreksiModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<KoreksiSaranaPayload | null>(null);
  const [fotoKerusakan, setFotoKerusakan] = useState<PerbaikanSaranaFotoKerusakan[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}`);

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    api.listFotoKerusakanSarana(item.id).then(setFotoKerusakan).catch(() => setFotoKerusakan([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  function set<K extends keyof KoreksiSaranaPayload>(key: K, value: KoreksiSaranaPayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.koreksiSarana(item!.id, form!);
      showToast("Data berhasil diperbarui");
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
          <h3>Form Pengajuan Perbaikan {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ks-nomor-perbaikan">Nomor Pengajuan Perbaikan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ks-nomor-perbaikan" disabled value={item.nomorPerbaikan || ""} />
            </div>
            <div className="field">
              <label htmlFor="ks-tanggal">Tanggal Pengajuan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <DateFilterPicker id="ks-tanggal" disabled clearable={false} value={item.tanggal} onChange={() => {}} />
            </div>
            <div className="field">
              <label htmlFor="ks-kategori">Kategori Kerusakan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="ks-kategori"
                disabled
                value={item.kategori}
                onChange={() => {}}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => KATEGORI_KERUSAKAN_LABEL[v as KategoriKerusakan] || v}
                placeholder="Pilih kategori"
              />
            </div>
            <div className="field full">
              <label htmlFor="ks-lokasi">Lokasi <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ks-lokasi" required maxLength={255} value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ks-nama-pelapor">Nama PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ks-nama-pelapor" required maxLength={255} value={form.namaPelapor} onChange={(e) => set("namaPelapor", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ks-no-telepon-pelapor">No. Telepon PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="ks-no-telepon-pelapor" required maxLength={50} value={form.noTeleponPelapor} onChange={(e) => set("noTeleponPelapor", e.target.value.replace(/[^0-9+]/g, ""))} />
            </div>
            <div className="field full">
              <label htmlFor="ks-deskripsi">Deskripsi Kerusakan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <textarea id="ks-deskripsi" disabled value={item.deskripsiKerusakan} onChange={() => {}} />
            </div>
            {fotoKerusakan.length > 0 && (
              <div className="field full">
                <label>Foto Kerusakan <Lock className="field-lock-icon" width={12} height={12} /></label>
                <div className="photo-drop-uploader">
                  <div className="photo-drop-list">
                    {fotoKerusakan.map((foto, index) => (
                      <div className="photo-drop-item photo-drop-item-existing" key={foto.id}>
                        <span className="photo-drop-item-index">{index + 1}.</span>
                        <a href={api.saranaFotoKerusakanUrl(item.id, foto.id)} target="_blank" rel="noopener noreferrer" className="photo-drop-item-thumb">
                          <img src={api.saranaFotoKerusakanUrl(item.id, foto.id)} alt={foto.originalFilename} />
                        </a>
                        <div className="photo-drop-item-info">
                          <a href={api.saranaFotoKerusakanUrl(item.id, foto.id)} target="_blank" rel="noopener noreferrer" className="photo-drop-item-name">
                            {foto.originalFilename}
                          </a>
                        </div>
                        <CheckCircle2 width={18} height={18} className="photo-drop-item-check" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="field full" style={{ marginBottom: 6 }}>
              <label htmlFor="ks-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="ks-catatan" disabled value={item.catatan || ""} />
            </div>
          </div>
          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Diajukan:</strong> {formatDateTime(item.createdAt)}
            </div>
          )}
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
