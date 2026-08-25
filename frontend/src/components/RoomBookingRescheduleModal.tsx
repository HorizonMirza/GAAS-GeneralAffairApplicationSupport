"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MAX_JUMLAH_PESERTA, TIPE_BOOKING_LABELS } from "@/lib/constants";
import type { BookingRuang, BookingRuangReschedulePayload, RoomOption } from "@/lib/types";
import RoomMultiSelect from "./RoomMultiSelect";
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
    additionalRooms: item.additionalRooms,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai,
  };
}

// Admin/Approval GA's conflict-resolution tool: move an in-flight booking's room/date/time
// without touching the rest of it (nama kegiatan, PIC, peserta stay the origin creator's own) -
// separate from RoomBookingDetailModal's own "edit" mode, which is creator-only and DRAFT-only.
// Laid out identically to the full booking form so it reads as "the same form, most of it locked"
// rather than a separate mini-form - only Tanggal/Jam/Durasi/Ruangan/Ruangan Tambahan are live.
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

  function setNamaRuang(nama: string) {
    setForm((f) => (f ? { ...f, namaRuang: nama, additionalRooms: (f.additionalRooms || []).filter((r) => r !== nama) } : f));
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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Ubah Ruang/Jadwal {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="rs-nomor-pemesanan">Nomor Pesanan Ruangan</label>
              <input type="text" id="rs-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="rs-nama-kegiatan">Nama Kegiatan</label>
              <input type="text" id="rs-nama-kegiatan" disabled value={item.namaKegiatan} />
            </div>
            <div className="field full">
              <label htmlFor="rs-pic">PIC</label>
              <input type="text" id="rs-pic" disabled value={item.pic || ""} />
            </div>
            <div className="field">
              <label htmlFor="rs-tanggal">Tanggal</label>
              <input type="date" id="rs-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rs-peserta">Jumlah Peserta</label>
              <input type="text" id="rs-peserta" disabled value={item.jumlahPeserta ? `${Math.min(item.jumlahPeserta, MAX_JUMLAH_PESERTA)}` : ""} />
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
              <label htmlFor="rs-sepanjang-hari">Durasi</label>
              <button
                type="button"
                id="rs-sepanjang-hari"
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
              <label htmlFor="rs-ruang">Ruangan</label>
              <select id="rs-ruang" required value={form.namaRuang} onChange={(e) => setNamaRuang(e.target.value)}>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama}</option>
                ))}
              </select>
            </div>
            {rooms.filter((r) => r.nama !== form.namaRuang).length > 0 && (
              <div className="field full">
                <label htmlFor="rs-ruang-tambahan">Ruangan Tambahan</label>
                <RoomMultiSelect
                  id="rs-ruang-tambahan"
                  rooms={rooms}
                  excludeRoom={form.namaRuang}
                  selected={form.additionalRooms || []}
                  onChange={(next) => set("additionalRooms", next)}
                />
              </div>
            )}
            <div className="field full">
              <label htmlFor="rs-tipe">Tipe</label>
              <select id="rs-tipe" disabled value={item.tipe}>
                {(Object.keys(TIPE_BOOKING_LABELS) as (keyof typeof TIPE_BOOKING_LABELS)[]).map((k) => (
                  <option key={k} value={k}>{TIPE_BOOKING_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="rs-catatan">Catatan</label>
              <input type="text" id="rs-catatan" disabled value={item.catatan || ""} />
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
