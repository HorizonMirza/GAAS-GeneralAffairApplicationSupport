"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  isKendaraanEditableByOrigin,
  isKendaraanGaActionable,
  kendaraanOriginActorLabel,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { getAvailableStartHours, getAvailableEndHours, isWholeDayAllowed, todayLocalDate } from "@/lib/bookingTime";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingKendaraan, BookingKendaraanCreatePayload, Me, VehicleOption } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import type { RejectType } from "./RejectModal";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: BookingKendaraan | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

function toFormFields(item: BookingKendaraan): BookingKendaraanCreatePayload {
  const isFullDay = item.isWholeDay || (item.jamMulai?.slice(0, 5) === "07:00" && item.jamSelesai?.slice(0, 5) === "18:00");
  return {
    keperluan: item.keperluan,
    pic: item.pic || "",
    noTeleponPic: item.noTeleponPic || "",
    namaKendaraan: item.namaKendaraan,
    jumlahPenumpang: item.jumlahPenumpang,
    tanggal: item.tanggal,
    isWholeDay: isFullDay,
    // The API returns TimeOnly values as "HH:mm:ss", but the Jam Mulai/Selesai <select> options
    // are "HH:mm" - without slicing, the value never matches any option and the browser silently
    // falls back to displaying the first option instead of the item's real time.
    jamMulai: isFullDay ? "07:00" : (item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai),
    jamSelesai: isFullDay ? "18:00" : (item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai),
    catatan: item.catatan || "",
  };
}

