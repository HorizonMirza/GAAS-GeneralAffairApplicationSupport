"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingRuangCreatePayload, Me, RecurrenceFrequency, Role, RoomOption } from "@/lib/types";
import { MAX_JUMLAH_PESERTA, RECURRENCE_FREQUENCY_LABELS, ROLE_LABEL, TIPE_BOOKING_LABELS } from "@/lib/constants";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import RoomMultiSelect from "./RoomMultiSelect";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

import {
  getAvailableStartHours,
  getAvailableEndHours,
  isWholeDayAllowed,
  getDefaultBookingSlot,
} from "@/lib/bookingTime";

const RECURRENCE_OPTIONS: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];

// The 6 roles a real actor can create a Room Booking as (BookingRuangController.OriginRoles minus
// KPU/SUPER_ADMIN, which never create their own) - what Super Admin picks from in "Bertindak
// Sebagai Role" to declare which origin identity a new booking is created under.
const AS_ROLE_OPTIONS: Role[] = ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"];

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
  initial?: Partial<BookingRuangCreatePayload>;
}

function emptyForm(initial?: Partial<BookingRuangCreatePayload>): BookingRuangCreatePayload {
  const slot = getDefaultBookingSlot(initial?.tanggal);
  const base: BookingRuangCreatePayload = {
    namaKegiatan: "",
    pic: "",
    noTeleponPic: "",
    namaRuang: "",
    additionalRooms: [],
    jumlahPeserta: 1,
    tanggal: slot.tanggal,
    isWholeDay: false,
    jamMulai: slot.jamMulai,
    jamSelesai: slot.jamSelesai,
    catatan: "",
    tipe: undefined,
    isRecurring: false,
    recurrenceFrequency: null,
    recurrenceEndDate: null,
  };

  const merged = { ...base, ...initial };
  if (merged.jamMulai) merged.jamMulai = merged.jamMulai.slice(0, 5);
  if (merged.jamSelesai) merged.jamSelesai = merged.jamSelesai.slice(0, 5);

  // Sanitize merged values to prevent past slots if date is today
  const starts = getAvailableStartHours(merged.tanggal);
  if (!isWholeDayAllowed(merged.tanggal)) {
    merged.isWholeDay = false;
  }
  if (merged.tanggal === todayLocalDate()) {
    if (starts.length === 0) {
      merged.jamMulai = "";
      merged.jamSelesai = "";
    } else if (!merged.jamMulai || !starts.includes(merged.jamMulai)) {
      merged.jamMulai = starts[0];
      const ends = getAvailableEndHours(merged.jamMulai);
      merged.jamSelesai = ends[1] || ends[0] || "";
    } else {
      const ends = getAvailableEndHours(merged.jamMulai);
      if (!merged.jamSelesai || !ends.includes(merged.jamSelesai)) {
        merged.jamSelesai = ends[0] || "";
      }
    }
  }

  if (merged.jamMulai === "07:00" && merged.jamSelesai === "18:00" && isWholeDayAllowed(merged.tanggal)) {
    merged.isWholeDay = true;
  }

  return merged;
}

