"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingKendaraan, BookingKendaraanReschedulePayload, VehicleOption } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  item: BookingKendaraan | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: BookingKendaraan): BookingKendaraanReschedulePayload {
  const isFullDay = item.isWholeDay || (item.jamMulai?.slice(0, 5) === "07:00" && item.jamSelesai?.slice(0, 5) === "18:00");
  return {
    namaKendaraan: item.namaKendaraan,
    tanggal: item.tanggal,
    isWholeDay: isFullDay,
    jamMulai: isFullDay ? "07:00" : (item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai),
    jamSelesai: isFullDay ? "18:00" : (item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai),
  };
}

// Admin/Approval GA's conflict-resolution tool: move an in-flight booking's kendaraan/date/time
// without touching the rest of it (keperluan, PIC, penumpang stay the origin creator's own) -
// separate from VehicleBookingDetailModal's own "edit" mode, which is creator-only and DRAFT-only.
export default function VehicleBookingRescheduleModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BookingKendaraanReschedulePayload | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}`);

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  function set<K extends keyof BookingKendaraanReschedulePayload>(key: K, value: BookingKendaraanReschedulePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleJamMulaiChange(v: string) {
    setForm((f) => {
      if (!f) return f;
      const autoWholeDay = v === "07:00" && f.jamSelesai === "18:00";
      return { ...f, jamMulai: v, isWholeDay: autoWholeDay };
    });
  }

  function handleJamSelesaiChange(v: string) {
    setForm((f) => {
      if (!f) return f;
      const autoWholeDay = f.jamMulai === "07:00" && v === "18:00";
      return { ...f, jamSelesai: v, isWholeDay: autoWholeDay };
    });
  }

  function toggleWholeDay() {
    setForm((f) => {
      if (!f) return f;
      return {
        ...f,
        isWholeDay: !f.isWholeDay,
        jamMulai: !f.isWholeDay ? "07:00" : f.jamMulai,
        jamSelesai: !f.isWholeDay ? "18:00" : f.jamSelesai,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.rescheduleKendaraanBooking(item!.id, {
        ...form!,
        jamMulai: form!.isWholeDay ? null : form!.jamMulai,
        jamSelesai: form!.isWholeDay ? null : form!.jamSelesai,
      });
      showToast("Kendaraan/jadwal booking berhasil dipindahkan");
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
              <label htmlFor="rk-nomor-pemesanan">Nomor Pesanan Kendaraan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="rk-keperluan">Keperluan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-keperluan" disabled value={item.keperluan} />
            </div>
            <div className="field">
              <label htmlFor="rk-pic">Nama PIC <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-pic" disabled value={item.pic || ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-telepon-pic">No. Telepon PIC <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-telepon-pic" disabled value={item.noTeleponPic || ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-tanggal">Tanggal <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <DateFilterPicker id="rk-tanggal" value={form.tanggal} onChange={(v) => set("tanggal", v)} clearable={false} />
            </div>
            <div className="field">
              <label htmlFor="rk-penumpang">Jumlah Penumpang <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-penumpang" disabled value={item.jumlahPenumpang ? `${item.jumlahPenumpang}` : ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-jam-mulai">Jam Mulai <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rk-jam-mulai"
                disabled={form.isWholeDay}
                value={form.jamMulai || undefined}
                onChange={handleJamMulaiChange}
                options={HOUR_OPTIONS}
                placeholder="Pilih jam"
              />
            </div>
            <div className="field">
              <label htmlFor="rk-jam-selesai">Jam Selesai <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rk-jam-selesai"
                disabled={form.isWholeDay}
                value={form.jamSelesai || undefined}
                onChange={handleJamSelesaiChange}
                options={HOUR_OPTIONS}
                placeholder="Pilih jam"
              />
            </div>
            <div className="field full">
              <label htmlFor="rk-sepanjang-hari">Durasi (Opsional) <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <button
                type="button"
                id="rk-sepanjang-hari"
                className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}`}
                aria-pressed={form.isWholeDay}
                onClick={toggleWholeDay}
              >
                <span className="field-toggle-box">
                  {form.isWholeDay && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </span>
                Sepanjang Hari
              </button>
            </div>
            <div className="field full">
              <label htmlFor="rk-kendaraan">Kendaraan <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rk-kendaraan"
                value={form.namaKendaraan}
                onChange={(v) => set("namaKendaraan", v)}
                options={vehicles.map((v) => v.nama)}
                getLabel={(nama) => {
                  const v = vehicles.find((x) => x.nama === nama);
                  return v ? `${v.nama} - ${v.platNomor} - Pengemudi: ${v.supir}` : nama;
                }}
                placeholder={form.namaKendaraan}
              />
            </div>
            <div className="field full">
              <label htmlFor="rk-supir">Nama Pengemudi <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-supir" disabled value={vehicles.find((v) => v.nama === form.namaKendaraan)?.supir ?? item.supir ?? ""} />
            </div>
            <div className="field full">
              <label htmlFor="rk-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-catatan" disabled value={item.catatan || ""} />
            </div>
          </div>
          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 12 }}>
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
