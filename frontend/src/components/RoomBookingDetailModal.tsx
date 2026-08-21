"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES, BOOKING_L1_ACTIONABLE_STATUSES, bookingOriginActorLabel, isBookingEditableByOrigin, isBookingGaActionable, isBookingGaReschedulable } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { BookingRuang, BookingRuangCreatePayload, Me, RoomOption } from "@/lib/types";
import type { RejectType } from "./RejectModal";
import RoomBookingRescheduleModal from "./RoomBookingRescheduleModal";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: BookingRuang | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

function toFormFields(item: BookingRuang): BookingRuangCreatePayload {
  return {
    namaKegiatan: item.namaKegiatan,
    pic: item.pic || "",
    namaRuang: item.namaRuang,
    jumlahPeserta: item.jumlahPeserta,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai,
    catatan: item.catatan || "",
  };
}

export default function RoomBookingDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<BookingRuangCreatePayload | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isBookingEditableByOrigin(item, me);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isBookingGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);
  const canReschedule = !isEdit && (me.role === "ADMIN_GA" || me.role === "APPROVAL_GA") && isBookingGaReschedulable(item);
  const canDownloadBukti = !isEdit && item.status === "APPROVED_GA_APPROVAL";

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
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
      await api.submitBooking(item!.id);
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
      await api.approveBookingL1(item!.id);
      showToast("Booking berhasil di-approve, diteruskan ke Admin General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveBookingGa(item!.id);
      showToast("Booking berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      await api.approveBookingGaApproval(item!.id);
      showToast("Booking berhasil dikonfirmasi");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateBooking(item!.id, { ...form!, pic: form!.pic || null, catatan: form!.catatan || null });
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
          <h3>{isEdit ? "Form Booking Ruang Meeting" : "Detail Booking Ruang Meeting"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleUpdateSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="bv-nomor-pemesanan">Nomor Pemesanan Ruangan</label>
              <input type="text" id="bv-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="bv-nama-kegiatan">Nama Kegiatan</label>
              <input type="text" id="bv-nama-kegiatan" required disabled={!isEdit} value={form.namaKegiatan} onChange={(e) => set("namaKegiatan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="bv-pic">PIC</label>
              <input type="text" id="bv-pic" required disabled={!isEdit} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bv-tanggal">Tanggal</label>
              <input type="date" id="bv-tanggal" required disabled value={form.tanggal} />
            </div>
            <div className="field">
              <label htmlFor="bv-peserta">Jumlah Peserta</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="bv-peserta"
                required
                disabled={!isEdit}
                value={form.jumlahPeserta === 0 ? "" : String(form.jumlahPeserta)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahPeserta", digits === "" ? 0 : Number(digits));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="bv-jam-mulai">Jam Mulai</label>
              <select id="bv-jam-mulai" required={!form.isWholeDay} disabled={!isEdit || form.isWholeDay} value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bv-jam-selesai">Jam Selesai</label>
              <select id="bv-jam-selesai" required={!form.isWholeDay} disabled={!isEdit || form.isWholeDay} value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)}>
                <option value="" disabled>Pilih jam</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <button
                type="button"
                className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}${!isEdit ? " field-toggle-disabled" : ""}`}
                aria-pressed={form.isWholeDay}
                disabled={!isEdit}
                onClick={toggleWholeDay}
              >
                {form.isWholeDay && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
                Sepanjang Hari
              </button>
            </div>
            <div className="field full">
              <label htmlFor="bv-ruang">Ruangan</label>
              <select id="bv-ruang" required disabled={!isEdit} value={form.namaRuang} onChange={(e) => set("namaRuang", e.target.value)}>
                <option value={form.namaRuang} disabled hidden>{form.namaRuang}</option>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="bv-catatan">Catatan</label>
              <input type="text" id="bv-catatan" disabled={!isEdit} placeholder="Opsional" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA"].includes(item.status) && (
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
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-l1", bookingOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>Approve</button>
              </>
            )}
            {canGaAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-ga", bookingOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>Approve</button>
              </>
            )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-ga-approval", bookingOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGaApproval}>Approve</button>
              </>
            )}
            {canReschedule && (
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setRescheduleOpen(true)}>Ubah Ruang/Jadwal</button>
            )}
            {canDownloadBukti && (
              <a className="btn btn-secondary" style={{ width: "auto" }} href={api.bookingPdfUrl(item.id)} target="_blank" rel="noopener noreferrer">
                Download Bukti PDF
              </a>
            )}
            {isEdit && (
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
            )}
          </div>
        </form>
      </div>

      <RoomBookingRescheduleModal
        open={rescheduleOpen}
        item={item}
        onClose={() => setRescheduleOpen(false)}
        onSaved={() => {
          onClose();
          onSaved();
        }}
      />
    </div>
  );
}
