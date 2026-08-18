"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BookingRuangCreatePayload, Me, RoomOption } from "@/lib/types";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
  initial?: Partial<BookingRuangCreatePayload>;
}

function emptyForm(initial?: Partial<BookingRuangCreatePayload>): BookingRuangCreatePayload {
  return {
    namaKegiatan: "",
    namaRuang: "",
    jumlahPeserta: 1,
    tanggal: new Date().toISOString().slice(0, 10),
    isWholeDay: false,
    jamMulai: "09:00",
    jamSelesai: "10:00",
    catatan: "",
    ...initial,
  };
}

export default function RoomBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const [form, setForm] = useState<BookingRuangCreatePayload>(emptyForm());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(emptyForm(initial));
      setError("");
      api.listRooms().then(setRooms).catch(() => setRooms([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const unitName = me.departemen || me.divisi || "";

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createBooking({
        ...form,
        catatan: form.catatan || null,
        jamMulai: form.isWholeDay ? null : form.jamMulai,
        jamSelesai: form.isWholeDay ? null : form.jamSelesai,
      });
      showToast("Booking berhasil disimpan sebagai Draft");
      onClose();
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Form Booking Ruang Meeting {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="f-nama-kegiatan">Nama Kegiatan</label>
              <input type="text" id="f-nama-kegiatan" required placeholder="Contoh: Rapat Koordinasi Bulanan" value={form.namaKegiatan} onChange={(e) => set("namaKegiatan", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-ruang">Ruang</label>
              <select id="f-ruang" required value={form.namaRuang} onChange={(e) => set("namaRuang", e.target.value)}>
                <option value="" disabled>Pilih ruang</option>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-peserta">Jumlah Peserta</label>
              <input type="number" id="f-peserta" min={1} required value={form.jumlahPeserta} onChange={(e) => set("jumlahPeserta", Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="f-tanggal">Tanggal</label>
              <input type="date" id="f-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-whole-day" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="f-whole-day" checked={form.isWholeDay} onChange={(e) => set("isWholeDay", e.target.checked)} />
                Sehari Penuh
              </label>
            </div>
            {!form.isWholeDay && (
              <>
                <div className="field">
                  <label htmlFor="f-jam-mulai">Jam Mulai</label>
                  <input type="time" id="f-jam-mulai" required value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="f-jam-selesai">Jam Selesai</label>
                  <input type="time" id="f-jam-selesai" required value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)} />
                </div>
              </>
            )}
            <div className="field full">
              <label htmlFor="f-catatan">Catatan</label>
              <input type="text" id="f-catatan" placeholder="Opsional, contoh: butuh proyektor" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
