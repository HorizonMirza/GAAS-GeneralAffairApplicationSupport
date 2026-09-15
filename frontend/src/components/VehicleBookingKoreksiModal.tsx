"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingKendaraan, KoreksiKendaraanPayload } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  item: BookingKendaraan | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: BookingKendaraan): KoreksiKendaraanPayload {
  return {
    pic: item.pic || "",
    noTeleponPic: item.noTeleponPic || "",
  };
}

// Admin/Approval GA's typo-correction tool: fix the PIC's name/phone number without touching the
// booking itself (tujuan, kendaraan, jadwal, etc.) - same principle as RoomBookingKoreksiModal,
// and the counterpart to VehicleBookingRescheduleModal which edits the slot but leaves the PIC
// untouched.
export default function VehicleBookingKoreksiModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<KoreksiKendaraanPayload | null>(null);
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

  function set<K extends keyof KoreksiKendaraanPayload>(key: K, value: KoreksiKendaraanPayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.koreksiKendaraanBooking(item!.id, form!);
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
          <h3>Form Booking Kendaraan {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="kk-nomor-pemesanan">Nomor Pesanan Kendaraan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kk-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="kk-keperluan">Tujuan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kk-keperluan" disabled value={item.keperluan} />
            </div>
            <div className="field">
              <label htmlFor="kk-pic">Nama PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="kk-pic" required maxLength={50} value={form.pic} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="kk-telepon-pic">No. Telepon PIC <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input type="text" id="kk-telepon-pic" required maxLength={50} value={form.noTeleponPic} onChange={(e) => set("noTeleponPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="kk-tanggal">Tanggal <Lock className="field-lock-icon" width={12} height={12} /></label>
              <DateFilterPicker id="kk-tanggal" disabled clearable={false} value={item.tanggal} onChange={() => {}} />
            </div>
            <div className="field">
              <label htmlFor="kk-penumpang">Jumlah Penumpang <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kk-penumpang" disabled value={String(item.jumlahPenumpang)} />
            </div>
            <div className="field full">
              <label htmlFor="kk-kendaraan">Kendaraan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kk-kendaraan" disabled value={item.namaKendaraan} />
            </div>
            <div className="field full">
              <label htmlFor="kk-supir">Nama Pengemudi <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kk-supir" disabled value={item.supir || ""} />
            </div>
            <div className="field full">
              <label htmlFor="kk-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="kk-catatan" disabled value={item.catatan || ""} />
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
