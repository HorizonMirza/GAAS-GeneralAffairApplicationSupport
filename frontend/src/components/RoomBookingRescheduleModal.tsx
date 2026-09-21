"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { MAX_JUMLAH_PESERTA, TIPE_BOOKING_LABELS } from "@/lib/constants";
import { formatDateTime, todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingRuang, BookingRuangReschedulePayload, RoomOption } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import RoomMultiSelect from "./RoomMultiSelect";
import SearchableSelect from "./SearchableSelect";
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
    jumlahPeserta: item.jumlahPeserta,
    isWholeDay: item.isWholeDay,
    // The API returns TimeOnly values as "HH:mm:ss", but the Jam Mulai/Selesai <select> options
    // are "HH:mm" - without slicing, the value never matches any option and the browser silently
    // falls back to displaying the first option (07:00) instead of the item's real time.
    jamMulai: item.isWholeDay ? "07:00" : (item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai),
    jamSelesai: item.isWholeDay ? "18:00" : (item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai),
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
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}`);

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
    if (!form?.jumlahPeserta || form.jumlahPeserta <= 0) {
      setError("Jumlah peserta minimal 1 orang");
      return;
    }
    setBusy(true);
    try {
      await api.rescheduleBooking(item!.id, {
        ...form!,
        jamMulai: form!.isWholeDay ? "07:00" : form!.jamMulai,
        jamSelesai: form!.isWholeDay ? "18:00" : form!.jamSelesai,
      });
      showToast("Ruang/jadwal booking berhasil dipindahkan");
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
              <label htmlFor="rs-nomor-pemesanan">Nomor Pesanan Ruangan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rs-nomor-pemesanan" disabled value={item.nomorPemesanan || "-"} />
            </div>
            <div className="field full">
              <label htmlFor="rs-nama-kegiatan">Nama Kegiatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rs-nama-kegiatan" disabled value={item.namaKegiatan} />
            </div>
            <div className="field">
              <label htmlFor="rs-nama-pic">Nama PIC <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rs-nama-pic" disabled value={item.pic || "-"} />
            </div>
            <div className="field">
              <label htmlFor="rs-no-telepon">No. Telepon PIC <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rs-no-telepon" disabled value={item.noTeleponPic || "-"} />
            </div>
            <div className="field">
              <label htmlFor="rs-tanggal">Tanggal <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <DateFilterPicker id="rs-tanggal" clearable={false} value={form.tanggal} onChange={(v) => set("tanggal", v)} minDate={todayLocalDate()} />
            </div>
            <div className="field">
              <label htmlFor="rs-peserta">Jumlah Peserta <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="rs-peserta"
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
              <label htmlFor="rs-jam-mulai">Jam Mulai <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rs-jam-mulai"
                value={form.jamMulai || (form.isWholeDay ? "07:00" : undefined)}
                onChange={(v) => set("jamMulai", v)}
                options={form.isWholeDay ? ["07:00"] : HOUR_OPTIONS}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "07:00" : "Pilih jam"}
                disabled={form.isWholeDay}
              />
            </div>
            <div className="field">
              <label htmlFor="rs-jam-selesai">Jam Selesai <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rs-jam-selesai"
                value={form.jamSelesai || (form.isWholeDay ? "18:00" : undefined)}
                onChange={(v) => set("jamSelesai", v)}
                options={form.isWholeDay ? ["18:00"] : HOUR_OPTIONS}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "18:00" : "Pilih jam"}
                disabled={form.isWholeDay}
              />
            </div>
            <div className="field full">
              <label htmlFor="rs-sepanjang-hari">Durasi (Opsional) <Pencil className="field-edit-icon" width={12} height={12} /></label>
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
              <label htmlFor="rs-ruang">Ruangan <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rs-ruang"
                value={form.namaRuang || undefined}
                onChange={setNamaRuang}
                options={rooms.map((r) => r.nama)}
                placeholder="Pilih Ruangan"
              />
            </div>
            {rooms.filter((r) => r.nama !== form.namaRuang).length > 0 && (
              <div className="field full">
                <label htmlFor="rs-ruang-tambahan">Ruangan Tambahan (Opsional) <Pencil className="field-edit-icon" width={12} height={12} /></label>
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
              <label htmlFor="rs-tipe">Tipe <Lock className="field-lock-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rs-tipe"
                value={item.tipe}
                onChange={() => {}}
                options={Object.keys(TIPE_BOOKING_LABELS)}
                getLabel={(v) => TIPE_BOOKING_LABELS[v as keyof typeof TIPE_BOOKING_LABELS] || v}
                placeholder={TIPE_BOOKING_LABELS[item.tipe]}
                disabled
              />
            </div>
            <div className="field full">
              <label htmlFor="rs-catatan">Catatan <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rs-catatan" disabled value={item.catatan || ""} />
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
