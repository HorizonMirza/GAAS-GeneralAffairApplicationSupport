"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BookingRuang, BookingRuangReschedulePayload, RoomOption } from "@/lib/types";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  item: BookingRuang | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: BookingRuang): BookingRuangReschedulePayload {
  return {
    namaRuang: item.namaRuang,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai,
  };
}

// Admin/Approval GA's conflict-resolution tool: move an in-flight booking's room/date/time
// without touching the rest of it (nama kegiatan, PIC, peserta stay the origin creator's own) -
// separate from RoomBookingDetailModal's own "edit" mode, which is creator-only and DRAFT-only.
export default function RoomBookingRescheduleModal({ open, item, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BookingRuangReschedulePayload | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  function set<K extends keyof BookingRuangReschedulePayload>(key: K, value: BookingRuangReschedulePayload[K]) {
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
      await api.rescheduleBooking(item!.id, {
        ...form!,
        jamMulai: form!.isWholeDay ? null : form!.jamMulai,
        jamSelesai: form!.isWholeDay ? null : form!.jamSelesai,
      });
      showToast("Ruang/jadwal booking berhasil dipindahkan");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="modal-overlay modal-overlay-centered">
      <div className="modal">
        <div className="modal-header">
          <h3>Ubah Ruang/Jadwal</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <p className="text-secondary" style={{ marginTop: -8 }}>
          {item.nomorPemesanan} - {item.namaKegiatan}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="rs-ruang">Ruangan</label>
              <select id="rs-ruang" required value={form.namaRuang} onChange={(e) => set("namaRuang", e.target.value)}>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="rs-tanggal">Tanggal</label>
              <input type="date" id="rs-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rs-jam-mulai">Jam Mulai</label>
              <select id="rs-jam-mulai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rs-jam-selesai">Jam Selesai</label>
              <select id="rs-jam-selesai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <button
                type="button"
                className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}`}
                aria-pressed={form.isWholeDay}
                onClick={toggleWholeDay}
              >
                {form.isWholeDay && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
                Sepanjang Hari
              </button>
            </div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Pindahkan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
