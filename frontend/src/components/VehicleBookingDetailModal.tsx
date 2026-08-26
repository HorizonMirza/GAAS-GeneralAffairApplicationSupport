"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  isKendaraanEditableByOrigin,
  isKendaraanGaActionable,
  kendaraanOriginActorLabel,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { BookingKendaraan, BookingKendaraanCreatePayload, Me, VehicleOption } from "@/lib/types";
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
  return {
    keperluan: item.keperluan,
    pic: item.pic || "",
    namaKendaraan: item.namaKendaraan,
    tujuan: item.tujuan || "",
    jumlahPenumpang: item.jumlahPenumpang,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    // The API returns TimeOnly values as "HH:mm:ss", but the Jam Mulai/Selesai <select> options
    // are "HH:mm" - without slicing, the value never matches any option and the browser silently
    // falls back to displaying the first option instead of the item's real time.
    jamMulai: item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai,
    jamSelesai: item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai,
    catatan: item.catatan || "",
  };
}

export default function VehicleBookingDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<BookingKendaraanCreatePayload | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isKendaraanEditableByOrigin(item, me);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isKendaraanGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);

  const selectedVehicle = vehicles.find((v) => v.nama === form.namaKendaraan);

  function set<K extends keyof BookingKendaraanCreatePayload>(key: K, value: BookingKendaraanCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
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

  async function handleSubmitDraft() {
    try {
      await api.submitKendaraanBooking(item!.id);
      showToast("Booking berhasil dikirim untuk approval");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleApproveL1() {
    onClose();
    try {
      await api.approveKendaraanL1(item!.id);
      showToast("Booking berhasil di-approve, diteruskan ke Admin General Affair");
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
    try {
      await api.updateKendaraanBooking(item!.id, { ...form!, pic: form!.pic || null, tujuan: form!.tujuan || null, catatan: form!.catatan || null });
      showToast("Booking berhasil diperbarui");
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
          <h3>{isEdit ? "Form Booking Kendaraan" : "Detail Booking Kendaraan"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleUpdateSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="bk-nomor-pemesanan">Nomor Pesanan Kendaraan</label>
              <input type="text" id="bk-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="bk-keperluan">Keperluan</label>
              <input type="text" id="bk-keperluan" required disabled={!isEdit} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="bk-pic">PIC</label>
              <input type="text" id="bk-pic" required disabled={!isEdit} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="bk-tujuan">Tujuan</label>
              <input type="text" id="bk-tujuan" disabled={!isEdit} value={form.tujuan || ""} onChange={(e) => set("tujuan", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bk-tanggal">Tanggal</label>
              <input type="date" id="bk-tanggal" required disabled={!isEdit} value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bk-penumpang">Jumlah Penumpang{selectedVehicle ? ` (maks ${selectedVehicle.kapasitas})` : ""}</label>
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
                  const cap = selectedVehicle?.kapasitas ?? 99;
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), cap);
                  set("jumlahPenumpang", parsed);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="bk-jam-mulai">Jam Mulai</label>
              <select id="bk-jam-mulai" required={!form.isWholeDay} disabled={!isEdit || form.isWholeDay} value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bk-jam-selesai">Jam Selesai</label>
              <select id="bk-jam-selesai" required={!form.isWholeDay} disabled={!isEdit || form.isWholeDay} value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="bk-sepanjang-hari">Durasi (Opsional)</label>
              <button
                type="button"
                id="bk-sepanjang-hari"
                className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}${!isEdit ? " field-toggle-disabled" : ""}`}
                aria-pressed={form.isWholeDay}
                disabled={!isEdit}
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
              <label htmlFor="bk-kendaraan">Kendaraan</label>
              <select id="bk-kendaraan" required disabled={!isEdit} value={form.namaKendaraan} onChange={(e) => set("namaKendaraan", e.target.value)}>
                <option value={form.namaKendaraan} disabled hidden>{form.namaKendaraan}</option>
                {vehicles.map((v) => (
                  <option key={v.nama} value={v.nama}>{v.nama} - {v.platNomor} ({v.kapasitas} orang) - Supir: {v.supir}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="bk-supir">Supir</label>
              <input type="text" id="bk-supir" disabled value={selectedVehicle?.supir ?? item.supir ?? ""} />
            </div>
            <div className="field full">
              <label htmlFor="bk-catatan">Catatan</label>
              <input type="text" id="bk-catatan" disabled={!isEdit} placeholder={isEdit ? "Contoh: Segera di Approve" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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

          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{isEdit ? "Batal" : "Tutup"}</button>
            {canSubmitDraft && (
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft}>Approve</button>
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
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