export default function RoomBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<BookingRuangCreatePayload>(emptyForm());
  const [asRole, setAsRole] = useState<Role | "">("");
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nomorPemesanan, setNomorPemesanan] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  const isSuperAdmin = me.role === "SUPER_ADMIN";
  const isGaActor = me.role === "ADMIN_GA" || me.role === "APPROVAL_GA" || me.role === "SUPER_ADMIN";
  // Super Admin's chosen AsRole drives which org fields apply, mirroring that role's own real
  // constraints (see backend AsRoleValidationError) - GA roles need neither, Divisi roles need
  // only Divisi, Departemen roles need both.
  const asRoleNeedsDivisi = isSuperAdmin && asRole !== "" && asRole !== "ADMIN_GA" && asRole !== "APPROVAL_GA";
  const asRoleNeedsDepartemen = isSuperAdmin && (asRole === "ADMIN_DEPARTEMEN" || asRole === "APPROVAL_DEPARTEMEN");

  useEffect(() => {
    if (open) {
      setForm(emptyForm(initial));
      setAsRole("");
      setError("");
      api.listRooms().then(setRooms).catch(() => setRooms([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextBookingNomor(form.tanggal, isGaActor ? form.divisi : undefined, isSuperAdmin ? asRole || undefined : undefined)
      .then((r) => setNomorPemesanan(r.nomorPemesanan))
      .catch(() => setNomorPemesanan(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.tanggal, form.divisi, asRole]);

  if (!open) return null;

  // Flattened once so both directions of the Divisi<->Departemen sync below can look either one
  // up without re-walking direktoratTree per keystroke.
  const allDivisiNodes = orgStructure?.direktoratTree.flatMap((d) => d.divisi) || [];
  const departemenOptions = form.divisi
    ? allDivisiNodes.find((v) => v.nama === form.divisi)?.departemen || []
    : orgStructure?.departemen || [];

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin GA" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  const availableStartHours = getAvailableStartHours(form.tanggal);
  const availableEndHours = getAvailableEndHours(form.jamMulai);
  const wholeDayAllowed = isWholeDayAllowed(form.tanggal);
  const isTodayPast = form.tanggal === todayLocalDate() && availableStartHours.length === 0;

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
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

  function handleTanggalChange(newDate: string) {
    const starts = getAvailableStartHours(newDate);
    setForm((f) => {
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

      let newRecurrenceEndDate = f.recurrenceEndDate;
      if (f.isRecurring && newRecurrenceEndDate && newDate > newRecurrenceEndDate) {
        newRecurrenceEndDate = newDate;
      }

      return {
        ...f,
        tanggal: newDate,
        recurrenceEndDate: newRecurrenceEndDate,
        isWholeDay: newIsWholeDay,
        jamMulai: newJamMulai,
        jamSelesai: newJamSelesai,
      };
    });
  }

  function handleRecurrenceEndDateChange(v: string) {
    setForm((f) => {
      if (v && v < f.tanggal) {
        const newStart = v;
        const newEnd = f.recurrenceEndDate && f.recurrenceEndDate > f.tanggal ? f.recurrenceEndDate : f.tanggal;

        let newJamMulai = f.jamMulai;
        let newJamSelesai = f.jamSelesai;
        let newIsWholeDay = f.isWholeDay;
        const starts = getAvailableStartHours(newStart);

        if (!isWholeDayAllowed(newStart)) {
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

        if (newJamMulai === "07:00" && newJamSelesai === "18:00" && isWholeDayAllowed(newStart)) {
          newIsWholeDay = true;
        } else if (newJamMulai !== "07:00" || newJamSelesai !== "18:00") {
          newIsWholeDay = false;
        }

        return {
          ...f,
          tanggal: newStart,
          recurrenceEndDate: newEnd,
          isWholeDay: newIsWholeDay,
          jamMulai: newJamMulai,
          jamSelesai: newJamSelesai,
        };
      }
      return {
        ...f,
        recurrenceEndDate: v,
      };
    });
  }

  function handleJamMulaiChange(v: string) {
    const ends = getAvailableEndHours(v);
    setForm((f) => {
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
      const autoWholeDay = f.jamMulai === "07:00" && v === "18:00" && isWholeDayAllowed(f.tanggal);
      return { ...f, jamSelesai: v, isWholeDay: autoWholeDay };
    });
  }

  function toggleWholeDay() {
    if (!form.isWholeDay && !isWholeDayAllowed(form.tanggal)) return;
    setForm((f) => ({
      ...f,
      isWholeDay: !f.isWholeDay,
      jamMulai: !f.isWholeDay ? "07:00" : f.jamMulai,
      jamSelesai: !f.isWholeDay ? "18:00" : f.jamSelesai,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSuperAdmin) {
      if (!asRole) {
        setError("Bertindak Sebagai Role wajib dipilih");
        return;
      }
      if (asRoleNeedsDivisi && !form.divisi) {
        setError("Divisi wajib dipilih untuk role ini");
        return;
      }
      if (asRoleNeedsDepartemen && !form.departemen) {
        setError("Departemen wajib dipilih untuk role ini");
        return;
      }
    } else if (isGaActor) {
      if (!form.divisi) {
        setError("Divisi wajib dipilih");
        return;
      }
      if (form.departemen === undefined) {
        setError("Departemen wajib dipilih");
        return;
      }
    }
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
    if (!form.namaRuang) {
      setError("Ruangan wajib dipilih");
      return;
    }
    if (!form.tipe) {
      setError("Tipe wajib dipilih");
      return;
    }
    if (form.isRecurring) {
      if (!form.recurrenceFrequency) {
        setError("Frekuensi pengulangan wajib dipilih");
        return;
      }
      if (!form.recurrenceEndDate) {
        setError("Tanggal akhir pengulangan wajib diisi");
        return;
      }
    }
    setBusy(true);
    try {
      const created = await api.createBooking({
        ...form,
        // "" (the explicit "Kebutuhan Divisi ini" choice) means no specific Departemen -
        // translated to undefined here (not sent at all) so the backend still records a null
        // Departemen, same as before this field became a required pick instead of an optional
        // one left blank.
        departemen: form.departemen || undefined,
        pic: form.pic || null,
        catatan: form.catatan || null,
        jamMulai: form.isWholeDay ? "07:00" : form.jamMulai,
        jamSelesai: form.isWholeDay ? "18:00" : form.jamSelesai,
        tipe: form.tipe!,
        recurrenceFrequency: form.isRecurring ? form.recurrenceFrequency : null,
        recurrenceEndDate: form.isRecurring ? form.recurrenceEndDate : null,
        asRole: isSuperAdmin ? asRole || undefined : undefined,
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Form Booking Ruang Meeting {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="f-nomor-pemesanan">Nomor Pesanan Ruangan</label>
              <input type="text" id="f-nomor-pemesanan" disabled value={nomorPemesanan} />
            </div>
            {isSuperAdmin && (
              <div className="field full">
                <label htmlFor="f-as-role">Bertindak Sebagai Role</label>
                <SearchableSelect
                  id="f-as-role"
                  value={asRole}
                  onChange={(next) => {
                    setAsRole(next as Role);
                    setForm((f) => ({ ...f, divisi: undefined, departemen: undefined }));
                  }}
                  options={AS_ROLE_OPTIONS}
                  getLabel={(v) => ROLE_LABEL[v as Role]}
                  placeholder="Pilih Role"
                  searchable={false}
                />
              </div>
            )}
            {(asRoleNeedsDivisi || (isGaActor && !isSuperAdmin)) && (
              <div className="field">
                <label htmlFor="f-divisi">Divisi</label>
                <SearchableSelect
                  id="f-divisi"
                  value={form.divisi}
                  onChange={(next) => {
                    const divisiNode = allDivisiNodes.find((d) => d.nama === next);
                    setForm((f) => ({
                      ...f,
                      divisi: next,
                      // "" (Kebutuhan Divisi) is a divisi-wide need, valid under any divisi - only
                      // a specific department name gets reset when it no longer belongs here.
                      departemen: f.departemen === "" || (f.departemen && divisiNode?.departemen.includes(f.departemen)) ? f.departemen : undefined,
                    }));
                  }}
                  options={orgStructure?.divisi || []}
                  placeholder="Pilih Divisi"
                />
              </div>
            )}
            {(asRoleNeedsDepartemen || (isGaActor && !isSuperAdmin)) && (
              <div className="field">
                <label htmlFor="f-departemen">Departemen</label>
                <SearchableSelect
                  id="f-departemen"
                  value={form.departemen}
                  onChange={(next) => {
                    if (!next) { set("departemen", next); return; }
                    const owningDivisi = allDivisiNodes.find((d) => d.departemen.includes(next))?.nama;
                    setForm((f) => ({ ...f, departemen: next, divisi: owningDivisi || f.divisi }));
                  }}
                  options={departemenOptions}
                  placeholder="Pilih Departemen"
                  clearLabel="Kebutuhan Divisi"
                />
              </div>
            )}
            <div className="field full">
              <label htmlFor="f-nama-kegiatan">Nama Kegiatan</label>
              <input type="text" id="f-nama-kegiatan" required maxLength={150} value={form.namaKegiatan} onChange={(e) => set("namaKegiatan", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-pic">Nama PIC</label>
              <input type="text" id="f-pic" required maxLength={50} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-telepon-pic">No. Telepon PIC</label>
              <input
                type="text"
                inputMode="tel"
                id="f-telepon-pic"
                required
                maxLength={20}
                value={form.noTeleponPic || ""}
                onChange={(e) => set("noTeleponPic", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field">
              <label htmlFor="f-tanggal">Tanggal</label>
              <DateFilterPicker id="f-tanggal" value={form.tanggal} onChange={handleTanggalChange} minDate={todayLocalDate()} clearable={false} disableWeekends />
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
              <SearchableSelect
                id="f-jam-mulai"
                value={form.jamMulai || (form.isWholeDay ? "07:00" : undefined)}
                onChange={handleJamMulaiChange}
                options={form.isWholeDay ? ["07:00"] : availableStartHours}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "07:00" : (availableStartHours[0] || "Tidak ada slot")}
                disabled={form.isWholeDay || availableStartHours.length === 0}
                searchable={false}
              />
            </div>
            <div className="field">
              <label htmlFor="f-jam-selesai">Jam Selesai</label>
              <SearchableSelect
                id="f-jam-selesai"
                value={form.jamSelesai || (form.isWholeDay ? "18:00" : undefined)}
                onChange={handleJamSelesaiChange}
                options={form.isWholeDay ? ["18:00"] : availableEndHours}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "18:00" : (availableStartHours.length === 0 ? "Tidak ada slot" : (availableEndHours[0] || "Pilih jam"))}
                disabled={form.isWholeDay || availableStartHours.length === 0}
                searchable={false}
              />
            </div>
            <div className="field full">
              <label htmlFor="f-sepanjang-hari">Durasi (Opsional)</label>
              <button
                type="button"
                id="f-sepanjang-hari"
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
              <label htmlFor="f-ruang">Ruangan</label>
              <SearchableSelect
                id="f-ruang"
                value={form.namaRuang || undefined}
                onChange={setNamaRuang}
                options={rooms.map((r) => r.nama)}
                placeholder="Pilih Ruangan"
              />
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
              <SearchableSelect
                id="f-tipe"
                value={form.tipe}
                onChange={(v) => set("tipe", v as BookingRuangCreatePayload["tipe"])}
                options={Object.keys(TIPE_BOOKING_LABELS)}
                getLabel={(v) => TIPE_BOOKING_LABELS[v as keyof typeof TIPE_BOOKING_LABELS] || v}
                placeholder="Pilih Tipe"
                searchable={false}
              />
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
                  <SearchableSelect
                    id="f-recurrence-frequency"
                    value={form.recurrenceFrequency || undefined}
                    onChange={(v) => set("recurrenceFrequency", v as RecurrenceFrequency)}
                    options={RECURRENCE_OPTIONS}
                    getLabel={(v) => RECURRENCE_FREQUENCY_LABELS[v as RecurrenceFrequency] || v}
                    placeholder="Pilih frekuensi"
                  />
                </div>
                <div className="field">
                  <label htmlFor="f-recurrence-end">Berulang Sampai Tanggal</label>
                  <DateFilterPicker
                    id="f-recurrence-end"
                    clearable={false}
                    minDate={todayLocalDate()}
                    value={form.recurrenceEndDate || ""}
                    onChange={handleRecurrenceEndDateChange}
                  />
                </div>
              </>
            )}
            <div className="field full">
              <label htmlFor="f-catatan">Catatan</label>
              <input type="text" id="f-catatan" maxLength={255} placeholder="Contoh: Segera di Approve" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
