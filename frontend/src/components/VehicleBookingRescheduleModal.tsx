"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { getAvailableEndHours, getAvailableStartHours, isWholeDayAllowed, todayLocalDate } from "@/lib/bookingTime";
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
  const wholeDayAllowed = isWholeDayAllowed(item.tanggal);
  const isWholeDay = isFullDay && wholeDayAllowed;
  const starts = getAvailableStartHours(item.tanggal);
  let jamMulai = isWholeDay ? "07:00" : (item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai);
  if (item.tanggal === todayLocalDate()) {
    if (starts.length === 0) {
      jamMulai = "";
    } else if (jamMulai && !starts.includes(jamMulai)) {
      jamMulai = starts[0];
    }
  }
  const ends = getAvailableEndHours(jamMulai);
  let jamSelesai = isWholeDay ? "18:00" : (item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai);
  if (item.tanggal === todayLocalDate()) {
    if (ends.length === 0) {
      jamSelesai = "";
    } else if (jamSelesai && !ends.includes(jamSelesai)) {
      jamSelesai = ends[0];
    }
  }
  return {
    namaKendaraan: item.namaKendaraan,
    tanggal: item.tanggal,
    isWholeDay,
    jamMulai,
    jamSelesai,
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

  const availableStartHours = form ? getAvailableStartHours(form.tanggal) : [];
  const availableEndHours = form ? getAvailableEndHours(form.jamMulai) : [];
  const wholeDayAllowed = isWholeDayAllowed(form.tanggal);
  const isTodayPast = form ? (form.tanggal === todayLocalDate() && availableStartHours.length === 0) : false;

  function set<K extends keyof BookingKendaraanReschedulePayload>(key: K, value: BookingKendaraanReschedulePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setError("");
  }

  function handleTanggalChange(newDate: string) {
    setForm((f) => {
      if (!f) return f;
      const wholeDayAllowedForDate = isWholeDayAllowed(newDate);
      let newIsWholeDay = f.isWholeDay && wholeDayAllowedForDate;
      const starts = getAvailableStartHours(newDate);
      let newJamMulai = f.jamMulai;
      let newJamSelesai = f.jamSelesai;

      if (starts.length === 0) {
        newJamMulai = "";
        newJamSelesai = "";
      } else if (!newJamMulai || !starts.includes(newJamMulai)) {
        newJamMulai = starts[0];
        const ends = getAvailableEndHours(newJamMulai);
        newJamSelesai = ends[1] || ends[0] || "";
      } else {
        const ends = getAvailableEndHours(newJamMulai);
        if (!newJamSelesai || !ends.includes(newJamSelesai)) {
          newJamSelesai = ends[0] || "";
        }
      }

      if (newJamMulai === "07:00" && newJamSelesai === "18:00" && wholeDayAllowedForDate) {
        newIsWholeDay = true;
      }

      return {
        ...f,
        tanggal: newDate,
        isWholeDay: newIsWholeDay,
        jamMulai: newIsWholeDay ? "07:00" : newJamMulai,
        jamSelesai: newIsWholeDay ? "18:00" : newJamSelesai,
      };
    });
  }

  function handleJamMulaiChange(v: string) {
    const ends = getAvailableEndHours(v);
    setForm((f) => {
      if (!f) return f;
      let newEnd = f.jamSelesai;
      if (!newEnd || !ends.includes(newEnd)) {
        const sH = parseInt(v.slice(0, 2), 10);
        const prefEnd = `${String(Math.min(18, sH + 2)).padStart(2, "0")}:00`;
        newEnd = ends.includes(prefEnd) ? prefEnd : (ends[0] || "");
      }
      const autoWholeDay = v === "07:00" && newEnd === "18:00" && isWholeDayAllowed(f.tanggal);
      return { ...f, jamMulai: v, jamSelesai: newEnd, isWholeDay: autoWholeDay };
    });
  }

  function handleJamSelesaiChange(v: string) {
    setForm((f) => {
      if (!f) return f;
      const autoWholeDay = f.jamMulai === "07:00" && v === "18:00" && isWholeDayAllowed(f.tanggal);
      return { ...f, jamSelesai: v, isWholeDay: autoWholeDay };
    });
  }

  function toggleWholeDay() {
    setForm((f) => {
      if (!f) return f;
      if (!f.isWholeDay && !isWholeDayAllowed(f.tanggal)) return f;
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
    if (!form) return;
    if (form.tanggal < todayLocalDate()) {
      setError("Tanggal booking tidak boleh di masa lalu");
      return;
    }
    if (form.tanggal === todayLocalDate()) {
      if (form.isWholeDay && !isWholeDayAllowed(form.tanggal)) {
        setError("Booking sepanjang hari untuk hari ini hanya dapat dilakukan sebelum jam operasional dimulai (07:00)");
        return;
      }
      if (!form.isWholeDay) {
        if (!form.jamMulai || !form.jamSelesai) {
          setError("Jam mulai dan jam selesai wajib dipilih");
          return;
        }
        const starts = getAvailableStartHours(form.tanggal);
        if (!starts.includes(form.jamMulai)) {
          setError("Jam mulai booking sudah terlewat untuk hari ini");
          return;
        }
      }
    }
    if (!form.isWholeDay && form.jamMulai && form.jamSelesai && form.jamMulai >= form.jamSelesai) {
      setError("Jam selesai harus lebih akhir dari jam mulai");
      return;
    }
    if (!form.namaKendaraan) {
      setError("Kendaraan wajib dipilih");
      return;
    }
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
              <DateFilterPicker id="rk-tanggal" value={form.tanggal} onChange={handleTanggalChange} clearable={false} minDate={todayLocalDate()} />
            </div>
            <div className="field">
              <label htmlFor="rk-penumpang">Jumlah Penumpang <Lock className="field-lock-icon" width={12} height={12} /></label>
              <input type="text" id="rk-penumpang" disabled value={item.jumlahPenumpang ? `${item.jumlahPenumpang}` : ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-jam-mulai">Jam Mulai <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rk-jam-mulai"
                value={form.jamMulai || (form.isWholeDay ? "07:00" : undefined)}
                onChange={handleJamMulaiChange}
                options={form.isWholeDay ? ["07:00"] : (form.jamMulai && !availableStartHours.includes(form.jamMulai) ? [form.jamMulai, ...availableStartHours] : availableStartHours)}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "07:00" : (availableStartHours[0] || "Tidak ada slot")}
                disabled={form.isWholeDay || availableStartHours.length === 0}
                searchable={false}
              />
            </div>
            <div className="field">
              <label htmlFor="rk-jam-selesai">Jam Selesai <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <SearchableSelect
                id="rk-jam-selesai"
                value={form.jamSelesai || (form.isWholeDay ? "18:00" : undefined)}
                onChange={handleJamSelesaiChange}
                options={form.isWholeDay ? ["18:00"] : (form.jamSelesai && !availableEndHours.includes(form.jamSelesai) ? [form.jamSelesai, ...availableEndHours] : availableEndHours)}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "18:00" : (availableStartHours.length === 0 ? "Tidak ada slot" : (availableEndHours[0] || "Pilih jam"))}
                disabled={form.isWholeDay || availableStartHours.length === 0}
                searchable={false}
              />
            </div>
            <div className="field full">
              <label htmlFor="rk-sepanjang-hari">Durasi (Opsional) <Pencil className="field-edit-icon" width={12} height={12} /></label>
              <button
                type="button"
                id="rk-sepanjang-hari"
                className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}${!wholeDayAllowed ? " field-toggle-disabled" : ""}`}
                aria-pressed={form.isWholeDay}
                disabled={!wholeDayAllowed}
                onClick={toggleWholeDay}
                title={!wholeDayAllowed ? "Sepanjang hari hanya dapat dipilih sebelum jam 07:00 atau untuk hari berikutnya" : undefined}
              >
                <span className="field-toggle-box">
                  {form.isWholeDay && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </span>
                Sepanjang Hari
              </button>
              {!wholeDayAllowed && form.tanggal === todayLocalDate() && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  * Booking sepanjang hari untuk hari ini hanya dapat dilakukan sebelum jam operasional dimulai (07:00).
                </span>
              )}
            </div>
            {isTodayPast && (
              <div className="field full" style={{ color: "var(--danger, #dc2626)", fontSize: "0.85rem", padding: "8px 12px", background: "var(--danger-bg, #fef2f2)", borderRadius: "6px", border: "1px solid var(--danger-border, #fecaca)" }}>
                Jam operasional hari ini sudah selesai (07:00 - 18:00). Silakan pilih tanggal berikutnya untuk melakukan booking.
              </div>
            )}
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
