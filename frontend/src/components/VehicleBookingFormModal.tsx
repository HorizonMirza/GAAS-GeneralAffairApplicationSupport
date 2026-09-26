"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { getAvailableEndHours, getAvailableStartHours, getDefaultBookingSlot, isWholeDayAllowed } from "@/lib/bookingTime";
import type { BookingKendaraanCreatePayload, Me, Role, VehicleOption } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
  initial?: Partial<BookingKendaraanCreatePayload>;
}

function emptyForm(initial?: Partial<BookingKendaraanCreatePayload>): BookingKendaraanCreatePayload {
  const slot = getDefaultBookingSlot(initial?.tanggal);
  const base: BookingKendaraanCreatePayload = {
    keperluan: "",
    pic: "",
    noTeleponPic: "",
    namaKendaraan: "",
    jumlahPenumpang: 1,
    tanggal: slot.tanggal,
    isWholeDay: false,
    jamMulai: slot.jamMulai,
    jamSelesai: slot.jamSelesai,
    catatan: "",
  };

  const merged = { ...base, ...initial };
  if (merged.jamMulai) merged.jamMulai = merged.jamMulai.slice(0, 5);
  if (merged.jamSelesai) merged.jamSelesai = merged.jamSelesai.slice(0, 5);

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

// The 6 roles a real actor can create a Vehicle Booking as (BookingKendaraanController.OriginRoles
// minus KPU/SUPER_ADMIN, which never create their own) - what Super Admin picks from in "Bertindak
// Sebagai Role" to declare which origin identity a new booking is created under.
const AS_ROLE_OPTIONS: Role[] = ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"];

export default function VehicleBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<BookingKendaraanCreatePayload>(emptyForm());
  const [asRole, setAsRole] = useState<Role | "">("");
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
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
      api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextKendaraanNomor(form.tanggal, isGaActor ? form.divisi : undefined, isSuperAdmin ? asRole || undefined : undefined)
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

  const selectedVehicle = vehicles.find((v) => v.nama === form.namaKendaraan);
  // Jumlah Penumpang sits above Kendaraan in the form, so a user filling top-to-bottom hasn't
  // picked a vehicle yet when they reach it - falls back to the largest capacity across the real
  // fleet (never a made-up number like 99) so it's always bounded by an actual vehicle, then
  // re-clamps to the specific vehicle's own capacity the moment one is chosen.
  const maxFleetCapacity = vehicles.length > 0 ? Math.max(...vehicles.map((v) => v.kapasitas)) : 99;
  const penumpangCap = selectedVehicle?.kapasitas ?? maxFleetCapacity;

  const availableStartHours = getAvailableStartHours(form.tanggal);
  const availableEndHours = getAvailableEndHours(form.jamMulai);
  const wholeDayAllowed = isWholeDayAllowed(form.tanggal);

  function set<K extends keyof BookingKendaraanCreatePayload>(key: K, value: BookingKendaraanCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  function handleTanggalChange(newDate: string) {
    setForm((f) => {
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
    setError("");
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
    if (!form.isWholeDay && form.jamMulai && form.jamSelesai && form.jamMulai >= form.jamSelesai) {
      setError("Jam selesai harus lebih akhir dari jam mulai");
      return;
    }
    if (!form.namaKendaraan) {
      setError("Kendaraan wajib dipilih");
      return;
    }
    if (selectedVehicle && form.jumlahPenumpang > selectedVehicle.kapasitas) {
      setError("Jumlah penumpang melebihi kapasitas kendaraan yang dipilih");
      return;
    }
    setBusy(true);
    try {
      await api.createKendaraanBooking({
        ...form,
        departemen: form.departemen || undefined,
        pic: form.pic || null,
        catatan: form.catatan || null,
        jamMulai: form.isWholeDay ? "07:00" : form.jamMulai,
        jamSelesai: form.isWholeDay ? "18:00" : form.jamSelesai,
        asRole: isSuperAdmin ? asRole || undefined : undefined,
      });
      showToast("Booking kendaraan berhasil disimpan sebagai Draft");
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
          <h3>Form Booking Kendaraan {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fk-nomor-pemesanan">Nomor Pesanan Kendaraan</label>
              <input type="text" id="fk-nomor-pemesanan" disabled value={nomorPemesanan} />
            </div>
            {isSuperAdmin && (
              <div className="field full">
                <label htmlFor="fk-as-role">Bertindak Sebagai Role</label>
                <SearchableSelect
                  id="fk-as-role"
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
                <label htmlFor="fk-divisi">Divisi</label>
                <SearchableSelect
                  id="fk-divisi"
                  value={form.divisi || undefined}
                  onChange={(v) => {
                    const divisiNode = allDivisiNodes.find((d) => d.nama === v);
                    setForm((f) => ({
                      ...f,
                      divisi: v || undefined,
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
                <label htmlFor="fk-departemen">Departemen</label>
                <SearchableSelect
                  id="fk-departemen"
                  value={form.departemen}
                  onChange={(v) => {
                    if (!v) { set("departemen", v); return; }
                    const owningDivisi = allDivisiNodes.find((d) => d.departemen.includes(v))?.nama;
                    setForm((f) => ({ ...f, departemen: v, divisi: owningDivisi || f.divisi }));
                  }}
                  options={departemenOptions}
                  placeholder="Pilih Departemen"
                  clearLabel="Kebutuhan Divisi"
                />
              </div>
            )}
            <div className="field full">
              <label htmlFor="fk-keperluan">Nama Kegiatan</label>
              <input type="text" id="fk-keperluan" required maxLength={150} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fk-pic">Nama PIC</label>
              <input type="text" id="fk-pic" required maxLength={50} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fk-telepon-pic">No. Telepon PIC</label>
              <input type="text" id="fk-telepon-pic" required maxLength={50} value={form.noTeleponPic || ""} onChange={(e) => set("noTeleponPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fk-tanggal">Tanggal</label>
              <DateFilterPicker id="fk-tanggal" value={form.tanggal} onChange={handleTanggalChange} minDate={todayLocalDate()} clearable={false} disableWeekends />
            </div>
            <div className="field">
              <label htmlFor="fk-penumpang">Jumlah Penumpang</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="fk-penumpang"
                required
                value={form.jumlahPenumpang === 0 ? "" : String(form.jumlahPenumpang)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), penumpangCap);
                  set("jumlahPenumpang", parsed);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="fk-jam-mulai">Jam Mulai</label>
              <SearchableSelect
                id="fk-jam-mulai"
                disabled={form.isWholeDay || availableStartHours.length === 0}
                value={form.jamMulai || (form.isWholeDay ? "07:00" : undefined)}
                onChange={handleJamMulaiChange}
                options={form.isWholeDay ? ["07:00"] : (form.jamMulai && !availableStartHours.includes(form.jamMulai) ? [form.jamMulai, ...availableStartHours] : availableStartHours)}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "07:00" : availableStartHours.length === 0 ? "Tidak ada slot" : "Pilih jam"}
                searchable={false}
              />
            </div>
            <div className="field">
              <label htmlFor="fk-jam-selesai">Jam Selesai</label>
              <SearchableSelect
                id="fk-jam-selesai"
                disabled={form.isWholeDay || availableStartHours.length === 0}
                value={form.jamSelesai || (form.isWholeDay ? "18:00" : undefined)}
                onChange={handleJamSelesaiChange}
                options={form.isWholeDay ? ["18:00"] : (form.jamSelesai && !availableEndHours.includes(form.jamSelesai) ? [form.jamSelesai, ...availableEndHours] : availableEndHours)}
                getLabel={(v) => (v ? v.slice(0, 5) : v)}
                placeholder={form.isWholeDay ? "18:00" : availableStartHours.length === 0 ? "Tidak ada slot" : (availableEndHours[0] || "Pilih jam")}
                searchable={false}
              />
            </div>
            <div className="field full">
              <label htmlFor="fk-sepanjang-hari">Durasi (Opsional)</label>
              <button
                type="button"
                id="fk-sepanjang-hari"
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
            </div>
            <div className="field full">
              <label htmlFor="fk-kendaraan">Kendaraan</label>
              <SearchableSelect
                id="fk-kendaraan"
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
              <label htmlFor="fk-supir">Nama Pengemudi</label>
              <SearchableSelect
                id="fk-supir"
                value={selectedVehicle?.supir}
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
              <label htmlFor="fk-catatan">Catatan</label>
              <input type="text" id="fk-catatan" maxLength={255} placeholder="Contoh: Penjemputan di lobby utama" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
