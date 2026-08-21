"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { todayLocalDate } from "@/lib/format";
import type { BookingRuangCreatePayload, Me, RecurrenceFrequency, RoomOption } from "@/lib/types";
import { RECURRENCE_FREQUENCY_LABELS, TIPE_BOOKING_LABELS } from "@/lib/constants";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
const RECURRENCE_OPTIONS: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];

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
    pic: "",
    namaRuang: "",
    additionalRooms: [],
    jumlahPeserta: 1,
    tanggal: todayLocalDate(),
    isWholeDay: false,
    jamMulai: "09:00",
    jamSelesai: "10:00",
    catatan: "",
    tipe: "INTERNAL",
    isRecurring: false,
    recurrenceFrequency: null,
    recurrenceEndDate: null,
    ...initial,
  };
}

export default function RoomBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const [form, setForm] = useState<BookingRuangCreatePayload>(emptyForm());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const [nomorPemesanan, setNomorPemesanan] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(emptyForm(initial));
      setError("");
      api.listRooms().then(setRooms).catch(() => setRooms([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextBookingNomor(form.tanggal)
      .then((r) => setNomorPemesanan(r.nomorPemesanan))
      .catch(() => setNomorPemesanan(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.tanggal]);

  if (!open) return null;

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin General Affair" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleAdditionalRoom(nama: string) {
    setForm((f) => {
      const current = f.additionalRooms || [];
      const next = current.includes(nama) ? current.filter((r) => r !== nama) : [...current, nama];
      return { ...f, additionalRooms: next };
    });
  }

  function toggleRecurring() {
    setForm((f) => ({
      ...f,
      isRecurring: !f.isRecurring,
      recurrenceFrequency: !f.isRecurring ? "WEEKLY" : null,
      recurrenceEndDate: !f.isRecurring ? f.tanggal : null,
    }));
  }

  function toggleWholeDay() {
    setForm((f) => ({
      ...f,
      isWholeDay: !f.isWholeDay,
      jamMulai: !f.isWholeDay ? "07:00" : f.jamMulai,
      jamSelesai: !f.isWholeDay ? "18:00" : f.jamSelesai,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await api.createBooking({
        ...form,
        pic: form.pic || null,
        catatan: form.catatan || null,
        jamMulai: form.isWholeDay ? null : form.jamMulai,
        jamSelesai: form.isWholeDay ? null : form.jamSelesai,
      });
      showToast(
        created.length > 1
          ? `${created.length} jadwal berulang berhasil disimpan sebagai Draft`
          : "Booking berhasil disimpan sebagai Draft"
      );
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
              <label htmlFor="f-nomor-pemesanan">Nomor Pemesanan Ruangan</label>
              <input type="text" id="f-nomor-pemesanan" disabled value={nomorPemesanan} />
            </div>
            <div className="field full">
              <label htmlFor="f-nama-kegiatan">Nama Kegiatan</label>
              <input type="text" id="f-nama-kegiatan" required placeholder="Contoh: Technical Meeting EPC" value={form.namaKegiatan} onChange={(e) => set("namaKegiatan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-pic">PIC</label>
              <input type="text" id="f-pic" required placeholder="Nama penanggung jawab kegiatan" value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-tanggal">Tanggal</label>
              <input type="date" id="f-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-peserta">Jumlah Peserta</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="f-peserta"
                required
                value={form.jumlahPeserta === 0 ? "" : String(form.jumlahPeserta)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahPeserta", digits === "" ? 0 : Number(digits));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="f-jam-mulai">Jam Mulai</label>
              <select id="f-jam-mulai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-jam-selesai">Jam Selesai</label>
              <select id="f-jam-selesai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)}>
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
            <div className="field full">
              <label htmlFor="f-ruang">Ruangan</label>
              <select id="f-ruang" required value={form.namaRuang} onChange={(e) => set("namaRuang", e.target.value)}>
                <option value="" disabled>Pilih ruang</option>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama}</option>
                ))}
              </select>
            </div>
            {rooms.filter((r) => r.nama !== form.namaRuang).length > 0 && (
              <div className="field full">
                <label>Ruangan Tambahan (opsional)</label>
                <div className="room-chip-row">
                  {rooms.filter((r) => r.nama !== form.namaRuang).map((r) => {
                    const active = (form.additionalRooms || []).includes(r.nama);
                    return (
                      <button
                        type="button"
                        key={r.nama}
                        className={`room-chip${active ? " room-chip-active" : ""}`}
                        aria-pressed={active}
                        onClick={() => toggleAdditionalRoom(r.nama)}
                      >
                        {r.nama}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor="f-tipe">Tipe Booking</label>
              <select id="f-tipe" value={form.tipe} onChange={(e) => set("tipe", e.target.value as BookingRuangCreatePayload["tipe"])}>
                {(Object.keys(TIPE_BOOKING_LABELS) as (keyof typeof TIPE_BOOKING_LABELS)[]).map((k) => (
                  <option key={k} value={k}>{TIPE_BOOKING_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <button
                type="button"
                className={`field-toggle${form.isRecurring ? " field-toggle-active" : ""}`}
                aria-pressed={form.isRecurring}
                onClick={toggleRecurring}
              >
                {form.isRecurring && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
                Booking Berulang
              </button>
            </div>
            {form.isRecurring && (
              <>
                <div className="field">
                  <label htmlFor="f-recurrence-frequency">Frekuensi</label>
                  <select
                    id="f-recurrence-frequency"
                    required
                    value={form.recurrenceFrequency || ""}
                    onChange={(e) => set("recurrenceFrequency", e.target.value as RecurrenceFrequency)}
                  >
                    {RECURRENCE_OPTIONS.map((freq) => (
                      <option key={freq} value={freq}>{RECURRENCE_FREQUENCY_LABELS[freq]}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-recurrence-end">Berulang Sampai Tanggal</label>
                  <input
                    type="date"
                    id="f-recurrence-end"
                    required
                    min={form.tanggal}
                    value={form.recurrenceEndDate || ""}
                    onChange={(e) => set("recurrenceEndDate", e.target.value)}
                  />
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
