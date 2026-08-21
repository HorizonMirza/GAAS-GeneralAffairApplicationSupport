"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  bookingDuplicatePayload,
  bookingOriginActorLabel,
  bookingRecurrenceLabel,
  isBookingEditableByOrigin,
  isBookingGaActionable,
  isBookingGaReschedulable,
  MAX_JUMLAH_PESERTA,
  TIPE_BOOKING_LABELS,
} from "@/lib/constants";
import { formatDateTime, todayLocalDate } from "@/lib/format";
import type { BookingRuang, BookingRuangCreatePayload, Me, RoomOption } from "@/lib/types";
import type { RejectType } from "./RejectModal";
import RoomBookingRescheduleModal from "./RoomBookingRescheduleModal";
import RoomMultiSelect from "./RoomMultiSelect";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

// Same origin-role set every Room Booking page already checks against for "can this account
// create a booking" - repeated here (rather than a new shared export) to match the codebase's
// existing convention of inlining this exact list per file.
const BOOKING_ORIGIN_ROLES: Me["role"][] = [
  "ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA",
];

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: BookingRuang | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
  onDuplicate?: (initial: Partial<BookingRuangCreatePayload>) => void;
}

function toFormFields(item: BookingRuang): BookingRuangCreatePayload {
  return {
    namaKegiatan: item.namaKegiatan,
    pic: item.pic || "",
    namaRuang: item.namaRuang,
    additionalRooms: item.additionalRooms,
    jumlahPeserta: item.jumlahPeserta,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai,
    catatan: item.catatan || "",
    tipe: item.tipe,
  };
}

export default function RoomBookingDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject, onDuplicate }: Props) {
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
  const canDuplicate = !isEdit && !!onDuplicate && BOOKING_ORIGIN_ROLES.includes(me.role);

  function handleDuplicate() {
    if (!onDuplicate) return;
    onDuplicate(bookingDuplicatePayload(item!, todayLocalDate()));
    onClose();
  }

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  // Switching the primary room to one already picked as an additional room would otherwise leave
  // a stale duplicate in additionalRooms - invisible in the UI (its chip disappears once it
  // matches namaRuang) but still sent to the backend, which rejects the save with a confusing
  // "Ruang tambahan tidak boleh sama dengan ruang utama" error the user can't see the cause of.
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

  async function handleSubmitDraft() {
    try {
      const { detail } = await api.submitBooking(item!.id);
      showToast(detail || "Booking berhasil dikirim untuk approval");
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
      const { detail } = await api.approveBookingGaApproval(item!.id);
      showToast(detail || "Booking berhasil dikonfirmasi");
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
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), MAX_JUMLAH_PESERTA);
                  set("jumlahPeserta", parsed);
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
              <label htmlFor="bv-sepanjang-hari">Durasi</label>
              <button
                type="button"
                id="bv-sepanjang-hari"
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
              <select id="bv-ruang" required disabled={!isEdit} value={form.namaRuang} onChange={(e) => setNamaRuang(e.target.value)}>
                <option value={form.namaRuang} disabled hidden>{form.namaRuang}</option>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama}</option>
                ))}
              </select>
            </div>
            {(isEdit ? rooms.filter((r) => r.nama !== form.namaRuang).length > 0 : (form.additionalRooms || []).length > 0) && (
              <div className="field full">
                <label htmlFor="bv-ruang-tambahan">Ruangan Tambahan</label>
                {isEdit ? (
                  <RoomMultiSelect
                    id="bv-ruang-tambahan"
                    rooms={rooms}
                    excludeRoom={form.namaRuang}
                    selected={form.additionalRooms || []}
                    onChange={(next) => set("additionalRooms", next)}
                  />
                ) : (
                  <input type="text" disabled value={(form.additionalRooms || []).join(", ")} />
                )}
              </div>
            )}
            <div className="field full">
              <label htmlFor="bv-tipe">Tipe</label>
              <select id="bv-tipe" disabled={!isEdit} value={form.tipe} onChange={(e) => set("tipe", e.target.value as BookingRuangCreatePayload["tipe"])}>
                {(Object.keys(TIPE_BOOKING_LABELS) as (keyof typeof TIPE_BOOKING_LABELS)[]).map((k) => (
                  <option key={k} value={k}>{TIPE_BOOKING_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="bv-catatan">Catatan</label>
              <input type="text" id="bv-catatan" disabled={!isEdit} placeholder="Contoh: Segera di Approve" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {!isEdit && bookingRecurrenceLabel(item) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Pengulangan:</strong> {bookingRecurrenceLabel(item)} (aksi approve/reject berlaku untuk seluruh jadwal seri ini)
            </div>
          )}

          {!isEdit && item.hasConflict && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12, color: "#d64545" }}>
              <strong>Bentrok:</strong> Jadwal ini bentrok dengan booking lain yang sudah Approved. Gunakan &quot;Ubah Ruang/Jadwal&quot; untuk memindahkan.
            </div>
          )}

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
            {!isEdit && (
              <a className="btn btn-secondary" style={{ width: "auto" }} href={api.bookingIcsUrl(item.id)}>
                Export Kalender (.ics)
              </a>
            )}
            {canDuplicate && (
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={handleDuplicate}>Duplikat</button>
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
