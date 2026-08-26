"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import type { BookingRuangCreatePayload, Me, RecurrenceFrequency, RoomOption } from "@/lib/types";
import { MAX_JUMLAH_PESERTA, RECURRENCE_FREQUENCY_LABELS, TIPE_BOOKING_LABELS } from "@/lib/constants";
import RoomMultiSelect from "./RoomMultiSelect";
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
    jamMulai: "07:00",
    jamSelesai: "09:00",
    catatan: "",
    tipe: "INTERNAL",
    isRecurring: false,
    recurrenceFrequency: null,
    recurrenceEndDate: null,
    ...initial,
  };
}

export default function RoomBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<BookingRuangCreatePayload>(emptyForm());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const [nomorPemesanan, setNomorPemesanan] = useState("");
  const { showToast } = useToast();

  const isGaActor = me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";

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
      .nextBookingNomor(form.tanggal, isGaActor ? form.divisi : undefined)
      .then((r) => setNomorPemesanan(r.nomorPemesanan))
      .catch(() => setNomorPemesanan(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.tanggal, form.divisi]);

  if (!open) return null;

  const departemenOptions = form.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === form.divisi)?.departemen || []
    : [];

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin General Affair" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Switching the primary room to one already picked as an additional room would otherwise leave
  // a stale duplicate in additionalRooms - invisible in the UI (its chip disappears once it
  // matches namaRuang) but still sent to the backend, which rejects the save with a confusing
  // "Ruang tambahan tidak boleh sama dengan ruang utama" error the user can't see the cause of.
  function setNamaRuang(nama: string) {
    setForm((f) => ({ ...f, namaRuang: nama, additionalRooms: (f.additionalRooms || []).filter((r) => r !== nama) }));
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
              <label htmlFor="f-nomor-pemesanan">Nomor Pesanan Ruangan</label>
              <input type="text" id="f-nomor-pemesanan" disabled value={nomorPemesanan} />
            </div>
            {isGaActor && (
              <>
                <div className="field">
                  <label htmlFor="f-divisi">Divisi</label>
                  <select
                    id="f-divisi"
                    required
                    value={form.divisi || ""}
                    onChange={(e) => setForm((f) => ({ ...f, divisi: e.target.value || undefined, departemen: undefined }))}
                  >
                    <option value="" disabled>Pilih Divisi</option>
                    {(orgStructure?.divisi || []).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-departemen">Departemen</label>
                  <select
                    id="f-departemen"
                    required
                    disabled={!form.divisi}
                    value={form.departemen || ""}
                    onChange={(e) => set("departemen", e.target.value || undefined)}
                  >
                    <option value="" disabled>Pilih Departemen</option>
                    {departemenOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
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
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), MAX_JUMLAH_PESERTA);
                  set("jumlahPeserta", parsed);
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
              <label htmlFor="f-sepanjang-hari">Durasi (Opsional)</label>
              <button
                type="button"
                id="f-sepanjang-hari"
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
              <label htmlFor="f-ruang">Ruangan</label>
              <select id="f-ruang" required value={form.namaRuang} onChange={(e) => setNamaRuang(e.target.value)}>
                <option value="" disabled>Pilih ruang</option>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama} ({r.kapasitas} orang)</option>
                ))}
              </select>
            </div>
            {rooms.filter((r) => r.nama !== form.namaRuang).length > 0 && (
              <div className="field full">
                <label htmlFor="f-ruang-tambahan">Ruangan Tambahan (Opsional)</label>
                <RoomMultiSelect
                  id="f-ruang-tambahan"
                  rooms={rooms}
                  excludeRoom={form.namaRuang}
                  selected={form.additionalRooms || []}
                  onChange={(next) => set("additionalRooms", next)}
                />
              </div>
            )}
            <div className="field full">
              <label htmlFor="f-tipe">Tipe</label>
              <select id="f-tipe" value={form.tipe} onChange={(e) => set("tipe", e.target.value as BookingRuangCreatePayload["tipe"])}>
                {(Object.keys(TIPE_BOOKING_LABELS) as (keyof typeof TIPE_BOOKING_LABELS)[]).map((k) => (
                  <option key={k} value={k}>{TIPE_BOOKING_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="f-booking-berulang">Pengulangan (Opsional)</label>
              <button
                type="button"
                id="f-booking-berulang"
                className={`field-toggle${form.isRecurring ? " field-toggle-active" : ""}`}
                aria-pressed={form.isRecurring}
                onClick={toggleRecurring}
              >
                <span className="field-toggle-box">
                  {form.isRecurring && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </span>
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
              <input type="text" id="f-catatan" placeholder="Contoh: Segera di Approve" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
