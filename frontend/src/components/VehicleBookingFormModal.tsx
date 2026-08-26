"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import type { BookingKendaraanCreatePayload, Me, VehicleOption } from "@/lib/types";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
  initial?: Partial<BookingKendaraanCreatePayload>;
}

function emptyForm(initial?: Partial<BookingKendaraanCreatePayload>): BookingKendaraanCreatePayload {
  return {
    keperluan: "",
    pic: "",
    namaKendaraan: "",
    jumlahPenumpang: 1,
    tanggal: todayLocalDate(),
    isWholeDay: false,
    jamMulai: "07:00",
    jamSelesai: "09:00",
    catatan: "",
    ...initial,
  };
}

export default function VehicleBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<BookingKendaraanCreatePayload>(emptyForm());
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [error, setError] = useState("");
  const [nomorPemesanan, setNomorPemesanan] = useState("");
  const { showToast } = useToast();

  const isGaActor = me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";

  useEffect(() => {
    if (open) {
      setForm(emptyForm(initial));
      setError("");
      api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextKendaraanNomor(form.tanggal, isGaActor ? form.divisi : undefined)
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

  const selectedVehicle = vehicles.find((v) => v.nama === form.namaKendaraan);

  function set<K extends keyof BookingKendaraanCreatePayload>(key: K, value: BookingKendaraanCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
      await api.createKendaraanBooking({
        ...form,
        pic: form.pic || null,
        catatan: form.catatan || null,
        jamMulai: form.isWholeDay ? null : form.jamMulai,
        jamSelesai: form.isWholeDay ? null : form.jamSelesai,
      });
      showToast("Booking kendaraan berhasil disimpan sebagai Draft");
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
          <h3>Form Booking Kendaraan {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fk-nomor-pemesanan">Nomor Pesanan Kendaraan</label>
              <input type="text" id="fk-nomor-pemesanan" disabled value={nomorPemesanan} />
            </div>
            {isGaActor && (
              <>
                <div className="field">
                  <label htmlFor="fk-divisi">Divisi</label>
                  <select
                    id="fk-divisi"
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
                  <label htmlFor="fk-departemen">Departemen</label>
                  <select
                    id="fk-departemen"
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
              <label htmlFor="fk-keperluan">Keperluan</label>
              <input type="text" id="fk-keperluan" required placeholder="Contoh: Kunjungan ke PGSOL Bogor" value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="fk-pic">PIC</label>
              <input type="text" id="fk-pic" required placeholder="Nama penanggung jawab perjalanan" value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fk-tanggal">Tanggal</label>
              <input type="date" id="fk-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fk-penumpang">Jumlah Penumpang{selectedVehicle ? ` (maks ${selectedVehicle.kapasitas})` : ""}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="fk-penumpang"
                required
                value={form.jumlahPenumpang === 0 ? "" : String(form.jumlahPenumpang)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  const cap = selectedVehicle?.kapasitas ?? 99;
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), cap);
                  set("jumlahPenumpang", parsed);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="fk-jam-mulai">Jam Mulai</label>
              <select id="fk-jam-mulai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fk-jam-selesai">Jam Selesai</label>
              <select id="fk-jam-selesai" required={!form.isWholeDay} disabled={form.isWholeDay} value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="fk-sepanjang-hari">Durasi (Opsional)</label>
              <button
                type="button"
                id="fk-sepanjang-hari"
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
              <label htmlFor="fk-kendaraan">Kendaraan</label>
              <select id="fk-kendaraan" required value={form.namaKendaraan} onChange={(e) => set("namaKendaraan", e.target.value)}>
                <option value="" disabled>Pilih kendaraan</option>
                {vehicles.map((v) => (
                  <option key={v.nama} value={v.nama}>{v.nama} - {v.platNomor} - Supir: {v.supir}</option>
                ))}
              </select>
            </div>
            {selectedVehicle && (
              <div className="field full">
                <label htmlFor="fk-supir">Supir</label>
                <input type="text" id="fk-supir" disabled value={selectedVehicle.supir} />
              </div>
            )}
            <div className="field full">
              <label htmlFor="fk-catatan">Catatan</label>
              <input type="text" id="fk-catatan" placeholder="Contoh: Segera di Approve" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