export default function VehicleBookingDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<BookingKendaraanCreatePayload | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}-${mode}`);

  // useLayoutEffect (not useEffect) - form starts as null and is only hydrated here, so the very
  // first time this modal is ever opened in a session it renders nothing this pass (see the
  // `!form` check below) and formRef never attaches to a real <form>. A plain useEffect runs
  // after paint with the same open/item/mode trigger useAutofocusFirstField already used on that
  // empty pass, so it never gets a second chance once the form actually appears. useLayoutEffect's
  // setForm call instead forces a synchronous re-render before paint, so by the time
  // useAutofocusFirstField's (deferred) effect runs, formRef already points at the real form.
  useLayoutEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    setBusy(false);
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isKendaraanEditableByOrigin(item, me);
  // Mirrors RequireL1ActorAsync on the backend: the approver's own unit must match the booking's
  // unit, not just their role - bookings are visible across every unit here too, so without this
  // check the Approve/Reject buttons would show up for a booking that belongs to a completely
  // different Departemen/Divisi and only fail with a 403 once clicked.
  const l1UnitMatches = item.departemen
    ? me.role === "APPROVAL_DEPARTEMEN" && me.departemen === item.departemen
    : me.role === "APPROVAL_DIVISI" && me.divisi === item.divisi;
  const canL1Act = !isEdit && (me.role === "SUPER_ADMIN" || l1UnitMatches) && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && (me.role === "ADMIN_GA" || me.role === "SUPER_ADMIN") && isKendaraanGaActionable(item);
  const canGaApprovalAct = !isEdit && (me.role === "APPROVAL_GA" || me.role === "SUPER_ADMIN") && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);

  const selectedVehicle = vehicles.find((v) => v.nama === form.namaKendaraan);
  // See VehicleBookingFormModal's matching comment - falls back to the largest capacity across
  // the real fleet (never a made-up number) while vehicles hasn't loaded yet or briefly doesn't
  // match, not just whenever there happens to be no selectedVehicle.
  const maxFleetCapacity = vehicles.length > 0 ? Math.max(...vehicles.map((v) => v.kapasitas)) : 99;
  const penumpangCap = selectedVehicle?.kapasitas ?? maxFleetCapacity;

  function set<K extends keyof BookingKendaraanCreatePayload>(key: K, value: BookingKendaraanCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setError("");
  }

  function handleTanggalChange(newDate: string) {
    const starts = getAvailableStartHours(newDate);
    setForm((f) => {
      if (!f) return f;
      let newJamMulai = f.jamMulai;
      let newJamSelesai = f.jamSelesai;
      let newIsWholeDay = f.isWholeDay;

      if (!isWholeDayAllowed(newDate)) {
        newIsWholeDay = false;
      }

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

      if (newJamMulai === "07:00" && newJamSelesai === "18:00" && isWholeDayAllowed(newDate)) {
        newIsWholeDay = true;
      } else if (newJamMulai !== "07:00" || newJamSelesai !== "18:00") {
        newIsWholeDay = false;
      }

      return {
        ...f,
        tanggal: newDate,
        isWholeDay: newIsWholeDay,
        jamMulai: newJamMulai,
        jamSelesai: newJamSelesai,
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

  async function handleSubmitDraft() {
    setBusy(true);
    try {
      await api.submitKendaraanBooking(item!.id);
      showToast("Booking berhasil dikirim untuk approval");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function handleApproveL1() {
    onClose();
    try {
      await api.approveKendaraanL1(item!.id);
      showToast("Booking berhasil di-approve, diteruskan ke Admin GA");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveKendaraanGa(item!.id);
      showToast("Booking berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      await api.approveKendaraanGaApproval(item!.id);
      showToast("Booking berhasil dikonfirmasi");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form && form.tanggal < todayLocalDate()) {
      setError("Tanggal booking tidak boleh di masa lalu");
      return;
    }
    if (form && form.tanggal === todayLocalDate()) {
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
    if (!form?.keperluan?.trim()) {
      setError("Nama Kegiatan wajib diisi");
      return;
    }
    if (!form?.namaKendaraan) {
      setError("Kendaraan wajib dipilih");
      return;
    }
    setBusy(true);
    try {
      await api.updateKendaraanBooking(item!.id, {
        ...form!,
        jamMulai: form!.isWholeDay ? "07:00" : form!.jamMulai,
        jamSelesai: form!.isWholeDay ? "18:00" : form!.jamSelesai,
        pic: form!.pic || null,
        noTeleponPic: form!.noTeleponPic || null,
        catatan: form!.catatan || null,
      });
      showToast("Booking berhasil diperbarui");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const availableStartHours = form ? getAvailableStartHours(form.tanggal) : [];
  const availableEndHours = form ? getAvailableEndHours(form.jamMulai) : [];
  const wholeDayAllowed = form ? isWholeDayAllowed(form.tanggal) : true;
  const isTodayPast = form ? (form.tanggal === todayLocalDate() && availableStartHours.length === 0) : false;

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? "Form Booking Kendaraan" : "Detail Booking Kendaraan"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="bk-nomor-pemesanan">Nomor Pesanan Kendaraan</label>
              <input type="text" id="bk-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="bk-keperluan">Nama Kegiatan</label>
              <input type="text" id="bk-keperluan" required disabled={!isEdit} maxLength={150} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bk-pic">Nama PIC</label>
              <input type="text" id="bk-pic" required disabled={!isEdit} maxLength={50} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bk-telepon-pic">No. Telepon PIC</label>
              <input
                type="text"
                inputMode="tel"
                id="bk-telepon-pic"
                required
                disabled={!isEdit}
                maxLength={20}
                value={form.noTeleponPic || ""}
                onChange={(e) => set("noTeleponPic", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field">
              <label htmlFor="bk-tanggal">Tanggal</label>
              <DateFilterPicker
                id="bk-tanggal"
                disabled={!isEdit}
                clearable={false}
                value={form.tanggal}
                onChange={handleTanggalChange}
                minDate={todayLocalDate()}
                disableWeekends
              />
            </div>
            <div className="field">
              <label htmlFor="bk-penumpang">Jumlah Penumpang</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="bk-penumpang"
                required
                disabled={!isEdit}
                value={form.jumlahPenumpang === 0 ? "" : String(form.jumlahPenumpang)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), penumpangCap);
                  set("jumlahPenumpang", parsed);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="bk-jam-mulai">Jam Mulai</label>
              <SearchableSelect
                id="bk-jam-mulai"
                value={form.jamMulai || (form.isWholeDay ? "07:00" : undefined)}
                onChange={handleJamMulaiChange}
                options={isEdit ? (form.jamMulai && !availableStartHours.includes(form.jamMulai) ? [form.jamMulai, ...availableStartHours] : availableStartHours) : (form.isWholeDay ? ["07:00"] : (form.jamMulai ? [form.jamMulai] : HOUR_OPTIONS))}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "07:00" : (availableStartHours[0] || "Tidak ada slot")}
                disabled={!isEdit || form.isWholeDay || availableStartHours.length === 0}
                searchable={false}
              />
            </div>
            <div className="field">
              <label htmlFor="bk-jam-selesai">Jam Selesai</label>
              <SearchableSelect
                id="bk-jam-selesai"
                value={form.jamSelesai || (form.isWholeDay ? "18:00" : undefined)}
                onChange={handleJamSelesaiChange}
                options={isEdit ? (form.jamSelesai && !availableEndHours.includes(form.jamSelesai) ? [form.jamSelesai, ...availableEndHours] : availableEndHours) : (form.isWholeDay ? ["18:00"] : (form.jamSelesai ? [form.jamSelesai] : HOUR_OPTIONS))}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "18:00" : (availableStartHours.length === 0 ? "Tidak ada slot" : (availableEndHours[0] || "Pilih jam"))}
                disabled={!isEdit || form.isWholeDay || availableStartHours.length === 0}
                searchable={false}
              />
            </div>
            {(isEdit || form.isWholeDay) && (
              <div className="field full">
                <label htmlFor="bk-sepanjang-hari">{isEdit ? "Durasi (Opsional)" : "Durasi"}</label>
                <button
                  type="button"
                  id="bk-sepanjang-hari"
                  className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}${!isEdit || !wholeDayAllowed ? " field-toggle-disabled" : ""}`}
                  aria-pressed={form.isWholeDay}
                  disabled={!isEdit || !wholeDayAllowed}
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
                {isEdit && !wholeDayAllowed && form.tanggal === todayLocalDate() && (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    * Booking sepanjang hari untuk hari ini hanya dapat dilakukan sebelum jam operasional dimulai (07:00).
                  </span>
                )}
              </div>
            )}
            {isEdit && isTodayPast && (
              <div className="field full" style={{ color: "var(--danger, #dc2626)", fontSize: "0.85rem", padding: "8px 12px", background: "var(--danger-bg, #fef2f2)", borderRadius: "6px", border: "1px solid var(--danger-border, #fecaca)" }}>
                Jam operasional hari ini sudah selesai (07:00 - 18:00). Silakan pilih tanggal berikutnya untuk melakukan booking.
              </div>
            )}
            <div className="field full">
              <label htmlFor="bk-kendaraan">Kendaraan</label>
              <SearchableSelect
                id="bk-kendaraan"
                disabled={!isEdit}
                value={form.namaKendaraan || undefined}
                onChange={(v) => set("namaKendaraan", v)}
                options={vehicles.map((v) => v.nama)}
                getLabel={(nama) => {
                  const v = vehicles.find((x) => x.nama === nama);
                  return v ? `${v.nama} - ${v.platNomor} - Pengemudi: ${v.supir}` : nama;
                }}
                placeholder="Pilih Kendaraan"
              />
            </div>
            <div className="field full">
              <label htmlFor="bk-supir">Nama Pengemudi</label>
              <SearchableSelect
                id="bk-supir"
                disabled={!isEdit}
                value={selectedVehicle?.supir ?? item.supir ?? undefined}
                onChange={(supir) => {
                  const matched = vehicles.find((v) => v.supir === supir);
                  if (matched) set("namaKendaraan", matched.nama);
                }}
                options={vehicles.map((v) => v.supir)}
                getLabel={(supir) => {
                  const v = vehicles.find((x) => x.supir === supir);
                  return v ? `${v.supir} - Kendaraan: ${v.nama}` : supir;
                }}
                placeholder="Pilih Nama Pengemudi"
              />
            </div>
            <div className="field full">
              <label htmlFor="bk-catatan">Catatan</label>
              <input type="text" id="bk-catatan" disabled={!isEdit} maxLength={255} placeholder={isEdit ? "Contoh: Penjemputan di lobby utama" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Diajukan:</strong> {formatDateTime(item.createdAt)}
            </div>
          )}

          {item.rejectReason && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Catatan Penolakan:</strong> {item.rejectReason}
            </div>
          )}

          {error && <div className="error-text">{error}</div>}
          {(canSubmitDraft || canL1Act || canGaAct || canGaApprovalAct || isEdit) && (
            <div className="modal-actions">
              {canSubmitDraft && (
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft} disabled={busy}>Submit</button>
              )}
              {canL1Act && (
                <>
                  <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "kendaraan-l1", kendaraanOriginActorLabel(item)); }}>Reject</button>
                  <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>Approve</button>
                </>
              )}
              {canGaAct && (
                <>
                  <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "kendaraan-ga", kendaraanOriginActorLabel(item)); }}>Reject</button>
                  <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>Approve</button>
                </>
              )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "kendaraan-ga-approval", kendaraanOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGaApproval}>Approve</button>
              </>
            )}
            {isEdit && (
              <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
            )}
          </div>
        )}
        </form>
      </div>
    </ModalOverlay>
  );
}
