"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { TIPE_BOOKING_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingRuang, KoreksiBookingPayload } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: BookingRuang | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: BookingRuang): KoreksiBookingPayload {
  return {
    pic: item.pic || "",
    noTeleponPic: item.noTeleponPic || "",
    catatan: "",
  };
}

// Admin/Approval GA's typo-correction tool: fix the PIC's name/phone number without touching the
// booking itself (slot, tipe, jumlah peserta, etc.) - same principle as SaranaKoreksiModal, and
// the counterpart to RoomBookingRescheduleModal which edits the slot but leaves the PIC untouched.
export default function RoomBookingKoreksiModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<KoreksiBookingPayload | null>(null);
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

  function set<K extends keyof KoreksiBookingPayload>(key: K, value: KoreksiBookingPayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.koreksiBooking(item!.id, form!);
      showToast("Data PIC berhasil dikoreksi");
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
          <h3>Form Booking Ruang Meeting {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="kb-nomor-pemesanan">Nomor Pesanan Ruangan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kb-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="kb-nama-kegiatan">Nama Kegiatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kb-nama-kegiatan" disabled value={item.namaKegiatan} />
            </div>
            <div className="field">
              <label htmlFor="kb-pic">Nama PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="kb-pic" required maxLength={50} value={form.pic} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="kb-telepon-pic">No. Telepon PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="kb-telepon-pic" required maxLength={50} value={form.noTeleponPic} onChange={(e) => set("noTeleponPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="kb-tanggal">Tanggal <Lock className="field-lock-icon" width={12} height={12} /></label>
              <DateFilterPicker id="kb-tanggal" disabled clearable={false} value={item.tanggal} onChange={() => {}} />
            </div>
            <div className="field">
              <label htmlFor="kb-peserta">Jumlah Peserta <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kb-peserta" disabled value={String(item.jumlahPeserta)} />
            </div>
            <div className="field full">
              <label htmlFor="kb-ruang">Ruangan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kb-ruang" disabled value={item.namaRuang} />
            </div>
            <div className="field full">
              <label htmlFor="kb-tipe">Tipe <Lock className="field-lock-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="kb-tipe"
                disabled
                value={item.tipe}
                onChange={() => {}}
                options={Object.keys(TIPE_BOOKING_LABELS)}
                getLabel={(v) => TIPE_BOOKING_LABELS[v as keyof typeof TIPE_BOOKING_LABELS] || v}
                placeholder="Pilih tipe"
              />
            </div>
            <div className="field full">
              <label htmlFor="kb-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kb-catatan" disabled value={item.catatan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="kb-alasan-koreksi">Alasan Koreksi (opsional)</label>
              <textarea
                id="kb-alasan-koreksi"
                maxLength={255}
                placeholder="Contoh: Nama PIC salah ketik"
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
