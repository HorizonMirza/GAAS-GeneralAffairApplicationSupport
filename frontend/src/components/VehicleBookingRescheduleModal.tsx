"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingKendaraan, BookingKendaraanReschedulePayload, VehicleOption } from "@/lib/types";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  item: BookingKendaraan | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: BookingKendaraan): BookingKendaraanReschedulePayload {
  return {
    namaKendaraan: item.namaKendaraan,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    jamMulai: item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai,
    jamSelesai: item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai,
  };
}

// Admin/Approval GA's conflict-resolution tool: move an in-flight booking's kendaraan/date/time
// without touching the rest of it (keperluan, PIC, penumpang stay the origin creator's own) -
// separate from VehicleBookingDetailModal's own "edit" mode, which is creator-only and DRAFT-only.
export default function VehicleBookingRescheduleModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BookingKendaraanReschedulePayload | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [error, setError] = useState("");
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
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Ubah Kendaraan/Jadwal {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="rk-nomor-pemesanan">Nomor Pesanan Kendaraan</label>
              <input type="text" id="rk-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="rk-keperluan">Keperluan</label>
              <input type="text" id="rk-keperluan" disabled value={item.keperluan} />
            </div>
            <div className="field full">
              <label htmlFor="rk-pic">PIC</label>
              <input type="text" id="rk-pic" disabled value={item.pic || ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-tanggal">Tanggal</label>
              <input type="date" id="rk-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rk-penumpang">Jumlah Penumpang</label>
              <input type="text" id="rk-penumpang" disabled value={item.jumlahPenumpang ? `${item.jumlahPenumpang}` : ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-jam-mulai">Jam Mulai</label>
              <select id="rk-jam-mulai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rk-jam-selesai">Jam Selesai</label>
              <select id="rk-jam-selesai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="rk-sepanjang-hari">Durasi (Opsional)</label>
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
              <label htmlFor="rk-kendaraan">Kendaraan</label>
              <select id="rk-kendaraan" required value={form.namaKendaraan} onChange={(e) => set("namaKendaraan", e.target.value)}>
                {vehicles.map((v) => (
                  <option key={v.nama} value={v.nama}>{v.nama} - {v.platNomor} - Supir: {v.supir}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="rk-supir">Supir</label>
              <input type="text" id="rk-supir" disabled value={vehicles.find((v) => v.nama === form.namaKendaraan)?.supir ?? item.supir ?? ""} />
            </div>
            <div className="field full">
              <label htmlFor="rk-catatan">Catatan</label>
              <input type="text" id="rk-catatan" disabled value={item.catatan || ""} />
            </div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
